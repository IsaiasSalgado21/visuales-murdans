class Item {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.frameRate = 8;
    this.visible = true;
    this.pickupLocked = false;
    this.attached = false;
  }

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

  displayAttached(playerObj) {
    if (!itemSpriteSheet) return;
    const totalFrames = max(1, floor(itemSpriteSheet.width / FRAME_WIDTH));
    const t = millis() / (1000 / this.frameRate);
    const frameIndex = floor(t) % totalFrames;
    const sx = frameIndex * FRAME_WIDTH;
    const sy = 0;

    push();
    translate(this.x, this.y);
    const dir = -side;
    rotate(-0.4 * dir);
    scale(sideScale, 1);
    imageMode(CENTER);
    noTint();
    image(itemSpriteSheet, 0, 0, this.w, this.h, sx, sy, FRAME_WIDTH, FRAME_HEIGHT);
    pop();
  }
}