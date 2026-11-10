export const nullableStructuralResultFiles = Object.freeze({
  "contracts.ts": `
export interface Entry<Value> { value: Value; quality: number; }
export class Box { constructor(public readonly value: number) {} }
export function missingNull(value: string): Entry<string> | null {
  return value === "" ? null : { value, quality: 1 };
}
export function missingUndefined(value: string): Entry<string> | undefined {
  return value === "" ? undefined : { value, quality: 2 };
}
export function missingBoth<Value>(value: Value, present: boolean): Entry<Value> | null | undefined {
  return present ? { value, quality: 3 } : null;
}
export function missingBox(value: number, present: boolean): Box | null | undefined {
  return present ? new Box(value) : undefined;
}
`,
  "index.ts": `
import { missingNull, missingUndefined, missingBoth, missingBox } from "./contracts.js";
export function run(): boolean {
  const first = missingNull("first");
  const second = missingUndefined("second");
  const third = missingBoth("third", true);
  const boxed = missingBox(7, true);
  if (first == null || second === undefined || third == null || boxed == null) return false;
  return first.value === "first" && first.quality === 1 && second.value === "second" &&
    second.quality === 2 && third.value === "third" && third.quality === 3 && boxed.value === 7 &&
    missingNull("") == null && missingUndefined("") === undefined &&
    missingBoth("absent", false) == null && missingBox(0, false) == null;
}
export function main(): void { if (!run()) throw new Error("nullable structural results"); }
`,
});
