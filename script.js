const SPRITE_SHEET_FILE = 'murdans.png';
const FRAME_WIDTH = 124;
const FRAME_HEIGHT = 124;

const BG_SPRITE_SHEET_FILE = 'fondo.png';
const BG_FRAME_WIDTH = 1024;
const BG_FRAME_HEIGHT = 512;
const BG_NUM_FRAMES = 3;
const BG_FRAME_RATE = 0.1;
const CANVAS_SCALE = 0.95;
const PLAYER_SCALE_FACTOR = 1.1;
const GAME_WIDTH = 1024;
const GAME_HEIGHT = 576;
const MANDALA_MAX_RADIUS = 1050;
const MANDALA_STROKE_WEIGHT = 15;
let bgSpriteSheet;let bgCurrentFrame = 0.0;
let player;let playerSpriteSheet;
let numPlayerFrames = 4;let playerFrameRate = 8;
let mandalaTimer = 0;const MANDALA_INTERVAL = 3000;
const MANDALA_DURATION = 1000;let mandalaFade = 0.0;
let mandalaHue = 0;let mandalaPos;
let cnvEl = null;let currentScale = 1;

const BASE_SPEED = 3;                // velocidad base (era 3 en tu código)
const RUN_MULTIPLIER = 2;            // multiplicador de velocidad al correr
const DOUBLE_TAP_MS = 300;           // ventana para considerar doble-tap (ms)
let side=1;                     // dirección actual de movimiento (discreta, usada para lógica)
let sideScale = 1;              // valor animado para el flip visual (1 .. -1)
const SIDE_STEP = 0.1;          // decremento/incremento por frame para el efecto "papel"
let lastKeyTime = { left:0, right:0, up:0, down:0 }; // timestamps últimos pulsos
let runCooldownUntil = { left:0, right:0, up:0, down:0 }; // bloqueo tras activar
let runActive = { left:false, right:false, up:false, down:false };
let hitboxSizes = [
  { w: FRAME_WIDTH * PLAYER_SCALE_FACTOR * 0.5, h: FRAME_HEIGHT * PLAYER_SCALE_FACTOR * 0.57, ox: 0, oy: 0 }, // player
  { w: FRAME_WIDTH * PLAYER_SCALE_FACTOR * 0.3, h: FRAME_HEIGHT * PLAYER_SCALE_FACTOR * 0.4, ox: 0, oy: 0 }  // item
];
let showHitboxes = false;
const ITEM_SPRITE_FILE = 'spr_capa.png';
const TABLA_SPRITE_FILE = 'tabla.png'; // <-- nuevo
let itemSpriteSheet;
let tablaSpriteSheet; // <-- nuevo
let item;
let capeEquipped = false;
let capeTimer = 0;
const CAPE_DURATION = 5000; // ms

// nuevo: archivo de fondo nocturno y flag
const BG_NIGHT_SPRITE_SHEET_FILE = 'fondo_noche.png';
let bgNightSpriteSheet;
let isNight = false;

