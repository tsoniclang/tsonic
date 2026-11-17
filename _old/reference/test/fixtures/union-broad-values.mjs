export const unionBroadValuesSource = `
import type { uint64 } from "@tsonic/core/types.js";
class Source {
  read(key: string): unknown;
  read(key: number): number;
  read(key: string | number): unknown { return key; }
  wide(key: uint64): uint64;
  wide(key: string): unknown;
  wide(key: uint64 | string): unknown { return key; }
}
function overload(key: string): unknown;
function overload(key: number): number;
function overload(key: string | number): unknown { return key; }
function mixed(value: string | number): unknown { return value; }
function generated(value: string | number | boolean): unknown { return value; }
function optional(value: string | number | undefined): unknown { return value; }
function integer(value: uint64 | string): unknown { return value; }
function read(source: Source | undefined): unknown { return source?.read("value"); }
function numericRead(source: Source): number { return source.read(10); }
function optionalNumericRead(source: Source | undefined): number | undefined { return source?.read(10); }
function wideRead(source: Source, value: uint64): uint64 { return source.wide(value); }
let calls = 0;
function advance(): number { calls++; return 10; }
function guardedRead(source: Source | undefined): number | undefined { return source?.read(advance()); }
export function run(): boolean {
  calls = 0;
  const absent = guardedRead(undefined);
  const absentCalls = calls;
  const present = guardedRead(new Source());
  const presentCalls = calls;
  return absent === undefined && absentCalls === 0 && present === 10 && presentCalls === 1 &&
    mixed("text") === "text" && mixed(7) === 7 && generated(false) === false &&
    generated("other") === "other" && generated(8) === 8 &&
    optional(undefined) === undefined && optional("present") === "present" &&
    optional(9) === 9 && read(new Source()) === "value" &&
    read(undefined) === undefined && new Source().read(10) === 10 && numericRead(new Source()) === 10 &&
    optionalNumericRead(new Source()) === 10 && optionalNumericRead(undefined) === undefined &&
    overload(11) === 11 && overload("overload") === "overload" &&
    wideRead(new Source(), 9007199254740993n as uint64) === (9007199254740993n as uint64) &&
    integer(9007199254740993n as uint64) === (9007199254740993n as uint64) &&
    integer("integer") === "integer";
}
`;
