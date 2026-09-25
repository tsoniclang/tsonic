export const providerIndexedNativeTypes = `
import type { Stats as FileStats } from "node:fs";
export type FileSize = FileStats["size"];
export class Snapshot {
  size: FileSize;
  direct: FileStats["size"];
  optional: FileSize | undefined;
  constructor(size: FileSize) {
    this.size = size;
    this.direct = size;
    this.optional = size;
  }
}
export function forward(size: FileSize) { return size; }
export function plain(value: { size: number }["size"]) { return value; }
`;

export const providerIndexedNativeUse = `
import { Snapshot, forward, plain, type FileSize } from "./model.js";
import { statSync } from "node:fs";
function exact(size: FileSize) { return forward(size); }
export function run(): boolean {
  const first = new Snapshot(9007199254740992);
  const next = new Snapshot(9007199254740992);
  next.size++;
  const value = exact(next.size);
  const actual = new Snapshot(statSync(".").size);
  const present = next.optional;
  next.optional = undefined;
  return value - first.size === 1 && next.direct === first.size &&
    present === first.size && next.optional === undefined &&
    actual.size >= 0 && plain(1.25) === 1.25;
}
`;
