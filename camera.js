// No redeclare globals — sólo inicializa defaults en window si no existen.
if (typeof window.camX === 'undefined') window.camX = 0;
if (typeof window.camY === 'undefined') window.camY = 0;
if (typeof window.camZoom === 'undefined') window.camZoom = 1;
if (typeof window.targetZoom === 'undefined') window.targetZoom = 1;
if (typeof window.zoomPhase === 'undefined') window.zoomPhase = 'idle';
if (typeof window.zoomStartTime === 'undefined') window.zoomStartTime = 0;
if (typeof window.zoomFrom === 'undefined') window.zoomFrom = 1;
if (typeof window.zoomTo === 'undefined') window.zoomTo = 1;

// defaults only if not present (script.js should define these; this is a safe fallback)
if (typeof window.BASE_ZOOM === 'undefined') window.BASE_ZOOM = 1.0;
if (typeof window.EQUIP_ZOOM === 'undefined') window.EQUIP_ZOOM = 1.28;
if (typeof window.ZOOM_IN_DURATION === 'undefined') window.ZOOM_IN_DURATION = 1000;
if (typeof window.ZOOM_OUT_DURATION === 'undefined') window.ZOOM_OUT_DURATION = 300;
if (typeof window.PARALLAX_ZOOM_FACTOR === 'undefined') window.PARALLAX_ZOOM_FACTOR = 0.02;
if (typeof window.CAM_LERP === 'undefined') window.CAM_LERP = 0.08;
if (typeof window.ZOOM_LERP === 'undefined') window.ZOOM_LERP = 0.06;

// Functions (use global vars)
function setZoomPhase(phase) {
  zoomPhase = phase;
  zoomStartTime = millis();
  zoomFrom = camZoom;
  if (phase === 'in') zoomTo = EQUIP_ZOOM;
  else if (phase === 'out') zoomTo = BASE_ZOOM;
}

function initCamera() {
  camX = (typeof player !== 'undefined' && player) ? player.x : camX;
  camY = (typeof player !== 'undefined' && player) ? player.y : camY;
  camZoom = BASE_ZOOM;
  targetZoom = BASE_ZOOM;
}

function updateCamera() {
  if (typeof player !== 'undefined' && player) {
    camX = lerp(camX, player.x, CAM_LERP);
    camY = lerp(camY, player.y, CAM_LERP);
  }

  if (zoomPhase === 'in') {
    const elapsed = millis() - zoomStartTime;
    const t = constrain(elapsed / ZOOM_IN_DURATION, 0, 1);
    const eased = t * t * (3 - 2 * t);
    camZoom = lerp(zoomFrom, zoomTo, eased);
    if (t >= 1) { camZoom = zoomTo; zoomPhase = 'idle'; }
  } else if (zoomPhase === 'out') {
    const elapsed = millis() - zoomStartTime;
    const t = constrain(elapsed / ZOOM_OUT_DURATION, 0, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    camZoom = lerp(zoomFrom, zoomTo, eased);
    if (t >= 1) { camZoom = zoomTo; zoomPhase = 'idle'; }
  } else {
    camZoom = lerp(camZoom, BASE_ZOOM, ZOOM_LERP * 0.5);
  }
}

function applyLayer(depth, extraZoom = 1) {
  push();
  translate(width / 2, height / 2);
  const layerZoom = camZoom * (1 + (1 - depth) * PARALLAX_ZOOM_FACTOR) * extraZoom;
  scale(layerZoom);
  translate(-camX * depth, -camY * depth);
}

function endLayer() {
  pop();
}