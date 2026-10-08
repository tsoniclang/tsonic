export const capturedStringOwnershipSource = `
export function retained(value: string): () => string { return () => value; }
export function append(value: string): () => number { return () => { value += "!"; return value.length; }; }
export function duplicate(value: string): () => string { return () => { value += value; return value; }; }
export function observed(value: string): () => string {
  const change = (): string => { value = "changed"; return "!"; };
  return () => { value += change(); return value; };
}
export function main(): void {
  const read = retained("kept");
  const grow = append("");
  const twice = duplicate("x");
  const change = observed("before");
  if (read() !== "kept" || read() !== "kept" || grow() !== 1 || grow() !== 2 ||
    twice() !== "xx" || twice() !== "xxxx" || change() !== "before!" || change() !== "before!!") {
    throw new Error("captured string ownership");
  }
}
`;
