// The auto-rickshaw: yellow canopy, green body, three wheels and one brave headlight.
// The model faces -Z.

import * as THREE from 'three';
import { lerp } from './util.js';

const BEAM_VERT = /* glsl */`
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const BEAM_FRAG = /* glsl */`
uniform float uOpacity; uniform vec3 uColor;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  float rim = pow(abs(dot(normalize(vN), normalize(vV))), 1.5);
  float a = uOpacity * pow(vUv.y, 1.6) * rim;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

export class Rickshaw {
  constructor(scene) {
    const g = new THREE.Group();
    this.group = g;
    this.body = new THREE.Group();     // leans and bounces independently of the wheels
    g.add(this.body);

    const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
    const green = new THREE.MeshStandardMaterial({ color: 0x17804a, roughness: 0.45, metalness: 0.1 });
    const yellow = new THREE.MeshStandardMaterial({ color: 0xf6c21c, roughness: 0.6 });
    const black = lam(0x1a1a1c), grey = lam(0x8a8d92);
    const add = (geo, mat, x, y, z, parent = this.body) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);

    add(B(1.4, 0.72, 1.95), green, 0, 0.76, 0.25);                      // tub
    add(B(0.96, 0.58, 0.8), green, 0, 0.7, -1.05);                      // nose
    add(B(1.0, 0.1, 0.5), yellow, 0, 1.02, -1.05).rotation.x = 0.25;    // dashboard cowl
    add(B(0.34, 0.1, 0.72), black, 0, 0.66, -1.42);                     // mudguard
    add(B(1.48, 0.1, 2.3), yellow, 0, 1.9, 0.15);                       // roof
    add(B(1.48, 0.1, 0.62), yellow, 0, 1.78, -1.2).rotation.x = -0.42;  // roof front slope
    add(B(1.42, 0.95, 0.08), yellow, 0, 1.4, 1.25);                     // back panel
    add(B(0.7, 0.36, 0.1), black, 0, 1.5, 1.27);                        // rear window
    add(B(0.06, 0.6, 1.05), yellow, 0.72, 1.58, 0.72);                  // side curtains
    add(B(0.06, 0.6, 1.05), yellow, -0.72, 1.58, 0.72);
    for (const x of [-0.68, 0.68]) add(B(0.06, 0.95, 0.06), black, x, 1.45, -0.78).rotation.x = -0.22;
    add(B(1.2, 0.1, 0.5), lam(0x7a2020), 0, 1.05, 0.75);                // passenger bench
    add(B(1.2, 0.5, 0.1), lam(0x7a2020), 0, 1.3, 1.05);
    add(B(0.5, 0.12, 0.06), lam(0xf2c230), 0, 0.62, 1.24);              // number plate
    add(B(0.8, 0.05, 0.05), grey, 0, 1.12, -0.82);                      // handlebar

    const glass = new THREE.MeshStandardMaterial({ color: 0x9fd0e8, transparent: true, opacity: 0.3, roughness: 0.1 });
    const ws = add(B(1.3, 0.78, 0.04), glass, 0, 1.42, -0.86);
    ws.rotation.x = -0.22; ws.castShadow = false;

    // driver
    add(B(0.46, 0.56, 0.3), lam(0xf0ede6), 0, 1.18, -0.36);
    add(new THREE.SphereGeometry(0.17, 10, 8), lam(0xb87a4e), 0, 1.62, -0.38);
    add(B(0.36, 0.1, 0.36), lam(0x1a1a1c), 0, 1.74, -0.36);

    // marigold garland along the roof edge
    const mari = lam(0xff8a1c);
    for (let i = 0; i < 9; i++) {
      const u = i / 8 - 0.5;
      add(new THREE.SphereGeometry(0.07, 6, 5), mari, u * 1.3, 1.62 - Math.cos(u * Math.PI) * 0.12, -1.46).castShadow = false;
    }

    // lights
    this.headMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe2a0, emissiveIntensity: 0.4 });
    const hl = add(new THREE.CylinderGeometry(0.15, 0.17, 0.12, 12), this.headMat, 0, 0.98, -1.47);
    hl.rotation.x = Math.PI / 2;
    this.tailMat = new THREE.MeshStandardMaterial({ color: 0x8a1010, emissive: 0xff2010, emissiveIntensity: 0.3 });
    add(B(0.16, 0.12, 0.05), this.tailMat, 0.52, 0.82, 1.24);
    add(B(0.16, 0.12, 0.05), this.tailMat, -0.52, 0.82, 1.24);

    // wheels
    const wg = new THREE.CylinderGeometry(0.3, 0.3, 0.16, 14).rotateZ(Math.PI / 2);
    const hub = new THREE.CylinderGeometry(0.13, 0.13, 0.18, 8).rotateZ(Math.PI / 2);
    this.wheels = [];
    for (const [x, z] of [[0, -1.36], [-0.64, 0.86], [0.64, 0.86]]) {
      const w = new THREE.Group();
      w.position.set(x, 0.3, z);
      add(wg, black, 0, 0, 0, w);
      add(hub, grey, 0, 0, 0, w);
      add(B(0.19, 0.5, 0.05), grey, 0, 0, 0, w).castShadow = false;
      g.add(w);
      this.wheels.push(w);
    }

    // Headlight: a real spot light with its own shadow map, plus a fake volumetric beam.
    this.spot = new THREE.SpotLight(0xffe6b0, 0, 120, 0.5, 0.65, 1.25);
    this.spot.position.set(0, 1.25, -1.3);
    this.spot.target.position.set(0, -1.2, -30);
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(1024, 1024);
    this.spot.shadow.camera.near = 1; this.spot.shadow.camera.far = 90;
    this.spot.shadow.bias = -0.002;
    g.add(this.spot, this.spot.target);

    this.beamU = { uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0xffe2a8) } };
    const cone = new THREE.ConeGeometry(4.2, 20, 24, 1, true);
    cone.translate(0, -10, 0); cone.rotateX(Math.PI / 2 - 0.06);       // apex at the lamp, opening forward
    this.beam = new THREE.Mesh(cone, new THREE.ShaderMaterial({
      uniforms: this.beamU, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
    }));
    this.beam.position.set(0, 0.98, -1.5);
    this.beam.renderOrder = 4;
    g.add(this.beam);

    scene.add(g);
    this.spin = 0;
  }

  // lean: steering in [-1, 1]; bump: 0..1 jolt; flash: blink while invulnerable
  present(dt, speed, lean, bump, night, braking, time, flash) {
    this.spin -= speed * dt / 0.3;
    for (const w of this.wheels) w.rotation.x = this.spin;
    this.wheels[0].rotation.y = -lean * 0.4;
    this.body.rotation.z = -lean * 0.09;
    this.body.rotation.x = -bump * 0.07 + Math.sin(time * 31) * 0.003 * Math.min(1, speed / 10);
    this.body.position.y = bump * 0.16 + Math.sin(time * 23) * 0.008 * Math.min(1, speed / 10);
    this.body.visible = !flash || Math.floor(time * 14) % 2 === 0;

    this.spot.intensity = night * 520;
    this.beamU.uOpacity.value = night * 0.3;
    this.headMat.emissiveIntensity = lerp(0.5, 5, night);
    this.tailMat.emissiveIntensity = (braking ? 4 : 0.5) + night * 1.5;
  }
}
