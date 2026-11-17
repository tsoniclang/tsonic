export const implicitCallableInterfaceSource = `
interface Factory<T> {
  create(value: T): () => T;
  nested(value: T): (transform: (input: T) => T) => T;
}
class Maker {
  create(value: number): () => number { return () => value; }
  nested(value: number): (transform: (input: number) => number) => number {
    return transform => transform(value);
  }
}
export function run(): boolean {
  const factory: Factory<number> = new Maker();
  const first = factory.create(3);
  const second = factory.create(7);
  const nested = factory.nested(4);
  return first() === 3 && second() === 7 && first() === 3 &&
    nested(value => value + 2) === 6 && nested(value => value * 3) === 12;
}
export function main(): void {
  if (!run()) throw new Error("implicit callable interface contract");
}
`;
