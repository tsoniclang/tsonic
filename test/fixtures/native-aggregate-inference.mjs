export const nativeAggregateInferenceSource = `
import type { int8, int32, int64, uint64 } from "@tsonic/core/types.js";
interface Envelope<T> { values: T[]; }
interface Deferred<T> { readonly read: () => T; }
interface MaybeDeferred<T> { readonly read: () => T | null | undefined; }
interface Value<T> { readonly value: T; }
function select<T>(values: T[], fallbackValue: T): T {
  return values.length === 0 ? fallbackValue : values[0]!;
}
function record<T>(input: Envelope<T>, fallbackValue: T): T { return select(input.values, fallbackValue); }
function nested<T>(input: T[][], fallbackValue: T): T { return select(select(input, []), fallbackValue); }
function deferred<T>(input: Deferred<T>): T { return input.read(); }
function callbacks<T>(input: (() => T)[]): T { return input[0]!(); }
function maybe<T>(read: () => T | null | undefined, fallbackValue: T): T { return read() ?? fallbackValue; }
function maybeDeferred<T>(input: MaybeDeferred<T>, fallbackValue: T): T { return input.read() ?? fallbackValue; }
function value<T>(input: Value<T>): T { return input.value; }
export function run(): boolean {
  const exact: int64 = 9007199254740993n;
  const maximum: uint64 = 18446744073709551615n;
  const minimum: int8 = -128;
  const values = [exact];
  let reads: int32 = 0;
  const absent = maybe(() => { reads++; return null; }, exact);
  const missing = maybe(function () { reads++; return undefined; }, maximum);
  const nestedAbsent = maybeDeferred({ read: () => { reads++; return null; } }, exact);
  if (reads !== 3 || absent !== exact || missing !== maximum || nestedAbsent !== exact) return false;
  return select([exact], 0n) === exact && select([], exact) === exact &&
    select([minimum], 127) === minimum && select([maximum], 0n) === maximum &&
    record({ values: [exact] }, 0n) === exact && nested([[exact]], 0n) === exact &&
    select([...values], 0n) === exact && deferred({ read: () => exact }) === exact &&
    callbacks([() => maximum]) === maximum && value({ value: "literal" }) === "literal";
}
`;

export const nativeAggregateInferenceRejections = [
  ["out-of-range integer literal", `const value: int8 = 7; return select([value], 128);`],
  ["out-of-range bigint literal", `const value: int64 = 7n; return select([value], 9223372036854775808n);`],
  ["incompatible signed native carriers", `const signed: int64 = 7n; const unsigned: uint64 = 7n; return select([signed], unsigned);`],
  ["explicit floating operand", `const integer: int32 = 7; const floating: number = 1.5; return select([integer], floating);`],
  ["unsigned array against an explicit signed type", `const unsigned: uint64 = 7n; return select<int64>([unsigned], 0n);`],
  ["unsigned tuple against an explicit signed type", `const unsigned: uint64 = 7n; const tuple: [int64] = [unsigned]; return tuple;`],
  ["unsigned operand against an explicit signed type", `const unsigned: uint64 = 7n; return select<int64>([], unsigned);`],
].map(([name, body]) => ({ name, source: `
import type { int8, int32, int64, uint64 } from "@tsonic/core/types.js";
function select<T>(values: T[], fallbackValue: T): T { return values.length === 0 ? fallbackValue : values[0]!; }
export function rejected() { ${body} }
` }));
