export const publicFrameInputsSource = `
class Value {
  readonly recurse = (count: number): number => count === 0 ? 1 : this.recurse(count - 1);
}

export function reader() {
  const value = new Value();
  return (input: typeof value): number => input.recurse(1);
}

export function retainedRoot(): (count: number) => number {
  return new Value().recurse;
}

export function run(): boolean {
  const read = reader();
  const first = new Value();
  const second = new Value();
  const root = first.recurse;
  return read(first) === 1 && read(second) === 1 && root(12) === 1 &&
    root === first.recurse && root !== second.recurse;
}

export function main(): void {
  if (!run()) throw new Error("public callback input lost native identity or ownership");
}
`;
