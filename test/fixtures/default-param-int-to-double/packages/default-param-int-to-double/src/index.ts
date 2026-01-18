// TSN5110: Default parameter with int literal where number expected
// This should fail because 42 is an integer literal being used as default
// for a parameter declared as 'number' (double)

function withDefault(x: number = 42): number {
  return x * 2;
}

export function main(): void {
  withDefault();
}
