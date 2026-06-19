import type { bool, int } from "./scalars.js";
import { fileURLToPath } from "node:url";
import process from "node:process";
import nodeOs from "node:os";

export const GOOS: string =
  process.platform === "win32" ? "windows" :
  process.platform === "darwin" ? "darwin" :
  process.platform === "linux" ? "linux" :
  process.platform;

export const GOARCH: string =
  process.arch === "x64" ? "amd64" :
  process.arch === "ia32" ? "386" :
  process.arch;

export interface MemStats {
  Alloc?: number;
  TotalAlloc?: number;
  Sys?: number;
  NumGC?: number;
}

export function Caller(skip: int): [unknown, string, int, bool] {
  const stack = new globalThis.Error().stack?.split("\n") ?? [];
  const frame = stack[skip + 2] ?? "";
  const match = frame.match(/\(?((?:file:\/\/)?[^():]+):(\d+):(\d+)\)?$/);
  if (match === null) {
    return [0, "", 0 as int, false];
  }
  const rawFile = match[1]!;
  const file = rawFile.startsWith("file://") ? fileURLToPath(rawFile) : rawFile;
  return [0, file, Number(match[2]) as int, true];
}

export function Callers(_skip: int, _pc: Array<unknown>): int {
  return 0 as int;
}

export function CallersFrames(_callers: Array<unknown>): unknown {
  return undefined;
}

export function GC(): void {
}

export function GOMAXPROCS(_n: int): int {
  return nodeOs.cpus().length as int;
}

export function ReadMemStats(stats: MemStats): void {
  const usage = process.memoryUsage();
  stats.Alloc = usage.heapUsed;
  stats.TotalAlloc = usage.heapTotal;
  stats.Sys = usage.rss;
  stats.NumGC = 0;
}
