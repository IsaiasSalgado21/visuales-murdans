const SPRITE_SHEET_FILE = 'murdans.png'; // <- si el PNG está en otra carpeta, cambia la ruta aquí
const FRAME_WIDTH = 124;
const FRAME_HEIGHT = 124;

const BG_SPRITE_SHEET_FILE = 'fondo.png';
const BG_NIGHT_SPRITE_SHEET_FILE = 'fondo_noche.png'; // <-- fichero de fondo nocturno
const TABLA_SPRITE_FILE = 'tabla.png';                // <-- fichero de la tabla
const ITEM_SPRITE_FILE = 'spr_capa.png';              // <-- fichero spritesheet de la capa (spr_capa.png)
const BG_FRAME_WIDTH = 1024;
const BG_FRAME_HEIGHT = 512;
const BG_NUM_FRAMES = 3;
const BG_FRAME_RATE = 0.1;
const CANVAS_SCALE = 0.95;
const PLAYER_SCALE_FACTOR = 1.1;

// velocidad de interpolación para crossfade/bg blend
const BLEND_SPEED = 0.06;

// offsets de dibujo del sprite (compensan el anclaje del sprite)
const PLAYER_DRAW_OFFSET_X = 0;
const PLAYER_DRAW_OFFSET_Y = 6;

const GAME_WIDTH = 1024;
const GAME_HEIGHT = 576;
const MANDALA_MAX_RADIUS = 1050;
const MANDALA_STROKE_WEIGHT = 15;
let bgSpriteSheet;
let bgNightSpriteSheet = null;
let bgCurrentFrame = 0.0;
let player;
let playerSpriteSheet;
let itemSpriteSheet = null;    // <- añadida: evita ReferenceError en item.js
let tablaSpriteSheet = null; // <- añadida: evita ReferenceError cuando no se define TABLA_SPRITE_FILE
let numPlayerFrames = 4;let playerFrameRate = 8;
let mandalaTimer = 0;const MANDALA_INTERVAL = 3000;
const MANDALA_DURATION = 1000;let mandalaFade = 0.0;
let mandalaHue = 0;let mandalaPos;
// --- nueva variable/constantes para rotación del mandala ---
let mandalaRotation = 0;
const MANDALA_ROT_SPEED = 0.9; // vueltas por segundo (ajusta a gusto: >0 gira)
const MANDALA_ROT_EASE = 0.6;  // cuánto influye el fade en la velocidad (0..1)

// --- NUEVAS VARIABLES PARA TRANSICIÓN / BLUR ---
let pg;
let bgBlend = 0;         // 0 = día, 1 = noche (valor actual)
let bgBlendTarget = 0;   // target a interpolar
let blurAmount = 0;      // valor actual de blur (p5 filter)
// pulsado de blur (pulse: sube y baja)
let blurPulseStart = 0;
let blurPulseDuration = 0;
let blurPulseTarget = 0;

// CONSTANTES FALTANTES (evitan ReferenceError)
const MAX_BLUR = 12;               // máximo blur aplicable (ajustar según gusto)
const BLUR_DEFAULT_DURATION = 700; // ms por defecto para el pulso de blur

// offsets y lerp para la capa (attached)
const ATTACHED_OFFSET_X = 28;      // separación lateral de la capa respecto al jugador
const ATTACHED_OFFSET_Y = 8;       // separación vertical de la capa respecto al jugador
const ATTACHED_FOLLOW_LERP = 0.12; // cuánto sigue la capa la posición objetivo

// Añadir helper para iniciar un pulso de blur
function setBlurPulse(amount, durationMs) {
  blurPulseTarget = constrain(amount, 0, MAX_BLUR);
  blurPulseDuration = max(0, durationMs | 0); // asegurar entero no negativo
  blurPulseStart = millis();
  // opcional: si duration es 0 aplicamos directamente
  if (blurPulseDuration === 0) {
    blurAmount = blurPulseTarget;
    blurPulseTarget = 0;
  }
}

// --- CÁMARA / PARALLAX ---
let camX = 0, camY = 0;          // posición de cámara (mundo)
let camZoom = 1;                // zoom actual
let targetZoom = 1;             // (ya no usado para zoom dramatic)
const PARALLAX_ZOOM_FACTOR = 0.02;
const CAM_LERP = 0.08;
const ZOOM_LERP = 0.06;

// --- EDGE FADE / COLORED EDGES (animado, explosivo, con blur en buffer) ---
const EDGE_SOLID_BAND = 36;       // banda sólida mínima en px
const EDGE_FADE_SIZE = 120;      // ancho del fade interior (px) — mayor para efecto expansivo
const EDGE_FADE_STEPS = 36;      // pasos para aproximar el gradiente
const EDGE_MAX_ALPHA = 230;      // alpha máximo (0..255)
const EDGE_BLUR_AMOUNT = 10;     // cantidad de blur aplicado al buffer

// control de color / animación
const EDGE_HUE_SPEED = 0.02;     // velocidad de cambio de hue
const EDGE_HUE_SPREAD = 80;      // separación de matices entre pasos
const EDGE_MOVEMENT_FREQ = 0.0015; // frecuencia de movimiento para ondas

let edgeBuffer = null; // buffer para dibujar overlay de orillas con blur

