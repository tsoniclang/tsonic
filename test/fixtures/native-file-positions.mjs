export const nativeFilePositionSource = `
import { readSync, writeSync } from "node:fs";
import { Buffer } from "node:buffer";
import type { int64 } from "@tsonic/core/types.js";

export function readAt(fd: number, buffer: Buffer, position: int64): number {
  return readSync(fd, buffer, 0, 1, position);
}

export function writeAt(fd: number, buffer: Buffer, position: int64): number {
  return writeSync(fd, buffer, 0, 1, position);
}

export function readExact(fd: number, buffer: Buffer): number {
  const position: int64 = 9007199254740993n;
  return readAt(fd, buffer, position);
}

export function readCurrent(fd: number, buffer: Buffer): number {
  return readSync(fd, buffer, 0, 1, null);
}
`;
