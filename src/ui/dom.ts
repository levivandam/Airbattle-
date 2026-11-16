// Tiny DOM helpers for the HTML overlay.
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = '',
  text = '',
  attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

export function button(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', 'btn ' + cls, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

export const root = () => document.getElementById('ui') as HTMLDivElement;