function drawEdgeFade() {
  if (!edgeBuffer) return;

  // distancia del jugador a cada orilla (en px)
  const halfW = player.width / 2;
  const halfH = player.height / 2;
  const leftDist = player.x - halfW;
  const rightDist = (width - (player.x + halfW));
  const topDist = player.y - halfH;
  const bottomDist = (height - (player.y + halfH));

  // si no estamos cerca de ninguna orilla, limpiar buffer y salir
  if (leftDist > EDGE_SOLID_BAND + EDGE_FADE_SIZE &&
      rightDist > EDGE_SOLID_BAND + EDGE_FADE_SIZE &&
      topDist > EDGE_SOLID_BAND + EDGE_FADE_SIZE &&
      bottomDist > EDGE_SOLID_BAND + EDGE_FADE_SIZE) {
    edgeBuffer.clear();
    return;
  }

  // preparar buffer
  edgeBuffer.clear();
  edgeBuffer.push();
  edgeBuffer.resetMatrix();
  edgeBuffer.rectMode(CORNER);
  edgeBuffer.noStroke();
  edgeBuffer.blendMode(ADD); // colores explosivos suman luz
  edgeBuffer.colorMode(HSB, 360, 100, 100, 255);

  const stepsW = max(1, EDGE_FADE_STEPS);
  const stepsH = max(1, EDGE_FADE_STEPS);
  const stepW = EDGE_FADE_SIZE / stepsW;
  const stepH = EDGE_FADE_SIZE / stepsH;

  const time = millis();
  const baseHue = (time * EDGE_HUE_SPEED) % 360;

  // helper prox factor 0..1
  const proxFactor = (dist) => constrain((EDGE_SOLID_BAND + EDGE_FADE_SIZE - dist) / (EDGE_SOLID_BAND + EDGE_FADE_SIZE), 0, 1);

  // dibuja una franja vertical u horizontal con colores animados
  const drawVerticalGradient = (xStart, widthBand, dist, sideIndex) => {
    const pf = proxFactor(dist);
    if (pf <= 0.001) return;

    // banda sólida (pequeña)
    if (dist < EDGE_SOLID_BAND) {
      const solidAlpha = EDGE_MAX_ALPHA * constrain((EDGE_SOLID_BAND - dist) / EDGE_SOLID_BAND, 0, 1);
      edgeBuffer.fill((baseHue + sideIndex * EDGE_HUE_SPREAD) % 360, 100, 80, solidAlpha);
      edgeBuffer.rect(xStart, 0, widthBand, height);
    }

    // gradiente animado
    for (let i = 0; i < stepsW; i++) {
      const x = xStart + widthBand + i * stepW;
      const w = stepW;
      const t = 1 - (i + 0.5) / stepsW; // 1..0
      // movimiento ondulatorio para alpha y hue offset
      const wave = 0.5 + 0.5 * Math.sin(time * EDGE_MOVEMENT_FREQ * 1000 + i * 0.4 + sideIndex * 1.2);
      const alpha = EDGE_MAX_ALPHA * t * pf * wave * 0.95;
      if (alpha > 1) {
        const hue = (baseHue + sideIndex * EDGE_HUE_SPREAD + i * 6 + wave * 30) % 360;
        edgeBuffer.fill(hue, 100, 100, alpha);
        edgeBuffer.rect(x, 0, w, height);
      }
      // sutil glow line adicional para romper monotonía
      if (i % 6 === 0) {
        const hue2 = (baseHue + sideIndex * EDGE_HUE_SPREAD * 0.5 + (i * 12)) % 360;
        edgeBuffer.fill(hue2, 90, 70, alpha * 0.35);
        edgeBuffer.rect(x, height * 0.15, w, height * 0.7);
      }
    }
  };

  const drawHorizontalGradient = (yStart, heightBand, dist, sideIndex) => {
    const pf = proxFactor(dist);
    if (pf <= 0.001) return;

    if (dist < EDGE_SOLID_BAND) {
      const solidAlpha = EDGE_MAX_ALPHA * constrain((EDGE_SOLID_BAND - dist) / EDGE_SOLID_BAND, 0, 1);
      edgeBuffer.fill((baseHue + sideIndex * EDGE_HUE_SPREAD) % 360, 100, 80, solidAlpha);
      edgeBuffer.rect(0, yStart, width, heightBand);
    }

    for (let i = 0; i < stepsH; i++) {
      const y = yStart + heightBand + i * stepH;
      const h = stepH;
      const t = 1 - (i + 0.5) / stepsH;
      const wave = 0.5 + 0.5 * Math.sin(time * EDGE_MOVEMENT_FREQ * 1000 + i * 0.35 + sideIndex * -1.4);
      const alpha = EDGE_MAX_ALPHA * t * pf * wave * 0.95;
      if (alpha > 1) {
        const hue = (baseHue + sideIndex * EDGE_HUE_SPREAD + i * 6 + wave * -30) % 360;
        edgeBuffer.fill(hue, 100, 100, alpha);
        edgeBuffer.rect(0, y, width, h);
      }
      if (i % 8 === 0) {
        const hue2 = (baseHue + sideIndex * EDGE_HUE_SPREAD * 0.6 + i * 9) % 360;
        edgeBuffer.fill(hue2, 90, 70, alpha * 0.28);
        edgeBuffer.rect(width * 0.15, y, width * 0.7, h);
      }
    }
  };

  // Ejecutar por cada orilla con sideIndex para variar matices
  drawVerticalGradient(0, EDGE_SOLID_BAND, leftDist, 0);                         // izquierda
  drawVerticalGradient(width - EDGE_SOLID_BAND - EDGE_FADE_SIZE, EDGE_SOLID_BAND, rightDist, 1); // derecha
  drawHorizontalGradient(0, EDGE_SOLID_BAND, topDist, 2);                       // arriba
  drawHorizontalGradient(height - EDGE_SOLID_BAND - EDGE_FADE_SIZE, EDGE_SOLID_BAND, bottomDist, 3); // abajo

  edgeBuffer.pop();

  // aplicar blur al buffer y dibujar sobre el canvas (en pantalla, sin transformaciones)
  edgeBuffer.filter(BLUR, EDGE_BLUR_AMOUNT);

  push();
  resetMatrix();
  blendMode(ADD);
  imageMode(CORNER);
  image(edgeBuffer, 0, 0, width, height);
  blendMode(BLEND);
  pop();

  // restaurar modo de color del resto del juego
  colorMode(HSB, 360, 100, 100);
}

