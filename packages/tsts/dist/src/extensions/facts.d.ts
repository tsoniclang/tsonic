import type { ExtensionFactSubject } from "./host.js";
import { type ProviderWellKnownSymbolName } from "./provider-well-known-symbols.js";
import type { Node } from "../internal/ast/ast.js";
import type { ResolvedCallEvidence } from "../internal/checker/selected-call-contracts.js";
import type { Type } from "../internal/checker/types.js";
import { type ArgumentPassingMode } from "./argument-passing.js";
export type { ArgumentPassingMode } from "./argument-passing.js";
export type ExtensionCanonicalIdentityKind = "module" | "package" | "export" | "local-alias" | "symbol" | "type" | "signature" | "instantiated-type";
export type ExtensionImportKind = "type" | "value" | "namespace" | "unknown";
export type SourcePrimitiveKind = "bool" | "char" | "int8" | "uint8" | "int16" | "uint16" | "int32" | "uint32" | "int64" | "uint64" | "native-int" | "native-uint" | "float16" | "float32" | "float64" | "decimal" | "int128" | "uint128";
export interface ExtensionCanonicalIdentity {
    readonly kind: ExtensionCanonicalIdentityKind;
    readonly id: string;
    readonly packageName?: string;
    readonly packageVersion?: string;
    readonly subpath?: string;
    readonly exportName?: string;
    readonly importKind?: ExtensionImportKind;
    readonly canonicalSymbolId?: string;
}
export type SourcePointerMutability = "readonly" | "readwrite" | "unspecified";
export type SourceCallMarkerKind = "write-only-reference" | "read-write-reference" | "read-only-reference" | "shared-borrow" | "mutable-borrow" | "move" | "struct" | "field" | "attribute" | "default-value" | "address-of" | "allocate" | "load" | "store" | "equal-pointer" | "hash-pointer" | "bind-pointer" | "project-pointer" | "bind-raw-pointer" | "equal-raw-pointer" | "hash-raw-pointer" | "js-string";
export type SourceTypeMarkerKind = "pointer" | "function-pointer" | "raw-pointer" | "fixed-array" | "js-string";
export type SourceMarkerFact = {
    readonly kind: "call-marker";
    readonly marker: SourceCallMarkerKind;
} | {
    readonly kind: "type-marker";
    readonly marker: SourceTypeMarkerKind;
};
export interface SourcePrimitiveFact {
    readonly kind: SourcePrimitiveKind;
    readonly signed?: boolean;
    readonly width?: number;
    readonly runtimeBase: "boolean" | "number" | "bigint" | "string" | "object";
}
export type ArgumentPassingFact = {
    readonly role: "declaration";
    readonly mode: ArgumentPassingMode;
} | {
    readonly role: "argument";
    readonly mode: ArgumentPassingMode;
    readonly storageExpression: Node;
};
export interface FunctionPointerFact {
    readonly parameters: readonly Node[];
    readonly result: Node;
    readonly abi: readonly string[];
}
export interface PointerFact {
    readonly pointee: Node;
    readonly mutability: SourcePointerMutability;
}
export interface RawPointerFact {
    readonly representation: "opaque-identity";
}
export interface PointerOperationFact {
    readonly operation: "address-of" | "allocate" | "load" | "store" | "equal-pointer" | "hash-pointer" | "bind-pointer" | "project-pointer";
    readonly exportName: string;
    readonly call: Node;
    readonly arguments: readonly Node[];
    readonly typeArguments: readonly Node[];
    readonly selection: {
        readonly kind: "observed";
        readonly value: ResolvedCallEvidence;
    } | {
        readonly kind: "unavailable";
        readonly reason: "unvisited";
    };
    readonly pointee: {
        readonly kind: "available";
        readonly type: Type;
        readonly explicitTypeNode: Node | undefined;
    } | {
        readonly kind: "unavailable";
        readonly reason: "unvisited" | "not-applicable" | "missing";
    };
}
interface RawPointerOperationFactBase {
    readonly call: Node;
    readonly resultType: Type;
}
export type RawPointerOperationFact = RawPointerOperationFactBase & ({
    readonly operation: "bind-raw-pointer";
    readonly identityExpression: Node;
    readonly identityType: Type;
} | {
    readonly operation: "equal-raw-pointer";
    readonly leftExpression: Node;
    readonly leftType: Type;
    readonly rightExpression: Node;
    readonly rightType: Type;
} | {
    readonly operation: "hash-raw-pointer";
    readonly pointerExpression: Node;
    readonly pointerType: Type;
});
export interface StructFact {
    readonly valueType: boolean;
    readonly fields?: readonly FieldFact[];
}
export interface FieldFact {
    readonly name: string;
    readonly type: Node;
    readonly readonly?: boolean;
}
export interface AttributeFact {
    readonly target: Node;
    readonly attributeName: string;
    readonly arguments?: readonly Node[];
}
export interface DefaultValueFact {
    readonly type: Node;
}
export interface FlowStateFact {
    readonly state: "moved" | "borrowed-shared" | "borrowed-mut";
}
export interface ProviderDeclarationIdentity {
    readonly providerId: string;
    readonly providerVersion?: string;
    readonly providerModuleId: string;
    readonly moduleSpecifier: string;
    readonly artifactFileName?: string;
    readonly exportName?: string;
    readonly exportId?: string;
    readonly memberName?: string;
    readonly memberKey?: ProviderMemberKey;
    readonly memberId?: string;
    readonly memberStatic?: boolean;
    readonly signatureId?: string;
}
export type ProviderMemberKey = {
    readonly kind: "property-key";
    readonly name: string;
} | {
    readonly kind: "well-known-symbol";
    readonly name: ProviderWellKnownSymbolName;
};
export interface ProviderVirtualDeclarationFact extends ProviderDeclarationIdentity {
    readonly providerVersion: string;
    readonly artifactFileName: string;
}
export interface ProviderTypeFamilyVariantFact {
    readonly sourceTypeArgumentCount: number;
    readonly declaration: ProviderVirtualDeclarationFact;
}
export interface ProviderTypeFamilyFact {
    readonly exportName: string;
    readonly variants: readonly ProviderTypeFamilyVariantFact[];
}
export interface AssociatedTypeFact {
    readonly owner: ExtensionFactSubject;
    readonly name: string;
    readonly value: ExtensionFactSubject;
}
export interface ConstGenericFact {
    readonly name: string;
    readonly value: string | number | bigint | boolean;
}
export declare const canonicalIdentityFactKey: import("./fact-key.js").ExtensionFactKey<ExtensionCanonicalIdentity>;
export declare const sourcePrimitiveFactKey: import("./fact-key.js").ExtensionFactKey<SourcePrimitiveFact>;
export declare const sourceMarkerFactKey: import("./fact-key.js").ExtensionFactKey<SourceMarkerFact>;
export declare const argumentPassingFactKey: import("./fact-key.js").ExtensionFactKey<ArgumentPassingFact>;
export declare const functionPointerFactKey: import("./fact-key.js").ExtensionFactKey<FunctionPointerFact>;
export declare const pointerFactKey: import("./fact-key.js").ExtensionFactKey<PointerFact>;
export declare const pointerOperationFactKey: import("./fact-key.js").ExtensionFactKey<PointerOperationFact>;
export declare const rawPointerFactKey: import("./fact-key.js").ExtensionFactKey<RawPointerFact>;
export declare const rawPointerOperationFactKey: import("./fact-key.js").ExtensionFactKey<RawPointerOperationFact>;
export declare const structFactKey: import("./fact-key.js").ExtensionFactKey<StructFact>;
export declare const fieldFactKey: import("./fact-key.js").ExtensionFactKey<FieldFact>;
export declare const attributeFactKey: import("./fact-key.js").ExtensionFactKey<AttributeFact>;
export declare const defaultValueFactKey: import("./fact-key.js").ExtensionFactKey<DefaultValueFact>;
export declare const flowStateFactKey: import("./fact-key.js").ExtensionFactKey<FlowStateFact>;
export declare const providerVirtualDeclarationFactKey: import("./fact-key.js").ExtensionFactKey<ProviderVirtualDeclarationFact>;
export declare const providerTypeFamilyFactKey: import("./fact-key.js").ExtensionFactKey<ProviderTypeFamilyFact>;
export declare const associatedTypeFactKey: import("./fact-key.js").ExtensionFactKey<AssociatedTypeFact>;
export declare const constGenericFactKey: import("./fact-key.js").ExtensionFactKey<ConstGenericFact>;
//# sourceMappingURL=facts.d.ts.map