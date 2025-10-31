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

function preload() {
  try {
    playerSpriteSheet = loadImage(SPRITE_SHEET_FILE);bgSpriteSheet = loadImage(BG_SPRITE_SHEET_FILE);
  } catch (e) {
    console.error("No se pudo cargar el archivo: " + SPRITE_SHEET_FILE);console.error("Asegúrate de que el archivo esté subido al editor p5.js.");}
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
  player = new Player(
    width / 2,
    height / 2,
    FRAME_WIDTH * PLAYER_SCALE_FACTOR,
    FRAME_HEIGHT * PLAYER_SCALE_FACTOR
  );

  mandalaPos = createVector(width / 2, height / 2);
  mandalaTimer = millis();
}

function windowResized() {
  scaleCanvasToWindow();
  if (player) {player.x = constrain(player.x, player.width / 2, width - player.width / 2);
    player.y = constrain(player.y, player.height / 2, height - player.height / 2);}
  mandalaPos.set(width / 2, height / 2);
}








function draw() {
  drawBackgroundSprite();
  player.update();player.display();
  updateMandala();drawMandala();
}









function drawBackgroundSprite() {
  if (!bgSpriteSheet) {
    background(0);
    return;}
  let frameIndex = floor(bgCurrentFrame);
  let sx = frameIndex * BG_FRAME_WIDTH;let sy = 0;
  imageMode(CORNER);
  image(bgSpriteSheet,0, 0,width, height,sx, sy,BG_FRAME_WIDTH, BG_FRAME_HEIGHT);
  bgCurrentFrame = (bgCurrentFrame + BG_FRAME_RATE) % BG_NUM_FRAMES;
}

class Player {
  constructor(x, y, w, h) {
    this.x = x;this.y = y;this.width = w;this.height = h;this.currentFrame = 0;this.animationCounter = 0;
  }

  update() {
    if (keyIsDown(LEFT_ARROW)) {this.x -= 3;}
    if (keyIsDown(RIGHT_ARROW)) {this.x += 3;}
    if (keyIsDown(UP_ARROW)) {this.y -= 3;}
    if (keyIsDown(DOWN_ARROW)) {this.y += 3;}
    this.x = constrain(this.x, this.width / 2, width - this.width / 2);
    this.y = constrain(this.y, this.height / 2, height - this.height / 2);
    this.animationCounter++;
    if (this.animationCounter >= playerFrameRate) {this.currentFrame = (this.currentFrame + 1) % numPlayerFrames;this.animationCounter = 0;}
  }

  display() {
    if (playerSpriteSheet) {
      imageMode(CENTER);
      let sx = this.currentFrame * FRAME_WIDTH;let sy = 0;
      image(playerSpriteSheet,this.x, this.y,this.width, this.height,sx, sy,FRAME_WIDTH, FRAME_HEIGHT);
    } else {fill(0, 100, 100);ellipse(this.x, this.y, this.width, this.height);}
  }
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

function drawWaves() {
  waveOffset += 0.05;noStroke();
  fill(baseHue + 20, 80, 90);rect(0, 0, width, height * 0.2);

  for (let y = height * 0.1; y < height; y += 10) {
    let currentHue = (baseHue + map(y, 0, height, -20, 20) + (sin(waveOffset * 5 + y * 0.01) * 5)) % 360;
    if (currentHue < 0) currentHue += 360;
    let currentSaturation = map(sin(waveOffset * 3 + y * 0.005), -1, 1, 70, 100);
    let currentBrightness = map(cos(waveOffset * 2 + y * 0.008), -1, 1, 60, 90);
    fill(currentHue, currentSaturation, currentBrightness);
    beginShape();vertex(0, y);

    for (let x = 0; x <= width; x += 10) {
      let waveY = y + sin(x * waveFrequency + waveOffset) * waveAmplitude;
      vertex(x, waveY);}

    vertex(width, y);vertex(width, height);vertex(0, height);endShape(CLOSE);
  }
}