export const recursiveCallbackEnvironmentSource = `
class Holder<T> {
  constructor(readonly seed: T) {}
  recurse = (count: number): number => count === 0 ? 1 : this.recurse(count - 1);
  rebind(): void { this.recurse = (count: number): number => count === 0 ? 2 : this.recurse(count - 1); }
}
export function escaped<U>(seed: U): (count: number) => number {
  const value = new Holder(seed);
  const original = value.recurse;
  value.rebind();
  return original;
}
export function run(): boolean {
  const callback = escaped(7);
  if (callback(0) !== 1 || callback(8) !== 2) throw new Error("class callback generic environment");
  return true;
}
export function main(): void { if (!run()) throw new Error("recursive callback environment"); }
`;
