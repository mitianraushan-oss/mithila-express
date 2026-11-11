// Keyboard and touch input folded into one small state object.

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'boost',
};

export class Input {
  constructor() {
    this.keys = { left: false, right: false, up: false, down: false, boost: false };
    this.touch = { left: false, right: false, boost: false };
    this.onAction = null;   // (name) => void for one-shot keys

    window.addEventListener('keydown', (e) => {
      const k = KEYMAP[e.code];
      if (k) { this.keys[k] = true; e.preventDefault(); }
      if (e.repeat) return;
      if (e.code === 'Enter' || e.code === 'Space') this.onAction?.('confirm');
      if (e.code === 'KeyP' || e.code === 'Escape') this.onAction?.('pause');
      if (e.code === 'KeyM') this.onAction?.('mute');
      if (e.code === 'KeyH') this.onAction?.('horn');
    });
    window.addEventListener('keyup', (e) => {
      const k = KEYMAP[e.code];
      if (k) this.keys[k] = false;
    });
    window.addEventListener('blur', () => this.clear());

    for (const el of document.querySelectorAll('[data-touch]')) {
      const name = el.dataset.touch;
      const set = (v) => (e) => {
        e.preventDefault();
        this.touch[name] = v;
        el.classList.toggle('held', v);
      };
      el.addEventListener('pointerdown', (e) => { el.setPointerCapture?.(e.pointerId); set(true)(e); });
      el.addEventListener('pointerup', set(false));
      el.addEventListener('pointercancel', set(false));
      el.addEventListener('lostpointercapture', set(false));
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  clear() {
    for (const k in this.keys) this.keys[k] = false;
    for (const k in this.touch) this.touch[k] = false;
    for (const el of document.querySelectorAll('[data-touch].held')) el.classList.remove('held');
  }

  get steer() {
    return ((this.keys.right || this.touch.right) ? 1 : 0) - ((this.keys.left || this.touch.left) ? 1 : 0);
  }
  get boost() { return this.keys.boost || this.touch.boost; }
  get up() { return this.keys.up; }
  get down() { return this.keys.down; }
}
