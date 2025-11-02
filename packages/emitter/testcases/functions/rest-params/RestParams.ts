export function sum(...numbers: number[]): number {
  return numbers.reduce((acc, n) => acc + n, 0);
}

export function concat(separator: string, ...strings: string[]): string {
  return strings.join(separator);
}
