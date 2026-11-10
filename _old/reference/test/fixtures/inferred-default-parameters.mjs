export const inferredDefaultParameterSource = `
let evaluations = 0;
function next(): number { evaluations += 1; return evaluations + 2; }
class Counter {
  value: number;
  constructor(value = next()) { this.value = value; }
  static exact(value = 9007199254740993n): bigint { return value; }
}
function options(enabled = false, label = "default"): string {
  return enabled ? label : "disabled";
}
export function run(): boolean {
  evaluations = 0;
  const first = new Counter();
  const second = new Counter(17);
  const third = new Counter(undefined);
  return first.value === 3 && second.value === 17 && third.value === 4 && evaluations === 2 &&
    Counter.exact() === 9007199254740993n && Counter.exact(7n) === 7n &&
    Counter.exact(undefined) === 9007199254740993n && options() === "disabled" &&
    options(true) === "default" && options(true, "chosen") === "chosen";
}
`;
