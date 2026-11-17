export const structuralMethodRestSource = `
type Contract = { removed: number; run(value: number): number; };
function copy(value: Contract): { run(value: number): number } {
  const { removed, ...rest } = value;
  return rest;
}
export function run(): boolean {
  const source = { extra: "extra", removed: 3, run(value: number): number { return value + 7; } };
  const first = copy(source);
  const second = copy(source);
  const reordered = { run(value: number): number { return value + 2; }, removed: 4, extra: 5 };
  return first.run(2) === 9 && second.run(3) === 10 && copy(reordered).run(2) === 4 && first !== second && first.run === second.run;
}
`;

export const receiverBoundMethodRestSource = `
type Contract = { removed: number; run(value: number): number; };
function copy(value: Contract): { run(value: number): number } {
  const { removed, ...rest } = value;
  return rest;
}
export function run(): boolean {
  const source = { removed: 3, run(value: number): number { return this.removed + value; } };
  return copy(source).run(2) === 5;
}
`;
