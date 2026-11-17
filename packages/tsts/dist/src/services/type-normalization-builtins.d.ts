import type { Checker } from "../internal/checker/checker/state.js";
import type { Signature, Type } from "../internal/checker/types.js";
export declare function reacquireBuiltinType(producer: Checker, type: Type): Type | undefined;
export declare function reacquireBuiltinSignature(source: Checker, producer: Checker, signature: Signature): Signature | undefined;
//# sourceMappingURL=type-normalization-builtins.d.ts.map