// --- NUEVAS VARIABLES PARA TRANSICIÓN / BLUR ---
let pg;
let bgBlend = 0;         // 0 = día, 1 = noche (valor actual)
let bgBlendTarget = 0;   // target a interpolar
let blurAmount = 0;      // valor actual de blur (p5 filter)
// pulsado de blur (pulse: sube y baja)
let blurPulseStart = 0;
let blurPulseDuration = 0;
let blurPulseTarget = 0;
const MAX_BLUR = 3;      // blur máximo (ajustable)
const BLEND_SPEED = 0.06;
const BLUR_DEFAULT_DURATION = 500; // ms -> medio segundo (pulse total)
const ATTACHED_SCALE = 1.6; // escala de la capa cuando está puesta (ajusta aquí)
// Nuevo: offsets y suavizado de seguimiento
const ATTACHED_OFFSET_X = 12;   // distancia horizontal desde el centro del jugador (más cerca)
// Antes era -10; ahora sumamos +16px para dibujar la capa 16px más abajo cuando está puesta
const ATTACHED_OFFSET_Y = 6;    // altura relativa al centro del jugador (en px)
const ATTACHED_FOLLOW_LERP = 0.22; // 0..1, qué tan rápido sigue la capa

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
  try {
    playerSpriteSheet = loadImage(SPRITE_SHEET_FILE);
    bgSpriteSheet = loadImage(BG_SPRITE_SHEET_FILE);
    itemSpriteSheet = loadImage(ITEM_SPRITE_FILE);
    tablaSpriteSheet = loadImage(TABLA_SPRITE_FILE); // <-- cargar tabla
    // nuevo: cargar fondo nocturno en preload para cambiar instantáneamente
    bgNightSpriteSheet = loadImage(BG_NIGHT_SPRITE_SHEET_FILE);
  } catch (e) {
    console.error("No se pudo cargar el archivo: " + SPRITE_SHEET_FILE);
    console.error("Asegúrate de que el archivo esté subido al editor p5.js.");
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
  scaleCanvasToWindow(); // centra y escala inicialmente

  // buffer para copiar la pantalla y aplicar filtro blur
  pg = createGraphics(GAME_WIDTH, GAME_HEIGHT);
  pg.pixelDensity(1);
  pg.noSmooth();

  // buffer para el overlay de orillas (dibujamos en él y aplicamos BLUR)
  edgeBuffer = createGraphics(GAME_WIDTH, GAME_HEIGHT);
  edgeBuffer.pixelDensity(1);
  edgeBuffer.noSmooth();
  edgeBuffer.clear();

  player = new Player(
    width / 2 - 250, // mueve 50px a la izquierda
    height / 2,
    FRAME_WIDTH * PLAYER_SCALE_FACTOR,
    FRAME_HEIGHT * PLAYER_SCALE_FACTOR
  );

  item = new Item(width / 2, height / 2, FRAME_WIDTH * PLAYER_SCALE_FACTOR, FRAME_HEIGHT * PLAYER_SCALE_FACTOR);

  mandalaPos = createVector(player.x, player.y);
  mandalaTimer = millis();

  // inicializar cámara con la posición inicial del jugador
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

// --- Ajustes visuales: offset de dibujo del jugador ---
const PLAYER_DRAW_OFFSET_X = -6; // mueve el sprite en X (ajusta para centrar)
const PLAYER_DRAW_OFFSET_Y = -6; // mueve el sprite en Y (ajusta para centrar)

class Player {
  constructor(x, y, w, h) {
    this.x = x;this.y = y;this.width = w;this.height = h;this.currentFrame = 0;this.animationCounter = 0;
  }

  update() {
    let leftDown = keyIsDown(LEFT_ARROW) || keyIsDown(65);   // 65 = 'A'
    let rightDown = keyIsDown(RIGHT_ARROW) || keyIsDown(68); // 68 = 'D'
    let upDown = keyIsDown(UP_ARROW) || keyIsDown(87);       // 87 = 'W'
    let downDown = keyIsDown(DOWN_ARROW) || keyIsDown(83);   // 83 = 'S'

    if (leftDown) {
      const speed = BASE_SPEED * (runActive.left ? RUN_MULTIPLIER : 1);
      this.x -= speed;
      side=-1;
    }
    if (rightDown) {
      const speed = BASE_SPEED * (runActive.right ? RUN_MULTIPLIER : 1);
      this.x += speed;
      side=1;
    }
    if (upDown) {
      const speed = BASE_SPEED * (runActive.up ? RUN_MULTIPLIER : 1);
      this.y -= speed;
    }
    if (downDown) {
      const speed = BASE_SPEED * (runActive.down ? RUN_MULTIPLIER : 1);
      this.y += speed;
    }

    this.x = constrain(this.x, this.width / 2, width - this.width / 2);
    this.y = constrain(this.y, this.height / 2, height - this.height / 2);

    this.animationCounter++;
    if (this.animationCounter >= playerFrameRate) {this.currentFrame = (this.currentFrame + 1) % numPlayerFrames;this.animationCounter = 0;}
  }

  display() {
    if (playerSpriteSheet) {
      push();
      // aplicar offset visual al dibujar (no cambia la posición lógica ni colisiones)
      translate(this.x + PLAYER_DRAW_OFFSET_X, this.y + PLAYER_DRAW_OFFSET_Y);
      // usar sideScale (animado) para efecto de giro en lugar de side directo
      const flipProgress = 1 - Math.abs(sideScale); // 0 cuando normal, 1 cuando en "centro" del giro
      const tilt = flipProgress * 0.6 * Math.sign(side); // inclinación suave durante el giro
      rotate(tilt);
      scale(sideScale, 1);
      imageMode(CENTER);
      const sx = this.currentFrame * FRAME_WIDTH;
      const sy = 0;
      image(playerSpriteSheet, 0, 0, this.width, this.height, sx, sy, FRAME_WIDTH, FRAME_HEIGHT);
      pop();
    } else {
      fill(0, 100, 100);
      ellipse(this.x + PLAYER_DRAW_OFFSET_X, this.y + PLAYER_DRAW_OFFSET_Y, this.width, this.height);
    }
  }
}

class Item {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.frameRate = 8;
    this.visible = true;
    this.pickupLocked = false;
    this.attached = false; // <-- nueva bandera: está puesta en el personaje
  }

  // dibujo normal (suelo)
  display() {
    if (!this.visible) return;
    if (!itemSpriteSheet) {
      push();
      fill(0, 0, 100);
      rectMode(CENTER);
      rect(this.x, this.y, this.w, this.h);
      pop();
      return;
    }
    const totalFrames = max(1, floor(itemSpriteSheet.width / FRAME_WIDTH));
    const t = millis() / (1000 / this.frameRate);
    const frameIndex = floor(t) % totalFrames;
    const sx = frameIndex * FRAME_WIDTH;
    const sy = 0;
    imageMode(CENTER);
    image(itemSpriteSheet, this.x, this.y, this.w, this.h, sx, sy, FRAME_WIDTH, FRAME_HEIGHT);
  }

  // dibujo cuando está puesta en el jugador (se dibuja detrás del jugador)
  displayAttached(playerObj) {
    if (!itemSpriteSheet) return;
    const totalFrames = max(1, floor(itemSpriteSheet.width / FRAME_WIDTH));
    const t = millis() / (1000 / this.frameRate);
    const frameIndex = floor(t) % totalFrames;
    const sx = frameIndex * FRAME_WIDTH;
    const sy = 0;

    push();
    // usar la propia posición item.x/item.y (actualizada por el follow)
    translate(this.x, this.y);

    // la capa apunta al lado opuesto: usamos el discrete 'side' para la dirección lógica
    const dir = -side;
    rotate(-0.4 * dir);

    // Voltear horizontalmente según sideScale (animado) y mantener tamaño this.w/this.h
    scale(sideScale, 1);

    imageMode(CENTER);
    noTint();

    image(itemSpriteSheet, 0, 0, this.w, this.h, sx, sy, FRAME_WIDTH, FRAME_HEIGHT);
    pop();
  }
}

