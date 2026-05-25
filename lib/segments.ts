export const DEFAULT_SEGMENT_CUTOFF_PERCENT = 0.5;

export function quantileCutoff(values: number[], cutoffPercent = DEFAULT_SEGMENT_CUTOFF_PERCENT) {
  if (!values.length) return 3500;
  const sorted = [...values].sort((a, b) => a - b);
  const clampedPercent = Math.min(0.99, Math.max(0.01, cutoffPercent));
  const index = Math.min(sorted.length - 1, Math.max(1, Math.floor(sorted.length * clampedPercent)));
  return sorted[index];
}
