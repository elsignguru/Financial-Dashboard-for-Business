// Fixed color palette used to distinguish chart series.
// getColor cycles through the list so the Nth series always gets the same color regardless of how many series there are.
export const CHART_COLORS = [
  '#2563EB',  // blue
  '#16A34A',  // green
  '#DC2626',  // red
  '#D97706',  // amber
  '#7C3AED',  // violet
  '#0891B2',  // cyan
]

export function getColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}
