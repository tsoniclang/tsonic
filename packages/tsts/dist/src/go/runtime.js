import { fileURLToPath } from "node:url";
import process from "node:process";
import nodeOs from "node:os";
export const GOOS = process.platform === "win32" ? "windows" :
    process.platform === "darwin" ? "darwin" :
        process.platform === "linux" ? "linux" :
            process.platform;
export const GOARCH = process.arch === "x64" ? "amd64" :
    process.arch === "ia32" ? "386" :
        process.arch;
export function Caller(skip) {
    const stack = new globalThis.Error().stack?.split("\n") ?? [];
    const frame = stack[skip + 2] ?? "";
    const match = frame.match(/\(?((?:file:\/\/)?[^():]+):(\d+):(\d+)\)?$/);
    if (match === null) {
        return [0, "", 0, false];
    }
    const rawFile = match[1];
    const file = rawFile.startsWith("file://") ? fileURLToPath(rawFile) : rawFile;
    return [0, file, Number(match[2]), true];
}
export function Callers(_skip, _pc) {
    return 0;
}
export function CallersFrames(_callers) {
    return undefined;
}
export function GC() {
}
export function GOMAXPROCS(_n) {
    return nodeOs.cpus().length;
}
export function ReadMemStats(stats) {
    const usage = process.memoryUsage();
    stats.Alloc = usage.heapUsed;
    stats.TotalAlloc = usage.heapTotal;
    stats.Sys = usage.rss;
    stats.NumGC = 0;
}
//# sourceMappingURL=runtime.js.map