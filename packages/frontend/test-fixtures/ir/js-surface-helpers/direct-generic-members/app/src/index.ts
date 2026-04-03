export function main(label: string = "default"): number {
  const counters = new Map<string, number>();
  const next = counters.get(label) ?? 0;
  counters.set(label, next);
  return next;
}
