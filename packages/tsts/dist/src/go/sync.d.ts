import type { int, bool } from "./scalars.js";
export declare class Mutex {
    Lock(): void;
    Unlock(): void;
    TryLock(): bool;
}
export declare class RWMutex {
    Lock(): void;
    Unlock(): void;
    RLock(): void;
    RUnlock(): void;
    TryLock(): bool;
    TryRLock(): bool;
    RLocker(): Locker;
}
export interface Locker {
    Lock(): void;
    Unlock(): void;
}
export declare class Once {
    private done;
    Do(f: () => void): void;
}
export declare function OnceFunc(f: () => void): () => void;
export declare function OnceValue<T>(f: () => T): () => T;
export declare function OnceValues<T1, T2>(f: () => [T1, T2]): () => [T1, T2];
export declare class Map<K = unknown, V = unknown> {
    private readonly primitive;
    private readonly structured;
    private readonly nanNumberEntries;
    Load(key: K): [V | undefined, bool];
    Store(key: K, value: V): void;
    LoadOrStore(key: K, value: V): [V, bool];
    LoadAndDelete(key: K): [V | undefined, bool];
    Delete(key: K): void;
    Clear(): void;
    Range(f: (key: K, value: V) => bool): void;
}
export declare class Pool<T = unknown> {
    New?: () => T;
    private readonly items;
    Get(): T | undefined;
    Put(x: T): void;
}
export declare class Cond {
    readonly L: Locker;
    constructor(l: Locker);
    Wait(): void;
    Signal(): void;
    Broadcast(): void;
}
export declare function NewCond(l: Locker): Cond;
export declare class WaitGroup {
    private counter;
    Add(delta: int): void;
    Done(): void;
    Wait(): void;
    Go(f: () => void): void;
}
//# sourceMappingURL=sync.d.ts.map