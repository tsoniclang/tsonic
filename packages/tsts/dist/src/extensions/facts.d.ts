import type { ExtensionEvidence, ExtensionFactSubject, ProviderWellKnownSymbolName } from "./host.js";
export { checkedCallSourceOperationEquals, checkedConversionSourceOperationEquals, checkedElementAccessSourceOperationEquals, checkedIterationSourceOperationEquals, checkedOperatorSourceOperationEquals, checkedPropertyAccessSourceOperationEquals, selectedTargetSignatureEquals, targetParameterEquals, targetTypeRefEquals, } from "./fact-value-equality.js";
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
    readonly artifactFileName?: string;
    readonly exportName?: string;
    readonly exportId?: string;
    readonly memberName?: string;
    readonly memberKey?: ProviderMemberKey;
    readonly memberId?: string;
    readonly memberStatic?: boolean;
    readonly signatureId?: string;
    readonly targetIdentity?: TargetTypeRef;
}
export type ProviderMemberKey = {
    readonly kind: "property-key";
    readonly name: string;
} | {
    readonly kind: "well-known-symbol";
    readonly name: ProviderWellKnownSymbolName;
};
export type TargetTypeRef = {
    readonly kind: "source-primitive";
    readonly name: SourcePrimitiveKind;
} | {
    readonly kind: "source-global";
    readonly name: string;
    readonly typeArguments?: readonly TargetTypeRef[];
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
    readonly payloadId?: string;
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
    readonly payloadId?: string;
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
export interface SourceSelectedMethodTypeArgument {
    readonly typeParameterName: string;
    readonly typeParameter?: ExtensionFactSubject;
    readonly selectedType: ExtensionFactSubject;
    readonly explicitTypeNode?: ExtensionFactSubject;
}
export type CheckedCallKind = "call" | "construct";
export type CheckedSourceChainParticipant = "call" | "property-access" | "element-access";
type CheckedOrdinarySourceChainRole<TParticipant extends CheckedSourceChainParticipant> = {
    readonly kind: "ordinary";
    readonly participant: TParticipant;
    readonly position?: never;
    readonly boundary?: never;
};
type CheckedOptionalSourceChainRole<TParticipant extends CheckedSourceChainParticipant> = {
    readonly kind: "optional-chain";
    readonly participant: TParticipant;
    readonly position: "root" | "continuation";
    readonly boundary: "nested" | "outermost";
};
export type CheckedSourceChainRole<TParticipant extends CheckedSourceChainParticipant = CheckedSourceChainParticipant> = CheckedOrdinarySourceChainRole<TParticipant> | CheckedOptionalSourceChainRole<TParticipant>;
export interface SourceSelectedSignatureParameter {
    readonly parameterIndex: number;
    readonly parameterName: string;
    readonly parameterSymbol: ExtensionFactSubject;
    readonly parameterDeclaration?: ExtensionFactSubject;
    readonly selectedType: ExtensionFactSubject;
    readonly authoredTypeNode?: ExtensionFactSubject;
    readonly acceptsOmission: boolean;
    readonly rest: boolean;
}
export interface SourceSelectedCallArgumentBinding {
    readonly sourceArgumentIndex: number;
    readonly effectiveArgumentIndex: number;
    readonly sourceForm: "value" | "spread-element" | "spread-sequence";
    readonly spreadElementIndex?: number;
    readonly sourceParameterIndex: number;
    readonly sourceParameterForm: "parameter" | "rest-element" | "rest-sequence";
    readonly selectedArgumentType: ExtensionFactSubject;
    readonly selectedParameterType: ExtensionFactSubject;
}
export type SourceSelectedCallEvidence = {
    readonly kind: "applicable";
    readonly signature: ExtensionFactSubject;
    readonly declaration?: ExtensionFactSubject;
    readonly methodTypeArguments: readonly SourceSelectedMethodTypeArgument[];
    readonly parameters: readonly SourceSelectedSignatureParameter[];
    readonly argumentBindings: readonly SourceSelectedCallArgumentBinding[];
} | {
    readonly kind: "untyped";
    readonly signature?: never;
    readonly declaration?: never;
    readonly methodTypeArguments?: never;
    readonly parameters?: never;
    readonly argumentBindings?: never;
};
export interface SelectedSourceTypeEvidence {
    readonly type: ExtensionFactSubject;
    readonly symbol?: ExtensionFactSubject;
    readonly declaration?: ExtensionFactSubject;
    readonly selectedSymbol?: ExtensionFactSubject;
    readonly selectedDeclaration?: ExtensionFactSubject;
    readonly authoredTypeNode?: ExtensionFactSubject;
}
export interface SelectedSourceValueEvidence extends SelectedSourceTypeEvidence {
    readonly expression: ExtensionFactSubject;
}
export interface CheckedCallSourceOperation {
    readonly sourceOperationKind: "call";
    readonly call: ExtensionFactSubject;
    readonly callee: ExtensionFactSubject;
    readonly arguments: readonly ExtensionFactSubject[];
    readonly callKind: CheckedCallKind;
    readonly sourceSelection: SourceSelectedCallEvidence;
    readonly sourceCallee: SelectedSourceValueEvidence;
    readonly sourceArguments: readonly SelectedSourceValueEvidence[];
    readonly sourceResult: SelectedSourceValueEvidence;
    readonly sourceReceiver?: SelectedSourceValueEvidence;
    readonly chainRole: CheckedSourceChainRole<"call">;
}
interface CheckedAccessSourceOperationBase {
    readonly sourceReceiver: SelectedSourceValueEvidence;
}
export type CheckedAccessSourceEvidence<TParticipant extends "property-access" | "element-access" = "property-access" | "element-access"> = {
    readonly accessMode: "read";
    readonly use: "value" | "call-callee";
    readonly sourceReadResult: SelectedSourceValueEvidence;
    readonly sourceWriteType?: never;
    readonly chainRole: CheckedSourceChainRole<TParticipant>;
} | {
    readonly accessMode: "delete";
    readonly use: "value";
    readonly sourceReadResult: SelectedSourceValueEvidence;
    readonly sourceWriteType?: never;
    readonly chainRole: CheckedSourceChainRole<TParticipant>;
} | {
    readonly accessMode: "write";
    readonly use: "value";
    readonly sourceReadResult?: never;
    readonly sourceWriteType: SelectedSourceTypeEvidence;
    readonly chainRole: CheckedOrdinarySourceChainRole<TParticipant>;
} | {
    readonly accessMode: "read-write";
    readonly use: "value";
    readonly sourceReadResult: SelectedSourceValueEvidence;
    readonly sourceWriteType: SelectedSourceTypeEvidence;
    readonly chainRole: CheckedOrdinarySourceChainRole<TParticipant>;
};
interface CheckedPropertyAccessSourceOperationBase extends CheckedAccessSourceOperationBase {
    readonly sourceOperationKind: "property-access";
    readonly expression: ExtensionFactSubject;
    readonly receiver: ExtensionFactSubject;
    readonly propertyName: string;
}
export type CheckedPropertyAccessSourceOperation = CheckedPropertyAccessSourceOperationBase & CheckedAccessSourceEvidence<"property-access">;
interface CheckedElementAccessSourceOperationBase extends CheckedAccessSourceOperationBase {
    readonly sourceOperationKind: "element-access";
    readonly expression: ExtensionFactSubject;
    readonly receiver: ExtensionFactSubject;
    readonly argument: ExtensionFactSubject;
    readonly sourceArgument: SelectedSourceValueEvidence;
    readonly sourceSelectedElementIndex?: number;
}
export type CheckedElementAccessSourceOperation = CheckedElementAccessSourceOperationBase & CheckedAccessSourceEvidence<"element-access">;
export type CheckedPrefixUnaryOperatorToken = "+" | "-" | "~" | "!" | "typeof" | "void" | "delete";
export type CheckedUpdateOperatorToken = "++" | "--";
export type CheckedBinaryOperatorToken = "**" | "*" | "/" | "%" | "+" | "-" | "<<" | ">>" | ">>>" | "<" | ">" | "<=" | ">=" | "instanceof" | "in" | "==" | "!=" | "===" | "!==" | "&" | "^" | "|" | "&&" | "||" | "??" | "=" | "+=" | "-=" | "*=" | "**=" | "/=" | "%=" | "<<=" | ">>=" | ">>>=" | "&=" | "^=" | "|=" | "&&=" | "||=" | "??=" | ",";
interface CheckedOperatorSourceOperationBase {
    readonly sourceOperationKind: "operator";
    readonly expression: ExtensionFactSubject;
    readonly sourceResult: SelectedSourceValueEvidence;
}
export type CheckedOperatorSourceOperation = CheckedOperatorSourceOperationBase & {
    readonly operatorKind: "prefix-unary";
    readonly operator: CheckedPrefixUnaryOperatorToken;
    readonly operand: ExtensionFactSubject;
    readonly sourceOperand: SelectedSourceValueEvidence;
    readonly left?: never;
    readonly right?: never;
    readonly sourceLeft?: never;
    readonly sourceRight?: never;
} | CheckedOperatorSourceOperationBase & {
    readonly operatorKind: "prefix-update";
    readonly operator: CheckedUpdateOperatorToken;
    readonly operand: ExtensionFactSubject;
    readonly sourceOperand: SelectedSourceValueEvidence;
    readonly left?: never;
    readonly right?: never;
    readonly sourceLeft?: never;
    readonly sourceRight?: never;
} | CheckedOperatorSourceOperationBase & {
    readonly operatorKind: "postfix-update";
    readonly operator: CheckedUpdateOperatorToken;
    readonly operand: ExtensionFactSubject;
    readonly sourceOperand: SelectedSourceValueEvidence;
    readonly left?: never;
    readonly right?: never;
    readonly sourceLeft?: never;
    readonly sourceRight?: never;
} | CheckedOperatorSourceOperationBase & {
    readonly operatorKind: "binary";
    readonly operator: CheckedBinaryOperatorToken;
    readonly left: ExtensionFactSubject;
    readonly right: ExtensionFactSubject;
    readonly sourceLeft: SelectedSourceValueEvidence;
    readonly sourceRight: SelectedSourceValueEvidence;
    readonly operand?: never;
    readonly sourceOperand?: never;
};
export interface SelectedSourceIterationProtocolMemberEvidence {
    readonly symbol: ExtensionFactSubject;
    readonly valueDeclaration?: ExtensionFactSubject;
    readonly declarations: readonly ExtensionFactSubject[];
    readonly type: ExtensionFactSubject;
}
export interface SelectedSourceIterationTypes {
    readonly yieldType?: SelectedSourceTypeEvidence;
    readonly returnType?: SelectedSourceTypeEvidence;
    readonly nextType?: SelectedSourceTypeEvidence;
}
interface SelectedSourceIterationProtocolEvidenceBase {
    readonly iterationTypes: SelectedSourceIterationTypes;
}
export type SelectedSourceIterationProtocolEvidence = SelectedSourceIterationProtocolEvidenceBase & {
    readonly resolutionKind: "known-iterable-instantiation";
    readonly iterableTarget: SelectedSourceTypeEvidence;
    readonly iterableDeclarations: readonly ExtensionFactSubject[];
} | SelectedSourceIterationProtocolEvidenceBase & {
    readonly resolutionKind: "selected-iterator-member";
    readonly iteratorMethod: SelectedSourceIterationProtocolMemberEvidence;
    readonly iteratorType: SelectedSourceTypeEvidence;
};
export type CheckedForOfAtomicIterationMechanism = {
    readonly kind: "synchronous-iterator-protocol";
    readonly sourceAlternative: SelectedSourceTypeEvidence;
    readonly protocol: SelectedSourceIterationProtocolEvidence;
} | {
    readonly kind: "array-like-index";
    readonly sourceAlternative: SelectedSourceTypeEvidence;
    readonly selectedIndex: SelectedSourceTypeEvidence;
} | {
    readonly kind: "string-code-unit-index";
    readonly sourceAlternative: SelectedSourceTypeEvidence;
} | {
    readonly kind: "untyped-dynamic-iteration";
    readonly sourceAlternative: SelectedSourceTypeEvidence;
};
export type CheckedForOfIterationMechanism = CheckedForOfAtomicIterationMechanism | {
    readonly kind: "union";
    readonly alternatives: readonly [CheckedForOfAtomicIterationMechanism, ...CheckedForOfAtomicIterationMechanism[]];
};
export type CheckedForAwaitOfAtomicIterationMechanism = {
    readonly kind: "asynchronous-iterator-protocol";
    readonly sourceAlternative: SelectedSourceTypeEvidence;
    readonly protocol: SelectedSourceIterationProtocolEvidence;
} | {
    readonly kind: "synchronous-iterator-adapted-to-async";
    readonly sourceAlternative: SelectedSourceTypeEvidence;
    readonly protocol: SelectedSourceIterationProtocolEvidence;
} | {
    readonly kind: "array-like-index-adapted-to-async";
    readonly sourceAlternative: SelectedSourceTypeEvidence;
    readonly selectedIndex: SelectedSourceTypeEvidence;
} | {
    readonly kind: "string-code-unit-index-adapted-to-async";
    readonly sourceAlternative: SelectedSourceTypeEvidence;
} | {
    readonly kind: "untyped-dynamic-iteration";
    readonly sourceAlternative: SelectedSourceTypeEvidence;
};
export type CheckedForAwaitOfIterationMechanism = CheckedForAwaitOfAtomicIterationMechanism | {
    readonly kind: "union";
    readonly alternatives: readonly [CheckedForAwaitOfAtomicIterationMechanism, ...CheckedForAwaitOfAtomicIterationMechanism[]];
};
interface CheckedIterationSourceOperationBase {
    readonly sourceOperationKind: "iteration";
    readonly statement: ExtensionFactSubject;
    readonly expression: ExtensionFactSubject;
    readonly initializer?: ExtensionFactSubject;
    readonly sourceIterable: SelectedSourceValueEvidence;
    readonly sourceElement: SelectedSourceTypeEvidence;
}
export type CheckedIterationSourceOperation = CheckedIterationSourceOperationBase & {
    readonly iterationKind: "for-in";
    readonly mechanism: {
        readonly kind: "property-key-enumeration";
    };
} | CheckedIterationSourceOperationBase & {
    readonly iterationKind: "for-of";
    readonly mechanism: CheckedForOfIterationMechanism;
} | CheckedIterationSourceOperationBase & {
    readonly iterationKind: "for-await-of";
    readonly mechanism: CheckedForAwaitOfIterationMechanism;
};
export interface TargetSignatureSelection {
    readonly member: TargetMember;
    readonly targetTypeArguments?: readonly TargetTypeRef[];
    readonly providerDeclaration?: ProviderDeclarationIdentity;
}
export interface TargetCallArgumentConversionSlot {
    readonly sourceArgumentIndex: number;
    readonly sourceForm: "value" | "spread-element" | "spread-sequence";
    readonly spreadElementIndex?: number;
    readonly targetParameterIndex: number;
    readonly targetForm: "parameter" | "params-element" | "params-sequence";
}
export interface SelectedTargetSignatureFact extends TargetSignatureSelection {
    readonly argumentConversions: readonly TargetCallArgumentConversionSlot[];
    readonly sourceCallKind: CheckedCallKind;
    readonly sourceSelection: SourceSelectedCallEvidence;
    readonly sourceCallee: SelectedSourceValueEvidence;
    readonly sourceArguments: readonly SelectedSourceValueEvidence[];
    readonly sourceResult: SelectedSourceValueEvidence;
    readonly sourceReceiver?: SelectedSourceValueEvidence;
    readonly sourceChainRole: CheckedSourceChainRole<"call">;
}
export interface ContextualTargetTypeFact {
    readonly type: ExtensionFactSubject;
    readonly targetType?: TargetTypeRef;
}
export interface TargetOperationProposal {
    readonly operationId: string;
    readonly operationKind: "property" | "method" | "indexer" | "operator" | "constructor" | "iteration";
    readonly targetOperation: string;
    readonly evidence?: readonly ExtensionEvidence[];
}
export interface CheckedAssertionConversionSourceOperation {
    readonly sourceOperationKind: "conversion";
    readonly conversionKind: "assertion";
    readonly expression: ExtensionFactSubject;
    readonly source: SelectedSourceValueEvidence;
    readonly target: SelectedSourceTypeEvidence;
    readonly assertionKind: "as" | "angle-bracket" | "jsdoc";
    readonly explicitTargetTypeNode: ExtensionFactSubject;
    readonly call?: never;
    readonly slot?: never;
    readonly sourceBinding?: never;
}
export interface CheckedCallArgumentConversionSourceOperation {
    readonly sourceOperationKind: "conversion";
    readonly conversionKind: "call-argument";
    readonly expression: ExtensionFactSubject;
    readonly source: SelectedSourceValueEvidence;
    readonly call: ExtensionFactSubject;
    readonly slot: TargetCallArgumentConversionSlot;
    readonly sourceBinding: SourceSelectedCallArgumentBinding;
    readonly sourceArgumentIndex?: never;
    readonly effectiveArgumentIndex?: never;
    readonly sourceForm?: never;
    readonly spreadElementIndex?: never;
    readonly targetParameterIndex?: never;
    readonly targetForm?: never;
    readonly assertionKind?: never;
    readonly explicitTargetTypeNode?: never;
}
export type CheckedConversionSourceOperation = CheckedAssertionConversionSourceOperation | CheckedCallArgumentConversionSourceOperation;
export type TargetOperationSourceProvenance = CheckedCallSourceOperation | CheckedPropertyAccessSourceOperation | CheckedElementAccessSourceOperation | CheckedOperatorSourceOperation | CheckedIterationSourceOperation | CheckedConversionSourceOperation;
export interface TargetOperationProvenance {
    readonly providerDeclaration?: ProviderDeclarationIdentity;
    readonly sourceOperation: TargetOperationSourceProvenance;
}
export interface TargetOperationFact extends TargetOperationProposal {
    readonly resultType?: TargetTypeRef;
    readonly provenance: TargetOperationProvenance;
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
export interface TargetCallArgumentConversionFact extends TargetConversionFact {
    readonly slot: TargetCallArgumentConversionSlot;
    readonly call: ExtensionFactSubject;
    readonly sourceBinding: SourceSelectedCallArgumentBinding;
    readonly sourceArgumentIndex?: never;
    readonly effectiveArgumentIndex?: never;
    readonly sourceForm?: never;
    readonly spreadElementIndex?: never;
    readonly targetParameterIndex?: never;
    readonly targetForm?: never;
}
export interface TargetCallArgumentPassingFact extends ArgumentPassingFact {
    readonly slot: TargetCallArgumentConversionSlot;
    readonly call: ExtensionFactSubject;
    readonly sourceBinding: SourceSelectedCallArgumentBinding;
    readonly targetParameter: TargetParameter;
    readonly selectedSignature?: ProviderDeclarationIdentity;
    readonly sourceArgumentIndex?: never;
    readonly effectiveArgumentIndex?: never;
    readonly sourceForm?: never;
    readonly spreadElementIndex?: never;
    readonly targetParameterIndex?: never;
    readonly targetForm?: never;
}
export interface ProviderVirtualDeclarationFact {
    readonly providerId: string;
    readonly providerVersion: string;
    readonly providerModuleId: string;
    readonly moduleSpecifier: string;
    readonly artifactFileName: string;
    readonly exportName?: string;
    readonly exportId?: string;
    readonly memberName?: string;
    readonly memberKey?: ProviderMemberKey;
    readonly memberId?: string;
    readonly memberStatic?: boolean;
    readonly signatureId?: string;
    readonly targetIdentity?: TargetTypeRef;
}
export interface ProviderTypeFamilyVariantFact {
    readonly sourceTypeArgumentCount: number;
    readonly declaration: ProviderVirtualDeclarationFact;
    readonly targetBinding?: TargetBindingFact;
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
export declare const argumentPassingFactKey: import("./fact-key.js").ExtensionFactKey<ArgumentPassingFact>;
export declare const functionPointerFactKey: import("./fact-key.js").ExtensionFactKey<FunctionPointerFact>;
export declare const pointerFactKey: import("./fact-key.js").ExtensionFactKey<PointerFact>;
export declare const structFactKey: import("./fact-key.js").ExtensionFactKey<StructFact>;
export declare const fieldFactKey: import("./fact-key.js").ExtensionFactKey<FieldFact>;
export declare const attributeFactKey: import("./fact-key.js").ExtensionFactKey<AttributeFact>;
export declare const defaultValueFactKey: import("./fact-key.js").ExtensionFactKey<DefaultValueFact>;
export declare const targetBindingFactKey: import("./fact-key.js").ExtensionFactKey<TargetBindingFact>;
export declare const instantiatedTargetTypeFactKey: import("./fact-key.js").ExtensionFactKey<InstantiatedTargetTypeFact>;
export declare const selectedTargetSignatureFactKey: import("./fact-key.js").ExtensionFactKey<SelectedTargetSignatureFact>;
export declare const contextualTargetTypeFactKey: import("./fact-key.js").ExtensionFactKey<ContextualTargetTypeFact>;
export declare const targetOperationFactKey: import("./fact-key.js").ExtensionFactKey<TargetOperationFact>;
export declare const flowStateFactKey: import("./fact-key.js").ExtensionFactKey<FlowStateFact>;
export declare const runtimeCarrierFactKey: import("./fact-key.js").ExtensionFactKey<RuntimeCarrierFact>;
export declare const targetConversionFactKey: import("./fact-key.js").ExtensionFactKey<TargetConversionFact>;
export declare const targetCallArgumentConversionFactKey: import("./fact-key.js").ExtensionFactKey<TargetCallArgumentConversionFact>;
export declare const targetCallArgumentPassingFactKey: import("./fact-key.js").ExtensionFactKey<TargetCallArgumentPassingFact>;
export declare const providerVirtualDeclarationFactKey: import("./fact-key.js").ExtensionFactKey<ProviderVirtualDeclarationFact>;
export declare const providerTypeFamilyFactKey: import("./fact-key.js").ExtensionFactKey<ProviderTypeFamilyFact>;
export declare const associatedTypeFactKey: import("./fact-key.js").ExtensionFactKey<AssociatedTypeFact>;
export declare const constGenericFactKey: import("./fact-key.js").ExtensionFactKey<ConstGenericFact>;
export declare function targetOperationFactEquals(left: TargetOperationFact, right: TargetOperationFact): boolean;
//# sourceMappingURL=facts.d.ts.map