// === PARTICULAS AL RECOGER LA CAPA (ajustadas: expansión antigravedad psicodélica) ===
let particles = [];
const PARTICLE_COUNT = 140;        // más partículas
const PARTICLE_MIN_SPEED = 80;     // px/s (inicial)
const PARTICLE_MAX_SPEED = 420;    // px/s (inicial)
const PARTICLE_MIN_SIZE = 8;       // tamaño inicial mínimo (más grande)
const PARTICLE_MAX_SIZE = 28;      // tamaño inicial máximo (más grande)
const PARTICLE_LIFE = 1000;        // ms (vida total)
const PARTICLE_PEAK_RATIO = 0.18;  // fracción de vida en la que alcanzan tamaño máximo
const PARTICLE_ANTIGRAV = -0.0009; // aceleración Y (px / ms^2) negativa -> antigravedad
const PARTICLE_SWIRL = 0.0025;     // fuerza de giro lateral (px/ms^2)

class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    const a = random(TWO_PI);
    const s = random(PARTICLE_MIN_SPEED, PARTICLE_MAX_SPEED) / 1000.0; // px per ms
    // initial velocity strong outwards
    this.vx = Math.cos(a) * s;
    this.vy = Math.sin(a) * s;
    // size: start smaller then expand to peakSize then shrink
    this.startSize = random(PARTICLE_MIN_SIZE * 0.6, PARTICLE_MIN_SIZE);
    this.peakSize = random(PARTICLE_MIN_SIZE, PARTICLE_MAX_SIZE);
    this.size = this.startSize;
    this.birth = millis();
    this.life = PARTICLE_LIFE;
    // color aleatorio en HSB (ya está colorMode HSB en setup)
    this.h = random(0, 360);
    this.sat = random(70, 100);
    this.bright = random(70, 100);
    this.alpha = 1;
    // swirl direction
    this.swirlDir = random() < 0.5 ? -1 : 1;
    // small random angular phase
    this.phase = random(TWO_PI);
  }
  update(dt) {
    // dt en ms
    // aplicar antigravedad (empuje hacia arriba)
    this.vy += PARTICLE_ANTIGRAV * dt;
    // aplicar ligero giro lateral dependiente del tiempo -> psicodélico
    const ttime = (millis() - this.birth) / 1000.0;
    const swirl = Math.sin(ttime * 10 + this.phase) * PARTICLE_SWIRL * this.swirlDir;
    this.vx += swirl * dt;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const age = millis() - this.birth;
    const u = constrain(age / this.life, 0, 1);

    // crecimiento hasta peak (easeOut), luego decrecimiento (easeIn)
    if (u <= PARTICLE_PEAK_RATIO) {
      const p = u / PARTICLE_PEAK_RATIO;
      const eased = 1 - Math.pow(1 - p, 3);
      this.size = lerp(this.startSize, this.peakSize, eased);
    } else {
      const p = (u - PARTICLE_PEAK_RATIO) / (1 - PARTICLE_PEAK_RATIO);
      const eased = 1 - Math.pow(p, 2);
      this.size = lerp(this.peakSize, 0, 1 - eased);
    }

    this.alpha = 1 - u;
    return u >= 1.0;
  }
  draw() {
    push();
    // efecto additivo y brillo psicodélico
    blendMode(ADD);
    noStroke();
    fill(this.h, this.sat, this.bright, this.alpha * 255);
    // dibujar un círculo con ligera corona (dos tamaños) para glow
    ellipse(this.x, this.y, this.size, this.size);
    // un halo sutil
    fill(this.h, this.sat, min(100, this.bright + 20), this.alpha * 120);
    ellipse(this.x, this.y, this.size * 1.6, this.size * 1.6);
    pop();
  }
}