// --- Toggle de parallax ---
let parallaxEnabled = true; // true = cámara/parallax activo, false = visión "normal" (sin parallax)

// --- NUEVO: ZOOM DRAMÁTICO AL PONER/QUITAR CAPA ---
let zoomPhase = 'idle';         // 'idle' | 'in' | 'out'
let zoomStartTime = 0;
let zoomFrom = 1;
let zoomTo = 1;
const BASE_ZOOM = 1.0;
const EQUIP_ZOOM = 1.28;        // zoom dramático objetivo al ponérsela
const ZOOM_IN_DURATION = 1000;  // ms -> subida lenta
const ZOOM_OUT_DURATION = 300;  // ms -> bajada más rápida

function setZoomPhase(phase) {
  zoomPhase = phase;
  zoomStartTime = millis();
  zoomFrom = camZoom;
  if (phase === 'in') zoomTo = EQUIP_ZOOM;
  else if (phase === 'out') zoomTo = BASE_ZOOM;
}

function initCamera() {
  camX = player.x;
  camY = player.y;
  camZoom = BASE_ZOOM;
  targetZoom = BASE_ZOOM;
}

function updateCamera() {
  // seguir posición suavemente
  camX = lerp(camX, player.x, CAM_LERP);
  camY = lerp(camY, player.y, CAM_LERP);

  // gestionar zoom por fases con easing temporal
  if (zoomPhase === 'in') {
    const elapsed = millis() - zoomStartTime;
    const t = constrain(elapsed / ZOOM_IN_DURATION, 0, 1);
    // easing suave (smoothstep) para subida lenta
    const eased = t * t * (3 - 2 * t);
    camZoom = lerp(zoomFrom, zoomTo, eased);
    if (t >= 1) {
      camZoom = zoomTo;
      zoomPhase = 'idle';
    }
  } else if (zoomPhase === 'out') {
    const elapsed = millis() - zoomStartTime;
    const t = constrain(elapsed / ZOOM_OUT_DURATION, 0, 1);
    // easing rápido en la bajada (easeOut cubic)
    const eased = 1 - Math.pow(1 - t, 3);
    camZoom = lerp(zoomFrom, zoomTo, eased);
    if (t >= 1) {
      camZoom = zoomTo;
      zoomPhase = 'idle';
    }
  } else {
    // sin fase: mantener a base o lerpear mínimo por si algo más lo controla
    camZoom = lerp(camZoom, BASE_ZOOM, ZOOM_LERP * 0.5);
  }
}

// aplicar transform para una capa con 'depth' en [0..1]
// depth = 0 => muy lejos (se mueve poco), depth = 1 => pegado a la cámara (se mueve todo)
// opcional extraZoom para ajustar la escala local de la capa
function applyLayer(depth, extraZoom = 1) {
  push();
  // centrar en pantalla
  translate(width / 2, height / 2);
  // efecto de zoom por capa: capas más lejanas pueden tener zoom levemente distinto
  const layerZoom = camZoom * (1 + (1 - depth) * PARALLAX_ZOOM_FACTOR) * extraZoom;
  scale(layerZoom);
  // mover el mundo en función de la cámara y la profundidad (parallax)
  // capas con depth=1 se centran en camX/camY (siguen al jugador),
  // depth=0 prácticamente no se mueven respecto al mundo.
  translate(-camX * depth, -camY * depth);
}

// cierra la transform de capa
function endLayer() {
  pop();
}

function preload() {
  playerSpriteSheet = loadImage(SPRITE_SHEET_FILE,
    img => { playerSpriteSheet = img; },
    err => { console.error("No se pudo cargar el archivo:", SPRITE_SHEET_FILE); playerSpriteSheet = null; }
  );

  bgSpriteSheet = loadImage(BG_SPRITE_SHEET_FILE,
    img => { bgSpriteSheet = img; },
    err => { console.warn("No se pudo cargar el archivo de fondo:", BG_SPRITE_SHEET_FILE); bgSpriteSheet = null; }
  );

  // cargar tabla como spritesheet (igual que el personaje)
  tablaSpriteSheet = loadImage(TABLA_SPRITE_FILE,
    img => { tablaSpriteSheet = img; },
    err => { console.warn("No se pudo cargar tabla sprite:", TABLA_SPRITE_FILE); tablaSpriteSheet = null; }
  );

  // cargar fondo nocturno
  bgNightSpriteSheet = loadImage(BG_NIGHT_SPRITE_SHEET_FILE,
    img => { bgNightSpriteSheet = img; },
    err => { console.warn("No se pudo cargar bg night sprite:", BG_NIGHT_SPRITE_SHEET_FILE); bgNightSpriteSheet = null; }
  );

  // opcional: item sprite si existe la constante
  if (typeof ITEM_SPRITE_FILE !== 'undefined') {
    itemSpriteSheet = loadImage(ITEM_SPRITE_FILE,
      img => { itemSpriteSheet = img; },
      err => { console.warn("No se pudo cargar item sprite:", ITEM_SPRITE_FILE); itemSpriteSheet = null; }
    );
  } else {
    itemSpriteSheet = null;
  }
}

