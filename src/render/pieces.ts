// Mallets and pucks.
import * as THREE from 'three';
import { T } from '../core/state';

export function buildMallet(color: number, accent: number): THREE.Group {
  const g = new THREE.Group();
  const R = T.MALLET_R;
  // classic profile: wide base with a lip, dip, then a handle knob
  const pts = [
    [0, 0],
    [R, 0],
    [R, 0.02],
    [R * 0.9, 0.028],
    [R * 0.72, 0.024],
    [R * 0.5, 0.02],
    [R * 0.34, 0.03],
    [R * 0.3, 0.06],
    [R * 0.36, 0.078],
    [R * 0.3, 0.092],
    [0, 0.096],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(
    new THREE.LatheGeometry(pts, 40),
    new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.05 }),
  );
  body.castShadow = true;
  body.name = 'body';
  g.add(body);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(R * 0.8, R * 0.06, 10, 40),
    new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.027;
  ring.name = 'ring';
  g.add(ring);
  return g;
}

export function setMalletColors(g: THREE.Group, color: number, accent: number, metal = false): void {
  const body = (g.getObjectByName('body') as THREE.Mesh).material as THREE.MeshStandardMaterial;
  body.color.setHex(color);
  body.metalness = metal ? 0.85 : 0.05;
  body.roughness = metal ? 0.3 : 0.28;
  ((g.getObjectByName('ring') as THREE.Mesh).material as THREE.MeshStandardMaterial).color.setHex(accent);
}

const puckGeo = new THREE.CylinderGeometry(T.PUCK_R, T.PUCK_R, 0.016, 36);
const puckTopGeo = new THREE.RingGeometry(T.PUCK_R * 0.55, T.PUCK_R * 0.72, 32);

export function buildPuck(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    puckGeo,
    new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.62, metalness: 0.0, transparent: true }),
  );
  body.position.y = 0.008;
  body.castShadow = true;
  body.name = 'body';
  g.add(body);
  const top = new THREE.Mesh(
    puckTopGeo,
    new THREE.MeshBasicMaterial({ color: 0x55555f, transparent: true }),
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.0165;
  top.name = 'top';
  g.add(top);
  return g;
}

export function setPuckLook(g: THREE.Group, opacity: number, hot: boolean): void {
  const body = (g.getObjectByName('body') as THREE.Mesh).material as THREE.MeshStandardMaterial;
  const top = (g.getObjectByName('top') as THREE.Mesh).material as THREE.MeshBasicMaterial;
  body.opacity = opacity;
  top.opacity = opacity;
  top.color.setHex(hot ? 0xff8a2a : 0x55555f);
  (g.getObjectByName('body') as THREE.Mesh).castShadow = opacity > 0.5;
}
