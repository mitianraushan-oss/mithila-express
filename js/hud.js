// DOM heads-up display. Every setter skips the DOM write when nothing changed.

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.el = {
      hud: $('hud'), fuel: $('fuel'), fuelFill: $('fuel-fill'), chai: $('chai-count'), region: $('region-name'),
      progress: $('progress'), fill: $('progress-fill'), marker: $('progress-marker'), km: $('km-left'),
      speed: $('speed'), clock: $('clock'), banner: $('banner'), toast: $('toast'), mute: $('btn-mute'),
    };
    this.cache = {};
    this.bannerTimer = 0; this.toastTimer = 0;
  }

  set(key, value, apply) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    apply(value);
  }

  show(on) { this.el.hud.hidden = !on; }

  update(fuel, chai, speedKmh, clock, progress, kmLeft, region) {
    const e = this.el;
    this.set('fuel', Math.round(fuel), (v) => {
      e.fuelFill.style.width = v + '%';
      e.fuel.setAttribute('aria-valuenow', v);
      e.fuel.classList.toggle('low', v < 22);
    });
    this.set('chai', chai, (v) => { e.chai.textContent = v; });
    this.set('speed', Math.round(speedKmh), (v) => { e.speed.textContent = v; });
    this.set('clock', Math.floor(clock), (v) => { e.clock.textContent = fmtTime(v); });
    this.set('prog', Math.round(progress * 1000), (v) => {
      e.fill.style.width = v / 10 + '%';
      e.marker.style.left = v / 10 + '%';
      e.progress.setAttribute('aria-valuenow', Math.round(v / 10));
    });
    this.set('km', Math.round(kmLeft), (v) => { e.km.textContent = v > 0 ? `${v.toLocaleString('en-IN')} km to go` : 'Arrived'; });
    this.set('region', region, (v) => { e.region.textContent = v; });
  }

  pulseFuel() {
    const f = this.el.fuel;
    f.classList.remove('pulse'); void f.offsetWidth; f.classList.add('pulse');
  }

  banner(title, sub) {
    const b = this.el.banner;
    b.querySelector('h2').textContent = title;
    b.querySelector('p').textContent = sub;
    b.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => b.classList.remove('show'), 3200);
  }

  toast(text, good = false) {
    const t = this.el.toast;
    t.textContent = text;
    t.classList.toggle('good', good);
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), 1300);
  }

  muted(m) { this.el.mute.classList.toggle('off', m); }
}

export function fmtTime(s) {
  s = Math.floor(s);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
