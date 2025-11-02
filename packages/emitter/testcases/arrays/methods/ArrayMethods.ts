export function processArray(arr: number[]): number {
  const doubled = arr.map((x) => x * 2);
  const filtered = doubled.filter((x) => x > 5);
  const sum = filtered.reduce((acc, x) => acc + x, 0);
  return sum;
}
