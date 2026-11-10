export const closedRuntimeCategoriesSource = `
class First { value = "first"; }
class Second { value = 2; }
type Entry = First | Second | string;
type Action = (() => string) | ((value: number) => number) | string;
let calls = 0;
function entry(value: Entry | null | undefined): Entry | null | undefined { calls++; return value; }
function action(value: Action): Action { calls++; return value; }
function isObject(value: Entry | null | undefined): boolean { return typeof entry(value) === "object"; }
function isNotObject(value: Entry | null | undefined): boolean { return typeof entry(value) !== "object"; }
function isString(value: Entry | null | undefined): boolean { return typeof entry(value) === "string"; }
function isFunction(value: Action): boolean { return typeof action(value) === "function"; }
function isNotFunction(value: Action): boolean { return typeof action(value) !== "function"; }
function absentFunction(value: Action): boolean { return typeof action(value) === "boolean"; }
export function run(): boolean {
  calls = 0;
  if (!isObject(new First()) || !isObject(new Second()) || isObject("text")) return false;
  if (!isObject(undefined) || !isObject(null)) return false;
  if (isNotObject(new First()) || !isNotObject("text") || isNotObject(undefined)) return false;
  if (!isString("text") || isString(new Second()) || isString(undefined)) return false;
  if (!isFunction(() => "text") || !isFunction(value => value + 1) || isFunction("text")) return false;
  if (isNotFunction(() => "text") || !isNotFunction("text") || absentFunction(() => "text")) return false;
  return calls === 17;
}
`;
