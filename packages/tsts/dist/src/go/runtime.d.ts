import type { bool, int } from "./scalars.js";
export declare const GOOS: string;
export declare const GOARCH: string;
export interface MemStats {
    Alloc?: number;
    TotalAlloc?: number;
    Sys?: number;
    NumGC?: number;
}
export declare function Caller(skip: int): [unknown, string, int, bool];
export declare function Callers(_skip: int, _pc: Array<unknown>): int;
export declare function CallersFrames(_callers: Array<unknown>): unknown;
export declare function GC(): void;
export declare function GOMAXPROCS(_n: int): int;
export declare function ReadMemStats(stats: MemStats): void;
//# sourceMappingURL=runtime.d.ts.map