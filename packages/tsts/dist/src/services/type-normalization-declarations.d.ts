import type { Checker } from "../internal/checker/checker/state.js";
import type { Symbol as NativeSymbol } from "../internal/ast/symbol.js";
import type { Node } from "../internal/ast/spine.js";
import type { Signature, Type } from "../internal/checker/types.js";
export declare function reacquireDeclarationSignature(source: Checker, producer: Checker, signature: Signature): Signature | undefined;
export declare function reacquireDeclaredType(producer: Checker, type: Type): Type | undefined;
export declare function cachedLateBoundSymbolDeclaration(source: Checker, symbol: NativeSymbol): Node | undefined;
export declare function reacquireCachedLateBoundSymbol(source: Checker, producer: Checker, symbol: NativeSymbol): NativeSymbol | undefined;
export declare function hasCachedValueTypeKind(type: Type): boolean;
export declare function cachedValueTypeSymbol(source: Checker, type: Type): NativeSymbol | undefined;
export declare function reacquireCachedValueType(producer: Checker, type: Type): Type | undefined;
export declare function reacquireTypeReference(producer: Checker, type: Type, normalize: (type: Type) => Type): Type | undefined;
export declare function reacquireTypeAlias(producer: Checker, type: Type, normalize: (type: Type) => Type): Type | undefined;
export declare function reacquireRestrictiveParameter(producer: Checker, type: Type, normalize: (type: Type) => Type): Type | undefined;
export declare function reacquireMappedParameter(producer: Checker, type: Type, normalize: (type: Type) => Type): Type | undefined;
export declare function reacquireCachedTypeNode(producer: Checker, type: Type): Type | undefined;
export declare function reacquireAnonymousInstantiation(producer: Checker, type: Type, normalize: (type: Type) => Type): Type | undefined;
//# sourceMappingURL=type-normalization-declarations.d.ts.map