function spawnPickupParticles(x, y) {
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(new Particle(x, y));
  }
}

function updateParticles() {
  if (particles.length === 0) return;
  const dt = deltaTime; // ms
  for (let i = particles.length - 1; i >= 0; i--) {
    const dead = particles[i].update(dt);
    if (dead) particles.splice(i, 1);
  }
}

function drawParticles() {
  if (particles.length === 0) return;
  // dibujar con blendMode normal restaurado dentro de cada particula
  for (let p of particles) p.draw();
}

function updateMandala() {
  let timeElapsed = millis() - mandalaTimer;
  if (timeElapsed > MANDALA_INTERVAL) {
    mandalaTimer = millis();
    mandalaFade = 1.0;
    mandalaHue = random(360);
    mandalaPos = createVector(player.x, player.y);
  }
  let fadeProgress = (millis() - mandalaTimer) / MANDALA_DURATION;
  if (fadeProgress < 1.0) {mandalaFade = map(fadeProgress, 0, 1, 1.0, 0.0);} else {mandalaFade = 0.0;}
}

function drawMandala() {
  if (mandalaFade <= 0) {return;}
  push();translate(mandalaPos.x, mandalaPos.y);
  strokeWeight(MANDALA_STROKE_WEIGHT);noFill();

  let petals = 12;
  let currentRadius = MANDALA_MAX_RADIUS * mandalaFade;
  let currentAlpha = 255 * mandalaFade;
  rotate(millis() / 2000.0);

  for (let i = 0; i < petals; i++) {
    rotate(TWO_PI / petals);
    stroke(mandalaHue, 90, 90, currentAlpha);
    ellipse(0, currentRadius / 2, currentRadius / 2, currentRadius / 2);
    stroke(mandalaHue, 60, 100, currentAlpha);
    line(0, 0, 0, currentRadius);
  }
  pop();
}

