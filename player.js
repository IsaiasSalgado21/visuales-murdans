class Player {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.width = w; this.height = h;
    this.currentFrame = 0; this.animationCounter = 0;
  }

  update() {
    let leftDown = keyIsDown(LEFT_ARROW) || keyIsDown(65);
    let rightDown = keyIsDown(RIGHT_ARROW) || keyIsDown(68);
    let upDown = keyIsDown(UP_ARROW) || keyIsDown(87);
    let downDown = keyIsDown(DOWN_ARROW) || keyIsDown(83);

    if (leftDown) {
      const speed = BASE_SPEED * (runActive.left ? RUN_MULTIPLIER : 1);
      this.x -= speed;
      side = -1;
    }
    if (rightDown) {
      const speed = BASE_SPEED * (runActive.right ? RUN_MULTIPLIER : 1);
      this.x += speed;
      side = 1;
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
    if (this.animationCounter >= playerFrameRate) {
      this.currentFrame = (this.currentFrame + 1) % numPlayerFrames;
      this.animationCounter = 0;
    }
  }

  display() {
    if (playerSpriteSheet) {
      push();
      translate(this.x + PLAYER_DRAW_OFFSET_X, this.y + PLAYER_DRAW_OFFSET_Y);
      const flipProgress = 1 - Math.abs(sideScale);
      const tilt = flipProgress * 0.6 * Math.sign(side);
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