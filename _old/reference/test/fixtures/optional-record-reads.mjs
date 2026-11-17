export const optionalRecordReadsSource = `
interface Options { headers?: Record<string, string | undefined>; }
class Effects { calls = 0; }
function key(effects: Effects): string {
  effects.calls++;
  return "content-type";
}
function read(options: Options | null | undefined, effects: Effects): string | undefined {
  return options?.headers?.[key(effects)];
}
function required(values: Record<string, string> | undefined): string | undefined {
  return values?.["content-type"];
}
function failingKey(): string { throw new Error("key failure"); }
function failing(values: Record<string, string | undefined> | undefined): string | undefined {
  return values?.[failingKey()];
}
function checkedFailure(): boolean {
  if (failing(undefined) !== undefined) return false;
  try { failing({}); } catch { return true; }
  return false;
}
export function run(): boolean {
  const effects = new Effects();
  const absent = read(undefined, effects);
  const nullish = read(null, effects);
  const noHeaders = read({}, effects);
  const absentCalls = effects.calls;
  const noValue = read({ headers: {} }, effects);
  const present = read({ headers: { "content-type": "text/plain" } }, effects);
  return absentCalls === 0 && effects.calls === 2 && absent === undefined && nullish === null &&
    noHeaders === undefined && noValue === undefined && present === "text/plain" &&
    required(undefined) === undefined && required({ "content-type": "text/plain" }) === "text/plain" && checkedFailure();
}
`;
