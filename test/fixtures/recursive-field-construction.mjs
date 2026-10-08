export const recursiveFieldConstructionSource = `
function identity(value: (count: number) => number): (count: number) => number {
  if (value(0) !== 7) throw new Error("constructor invocation order");
  return value;
}
class Value {
  readonly seed = 7;
  readonly recurse = identity((count: number): number => count === 0 ? this.seed : this.recurse(count - 1));
}
export function run(): boolean {
  const first = new Value().recurse;
  const alias = first;
  const second = new Value().recurse;
  return first(3) === 7 && second(2) === 7 && first === alias && first !== second;
}
export function main(): void { if (!run()) throw new Error("recursive construction owner"); }
`;
