export const copiedMethodReceiversSource = `
export function run(): boolean {
  const original = { count: 3, identity<T>(value: T): T { this.count++; return value; } };
  const copied = { ...original };
  const initialOriginalCount = original.count;
  return copied.identity(7) === 7 && copied.identity("kept") === "kept" &&
    copied.count === 5 && initialOriginalCount === 3 && original.identity(true) && original.count === 4;
}
`;