function scaleCanvasToWindow() {
  if (!cnvEl) return;

  const scaleX = (windowWidth * CANVAS_SCALE) / GAME_WIDTH;
  const scaleY = (windowHeight * CANVAS_SCALE) / GAME_HEIGHT;
  const scale = Math.min(scaleX, scaleY, 1.0);
  currentScale = scale;

  cnvEl.style.position = 'absolute';
  cnvEl.style.left = '50%';
  cnvEl.style.top = '50%';
  cnvEl.style.transformOrigin = '50% 50%';
  cnvEl.style.transform = `translate(-50%, -50%) scale(${scale})`;

  cnvEl.style.width = `${GAME_WIDTH}px`;
  cnvEl.style.height = `${GAME_HEIGHT}px`;
  cnvEl.style.imageRendering = 'pixelated'; 
}

function setup() {
  let cnv = createCanvas(GAME_WIDTH, GAME_HEIGHT);
  cnvEl = cnv.canvas;
  pixelDensity(1);
  noSmooth();
  colorMode(HSB, 360, 100, 100);
  noStroke();
  document.body.style.overflow = 'hidden';
  cnvEl.style.width = `${GAME_WIDTH}px`;
  cnvEl.style.height = `${GAME_HEIGHT}px`;
  scaleCanvasToWindow();

  pg = createGraphics(GAME_WIDTH, GAME_HEIGHT);
  pg.pixelDensity(1);
  pg.noSmooth();

  edgeBuffer = createGraphics(GAME_WIDTH, GAME_HEIGHT);
  edgeBuffer.pixelDensity(1);
  edgeBuffer.noSmooth();
  edgeBuffer.clear();

  // ahora usamos las clases movidas a player.js/item.js
  player = new Player(
    width / 2 - 250,
    height / 2,
    FRAME_WIDTH * PLAYER_SCALE_FACTOR,
    FRAME_HEIGHT * PLAYER_SCALE_FACTOR
  );

  item = new Item(width / 2, height / 2, FRAME_WIDTH * PLAYER_SCALE_FACTOR, FRAME_HEIGHT * PLAYER_SCALE_FACTOR);

  mandalaPos = createVector(player.x, player.y);
  mandalaTimer = millis();

  initCamera();
}

function windowResized() {
  scaleCanvasToWindow();
  if (player) {player.x = constrain(player.x, player.width / 2, width - player.width / 2);
    player.y = constrain(player.y, player.height / 2, height - player.height / 2);}
  mandalaPos.set(width / 2, height / 2);
}

function _dirFromKeyEvent() {
  if (keyCode === LEFT_ARROW || key === 'a' || key === 'A') return 'left';
  if (keyCode === RIGHT_ARROW || key === 'd' || key === 'D') return 'right';
  if (keyCode === UP_ARROW || key === 'w' || key === 'W') return 'up';
  if (keyCode === DOWN_ARROW || key === 's' || key === 'S') return 'down';
  return null;
}

function keyPressed() {
  // toggle hitbox mostrando/ocultando con la tecla '1'
  if (key === '1') {
    showHitboxes = !showHitboxes;
    return;
  }
  // toggle parallax con la tecla '2'
  if (key === '2') {
    parallaxEnabled = !parallaxEnabled;
    // opcional: cuando activas parallax, inicializa cámara para evitar saltos bruscos
    if (parallaxEnabled) {
      // mantener camZoom y permitir que updateCamera lo acomode; iniciar cam cerca del jugador
      camX = player.x;
      camY = player.y;
    } else {
      // al desactivar, aseguramos zoom base para que no quede ampliado en la vista normal
      camZoom = BASE_ZOOM;
      zoomPhase = 'idle';
    }
    return;
  }

  const dir = _dirFromKeyEvent();
  if (!dir) return;
  const now = millis();

  if (runCooldownUntil[dir] && now < runCooldownUntil[dir]) {
    lastKeyTime[dir] = now;
    return;
  }

  if (lastKeyTime[dir] && (now - lastKeyTime[dir]) <= DOUBLE_TAP_MS) {
    runActive[dir] = true;
    runCooldownUntil[dir] = now + DOUBLE_TAP_MS;
    lastKeyTime[dir] = 0; // reset
  } else {
    lastKeyTime[dir] = now;
  }
}

function keyReleased() {
  const dir = _dirFromKeyEvent();
  if (!dir) return;
  runActive[dir] = false;
}

function updateMandala() {
  const now = millis();

  // si ha pasado el intervalo, reiniciamos el mandala (fade = 1)
  if (now - mandalaTimer >= MANDALA_INTERVAL) {
    mandalaTimer = now;
    mandalaFade = 1.0;
    mandalaHue = (mandalaHue + 40) % 360;
    if (mandalaPos && player) mandalaPos.set(player.x, player.y);
  }

  // decrecer el fade sobre la duración
  if (mandalaFade > 0) {
    const elapsed = now - mandalaTimer;
    mandalaFade = constrain(1 - elapsed / MANDALA_DURATION, 0, 1);
  }

  // actualizar rotación del mandala (deltaTime en ms)
  const dt = (typeof deltaTime !== 'undefined') ? deltaTime / 1000 : (1/60);
  // velocidad en rad/s: MANDALA_ROT_SPEED vueltas/s -> * TWO_PI para rad/s
  const speedFactor = (MANDALA_ROT_EASE * mandalaFade) + (1 - MANDALA_ROT_EASE) * 1.0;
  mandalaRotation += dt * (MANDALA_ROT_SPEED * TWO_PI) * speedFactor;
  // mantener en rango para evitar overflow
  if (mandalaRotation > TWO_PI) mandalaRotation = mandalaRotation % TWO_PI;
}