// nueva función: dibuja hitboxes centradas + offsets para player (index 0) y item (index 1)
function drawHitboxes() {
  push();
  noFill();
  strokeWeight(2);
  rectMode(CENTER);

  // player hitbox (rojo)
  stroke(0, 100, 100);
  const hp = hitboxSizes[0];
  rect(player.x + (hp.ox || 0), player.y + (hp.oy || 0), hp.w, hp.h);

  // item hitbox: verde si está bloqueada, azul si no
  const hi = hitboxSizes[1];
  let ix = item.x;
  let iy = item.y;
  if (item && item.attached) {
    // cuando está puesta, la hitbox sigue la posición del jugador
    ix = player.x + (hi.ox || 0);
    iy = player.y + (hi.oy || 0);
  }
  if (item && item.pickupLocked) {
    stroke(120, 100, 80); // verde
  } else {
    stroke(200, 100, 100); // azul
  }
  rect(ix, iy, hi.w, hi.h);

  pop();
}

// nueva versión de checkCollision que usa hitboxSizes con offsets (índices opcionales)
function checkCollision(p, it, pIndex = 0, iIndex = 1) {
  const hp = hitboxSizes[pIndex];
  const hi = hitboxSizes[iIndex];

  const px = p.x + (hp.ox || 0);
  const py = p.y + (hp.oy || 0);
  const ix = it.x + (hi.ox || 0);
  const iy = it.y + (hi.oy || 0);

  const bw = hp.w;
  const bh = hp.h;
  const iw = hi.w;
  const ih = hi.h;

  const dx = Math.abs(px - ix);
  const dy = Math.abs(py - iy);

  const overlapX = dx < (bw + iw) / 2;
  const overlapY = dy < (bh + ih) / 2;
  return overlapX && overlapY;
}

function setBlurPulse(target, duration = BLUR_DEFAULT_DURATION) {
  blurPulseStart = millis();
  blurPulseDuration = Math.max(0, duration);
  blurPulseTarget = target;
}

// nueva función: dibuja tabla debajo del jugador pero por encima de la capa,
// usando el mismo índice de frame que el jugador para mantener timing.
function drawTablaUnderPlayer(playerObj) {
  if (!tablaSpriteSheet) return;

  // calcular frame sincronizado con el jugador
  const frameIndex = playerObj.currentFrame || 0;
  const sx = frameIndex * FRAME_WIDTH;
  const sy = 0;

  push();
  imageMode(CENTER);

  // posición ligeramente por debajo/centro del jugador (ajusta offsets si hace falta)
  const offsetY = 6;      // desplaza la tabla verticalmente respecto al centro del jugador
  const offsetX = 0;      // si quieres desplazar lateralmente según side, ajusta aquí
  const drawX = playerObj.x + offsetX;
  const drawY = playerObj.y + offsetY;

  // tamaño: seguir tamaño del jugador (se puede ajustar)
  const drawW = playerObj.width * 1.05;
  const drawH = playerObj.height * 1.05;

  // si la tabla necesita flip según side para mantener coherencia, aplicarlo:
  if (side === -1) {
    // voltear horizontalmente alrededor del punto de dibujo
    translate(drawX, drawY);
    scale(-1, 1);
    image(tablaSpriteSheet, 0, 0, drawW, drawH, sx, sy, FRAME_WIDTH, FRAME_HEIGHT);
  } else {
    image(tablaSpriteSheet, drawX, drawY, drawW, drawH, sx, sy, FRAME_WIDTH, FRAME_HEIGHT);
  }

  pop();
}