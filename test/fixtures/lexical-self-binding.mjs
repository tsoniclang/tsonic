export const lexicalSelfBindingSource = `
export function fixedSelf(): boolean {
  let selected = function original(count: number): number {
    return count === 0 ? 1 : original(count - 1);
  };
  const before = selected;
  selected = (): number => 99;
  return before(3) === 1 && selected(1) === 99 && before !== selected;
}
export function liveBinding(): boolean {
  let selected = (count: number): number => count === 0 ? 1 : selected(count - 1);
  const before = selected;
  selected = (): number => 99;
  return before(0) === 1 && before(3) === 99 && before !== selected;
}
export function main(): void {
  if (!fixedSelf() || !liveBinding()) throw new Error("lexical self and live binding identity");
}
`;
