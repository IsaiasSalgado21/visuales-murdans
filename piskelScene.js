(function () {
  const PISKEL_FILES = ['megazord.piskel'];

  let overlay = null;
  let canvas = null;
  let ctx = null;
  let playing = true;
  let currentIndex = 0;
  let layers = [];
  let frameCount = 0;
  let lastTime = 0;
  let mounted = false;
  let animationHandle = null;

  // runtime piskel player instance
  let piskelPlayer = null;
  let animConfigForFile = null;

  // Ensure overlay + canvas exist
  function ensureOverlay() {
    if (mounted && overlay && canvas && ctx) return;
    mounted = true;

    overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed',
      left: '0', top: '0', right: '0', bottom: '0',
      background: 'rgba(8,8,12,0.95)',
      display: 'none',
      zIndex: '99999',
      alignItems: 'center',
      justifyContent: 'center'
    });
    overlay.tabIndex = 0;
    overlay.id = 'piskel-overlay';

    canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '100%';
    canvas.style.imageRendering = 'pixelated';
    ctx = canvas.getContext('2d');

    const footer = document.createElement('div');
    Object.assign(footer.style, {
      position: 'absolute',
      left: '12px',
      bottom: '12px',
      color: '#fff',
      fontFamily: 'monospace',
      fontSize: '13px',
      padding: '6px 8px',
      background: 'rgba(0,0,0,0.4)',
      borderRadius: '6px'
    });
    footer.innerHTML = 'Enter: abrir/cerrar • ←/→ cambiar sprite • Space: play/pause • Esc: salir • +/- fps • L loop';

    overlay.appendChild(canvas);
    overlay.appendChild(footer);
    document.body.appendChild(overlay);

    window.addEventListener('resize', () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });
  }

  // Load current piskel file, build PiskelAnimation if available
  async function loadCurrentPiskel() {
    const path = PISKEL_FILES[currentIndex];
    console.log("Cargando piskel:", path);

    if (typeof window.PiskelAnimation === 'undefined') {
      await new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = 'core/piskelPlayer.js';
        s.onload = () => { console.log('core/piskelPlayer.js cargado dinámicamente'); resolve(); };
        s.onerror = () => { console.warn('No se pudo cargar core/piskelPlayer.js dinámicamente'); resolve(); };
        document.head.appendChild(s);
      });
    }

    layers = await window.loadPiskel(path);

    // --- NORMALIZAR: asegurar que todas las capas tengan la misma cantidad de frames ---
    let globalMax = 0;
    for (const L of layers) {
      if (Array.isArray(L)) globalMax = Math.max(globalMax, L.length);
    }
    if (globalMax <= 0) globalMax = 1;

    for (let i = 0; i < layers.length; i++) {
      const L = Array.isArray(layers[i]) ? layers[i] : [];
      if (L.length === 0) {
        // crear una frame transparente mínima si la capa está vacía
        const tmp = document.createElement('canvas');
        tmp.width = 1; tmp.height = 1;
        const img = new Image();
        img.src = tmp.toDataURL('image/png');
        layers[i] = Array(globalMax).fill(img);
      } else if (L.length < globalMax) {
        const last = L[L.length - 1];
        const fillCount = globalMax - L.length;
        for (let k = 0; k < fillCount; k++) L.push(last);
        layers[i] = L;
      }
    }
    // diagnóstico rápido
    console.log('piskel layers lengths after normalize:', layers.map(L => Array.isArray(L) ? L.length : 0));

    // recomputar frameCount global
    frameCount = globalMax;
    lastTime = performance.now();

    if (typeof window.PiskelAnimation === 'function') {
      const builtConfig = animConfigForFile || { name: 'default', fps: 12, loop: true, frames: [...Array(frameCount).keys()] };
      piskelPlayer = new window.PiskelAnimation(layers, builtConfig);
      if (piskelPlayer && typeof piskelPlayer.play === 'function') piskelPlayer.play('default');
    } else {
      piskelPlayer = null;
    }
  }

  // Animation loop
  function startAnimation() {
    if (animationHandle) return;
    lastTime = performance.now();
    function loop(now) {
      animationHandle = requestAnimationFrame(loop);
      const dt = now - lastTime;
      lastTime = now;
      if (!playing) return;
      if (piskelPlayer) piskelPlayer.update(dt);
      renderFrame();
    }
    animationHandle = requestAnimationFrame(loop);
  }

  function stopAnimation() {
    if (animationHandle) {
      cancelAnimationFrame(animationHandle);
      animationHandle = null;
    }
  }

  // Render current frame using piskelPlayer if present
  function renderFrame() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // determine max frame size (handle different frame representations:
    // - HTMLCanvasElement
    // - HTMLImageElement
    // - p5.Image (has .width/.height and .elt)
    // - wrapper { p5: p5.Image, canvas: HTMLCanvasElement }
    let maxW = 0, maxH = 0;
    for (const L of layers) {
      if (!Array.isArray(L) || L.length === 0) continue;
      const entry = L[0];
      if (!entry) continue;
      // unwrap possible shapes
      const cvs = entry.canvas ?? null;
      const p5img = entry.p5 ?? null;
      const img = entry.elt ?? entry; // entry could be HTMLImage or p5.Image itself
      const w = (cvs && (cvs.width || cvs.naturalWidth)) ||
                (p5img && (p5img.width || p5img.elt?.naturalWidth)) ||
                (img && (img.width || img.naturalWidth)) || 0;
      const h = (cvs && (cvs.height || cvs.naturalHeight)) ||
                (p5img && (p5img.height || p5img.elt?.naturalHeight)) ||
                (img && (img.height || img.naturalHeight)) || 0;
      maxW = Math.max(maxW, w);
      maxH = Math.max(maxH, h);
    }

    // if nothing loaded, show loading text
    if (maxW === 0 || maxH === 0) {
      ctx.fillStyle = '#fff';
      ctx.font = '16px monospace';
      ctx.fillText('Cargando sprites...', 20, 40);
      return;
    }

    // compute destination rect
    const margin = 0.72;
    const targetW = canvas.width * margin;
    const targetH = canvas.height * margin;
    const scale = Math.min(targetW / maxW, targetH / maxH, 4);
    const drawW = Math.round(maxW * scale);
    const drawH = Math.round(maxH * scale);
    const cx = Math.round((canvas.width / 2) - (drawW / 2));
    const cy = Math.round((canvas.height / 2) - (drawH / 2));

    // thumbnails (layer 0)
    const thumbSize = 48;
    const gap = 6;
    let thumbX = 12, thumbY = 56;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(thumbX - 6, thumbY - 20, Math.min(canvas.width - 24, (frameCount * (thumbSize + gap)) + 12), thumbSize + 28);
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText('Frames thumbnails (layer 0):', thumbX, thumbY - 6);

    for (let f = 0; f < frameCount; f++) {
      const L0 = layers[0] || [];
      const frameObj = L0[f] || null;
      const drawable = frameObj?.canvas ?? frameObj?.p5?.elt ?? frameObj?.elt ?? frameObj ?? null;
      if (drawable) {
        try {
          ctx.drawImage(drawable, thumbX, thumbY, thumbSize, thumbSize);
        } catch (err) {
          // fallback: if drawable is p5.Image try .elt
          const alt = frameObj?.p5?.elt ?? frameObj?.elt ?? null;
          if (alt) ctx.drawImage(alt, thumbX, thumbY, thumbSize, thumbSize);
          else {
            ctx.fillStyle = 'rgba(255,0,0,0.14)';
            ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize);
          }
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.strokeRect(thumbX, thumbY, thumbSize, thumbSize);
      } else {
        ctx.fillStyle = 'rgba(255,0,0,0.14)';
        ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize);
        ctx.fillStyle = '#fff';
        ctx.fillText('no', thumbX + 8, thumbY + 28);
      }
      ctx.fillStyle = '#fff';
      ctx.fillText(String(f), thumbX + 2, thumbY + thumbSize + 12);
      thumbX += thumbSize + gap;
    }

    // draw composed sprite (normal) using piskelPlayer if available
    if (piskelPlayer && typeof piskelPlayer.draw === 'function') {
      piskelPlayer.draw(ctx, cx, cy, drawW, drawH);
    } else {
      // fallback: draw each layer's current frame (frame 0)
      const frameIdx = 0;
      for (const L of layers) {
        const imgEntry = (L && L[frameIdx]) || null;
        if (!imgEntry) continue;
        const drawable = imgEntry?.canvas ?? imgEntry?.p5?.elt ?? imgEntry?.elt ?? imgEntry ?? null;
        if (drawable) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(drawable, cx, cy, drawW, drawH);
        }
      }
    }

    // label + state debug
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(12, 12, 520, 28);
    ctx.fillStyle = '#fff';
    ctx.font = '13px monospace';
    const frameLabel = piskelPlayer ? (piskelPlayer.currentFrame + 1) : 1;
    const totalFramesLabel = piskelPlayer ? piskelPlayer.getFrameCount() : frameCount;
    const label = `${PISKEL_FILES[currentIndex]}  frame ${frameLabel} / ${totalFramesLabel}  layers ${layers.length}`;
    ctx.fillText(label, 18, 32);

    // console diagnostics occasionally
    if (typeof window.__piskelSceneLastLog === 'undefined' || (performance.now() - window.__piskelSceneLastLog) > 800) {
      window.__piskelSceneLastLog = performance.now();
      const animFrame = piskelPlayer ? (piskelPlayer.animations.get(piskelPlayer.currentAnim).frames[Math.max(0, Math.min(piskelPlayer.currentFrame, piskelPlayer.animations.get(piskelPlayer.currentAnim).frames.length - 1))]) : 0;
      const presence = layers.map((L, idx) => {
        const fImg = (Array.isArray(L) ? L[animFrame] : null);
        const ok = !!(fImg && (fImg.canvas || fImg.p5?.elt || fImg.elt || fImg));
        return ok;
      });
      console.log('piskel debug: currentLogicalFrame=', animFrame, 'piskelPlayer.currentFrame=', piskelPlayer ? piskelPlayer.currentFrame : 'n/a', 'layerPresence=', presence);
    }
  }

  // Open / close scene (hide p5 canvas)
  async function openScene() {
    ensureOverlay();

    try {
      if (window.cnvEl) {
        window.cnvEl.style.display = 'none';
        if (typeof window.noLoop === 'function') window.noLoop();
      }
    } catch (e) { /* ignore */ }

    overlay.style.display = 'flex';
    overlay.focus();
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    await loadCurrentPiskel();
    renderFrame();
    playing = true;
    startAnimation();
    window.__piskelSceneOpen = true;
  }

  function closeScene() {
    if (overlay) overlay.style.display = 'none';
    stopAnimation();

    try {
      if (window.cnvEl) {
        window.cnvEl.style.display = '';
        if (typeof window.loop === 'function') window.loop();
      }
    } catch (e) { /* ignore */ }

    window.__piskelSceneOpen = false;
  }

  // Keyboard handling
  window.addEventListener('keydown', async (e) => {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;

    if (e.key === 'Enter') {
      ensureOverlay();
      if (overlay.style.display === 'flex') {
        closeScene();
      } else {
        await openScene();
      }
      e.preventDefault();
      return;
    }

    if (!overlay || overlay.style.display !== 'flex') return;

    if (e.key === ' ') {
      playing = !playing;
      if (playing) startAnimation(); else stopAnimation();
      e.preventDefault();
      return;
    }
    if (e.key === 'Escape') {
      closeScene();
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowRight') {
      currentIndex = (currentIndex + 1) % PISKEL_FILES.length;
      await loadCurrentPiskel();
      renderFrame();
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowLeft') {
      currentIndex = (currentIndex - 1 + PISKEL_FILES.length) % PISKEL_FILES.length;
      await loadCurrentPiskel();
      renderFrame();
      e.preventDefault();
      return;
    }

    // animation controls: + / - / L
    if ((e.key === '+' || e.key === '=') && piskelPlayer) {
      const anim = piskelPlayer.animations.get(piskelPlayer.currentAnim);
      if (anim) { anim.fps = Math.min(240, (anim.fps || 12) + 1); console.log('FPS ->', anim.fps); }
      e.preventDefault(); return;
    }
    if (e.key === '-' && piskelPlayer) {
      const anim = piskelPlayer.animations.get(piskelPlayer.currentAnim);
      if (anim) { anim.fps = Math.max(1, (anim.fps || 12) - 1); console.log('FPS ->', anim.fps); }
      e.preventDefault(); return;
    }
    if (e.key.toLowerCase() === 'l' && piskelPlayer) {
      const anim = piskelPlayer.animations.get(piskelPlayer.currentAnim);
      if (anim) { anim.loop = !anim.loop; console.log('Loop ->', anim.loop); }
      e.preventDefault(); return;
    }
  });

  // Public API
  window.__piskelScene = {
    open: openScene,
    close: closeScene,
    setFiles(files) { if (Array.isArray(files)) { PISKEL_FILES.length = 0; files.forEach(f => PISKEL_FILES.push(f)); } },
    setAnimationConfig(cfg) {
      animConfigForFile = (cfg === undefined) ? null : (Array.isArray(cfg) || (typeof cfg === 'object' && !cfg.name) ? cfg : [cfg]);
      console.log('animConfigForFile set', animConfigForFile);
    },
    setSimpleAnimation(opts = {}) {
      const cfg = { name: opts.name || 'default', fps: opts.fps || 12, loop: opts.loop !== false, frames: Array.isArray(opts.frames) ? opts.frames : [...Array(frameCount).keys()] };
      animConfigForFile = [cfg];
      console.log('simple animation set', cfg);
    },
    toggle: async () => { if (window.__piskelSceneOpen) closeScene(); else await openScene(); },
    pause() { playing = false; if (piskelPlayer && piskelPlayer.pause) piskelPlayer.pause(); stopAnimation(); },
    play() { playing = true; if (piskelPlayer && piskelPlayer.play) piskelPlayer.play(); startAnimation(); },
    nextFrame() { if (piskelPlayer && piskelPlayer.gotoFrame) piskelPlayer.gotoFrame((piskelPlayer.currentFrame + 1) % (piskelPlayer.getFrameCount() || 1)); else { /* no-op */ } renderFrame(); },
    prevFrame() { if (piskelPlayer && piskelPlayer.gotoFrame) piskelPlayer.gotoFrame((piskelPlayer.currentFrame - 1 + (piskelPlayer.getFrameCount()||1)) % (piskelPlayer.getFrameCount()||1)); renderFrame(); },
    goToFrame(index) { if (typeof index !== 'number') return; if (piskelPlayer && piskelPlayer.gotoFrame) piskelPlayer.gotoFrame(index); renderFrame(); },
    async reload() { await loadCurrentPiskel(); renderFrame(); }
  };
})();