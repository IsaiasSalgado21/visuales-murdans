// PiskelAnimation: administra reproducción de .piskel compuesta por capas
// framesByLayer: [ [p5.Image,..], [p5.Image,..], ... ]
// animationsConfig: either a single config object or an array of { name, fps, loop, pingpong, frames, repeat }
(function () {
  function normalizeFrames(framesByLayer) {
    const maxFrames = framesByLayer.reduce((m, L) => Math.max(m, Array.isArray(L) ? L.length : 0), 0);
    return { framesByLayer: framesByLayer.map(L => Array.isArray(L) ? L : []), frameCount: Math.max(1, maxFrames) };
  }

  class PiskelAnimation {
    constructor(framesByLayer, animationsConfig = {}) {
      const norm = normalizeFrames(framesByLayer);
      this.layers = norm.framesByLayer;
      this.frameCount = norm.frameCount;

      this.animations = new Map();
      if (Array.isArray(animationsConfig)) {
        animationsConfig.forEach(cfg => this._addAnimConfig(cfg));
      } else if (typeof animationsConfig === 'object' && Object.keys(animationsConfig).length) {
        if (Array.isArray(animationsConfig.frames) || animationsConfig.name) {
          this._addAnimConfig(Object.assign({ name: 'default' }, animationsConfig));
        } else {
          Object.entries(animationsConfig).forEach(([k, v]) => this._addAnimConfig(Object.assign({ name: k }, v)));
        }
      } else {
        this._addAnimConfig({ name: 'default', fps: 12, loop: true, frames: [...Array(this.frameCount).keys()] });
      }

      this.currentAnim = this.animations.keys().next().value || 'default';
      this.playing = true;
      this.localTime = 0;
      this.currentFrame = 0;
      this.direction = 1;
      this.repeatCounter = 0;
    }

    _addAnimConfig(cfg) {
      const name = cfg.name || 'anim';
      const fps = Number(cfg.fps) || 12;
      const loop = cfg.loop !== false;
      const pingpong = !!cfg.pingpong;
      const frames = Array.isArray(cfg.frames) && cfg.frames.length ? cfg.frames.slice() : [...Array(this.frameCount).keys()];
      const repeat = (typeof cfg.repeat === 'number') ? cfg.repeat : -1;
      this.animations.set(name, { name, fps, loop, pingpong, frames, repeat });
    }

    play(name) {
      if (name && this.animations.has(name)) this.currentAnim = name;
      this.playing = true;
    }
    pause() { this.playing = false; }
    stop() { this.playing = false; this.localTime = 0; this.currentFrame = 0; this.direction = 1; this.repeatCounter = 0; }

    setFPS(fps) {
      const a = this.animations.get(this.currentAnim);
      if (a) a.fps = Number(fps) || a.fps;
    }

    gotoFrame(idx) {
      const anim = this.animations.get(this.currentAnim);
      if (!anim) return;
      const clamped = Math.max(0, Math.min(idx, anim.frames.length - 1));
      this.currentFrame = clamped;
      this.localTime = (clamped / anim.fps) * 1000;
    }

    update(dtMs) {
      if (!this.playing) return;
      const anim = this.animations.get(this.currentAnim);
      if (!anim || anim.frames.length === 0) return;

      this.localTime += dtMs;
      const msPerFrame = 1000 / Math.max(1, anim.fps);
      // advance steps if dt large
      while (this.localTime >= msPerFrame) {
        this.localTime -= msPerFrame;
        // step frame
        if (!anim.pingpong) {
          this.currentFrame++;
          if (this.currentFrame >= anim.frames.length) {
            this.repeatCounter++;
            if (anim.loop || anim.repeat < 0 || this.repeatCounter <= anim.repeat) {
              this.currentFrame = 0;
            } else {
              // stop at end
              this.currentFrame = anim.frames.length - 1;
              this.playing = false;
            }
          }
        } else {
          this.currentFrame += this.direction;
          if (this.currentFrame >= anim.frames.length || this.currentFrame < 0) {
            // reached end/start -> flip direction
            this.direction *= -1;
            // clamp and step once in new direction
            this.currentFrame = Math.max(0, Math.min(this.currentFrame, anim.frames.length - 1));
            this.repeatCounter++;
            if (!anim.loop && anim.repeat >= 0 && this.repeatCounter > anim.repeat) {
              this.playing = false;
              // clamp to sensible end
              this.currentFrame = (this.direction === -1) ? 0 : anim.frames.length - 1;
            }
          }
        }
      }
    }

    // draw composes all layers for the logical frame index
    draw(ctx, dx, dy, dw, dh, align = 'center') {
      const anim = this.animations.get(this.currentAnim);
      if (!anim) return;
      const frameIdx = anim.frames[Math.max(0, Math.min(this.currentFrame, anim.frames.length - 1))];
      // draw each layer's frame if present
      const count = this.layers.length;
      for (let i = 0; i < count; i++) {
        const layer = this.layers[i];
        const raw = (Array.isArray(layer) && layer[frameIdx]) ? layer[frameIdx] : null;
        if (!raw) continue;
        // raw may be { p5, canvas } or a plain drawable
        const drawable = raw?.canvas ?? raw?.p5?.elt ?? raw?.elt ?? raw;
        if (!drawable) continue;
        ctx.imageSmoothingEnabled = false;
        try {
          ctx.drawImage(drawable, dx, dy, dw, dh);
        } catch (e) {
          const alt = raw?.p5?.elt ?? raw?.elt ?? null;
          if (alt) ctx.drawImage(alt, dx, dy, dw, dh);
          else console.warn('piskelPlayer.draw: no drawable for frame', frameIdx, raw);
        }
      }
    }

    isPlaying() { return this.playing; }
    currentAnimationName() { return this.currentAnim; }
    getFrameCount() {
      const anim = this.animations.get(this.currentAnim);
      return anim ? anim.frames.length : 0;
    }
  }

  window.PiskelAnimation = PiskelAnimation;
})();