function drawMandala() {
  if (!mandalaPos || mandalaFade <= 0.001) return;

  push();
  translate(mandalaPos.x, mandalaPos.y);
  // aplicar rotación global del mandala
  rotate(mandalaRotation);

  colorMode(HSB, 360, 100, 100, 1);
  noStroke();
  blendMode(ADD);

  const time = millis() / 1000;
  const baseRadius = map(mandalaFade, 0, 1, 0, MANDALA_MAX_RADIUS);

  // parámetros de control (ajústalos si hace falta)
  const RINGS = 6;
  const MAX_TRIANGLES = 600;   // tope global para evitar sobrecarga
  const SUBDIV_DEPTH = 2;      // profundidad de subdivisión (0..3 recomendados)
  let drawn = 0;

  for (let r = 0; r < RINGS && drawn < MAX_TRIANGLES; r++) {
    const t = r / Math.max(1, RINGS - 1);
    const ringRadius = baseRadius * (0.15 + 0.85 * t);
    const triBase = ringRadius * (0.22 + 0.18 * (1 - t)); // tamaño relativo de triángulo
    const count = max(3, floor(6 + r * 6)); // triángulos por anillo
    const hueBase = (mandalaHue + r * 18) % 360;
    const rotOffset = time * 0.25 * (r % 2 ? 1 : -1);

    for (let i = 0; i < count && drawn < MAX_TRIANGLES; i++) {
      const ang = i * (TWO_PI / count) + rotOffset;
      const cx = cos(ang) * ringRadius;
      const cy = sin(ang) * ringRadius;

      // vértices de un triángulo orientado alrededor del punto (cx,cy)
      const a1 = ang - 0.55;
      const a2 = ang + 0.55;
      const a3 = ang + PI;
      const v1 = { x: cx + cos(a1) * triBase, y: cy + sin(a1) * triBase };
      const v2 = { x: cx + cos(a2) * triBase, y: cy + sin(a2) * triBase };
      const v3 = { x: cx + cos(a3) * (triBase * 0.6), y: cy + sin(a3) * (triBase * 0.6) };

      // subdivisión iterativa (stack) para crear efecto fractal limitado
      const stack = [{ v1, v2, v3, depth: 0 }];
      while (stack.length && drawn < MAX_TRIANGLES) {
        const it = stack.pop();
        const depth = it.depth;

        // alpha y color dependen de la profundidad y del anillo (menos carga visual en anillos externos)
        const alpha = mandalaFade * lerp(0.12, 0.88, 1 - depth / Math.max(1, SUBDIV_DEPTH)) * lerp(1 - t * 0.7, 1, 1);
        const hue = (hueBase + depth * 8 + sin(time * 1.8 + depth) * 6) % 360;
        fill(hue, 90, 100, alpha);
        triangle(it.v1.x, it.v1.y, it.v2.x, it.v2.y, it.v3.x, it.v3.y);
        drawn++;

        if (depth < SUBDIV_DEPTH) {
          // crear 3 sub-triángulos por los puntos medios (no usar recursion)
          const m12 = { x: (it.v1.x + it.v2.x) * 0.5, y: (it.v1.y + it.v2.y) * 0.5 };
          const m23 = { x: (it.v2.x + it.v3.x) * 0.5, y: (it.v2.y + it.v3.y) * 0.5 };
          const m31 = { x: (it.v3.x + it.v1.x) * 0.5, y: (it.v3.y + it.v1.y) * 0.5 };
          // empujar con depth+1 (orden no importante)
          stack.push({ v1: it.v1, v2: m12, v3: m31, depth: depth + 1 });
          stack.push({ v1: m12, v2: it.v2, v3: m23, depth: depth + 1 });
          stack.push({ v1: m31, v2: m23, v3: it.v3, depth: depth + 1 });
        }
      }
    }
  }

  blendMode(BLEND);
  colorMode(HSB, 360, 100, 100);
  pop();
}

