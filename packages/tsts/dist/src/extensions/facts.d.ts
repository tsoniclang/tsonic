import type { ExtensionEvidence, ExtensionFactSubject } from "./host.js";
export type { ArgumentPassingMode } from "./argument-passing.js";
import type { ArgumentPassingMode } from "./argument-passing.js";
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
export type SourcePointerMutability = "readonly" | "readwrite" | "target-defined";
export interface SourcePrimitiveFact {
    readonly kind: SourcePrimitiveKind;
    readonly signed?: boolean;
    readonly width?: number;
    readonly runtimeBase: "boolean" | "number" | "bigint" | "string" | "object";
}
export interface ArgumentPassingFact {
    readonly mode: ArgumentPassingMode;
    readonly targetExpression?: ExtensionFactSubject;
    readonly parameterIndex?: number;
    readonly targetParameter?: TargetParameter;
    readonly selectedSignature?: ProviderDeclarationIdentity;
}
export interface FunctionPointerFact {
    readonly parameters: readonly ExtensionFactSubject[];
    readonly result: ExtensionFactSubject;
    readonly abi: readonly string[];
}
export interface PointerFact {
    readonly pointee: ExtensionFactSubject;
    readonly mutability: SourcePointerMutability;
    readonly unsafeRequired: boolean;
}
export interface StructFact {
    readonly valueType: boolean;
    readonly fields?: readonly FieldFact[];
}
export interface FieldFact {
    readonly name: string;
    readonly type: ExtensionFactSubject;
    readonly readonly?: boolean;
}
export interface AttributeFact {
    readonly target: ExtensionFactSubject;
    readonly attributeName: string;
    readonly arguments?: readonly ExtensionFactSubject[];
}
export interface DefaultValueFact {
    readonly type: ExtensionFactSubject;
}
export interface ProviderDeclarationIdentity {
    readonly providerId: string;
    readonly providerVersion?: string;
    readonly providerModuleId: string;
    readonly moduleSpecifier: string;
    readonly virtualFileName?: string;
    readonly exportName?: string;
    readonly exportId?: string;
    readonly memberName?: string;
    readonly memberId?: string;
    readonly signatureId?: string;
    readonly targetIdentity?: TargetTypeRef;
}
export type TargetTypeRef = {
    readonly kind: "source-primitive";
    readonly name: SourcePrimitiveKind;
} | {
    readonly kind: "target-named";
    readonly id: string;
    readonly typeArguments?: readonly TargetTypeRef[];
} | {
    readonly kind: "type-parameter";
    readonly name: string;
} | {
    readonly kind: "array";
    readonly element: TargetTypeRef;
    readonly rank?: number;
} | {
    readonly kind: "tuple";
    readonly elements: readonly TargetTypeRef[];
} | {
    readonly kind: "pointer";
    readonly pointee: TargetTypeRef;
    readonly mutability?: "const" | "mut" | "target-defined";
} | {
    readonly kind: "function-pointer";
    readonly args: readonly TargetTypeRef[];
    readonly result: TargetTypeRef;
    readonly abi?: readonly string[];
} | {
    readonly kind: "opaque";
    readonly id: string;
} | {
    readonly kind: "associated-type";
    readonly owner: TargetTypeRef;
    readonly name: string;
} | {
    readonly kind: "lifetime";
    readonly name: string;
} | {
    readonly kind: "target-specific";
    readonly target: string;
    readonly name: string;
    readonly value?: unknown;
};
export type TargetConstraint = {
    readonly kind: "implements";
    readonly contract: string;
    readonly typeArguments?: readonly TargetTypeRef[];
} | {
    readonly kind: "value-type";
} | {
    readonly kind: "reference-type";
} | {
    readonly kind: "constructible";
} | {
    readonly kind: "unmanaged";
} | {
    readonly kind: "copy";
} | {
    readonly kind: "clone";
} | {
    readonly kind: "default";
} | {
    readonly kind: "sized";
} | {
    readonly kind: "lifetime";
    readonly name: string;
} | {
    readonly kind: "target-specific";
    readonly target: string;
    readonly name: string;
    readonly value?: unknown;
};
export interface TargetTypeParameter {
    readonly name: string;
    readonly constraints?: readonly TargetConstraint[];
    readonly variance?: "in" | "out" | "invariant" | "target-defined";
}
export interface TargetParameter {
    readonly name: string;
    readonly type: TargetTypeRef;
    readonly passingMode: ArgumentPassingMode;
    readonly optional?: boolean;
    readonly paramsArray?: boolean;
}
export interface TargetMember {
    readonly id: string;
    readonly sourceName: string;
    readonly targetName: string;
    readonly kind: "method" | "constructor" | "property" | "field" | "indexer" | "event" | "operator";
    readonly static?: boolean;
    readonly parameters: readonly TargetParameter[];
    readonly returnType?: TargetTypeRef;
    readonly typeParameters?: readonly TargetTypeParameter[];
    readonly overloadGroup?: string;
    readonly providerDeclaration?: ProviderDeclarationIdentity;
}
export interface TargetBindingFact {
    readonly id: string;
    readonly sourceName: string;
    readonly targetName: string;
    readonly target: string;
    readonly kind: "class" | "struct" | "interface" | "trait" | "enum" | "delegate" | "function" | "opaque";
    readonly typeParameters?: readonly TargetTypeParameter[];
    readonly members?: readonly TargetMember[];
    readonly implementedContracts?: readonly TargetConstraint[];
}
export interface InstantiatedTargetTypeFact {
    readonly targetType: TargetBindingFact;
    readonly typeArguments: readonly ExtensionFactSubject[];
    readonly resolvedTypeArguments?: readonly TargetTypeRef[];
}
export interface SelectedTargetSignatureFact {
    readonly member: TargetMember;
    readonly typeArguments?: readonly ExtensionFactSubject[];
    readonly targetTypeArguments?: readonly TargetTypeRef[];
    readonly argumentConversions?: readonly TargetTypeRef[];
    readonly sourceSignature?: ExtensionFactSubject;
    readonly sourceDeclaration?: ExtensionFactSubject;
    readonly providerDeclaration?: ProviderDeclarationIdentity;
}
export interface ContextualTargetTypeFact {
    readonly type: ExtensionFactSubject;
    readonly targetType?: TargetTypeRef;
}
export interface TargetOperationFact {
    readonly operationId: string;
    readonly operationKind: "property" | "method" | "indexer" | "operator" | "constructor" | "iteration";
    readonly targetOperation: string;
    readonly resultType?: ExtensionFactSubject;
    readonly evidence?: readonly ExtensionEvidence[];
    readonly provenance?: TargetOperationProvenance;
}
export interface TargetOperationProvenance {
    readonly providerDeclaration?: ProviderDeclarationIdentity;
    readonly sourceExpression?: ExtensionFactSubject;
    readonly sourceReceiver?: ExtensionFactSubject;
    readonly sourceCallee?: ExtensionFactSubject;
    readonly sourceSelectedSymbol?: ExtensionFactSubject;
    readonly sourceSelectedSignature?: ExtensionFactSubject;
}
export interface FlowStateFact {
    readonly state: "moved" | "borrowed-shared" | "borrowed-mut" | "initialized" | "uninitialized" | "target-validation-required";
    readonly targetCompiler?: string;
    readonly evidence?: readonly ExtensionEvidence[];
}
export interface RuntimeCarrierFact {
    readonly carrier: TargetTypeRef;
    readonly requiresAllocation?: boolean;
    readonly provenance?: RuntimeCarrierProvenance;
}
export interface RuntimeCarrierProvenance {
    readonly sourceType?: ExtensionFactSubject;
    readonly sourceTypeReference?: ExtensionFactSubject;
    readonly sourceSymbol?: ExtensionFactSubject;
    readonly providerDeclaration?: ProviderDeclarationIdentity;
}
export interface TargetConversionFact {
    readonly convertedType?: TargetTypeRef;
    readonly operation?: TargetOperationFact;
}
export interface ProviderVirtualDeclarationFact {
    readonly providerId: string;
    readonly providerVersion: string;
    readonly providerModuleId: string;
    readonly moduleSpecifier: string;
    readonly virtualFileName: string;
    readonly exportName?: string;
    readonly exportId?: string;
    readonly memberName?: string;
    readonly memberId?: string;
    readonly signatureId?: string;
    readonly targetIdentity?: TargetTypeRef;
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
export declare const canonicalIdentityFactKey: import("./host.js").ExtensionFactKey<ExtensionCanonicalIdentity>;
export declare const sourcePrimitiveFactKey: import("./host.js").ExtensionFactKey<SourcePrimitiveFact>;
export declare const argumentPassingFactKey: import("./host.js").ExtensionFactKey<ArgumentPassingFact>;
export declare const functionPointerFactKey: import("./host.js").ExtensionFactKey<FunctionPointerFact>;
export declare const pointerFactKey: import("./host.js").ExtensionFactKey<PointerFact>;
export declare const structFactKey: import("./host.js").ExtensionFactKey<StructFact>;
export declare const fieldFactKey: import("./host.js").ExtensionFactKey<FieldFact>;
export declare const attributeFactKey: import("./host.js").ExtensionFactKey<AttributeFact>;
export declare const defaultValueFactKey: import("./host.js").ExtensionFactKey<DefaultValueFact>;
export declare const targetBindingFactKey: import("./host.js").ExtensionFactKey<TargetBindingFact>;
export declare const instantiatedTargetTypeFactKey: import("./host.js").ExtensionFactKey<InstantiatedTargetTypeFact>;
export declare const selectedTargetSignatureFactKey: import("./host.js").ExtensionFactKey<SelectedTargetSignatureFact>;
export declare const contextualTargetTypeFactKey: import("./host.js").ExtensionFactKey<ContextualTargetTypeFact>;
export declare const targetOperationFactKey: import("./host.js").ExtensionFactKey<TargetOperationFact>;
export declare const flowStateFactKey: import("./host.js").ExtensionFactKey<FlowStateFact>;
export declare const runtimeCarrierFactKey: import("./host.js").ExtensionFactKey<RuntimeCarrierFact>;
export declare const targetConversionFactKey: import("./host.js").ExtensionFactKey<TargetConversionFact>;
export declare const providerVirtualDeclarationFactKey: import("./host.js").ExtensionFactKey<ProviderVirtualDeclarationFact>;
export declare const associatedTypeFactKey: import("./host.js").ExtensionFactKey<AssociatedTypeFact>;
export declare const constGenericFactKey: import("./host.js").ExtensionFactKey<ConstGenericFact>;
//# sourceMappingURL=facts.d.ts.map