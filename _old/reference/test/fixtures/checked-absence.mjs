export const checkedAbsenceSource = `
import type { int32, int64 } from "@tsonic/core/types.js";
let reads: int32 = 0;
function absent(): undefined { reads++; return undefined; }
function read(value: string | undefined): string | undefined { reads++; return value; }
function count(): int32 { return reads; }
function broad(value: unknown, missing: boolean): boolean {
  return (value == null) === missing && (null == value) === missing &&
    (value != undefined) === !missing && (undefined != value) === !missing &&
    (value === null) === missing && (null === value) === missing &&
    (value !== undefined) === !missing && (undefined !== value) === !missing;
}
function optional(value: string | undefined, missing: boolean): boolean {
  return (value == null) === missing && (null == value) === missing &&
    (value != undefined) === !missing && (undefined != value) === !missing;
}
function head(values: string[]): string {
  const [value] = values;
  return value === undefined ? "missing" : value;
}
function headType(values: (string | null | undefined)[]): string {
  const [value] = values;
  return typeof (value);
}
function nullable(values: (string | null | undefined)[]): string {
  const [value] = values;
  return value == null ? "missing" : value;
}
function broadHead(values: unknown[]): boolean {
  const [value] = values;
  return value == null;
}
function fallback(): string { reads++; return "fallback"; }
function defaulted(values: (string | undefined)[]): string {
  const [value = fallback()] = values;
  return value;
}
function absentDefault(values: (string | undefined)[]): string | undefined {
  const [value = undefined] = values;
  return value;
}
function nullableDefault(values: (string | undefined)[], fallbackValue: string | undefined): string | undefined {
  const [value = fallbackValue] = values;
  return value;
}
function objectDefault(input: { value?: string }, fallbackValue: string | undefined): string | undefined {
  const { value = fallbackValue } = input;
  return value;
}
function broadDefault(values: unknown[]): string {
  const [value = fallback()] = values;
  return typeof value === "string" ? value : "other";
}
function first<T>(values: T[], fallbackValue: T): T {
  const [value = fallbackValue] = values;
  return value;
}
function optionalFirst<T>(values: T[], fallbackValue: T | undefined): T | undefined {
  const [value = fallbackValue] = values;
  return value;
}
function captured(values: string[]): () => string {
  const [value = "captured"] = values;
  return () => value;
}
function repeated(values: string[]): string {
  const [value = "x"] = values;
  let result = "";
  for (let index: int32 = 0; index < 2; index++) result += value;
  return result;
}
function reordered<T>(fallbackValue: T, values: T[]): T { return first(values, fallbackValue); }
function nested<T>(values: T[][], fallbackValue: T): T { return first(first(values, []), fallbackValue); }
class Token { value: int32 = 7; }
export function run(): boolean {
  if (!broad(undefined, true) || !broad(null, true) || !broad(false, false) ||
      !broad(0, false) || !broad("", false) || !optional(undefined, true) || !optional("", false)) return false;
  if (!(read(undefined) == absent()) || count() !== 2) return false;
  if (!(absent() != read("")) || count() !== 4) return false;
  if (head([]) !== "missing" || head(["kept"]) !== "kept" ||
      headType([]) !== "object" || headType([null]) !== "object" ||
      headType([undefined]) !== "object" || headType(["kept"]) !== "string" ||
      nullable([]) !== "missing" || nullable([undefined]) !== "missing" ||
      nullable([null]) !== "missing" || nullable(["kept"]) !== "kept") return false;
  if (!broadHead([]) || !broadHead([undefined]) || !broadHead([null]) || broadHead([false])) return false;
  if (defaulted(["kept"]) !== "kept" || count() !== 4 ||
      defaulted([]) !== "fallback" || defaulted([undefined]) !== "fallback" || count() !== 6) return false;
  if (absentDefault([]) !== undefined || absentDefault([undefined]) !== undefined || absentDefault(["kept"]) !== "kept" ||
      nullableDefault([], undefined) !== undefined || nullableDefault([undefined], "kept") !== "kept" ||
      nullableDefault(["kept"], undefined) !== "kept") return false;
  if (objectDefault({}, undefined) !== undefined || objectDefault({}, "kept") !== "kept" ||
      objectDefault({ value: "kept" }, undefined) !== "kept") return false;
  if (broadDefault([false]) !== "other" || count() !== 6 || broadDefault([]) !== "fallback" ||
      broadDefault([undefined]) !== "fallback" || count() !== 8) return false;
  const exact: int64 = 9007199254740993n;
  const token = new Token();
  const other = new Token();
  return first([exact], 0n) === exact && first([], exact) === exact &&
    optionalFirst([exact], undefined) === exact && optionalFirst<int64>([], undefined) === undefined &&
    optionalFirst<int64>([], exact) === exact && optionalFirst([token], undefined) === token &&
    first([token], other) === token && first([], token) === token &&
    reordered(0n, [exact]) === exact && nested([[exact]], 0n) === exact &&
    first(["kept"], "other") === "kept" && first([], "other") === "other" &&
    first<string | undefined>([undefined], "generic") === "generic" &&
    first<unknown>([undefined], "generic") === "generic" &&
    first<unknown>([false], "generic") === false &&
    captured([])() === "captured" && repeated(["kept"]) === "keptkept";
}
`;
