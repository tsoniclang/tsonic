export const optionalPrimitiveConversionsSource = `
import type { int64, uint64 } from "@tsonic/core/types.js";
function text(value: string | null | undefined): string { return String(value); }
function integer(value: int64 | undefined): string { return String(value); }
function numeric(value: string | undefined): number { return Number(value); }
function wide(value: uint64 | undefined): number { return Number(value); }
function boolean(value: boolean | undefined): number { return Number(value); }
function broad(value: unknown): number { return Number(value); }
function joined(values: (string | undefined)[]): string { return values.join("|"); }
export function run(): boolean {
  const exact: int64 = 9007199254740993n;
  const maximum: uint64 = 18446744073709551615n;
  let calls = 0;
  const next = (): string | undefined => { calls += 1; return "42"; };
  return text(undefined) === "null" && text(null) === "null" && text("") === "" &&
    text("a😀z") === "a😀z" && integer(exact) === "9007199254740993" && integer(undefined) === "null" &&
    numeric(undefined) === 0 && numeric("") === 0 && numeric(" 0x10 ") === 16 &&
    numeric("Infinity") === Number.POSITIVE_INFINITY && Number.isNaN(numeric("invalid")) &&
    wide(maximum) === 18446744073709551616 && wide(undefined) === 0 &&
    boolean(true) === 1 && boolean(false) === 0 && boolean(undefined) === 0 &&
    broad("17") === 17 && broad(false) === 0 && broad(undefined) === 0 &&
    joined([undefined, "value", undefined]) === "|value|" &&
    Number(next()) === 42 && calls === 1 && Number() === 0 && Number(null) === 0;
}
`;
