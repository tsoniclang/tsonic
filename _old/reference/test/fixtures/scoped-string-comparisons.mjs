export const scopedStringComparisonsSource = `
class Words {
  reads = 0;
  empty = "";
  constructor(public text: string) {}
  selected(): Words { this.reads += 1; return this; }
  matches(): boolean {
    const equal = this.text === "abc";
    const reversed = "abc" === this.text;
    const nonempty = this.text !== "";
    const reversedNonempty = "" !== this.text;
    const empty = this.empty === "";
    const reversedEmpty = "" === this.empty;
    const unequal = this.empty !== "abc";
    return equal && reversed && nonempty && reversedNonempty && empty && reversedEmpty && unequal;
  }
  replace(): string { this.text = "other"; return "abc"; }
}
export function main(): void {
  const value = new Words("abc");
  const alias = value;
  alias.reads = 0;
  if (!value.matches()) throw new Error("native literal borrow comparisons");
  if (value.selected().text !== "abc" || alias.reads !== 1)
    throw new Error("one receiver evaluation");
  const snapshot = value.text === value.replace();
  if (!snapshot || alias.text !== "other") throw new Error("ordered owned comparison snapshot");
  alias.text = "abc";
  const reversed = value.replace() === value.text;
  if (reversed || alias.text !== "other") throw new Error("reversed comparison effects");
  const literal = value.text + "{quoted}\\\\\\\"\\n";
  if (literal !== "other{quoted}\\\\\\\"\\n") throw new Error("native literal concatenation");
}
`;
