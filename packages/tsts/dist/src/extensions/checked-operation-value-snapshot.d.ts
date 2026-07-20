import type { CheckedCallMappingRequest, CheckedCallMappingResult, CheckedConversionMappingRequest, CheckedConversionMappingResult, CheckedElementAccessMappingRequest, CheckedIterationMappingRequest, CheckedOperationMappingResult, CheckedOperationObservationPointName, CheckedOperatorMappingRequest, CheckedPropertyAccessMappingRequest, ExtensionObservationResponse, ExtensionObservationResult } from "./observations.js";
import type { ArgumentPassingFact, AssociatedTypeFact, AttributeFact, CheckedBinaryOperatorToken, CheckedCallSourceOperation, CheckedConversionSourceOperation, CheckedElementAccessSourceOperation, CheckedForAwaitOfAtomicIterationMechanism, CheckedForAwaitOfIterationMechanism, CheckedForOfAtomicIterationMechanism, CheckedForOfIterationMechanism, CheckedIterationSourceOperation, CheckedOperatorSourceOperation, CheckedPrefixUnaryOperatorToken, CheckedPropertyAccessSourceOperation, CheckedSourceChainParticipant, CheckedSourceChainRole, CheckedUpdateOperatorToken, ConstGenericFact, ContextualTargetTypeFact, DefaultValueFact, ExtensionCanonicalIdentity, FieldFact, FlowStateFact, FunctionPointerFact, InstantiatedTargetTypeFact, PointerFact, ProviderDeclarationIdentity, ProviderMemberKey, ProviderTypeFamilyFact, ProviderVirtualDeclarationFact, RuntimeCarrierFact, SelectedSourceIterationProtocolEvidence, SelectedSourceIterationProtocolMemberEvidence, SelectedSourceIterationTypes, SelectedSourceTypeEvidence, SelectedSourceValueEvidence, SelectedTargetSignatureFact, SourcePrimitiveFact, SourceSelectedCallEvidence, SourceSelectedCallArgumentBinding, SourceSelectedMethodTypeArgument, SourceSelectedSignatureParameter, StructFact, TargetBindingFact, TargetCallArgumentConversionSlot, TargetCallArgumentConversionFact, TargetCallArgumentPassingFact, TargetConstraint, TargetConversionFact, TargetMember, TargetOperationFact, TargetOperationProposal, TargetOperationProvenance, TargetOperationSourceProvenance, TargetParameter, TargetSignatureSelection, TargetTypeParameter, TargetTypeRef } from "./facts.js";
import type { CheckedSourceAuthoredLiteralEvidence, CheckedSourceCallArgumentCompositionEvidence, CheckedSourceCallCompositionEvidence, CheckedSourceInlineFunctionEvidence, CheckedSourceInlineFunctionReturnEvidence, CheckedSourceInlinePropertyOperation, RetainedCheckedOperationRequest, RetainedCheckedSourceCallMappingRequest } from "./source-operation-producer.js";
import type { ExtensionDiagnostic, ExtensionDiagnosticSourceSpan, ExtensionEvidence, ProviderWellKnownSymbolName } from "./host.js";
type SnapshotSchemaKey<T> = {
    [TKey in keyof T]-?: [Exclude<T[TKey], undefined>] extends [never] ? never : TKey;
}[keyof T];
type AllFieldsSnapshotted<T, TFields extends SnapshotSchemaKey<T>> = Exclude<SnapshotSchemaKey<T>, TFields> extends never ? true : false;
type ExactSchemaUnion<TActual, TExpected> = Exclude<TActual, TExpected> extends never ? Exclude<TExpected, TActual> extends never ? true : false : false;
type RequireAllSnapshots<T extends readonly true[]> = T;
export type CheckedOperationSnapshotFieldCoverage = RequireAllSnapshots<[
    ExactSchemaUnion<TargetOperationSourceProvenance["sourceOperationKind"], "call" | "property-access" | "element-access" | "operator" | "iteration" | "conversion">,
    ExactSchemaUnion<CheckedCallMappingRequest["callKind"], "call" | "construct">,
    ExactSchemaUnion<CheckedPropertyAccessMappingRequest["accessMode"], "read" | "write" | "read-write" | "delete">,
    ExactSchemaUnion<CheckedPropertyAccessMappingRequest["use"], "value" | "call-callee">,
    ExactSchemaUnion<CheckedOperatorMappingRequest["operatorKind"], "prefix-unary" | "prefix-update" | "postfix-update" | "binary">,
    ExactSchemaUnion<CheckedPrefixUnaryOperatorToken, "+" | "-" | "~" | "!" | "typeof" | "void" | "delete">,
    ExactSchemaUnion<CheckedUpdateOperatorToken, "++" | "--">,
    ExactSchemaUnion<CheckedBinaryOperatorToken, "**" | "*" | "/" | "%" | "+" | "-" | "<<" | ">>" | ">>>" | "<" | ">" | "<=" | ">=" | "instanceof" | "in" | "==" | "!=" | "===" | "!==" | "&" | "^" | "|" | "&&" | "||" | "??" | "=" | "+=" | "-=" | "*=" | "**=" | "/=" | "%=" | "<<=" | ">>=" | ">>>=" | "&=" | "^=" | "|=" | "&&=" | "||=" | "??=" | ",">,
    ExactSchemaUnion<CheckedIterationMappingRequest["iterationKind"], "for-in" | "for-of" | "for-await-of">,
    ExactSchemaUnion<CheckedConversionMappingRequest["conversionKind"], "assertion" | "call-argument">,
    ExactSchemaUnion<Extract<CheckedConversionMappingRequest, {
        readonly conversionKind: "assertion";
    }>["assertionKind"], "as" | "angle-bracket" | "jsdoc">,
    ExactSchemaUnion<CheckedCallMappingResult["kind"], "source" | "target">,
    ExactSchemaUnion<CheckedForOfIterationMechanism["kind"], "synchronous-iterator-protocol" | "array-like-index" | "string-code-unit-index" | "untyped-dynamic-iteration" | "union">,
    ExactSchemaUnion<CheckedForAwaitOfIterationMechanism["kind"], "asynchronous-iterator-protocol" | "synchronous-iterator-adapted-to-async" | "array-like-index-adapted-to-async" | "string-code-unit-index-adapted-to-async" | "untyped-dynamic-iteration" | "union">,
    ExactSchemaUnion<SelectedSourceIterationProtocolEvidence["resolutionKind"], "known-iterable-instantiation" | "selected-iterator-member">,
    ExactSchemaUnion<SourceSelectedCallEvidence["kind"], "applicable" | "untyped">,
    ExactSchemaUnion<CheckedSourceChainRole["kind"], "ordinary" | "optional-chain">,
    ExactSchemaUnion<CheckedSourceChainParticipant, "call" | "property-access" | "element-access">,
    ExactSchemaUnion<Extract<CheckedSourceChainRole, {
        readonly kind: "optional-chain";
    }>["position"], "root" | "continuation">,
    ExactSchemaUnion<Extract<CheckedSourceChainRole, {
        readonly kind: "optional-chain";
    }>["boundary"], "nested" | "outermost">,
    ExactSchemaUnion<TargetOperationFact["operationKind"], "property" | "method" | "indexer" | "operator" | "constructor" | "iteration">,
    ExactSchemaUnion<TargetMember["kind"], "method" | "constructor" | "property" | "field" | "indexer" | "event" | "operator">,
    ExactSchemaUnion<TargetParameter["passingMode"], "by-value" | "byref-readonly" | "byref-readwrite" | "byref-writeonly-must-init" | "borrow-shared" | "borrow-mut" | "move">,
    ExactSchemaUnion<NonNullable<TargetTypeParameter["variance"]>, "in" | "out" | "invariant" | "target-defined">,
    ExactSchemaUnion<Extract<TargetTypeRef, {
        readonly kind: "source-primitive";
    }>["name"], "bool" | "char" | "int8" | "uint8" | "int16" | "uint16" | "int32" | "uint32" | "int64" | "uint64" | "native-int" | "native-uint" | "float16" | "float32" | "float64" | "decimal" | "int128" | "uint128">,
    ExactSchemaUnion<NonNullable<Extract<TargetTypeRef, {
        readonly kind: "pointer";
    }>["mutability"]>, "const" | "mut" | "target-defined">,
    ExactSchemaUnion<ProviderWellKnownSymbolName, "asyncIterator" | "hasInstance" | "isConcatSpreadable" | "iterator" | "match" | "matchAll" | "replace" | "search" | "species" | "split" | "toPrimitive" | "toStringTag" | "unscopables">,
    ExactSchemaUnion<ProviderMemberKey["kind"], "property-key" | "well-known-symbol">,
    ExactSchemaUnion<TargetCallArgumentConversionSlot["sourceForm"], "value" | "spread-element" | "spread-sequence">,
    ExactSchemaUnion<TargetCallArgumentConversionSlot["targetForm"], "parameter" | "params-element" | "params-sequence">,
    ExactSchemaUnion<SourceSelectedCallArgumentBinding["sourceParameterForm"], "parameter" | "rest-element" | "rest-sequence">,
    ExactSchemaUnion<TargetTypeRef["kind"], "source-primitive" | "source-global" | "target-named" | "type-parameter" | "array" | "tuple" | "pointer" | "function-pointer" | "opaque" | "associated-type" | "lifetime" | "target-specific">,
    ExactSchemaUnion<TargetConstraint["kind"], "implements" | "value-type" | "reference-type" | "constructible" | "unmanaged" | "copy" | "clone" | "default" | "sized" | "lifetime" | "target-specific">,
    ExactSchemaUnion<ExtensionObservationResult<unknown>["kind"], "core" | "accept" | "reject" | "missing-owner" | "owner-deferred" | "conflict">,
    ExactSchemaUnion<ExtensionDiagnostic["category"], "error" | "warning" | "suggestion">,
    AllFieldsSnapshotted<CheckedCallMappingRequest, "sourceOperationKind" | "call" | "callee" | "arguments" | "callKind" | "sourceSelection" | "sourceCallee" | "sourceArguments" | "sourceResult" | "sourceReceiver" | "chainRole" | "target">,
    AllFieldsSnapshotted<RetainedCheckedSourceCallMappingRequest, keyof CheckedCallMappingRequest | "sourceComposition">,
    AllFieldsSnapshotted<CheckedCallSourceOperation, "sourceOperationKind" | "call" | "callee" | "arguments" | "callKind" | "sourceSelection" | "sourceCallee" | "sourceArguments" | "sourceResult" | "sourceReceiver" | "chainRole">,
    AllFieldsSnapshotted<CheckedPropertyAccessMappingRequest, "sourceOperationKind" | "expression" | "receiver" | "propertyName" | "sourceReceiver" | "accessMode" | "use" | "sourceReadResult" | "sourceWriteType" | "chainRole" | "target">,
    AllFieldsSnapshotted<CheckedPropertyAccessSourceOperation, "sourceOperationKind" | "expression" | "receiver" | "propertyName" | "sourceReceiver" | "accessMode" | "use" | "sourceReadResult" | "sourceWriteType" | "chainRole">,
    AllFieldsSnapshotted<CheckedElementAccessMappingRequest, "sourceOperationKind" | "expression" | "receiver" | "argument" | "sourceArgument" | "sourceSelectedElementIndex" | "sourceReceiver" | "accessMode" | "use" | "sourceReadResult" | "sourceWriteType" | "chainRole" | "target">,
    AllFieldsSnapshotted<CheckedElementAccessSourceOperation, "sourceOperationKind" | "expression" | "receiver" | "argument" | "sourceArgument" | "sourceSelectedElementIndex" | "sourceReceiver" | "accessMode" | "use" | "sourceReadResult" | "sourceWriteType" | "chainRole">,
    AllFieldsSnapshotted<CheckedOperatorMappingRequest, "sourceOperationKind" | "operatorKind" | "expression" | "operator" | "operand" | "sourceOperand" | "left" | "right" | "sourceLeft" | "sourceRight" | "sourceResult" | "target">,
    AllFieldsSnapshotted<CheckedOperatorSourceOperation, "sourceOperationKind" | "operatorKind" | "expression" | "operator" | "operand" | "sourceOperand" | "left" | "right" | "sourceLeft" | "sourceRight" | "sourceResult">,
    AllFieldsSnapshotted<CheckedIterationMappingRequest, "sourceOperationKind" | "statement" | "expression" | "initializer" | "iterationKind" | "mechanism" | "sourceIterable" | "sourceElement" | "target">,
    AllFieldsSnapshotted<CheckedIterationSourceOperation, "sourceOperationKind" | "statement" | "expression" | "initializer" | "iterationKind" | "mechanism" | "sourceIterable" | "sourceElement">,
    AllFieldsSnapshotted<CheckedConversionMappingRequest, "sourceOperationKind" | "expression" | "source" | "targetPlatform" | "conversionKind" | "target" | "call" | "slot" | "targetParameter" | "selectedSignature" | "sourceBinding" | "assertionKind" | "explicitTargetTypeNode">,
    AllFieldsSnapshotted<Extract<CheckedConversionSourceOperation, {
        readonly conversionKind: "assertion";
    }>, "sourceOperationKind" | "conversionKind" | "expression" | "source" | "target" | "assertionKind" | "explicitTargetTypeNode">,
    AllFieldsSnapshotted<Extract<CheckedConversionSourceOperation, {
        readonly conversionKind: "call-argument";
    }>, "sourceOperationKind" | "conversionKind" | "expression" | "source" | "call" | "slot" | "sourceBinding">,
    AllFieldsSnapshotted<Extract<CheckedCallMappingResult, {
        readonly kind: "source";
    }>, "kind">,
    AllFieldsSnapshotted<Extract<CheckedCallMappingResult, {
        readonly kind: "target";
    }>, "kind" | "selectedSignature" | "argumentConversions">,
    AllFieldsSnapshotted<CheckedOperationMappingResult, "operation" | "resultType" | "providerDeclaration">,
    AllFieldsSnapshotted<CheckedConversionMappingResult, "convertedType" | "operation" | "providerDeclaration">,
    AllFieldsSnapshotted<TargetSignatureSelection, "member" | "targetTypeArguments" | "providerDeclaration">,
    AllFieldsSnapshotted<SelectedTargetSignatureFact, "member" | "argumentConversions" | "targetTypeArguments" | "providerDeclaration" | "sourceCallKind" | "sourceSelection" | "sourceCallee" | "sourceArguments" | "sourceResult" | "sourceReceiver" | "sourceChainRole">,
    AllFieldsSnapshotted<Extract<SourceSelectedCallEvidence, {
        readonly kind: "applicable";
    }>, "kind" | "signature" | "declaration" | "methodTypeArguments" | "parameters" | "argumentBindings">,
    AllFieldsSnapshotted<Extract<SourceSelectedCallEvidence, {
        readonly kind: "untyped";
    }>, "kind">,
    AllFieldsSnapshotted<Extract<CheckedSourceChainRole, {
        readonly kind: "ordinary";
    }>, "kind" | "participant">,
    AllFieldsSnapshotted<Extract<CheckedSourceChainRole, {
        readonly kind: "optional-chain";
    }>, "kind" | "participant" | "position" | "boundary">,
    AllFieldsSnapshotted<SelectedSourceIterationProtocolMemberEvidence, "symbol" | "valueDeclaration" | "declarations" | "type">,
    AllFieldsSnapshotted<SelectedSourceIterationTypes, "yieldType" | "returnType" | "nextType">,
    AllFieldsSnapshotted<Extract<SelectedSourceIterationProtocolEvidence, {
        readonly resolutionKind: "known-iterable-instantiation";
    }>, "resolutionKind" | "iterationTypes" | "iterableTarget" | "iterableDeclarations">,
    AllFieldsSnapshotted<Extract<SelectedSourceIterationProtocolEvidence, {
        readonly resolutionKind: "selected-iterator-member";
    }>, "resolutionKind" | "iterationTypes" | "iteratorMethod" | "iteratorType">,
    AllFieldsSnapshotted<Extract<CheckedForOfIterationMechanism, {
        readonly kind: "union";
    }>, "kind" | "alternatives">,
    AllFieldsSnapshotted<Extract<CheckedForOfAtomicIterationMechanism, {
        readonly kind: "synchronous-iterator-protocol";
    }>, "kind" | "sourceAlternative" | "protocol">,
    AllFieldsSnapshotted<Extract<CheckedForOfAtomicIterationMechanism, {
        readonly kind: "array-like-index";
    }>, "kind" | "sourceAlternative" | "selectedIndex">,
    AllFieldsSnapshotted<Extract<CheckedForOfAtomicIterationMechanism, {
        readonly kind: "string-code-unit-index";
    }>, "kind" | "sourceAlternative">,
    AllFieldsSnapshotted<Extract<CheckedForOfAtomicIterationMechanism, {
        readonly kind: "untyped-dynamic-iteration";
    }>, "kind" | "sourceAlternative">,
    AllFieldsSnapshotted<Extract<CheckedForAwaitOfIterationMechanism, {
        readonly kind: "union";
    }>, "kind" | "alternatives">,
    AllFieldsSnapshotted<Extract<CheckedForAwaitOfAtomicIterationMechanism, {
        readonly kind: "asynchronous-iterator-protocol";
    }>, "kind" | "sourceAlternative" | "protocol">,
    AllFieldsSnapshotted<Extract<CheckedForAwaitOfAtomicIterationMechanism, {
        readonly kind: "synchronous-iterator-adapted-to-async";
    }>, "kind" | "sourceAlternative" | "protocol">,
    AllFieldsSnapshotted<Extract<CheckedForAwaitOfAtomicIterationMechanism, {
        readonly kind: "array-like-index-adapted-to-async";
    }>, "kind" | "sourceAlternative" | "selectedIndex">,
    AllFieldsSnapshotted<Extract<CheckedForAwaitOfAtomicIterationMechanism, {
        readonly kind: "string-code-unit-index-adapted-to-async";
    }>, "kind" | "sourceAlternative">,
    AllFieldsSnapshotted<Extract<CheckedForAwaitOfAtomicIterationMechanism, {
        readonly kind: "untyped-dynamic-iteration";
    }>, "kind" | "sourceAlternative">,
    AllFieldsSnapshotted<SelectedSourceTypeEvidence, "type" | "symbol" | "declaration" | "selectedSymbol" | "selectedDeclaration" | "authoredTypeNode">,
    AllFieldsSnapshotted<SelectedSourceValueEvidence, "expression" | "type" | "symbol" | "declaration" | "selectedSymbol" | "selectedDeclaration" | "authoredTypeNode">,
    AllFieldsSnapshotted<CheckedSourceCallCompositionEvidence, "argumentEvidence">,
    AllFieldsSnapshotted<Extract<CheckedSourceCallArgumentCompositionEvidence, {
        readonly kind: "authored-literal";
    }>, "kind" | "literal">,
    AllFieldsSnapshotted<Extract<CheckedSourceCallArgumentCompositionEvidence, {
        readonly kind: "inline-function";
    }>, "kind" | "function">,
    AllFieldsSnapshotted<Extract<CheckedSourceAuthoredLiteralEvidence, {
        readonly kind: "string" | "number" | "bigint" | "boolean";
    }>, "kind" | "value">,
    AllFieldsSnapshotted<Extract<CheckedSourceAuthoredLiteralEvidence, {
        readonly kind: "null";
    }>, "kind">,
    AllFieldsSnapshotted<CheckedSourceInlineFunctionEvidence, "expression" | "parameters" | "returns" | "operations">,
    AllFieldsSnapshotted<CheckedSourceInlineFunctionReturnEvidence, "expression">,
    AllFieldsSnapshotted<CheckedSourceInlinePropertyOperation, "sourceOperationKind" | "expression" | "receiver" | "sourceReceiver" | "accessMode" | "use" | "sourceReadResult" | "sourceWriteType" | "chainRole">,
    AllFieldsSnapshotted<TargetMember, "id" | "sourceName" | "targetName" | "kind" | "static" | "parameters" | "returnType" | "typeParameters" | "overloadGroup" | "providerDeclaration">,
    AllFieldsSnapshotted<TargetParameter, "name" | "type" | "passingMode" | "optional" | "paramsArray">,
    AllFieldsSnapshotted<TargetTypeParameter, "name" | "constraints" | "variance">,
    AllFieldsSnapshotted<TargetOperationProposal, "operationId" | "operationKind" | "targetOperation" | "evidence">,
    AllFieldsSnapshotted<TargetOperationFact, "operationId" | "operationKind" | "targetOperation" | "resultType" | "evidence" | "provenance">,
    AllFieldsSnapshotted<TargetOperationProvenance, "providerDeclaration" | "sourceOperation">,
    AllFieldsSnapshotted<ProviderDeclarationIdentity, "providerId" | "providerVersion" | "providerModuleId" | "moduleSpecifier" | "artifactFileName" | "exportName" | "exportId" | "memberName" | "memberKey" | "memberId" | "memberStatic" | "signatureId" | "targetIdentity">,
    AllFieldsSnapshotted<SourceSelectedMethodTypeArgument, "typeParameterName" | "typeParameter" | "selectedType" | "explicitTypeNode">,
    AllFieldsSnapshotted<SourceSelectedSignatureParameter, "parameterIndex" | "parameterName" | "parameterSymbol" | "parameterDeclaration" | "selectedType" | "authoredTypeNode" | "acceptsOmission" | "rest">,
    AllFieldsSnapshotted<SourceSelectedCallArgumentBinding, "sourceArgumentIndex" | "effectiveArgumentIndex" | "sourceForm" | "spreadElementIndex" | "sourceParameterIndex" | "sourceParameterForm" | "selectedArgumentType" | "selectedParameterType">,
    AllFieldsSnapshotted<TargetCallArgumentConversionSlot, "sourceArgumentIndex" | "sourceForm" | "spreadElementIndex" | "targetParameterIndex" | "targetForm">,
    AllFieldsSnapshotted<ExtensionEvidence, "message" | "details">,
    AllFieldsSnapshotted<ExtensionDiagnostic, "extensionId" | "extensionCode" | "numericCode" | "publicCode" | "category" | "message" | "nodeOrSpan" | "evidence" | "identity">,
    AllFieldsSnapshotted<ExtensionDiagnosticSourceSpan, "sourceFile" | "pos" | "end">,
    AllFieldsSnapshotted<Extract<ProviderMemberKey, {
        readonly kind: "property-key";
    }>, "kind" | "name">,
    AllFieldsSnapshotted<Extract<ProviderMemberKey, {
        readonly kind: "well-known-symbol";
    }>, "kind" | "name">,
    AllFieldsSnapshotted<Extract<TargetConstraint, {
        readonly kind: "implements";
    }>, "kind" | "contract" | "typeArguments">,
    AllFieldsSnapshotted<Extract<TargetConstraint, {
        readonly kind: "lifetime";
    }>, "kind" | "name">,
    AllFieldsSnapshotted<Extract<TargetConstraint, {
        readonly kind: "target-specific";
    }>, "kind" | "target" | "name" | "payloadId">,
    AllFieldsSnapshotted<Exclude<TargetConstraint, {
        readonly kind: "implements" | "lifetime" | "target-specific";
    }>, "kind">,
    AllFieldsSnapshotted<Extract<TargetTypeRef, {
        readonly kind: "source-primitive";
    }>, "kind" | "name">,
    AllFieldsSnapshotted<Extract<TargetTypeRef, {
        readonly kind: "source-global";
    }>, "kind" | "name" | "typeArguments">,
    AllFieldsSnapshotted<Extract<TargetTypeRef, {
        readonly kind: "target-named";
    }>, "kind" | "id" | "typeArguments">,
    AllFieldsSnapshotted<Extract<TargetTypeRef, {
        readonly kind: "type-parameter";
    }>, "kind" | "name">,
    AllFieldsSnapshotted<Extract<TargetTypeRef, {
        readonly kind: "array";
    }>, "kind" | "element" | "rank">,
    AllFieldsSnapshotted<Extract<TargetTypeRef, {
        readonly kind: "tuple";
    }>, "kind" | "elements">,
    AllFieldsSnapshotted<Extract<TargetTypeRef, {
        readonly kind: "pointer";
    }>, "kind" | "pointee" | "mutability">,
    AllFieldsSnapshotted<Extract<TargetTypeRef, {
        readonly kind: "function-pointer";
    }>, "kind" | "args" | "result" | "abi">,
    AllFieldsSnapshotted<Extract<TargetTypeRef, {
        readonly kind: "opaque";
    }>, "kind" | "id">,
    AllFieldsSnapshotted<Extract<TargetTypeRef, {
        readonly kind: "associated-type";
    }>, "kind" | "owner" | "name">,
    AllFieldsSnapshotted<Extract<TargetTypeRef, {
        readonly kind: "lifetime";
    }>, "kind" | "name">,
    AllFieldsSnapshotted<Extract<TargetTypeRef, {
        readonly kind: "target-specific";
    }>, "kind" | "target" | "name" | "payloadId">
]>;
declare const checkedOperationRequestSnapshotCacheBrand: unique symbol;
export interface CheckedOperationRequestSnapshotCache {
    readonly [checkedOperationRequestSnapshotCacheBrand]: true;
}
export interface CheckedOperationRequestSnapshotMetrics {
    readonly objectCount: number;
    readonly targetTypeRefObjectCount: number;
    readonly arrayElementCount: number;
    readonly ownFieldCount: number;
    readonly scalarCodeUnits: number;
    readonly workUnits: number;
}
export interface CheckedOperationRequestSnapshot<TObservation extends CheckedOperationObservationPointName> {
    readonly request: RetainedCheckedOperationRequest<TObservation>;
    readonly metrics: CheckedOperationRequestSnapshotMetrics;
}
export declare function createCheckedOperationRequestSnapshotCache(): CheckedOperationRequestSnapshotCache;
export declare function snapshotCheckedOperationRequest<TObservation extends CheckedOperationObservationPointName>(observation: TObservation, request: RetainedCheckedOperationRequest<TObservation>, cache?: CheckedOperationRequestSnapshotCache): RetainedCheckedOperationRequest<TObservation>;
export declare function snapshotCheckedOperationRequestWithMetrics<TObservation extends CheckedOperationObservationPointName>(observation: TObservation, request: RetainedCheckedOperationRequest<TObservation>, cache?: CheckedOperationRequestSnapshotCache): CheckedOperationRequestSnapshot<TObservation>;
export declare function snapshotCheckedOperationResult<TObservation extends CheckedOperationObservationPointName>(observation: TObservation, result: ExtensionObservationResult<ExtensionObservationResponse<TObservation>>): ExtensionObservationResult<ExtensionObservationResponse<TObservation>>;
export declare function snapshotCheckedOperationResponse<TObservation extends CheckedOperationObservationPointName>(observation: TObservation, response: unknown): ExtensionObservationResponse<TObservation>;
export declare function snapshotTargetOperationFact(operation: TargetOperationFact): TargetOperationFact;
export declare function snapshotSelectedTargetSignatureFact(selection: SelectedTargetSignatureFact, cache?: CheckedOperationRequestSnapshotCache): SelectedTargetSignatureFact;
export declare function snapshotCanonicalIdentityFact(value: ExtensionCanonicalIdentity): ExtensionCanonicalIdentity;
export declare function snapshotSourcePrimitiveFact(value: SourcePrimitiveFact): SourcePrimitiveFact;
export declare function snapshotArgumentPassingFact(value: ArgumentPassingFact): ArgumentPassingFact;
export declare function snapshotFunctionPointerFact(value: FunctionPointerFact): FunctionPointerFact;
export declare function snapshotPointerFact(value: PointerFact): PointerFact;
export declare function snapshotStructFact(value: StructFact): StructFact;
export declare function snapshotFieldFactValue(value: FieldFact): FieldFact;
export declare function snapshotAttributeFact(value: AttributeFact): AttributeFact;
export declare function snapshotDefaultValueFact(value: DefaultValueFact): DefaultValueFact;
export declare function snapshotTargetBindingFact(value: TargetBindingFact): TargetBindingFact;
export declare function snapshotInstantiatedTargetTypeFact(value: InstantiatedTargetTypeFact): InstantiatedTargetTypeFact;
export declare function snapshotContextualTargetTypeFact(value: ContextualTargetTypeFact): ContextualTargetTypeFact;
export declare function snapshotFlowStateFact(value: FlowStateFact): FlowStateFact;
export declare function snapshotRuntimeCarrierFact(value: RuntimeCarrierFact): RuntimeCarrierFact;
export declare function snapshotTargetConversionFact(value: TargetConversionFact): TargetConversionFact;
export declare function snapshotTargetCallArgumentConversionFact(value: TargetCallArgumentConversionFact): TargetCallArgumentConversionFact;
export declare function snapshotTargetCallArgumentPassingFact(value: TargetCallArgumentPassingFact): TargetCallArgumentPassingFact;
export declare function snapshotProviderVirtualDeclarationFact(value: ProviderVirtualDeclarationFact): ProviderVirtualDeclarationFact;
export declare function snapshotProviderTypeFamilyFact(value: ProviderTypeFamilyFact): ProviderTypeFamilyFact;
export declare function snapshotAssociatedTypeFact(value: AssociatedTypeFact): AssociatedTypeFact;
export declare function snapshotConstGenericFact(value: ConstGenericFact): ConstGenericFact;
export declare function snapshotTargetCallArgumentConversionSlot(value: TargetCallArgumentConversionSlot): TargetCallArgumentConversionSlot;
export {};
//# sourceMappingURL=checked-operation-value-snapshot.d.ts.map