export const structuralMemberWritesSource = `
class Value {
  callback = (): number => 1;
}

export function run(): boolean {
  const value = new Value();
  const before = value.callback;
  const view: { callback: () => number } = value;
  view.callback = (): number => 2;
  if (value.callback() !== 2 || before() !== 1 || before === view.callback) return false;
  const alias: { callback: () => number } = view;
  alias["callback"] = (): number => 3;
  return value.callback() === 3 && view.callback() === 3 && before() === 1 && alias === view;
}

export function main(): void {
  if (!run()) throw new Error("structural member write lost native identity");
}
`;
