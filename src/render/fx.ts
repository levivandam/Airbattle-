// Event-driven effects: particles, puck trail, screen shake, goal flash, slow-motion finish.
import * as THREE from 'three';
import { DEFS } from '../core/powerups';
import { GameEvent, GameState, T } from '../core/state';
import { Game } from '../game';
import { settings } from '../storage/settings';
import { View } from './view';

const MAX = 420;

export class Fx {
  private pos = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 3);
  private aux = new Float32Array(MAX * 2); // alpha, size
  private vel = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private ttl = new Float32Array(MAX);
  private grav = new Float32Array(MAX);
  private cursor = 0;
  private points: THREE.Points;
  private shakeAmp = 0;
  private flash: [number, number] = [0, 0];
  private lampBoost = 0;
  private slow = 0;
  private tmp = new THREE.Color();
  private mineColor = 0xd3352b;
  private theirColor = 0x2a5bc7;
  private aim: THREE.Line;
  private aimLife = 0;
  private dashRing: THREE.Mesh;

  constructor(
    private view: View,
    private game: Game,
  ) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aux', new THREE.BufferAttribute(this.aux, 2));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { scale: { value: 1 } },
      vertexShader: `
        attribute vec2 aux; attribute vec3 color; varying vec3 vC; varying float vA; uniform float scale;
        void main() { vC = color; vA = aux.x;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aux.y * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        varying vec3 vC; varying float vA;
        void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
          gl_FragColor = vec4(vC, vA * smoothstep(0.5, 0.25, d)); }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    view.scene.add(this.points);
    // aim line: shows where a hard shot is heading (incl. one wall bounce)
    const ag = new THREE.BufferGeometry();
    ag.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    this.aim = new THREE.Line(ag, new THREE.LineBasicMaterial({ color: 0x1d3f8f, transparent: true, opacity: 0, depthWrite: false }));
    this.aim.frustumCulled = false;
    view.scene.add(this.aim);
    // dash cooldown ring under the keyboard player's mallet
    this.dashRing = new THREE.Mesh(
      new THREE.RingGeometry(1.15, 1.3, 40),
      new THREE.MeshBasicMaterial({ color: 0xf2b632, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    this.dashRing.rotation.x = -Math.PI / 2;
    this.dashRing.position.y = 0.003;
    this.dashRing.visible = false;
    view.scene.add(this.dashRing);
    game.onEvent((e, s) => this.onEvent(e, s));
    view.layers.push((s, _a, dt) => this.update(s, dt));
  }

  setColors(p0: number, p1: number): void {
    this.mineColor = p0;
    this.theirColor = p1;
  }

  private spawn(x: number, h: number, z: number, vx: number, vy: number, vz: number, color: number, ttl: number, size: number, grav = 0): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX;
    this.pos.set([x, h, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.tmp.setHex(color);
    this.col.set([this.tmp.r, this.tmp.g, this.tmp.b], i * 3);
    this.life[i] = ttl;
    this.ttl[i] = ttl;
    this.aux[i * 2 + 1] = size;
    this.grav[i] = grav;
  }

  private burst(x: number, y: number, color: number, n: number, speed: number, up = 1): void {
    if (this.view.quality === 'low') n = Math.ceil(n / 2);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.spawn(x, 0.02, -y, Math.cos(a) * v, up * (0.4 + Math.random() * 1.2), Math.sin(a) * v, color, 0.5 + Math.random() * 0.6, 26 + Math.random() * 30, 3);
    }
  }

  private onEvent(e: GameEvent, s: GameState): void {
    const attract = this.game.config.kind === 'attract';
    switch (e.t) {
      case 'hit':
        if (e.speed > 2.5 && settings.aimLine && this.view.direct[e.player]) this.showAim(s, e.x, e.y);
        if (e.speed > 2.4) {
          this.burst(e.x, e.y, 0xfff2c4, 5, 0.6, 0.3);
          if (settings.shake && !attract) this.shakeAmp = Math.min(0.03, this.shakeAmp + (e.speed - 2.4) * 0.008);
        }
        break;
      case 'goal': {
        const c = e.scorer === 0 ? this.mineColor : this.theirColor;
        this.burst(e.x, e.y, c, 46, 1.5, 1.4);
        this.burst(e.x, e.y, 0xf2b632, 26, 1.1, 1.8);
        this.flash[e.scorer === 0 ? 1 : 0] = 1;
        this.lampBoost = 1;
        if (settings.shake && !attract) this.shakeAmp = 0.03;
        if (e.final && !attract) this.slow = 1.25;
        break;
      }
      case 'pickup':
        this.burst(e.x, e.y, DEFS[e.type].color, 22, 0.9, 1);
        break;
      case 'block':
        this.burst(e.x, e.y, 0x45d8ff, 18, 1, 0.6);
        break;
    }
    void s;
  }

  private showAim(s: GameState, x: number, y: number): void {
    let puck = s.pucks[0];
    for (const p of s.pucks) if (Math.hypot(p.x - x, p.y - y) < Math.hypot(puck.x - x, puck.y - y)) puck = p;
    if (!puck) return;
    const pts: number[] = [puck.x, puck.y];
    let px = puck.x;
    let py = puck.y;
    let vx = puck.vx;
    let vy = puck.vy;
    const xl = T.HW - puck.r;
    for (let seg = 0; seg < 2; seg++) {
      const tx = vx > 0 ? (xl - px) / vx : vx < 0 ? (-xl - px) / vx : Infinity;
      const ty = vy > 0 ? (T.HL - py) / vy : vy < 0 ? (-T.HL - py) / vy : Infinity;
      const t = Math.min(tx, ty, seg === 0 ? Infinity : 0.9 / Math.hypot(vx, vy));
      if (!isFinite(t)) break;
      px += vx * t;
      py += vy * t;
      pts.push(px, py);
      if (t !== tx) break;
      vx = -vx;
    }
    while (pts.length < 6) pts.push(px, py);
    const a = this.aim.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < 3; i++) a.setXYZ(i, pts[i * 2], 0.02, -pts[i * 2 + 1]);
    a.needsUpdate = true;
    this.aimLife = 0.4;
  }

  private update(s: GameState, dt: number): void {
    this.aimLife = Math.max(0, this.aimLife - dt);
    (this.aim.material as THREE.LineBasicMaterial).opacity = Math.min(0.55, this.aimLife * 2.5);
    const cd = this.game.solo.cooldown;
    const keys = this.game.input.source === 'keys' && this.game.config.kind !== 'local' && this.game.config.kind !== 'attract';
    this.dashRing.visible = keys;
    if (keys) {
      const m = this.view.mallets[this.game.local];
      this.dashRing.position.x = m.position.x;
      this.dashRing.position.z = m.position.z;
      this.dashRing.scale.setScalar(s.mallets[this.game.local].r);
      (this.dashRing.material as THREE.MeshBasicMaterial).opacity = cd > 0 ? 0.2 : 0.85;
    }
    // puck trails
    if (s.phase === 'play') {
      for (const p of s.pucks) {
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 2.2 || p.hot > 0) {
          this.spawn(p.x, 0.012, -p.y, 0, 0, 0, p.hot > 0 ? 0xff7a1a : 0x4a4652, p.hot > 0 ? 0.32 : 0.2, p.hot > 0 ? 70 : 54);
        }
      }
    }
    // particles
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = i * 3;
      this.vel[k + 1] -= this.grav[i] * dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] = Math.max(0.006, this.pos[k + 1] + this.vel[k + 1] * dt);
      this.pos[k + 2] += this.vel[k + 2] * dt;
      this.aux[i * 2] = this.life[i] > 0 ? Math.min(1, (this.life[i] / this.ttl[i]) * 1.6) * (this.grav[i] ? 1 : 0.55) : 0;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.attributes.aux.needsUpdate = true;
    (this.points.material as THREE.ShaderMaterial).uniforms.scale.value = this.view.renderer.getPixelRatio() * (window.innerHeight / 800);

    // shake
    this.shakeAmp *= Math.exp(-dt * 9);
    if (this.shakeAmp < 0.0005) this.shakeAmp = 0;
    this.view.shake.set((Math.random() - 0.5) * this.shakeAmp * 2, 0, (Math.random() - 0.5) * this.shakeAmp * 2);

    // goal light strips + lamp pulse
    for (const i of [0, 1] as const) {
      this.flash[i] = Math.max(0, this.flash[i] - dt * 0.9);
      const m = this.view.table.goalLights[i].material as THREE.MeshBasicMaterial;
      m.opacity = 0.25 + 0.75 * this.flash[i] * (0.6 + 0.4 * Math.sin(performance.now() / 40));
    }
    this.lampBoost = Math.max(0, this.lampBoost - dt * 1.6);
    this.view.lamp.intensity = 21 * (1 + this.lampBoost * 0.5 * (0.5 + 0.5 * Math.sin(performance.now() / 50)));

    // slow motion + zoom on the winning goal
    if (this.slow > 0) {
      this.slow -= dt;
      const k = Math.min(1, this.slow / 0.3);
      this.game.timeScale = 1 - 0.7 * k;
      this.view.zoom = 1 + 0.1 * k;
    } else if (this.game.timeScale !== 1 || this.view.zoom !== 1) {
      this.game.timeScale = 1;
      this.view.zoom = 1;
    }
  }
}
