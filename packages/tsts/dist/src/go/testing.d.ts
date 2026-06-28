import type { bool } from "./scalars.js";
export declare function AllocsPerRun(runs: number, fn: () => void): number;
export interface TB {
    Helper(): void;
    Error(...args: unknown[]): void;
    Errorf(format: string, ...args: unknown[]): void;
    Fatal(...args: unknown[]): never;
    Fatalf(format: string, ...args: unknown[]): never;
    Failed(): bool;
    Fail(): void;
    FailNow(): never;
}
declare class testingBase implements TB {
    private failed;
    Helper(): void;
    Error(...args: unknown[]): void;
    Errorf(format: string, ...args: unknown[]): void;
    Fatal(...args: unknown[]): never;
    Fatalf(format: string, ...args: unknown[]): never;
    Failed(): bool;
    Fail(): void;
    FailNow(): never;
}
export declare class B extends testingBase {
}
export interface F {
    Add(...args: unknown[]): void;
    Fuzz(fn: (...args: unknown[]) => void): void;
}
export declare class M extends testingBase {
}
export declare class T extends testingBase {
    Run(name: string, fn: (t: T) => void): bool;
}
export declare class PB extends testingBase {
}
export declare function Testing(): bool;
export {};
//# sourceMappingURL=testing.d.ts.map