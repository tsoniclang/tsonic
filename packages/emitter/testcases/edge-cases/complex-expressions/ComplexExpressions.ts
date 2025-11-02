export function complexExpression(a: number, b: number, c: number): number {
  return (a + b) * c - a / b + (c % a) * ((b - a) / (c + 1));
}

export function chainedCalls(arr: number[]): number {
  return arr
    .map((x) => x * 2)
    .filter((x) => x > 10)
    .reduce((acc, x) => acc + x, 0);
}
