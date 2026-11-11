// One Points object for every spark in the game: chai sparkle, crash debris, boost
// exhaust, fireflies and the fireworks over Madhubani.

import * as THREE from 'three';

const MAX = 700;

export class Particles {
  constructor(scene) {
    this.pos = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 4);
    this.size = new Float32Array(MAX);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.base = new Float32Array(MAX * 3);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.uniforms = { uScale: { value: 600 } };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */`
        attribute vec4 aColor; attribute float aSize; uniform float uScale; varying vec4 vC;
        void main() {
          vC = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / max(0.1, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying vec4 vC;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.05, d) * vC.a;
          gl_FragColor = vec4(vC.rgb * a, 1.0);
        }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this._c = new THREE.Color();
  }

  emit(x, y, z, vx, vy, vz, hex, size, life, grav = 0) {
    const i = this.next;
    this.next = (this.next + 1) % MAX;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this._c.set(hex);
    this.base[i * 3] = this._c.r; this.base[i * 3 + 1] = this._c.g; this.base[i * 3 + 2] = this._c.b;
    this.size[i] = size; this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav;
  }

  burst(x, y, z, n, hex, speed, size, life, grav = 6, up = 0) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1), s = speed * (0.4 + Math.random() * 0.6);
      this.emit(x, y, z, Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s + up, Math.sin(b) * Math.sin(a) * s,
        hex, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), grav);
    }
  }

  update(dt, pixelScale) {
    this.uniforms.uScale.value = pixelScale;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) { this.col[i * 4 + 3] = 0; continue; }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      const drag = 1 - Math.min(1, dt * 0.9);
      this.vel[i * 3] *= drag; this.vel[i * 3 + 2] *= drag;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const f = Math.max(0, this.life[i] / this.maxLife[i]);
      this.col[i * 4] = this.base[i * 3]; this.col[i * 4 + 1] = this.base[i * 3 + 1]; this.col[i * 4 + 2] = this.base[i * 3 + 2];
      this.col[i * 4 + 3] = Math.min(1, f * 2.2);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
  }
}
