export function processArray(arr: number[]): number {
  const doubled = arr.map((x: number): number => x * 2);
  const filtered = doubled.filter((x: number): boolean => x > 5);
  const sum = filtered.reduce((acc: number, x: number): number => acc + x, 0);
  return sum;
}
