/**
 * Categorical colours for charts and per-category fills (leave types,
 * departments, series) where a CSS custom property can't be used, e.g. in
 * values computed in JS. Ordered for maximum separation between neighbours.
 * Every entry clears 3:1 against white (WCAG non-text contrast), so fills
 * stay distinguishable; always pair them with a text label as well.
 *
 * Mirrors the brand tokens in styles/tokens.css - update both together.
 */
export const CATEGORICAL_COLORS = [
  '#4169E1', // signature blue   4.9:1
  '#16876A', // success teal     4.5:1
  '#B7791F', // amber            3.6:1
  '#6558F5', // electric indigo  4.9:1
  '#C2477A', // rose             4.7:1
  '#2C8FB3', // ocean            3.7:1
];

export function categoricalColor(index) {
  return CATEGORICAL_COLORS[((index % CATEGORICAL_COLORS.length) + CATEGORICAL_COLORS.length) % CATEGORICAL_COLORS.length];
}
