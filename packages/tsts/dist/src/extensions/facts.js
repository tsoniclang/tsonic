import { defineExtensionFactKey } from "./host.js";
export const canonicalIdentityFactKey = defineExtensionFactKey({
    extensionId: "tsts.identity",
    name: "canonicalIdentity",
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
    equals: (left, right) => left.kind === right.kind && left.width === right.width && left.signed === right.signed && left.runtimeBase === right.runtimeBase,
});
export const argumentPassingFactKey = defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "argumentPassing",
    equals: (left, right) => left.mode === right.mode
        && left.targetExpression === right.targetExpression
        && left.parameterIndex === right.parameterIndex
        && optionalTargetParameterEquals(left.targetParameter, right.targetParameter)
        && optionalProviderDeclarationIdentityEquals(left.selectedSignature, right.selectedSignature),
});
export const functionPointerFactKey = defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "functionPointer",
    equals: (left, right) => left.result === right.result
        && left.parameters.length === right.parameters.length
        && left.parameters.every((parameter, index) => parameter === right.parameters[index])
        && left.abi.length === right.abi.length
        && left.abi.every((abi, index) => abi === right.abi[index]),
});
export const pointerFactKey = defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "pointer",
    equals: (left, right) => left.pointee === right.pointee && left.mutability === right.mutability && left.unsafeRequired === right.unsafeRequired,
});
export const structFactKey = defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "struct",
    equals: (left, right) => left.valueType === right.valueType
        && fieldFactArrayEquals(left.fields, right.fields),
});
export const fieldFactKey = defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "field",
    equals: (left, right) => left.name === right.name && left.type === right.type && left.readonly === right.readonly,
});
export const attributeFactKey = defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "attribute",
    equals: (left, right) => left.target === right.target
        && left.attributeName === right.attributeName
        && factSubjectArrayEquals(left.arguments, right.arguments),
});
export const defaultValueFactKey = defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "defaultValue",
    equals: (left, right) => left.type === right.type,
});
export const targetBindingFactKey = defineExtensionFactKey({
    extensionId: "tsts.target-bindings",
    name: "targetBinding",
    equals: targetBindingFactEquals,
});
export const instantiatedTargetTypeFactKey = defineExtensionFactKey({
    extensionId: "tsts.target-bindings",
    name: "instantiatedTargetType",
    equals: (left, right) => targetBindingFactEquals(left.targetType, right.targetType)
        && factSubjectArrayEquals(left.typeArguments, right.typeArguments)
        && targetTypeRefArrayEquals(left.resolvedTypeArguments, right.resolvedTypeArguments),
});
export const selectedTargetSignatureFactKey = defineExtensionFactKey({
    extensionId: "tsts.target-bindings",
    name: "selectedTargetSignature",
    equals: (left, right) => targetMemberEquals(left.member, right.member)
        && factSubjectArrayEquals(left.typeArguments, right.typeArguments)
        && targetTypeRefArrayEquals(left.targetTypeArguments, right.targetTypeArguments)
        && targetTypeRefArrayEquals(left.argumentConversions, right.argumentConversions)
        && left.sourceSignature === right.sourceSignature
        && left.sourceDeclaration === right.sourceDeclaration
        && optionalProviderDeclarationIdentityEquals(left.providerDeclaration, right.providerDeclaration),
});
export const contextualTargetTypeFactKey = defineExtensionFactKey({
    extensionId: "tsts.target-bindings",
    name: "contextualTargetType",
    equals: (left, right) => left.type === right.type && optionalTargetTypeRefEquals(left.targetType, right.targetType),
});
export const targetOperationFactKey = defineExtensionFactKey({
    extensionId: "tsts.target-bindings",
    name: "targetOperation",
    equals: targetOperationFactEquals,
});
export const flowStateFactKey = defineExtensionFactKey({
    extensionId: "tsts.flow",
    name: "flowState",
    equals: (left, right) => left.state === right.state && left.targetCompiler === right.targetCompiler,
});
export const runtimeCarrierFactKey = defineExtensionFactKey({
    extensionId: "tsts.target-bindings",
    name: "runtimeCarrier",
    equals: (left, right) => targetTypeRefEquals(left.carrier, right.carrier)
        && left.requiresAllocation === right.requiresAllocation
        && optionalRuntimeCarrierProvenanceEquals(left.provenance, right.provenance),
});
export const targetConversionFactKey = defineExtensionFactKey({
    extensionId: "tsts.target-bindings",
    name: "targetConversion",
    equals: (left, right) => optionalTargetTypeRefEquals(left.convertedType, right.convertedType) && optionalTargetOperationFactEquals(left.operation, right.operation),
});
export const providerVirtualDeclarationFactKey = defineExtensionFactKey({
    extensionId: "tsts.provider",
    name: "virtualDeclaration",
    equals: (left, right) => left.providerId === right.providerId
        && left.providerVersion === right.providerVersion
        && left.providerModuleId === right.providerModuleId
        && left.moduleSpecifier === right.moduleSpecifier
        && left.virtualFileName === right.virtualFileName
        && left.exportName === right.exportName
        && left.exportId === right.exportId
        && left.memberName === right.memberName
        && left.memberId === right.memberId
        && left.signatureId === right.signatureId
        && optionalTargetTypeRefEquals(left.targetIdentity, right.targetIdentity),
});
export const associatedTypeFactKey = defineExtensionFactKey({
    extensionId: "tsts.target-bindings",
    name: "associatedType",
    equals: (left, right) => left.owner === right.owner && left.name === right.name && left.value === right.value,
});
export const constGenericFactKey = defineExtensionFactKey({
    extensionId: "tsts.target-bindings",
    name: "constGeneric",
    equals: (left, right) => left.name === right.name && left.value === right.value,
});
function optionalTargetTypeRefEquals(left, right) {
    if (left === undefined || right === undefined) {
        return left === right;
    }
    return targetTypeRefEquals(left, right);
}
function optionalProviderDeclarationIdentityEquals(left, right) {
    if (left === undefined || right === undefined) {
        return left === right;
    }
    return providerDeclarationIdentityEquals(left, right);
}
function providerDeclarationIdentityEquals(left, right) {
    return left.providerId === right.providerId
        && left.providerVersion === right.providerVersion
        && left.providerModuleId === right.providerModuleId
        && left.moduleSpecifier === right.moduleSpecifier
        && left.virtualFileName === right.virtualFileName
        && left.exportName === right.exportName
        && left.exportId === right.exportId
        && left.memberName === right.memberName
        && left.memberId === right.memberId
        && left.signatureId === right.signatureId
        && optionalTargetTypeRefEquals(left.targetIdentity, right.targetIdentity);
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
function targetTypeRefArrayEquals(left, right) {
    if (left === undefined || right === undefined) {
        return left === right;
    }
    return left.length === right.length && left.every((value, index) => targetTypeRefEquals(value, right[index]));
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
function targetMemberEquals(left, right) {
    return left.id === right.id
        && left.sourceName === right.sourceName
        && left.targetName === right.targetName
        && left.kind === right.kind
        && left.static === right.static
        && targetParameterArrayEquals(left.parameters, right.parameters)
        && optionalTargetTypeRefEquals(left.returnType, right.returnType)
        && targetTypeParameterArrayEquals(left.typeParameters, right.typeParameters)
        && left.overloadGroup === right.overloadGroup
        && optionalProviderDeclarationIdentityEquals(left.providerDeclaration, right.providerDeclaration);
}
function optionalTargetParameterEquals(left, right) {
    if (left === undefined || right === undefined) {
        return left === right;
    }
    return targetParameterEquals(left, right);
}
function targetParameterArrayEquals(left, right) {
    return left.length === right.length && left.every((value, index) => targetParameterEquals(value, right[index]));
}
function targetParameterEquals(left, right) {
    return left.name === right.name
        && targetTypeRefEquals(left.type, right.type)
        && left.passingMode === right.passingMode
        && left.optional === right.optional
        && left.paramsArray === right.paramsArray;
}
function targetTypeParameterArrayEquals(left, right) {
    if (left === undefined || right === undefined) {
        return left === right;
    }
    return left.length === right.length && left.every((value, index) => targetTypeParameterEquals(value, right[index]));
}
function targetTypeParameterEquals(left, right) {
    return left.name === right.name
        && left.variance === right.variance
        && targetConstraintArrayEquals(left.constraints, right.constraints);
}
function targetConstraintArrayEquals(left, right) {
    if (left === undefined || right === undefined) {
        return left === right;
    }
    return left.length === right.length && left.every((value, index) => targetConstraintEquals(value, right[index]));
}
function targetConstraintEquals(left, right) {
    if (left.kind !== right.kind) {
        return false;
    }
    switch (left.kind) {
        case "implements":
            return right.kind === "implements"
                && left.contract === right.contract
                && targetTypeRefArrayEquals(left.typeArguments, right.typeArguments);
        case "lifetime":
            return right.kind === "lifetime" && left.name === right.name;
        case "target-specific":
            return right.kind === "target-specific" && left.target === right.target && left.name === right.name && Object.is(left.value, right.value);
        case "value-type":
        case "reference-type":
        case "constructible":
        case "unmanaged":
        case "copy":
        case "clone":
        case "default":
        case "sized":
            return true;
    }
}
function optionalTargetOperationFactEquals(left, right) {
    if (left === undefined || right === undefined) {
        return left === right;
    }
    return targetOperationFactEquals(left, right);
}
function targetOperationFactEquals(left, right) {
    return left.operationId === right.operationId
        && left.operationKind === right.operationKind
        && left.targetOperation === right.targetOperation
        && left.resultType === right.resultType
        && optionalTargetOperationProvenanceEquals(left.provenance, right.provenance);
}
function optionalTargetOperationProvenanceEquals(left, right) {
    if (left === undefined || right === undefined) {
        return left === right;
    }
    return optionalProviderDeclarationIdentityEquals(left.providerDeclaration, right.providerDeclaration)
        && left.sourceExpression === right.sourceExpression
        && left.sourceReceiver === right.sourceReceiver
        && left.sourceCallee === right.sourceCallee
        && left.sourceSelectedSymbol === right.sourceSelectedSymbol
        && left.sourceSelectedSignature === right.sourceSelectedSignature;
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
function targetTypeRefEquals(left, right) {
    if (left.kind !== right.kind) {
        return false;
    }
    switch (left.kind) {
        case "source-primitive":
            return right.kind === "source-primitive" && left.name === right.name;
        case "target-named":
            return right.kind === "target-named"
                && left.id === right.id
                && targetTypeRefListEquals(left.typeArguments ?? [], right.typeArguments ?? []);
        case "type-parameter":
            return right.kind === "type-parameter" && left.name === right.name;
        case "array":
            return right.kind === "array" && left.rank === right.rank && targetTypeRefEquals(left.element, right.element);
        case "tuple":
            return right.kind === "tuple" && targetTypeRefListEquals(left.elements, right.elements);
        case "pointer":
            return right.kind === "pointer" && left.mutability === right.mutability && targetTypeRefEquals(left.pointee, right.pointee);
        case "function-pointer":
            return right.kind === "function-pointer"
                && targetTypeRefListEquals(left.args, right.args)
                && targetTypeRefEquals(left.result, right.result)
                && stringListEquals(left.abi ?? [], right.abi ?? []);
        case "opaque":
            return right.kind === "opaque" && left.id === right.id;
        case "associated-type":
            return right.kind === "associated-type" && left.name === right.name && targetTypeRefEquals(left.owner, right.owner);
        case "lifetime":
            return right.kind === "lifetime" && left.name === right.name;
        case "target-specific":
            return right.kind === "target-specific" && left.target === right.target && left.name === right.name && Object.is(left.value, right.value);
    }
}
function targetTypeRefListEquals(left, right) {
    return left.length === right.length && left.every((item, index) => targetTypeRefEquals(item, right[index]));
}
function stringListEquals(left, right) {
    return left.length === right.length && left.every((item, index) => item === right[index]);
}
//# sourceMappingURL=facts.js.map