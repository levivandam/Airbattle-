// Draws campaign geometry: custom floors, walls, bumpers, moving bars, targets, gates, finish.
import * as THREE from 'three';
import { WALL_W, moverPose } from '../core/arena';
import { Arena, GameState, Mark } from '../core/state';
import { THEMES, woodTexture } from './textures';
import { View } from './view';

const H = 0.05;

export class ArenaView {
  private group = new THREE.Group();
  private id = '';
  private movers: THREE.Mesh[] = [];
  private marks: Array<{ mark: Mark; node: THREE.Object3D }> = [];
  private wood: THREE.MeshStandardMaterial;
  private time = 0;

  constructor(private view: View) {
    this.wood = new THREE.MeshStandardMaterial({ map: woodTexture(4), roughness: 0.55 });
    view.scene.add(this.group);
    view.layers.push((s, _a, dt) => this.update(s, dt));
  }

  private bar(len: number, mat: THREE.Material): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(len + WALL_W * 2, H, WALL_W * 2), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  private build(A: Arena): void {
    this.group.clear();
    this.movers = [];
    this.marks = [];
    if (A.custom) {
      const [x0, x1, y0, y1] = A.bounds;
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(x1 - x0 + 0.06, y1 - y0 + 0.06),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(THEMES[this.view.theme].bg), roughness: 0.35 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.set((x0 + x1) / 2, -0.001, -(y0 + y1) / 2);
      floor.receiveShadow = true;
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(x1 - x0 + 0.12, 0.3, y1 - y0 + 0.12),
        new THREE.MeshStandardMaterial({ color: 0x241c22, roughness: 0.7 }),
      );
      base.position.set((x0 + x1) / 2, -0.153, -(y0 + y1) / 2);
      this.group.add(floor, base);
    }
    for (const w of A.walls) {
      const dx = w.x2 - w.x1;
      const dy = w.y2 - w.y1;
      const b = this.bar(Math.hypot(dx, dy), this.wood);
      b.position.set((w.x1 + w.x2) / 2, H / 2, -(w.y1 + w.y2) / 2);
      b.rotation.y = Math.atan2(dy, dx);
      this.group.add(b);
    }
    for (const bp of A.bumpers) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(bp.r, bp.r, H, 28), new THREE.MeshStandardMaterial({ color: 0x2a5bc7, roughness: 0.3 }));
      body.position.y = H / 2;
      body.castShadow = true;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(bp.r * 0.6, bp.r * 0.6, 0.008, 24), new THREE.MeshStandardMaterial({ color: 0xf4f0e6, roughness: 0.3 }));
      cap.position.y = H + 0.004;
      g.add(body, cap);
      g.position.set(bp.x, 0, -bp.y);
      this.group.add(g);
    }
    const blue = new THREE.MeshStandardMaterial({ color: 0x2a5bc7, roughness: 0.35 });
    for (const mv of A.movers) {
      const b = this.bar(mv.len, blue);
      this.group.add(b);
      this.movers.push(b);
    }
    for (const mark of A.marks) {
      let node: THREE.Object3D;
      if (mark.kind === 'gate') {
        const dx = mark.x2 - mark.x;
        const dy = mark.y2 - mark.y;
        const len = Math.hypot(dx, dy);
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.03), new THREE.MeshBasicMaterial({ color: 0xf2b632, transparent: true, opacity: 0.8, depthWrite: false }));
        strip.rotation.x = -Math.PI / 2;
        const g = new THREE.Group();
        g.add(strip);
        for (const sx of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.07, 12), new THREE.MeshStandardMaterial({ color: 0xf2b632 }));
          post.position.set((sx * len) / 2, 0.035, 0);
          g.add(post);
        }
        g.position.set((mark.x + mark.x2) / 2, 0.004, -(mark.y + mark.y2) / 2);
        g.rotation.y = Math.atan2(dy, dx);
        node = g;
      } else {
        const g = new THREE.Group();
        const rings: Array<[number, number, number]> =
          mark.kind === 'target' ? [[1, 0xd3352b, 0], [0.68, 0xf4f0e6, 1], [0.36, 0xd3352b, 2]] : [[1, 0x2f9d5a, 0], [0.75, 0xf4f0e6, 1], [0.5, 0x2f9d5a, 2]];
        for (const [k, color, i] of rings) {
          const disc = new THREE.Mesh(new THREE.CircleGeometry(mark.r * k, 36), new THREE.MeshBasicMaterial({ color, depthWrite: false }));
          disc.rotation.x = -Math.PI / 2;
          disc.position.y = 0.003 + i * 0.0006;
          disc.renderOrder = i;
          g.add(disc);
        }
        node = g;
      }
      this.group.add(node);
      this.marks.push({ mark, node });
    }
  }

  private update(s: GameState, dt: number): void {
    const A = s.arena;
    this.time += dt;
    const id = A ? A.id : '';
    if (id !== this.id) {
      this.id = id;
      this.group.clear();
      if (A) this.build(A);
      this.view.table.group.visible = !(A && A.custom);
      this.view.mallets[1].visible = !(A && A.solo);
    }
    if (!A) return;
    A.movers.forEach((mv, i) => {
      const o = moverPose(mv, s.time);
      const b = this.movers[i];
      b.position.set(o.cx, H / 2, -o.cy);
      b.rotation.y = o.ang;
    });
    let nextGate = true;
    for (const { mark, node } of this.marks) {
      if (mark.kind === 'gate') {
        const strip = (node as THREE.Group).children[0] as THREE.Mesh;
        const mat = strip.material as THREE.MeshBasicMaterial;
        mat.color.setHex(mark.done ? 0x2f9d5a : 0xf2b632);
        mat.opacity = mark.done ? 0.25 : nextGate ? 0.6 + 0.3 * Math.sin(this.time * 6) : 0.35;
        if (!mark.done) nextGate = false;
      } else {
        node.visible = !mark.done;
        node.position.set(mark.x, 0, -mark.y);
        node.scale.setScalar(1 + 0.05 * Math.sin(this.time * 4 + mark.x * 9));
      }
    }
  }
}
