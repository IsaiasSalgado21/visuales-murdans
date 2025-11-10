// loadPiskel(jsonPath) -> Promise resolving an array of layers,
// cada layer es un array de objetos { p5: p5.Image|null, canvas: HTMLCanvasElement|null } o null
window.loadPiskel = function loadPiskel(jsonPath) {
  return new Promise((resolve) => {
    loadJSON(jsonPath, async (data) => {
      if (!data || !data.piskel || !Array.isArray(data.piskel.layers)) {
        console.error("Archivo .piskel inválido o con formato inesperado:", jsonPath, data);
        resolve([]);
        return;
      }

      const frameW = Number(data.piskel.width) || 0;
      const frameH = Number(data.piskel.height) || 0;

      const layerPromises = data.piskel.layers.map(async (layerStr, layerIdx) => {
        let layer;
        try {
          layer = JSON.parse(layerStr);
        } catch (e) {
          console.error("Error parseando layer JSON en", jsonPath, "layer", layerIdx, e);
          return [];
        }
        if (!layer || !Array.isArray(layer.chunks) || layer.chunks.length === 0) return [];

        const frames = [];
        let maxIndex = -1;
        const chunkPromises = [];

        function isCanvasNonEmpty(cvs) {
          try {
            const ctx = cvs.getContext('2d');
            const imgd = ctx.getImageData(0, 0, Math.max(1, cvs.width), Math.max(1, cvs.height)).data;
            // check some alpha > threshold
            for (let i = 3; i < imgd.length; i += 4) {
              if (imgd[i] > 8) return true;
            }
          } catch (e) {
            // getImageData can throw for tainted canvases; assume non-empty in that case
            return true;
          }
          return false;
        }

        for (const chunk of layer.chunks) {
          const base64 = chunk.base64PNG;
          if (!base64) continue;

          const pChunk = new Promise((resChunk) => {
            const srcImg = new Image();
            srcImg.crossOrigin = 'anonymous';
            srcImg.onload = () => {
              try {
                const cellW = frameW > 0 ? frameW : srcImg.width;
                const cellH = frameH > 0 ? frameH : srcImg.height;
                const layout = Array.isArray(chunk.layout) ? chunk.layout : [];

                // compute layout info
                const rows = layout.length || 0;
                let cols = 0;
                for (let r = 0; r < rows; r++) cols = Math.max(cols, (layout[r] || []).length);
                const expectedAtlasW = cols * cellW;
                const expectedAtlasH = rows * cellH;
                // determine logical number of frames found in layout
                let localMax = -1;
                for (let r = 0; r < rows; r++) {
                  const row = layout[r] || [];
                  for (let c = 0; c < row.length; c++) {
                    const fi = row[c];
                    if (typeof fi === 'number') localMax = Math.max(localMax, fi);
                  }
                }

                // helper to create canvas and draw region
                function makeCanvasAndDraw(sx, sy, w = cellW, h = cellH) {
                  const temp = document.createElement('canvas');
                  temp.width = w;
                  temp.height = h;
                  const tctx = temp.getContext('2d');
                  tctx.clearRect(0, 0, w, h);
                  // If source area is outside srcImg bounds, drawImage will draw nothing (transparent)
                  tctx.drawImage(srcImg, sx, sy, w, h, 0, 0, w, h);
                  return temp;
                }

                // choose extraction strategy:
                // 1) atlas grid as described by layout (sx = c*cellW, sy = r*cellH)
                // 2) swapped axes (sx = r*cellW, sy = c*cellH)
                // 3) contiguous horizontal frames (sx = frameIndex * cellW, sy = 0)
                // 4) contiguous vertical frames (sx = 0, sy = frameIndex * cellH)
                // We'll pick strategy heuristically based on srcImg dimensions and/or non-empty result.
                const strategies = ['grid', 'swap', 'horiz', 'vert'];

                // for each cell described by layout, attempt to extract with best-fitting strategy
                for (let r = 0; r < rows; r++) {
                  const row = layout[r] || [];
                  for (let c = 0; c < row.length; c++) {
                    const frameIndex = row[c];
                    if (typeof frameIndex !== 'number' || frameIndex < 0) continue;
                    maxIndex = Math.max(maxIndex, frameIndex);

                    let chosenCanvas = null;

                    // Try preferred strategy first: grid when atlas big enough
                    let tried = {};
                    for (const s of strategies) {
                      if (s === 'grid') {
                        // require src bounding to cover expected atlas, otherwise still try it but later
                        const sx = c * cellW;
                        const sy = r * cellH;
                        const temp = makeCanvasAndDraw(sx, sy);
                        if (isCanvasNonEmpty(temp)) { chosenCanvas = temp; break; }
                        tried.grid = true;
                      } else if (s === 'swap') {
                        const sx = r * cellW;
                        const sy = c * cellH;
                        const temp = makeCanvasAndDraw(sx, sy);
                        if (isCanvasNonEmpty(temp)) { chosenCanvas = temp; break; }
                        tried.swap = true;
                      } else if (s === 'horiz') {
                        const sx = frameIndex * cellW;
                        const sy = 0;
                        const temp = makeCanvasAndDraw(sx, sy);
                        if (isCanvasNonEmpty(temp)) { chosenCanvas = temp; break; }
                        tried.horiz = true;
                      } else if (s === 'vert') {
                        const sx = 0;
                        const sy = frameIndex * cellH;
                        const temp = makeCanvasAndDraw(sx, sy);
                        if (isCanvasNonEmpty(temp)) { chosenCanvas = temp; break; }
                        tried.vert = true;
                      }
                    }

                    // if none produced non-empty, still store the grid slice (so there is a drawable, even if blank)
                    if (!chosenCanvas) {
                      chosenCanvas = makeCanvasAndDraw(c * cellW, r * cellH);
                    }

                    frames[frameIndex] = { p5: null, canvas: chosenCanvas };
                  }
                }
              } catch (e) {
                console.error("Error procesando chunk image in", jsonPath, e);
              } finally {
                resChunk();
              }
            };
            srcImg.onerror = () => {
              console.error("load Image (base64) falló en", jsonPath);
              resChunk();
            };
            srcImg.src = base64;
          });

          chunkPromises.push(pChunk);
        }

        await Promise.all(chunkPromises);

        if (maxIndex < 0) return [];

        // localizar primer frame válido
        let firstValid = null;
        for (let i = 0; i <= maxIndex; i++) {
          if (frames[i]) { firstValid = frames[i]; break; }
        }

        // si no hay ninguno, crear canvas transparente mínima
        if (!firstValid) {
          const tmp = document.createElement('canvas');
          tmp.width = Math.max(1, frameW || 1);
          tmp.height = Math.max(1, frameH || 1);
          firstValid = { p5: null, canvas: tmp };
        }

        // rellenar huecos con último válido (usar objeto {p5,canvas})
        let lastSeen = firstValid;
        for (let i = 0; i <= maxIndex; i++) {
          if (frames[i]) {
            lastSeen = frames[i];
          } else {
            // clonar referencia al último válido para que siempre haya algo dibujable
            frames[i] = lastSeen;
          }
        }

        return frames; // cada entry es { p5: null, canvas: HTMLCanvasElement }
      });

      const layers = await Promise.all(layerPromises);
      resolve(layers);
    }, (err) => {
      console.error("loadJSON failed for", jsonPath, err);
      resolve([]);
    });
  });
};