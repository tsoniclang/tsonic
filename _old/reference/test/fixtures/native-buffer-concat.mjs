export const nativeBufferConcatSource = `
import { Buffer } from "node:buffer";

export function concatenate(buffers: Buffer[]): Buffer {
  return Buffer.concat(buffers);
}

export function concatenateBounded(buffers: Buffer[]): Buffer {
  return Buffer.concat(buffers, 3);
}

export function run(): boolean {
  const buffers = [Buffer.from("ab"), Buffer.from("cd")];
  const joined = concatenate(buffers);
  const truncated = concatenateBounded(buffers);
  const padded = Buffer.concat(buffers, 6);
  return joined.toString() === "abcd" && truncated.toString() === "abc" &&
    padded.length === 6 && padded.readUInt8(4) === 0 && padded.readUInt8(5) === 0 &&
    Buffer.concat([]).length === 0 && Buffer.concat([], 6).length === 0 &&
    Buffer.concat(buffers, 0).length === 0 &&
    buffers.length === 2 && buffers[0]!.toString() === "ab";
}
`;
