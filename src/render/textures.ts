// Procedural canvas textures (no image files needed).
import * as THREE from 'three';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function finish(c: HTMLCanvasElement, aniso: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

export interface Theme {
  bg: string;
  dots: string;
  lineA: string; // center line, circle, face-off dots
  lineB: string; // zone lines, creases
  crease: string;
  rail: number; // tint multiplied with the wood texture
  puck: number;
  puckRing: number;
}
export const THEMES: Record<string, Theme> = {
  classic: { bg: '#f4f0e6', dots: 'rgba(40,40,60,0.13)', lineA: '#d3352b', lineB: '#2a5bc7', crease: 'rgba(42,91,199,0.14)', rail: 0xffffff, puck: 0x18181c, puckRing: 0x55555f },
  neon: { bg: '#15121d', dots: 'rgba(255,255,255,0.07)', lineA: '#ff3df0', lineB: '#2de2ff', crease: 'rgba(45,226,255,0.12)', rail: 0x5a4a78, puck: 0xf4f0e6, puckRing: 0xff3df0 },
  ice: { bg: '#e4f2fb', dots: 'rgba(40,90,140,0.14)', lineA: '#2a7fd0', lineB: '#69b7e6', crease: 'rgba(105,183,230,0.2)', rail: 0xcfe6f5, puck: 0x14202c, puckRing: 0x4a6a86 },
  gold: { bg: '#1c1810', dots: 'rgba(255,220,140,0.08)', lineA: '#d9a520', lineB: '#f4d98a', crease: 'rgba(217,165,32,0.14)', rail: 0xc79a3a, puck: 0xf4f0e6, puckRing: 0xd9a520 },
};
export const THEME_LABELS: Record<string, string> = { classic: 'Classic', neon: 'Neon', ice: 'Ice rink', gold: 'Champion' };

/** Playing surface: 1 x 2 units, canvas top = far end (player 1). */
export function surfaceTexture(aniso: number, th: Theme = THEMES.classic): THREE.CanvasTexture {
  const W = 1024;
  const H = 2048;
  const [c, g] = canvas(W, H);
  const u = W; // pixels per table unit
  g.fillStyle = th.bg;
  g.fillRect(0, 0, W, H);
  // air holes
  g.fillStyle = th.dots;
  for (let y = 24; y < H; y += 40) for (let x = 24; x < W; x += 40) g.fillRect(x - 1.5, y - 1.5, 3, 3);

  const RED = th.lineA;
  const BLUE = th.lineB;
  const line = (y: number, color: string, w: number) => {
    g.fillStyle = color;
    g.fillRect(0, H / 2 - y * u - w / 2, W, w);
  };
  line(0.36, BLUE, 8);
  line(-0.36, BLUE, 8);
  line(0, RED, 12);
  // center circle
  g.lineWidth = 10;
  g.strokeStyle = RED;
  g.beginPath();
  g.arc(W / 2, H / 2, 0.19 * u, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = th.bg;
  g.beginPath();
  g.arc(W / 2, H / 2, 0.035 * u, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = RED;
  g.beginPath();
  g.arc(W / 2, H / 2, 0.022 * u, 0, Math.PI * 2);
  g.fill();
  // goal creases
  for (const end of [0, H]) {
    g.beginPath();
    g.arc(W / 2, end, 0.24 * u, 0, Math.PI * 2);
    g.fillStyle = th.crease;
    g.fill();
    g.strokeStyle = BLUE;
    g.lineWidth = 8;
    g.stroke();
  }
  // face-off dots
  for (const [x, y] of [
    [0.27, 0.62],
    [-0.27, 0.62],
    [0.27, -0.62],
    [-0.27, -0.62],
  ]) {
    g.strokeStyle = RED;
    g.lineWidth = 6;
    g.beginPath();
    g.arc(W / 2 + x * u, H / 2 - y * u, 0.045 * u, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = RED;
    g.beginPath();
    g.arc(W / 2 + x * u, H / 2 - y * u, 0.014 * u, 0, Math.PI * 2);
    g.fill();
  }
  return finish(c, aniso);
}

export function woodTexture(aniso: number): THREE.CanvasTexture {
  const [c, g] = canvas(512, 128);
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#8a4f24');
  grad.addColorStop(0.5, '#a05f2c');
  grad.addColorStop(1, '#7b441e');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 90; i++) {
    const y = Math.random() * 128;
    g.strokeStyle = `rgba(${40 + Math.random() * 40},${20 + Math.random() * 20},8,${0.08 + Math.random() * 0.2})`;
    g.lineWidth = 0.6 + Math.random() * 1.8;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 2.5 + (Math.random() - 0.5) * 1.5);
    g.stroke();
  }
  const t = finish(c, aniso);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Dim 90s arcade carpet. */
export function carpetTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#17131f';
  g.fillRect(0, 0, 512, 512);
  const cols = ['#c2372f', '#2a5bc7', '#e0a526', '#2f9d8a', '#8b3fb0'];
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    g.save();
    g.translate(x, y);
    g.rotate(Math.random() * Math.PI);
    g.globalAlpha = 0.5;
    g.strokeStyle = cols[i % cols.length];
    g.fillStyle = cols[i % cols.length];
    g.lineWidth = 3;
    const k = i % 4;
    if (k === 0) {
      g.beginPath();
      g.moveTo(-10, 8);
      g.lineTo(0, -10);
      g.lineTo(10, 8);
      g.closePath();
      g.stroke();
    } else if (k === 1) {
      g.beginPath();
      g.moveTo(-14, 0);
      g.quadraticCurveTo(-7, -10, 0, 0);
      g.quadraticCurveTo(7, 10, 14, 0);
      g.stroke();
    } else if (k === 2) {
      g.fillRect(-3, -3, 6, 6);
    } else {
      g.beginPath();
      g.arc(0, 0, 6, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }
  const t = finish(c, 4);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(7, 7);
  return t;
}

/** Soft round glow sprite. */
export function glowTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return finish(c, 1);
}
