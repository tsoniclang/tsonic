export function greet(name: string, greeting: string = "Hello"): string {
  return `${greeting} ${name}`;
}

export function multiply(a: number, b: number = 2): number {
  return a * b;
}
