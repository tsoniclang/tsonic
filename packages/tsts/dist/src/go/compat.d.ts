import type { bool, int } from "@tsonic/core/types.js";
declare const __goBrand: unique symbol;
export type GoPtr<T> = T | undefined;
export type GoSlice<T> = T[];
export type GoArray<T, Length extends string> = T[] & {
    readonly [__goBrand]?: {
        readonly length: Length;
    };
};
export type GoMap<K, V> = Map<K, V>;
export type GoChan<T, Direction extends string = "bidirectional"> = {
    readonly [__goBrand]?: {
        readonly element: T;
        readonly direction: Direction;
    };
};
export type GoSeq<T> = (yieldValue: (value: T) => bool) => void;
export type GoSeq2<K, V> = (yieldValue: (key: K, value: V) => bool) => void;
export type GoError = Error | undefined;
export type GoComparable = unknown;
export type GoOrdered = string | number | bigint | bool;
export type GoConstraint<Text extends string> = unknown;
export type GoUnresolved<Name extends string> = {
    readonly [__goBrand]: {
        readonly unresolved: Name;
    };
};
export type GoUnsupported<Text extends string> = {
    readonly [__goBrand]: {
        readonly unsupported: Text;
    };
};
export type GoComplex64 = {
    readonly real: number;
    readonly imag: number;
};
export type GoComplex128 = {
    readonly real: number;
    readonly imag: number;
};
export type GoUnsafePointer = GoPtr<unknown>;
export type GoRune = int;
export declare class GoStructMap<K, V> implements Map<K, V> {
    readonly [Symbol.toStringTag] = "Map";
    private readonly entriesByKey;
    get size(): number;
    clear(): void;
    delete(key: K): boolean;
    forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: unknown): void;
    get(key: K): V | undefined;
    getOrInsert(key: K, value: V): V;
    getOrInsertComputed(key: K, callbackfn: (key: K) => V): V;
    has(key: K): boolean;
    set(key: K, value: V): this;
    entries(): MapIterator<[K, V]>;
    keys(): MapIterator<K>;
    values(): MapIterator<V>;
    [Symbol.iterator](): MapIterator<[K, V]>;
}
export declare function NewGoStructMap<K, V>(): GoMap<K, V>;
export declare function GoAppend<T>(slice: GoPtr<GoSlice<T>>, ...items: GoSlice<T>): GoSlice<T>;
export {};
//# sourceMappingURL=compat.d.ts.map