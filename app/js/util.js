export const $ = id => document.getElementById(id);

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Case- and diacritic-insensitive form. Keeps string length equal to the input for highlight offsets.
export const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ş/g, 's').replace(/ţ/g, 't');

export const store = {
  get(key, fallback) { try { const v = localStorage.getItem('scriptura:' + key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem('scriptura:' + key, JSON.stringify(value)); } catch {} }
};

export function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 3000);
}

export async function copyText(text) {
  let copied = false;
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); copied = true; } catch {}
  }
  if (!copied) {
    // Fallback for file:// pages and browsers that refuse the clipboard API.
    const previous = document.activeElement, area = document.createElement('textarea');
    area.value = text;
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.append(area);
    try { area.focus(); area.select(); area.setSelectionRange(0, text.length); copied = document.execCommand('copy'); } catch {}
    finally { area.remove(); previous?.focus({ preventScroll: true }); }
  }
  toast(copied ? 'Text copiat în clipboard.' : 'Copierea nu este disponibilă. Poți selecta textul manual.');
  return copied;
}
