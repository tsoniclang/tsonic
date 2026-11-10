export const mixedWidthRecordSource = `
import { field, struct } from "@tsonic/core/lang.js";
import type { int32, uint32 } from "@tsonic/core/types.js";
const Span: { range: { start: int32; end: int32 }; flags: uint32 } = struct({
  range: field<{ start: int32; end: int32 }>(), flags: field<uint32>()
});
export function run(): boolean {
  const original: typeof Span = { range: { start: -3, end: 2 }, flags: 4294967295 };
  let copy: typeof Span = original;
  copy.flags = 17;
  copy.range.start = -7;
  return original.flags === 4294967295 && copy.flags === 17 &&
    original.range.start === -7 && original.range.end === 2;
}
`;