function draw() {
  // suavizar/transicionar valores de blend (bg) y blur (ahora time-based)
  bgBlend = lerp(bgBlend, bgBlendTarget, BLEND_SPEED);

  // actualizar sideScale hacia side (efecto paso a paso: 0.1 por frame)
  const diff = side - sideScale;
  if (Math.abs(diff) <= SIDE_STEP) {
    sideScale = side;
  } else {
    sideScale += SIDE_STEP * Math.sign(diff);
  }

  // Interpolación temporal para blur (pulse: sube y baja durante blurPulseDuration)
  if (blurPulseDuration > 0) {
    const elapsed = millis() - blurPulseStart;
    const t = constrain(elapsed / blurPulseDuration, 0, 1);
    let val;
    if (t < 0.5) {
      const subT = constrain(t / 0.5, 0, 1);
      const eased = subT * subT * (3 - 2 * subT);
      val = lerp(0, blurPulseTarget, eased);
    } else {
      const subT = constrain((t - 0.5) / 0.5, 0, 1);
      const eased = subT * subT * (3 - 2 * subT);
      val = lerp(blurPulseTarget, 0, eased);
    }
    blurAmount = val;
    if (t >= 1) {
      blurPulseDuration = 0;
      blurAmount = 0;
    }
  } else {
    blurAmount = 0;
  }

  // actualizar lógica del jugador antes de dibujar (posición, pickup, timers)
  player.update();

  // PICKUP: si el item está en suelo, visible, no bloqueado, no lo llevamos y colisionamos -> recoger
  if (item && item.visible && !item.pickupLocked && !capeEquipped && !item.attached && checkCollision(player, item, 0, 1)) {
    item.attached = true;
    capeEquipped = true;
    capeTimer = CAPE_DURATION;
    bgBlendTarget = 1;
    setBlurPulse(MAX_BLUR, BLUR_DEFAULT_DURATION);
    setZoomPhase('in');                // <-- añadido
    item.pickupLocked = true;
    // iniciar posición de la capa justo cerca del jugador para evitar "salto"
    const initDir = -side;
    item.x = player.x + initDir * ATTACHED_OFFSET_X;
    item.y = player.y + ATTACHED_OFFSET_Y;
    // <-- nueva línea: generar partículas al recoger
    spawnPickupParticles(player.x, player.y);
  }

  // Temporizador de la capa
  if (capeEquipped) {
    capeTimer -= deltaTime;
    if (capeTimer <= 0) {
      capeEquipped = false;
      bgBlendTarget = 0;
      setBlurPulse(MAX_BLUR, BLUR_DEFAULT_DURATION);
      setZoomPhase('out');               // <-- añadido

      item.attached = false;
      item.visible = true;
      item.x = player.x;
      item.y = player.y;
      item.pickupLocked = true;
      capeTimer = 0;
    }
  }

  // desbloquear pickup cuando el jugador salga de la hitbox (solo si está en suelo)
  if (item && item.visible && item.pickupLocked && !item.attached && !checkCollision(player, item, 0, 1)) {
    item.pickupLocked = false;
  }

  // Si la capa está puesta, hacer que la capa siga suavemente la posición objetivo del jugador
  if (item && item.attached) {
    const dir = -side; // la capa va al lado opuesto
    const targetX = player.x + dir * ATTACHED_OFFSET_X;
    const targetY = player.y + ATTACHED_OFFSET_Y;
    item.x = lerp(item.x, targetX, ATTACHED_FOLLOW_LERP);
    item.y = lerp(item.y, targetY, ATTACHED_FOLLOW_LERP);
  }

  // actualizar partículas (si las hay)
  updateParticles();

  // fondo (full canvas)
  push();
  resetMatrix();
  drawBackgroundSprite();
  pop();

  if (parallaxEnabled) {
    // --- ACTUALIZAR CÁMARA y dibujado con parallax/zoom ---
    updateCamera();

    // mandala (muy cerca del jugador ahora)
    applyLayer(0.98, 1.0);
    updateMandala();
    drawMandala();
    endLayer();

    // tabla (casi a la par del jugador)
    applyLayer(0.99, 1.0);
    if (tablaSpriteSheet) drawTablaUnderPlayer(player);
    endLayer();

    // capa attached (ligeramente debajo del jugador pero muy cercana)
    applyLayer(0.995, 1.0);
    if (item && item.attached) item.displayAttached(player);
    endLayer();

    // jugador (capa frontal, depth = 1 para seguir completamente)
    applyLayer(1.0, 1.0);
    player.display();

    // dibujar partículas EN LA MISMA CAPA que el jugador (sobre/encima del sprite)
    drawParticles();

    endLayer();

    // item en suelo (por encima del jugador cuando no está attached), muy cercano
    applyLayer(0.997, 1.0);
    if (item && !item.attached) item.display();
    endLayer();

    // dibujar el fade de orillas (asegura que se vea encima de la escena)
    drawEdgeFade();
  } else {
    // --- VISIÓN NORMAL sin parallax/zoom: dibujar objetos en coordenadas directas ---
    updateMandala();
    drawMandala();

    if (tablaSpriteSheet) drawTablaUnderPlayer(player);

    if (item && item.attached) item.displayAttached(player);

    player.display();

    // dibujar partículas en visión normal (mismas coordenadas de mundo)
    drawParticles();

    if (item && !item.attached) item.display();
  }

  // UI / hitboxes / texto (NO afectadas por cámara -> dibujadas en pantalla)
  if (showHitboxes) {
    drawHitboxes();

    push();
    fill(0, 0, 100);
    noStroke();
    textSize(16);
    textAlign(LEFT, TOP);
    const estado = capeEquipped ? 'puesta' : 'no puesta';
    let texto = `Capa: ${estado}`;
    if (capeEquipped) {
      texto += `  (${(capeTimer/1000).toFixed(1)} s)`;
    }
    // indicar estado del parallax
    texto += `\nParallax: ${parallaxEnabled ? 'ACTIVADO' : 'DESACTIVADO'}`;
    text(texto, 10, 10);
    pop();
  }

  // --- APLICAR BLUR SUAVEMENTE (solo overlay temporal) ---
  if (blurAmount > 0.01) {
    pg.clear();
    const snap = get(0, 0, width, height);
    pg.image(snap, 0, 0, width, height);
    pg.filter(BLUR, blurAmount);
    const blurAlpha = constrain(map(blurAmount, 0, MAX_BLUR, 0, 1), 0, 1);
    push();
    tint(255, 255 * blurAlpha);
    image(pg, 0, 0, width, height);
    noTint();
    pop();
  }
}

