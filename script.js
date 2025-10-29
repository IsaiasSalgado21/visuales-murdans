// --- CONFIGURACIÓN DEL SPRITE SHEET (¡AJUSTA ESTO!) ---
const SPRITE_SHEET_FILE = 'murdans.png'; // Nombre de tu archivo de imagen
const FRAME_WIDTH = 124;  // Ancho de UN frame (ej: 32px)
const FRAME_HEIGHT = 124; // Alto de UN frame (ej: 32px)
// ----------------------------------------------------

// --- Configuración del Mandala ---
const MANDALA_MAX_RADIUS = 250; 
const MANDALA_STROKE_WEIGHT = 4; 
// ----------------------------------------------------

// --- ¡NUEVO! Escala del Player ---
const PLAYER_SCALE_FACTOR = 1.25; // <-- ¡AQUÍ! 1.0 = 100%, 1.25 = 125%
// ----------------------------------------------------

// --- Variables Globales ---
let player;
let playerSpriteSheet; 
let numPlayerFrames = 4; 
let playerFrameRate = 8; 

// Variables para el Mandala
let mandalaTimer = 0; 
const MANDALA_INTERVAL = 3000; 
const MANDALA_DURATION = 1000; 
let mandalaFade = 0.0; 
let mandalaHue = 0; 
let mandalaPos; 

// Variables para las olas
let waveOffset = 0; 
let waveAmplitude = 10; 
let waveFrequency = 0.02; 
let baseHue = 180; 

// --- Precarga de Recursos ---
function preload() {
  try {
    playerSpriteSheet = loadImage(SPRITE_SHEET_FILE);
  } catch (e) {
    console.error("No se pudo cargar el archivo: " + SPRITE_SHEET_FILE);
    console.error("Asegúrate de que el archivo esté subido al editor p5.js.");
  }
}

// --- Configuración Inicial ---
function setup() {
  createCanvas(800, 600); 
  colorMode(HSB, 360, 100, 100); 
  noSmooth();
  
  // --- <<< ¡CAMBIOS AQUÍ! >>> ---
  // 1. Centrado en Y (height / 2)
  // 2. Tamaño multiplicado por PLAYER_SCALE_FACTOR
  player = new Player(
    width / 2, 
    height / 2, // <-- Centrado verticalmente
    FRAME_WIDTH * PLAYER_SCALE_FACTOR, // <-- Más grande
    FRAME_HEIGHT * PLAYER_SCALE_FACTOR // <-- Más grande
  ); 

  mandalaPos = createVector(width / 2, height / 2);
  mandalaTimer = millis();
}

// --- Bucle Principal de Dibujo ---
function draw() {
  drawWaves(); 
  
  player.update(); 
  player.display(); 

  updateMandala();
  drawMandala();
}

// --- Clase Player (SIN el pulso) ---
class Player {
  constructor(x, y, w, h) {
    this.x = x; 
    this.y = y; 
    this.width = w; 
    this.height = h; 
    
    this.currentFrame = 0; 
    this.animationCounter = 0; 
  }

  update() {
    // Movimiento con las teclas
    if (keyIsDown(LEFT_ARROW)) {
      this.x -= 3;
    }
    if (keyIsDown(RIGHT_ARROW)) {
      this.x += 3;
    }
    if (keyIsDown(UP_ARROW)) {
      this.y -= 3;
    }
    if (keyIsDown(DOWN_ARROW)) {
      this.y += 3;
    }

    // Restringir a la pantalla
    this.x = constrain(this.x, this.width / 2, width - this.width / 2);
    this.y = constrain(this.y, this.height / 2, height - this.height / 2);

    // Actualizar la animación de frames
    this.animationCounter++;
    if (this.animationCounter >= playerFrameRate) {
      this.currentFrame = (this.currentFrame + 1) % numPlayerFrames; 
      this.animationCounter = 0; 
    }
    // (El código del pulso ha sido eliminado)
  }

  display() {
    if (playerSpriteSheet) {
      imageMode(CENTER); 
      
      let sx = this.currentFrame * FRAME_WIDTH;
      let sy = 0; 

      image(
        playerSpriteSheet, 
        this.x, this.y,     
        this.width, this.height, 
        sx, sy,                  
        FRAME_WIDTH, FRAME_HEIGHT 
      );
      
    } else {
      fill(0, 100, 100); 
      ellipse(this.x, this.y, this.width, this.height);
    }
  }
}

// --- Funciones del Mandala (SIN CAMBIOS) ---
function updateMandala() {
  let timeElapsed = millis() - mandalaTimer;
  
  if (timeElapsed > MANDALA_INTERVAL) {
    mandalaTimer = millis(); 
    mandalaFade = 1.0; 
    mandalaHue = random(360); 
    mandalaPos = createVector(player.x, player.y); 
  }
  
  let fadeProgress = (millis() - mandalaTimer) / MANDALA_DURATION;
  if (fadeProgress < 1.0) {
    mandalaFade = map(fadeProgress, 0, 1, 1.0, 0.0); 
  } else {
    mandalaFade = 0.0; 
  }
}

function drawMandala() {
  if (mandalaFade <= 0) {
    return; 
  }
  
  push(); 
  translate(mandalaPos.x, mandalaPos.y); 
  
  strokeWeight(MANDALA_STROKE_WEIGHT); 
  noFill(); 
  
  let petals = 8; 
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

// --- Función para Dibujar las Olas del Mar (SIN CAMBIOS) ---
function drawWaves() {
  waveOffset += 0.01; 
  noStroke(); 
  
  fill(baseHue + 20, 80, 90); 
  rect(0, 0, width, height * 0.2); 

  for (let y = height * 0.1; y < height; y += 10) { 
    let currentHue = (baseHue + map(y, 0, height, -20, 20) + (sin(waveOffset * 5 + y * 0.01) * 5)) % 360;
    if (currentHue < 0) currentHue += 360; 
    
    let currentSaturation = map(sin(waveOffset * 3 + y * 0.005), -1, 1, 70, 100);
    let currentBrightness = map(cos(waveOffset * 2 + y * 0.008), -1, 1, 60, 90);

    fill(currentHue, currentSaturation, currentBrightness);

    beginShape();
    vertex(0, y); 
    
    for (let x = 0; x <= width; x += 10) {
      let waveY = y + sin(x * waveFrequency + waveOffset) * waveAmplitude;
      vertex(x, waveY);
    }
    
    vertex(width, y); 
    vertex(width, height); 
    vertex(0, height); 
    endShape(CLOSE); 
  }
}

// --- Ajustar el tamaño del lienzo si la ventana cambia ---
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}