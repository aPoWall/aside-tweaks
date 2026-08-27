// Aside Tweaks — общая тема для всех поверхностей расширения
// (панель, палитра, попап, настройки). Родной сайдбар Aside — нативный Views-слой,
// его цвета берутся из kColorAside* внутри браузера и расширению недоступны.
// Поэтому красим то, что действительно наше — и по умолчанию красим так, как
// выглядит сам сайдбар: серое поле, белая пилюля выбора, системный шрифт.

const THEME_DEFAULT = { look: 'aside', mode: 'light', accent: '#111111', tint: 0, density: 'normal' };

const ACCENT_PRESETS = [
  { name: 'ink', value: '#111111' },
  { name: 'acid', value: '#b7ff00' },
  { name: 'ultramarine', value: '#2b4cff' },
  { name: 'amber', value: '#ff9d00' },
  { name: 'rose', value: '#ff3d6e' },
  { name: 'teal', value: '#00b3a4' },
  { name: 'violet', value: '#8b5cf6' }
];

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim());
  if (!m) return { r: 17, g: 17, b: 17 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToHex({ r, g, b }) {
  const h = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}

// подмешать акцент в базовый цвет: pct = 0..100
function mix(accentHex, baseHex, pct) {
  const a = hexToRgb(accentHex), b = hexToRgb(baseHex), k = Math.max(0, Math.min(100, pct)) / 100;
  return rgbToHex({ r: b.r + (a.r - b.r) * k, g: b.g + (a.g - b.g) * k, b: b.b + (a.b - b.b) * k });
}

// контрастный текст на плашке акцента — чтобы кислотный акцент не давал белое по белому
function readableOn(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#111111' : '#ffffff';
}

function resolveMode(mode) {
  if (mode === 'light' || mode === 'dark') return mode;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Два облика.
// aside — снято с родного сайдбара Aside (25.08.2026): поле #ececec, выбранная строка —
//         белая пилюля, подписи секций #6f6f6f, спящие вкладки лиловые, шрифт системный.
// paper — прежняя бумага apowall-инструментов: тёплый лист, моноширинный нижний регистр.
const LOOKS = {
  aside: {
    font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif',
    size: '12.5px', radius: '8px',
    light: { base: '#ececec', soft: '#f6f6f6', line: '#dddddd', fg: '#1c1c1e', muted: '#6f6f6f', dim: '#48484a', sel: '#ffffff', tile: '#ffffff', sleep: '#8f7fc9' },
    dark: { base: '#1e1e20', soft: '#27272a', line: '#333336', fg: '#ececec', muted: '#8e8e93', dim: '#b4b4b8', sel: '#303034', tile: '#2a2a2e', sleep: '#a99bd6' }
  },
  paper: {
    font: '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace',
    size: '11px', radius: '7px',
    light: { base: '#f4f1e7', soft: '#faf8f2', line: '#ddd8c9', fg: '#1b1a17', muted: '#8d887a', dim: '#6b675c', sel: '#e9e5d8', tile: '#faf8f2', sleep: '#8d887a' },
    dark: { base: '#1a1a18', soft: '#232320', line: '#33322d', fg: '#ece9e0', muted: '#84806f', dim: '#a09b8c', sel: '#2b2a26', tile: '#232320', sleep: '#84806f' }
  }
};

function resolveLook(look) { return LOOKS[look] ? look : 'aside'; }

function applyTheme(themeRaw) {
  const t = { ...THEME_DEFAULT, ...(themeRaw || {}) };
  const look = resolveLook(t.look);
  const mode = resolveMode(t.mode);
  const L = LOOKS[look];
  const p = L[mode];
  // подмес акцента в фон — свойство бумаги; облик aside держит серое поле чистым
  const tint = look === 'paper' ? (Number(t.tint) || 0) : 0;

  const root = document.documentElement;
  root.dataset.theme = mode;
  root.dataset.look = look;
  root.dataset.density = t.density === 'compact' ? 'compact' : 'normal';

  const s = root.style;
  s.setProperty('--font', L.font);
  s.setProperty('--font-size', L.size);
  s.setProperty('--radius', L.radius);
  s.setProperty('--accent', t.accent);
  s.setProperty('--accent-fg', readableOn(t.accent));
  s.setProperty('--bg', mix(t.accent, p.base, tint));
  s.setProperty('--bg-soft', mix(t.accent, p.soft, Math.min(100, tint * 1.4)));
  s.setProperty('--tile', mix(t.accent, p.tile, Math.min(100, tint * 1.4)));
  s.setProperty('--tile-fg', p.fg);
  s.setProperty('--line', mix(t.accent, p.line, Math.min(100, tint * 1.8)));
  s.setProperty('--fg', p.fg);
  s.setProperty('--muted', p.muted);
  s.setProperty('--dim', p.dim);
  s.setProperty('--sel', mix(t.accent, p.sel, Math.min(100, tint * 2)));
  s.setProperty('--sleep', p.sleep);
  // тень пилюли: на свету чуть заметная, в темноте её заменяет светлый тон
  s.setProperty('--sel-shadow', mode === 'light' ? '0 1px 2px rgba(0,0,0,.10), 0 0 0 1px rgba(0,0,0,.03)' : 'none');
}

async function initTheme() {
  const { theme } = await chrome.storage.sync.get({ theme: THEME_DEFAULT });
  applyTheme(theme);
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === 'sync' && ch.theme) applyTheme(ch.theme.newValue);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
    const { theme } = await chrome.storage.sync.get({ theme: THEME_DEFAULT });
    applyTheme(theme);
  });
}

initTheme();
