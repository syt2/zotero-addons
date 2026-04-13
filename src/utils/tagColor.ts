/**
 * Tag color utility
 * Maps tag strings to stable colors via hash
 */

const TAG_COLORS = [
  "#2563eb", // blue
  "#0f766e", // teal
  "#059669", // emerald
  "#65a30d", // lime
  "#ca8a04", // yellow
  "#ea580c", // orange
  "#dc2626", // red
  "#e11d48", // rose
  "#db2777", // pink
  "#9333ea", // purple
  "#7c3aed", // violet
  "#4f46e5", // indigo
  "#0891b2", // cyan
  "#0284c7", // sky
  "#0369a1", // azure
  "#0d9488", // sea green
  "#15803d", // green
  "#4d7c0f", // olive
  "#b45309", // amber brown
  "#be123c", // ruby
];

/**
 * Returns a deterministic color for a given tag string.
 * The same tag always maps to the same color.
 */
export function tagColor(tag: string): string {
  let hash = 0;
  for (const char of tag) {
    hash = (hash << 5) - hash + char.charCodeAt(0);
    hash |= 0;
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}
