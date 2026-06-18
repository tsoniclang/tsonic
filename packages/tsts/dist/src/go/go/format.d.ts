import type { byte } from "@tsonic/core/types.js";
import type { GoError, GoSlice } from "../compat.js";
import type { Writer } from "../io.js";
export declare function Node(dst: Writer, _fset: unknown, node: unknown): GoError;
export declare function Source(src: GoSlice<byte> | Uint8Array | string): [GoSlice<byte>, GoError];
//# sourceMappingURL=format.d.ts.map