export function complexExpression(a: number, b: number, c: number): number {
  return (a + b) * c - a / b + (c % a) * ((b - a) / (c + 1));
}

export function chainedCalls(arr: number[]): number {
  return arr
    .map((x: number): number => x * 2)
    .filter((x: number): boolean => x > 10)
    .reduce((acc: number, x: number): number => acc + x, 0);
}
