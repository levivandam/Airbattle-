// The arcade air hockey table: surface, wooden rails, goals, floor.
import * as THREE from 'three';
import { T } from '../core/state';
import { carpetTexture, surfaceTexture, woodTexture } from './textures';

export const RAIL_W = 0.075;
export const RAIL_H = 0.05;

export interface TableParts {
  group: THREE.Group;
  /** Slide the end-rail pieces so the goal mouth has the given half-width. side 0 = bottom (z > 0). */
  setGoalHalf(side: 0 | 1, half: number): void;
  goalLights: [THREE.Mesh, THREE.Mesh];
  floor: THREE.Mesh;
}

export function buildTable(aniso: number): TableParts {
  const group = new THREE.Group();

  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(T.HW * 2, T.HL * 2),
    new THREE.MeshStandardMaterial({ map: surfaceTexture(aniso), roughness: 0.32, metalness: 0.0 }),
  );
  surface.rotation.x = -Math.PI / 2;
  surface.receiveShadow = true;
  group.add(surface);

  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(aniso), roughness: 0.55 });
  const liner = new THREE.MeshStandardMaterial({ color: 0xe9e4d6, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15131a, roughness: 0.9 });

  const rail = (w: number, d: number, x: number, z: number, alongZ: boolean) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, RAIL_H, d), wood);
    body.position.y = RAIL_H / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    // light plastic liner on the inner face
    const lw = alongZ ? 0.008 : w;
    const ld = alongZ ? d : 0.008;
    const l = new THREE.Mesh(new THREE.BoxGeometry(lw, RAIL_H * 0.6, ld), liner);
    l.position.set(alongZ ? -Math.sign(x) * (w / 2) : 0, RAIL_H * 0.3, alongZ ? 0 : -Math.sign(z) * (d / 2));
    g.add(l);
    g.position.set(x, 0, z);
    group.add(g);
    return g;
  };

  // side rails (full length incl. corners)
  const sideLen = T.HL * 2 + RAIL_W * 2;
  rail(RAIL_W, sideLen, T.HW + RAIL_W / 2, 0, true);
  rail(RAIL_W, sideLen, -(T.HW + RAIL_W / 2), 0, true);

  // end rails: two sliding pieces per end, leaving the goal mouth open
  const ends: THREE.Group[][] = [[], []];
  for (const side of [0, 1] as const) {
    const z = (side === 0 ? 1 : -1) * (T.HL + RAIL_W / 2);
    for (const sx of [-1, 1]) {
      const piece = rail(1, RAIL_W, 0, z, false);
      piece.userData.sx = sx;
      ends[side].push(piece);
    }
    // goal pocket (dark slot) and a light strip that flashes on goals
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(T.GOAL_HALF * 2 + 0.02, 0.012, RAIL_W + 0.03), dark);
    pocket.position.set(0, -0.004, (side === 0 ? 1 : -1) * (T.HL + RAIL_W / 2 + 0.012));
    group.add(pocket);
  }
  const setGoalHalf = (side: 0 | 1, half: number) => {
    for (const piece of ends[side]) {
      const sx = piece.userData.sx as number;
      const len = T.HW - half;
      piece.scale.x = len;
      piece.position.x = sx * (half + len / 2);
    }
  };
  setGoalHalf(0, T.GOAL_HALF);
  setGoalHalf(1, T.GOAL_HALF);

  const goalLights = [0, 1].map((side) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(T.GOAL_HALF * 2, 0.012, 0.02),
      new THREE.MeshBasicMaterial({ color: side === 0 ? 0xff5a4a : 0x4a8cff, transparent: true, opacity: 0.25 }),
    );
    m.position.set(0, 0.004, (side === 0 ? 1 : -1) * (T.HL + 0.012));
    group.add(m);
    return m;
  }) as unknown as [THREE.Mesh, THREE.Mesh];

  // table body below the surface
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(T.HW * 2 + RAIL_W * 2 + 0.04, 0.3, T.HL * 2 + RAIL_W * 2 + 0.04),
    new THREE.MeshStandardMaterial({ color: 0x241c22, roughness: 0.7 }),
  );
  body.position.y = -0.152;
  body.castShadow = true;
  group.add(body);

  // floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.MeshStandardMaterial({ map: carpetTexture(), roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.85;
  floor.receiveShadow = true;
  return { group, setGoalHalf, goalLights, floor };
}
