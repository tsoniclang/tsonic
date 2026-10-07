export const nativeParameterDefaultsSource = `
let calls = 0;
function count(): number { return calls; }
function next(): unknown { calls++; return "default"; }
function direct(value: unknown = ""): unknown { return value; }
function evaluated(value: unknown = next()): unknown { return value; }
const deferred = (value: unknown = next()): unknown => value;
class Holder {
  value: unknown;
  constructor(value: unknown = "constructor") { this.value = value; }
  method(value: unknown = "method"): unknown { return value; }
}
export function run(): boolean {
  if (count() !== 0 || direct() !== "" || direct(undefined) !== "" || direct(null) !== "") return false;
  if (direct(0) !== 0 || direct(false) !== false || direct("") !== "") return false;
  if (evaluated(0) !== 0 || evaluated(false) !== false || deferred("") !== "" || count() !== 0) return false;
  if (evaluated() !== "default" || evaluated(undefined) !== "default" || evaluated(null) !== "default") return false;
  if (deferred() !== "default" || deferred(undefined) !== "default" || deferred(null) !== "default") return false;
  const first = new Holder();
  const second = new Holder(undefined);
  const third = new Holder(null);
  const fourth = new Holder(0);
  return count() === 6 && first.value === "constructor" && second.value === "constructor" &&
    third.value === "constructor" && fourth.value === 0 &&
    first.method() === "method" && first.method(undefined) === "method" && first.method(null) === "method" &&
    first.method(false) === false && first.method(0) === 0 && first.method("") === "";
}
`;

export const orderedParameterDefaultsSource = `
let calls = 0;
function next(): unknown { calls++; return "default"; }
function nextNumber(): number { calls++; return 9; }
function count(): number { return calls; }
function ordered(value: unknown = next(), required: number): unknown {
  return required === 7 ? value : false;
}
function constant(value: number = 3, required: number): number { return value + required; }
function destructured({ value }: { value: number } = { value: nextNumber() }, required: number): number {
  return value + required;
}
function positional([value]: [number] = [11], required: number): number {
  return value + required;
}
const deferred = (value: unknown = next(), required: number): unknown => required === 7 ? value : false;
class Holder {
  value: unknown;
  constructor(value: unknown = next(), required: number) { this.value = required === 7 ? value : false; }
  method(value: unknown = next(), required: number): unknown { return required === 7 ? value : false; }
}
export function run(): boolean {
  if (count() !== 0 || ordered(0, 7) !== 0 || deferred(false, 7) !== false) return false;
  if (constant(0, 7) !== 7 || constant(undefined, 7) !== 10) return false;
  if (destructured({ value: 0 }, 7) !== 7 || count() !== 0) return false;
  if (positional([0], 7) !== 7 || positional(undefined, 7) !== 18) return false;
  if (ordered(undefined, 7) !== "default" || ordered(null, 7) !== "default") return false;
  if (deferred(undefined, 7) !== "default" || deferred(null, 7) !== "default") return false;
  if (destructured(undefined, 7) !== 16) return false;
  const holder = new Holder(undefined, 7);
  if (holder.value !== "default" || holder.method(0, 7) !== 0 || holder.method(undefined, 7) !== "default") return false;
  return count() === 7;
}
`;
