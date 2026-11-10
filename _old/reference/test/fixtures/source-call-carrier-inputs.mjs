export const sourceCallCarrierInputs = `
import { Buffer } from "node:buffer";
import type { createReadStream } from "node:fs";
type ReadOptions = Extract<NonNullable<Parameters<typeof createReadStream>[1]>, object>;
type Offset = NonNullable<ReadOptions["start"]>;
function accept(value: Offset): Offset { return value; }
export function textOffset(value: string): Offset { return accept(value.length); }
export function run(): boolean {
  const bytes = new Uint8Array(3);
  const buffer = Buffer.from("four");
  const wide: Offset = 9007199254740993;
  return accept(bytes.length) === 3 && accept(buffer.length) === 4 &&
    accept(Buffer.byteLength("four")) === 4 && textOffset("five!") === 5 && accept(wide) === wide;
}
`;
