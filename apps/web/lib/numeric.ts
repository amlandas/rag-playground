export function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

export function normalizeTopKInput(raw: string): number {
  return clampNumber(Number(raw) || 1, 1, 12);
}
