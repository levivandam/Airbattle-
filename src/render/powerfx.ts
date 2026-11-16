// State-driven visuals for power-ups: token, shield, freeze block, auras, ice half, ghost puck.
import * as THREE from 'three';
import { has, hasAny, hasShield, isFrozen, isIcy, isReversed, goalHalf } from '../core/effects';
import { DEFS } from '../core/powerups';
import { GameState, PlayerId, PowerUpType, T, other } from '../core/state';
import { setPuckLook } from './pieces';
import { glowTexture } from './textures';
import { View } from './view';

const iconCache = new Map<string, THREE.CanvasTexture>();
export function iconTexture(icon: string): THREE.CanvasTexture {
  let t = iconCache.get(icon);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.font = '88px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(icon, 64, 70);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    iconCache.set(icon, t);
  }
  return t;
}

export class PowerFx {
  private glowTex = glowTexture();
  private token = new THREE.Group();
  private tokenIcon: THREE.Sprite;
  private tokenGlow: THREE.Sprite;
  private tokenRing: THREE.Mesh;
  private tokenType: PowerUpType | null = null;
  private shields: THREE.Mesh[] = [];
  private ice: THREE.Mesh[] = [];
  private auras: THREE.Mesh[] = [];
  private blocks: THREE.Mesh[] = [];
  private time = 0;

  constructor(private view: View) {
    const scene = view.scene;
    this.tokenIcon = new THREE.Sprite(new THREE.SpriteMaterial({ depthWrite: false }));
    this.tokenIcon.scale.setScalar(0.12);
    this.tokenIcon.position.y = 0.1;
    this.tokenGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.glowTex, depthWrite: false, opacity: 0.8 }),
    );
    this.tokenGlow.scale.setScalar(0.3);
    this.tokenGlow.position.y = 0.06;
    this.tokenRing = new THREE.Mesh(
      new THREE.RingGeometry(T.TOKEN_R * 0.82, T.TOKEN_R, 40),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.tokenRing.rotation.x = -Math.PI / 2;
    this.tokenRing.position.y = 0.003;
    this.token.add(this.tokenRing, this.tokenGlow, this.tokenIcon);
    this.token.visible = false;
    scene.add(this.token);

    for (const side of [0, 1] as PlayerId[]) {
      const sgn = side === 0 ? 1 : -1; // z direction of this player's end
      const shield = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.06, 0.014),
        new THREE.MeshBasicMaterial({ color: 0x45d8ff, transparent: true, opacity: 0.7, depthWrite: false }),
      );
      shield.position.set(0, 0.03, sgn * (T.HL - T.SHIELD_INSET));
      shield.visible = false;
      scene.add(shield);
      this.shields.push(shield);

      const ice = new THREE.Mesh(
        new THREE.PlaneGeometry(T.HW * 2, T.HL),
        new THREE.MeshBasicMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0, depthWrite: false }),
      );
      ice.rotation.x = -Math.PI / 2;
      ice.position.set(0, 0.002, sgn * (T.HL / 2));
      scene.add(ice);
      this.ice.push(ice);

      const aura = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: this.glowTex, transparent: true, opacity: 0, depthWrite: false }),
      );
      aura.rotation.x = -Math.PI / 2;
      aura.position.y = 0.004;
      scene.add(aura);
      this.auras.push(aura);

      const block = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.2 }),
      );
      block.visible = false;
      scene.add(block);
      this.blocks.push(block);
    }
    view.layers.push((s, _alpha, dt) => this.update(s, dt));
  }

  private auraColor(s: GameState, p: PlayerId): number {
    if (isFrozen(s, p)) return 0x8fd8ff;
    if (isReversed(s, p)) return 0x9a6bff;
    if (isIcy(s, p)) return 0x7fb8ff;
    if (has(s, 'shrink', other(p))) return 0xe85d9a;
    if (has(s, 'power', p)) return 0xff7a1a;
    if (has(s, 'speed', p)) return 0xffe14a;
    if (has(s, 'big', p)) return 0x3fbf5f;
    return 0;
  }

  private update(s: GameState, dt: number): void {
    this.time += dt;
    const t = this.time;
    // token
    const tk = s.token;
    this.token.visible = !!tk;
    if (tk) {
      if (this.tokenType !== tk.type) {
        this.tokenType = tk.type;
        const d = DEFS[tk.type];
        this.tokenIcon.material.map = iconTexture(d.icon);
        this.tokenIcon.material.needsUpdate = true;
        this.tokenGlow.material.color.setHex(d.color);
        (this.tokenRing.material as THREE.MeshBasicMaterial).color.setHex(d.color);
      }
      const grow = Math.min(1, tk.age * 4);
      const fade = tk.age > 11 ? 0.5 + 0.5 * Math.sin(t * 16) : 1; // blink before it disappears
      this.token.position.set(tk.x, 0, -tk.y);
      this.token.scale.setScalar(grow);
      this.tokenIcon.position.y = 0.1 + Math.sin(t * 3) * 0.012;
      this.tokenIcon.material.opacity = fade;
      this.tokenGlow.material.opacity = 0.5 + 0.2 * Math.sin(t * 5);
      this.tokenRing.rotation.z = t * 1.5;
      this.tokenRing.scale.setScalar(1 + 0.08 * Math.sin(t * 5));
    } else {
      this.tokenType = null;
    }

    for (const p of [0, 1] as PlayerId[]) {
      // shield
      const sh = this.shields[p];
      sh.visible = hasShield(s, p);
      if (sh.visible) {
        sh.scale.x = goalHalf(s, p) * 2 + 0.1;
        (sh.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.25 * Math.sin(t * 9);
      }
      // slippery half
      const iceMat = this.ice[p].material as THREE.MeshBasicMaterial;
      iceMat.opacity += ((isIcy(s, p) ? 0.3 : 0) - iceMat.opacity) * Math.min(1, dt * 6);
      this.ice[p].visible = iceMat.opacity > 0.01;
      // aura under the mallet
      const m = this.view.mallets[p];
      const aura = this.auras[p];
      const mat = aura.material as THREE.MeshBasicMaterial;
      const col = this.auraColor(s, p);
      if (col) mat.color.setHex(col);
      mat.opacity += ((col ? 0.7 + 0.2 * Math.sin(t * 8) : 0) - mat.opacity) * Math.min(1, dt * 10);
      aura.visible = mat.opacity > 0.01;
      aura.position.x = m.position.x;
      aura.position.z = m.position.z;
      aura.scale.setScalar(s.mallets[p].r * 5);
      // freeze block
      const block = this.blocks[p];
      block.visible = isFrozen(s, p);
      if (block.visible) {
        const r = s.mallets[p].r;
        block.position.set(m.position.x, 0.055, m.position.z);
        block.scale.set(r * 2.3, 0.11, r * 2.3);
        block.rotation.y = 0.4;
      }
    }
    // pucks: ghost + power-shot tint
    const ghost = hasAny(s, 'ghost');
    for (const g of this.view.puckMeshes()) {
      const p = g.userData.puck as GameState['pucks'][number];
      const op = ghost ? 0.05 + 0.05 * Math.max(0, Math.sin(t * 7 + p.id)) : 1;
      setPuckLook(g, p.scored ? 1 : op, p.hot > 0);
    }
  }
}
