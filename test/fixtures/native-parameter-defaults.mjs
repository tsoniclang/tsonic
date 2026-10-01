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
