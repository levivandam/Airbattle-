// Mouse + touch input -> mallet targets in table coordinates.
import { PlayerId } from '../core/state';
import { View } from '../render/view';

export type PointerMode = 'single' | 'split';
const TOUCH_LIFT = 0.07; // show the mallet a bit ahead of the finger

export class PointerInput {
  mode: PointerMode = 'single';
  local: PlayerId = 0;
  enabled = true;
  /** latest target per player, or null if that player has no pointer yet */
  targets: [{ x: number; y: number } | null, { x: number; y: number } | null] = [null, null];
  /** which input steered last in single-player modes (see SoloKeys) */
  source: 'pointer' | 'keys' = 'pointer';
  private owner = new Map<number, PlayerId>();
  /** true once a touch was seen (used to pick touch-friendly layouts) */
  static touchSeen = false;

  constructor(private view: View) {
    const opts = { passive: false } as const;
    window.addEventListener('pointerdown', (e) => this.down(e), opts);
    // pointerrawupdate (Chrome/Edge) delivers mouse positions as soon as they arrive instead of once per frame
    const raw = 'onpointerrawupdate' in window;
    window.addEventListener(raw ? ('pointerrawupdate' as 'pointermove') : 'pointermove', (e) => this.move(e), opts);
    if (raw) window.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') this.move(e); }, opts);
    window.addEventListener('pointerup', (e) => this.owner.delete(e.pointerId));
    window.addEventListener('pointercancel', (e) => this.owner.delete(e.pointerId));
    // stop the page from scrolling / zooming while playing
    document.addEventListener('touchmove', (e) => { if (this.onCanvas(e.target)) e.preventDefault(); }, opts);
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => { if (this.onCanvas(e.target)) e.preventDefault(); });
  }

  reset(): void {
    this.targets = [null, null];
    this.source = 'pointer';
    this.owner.clear();
  }

  private onCanvas(t: EventTarget | null): boolean {
    return t === this.view.canvas;
  }

  private down(e: PointerEvent): void {
    if (e.pointerType === 'touch') PointerInput.touchSeen = true;
    if (!this.enabled || !this.onCanvas(e.target)) return;
    const hit = this.view.pick(e.clientX, e.clientY);
    if (!hit) return;
    const who: PlayerId = this.mode === 'split' ? (e.pointerType === 'mouse' ? 0 : hit.y < 0 ? 0 : 1) : this.local;
    this.owner.set(e.pointerId, who);
    this.apply(e, who, hit);
  }

  private move(e: PointerEvent): void {
    if (!this.enabled) return;
    if (e.type === 'pointerrawupdate' && e.pointerType !== 'mouse') return; // touch/pen use pointermove
    let who = this.owner.get(e.pointerId);
    if (who === undefined) {
      if (e.pointerType !== 'mouse') return;
      who = this.mode === 'split' ? 0 : this.local; // mouse steers without pressing
    }
    const hit = this.view.pick(e.clientX, e.clientY);
    if (hit) this.apply(e, who, hit);
  }

  private apply(e: PointerEvent, who: PlayerId, hit: { x: number; y: number }): void {
    const lift = e.pointerType === 'touch' ? TOUCH_LIFT * (who === 0 ? 1 : -1) : 0;
    this.targets[who] = { x: hit.x, y: hit.y + lift };
    this.source = 'pointer';
  }
}
