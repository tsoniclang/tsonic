import { defineExtensionFactKey } from "./fact-key.js";
import { snapshotArgumentPassingFact, snapshotAssociatedTypeFact, snapshotAttributeFact, snapshotCanonicalIdentityFact, snapshotConstGenericFact, snapshotContextualTargetTypeFact, snapshotDefaultValueFact, snapshotFieldFactValue, snapshotFlowStateFact, snapshotFunctionPointerFact, snapshotInstantiatedTargetTypeFact, snapshotPointerFact, snapshotProviderTypeFamilyFact, snapshotProviderVirtualDeclarationFact, snapshotRuntimeCarrierFact, snapshotSelectedTargetSignatureFact, snapshotSourcePrimitiveFact, snapshotStructFact, snapshotTargetBindingFact, snapshotTargetCallArgumentConversionFact, snapshotTargetCallArgumentPassingFact, snapshotTargetConversionFact, snapshotTargetOperationFact, } from "./checked-operation-value-snapshot.js";
import { checkedCallSourceOperationEquals, checkedConversionSourceOperationEquals, checkedElementAccessSourceOperationEquals, checkedIterationSourceOperationEquals, checkedOperatorSourceOperationEquals, checkedPropertyAccessSourceOperationEquals, checkedSourceChainRoleEquals, optionalProviderDeclarationIdentityEquals, optionalProviderMemberKeyEquals, optionalSelectedSourceTypeEvidenceEquals, optionalSelectedSourceValueEvidenceEquals, optionalTargetTypeRefEquals, providerDeclarationIdentityEquals, selectedSourceTypeEvidenceEquals, selectedSourceValueEvidenceArrayEquals, selectedSourceValueEvidenceEquals, selectedTargetSignatureEquals, sourceSelectedCallArgumentBindingEquals, sourceSelectedCallEvidenceEquals, sourceSelectedMethodTypeArgumentArrayEquals, sourceSelectedSignatureParameterArrayEquals, targetCallArgumentConversionSlotEquals, targetConstraintArrayEquals, targetMemberEquals, targetParameterEquals, targetTypeParameterArrayEquals, targetTypeRefArrayEquals, targetTypeRefEquals, } from "./fact-value-equality.js";
export { checkedCallSourceOperationEquals, checkedConversionSourceOperationEquals, checkedElementAccessSourceOperationEquals, checkedIterationSourceOperationEquals, checkedOperatorSourceOperationEquals, checkedPropertyAccessSourceOperationEquals, selectedTargetSignatureEquals, targetParameterEquals, targetTypeRefEquals, } from "./fact-value-equality.js";
export const canonicalIdentityFactKey = defineExtensionFactKey({
    extensionId: "tsts.identity",
    name: "canonicalIdentity",
    snapshot: snapshotCanonicalIdentityFact,
    equals: (left, right) => left.kind === right.kind
        && left.id === right.id
        && left.packageName === right.packageName
        && left.packageVersion === right.packageVersion
        && left.subpath === right.subpath
        && left.exportName === right.exportName
        && left.importKind === right.importKind
        && left.canonicalSymbolId === right.canonicalSymbolId,
});
export const sourcePrimitiveFactKey = defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "sourcePrimitive",
    snapshot: snapshotSourcePrimitiveFact,
    equals: (left, right) => left.kind === right.kind && left.width === right.width && left.signed === right.signed && left.runtimeBase === right.runtimeBase,
});
export const argumentPassingFactKey = defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "argumentPassing",
    snapshot: snapshotArgumentPassingFact,
    equals: (left, right) => left.mode === right.mode
        && left.targetExpression === right.targetExpression,
});
export const functionPointerFactKey = defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "functionPointer",
    snapshot: snapshotFunctionPointerFact,
    equals: (left, right) => left.result === right.result
        && left.parameters.length === right.parameters.length
        && left.parameters.every((parameter, index) => parameter === right.parameters[index])
        && left.abi.length === right.abi.length
        && left.abi.every((abi, index) => abi === right.abi[index]),
});
export const pointerFactKey = defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "pointer",
    snapshot: snapshotPointerFact,
    equals: (left, right) => left.pointee === right.pointee && left.mutability === right.mutability && left.unsafeRequired === right.unsafeRequired,
});
export const structFactKey = defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "struct",
    snapshot: snapshotStructFact,
    equals: (left, right) => left.valueType === right.valueType
        && fieldFactArrayEquals(left.fields, right.fields),
});
export const fieldFactKey = defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "field",
    snapshot: snapshotFieldFactValue,
    equals: (left, right) => left.name === right.name && left.type === right.type && left.readonly === right.readonly,
});
export const attributeFactKey = defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "attribute",
    snapshot: snapshotAttributeFact,
    equals: (left, right) => left.target === right.target
        && left.attributeName === right.attributeName
        && factSubjectArrayEquals(left.arguments, right.arguments),
});
export const defaultValueFactKey = defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "defaultValue",
    snapshot: snapshotDefaultValueFact,
    equals: (left, right) => left.type === right.type,
});
export const targetBindingFactKey = defineExtensionFactKey({
    extensionId: "tsts.target-bindings",
    name: "targetBinding",
    snapshot: snapshotTargetBindingFact,
    equals: targetBindingFactEquals,
});
export const instantiatedTargetTypeFactKey = defineExtensionFactKey({
    extensionId: "tsts.target-bindings",
    name: "instantiatedTargetType",
    snapshot: snapshotInstantiatedTargetTypeFact,
    equals: (left, right) => targetBindingFactEquals(left.targetType, right.targetType)
        && factSubjectArrayEquals(left.typeArguments, right.typeArguments)
        && targetTypeRefArrayEquals(left.resolvedTypeArguments, right.resolvedTypeArguments),
});
export const selectedTargetSignatureFactKey = defineExtensionFactKey({
    extensionId: "tsts.target-bindings",
    name: "selectedTargetSignature",
    snapshot: snapshotSelectedTargetSignatureFact,
    equals: selectedTargetSignatureEquals,
});
export const contextualTargetTypeFactKey = defineExtensionFactKey({
    extensionId: "tsts.target-bindings",
    name: "contextualTargetType",
    snapshot: snapshotContextualTargetTypeFact,
    equals: (left, right) => left.type === right.type && optionalTargetTypeRefEquals(left.targetType, right.targetType),
});
export const targetOperationFactKey = defineExtensionFactKey({
    extensionId: "tsts.target-bindings",
    name: "targetOperation",
    snapshot: snapshotTargetOperationFact,
    equals: targetOperationFactEquals,
});
export const flowStateFactKey = defineExtensionFactKey({
    extensionId: "tsts.flow",
    name: "flowState",
    snapshot: snapshotFlowStateFact,
    equals: (left, right) => left.state === right.state && left.targetCompiler === right.targetCompiler,
});
export const runtimeCarrierFactKey = defineExtensionFactKey({
    extensionId: "tsts.target-bindings",
    name: "runtimeCarrier",
    snapshot: snapshotRuntimeCarrierFact,
    equals: (left, right) => targetTypeRefEquals(left.carrier, right.carrier)
        && left.requiresAllocation === right.requiresAllocation
        && optionalRuntimeCarrierProvenanceEquals(left.provenance, right.provenance),
});
export const targetConversionFactKey = defineExtensionFactKey({
    extensionId: "tsts.target-bindings",
    name: "targetConversion",
    snapshot: snapshotTargetConversionFact,
    equals: (left, right) => optionalTargetTypeRefEquals(left.convertedType, right.convertedType) && optionalTargetOperationFactEquals(left.operation, right.operation),
});
export const targetCallArgumentConversionFactKey = defineExtensionFactKey({
    extensionId: "tsts.target-bindings",
    name: "targetCallArgumentConversion",
    snapshot: snapshotTargetCallArgumentConversionFact,
    equals: (left, right) => targetCallArgumentConversionSlotEquals(left.slot, right.slot)
        && left.call === right.call
        && sourceSelectedCallArgumentBindingEquals(left.sourceBinding, right.sourceBinding)
        && optionalTargetTypeRefEquals(left.convertedType, right.convertedType)
        && optionalTargetOperationFactEquals(left.operation, right.operation),
});
export const targetCallArgumentPassingFactKey = defineExtensionFactKey({
    extensionId: "tsts.target-bindings",
    name: "targetCallArgumentPassing",
    snapshot: snapshotTargetCallArgumentPassingFact,
    equals: (left, right) => targetCallArgumentConversionSlotEquals(left.slot, right.slot)
        && left.mode === right.mode
        && left.targetExpression === right.targetExpression
        && left.call === right.call
        && sourceSelectedCallArgumentBindingEquals(left.sourceBinding, right.sourceBinding)
        && targetParameterEquals(left.targetParameter, right.targetParameter)
        && optionalProviderDeclarationIdentityEquals(left.selectedSignature, right.selectedSignature),
});
export const providerVirtualDeclarationFactKey = defineExtensionFactKey({
    extensionId: "tsts.provider",
    name: "virtualDeclaration",
    snapshot: snapshotProviderVirtualDeclarationFact,
    equals: (left, right) => left.providerId === right.providerId
        && left.providerVersion === right.providerVersion
        && left.providerModuleId === right.providerModuleId
        && left.moduleSpecifier === right.moduleSpecifier
        && left.artifactFileName === right.artifactFileName
        && left.exportName === right.exportName
        && left.exportId === right.exportId
        && left.memberName === right.memberName
        && optionalProviderMemberKeyEquals(left.memberKey, right.memberKey)
        && left.memberId === right.memberId
        && left.memberStatic === right.memberStatic
        && left.signatureId === right.signatureId
        && optionalTargetTypeRefEquals(left.targetIdentity, right.targetIdentity),
});
export const providerTypeFamilyFactKey = defineExtensionFactKey({
    extensionId: "tsts.provider",
    name: "typeFamily",
    snapshot: snapshotProviderTypeFamilyFact,
    equals: (left, right) => left.exportName === right.exportName
        && providerTypeFamilyVariantArrayEquals(left.variants, right.variants),
});
export const associatedTypeFactKey = defineExtensionFactKey({
    extensionId: "tsts.target-bindings",
    name: "associatedType",
    snapshot: snapshotAssociatedTypeFact,
    equals: (left, right) => left.owner === right.owner && left.name === right.name && left.value === right.value,
});
export const constGenericFactKey = defineExtensionFactKey({
    extensionId: "tsts.target-bindings",
    name: "constGeneric",
    snapshot: snapshotConstGenericFact,
    equals: (left, right) => left.name === right.name && left.value === right.value,
});
function providerTypeFamilyVariantArrayEquals(left, right) {
    return left.length === right.length && left.every((variant, index) => providerTypeFamilyVariantEquals(variant, right[index]));
}
function providerTypeFamilyVariantEquals(left, right) {
    return left.sourceTypeArgumentCount === right.sourceTypeArgumentCount
        && providerDeclarationIdentityEquals(left.declaration, right.declaration)
        && optionalTargetBindingFactEquals(left.targetBinding, right.targetBinding);
}
function optionalTargetBindingFactEquals(left, right) {
    if (left === undefined || right === undefined) {
        return left === right;
    }
    return targetBindingFactEquals(left, right);
}
function factSubjectArrayEquals(left, right) {
    if (left === undefined || right === undefined) {
        return left === right;
    }
    return left.length === right.length && left.every((value, index) => value === right[index]);
}
function fieldFactArrayEquals(left, right) {
    if (left === undefined || right === undefined) {
        return left === right;
    }
    return left.length === right.length && left.every((value, index) => fieldFactEquals(value, right[index]));
}
function fieldFactEquals(left, right) {
    return left.name === right.name && left.type === right.type && left.readonly === right.readonly;
}
function targetBindingFactEquals(left, right) {
    return left.id === right.id
        && left.sourceName === right.sourceName
        && left.targetName === right.targetName
        && left.target === right.target
        && left.kind === right.kind
        && targetTypeParameterArrayEquals(left.typeParameters, right.typeParameters)
        && targetMemberArrayEquals(left.members, right.members)
        && targetConstraintArrayEquals(left.implementedContracts, right.implementedContracts);
}
function targetMemberArrayEquals(left, right) {
    if (left === undefined || right === undefined) {
        return left === right;
    }
    return left.length === right.length && left.every((value, index) => targetMemberEquals(value, right[index]));
}
function optionalTargetOperationFactEquals(left, right) {
    if (left === undefined || right === undefined) {
        return left === right;
    }
    return targetOperationFactEquals(left, right);
}
export function targetOperationFactEquals(left, right) {
    return targetOperationProposalEquals(left, right)
        && optionalTargetTypeRefEquals(left.resultType, right.resultType)
        && targetOperationProvenanceEquals(left.provenance, right.provenance);
}
function targetOperationProposalEquals(left, right) {
    return left.operationId === right.operationId
        && left.operationKind === right.operationKind
        && left.targetOperation === right.targetOperation;
}
function targetOperationProvenanceEquals(left, right) {
    return optionalProviderDeclarationIdentityEquals(left.providerDeclaration, right.providerDeclaration)
        && targetOperationSourceProvenanceEquals(left.sourceOperation, right.sourceOperation);
}
function targetOperationSourceProvenanceEquals(left, right) {
    if (left.sourceOperationKind !== right.sourceOperationKind) {
        return false;
    }
    switch (left.sourceOperationKind) {
        case "call":
            return right.sourceOperationKind === "call" && checkedCallSourceOperationEquals(left, right);
        case "property-access":
            return right.sourceOperationKind === "property-access" && checkedPropertyAccessSourceOperationEquals(left, right);
        case "element-access":
            return right.sourceOperationKind === "element-access" && checkedElementAccessSourceOperationEquals(left, right);
        case "operator":
            return right.sourceOperationKind === "operator" && checkedOperatorSourceOperationEquals(left, right);
        case "iteration":
            return right.sourceOperationKind === "iteration" && checkedIterationSourceOperationEquals(left, right);
        case "conversion":
            return right.sourceOperationKind === "conversion" && checkedConversionSourceOperationEquals(left, right);
    }
}
function optionalRuntimeCarrierProvenanceEquals(left, right) {
    if (left === undefined || right === undefined) {
        return left === right;
    }
    return left.sourceType === right.sourceType
        && left.sourceTypeReference === right.sourceTypeReference
        && left.sourceSymbol === right.sourceSymbol
        && optionalProviderDeclarationIdentityEquals(left.providerDeclaration, right.providerDeclaration);
}
//# sourceMappingURL=facts.js.map