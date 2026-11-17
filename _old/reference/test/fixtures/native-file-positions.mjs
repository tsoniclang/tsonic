export const nativeFilePositionSource = `
import { readSync, writeSync, statSync, createReadStream, createWriteStream } from "node:fs";
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

export function readNativeResult(fd: number, buffer: Buffer, path: string): number {
  const position = statSync(path).size;
  return readSync(fd, buffer, 0, 1, position);
}

export function openExactRead(path: string) {
  return createReadStream(path, { start: 9007199254740993, end: 9007199254740995, highWaterMark: 4 });
}

export function openExactWrite(path: string) {
  return createWriteStream(path, { start: 9007199254740993, highWaterMark: 4 });
}
`;
