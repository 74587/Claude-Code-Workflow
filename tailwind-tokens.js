const tokens = require("./design-tokens.json");

function toFontArray(fontList) {
  return String(fontList)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildTailwindTheme(variantId = "variant-1") {
  const v = tokens.variants[variantId];
  if (!v) throw new Error(`Unknown variant: ${variantId}`);
  const colors = { ...v.colors };
  const spacing = { ...v.spacing };
  const borderRadius = { ...v.radii };
  const fontFamily = {
    heading: toFontArray(v.typography.fonts.heading),
    sans: toFontArray(v.typography.fonts.body),
    mono: toFontArray(v.typography.fonts.mono)
  };
  const boxShadow = {
    soft: v.effects.shadow_soft,
    raised: v.effects.shadow_raised
  };
  return {
    theme: {
      extend: { colors, spacing, borderRadius, fontFamily, boxShadow }
    }
  };
}

module.exports = { buildTailwindTheme, tokens };

