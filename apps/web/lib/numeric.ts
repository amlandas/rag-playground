export function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

export function normalizeTopKInput(raw: string): number {
  return clampNumber(Number(raw) || 1, 1, 12);
}

export function normalizeMaxHopsInput(raw: string): number {
  return clampNumber(Number(raw) || 1, 1, 4);
}

export function normalizeTemperatureInput(raw: string): number {
  const parsed = Number(raw);
  const value = Number.isNaN(parsed) ? 0 : parsed;
  return clampNumber(value, 0, 1);
}
