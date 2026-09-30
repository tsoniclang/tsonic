export const guardedOptionalMemberSource = `
import type { int64 } from "@tsonic/core/types.js";
interface Options {
  path?: string;
  wide?: int64;
  enabled?: boolean;
  encode?: (value: string) => string;
}
function select(options?: Options): string {
  let encode: ((value: string) => string) | undefined;
  let path = "/";
  if (options !== undefined) {
    encode = options.encode;
    if (options.path !== undefined) path = options.path;
  }
  return encode !== undefined ? encode(path) : path;
}
function wide(options: Options): int64 {
  let selected: int64 = 0n;
  if (options.wide !== undefined) selected = options.wide;
  return selected;
}
function enabled(options: Options): boolean {
  if (options.enabled !== undefined) return options.enabled;
  return true;
}
class Box<Value> {
  value?: Value;
  constructor(value: Value | undefined) { this.value = value; }
}
function generic<Value>(box: Box<Value>): Value | undefined {
  if (box.value !== undefined) {
    const value: Value = box.value;
    return value;
  }
  return undefined;
}
export function run(): boolean {
  const exact: int64 = 9007199254740993n;
  let calls = 0;
  const encode = (value: string): string => { calls += 1; return value + "!"; };
  const absent = generic(new Box<string>(undefined));
  const optionalAbsent = generic(new Box<int64 | undefined>(undefined));
  const optionalPresent = generic(new Box<int64 | undefined>(exact));
  const optionalZero = generic(new Box<int64 | undefined>(0n));
  const isNull = absent === null;
  const isUndefined = absent === undefined;
  return select() === "/" && select({ path: "chosen" }) === "chosen" &&
    select({ path: "" }) === "" && select({ encode }) === "/!" && calls === 1 &&
    wide({ wide: exact }) === exact && wide({ wide: 0n }) === 0n && wide({}) === 0n &&
    !enabled({ enabled: false }) && enabled({ enabled: true }) && enabled({}) &&
    generic(new Box(exact)) === exact && generic(new Box("")) === "" && isNull && isUndefined &&
    optionalAbsent === undefined && optionalPresent === exact && optionalZero === 0n;
}
`;

export const rejectedCallableConditionSource = `
export function choose(callback: (() => string) | undefined): string {
  return callback ? callback() : "absent";
}
`;

export const rejectedGenericCarrierSource = `
import type { int64, uint64 } from "@tsonic/core/types.js";
class Box<Value> {
  value?: Value;
  constructor(value: Value | undefined) { this.value = value; }
}
function read(box: Box<int64>): int64 | undefined { return box.value; }
export function run(): int64 | undefined {
  const value: uint64 = 18446744073709551615n;
  return read(new Box(value));
}
`;
