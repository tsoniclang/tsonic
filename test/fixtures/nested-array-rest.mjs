export const nestedArrayRestSource = `
function collect(...values: string[][]): string[][] { return values; }
export function run(): boolean {
  const first: string[] = ["first"];
  const second: string[] = ["second"];
  const values: string[][] = [];
  values.push(first);
  values.unshift(second);
  const removed = values.splice(1, 1, first, second);
  const selected = Array.of<string[]>(first, second);
  const constructed = new Array<string[]>(first, second);
  const invoked = Array<string[]>(first, second);
  const collected = collect(first, second);
  const expanded: string[][] = [];
  expanded.push(...selected);
  expanded.unshift(...collected);
  const forwarded = collect(...selected);
  const nested: string[][][] = [];
  nested.push(values);
  first[0] = "changed";
  return values.length === 3 && values[0] === second && values[1] === first &&
    values[2] === second && removed.length === 1 && removed[0] === first &&
    selected[0] === first && selected[1] === second &&
    constructed[0] === first && constructed[1] === second &&
    invoked[0] === first && invoked[1] === second &&
    collected[0] === first && collected[1] === second &&
    expanded.length === 4 && expanded[0] === first && expanded[3] === second &&
    forwarded[0] === first && forwarded[1] === second &&
    nested[0] === values && nested[0][1][0] === "changed";
}
`;
