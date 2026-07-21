/**
 * ElectricTask Mobile design tokens.
 *
 * Mirrors the ElectricTask web app's Black/Electric-Blue dark visual identity
 * (artifacts/flowdeck/src/index.css `.dark` block). The app commits to the
 * dark identity, so both the `light` and `dark` palettes use the same values
 * — the brand always reads as black-and-blue regardless of device appearance.
 */

const palette = {
  // Legacy aliases (kept for backward compatibility)
  text: "#fafafa",
  tint: "#3b82f6",

  // Core surfaces — near-black background, light foreground
  background: "#0a0a0a",
  foreground: "#fafafa",

  // Cards / elevated surfaces
  card: "#121212",
  cardForeground: "#fafafa",

  // Primary action color — ElectricTask electric blue (hsl 217 91% 60%)
  primary: "#3b82f6",
  primaryForeground: "#ffffff",

  // Secondary / less-emphasis interactive surfaces
  secondary: "#262626",
  secondaryForeground: "#fafafa",

  // Muted / subdued elements (dividers, timestamps, placeholders)
  muted: "#1a1a1a",
  mutedForeground: "#a3a3a3",

  // Accent highlights (badges, selected items, focus rings)
  accent: "#262626",
  accentForeground: "#fafafa",

  // Destructive actions (delete, error states)
  destructive: "#dc2626",
  destructiveForeground: "#ffffff",

  // Positive / completed state
  success: "#22c55e",

  // Task priority colors
  priorityHigh: "#ef4444",
  priorityMedium: "#f59e0b",
  priorityLow: "#38bdf8",

  // Borders and input outlines
  border: "#262626",
  input: "#1f1f1f",
};

const colors = {
  light: palette,
  dark: palette,

  // Border radius (px) — mirrors web --radius: 0.5rem
  radius: 12,
};

export default colors;
