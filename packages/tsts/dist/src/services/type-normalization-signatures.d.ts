import type { Checker } from "../internal/checker/checker/state.js";
import type { GoPtr } from "../go/compat.js";
import type { Signature, Type } from "../internal/checker/types.js";
export type CachedSignatureConstruction = "erased" | "canonical" | "base" | "inner-call" | "outer-call";
export declare function reacquireHigherOrderSignature(source: Checker, producer: Checker, signature: Signature, normalize: (signature: Signature) => Signature): Signature | undefined;
export declare function reacquireMemberSignature(source: Checker, producer: Checker, signature: Signature, normalize: (type: Type) => Type): Signature | undefined;
export declare function reacquireCompositeSignature(source: Checker, producer: Checker, signature: Signature, normalizeType: (type: Type) => Type, normalizeSignature: (signature: Signature) => Signature): Signature | undefined;
export declare function cachedSignatureArguments(source: Checker, signature: Signature): readonly GoPtr<Type>[] | undefined;
export declare function reacquireSignatureInstantiation(producer: Checker, signature: Signature, arguments_: Type[]): Signature;
export declare function reacquireSignatureType(producer: Checker, type: Type, normalize: (signature: Signature) => Signature): Type | undefined;
export declare function cachedSignatureConstruction(source: Checker, signature: Signature): CachedSignatureConstruction | undefined;
export declare function reacquireCachedSignature(producer: Checker, construction: CachedSignatureConstruction, signature: Signature): Signature;
//# sourceMappingURL=type-normalization-signatures.d.ts.map