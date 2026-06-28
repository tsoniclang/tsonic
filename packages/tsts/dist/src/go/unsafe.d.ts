import type { byte, int } from "./scalars.js";
import type { GoPtr, GoSlice, GoUnsafePointer } from "./compat.js";
export declare function Pointer<T>(value: GoPtr<T>): GoUnsafePointer;
export declare function Slice<T>(ptr: GoPtr<T> | ArrayLike<T>, len: int): GoSlice<T>;
export declare function String(ptr: GoPtr<byte> | ArrayLike<byte>, len: int): string;
export declare function StringData(value: string): GoPtr<byte>;
//# sourceMappingURL=unsafe.d.ts.map