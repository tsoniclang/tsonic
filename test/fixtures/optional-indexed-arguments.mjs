export const optionalIndexedArgumentsSource = `
import type { int32 } from "@tsonic/core/types.js";
let reads = 0;
function readCount(): number { return reads; }
function index(value: number): number { reads++; return value; }
function accept(value: string | undefined): string { return value === undefined ? "absent" : value; }
function optional(value?: string): string { return accept(value); }
function defaulted(value: string = "default"): string { return value; }
function required(value: string): string { return value; }
function indexed(values: string[], position: int32 | undefined): string | undefined {
  if (position === undefined) return undefined;
  return values[position];
}
function character(value: string, position: int32 | undefined): string {
  if (position === undefined) return "absent";
  return required(value[position]!);
}
function retained(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value;
}
function effectful(value: string | undefined): string | undefined {
  if (value === undefined) { reads++; return undefined; }
  return value;
}
function observed(value: string | undefined): string | undefined { reads++; return value; }
function computed(value: string | undefined): string | undefined {
  if (observed(value) === undefined) return undefined;
  return "present";
}
function fallible(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value === "bad") throw new Error("bad");
  return value;
}
function conditional(values: string[]): string | undefined {
  const selected = values.length === 1 ? values[0] : undefined;
  return selected;
}
function normalize(value: string | undefined): string | undefined {
  return value?.trim().toLowerCase();
}
function normalizeObserved(value: string | undefined): string | undefined {
  return observed(value)?.trim().concat(observedText()).toLowerCase();
}
function observedText(): string { reads++; return ""; }
function normalizeElement(values: string[] | undefined): string | undefined {
  return values?.at(0)?.trim().toLowerCase();
}
function optionalLength(value: string | undefined): number | undefined {
  return value?.trim().indexOf("x");
}
class Data { values: string[] = ["first"]; }
class Receiver { accept(value: string | undefined): string { return accept(value); } }
class TextReader { read(): string { reads++; return " FIRST "; } }
function normalizeReader(reader: TextReader | undefined): string | undefined {
  return reader?.read().trim().toLowerCase();
}
function conditionalObject(values: Data[]): Data | undefined {
  const selected = values.length > 0 ? values[0] : undefined;
  return selected;
}
export function run(): boolean {
  const data = new Data();
  const receiver = new Receiver();
  let caught = false;
  try { fallible("bad"); } catch { caught = true; }
  if (!caught || fallible(undefined) !== undefined || fallible("good") !== "good") return false;
  if (conditional(["first"]) !== "first" || conditional([]) !== undefined) return false;
  if (conditionalObject([data]) !== data || conditionalObject([]) !== undefined) return false;
  if (normalize(" FIRST ") !== "first" || normalize(undefined) !== undefined) return false;
  reads = 0;
  if (normalizeObserved(undefined) !== undefined || readCount() !== 1) return false;
  if (normalizeObserved(" FIRST ") !== "first" || readCount() !== 3) return false;
  if (normalizeElement(undefined) !== undefined || normalizeElement([]) !== undefined || normalizeElement([" FIRST "]) !== "first") return false;
  if (optionalLength(undefined) !== undefined || optionalLength("x") !== 0) return false;
  if (normalizeReader(undefined) !== undefined || readCount() !== 3) return false;
  if (normalizeReader(new TextReader()) !== "first" || readCount() !== 4) return false;
  reads = 0;
  const present = accept(data.values[index(0)]);
  const missing = accept(data.values[index(9)]);
  return present === "first" && missing === "absent" && readCount() === 2 &&
    accept((data.values[0])) === "first" && accept((data.values[9])) === "absent" &&
    accept(data.values[9] satisfies string) === "absent" &&
    optional(data.values[0]) === "first" && optional(data.values[9]) === "absent" &&
    defaulted(data.values[0]) === "first" && defaulted(data.values[9]) === "default" &&
    receiver.accept(data.values[0]) === "first" && receiver.accept(data.values[9]) === "absent" &&
    required(data.values[0]) === "first" &&
    indexed(data.values, 0 as int32) === "first" && indexed(data.values, undefined) === undefined &&
    character("first", 0 as int32) === "f" && character("first", undefined) === "absent" &&
    retained("first") === "first" && retained(undefined) === undefined &&
    effectful(undefined) === undefined && effectful("first") === "first" && readCount() === 3 &&
    computed(undefined) === undefined && computed("first") === "present" && readCount() === 5;
}
`;
