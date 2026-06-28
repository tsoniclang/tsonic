import type { bool, int, long, uint, ulong } from "../scalars.js";
export declare class Bool {
    private value;
    Load(): bool;
    Store(value: bool): void;
    Swap(newValue: bool): bool;
    CompareAndSwap(oldValue: bool, newValue: bool): bool;
}
export declare class Int32 {
    private value;
    Load(): int;
    Store(value: int): void;
    Swap(newValue: int): int;
    CompareAndSwap(oldValue: int, newValue: int): bool;
    Add(delta: int): int;
}
export declare class Int64 {
    private value;
    Load(): long;
    Store(value: long): void;
    Swap(newValue: long): long;
    CompareAndSwap(oldValue: long, newValue: long): bool;
    Add(delta: long): long;
}
export declare class Uint32 {
    private value;
    Load(): uint;
    Store(value: uint): void;
    Swap(newValue: uint): uint;
    CompareAndSwap(oldValue: uint, newValue: uint): bool;
    Add(delta: uint): uint;
}
export declare class Uint64 {
    private value;
    Load(): ulong;
    Store(value: ulong): void;
    Swap(newValue: ulong): ulong;
    CompareAndSwap(oldValue: ulong, newValue: ulong): bool;
    Add(delta: ulong): ulong;
}
//# sourceMappingURL=atomic.d.ts.map