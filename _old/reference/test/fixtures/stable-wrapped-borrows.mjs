export const stableWrappedBorrowSource = `
function radix(): number { return 10; }
export function parenthesized(value: string): number { return parseInt(((value)), radix()); }
export function typed(value: string): number {
  const first = parseInt((value as string), radix());
  const second = parseInt((value satisfies string), radix());
  return first + second + parseInt(value!, radix());
}
export function literal(): number { return parseInt((("17" as string)), radix()); }
`;

export const producedWrappedBorrowSource = `
export function produced(value: string): number { return parseInt(value + "0", radix()); }
`;

export const guardedWrappedBorrowSource = `
export function mutated(value: string): number {
  value = "19";
  return parseInt((value), radix());
}
export function retained(value: string): () => number {
  return () => parseInt((value), radix());
}
export function ordered(value: string): number {
  const replace = (): number => { value = "29"; return 10; };
  const first = parseInt(((value as string)), replace());
  return first * 100 + parseInt(value, 10);
}
${producedWrappedBorrowSource}
function consume(value: unknown): number { return 1; }
export function changed(value: string): number { return consume(value as unknown); }
`;

export const stableWrappedBorrowObservationsSource = stableWrappedBorrowSource + guardedWrappedBorrowSource + `
export function run(): boolean {
  const callback = retained("23");
  return parenthesized("17") === 17 && typed("17") === 51 && literal() === 17 &&
    mutated("17") === 19 && ordered("17") === 1729 && produced("17") === 170 &&
    callback() === 23 && callback() === 23 && changed("owned") === 1;
}
`;