// modificar drawBackgroundSprite para elegir fondo según bgBlend (crossfade)
function drawBackgroundSprite() {
  if (!bgSpriteSheet) {
    background(0);
    return;
  }
  let frameIndex = floor(bgCurrentFrame);
  let sx = frameIndex * BG_FRAME_WIDTH;
  let sy = 0;

  // dibujar fondo diurno base
  imageMode(CORNER);
  image(bgSpriteSheet, 0, 0, width, height, sx, sy, BG_FRAME_WIDTH, BG_FRAME_HEIGHT);

  // si existe fondo nocturno, dibujarlo encima con alpha bgBlend
  if (bgNightSpriteSheet && bgBlend > 0.001) {
    push();
    // aplicar tint para controlar alfa
    tint(255, bgBlend * 255);
    image(bgNightSpriteSheet, 0, 0, width, height, sx, sy, BG_FRAME_WIDTH, BG_FRAME_HEIGHT);
    noTint();
    pop();
  }

  // avanzar frame de animación
  bgCurrentFrame = (bgCurrentFrame + BG_FRAME_RATE) % BG_NUM_FRAMES;
}

// --- Player class moved to player.js ---
/* Player class moved to player.js. Keep this placeholder to avoid redeclaration.
   Ensure player.js is loaded before script.js in index.html. */

// --- Item class moved to item.js ---
/* Item class moved to item.js. Keep this placeholder to avoid redeclaration.
   Ensure item.js is loaded before script.js in index.html. */

function drawTablaUnderPlayer(playerObj) {
  if (!tablaSpriteSheet) return;

  const frameIndex = playerObj.currentFrame || 0;
  const sx = frameIndex * FRAME_WIDTH;
  const sy = 0;

  push();
  imageMode(CENTER);

  const offsetY = 6;
  const offsetX = 0;
  const drawX = playerObj.x + offsetX;
  const drawY = playerObj.y + offsetY;

  const drawW = (playerObj.width || FRAME_WIDTH) * 1.05;
  const drawH = (playerObj.height || FRAME_HEIGHT) * 1.05;

  if (side === -1) {
    // flip horizontal alrededor del punto de dibujo
    push();
    translate(drawX, drawY);
    scale(-1, 1);
    image(tablaSpriteSheet, 0, 0, drawW, drawH, sx, sy, FRAME_WIDTH, FRAME_HEIGHT);
    pop();
  } else {
    image(tablaSpriteSheet, drawX, drawY, drawW, drawH, sx, sy, FRAME_WIDTH, FRAME_HEIGHT);
  }

  pop();
}

// Dirección / escalado visual del sprite (valor por defecto)
let side = 1;         // 1 = mirando a la derecha, -1 = izquierda
let sideScale = 1;    // valor interpolado usado para flip suave
const SIDE_STEP = 0.12; // cuánto cambia sideScale por frame (0..1)

// estado de la capa / temporizador
let capeEquipped = false;
const CAPE_DURATION = 6000; // ms, ajusta a gusto
let capeTimer = 0;

// controles de carrera / double-tap (si no los tienes definidos)
let runActive = { left: false, right: false, up: false, down: false };
let runCooldownUntil = {};
let lastKeyTime = {};
const DOUBLE_TAP_MS = 250;
const BASE_SPEED = 3.2;     // ajusta velocidad base
const RUN_MULTIPLIER = 1.8; // multiplicador cuando se corre

// hitboxSizes: editar aquí para ajustar cajas (index 0 = player, index 1 = item)
let hitboxSizes = [
  { w: FRAME_WIDTH * PLAYER_SCALE_FACTOR * 0.5, h: FRAME_HEIGHT * PLAYER_SCALE_FACTOR * 0.57, ox: 0, oy: 0 }, // player
  // item/capa: un poco más estrecha que la del player
  { w: FRAME_WIDTH * PLAYER_SCALE_FACTOR * 0.42, h: FRAME_HEIGHT * PLAYER_SCALE_FACTOR * 0.5, ox: 0, oy: 6 }  // item / capa
];

// toggle para mostrar hitboxes en pantalla
let showHitboxes = false;

// Hitbox editor UI + persistencia (editar hitboxSizes en tiempo real)
let hitboxEditorVisible = false;
const HITBOX_LS_KEY = 'visuales_murdans_hitboxes';
let hitboxEditorEl = null;

function loadHitboxesFromStorage() {
  try {
    const raw = localStorage.getItem(HITBOX_LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) hitboxSizes = parsed.map(h => Object.assign({ w: 0, h: 0, ox: 0, oy: 0 }, h));
  } catch (e) {
    console.warn('no se pudo cargar hitboxSizes desde storage', e);
  }
}

function saveHitboxesToStorage() {
  try {
    localStorage.setItem(HITBOX_LS_KEY, JSON.stringify(hitboxSizes));
  } catch (e) {
    console.warn('no se pudo guardar hitboxSizes', e);
  }
}

function createHitboxEditor() {
  if (hitboxEditorEl) return;
  const container = document.createElement('div');
  container.id = 'hitbox-editor';
  Object.assign(container.style, {
    position: 'fixed', right: '12px', top: '12px',
    background: 'rgba(0,0,0,0.7)', color: '#fff',
    padding: '8px', zIndex: 9999, fontFamily: 'monospace',
    fontSize: '13px', borderRadius: '6px', maxWidth: '320px'
  });

  const title = document.createElement('div'); title.textContent = 'Hitbox Editor';
  title.style.fontWeight = '700';
  container.appendChild(title);

  const info = document.createElement('div');
  info.style.margin = '6px 0';
  info.innerHTML = 'Editar w / h / ox / oy &nbsp; <button id="hitbox-save">Guardar</button>';
  container.appendChild(info);

  const list = document.createElement('div'); list.id = 'hitbox-list'; container.appendChild(list);
  document.body.appendChild(container);
  hitboxEditorEl = container;

  document.getElementById('hitbox-save').onclick = () => { saveHitboxesToStorage(); };
  refreshHitboxEditor();
}

