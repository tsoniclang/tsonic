export const tupleSatisfiesSource = `
class Item { count: number; constructor(count: number) { this.count = count; } }
class Failure { message: string; constructor(message: string) { this.message = message; } }
type Pair = [Item | undefined, Failure | undefined];
let order = "";
function item(present: boolean): Item | undefined {
  order += "i";
  return present ? new Item(7) : undefined;
}
function failure(present: boolean): Failure | undefined {
  order += "f";
  return present ? new Failure("failed") : undefined;
}
function read(present: boolean): number {
  const value = item(present);
  const pair = [value === undefined ? undefined : value, failure(!present)] satisfies Pair;
  const selected = pair[0];
  const error = pair[1];
  return selected === undefined ? (error === undefined ? -1 : error.message.length) : selected.count;
}
export function run(): boolean {
  if (read(true) !== 7 || read(false) !== 6 || order !== "ifif") throw new Error("tuple effects");
  const nested = [[new Item(3), undefined], [undefined, new Failure("bad")]] satisfies [Pair, Pair];
  const first = nested[0][0];
  const second = nested[1][1];
  if (first === undefined || first.count !== 3 || second === undefined || second.message !== "bad") {
    throw new Error("nested tuple");
  }
  return true;
}
`;

export const invalidTupleSatisfiesSources = [
  `const pair = ["text", 3] satisfies [number, string];`,
  `const pair = [1] satisfies [number, string];`,
  `const pair = [1, "text", true] satisfies [number, string];`,
];
