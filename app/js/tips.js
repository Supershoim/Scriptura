// Short hover tooltips for elements with data-tip-t (title), data-tip (body: lines or sentences become
// bullet points), data-tip-r (footer line) or data-tipcard (HTML from the provider given to setupTips).
// Mouse and keyboard focus only: on touch screens the element's own action is enough.
import { $, esc } from './util.js';

let current = null, timer = 0, x = 0, y = 0, pointer = 'mouse', card = () => '';

function html(el) {
  if (el.dataset.tipcard) return card(el.dataset.tipcard);
  const { tipT: title, tip: body, tipR: footer } = el.dataset;
  if (!body && !footer) return '';
  const items = (body || '').split(/\n|(?<=[.!?…])\s+(?=[A-ZĂÂÎȘȚ„«])/).map(s => s.trim()).filter(Boolean);
  return (title ? `<b>${esc(title)}</b>` : '') + (items.length ? `<ul>${items.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : '') +
    (footer ? `<div class="tip-foot">${esc(footer)}</div>` : '');
}

function place(px, py) {
  const tip = $('tip'), w = tip.offsetWidth, h = tip.offsetHeight;
  let left = px + 14, top = py + 18;
  if (left + w > innerWidth - 10) left = Math.max(10, px - w - 14);
  if (top + h > innerHeight - 10) top = Math.max(10, py - h - 14);
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}

export function hideTip() { clearTimeout(timer); $('tip').hidden = true; current = null; }

function show(el, px, py) {
  if (pointer === 'touch' || !el.isConnected || !el.getClientRects().length) return;
  const content = html(el);
  if (!content) return hideTip();
  $('tip').innerHTML = content;
  $('tip').hidden = false;
  place(px, py);
}

const SELECTOR = '[data-tip],[data-tipcard],[data-tip-r]';

export function setupTips(cardHtml) {
  card = cardHtml;
  document.addEventListener('mouseover', e => {
    if (e.target.closest('.ref-link, .note-popup')) return hideTip();
    const el = e.target.closest(SELECTOR);
    if (el === current) return;
    hideTip();
    if (!el) return;
    current = el;
    timer = setTimeout(() => show(el, x, y), el.dataset.tipcard ? 450 : 160);
  });
  document.addEventListener('mousemove', e => { x = e.clientX; y = e.clientY; if (!$('tip').hidden) place(x, y); }, { passive: true });
  document.addEventListener('mouseout', e => { if (current && !current.contains(e.relatedTarget)) hideTip(); });
  document.addEventListener('focusin', e => {
    const el = e.target.closest?.(SELECTOR);
    if (!el) return hideTip();
    current = el;
    const r = el.getBoundingClientRect();
    show(el, r.left, r.bottom);
  });
  document.addEventListener('pointerdown', e => { pointer = e.pointerType || 'mouse'; hideTip(); }, true);
  document.addEventListener('pointermove', e => { if (e.pointerType) pointer = e.pointerType; }, { passive: true });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideTip(); });
  addEventListener('scroll', hideTip, { passive: true });
}
