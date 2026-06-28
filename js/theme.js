/* ============================================================
   theme.js — Personalització d'aparença (colors, fons, tipografia, mida)
   Aplica variables CSS a :root segons config.appearance.
   ============================================================ */

export const PRIMARY_SWATCHES = [
  "#0E5249", "#1C6B5E", "#157A6E", "#2F6F8F", "#1F5FA8", "#3A5A9C",
  "#5E4B8B", "#7A5E97", "#9C3D5C", "#B0314B", "#B25A2E", "#C2603D",
  "#A8821A", "#3E7C4F", "#3E5641", "#2B2F36", "#334155", "#0B7285",
];
export const ACCENT_SWATCHES = [
  "#C2603D", "#E0712E", "#B9821A", "#D4A017", "#3E7C4F", "#2F8F6B",
  "#2F6F8F", "#1F8FB0", "#9C3D5C", "#C2407A", "#7A5E97", "#9B6BD6",
  "#B0314B", "#5B6470",
];

/* Temes de fons (bundle complet de variables neutres). */
export const BG_THEMES = {
  llenc: { vars: { "--linen": "#F4EFE6", "--linen-2": "#ECE5D8", "--surface": "#FBF8F2", "--surface-2": "#FFFFFF", "--ink": "#1C2725", "--ink-soft": "#4F5C58", "--ink-faint": "#8A938E", "--line": "#E2DACB", "--line-soft": "#EDE7DB" } },
  blanc: { vars: { "--linen": "#F3F5F7", "--linen-2": "#E8ECF0", "--surface": "#FFFFFF", "--surface-2": "#FFFFFF", "--ink": "#1A2230", "--ink-soft": "#48536A", "--ink-faint": "#94A0B0", "--line": "#E1E6EC", "--line-soft": "#EEF1F5" } },
  gris: { vars: { "--linen": "#EBEDF0", "--linen-2": "#DFE3E8", "--surface": "#F7F8FA", "--surface-2": "#FFFFFF", "--ink": "#20262E", "--ink-soft": "#4C5663", "--ink-faint": "#8A94A0", "--line": "#DBE0E6", "--line-soft": "#E7EBEF" } },
  sorra: { vars: { "--linen": "#F0E9DD", "--linen-2": "#E6DCC9", "--surface": "#FAF5EC", "--surface-2": "#FFFDF8", "--ink": "#2A2418", "--ink-soft": "#5C5340", "--ink-faint": "#9A8F76", "--line": "#E0D4BC", "--line-soft": "#ECE3D0" } },
  fosc: { vars: { "--linen": "#14181B", "--linen-2": "#1B2024", "--surface": "#1C2327", "--surface-2": "#232B30", "--ink": "#ECEFEF", "--ink-soft": "#B6BFBF", "--ink-faint": "#7E8A8A", "--line": "#2F373C", "--line-soft": "#262E32" }, dark: true },
};

/* Parelles tipogràfiques. */
export const FONT_PAIRS = {
  editorial: { display: '"Fraunces","Iowan Old Style",Georgia,serif', body: '"Manrope",-apple-system,sans-serif' },
  modern: { display: '"Bricolage Grotesque","Manrope",sans-serif', body: '"Manrope",-apple-system,sans-serif' },
  classic: { display: '"Playfair Display",Georgia,serif', body: '"Manrope",-apple-system,sans-serif' },
  sans: { display: '"Manrope",-apple-system,sans-serif', body: '"Manrope",-apple-system,sans-serif' },
  sistema: { display: '"Iowan Old Style",Georgia,"Times New Roman",serif', body: 'system-ui,-apple-system,"Segoe UI",sans-serif' },
};

/* Mida general de la interfície (zoom). */
export const SCALES = { compacte: 0.9, normal: 1, gran: 1.1, xgran: 1.22 };

export const DEFAULT_APPEARANCE = { bg: "llenc", primary: "#0E5249", accent: "#C2603D", font: "editorial", scale: "normal" };

/** Aplica l'aparença a :root. */
export function applyAppearance(a = {}) {
  const ap = { ...DEFAULT_APPEARANCE, ...(a || {}) };
  const root = document.documentElement;

  let darkBg = false;
  if (ap.bg === "custom" && ap.bgColor) {
    // fons tintat a partir d'un color triat lliurement (combina amb primary/accent)
    const c = ap.bgColor;
    const vars = {
      "--linen": `color-mix(in srgb, ${c} 10%, #ffffff)`,
      "--linen-2": `color-mix(in srgb, ${c} 17%, #ffffff)`,
      "--surface": `color-mix(in srgb, ${c} 5%, #ffffff)`,
      "--surface-2": "#ffffff",
      "--ink": "#1C2228", "--ink-soft": "#4C5663", "--ink-faint": "#8A94A0",
      "--line": `color-mix(in srgb, ${c} 24%, #ffffff)`,
      "--line-soft": `color-mix(in srgb, ${c} 13%, #ffffff)`,
    };
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  } else {
    const bg = BG_THEMES[ap.bg] || BG_THEMES.llenc;
    for (const [k, v] of Object.entries(bg.vars)) root.style.setProperty(k, v);
    darkBg = !!bg.dark;
  }
  root.classList.toggle("theme-dark", darkBg);

  const p = ap.primary || "#0E5249";
  root.style.setProperty("--teal", p);
  root.style.setProperty("--teal-dk", `color-mix(in srgb, ${p} 78%, #000)`);
  root.style.setProperty("--teal-soft", `color-mix(in srgb, ${p} 18%, var(--surface-2))`);
  root.style.setProperty("--teal-tint", `color-mix(in srgb, ${p} 9%, var(--surface-2))`);

  const ac = ap.accent || "#C2603D";
  root.style.setProperty("--terra", ac);
  root.style.setProperty("--terra-soft", `color-mix(in srgb, ${ac} 24%, var(--surface-2))`);

  const fonts = FONT_PAIRS[ap.font] || FONT_PAIRS.editorial;
  root.style.setProperty("--font-display", fonts.display);
  root.style.setProperty("--font-body", fonts.body);

  root.style.zoom = String(SCALES[ap.scale] ?? 1);

  // color de la barra del navegador
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", darkBg ? BG_THEMES.fosc.vars["--linen"] : p);
}
