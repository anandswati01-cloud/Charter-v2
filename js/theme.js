/* ── SkyVayu Theme Manager ── */

var PORCELAIN = {
  "--bg-canvas":        "#f4f6f9",
  "--bg-canvas-soft":   "#e7ebf1",
  "--bg-elevated":      "#ffffff",
  "--bg-nav":           "#ffffff",
  "--bg-input":         "#ffffff",
  "--bg-subtle":        "#eef1f5",
  "--border":           "rgba(13,27,42,0.10)",
  "--border-strong":    "rgba(13,27,42,0.18)",
  "--text-primary":     "#0d1b2a",
  "--text-secondary":   "rgba(13,27,42,0.65)",
  "--text-muted":       "rgba(13,27,42,0.48)",
  "--gold":             "#c4942e",
  "--gold-soft":        "#dcb352",
  "--gold-bg":          "rgba(196,148,46,0.10)",
  "--cyan":             "#c4942e",
  "--cyan-strong":      "#a87a20",
  "--cyan-soft":        "#dcb352",
  "--cyan-bg":          "rgba(196,148,46,0.10)",
  "--cyan-faint":       "rgba(196,148,46,0.08)",
  "--cyan-border":      "rgba(196,148,46,0.35)",
  "--green":            "#c4942e",
  "--green-bg":         "rgba(196,148,46,0.10)",
  "--shadow-sm":        "0 1px 2px rgba(13,27,42,0.04), 0 1px 1px rgba(13,27,42,0.03)",
  "--shadow-md":        "0 4px 12px rgba(13,27,42,0.06), 0 2px 4px rgba(13,27,42,0.03)",
  "--shadow-lg":        "0 12px 32px rgba(13,27,42,0.08), 0 4px 12px rgba(13,27,42,0.04)",
  // Map to existing page variables
  "--bg":               "#f4f6f9",
  "--bg-dark":          "#e7ebf1",
  "--bg-card":          "#ffffff",
  "--bg-card-solid":    "#ffffff",
  "--bg-stats":         "#eef1f5",
  "--text":             "#0d1b2a",
  "--text-dim":         "rgba(13,27,42,0.65)",
  "--text-label":       "rgba(13,27,42,0.55)",
  "--gold-dark":        "#a87a20",
  "--red":              "#c0392b",
  // index.html specific vars
  "--navy":             "#f4f6f9",
  "--navy-mid":         "#e7ebf1",
  "--navy-light":       "#dde2ea",
  "--white":            "#0d1b2a",
  "--white-60":         "rgba(13,27,42,0.60)",
  "--white-30":         "rgba(13,27,42,0.30)",
  "--white-10":         "rgba(13,27,42,0.10)",
};

// Apply theme immediately before render to avoid flash
(function() {
  var saved = localStorage.getItem('sv_theme') || 'dark';
  if (saved === 'light') {
    applyLight();
  }
  document.documentElement.setAttribute('data-theme', saved);
})();

function applyLight() {
  var root = document.documentElement;
  Object.entries(PORCELAIN).forEach(function(pair) {
    root.style.setProperty(pair[0], pair[1]);
  });
  root.setAttribute('data-theme', 'light');
}

function applyDark() {
  var root = document.documentElement;
  // Remove all inline style overrides — let the stylesheet defaults take over
  Object.keys(PORCELAIN).forEach(function(key) {
    root.style.removeProperty(key);
  });
  root.setAttribute('data-theme', 'dark');
}

function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme') || 'dark';
  var next = current === 'dark' ? 'light' : 'dark';
  if (next === 'light') {
    applyLight();
  } else {
    applyDark();
  }
  localStorage.setItem('sv_theme', next);
  updateToggleBtn(next);
}

function updateToggleBtn(theme) {
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;
  if (theme === 'light') {
    btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    btn.title = 'Switch to dark mode';
  } else {
    btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
    btn.title = 'Switch to light mode';
  }
}

document.addEventListener('DOMContentLoaded', function() {
  var theme = localStorage.getItem('sv_theme') || 'dark';
  updateToggleBtn(theme);
});
