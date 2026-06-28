import type { bool } from "./scalars.js";
import type { GoMap, GoSeq } from "./compat.js";
export declare function Clone<K, V>(m: GoMap<K, V> | undefined): GoMap<K, V> | undefined;
export declare function Copy<K, V>(dst: GoMap<K, V>, src: GoMap<K, V>): void;
export declare function Equal<K, V>(m1: GoMap<K, V>, m2: GoMap<K, V>): bool;
export declare function EqualFunc<K, V1, V2>(m1: GoMap<K, V1>, m2: GoMap<K, V2>, eq: (v1: V1, v2: V2) => bool): bool;
export declare function Keys<K, V>(m: GoMap<K, V> | undefined): GoSeq<K>;
export declare function Values<K, V>(m: GoMap<K, V> | undefined): GoSeq<V>;
export declare function DeleteFunc<K, V>(m: GoMap<K, V>, del: (key: K, value: V) => bool): void;
//# sourceMappingURL=maps.d.ts.map