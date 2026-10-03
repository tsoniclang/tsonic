export const copiedMethodReceiversSource = `
function copiedCaptures(): boolean {
  let calls = 0;
  const original = {
    count: 0,
    identity<T>(value: T): T { calls++; this.count++; return value; },
    read<T>(value: T): number { return calls; },
  };
  const copied = { ...original };
  return copied.identity(true) && copied.count === 1 && original.count === 0 &&
    original.identity(7) === 7 && copied.read(false) === 2 && original.read(0) === 2;
}
export function run(): boolean {
  const original = { count: 3, identity<T>(value: T): T { this.count++; return value; } };
  const copied = { ...original };
  const initialOriginalCount = original.count;
  return copied.identity(7) === 7 && copied.identity("kept") === "kept" &&
    copied.count === 5 && initialOriginalCount === 3 && original.identity(true) && original.count === 4 && copiedCaptures();
}
`;
