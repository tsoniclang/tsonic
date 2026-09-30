export const nativeAggregateInferenceSource = `
import type { int8, int32, int64, uint64 } from "@tsonic/core/types.js";
interface Envelope<T> { values: T[]; }
function select<T>(values: T[], fallbackValue: T): T {
  return values.length === 0 ? fallbackValue : values[0]!;
}
function record<T>(input: Envelope<T>, fallbackValue: T): T { return select(input.values, fallbackValue); }
function nested<T>(input: T[][], fallbackValue: T): T { return select(select(input, []), fallbackValue); }
export function run(): boolean {
  const exact: int64 = 9007199254740993n;
  const maximum: uint64 = 18446744073709551615n;
  const minimum: int8 = -128;
  const values = [exact];
  return select([exact], 0n) === exact && select([], exact) === exact &&
    select([minimum], 127) === minimum && select([maximum], 0n) === maximum &&
    record({ values: [exact] }, 0n) === exact && nested([[exact]], 0n) === exact &&
    select([...values], 0n) === exact;
}
`;

export const nativeAggregateInferenceRejections = [
  ["out-of-range integer literal", `const value: int8 = 7; return select([value], 128);`],
  ["out-of-range bigint literal", `const value: int64 = 7n; return select([value], 9223372036854775808n);`],
  ["incompatible signed native carriers", `const signed: int64 = 7n; const unsigned: uint64 = 7n; return select([signed], unsigned);`],
  ["explicit floating operand", `const integer: int32 = 7; const floating: number = 1.5; return select([integer], floating);`],
].map(([name, body]) => ({ name, source: `
import type { int8, int32, int64, uint64 } from "@tsonic/core/types.js";
function select<T>(values: T[], fallbackValue: T): T { return values.length === 0 ? fallbackValue : values[0]!; }
export function rejected() { ${body} }
` }));