function refreshHitboxEditor() {
  if (!hitboxEditorEl) return;
  const list = hitboxEditorEl.querySelector('#hitbox-list');
  list.innerHTML = '';
  hitboxSizes.forEach((hb, idx) => {
    const row = document.createElement('div'); row.style.margin = '8px 0';
    const hdr = document.createElement('div');
    hdr.textContent = `#${idx} — ${idx === 0 ? 'player' : 'item'}`;
    hdr.style.fontWeight = '600';
    row.appendChild(hdr);

    const fields = ['w', 'h', 'ox', 'oy'];
    fields.forEach(k => {
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex'; wrapper.style.gap = '6px'; wrapper.style.alignItems = 'center'; wrapper.style.marginTop = '4px';
      const label = document.createElement('label'); label.textContent = k; label.style.width = '22px';
      const input = document.createElement('input');
      input.type = 'number';
      input.value = hb[k] || 0;
      input.style.width = '90px';
      // ajuste fino: mantener enteros
      input.oninput = (ev) => { hitboxSizes[idx][k] = Number(ev.target.value); };
      wrapper.appendChild(label); wrapper.appendChild(input);
      row.appendChild(wrapper);
    });

    list.appendChild(row);
  });
}

function toggleHitboxEditor() {
  hitboxEditorVisible = !hitboxEditorVisible;
  if (hitboxEditorVisible) {
    createHitboxEditor();
    hitboxEditorEl.style.display = 'block';
    refreshHitboxEditor();
  } else if (hitboxEditorEl) {
    hitboxEditorEl.style.display = 'none';
  }
}

// cargar al iniciar si hay guardado
loadHitboxesFromStorage();

// atajo teclado: H para abrir/cerrar editor sin interferir con p5 keyPressed
window.addEventListener('keydown', (e) => {
  if (e.key === 'h' || e.key === 'H') { toggleHitboxEditor(); e.preventDefault(); }
});

// helper: construir caja (cx,cy,w,h) a partir de objeto usando hitboxSizes cuando proceda
function _getHitboxFor(obj, fallbackIndex = null) {
  let def = null;
  // Preferir la configuración por tipo si hay instancia de las clases
  try {
    if (typeof Player !== 'undefined' && obj instanceof Player) def = hitboxSizes[0];
    else if (typeof Item !== 'undefined' && obj instanceof Item) def = hitboxSizes[1];
  } catch (e) {
    // en algunos entornos instanceof puede fallar; fallback a name check
    if (obj && obj.constructor && obj.constructor.name === 'Player') def = hitboxSizes[0];
    if (obj && obj.constructor && obj.constructor.name === 'Item') def = hitboxSizes[1];
  }
  if (!def && typeof fallbackIndex === 'number' && hitboxSizes[fallbackIndex]) def = hitboxSizes[fallbackIndex];

  if (def) {
    const ox = def.ox || 0;
    const oy = def.oy || 0;
    return {
      cx: (obj.x ?? 0) + ox,
      cy: (obj.y ?? 0) + oy,
      w: (def.w ?? (obj.width ?? obj.w ?? 0)),
      h: (def.h ?? (obj.height ?? obj.h ?? 0))
    };
  }

  // fallback: usar dimensiones del propio objeto centradas en x,y
  return {
    cx: (obj.x ?? 0),
    cy: (obj.y ?? 0),
    w: (obj.width ?? obj.w ?? 0),
    h: (obj.height ?? obj.h ?? 0)
  };
}

// AABB collision que usa hitboxSizes para Player/Item por defecto
function checkCollision(objA, objB, padding = 0, scale = 1) {
  const a = _getHitboxFor(objA);
  const b = _getHitboxFor(objB);

  const aw = a.w * scale;
  const ah = a.h * scale;
  const bw = b.w * scale;
  const bh = b.h * scale;

  const aHalfW = Math.max(0, aw / 2 - padding);
  const aHalfH = Math.max(0, ah / 2 - padding);
  const bHalfW = Math.max(0, bw / 2 - padding);
  const bHalfH = Math.max(0, bh / 2 - padding);

  return (Math.abs(a.cx - b.cx) <= (aHalfW + bHalfW)) && (Math.abs(a.cy - b.cy) <= (aHalfH + bHalfH));
}

// Dibuja hitboxes en pantalla usando las mismas cajas que checkCollision
function drawHitboxes() {
  if (!player) return;
  push();
  colorMode(HSB, 360, 100, 100);
  noFill();
  strokeWeight(1.5);
  rectMode(CENTER);

  const ph = _getHitboxFor(player, 0);
  stroke(200, 80, 90);
  rect(ph.cx, ph.cy, ph.w, ph.h);
  stroke(0, 0, 100);
  line(ph.cx - 6, ph.cy, ph.cx + 6, ph.cy);
  line(ph.cx, ph.cy - 6, ph.cx, ph.cy + 6);

  if (typeof item !== 'undefined' && item) {
    const ih = _getHitboxFor(item, 1);
    stroke(40, 90, 90);
    rect(ih.cx, ih.cy, ih.w, ih.h);

    noStroke();
    fill(0, 0, 100);
    textSize(12);
    textAlign(CENTER, TOP);
    const label = item.attached ? 'attached' : (item.pickupLocked ? 'locked' : 'floor');
    text(label, ih.cx, ih.cy + ih.h / 2 + 4);
  }

  pop();
}