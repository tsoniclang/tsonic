export const nullishNeverSource = `
let trace = "";
function readTrace(): string { return trace; }
function fail(): never { trace += "fail;"; throw new Error("absent"); }
function relay(): never { return fail(); }
function next(value: number): number { trace += "call;"; return value + 1; }
function invoke(callback: ((value: number) => number) | undefined): number {
  return (callback ?? fail())(41);
}
function required(callback: (value: number) => number): number {
  return (callback ?? fail())(9);
}
function select(present: boolean): string | undefined {
  trace += "select;";
  return present ? "ready" : undefined;
}
export function run(): boolean {
  if (invoke(next) !== 42 || required(next) !== 10 || readTrace() !== "call;call;") return false;
  const value = select(true) ?? fail();
  if (value !== "ready" || readTrace() !== "call;call;select;") return false;
  let caught = false;
  try { invoke(undefined); } catch { caught = true; }
  if (!caught || readTrace() !== "call;call;select;fail;") return false;
  caught = false;
  try { next(relay()); } catch { caught = true; }
  return caught && readTrace() === "call;call;select;fail;fail;";
}
`;
