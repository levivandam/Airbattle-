// Three.js view of the game state. Reads state, never changes it.
import * as THREE from 'three';
import { goalHalf } from '../core/effects';
import { GameState, T } from '../core/state';
import { buildMallet, buildPuck, setMalletColors, setPuckLook } from './pieces';
import { RAIL_W, TableParts, buildTable } from './table';

export type Quality = 'high' | 'low';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
  readonly table: TableParts;
  readonly mallets: [THREE.Group, THREE.Group];
  readonly lamp: THREE.SpotLight;
  private pucks = new Map<number, THREE.Group>();
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private tmp = new THREE.Vector3();
  private goalW: [number, number] = [T.GOAL_HALF, T.GOAL_HALF];
  private camBase = new THREE.Vector3();
  flip = false;
  tilt = 15; // degrees from straight down
  zoom = 1;
  shake = new THREE.Vector3();
  quality: Quality = 'high';
  /** extra per-frame hooks (effects, power-up visuals) */
  layers: Array<(s: GameState, alpha: number, dt: number) => void> = [];

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene.background = new THREE.Color(0x0b0910);
    this.scene.fog = new THREE.Fog(0x0b0910, 5, 11);

    this.table = buildTable(this.renderer.capabilities.getMaxAnisotropy());
    this.scene.add(this.table.group);

    this.scene.add(new THREE.HemisphereLight(0xfff1dd, 0x1a1626, 0.8));
    this.lamp = new THREE.SpotLight(0xffe2b8, 21, 9, 0.62, 0.55, 1.6);
    this.lamp.position.set(0.2, 3.2, -0.1);
    this.lamp.target.position.set(0, 0, 0);
    this.lamp.castShadow = true;
    this.lamp.shadow.mapSize.set(2048, 2048);
    this.lamp.shadow.camera.near = 1;
    this.lamp.shadow.camera.far = 6;
    this.lamp.shadow.bias = -0.0004;
    this.lamp.shadow.radius = 4;
    this.scene.add(this.lamp, this.lamp.target);

    this.mallets = [buildMallet(0xd3352b, 0xf4f0e6), buildMallet(0x2a5bc7, 0xf4f0e6)];
    this.scene.add(this.mallets[0], this.mallets[1]);

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  setQuality(q: Quality): void {
    this.quality = q;
    this.renderer.shadowMap.enabled = q === 'high';
    this.lamp.castShadow = q === 'high';
    this.scene.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (mat) mat.needsUpdate = true;
    });
    this.resize();
  }

  setColors(p: 0 | 1, color: number, accent: number): void {
    setMalletColors(this.mallets[p], color, accent);
  }

  malletColors(): [number, number] {
    const c = (g: THREE.Group) => ((g.getObjectByName('body') as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHex();
    return [c(this.mallets[0]), c(this.mallets[1])];
  }

  setCamera(flip: boolean, tilt: number): void {
    this.flip = flip;
    this.tilt = tilt;
    this.resize();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 2 : 1.25);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fitCamera();
  }

  /** Place the camera so the whole table fits the screen with some margin for the HUD. */
  private fitCamera(): void {
    const a = (this.tilt * Math.PI) / 180;
    const dir = new THREE.Vector3(0, Math.cos(a), Math.sin(a) * (this.flip ? -1 : 1));
    const up = new THREE.Vector3(0, 0, this.flip ? 1 : -1);
    const ex = T.HW + RAIL_W + 0.03;
    const ez = T.HL + RAIL_W + 0.03;
    const corners = [
      [-ex, ez],
      [ex, ez],
      [-ex, -ez],
      [ex, -ez],
    ];
    const portrait = window.innerHeight > window.innerWidth;
    const mx = 0.96;
    const my = portrait ? 0.84 : 0.82;
    let lo = 1.5;
    let hi = 14;
    for (let i = 0; i < 22; i++) {
      const d = (lo + hi) / 2;
      this.camera.position.copy(dir).multiplyScalar(d);
      this.camera.up.copy(up);
      this.camera.lookAt(0, 0, 0);
      this.camera.updateMatrixWorld();
      let fits = true;
      for (const [x, z] of corners) {
        this.tmp.set(x, 0.05, z).project(this.camera);
        if (Math.abs(this.tmp.x) > mx || Math.abs(this.tmp.y) > my) fits = false;
      }
      if (fits) hi = d;
      else lo = d;
    }
    this.camera.position.copy(dir).multiplyScalar(hi);
    this.camera.lookAt(0, 0, 0);
    this.camBase.copy(this.camera.position);
  }

  /** Screen position -> table coordinates. */
  pick(clientX: number, clientY: number): { x: number; y: number } | null {
    const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    // ignore camera shake / zoom when picking
    const p = this.camera.position.clone();
    this.camera.position.copy(this.camBase);
    this.camera.updateMatrixWorld();
    this.ray.setFromCamera(ndc, this.camera);
    this.camera.position.copy(p);
    const hit = this.ray.ray.intersectPlane(this.plane, this.tmp);
    return hit ? { x: hit.x, y: -hit.z } : null;
  }

  /** Table coordinates -> screen pixels (for HTML overlays). */
  project(x: number, y: number, height = 0): { x: number; y: number } {
    this.tmp.set(x, height, -y).project(this.camera);
    return { x: (this.tmp.x * 0.5 + 0.5) * window.innerWidth, y: (-this.tmp.y * 0.5 + 0.5) * window.innerHeight };
  }

  sync(s: GameState, alpha: number, dt: number): void {
    for (const i of [0, 1] as const) {
      const m = s.mallets[i];
      const g = this.mallets[i];
      g.position.set(lerp(m.px, m.x, alpha), 0, -lerp(m.py, m.y, alpha));
      g.scale.setScalar(m.r / T.MALLET_R);
      const target = goalHalf(s, i);
      this.goalW[i] = lerp(this.goalW[i], target, Math.min(1, dt * 8));
      this.table.setGoalHalf(i, this.goalW[i]);
    }
    const seen = new Set<number>();
    for (const p of s.pucks) {
      seen.add(p.id);
      let g = this.pucks.get(p.id);
      if (!g) {
        g = buildPuck();
        this.pucks.set(p.id, g);
        this.scene.add(g);
      }
      g.position.set(lerp(p.px, p.x, alpha), p.scored ? -0.012 : 0, -lerp(p.py, p.y, alpha));
      g.userData.puck = p;
    }
    for (const [id, g] of this.pucks) {
      if (!seen.has(id)) {
        this.scene.remove(g);
        this.pucks.delete(id);
      }
    }
    for (const layer of this.layers) layer(s, alpha, dt);
  }

  puckMeshes(): Iterable<THREE.Group> {
    return this.pucks.values();
  }

  setPuckOpacity(opacity: number, s: GameState): void {
    for (const g of this.pucks.values()) {
      const p = g.userData.puck as GameState['pucks'][number];
      setPuckLook(g, opacity, p.hot > 0);
    }
    void s;
  }

  render(): void {
    this.camera.position.copy(this.camBase).multiplyScalar(1 / this.zoom).add(this.shake);
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }
}
