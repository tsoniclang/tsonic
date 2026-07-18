import type { CheckedCallMappingResult, CheckedConversionMappingResult, CheckedOperationMappingResult, CheckedOperationObservationPointName, ExtensionObservationRequest, ExtensionObservationResponse, ExtensionObservationResult } from "./observations.js";
import type { ProviderDeclarationIdentity, ProviderMemberKey, SelectedSourceTypeEvidence, SelectedSourceValueEvidence, SelectedTargetSignatureFact, SourceSelectedCallArgumentBinding, SourceSelectedMethodTypeArgument, SourceSelectedSignatureParameter, TargetCallArgumentConversionSlot, TargetConstraint, TargetMember, TargetOperationFact, TargetOperationProvenance, TargetParameter, TargetSignatureSelection, TargetTypeParameter, TargetTypeRef } from "./facts.js";
import type { ExtensionDiagnostic, ExtensionEvidence } from "./host.js";
type AllFieldsSnapshotted<T, TFields extends keyof T> = Exclude<keyof T, TFields> extends never ? true : false;
type RequireAllSnapshots<T extends readonly true[]> = T;
export type CheckedOperationSnapshotFieldCoverage = RequireAllSnapshots<[
    AllFieldsSnapshotted<Extract<CheckedCallMappingResult, {
        readonly kind: "source";
    }>, "kind">,
    AllFieldsSnapshotted<Extract<CheckedCallMappingResult, {
        readonly kind: "target";
    }>, "kind" | "selectedSignature" | "argumentConversions">,
    AllFieldsSnapshotted<CheckedOperationMappingResult, "operation" | "resultType" | "provenance">,
    AllFieldsSnapshotted<CheckedConversionMappingResult, "convertedType" | "operation">,
    AllFieldsSnapshotted<TargetSignatureSelection, "member" | "targetTypeArguments" | "providerDeclaration">,
    AllFieldsSnapshotted<SelectedTargetSignatureFact, "member" | "argumentConversions" | "targetTypeArguments" | "providerDeclaration" | "sourceSelectedMethodTypeArguments" | "sourceSelectedSignatureParameters" | "sourceSelectedSignatureKind" | "sourceCallKind" | "sourceArgumentBindings" | "sourceSignature" | "sourceDeclaration" | "sourceCallee" | "sourceArguments" | "sourceResult" | "sourceOptionalChain" | "sourceReceiver">,
    AllFieldsSnapshotted<SelectedSourceTypeEvidence, "type" | "symbol" | "declaration" | "selectedSymbol" | "selectedDeclaration" | "authoredTypeNode">,
    AllFieldsSnapshotted<SelectedSourceValueEvidence, "expression" | "type" | "symbol" | "declaration" | "selectedSymbol" | "selectedDeclaration" | "authoredTypeNode">,
    AllFieldsSnapshotted<TargetMember, "id" | "sourceName" | "targetName" | "kind" | "static" | "parameters" | "returnType" | "typeParameters" | "overloadGroup" | "providerDeclaration">,
    AllFieldsSnapshotted<TargetParameter, "name" | "type" | "passingMode" | "optional" | "paramsArray">,
    AllFieldsSnapshotted<TargetTypeParameter, "name" | "constraints" | "variance">,
    AllFieldsSnapshotted<TargetOperationFact, "operationId" | "operationKind" | "targetOperation" | "resultType" | "evidence" | "provenance">,
    AllFieldsSnapshotted<TargetOperationProvenance, "providerDeclaration" | "sourceExpression" | "sourceReceiver" | "sourceCallee" | "sourceSelectedSymbol" | "sourceSelectedDeclaration" | "sourceSelectedSignature" | "sourceResultType" | "sourceReceiverType" | "sourceOptionalChain" | "sourceAccessMode" | "sourceCallCallee">,
    AllFieldsSnapshotted<ProviderDeclarationIdentity, "providerId" | "providerVersion" | "providerModuleId" | "moduleSpecifier" | "artifactFileName" | "exportName" | "exportId" | "memberName" | "memberKey" | "memberId" | "memberStatic" | "signatureId" | "targetIdentity">,
    AllFieldsSnapshotted<SourceSelectedMethodTypeArgument, "typeParameterName" | "typeParameter" | "selectedType" | "explicitTypeNode">,
    AllFieldsSnapshotted<SourceSelectedSignatureParameter, "parameterIndex" | "parameterName" | "parameterSymbol" | "parameterDeclaration" | "selectedType" | "authoredTypeNode" | "acceptsOmission" | "rest">,
    AllFieldsSnapshotted<SourceSelectedCallArgumentBinding, "sourceArgumentIndex" | "effectiveArgumentIndex" | "sourceForm" | "spreadElementIndex" | "sourceParameterIndex" | "sourceParameterForm" | "selectedArgumentType" | "selectedParameterType">,
    AllFieldsSnapshotted<TargetCallArgumentConversionSlot, "sourceArgumentIndex" | "sourceForm" | "spreadElementIndex" | "targetParameterIndex" | "targetForm">,
    AllFieldsSnapshotted<ExtensionEvidence, "message" | "details">,
    AllFieldsSnapshotted<ExtensionDiagnostic, "extensionId" | "extensionCode" | "numericCode" | "publicCode" | "category" | "message" | "nodeOrSpan" | "evidence" | "identity">,
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
    }>, "kind" | "target" | "name" | "value">,
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
    }>, "kind" | "target" | "name" | "value">
]>;
export interface CheckedOperationRequestSnapshotCache {
    readonly selectedTargetSignatures: WeakMap<SelectedTargetSignatureFact, SelectedTargetSignatureFact>;
    readonly targetParameters: WeakMap<TargetParameter, TargetParameter>;
    readonly targetCallArgumentConversionSlots: WeakMap<TargetCallArgumentConversionSlot, TargetCallArgumentConversionSlot>;
}
export declare function createCheckedOperationRequestSnapshotCache(): CheckedOperationRequestSnapshotCache;
export declare function snapshotCheckedOperationRequest<TObservation extends CheckedOperationObservationPointName>(observation: TObservation, request: ExtensionObservationRequest<TObservation>, cache?: CheckedOperationRequestSnapshotCache): ExtensionObservationRequest<TObservation>;
export declare function snapshotCheckedOperationResult<TObservation extends CheckedOperationObservationPointName>(observation: TObservation, result: ExtensionObservationResult<ExtensionObservationResponse<TObservation>>): ExtensionObservationResult<ExtensionObservationResponse<TObservation>>;
export declare function snapshotCheckedOperationResponse<TObservation extends CheckedOperationObservationPointName>(observation: TObservation, response: unknown): ExtensionObservationResponse<TObservation>;
export declare function snapshotTargetOperationFact(operation: TargetOperationFact): TargetOperationFact;
export declare function snapshotSelectedTargetSignatureFact(selection: SelectedTargetSignatureFact, cache?: CheckedOperationRequestSnapshotCache): SelectedTargetSignatureFact;
export {};
//# sourceMappingURL=checked-operation-value-snapshot.d.ts.map