// Guardar/usar variables globales sin redeclararlas
if (typeof window.particles === 'undefined') window.particles = [];
if (typeof window.PARTICLE_COUNT === 'undefined') window.PARTICLE_COUNT = 140;
if (typeof window.PARTICLE_MIN_SPEED === 'undefined') window.PARTICLE_MIN_SPEED = 80;
if (typeof window.PARTICLE_MAX_SPEED === 'undefined') window.PARTICLE_MAX_SPEED = 420;
if (typeof window.PARTICLE_MIN_SIZE === 'undefined') window.PARTICLE_MIN_SIZE = 8;
if (typeof window.PARTICLE_MAX_SIZE === 'undefined') window.PARTICLE_MAX_SIZE = 28;
if (typeof window.PARTICLE_LIFE === 'undefined') window.PARTICLE_LIFE = 1000;
if (typeof window.PARTICLE_PEAK_RATIO === 'undefined') window.PARTICLE_PEAK_RATIO = 0.18;
if (typeof window.PARTICLE_ANTIGRAV === 'undefined') window.PARTICLE_ANTIGRAV = -0.0009;
if (typeof window.PARTICLE_SWIRL === 'undefined') window.PARTICLE_SWIRL = 0.0025;

class Particle {
  constructor(x, y) {
    this.x = x; this.y = y;
    const a = random(TWO_PI);
    const s = random(window.PARTICLE_MIN_SPEED, window.PARTICLE_MAX_SPEED) / 1000.0;
    this.vx = Math.cos(a) * s;
    this.vy = Math.sin(a) * s;
    this.startSize = random(window.PARTICLE_MIN_SIZE * 0.6, window.PARTICLE_MIN_SIZE);
    this.peakSize = random(window.PARTICLE_MIN_SIZE, window.PARTICLE_MAX_SIZE);
    this.size = this.startSize;
    this.birth = millis();
    this.life = window.PARTICLE_LIFE;
    this.h = random(0, 360);
    this.sat = random(70, 100);
    this.bright = random(70, 100);
    this.alpha = 1;
    this.swirlDir = random() < 0.5 ? -1 : 1;
    this.phase = random(TWO_PI);
  }
  update(dt) {
    this.vy += window.PARTICLE_ANTIGRAV * dt;
    const ttime = (millis() - this.birth) / 1000.0;
    const swirl = Math.sin(ttime * 10 + this.phase) * window.PARTICLE_SWIRL * this.swirlDir;
    this.vx += swirl * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const age = millis() - this.birth;
    const u = constrain(age / this.life, 0, 1);
    if (u <= window.PARTICLE_PEAK_RATIO) {
      const p = u / window.PARTICLE_PEAK_RATIO;
      const eased = 1 - Math.pow(1 - p, 3);
      this.size = lerp(this.startSize, this.peakSize, eased);
    } else {
      const p = (u - window.PARTICLE_PEAK_RATIO) / (1 - window.PARTICLE_PEAK_RATIO);
      const eased = 1 - Math.pow(p, 2);
      this.size = lerp(this.peakSize, 0, 1 - eased);
    }
    this.alpha = 1 - u;
    return u >= 1.0;
  }
  draw() {
    push();
    blendMode(ADD);
    noStroke();
    fill(this.h, this.sat, this.bright, this.alpha * 255);
    ellipse(this.x, this.y, this.size, this.size);
    fill(this.h, this.sat, min(100, this.bright + 20), this.alpha * 120);
    ellipse(this.x, this.y, this.size * 1.6, this.size * 1.6);
    pop();
  }
}

function spawnPickupParticles(x, y) {
  for (let i = 0; i < window.PARTICLE_COUNT; i++) {
    window.particles.push(new Particle(x, y));
  }
}

function updateParticles() {
  if (window.particles.length === 0) return;
  const dt = deltaTime;
  for (let i = window.particles.length - 1; i >= 0; i--) {
    const dead = window.particles[i].update(dt);
    if (dead) window.particles.splice(i, 1);
  }
}

function drawParticles() {
  if (window.particles.length === 0) return;
  for (let p of window.particles) p.draw();
}