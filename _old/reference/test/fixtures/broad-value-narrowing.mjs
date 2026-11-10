export const broadValueNarrowingSource = `
class Item {
  count: number;
  constructor(count: number) { this.count = count; }
}
function same(value: unknown, expected: unknown): boolean {
  if (value === null || value === undefined) return false;
  return value === expected && expected === value;
}
function different(value: unknown, expected: unknown): boolean {
  if (value === null || value === undefined) return false;
  return value !== expected && expected !== value;
}
export function run(): boolean {
  const item = new Item(7);
  const other = new Item(7);
  const empty = {};
  return same(item, item) && different(item, other) &&
    same(empty, empty) && different(empty, {}) &&
    same(17, 17) && different(17, 19) && same("kept", "kept") &&
    !same(null, null) && !same(undefined, undefined);
}
`;
