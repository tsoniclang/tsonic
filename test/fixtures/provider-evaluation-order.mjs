export const providerEvaluationOrderSource = `
import type { int32 } from "@tsonic/core/types.js";
class Cursor {
  index: int32 = 0;
  constructor(public text: string) {}
  next(): string { return this.text[this.index++]!; }
  replace(): int32 { this.text = "zz"; return 0; }
  mutated(): string { return this.text[this.replace()]!; }
  combined(step: int32): string { return this.text[this.index++ + step]!; }
  observed(): string { return this.text[this.text.length - 1]!; }
}
class Explicit {
  text: string;
  constructor(text: string) { this.text = text; }
  replace(): int32 { this.text = "zz"; return 0; }
  mutated(): string { return this.text[this.replace()]!; }
}
export function run(): boolean {
  const cursor = new Cursor("ab");
  const first = cursor.next();
  const second = cursor.next();
  const observation = cursor.observed();
  const changing = new Cursor("ab");
  const snapshot = changing.mutated();
  const explicit = new Explicit("ab");
  const explicitSnapshot = explicit.mutated();
  const composed = new Cursor("abc");
  const composedFirst = composed.combined(1);
  const composedSecond = composed.combined(1);
  return first === "a" && second === "b" && cursor.index === 2 && observation === "b" &&
    snapshot === "a" && changing.text === "zz" && explicitSnapshot === "a" && explicit.text === "zz" &&
    composedFirst === "b" && composedSecond === "c" && composed.index === 2;
}
`;
