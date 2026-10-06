export const callableInputBorrowSource = `
function apply(input: string, transform: (value: string) => string): string {
  return transform(input);
}
function normalize(value: string): string { return value.toLowerCase(); }
function applyPair(left: string, right: string, transform: (left: string, right: string) => string): string {
  return transform(left, right);
}
function normalizePair(left: string, right: string): string { return left.toLowerCase() + right.toLowerCase(); }
function measureInput(input: string, inspect: (value: string) => number): number {
  return inspect(input);
}
export function measuredInline(input: string): number {
  return measureInput(input, value => value.length);
}
export function run(): boolean {
  const alias = normalize;
  const prefix = "prefix:";
  return apply("FIRST", normalize) === "first" && apply("SECOND", alias) === "second" &&
    apply("THIRD", value => value.toLowerCase()) === "third" &&
    apply("FOURTH", value => prefix + value.toLowerCase()) === "prefix:fourth" &&
    applyPair("LEFT", "RIGHT", normalizePair) === "leftright" && measuredInline("native") === 6;
}
export function main(): void {
  if (!run()) throw new Error("exact invocation-only callback ABI was lost");
}
`;
