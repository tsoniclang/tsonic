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
        && left.targetExpression === right.targetExpression,
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
    equals: selectedTargetSignatureEquals,
});
export function selectedTargetSignatureEquals(left, right) {
    return targetMemberEquals(left.member, right.member)
        && targetCallArgumentConversionSlotArrayEquals(left.argumentConversions, right.argumentConversions)
        && sourceSelectedCallArgumentBindingArrayEquals(left.sourceArgumentBindings, right.sourceArgumentBindings)
        && sourceSelectedMethodTypeArgumentArrayEquals(left.sourceSelectedMethodTypeArguments, right.sourceSelectedMethodTypeArguments)
        && sourceSelectedSignatureParameterArrayEquals(left.sourceSelectedSignatureParameters, right.sourceSelectedSignatureParameters)
        && left.sourceSelectedSignatureKind === right.sourceSelectedSignatureKind
        && left.sourceCallKind === right.sourceCallKind
        && targetTypeRefArrayEquals(left.targetTypeArguments, right.targetTypeArguments)
        && left.sourceSignature === right.sourceSignature
        && left.sourceDeclaration === right.sourceDeclaration
        && selectedSourceValueEvidenceEquals(left.sourceCallee, right.sourceCallee)
        && selectedSourceValueEvidenceArrayEquals(left.sourceArguments, right.sourceArguments)
        && selectedSourceValueEvidenceEquals(left.sourceResult, right.sourceResult)
        && left.sourceOptionalChain === right.sourceOptionalChain
        && optionalSelectedSourceValueEvidenceEquals(left.sourceReceiver, right.sourceReceiver)
        && optionalProviderDeclarationIdentityEquals(left.providerDeclaration, right.providerDeclaration);
}
function sourceSelectedCallArgumentBindingArrayEquals(left, right) {
    return left.length === right.length
        && left.every((binding, index) => {
            const other = right[index];
            return other !== undefined
                && binding.sourceArgumentIndex === other.sourceArgumentIndex
                && binding.effectiveArgumentIndex === other.effectiveArgumentIndex
                && binding.sourceForm === other.sourceForm
                && binding.spreadElementIndex === other.spreadElementIndex
                && binding.sourceParameterIndex === other.sourceParameterIndex
                && binding.sourceParameterForm === other.sourceParameterForm
                && binding.selectedArgumentType === other.selectedArgumentType
                && binding.selectedParameterType === other.selectedParameterType;
        });
}
function selectedSourceTypeEvidenceEquals(left, right) {
    return left.type === right.type
        && left.symbol === right.symbol
        && left.declaration === right.declaration
        && left.selectedSymbol === right.selectedSymbol
        && left.selectedDeclaration === right.selectedDeclaration
        && left.authoredTypeNode === right.authoredTypeNode;
}
function selectedSourceValueEvidenceEquals(left, right) {
    return left.expression === right.expression && selectedSourceTypeEvidenceEquals(left, right);
}
function optionalSelectedSourceValueEvidenceEquals(left, right) {
    return left === undefined || right === undefined
        ? left === right
        : selectedSourceValueEvidenceEquals(left, right);
}
function selectedSourceValueEvidenceArrayEquals(left, right) {
    return left.length === right.length
        && left.every((evidence, index) => selectedSourceValueEvidenceEquals(evidence, right[index]));
}
function targetCallArgumentConversionSlotArrayEquals(left, right) {
    return left.length === right.length
        && left.every((slot, index) => {
            const other = right[index];
            return other !== undefined
                && slot.sourceArgumentIndex === other.sourceArgumentIndex
                && slot.sourceForm === other.sourceForm
                && slot.spreadElementIndex === other.spreadElementIndex
                && slot.targetParameterIndex === other.targetParameterIndex
                && slot.targetForm === other.targetForm;
        });
}
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
export const targetCallArgumentConversionFactKey = defineExtensionFactKey({
    extensionId: "tsts.target-bindings",
    name: "targetCallArgumentConversion",
    equals: (left, right) => left.slot === right.slot
        && left.call === right.call
        && left.sourceArgumentIndex === right.sourceArgumentIndex
        && left.targetParameterIndex === right.targetParameterIndex
        && left.sourceForm === right.sourceForm
        && left.spreadElementIndex === right.spreadElementIndex
        && left.targetForm === right.targetForm
        && optionalTargetTypeRefEquals(left.convertedType, right.convertedType)
        && optionalTargetOperationFactEquals(left.operation, right.operation),
});
export const targetCallArgumentPassingFactKey = defineExtensionFactKey({
    extensionId: "tsts.target-bindings",
    name: "targetCallArgumentPassing",
    equals: (left, right) => left.slot === right.slot
        && left.mode === right.mode
        && left.targetExpression === right.targetExpression
        && left.call === right.call
        && left.sourceArgumentIndex === right.sourceArgumentIndex
        && left.targetParameterIndex === right.targetParameterIndex
        && left.sourceForm === right.sourceForm
        && left.spreadElementIndex === right.spreadElementIndex
        && left.targetForm === right.targetForm
        && targetParameterEquals(left.targetParameter, right.targetParameter)
        && optionalProviderDeclarationIdentityEquals(left.selectedSignature, right.selectedSignature),
});
export const providerVirtualDeclarationFactKey = defineExtensionFactKey({
    extensionId: "tsts.provider",
    name: "virtualDeclaration",
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
    equals: (left, right) => left.exportName === right.exportName
        && providerTypeFamilyVariantArrayEquals(left.variants, right.variants),
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
function optionalProviderMemberKeyEquals(left, right) {
    if (left === undefined || right === undefined) {
        return left === right;
    }
    return left.kind === right.kind && left.name === right.name;
}
function providerDeclarationIdentityEquals(left, right) {
    return left.providerId === right.providerId
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
function targetParameterArrayEquals(left, right) {
    return left.length === right.length && left.every((value, index) => targetParameterEquals(value, right[index]));
}
export function targetParameterEquals(left, right) {
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
        && optionalTargetTypeRefEquals(left.resultType, right.resultType)
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
        && left.sourceSelectedDeclaration === right.sourceSelectedDeclaration
        && left.sourceSelectedSignature === right.sourceSelectedSignature
        && left.sourceResultType === right.sourceResultType
        && left.sourceReceiverType === right.sourceReceiverType
        && left.sourceOptionalChain === right.sourceOptionalChain
        && left.sourceAccessMode === right.sourceAccessMode
        && left.sourceCallCallee === right.sourceCallCallee;
}
function sourceSelectedMethodTypeArgumentArrayEquals(left, right) {
    if (left === undefined || right === undefined) {
        return left === right;
    }
    if (left.length !== right.length) {
        return false;
    }
    return left.every((argument, index) => sourceSelectedMethodTypeArgumentEquals(argument, right[index]));
}
function sourceSelectedMethodTypeArgumentEquals(left, right) {
    return left.typeParameterName === right.typeParameterName
        && left.typeParameter === right.typeParameter
        && left.selectedType === right.selectedType
        && left.explicitTypeNode === right.explicitTypeNode;
}
function sourceSelectedSignatureParameterArrayEquals(left, right) {
    if (left === undefined || right === undefined) {
        return left === right;
    }
    if (left.length !== right.length) {
        return false;
    }
    return left.every((parameter, index) => sourceSelectedSignatureParameterEquals(parameter, right[index]));
}
function sourceSelectedSignatureParameterEquals(left, right) {
    return left.parameterIndex === right.parameterIndex
        && left.parameterName === right.parameterName
        && left.parameterSymbol === right.parameterSymbol
        && left.parameterDeclaration === right.parameterDeclaration
        && left.selectedType === right.selectedType
        && left.authoredTypeNode === right.authoredTypeNode
        && left.acceptsOmission === right.acceptsOmission
        && left.rest === right.rest;
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
export function targetTypeRefEquals(left, right) {
    const pending = [[left, right]];
    const compared = new WeakMap();
    const queueLists = (leftItems, rightItems) => {
        if (leftItems.length !== rightItems.length) {
            return false;
        }
        for (let index = 0; index < leftItems.length; index++) {
            pending.push([leftItems[index], rightItems[index]]);
        }
        return true;
    };
    while (pending.length !== 0) {
        const [currentLeft, currentRight] = pending.pop();
        if (currentLeft === currentRight) {
            continue;
        }
        let rightComparisons = compared.get(currentLeft);
        if (rightComparisons?.has(currentRight) === true) {
            continue;
        }
        if (rightComparisons === undefined) {
            rightComparisons = new WeakSet();
            compared.set(currentLeft, rightComparisons);
        }
        rightComparisons.add(currentRight);
        if (currentLeft.kind !== currentRight.kind) {
            return false;
        }
        switch (currentLeft.kind) {
            case "source-primitive":
                if (currentRight.kind !== "source-primitive" || currentLeft.name !== currentRight.name)
                    return false;
                break;
            case "source-global":
                if (currentRight.kind !== "source-global"
                    || currentLeft.name !== currentRight.name
                    || !queueLists(currentLeft.typeArguments ?? [], currentRight.typeArguments ?? []))
                    return false;
                break;
            case "target-named":
                if (currentRight.kind !== "target-named"
                    || currentLeft.id !== currentRight.id
                    || !queueLists(currentLeft.typeArguments ?? [], currentRight.typeArguments ?? []))
                    return false;
                break;
            case "type-parameter":
                if (currentRight.kind !== "type-parameter" || currentLeft.name !== currentRight.name)
                    return false;
                break;
            case "array":
                if (currentRight.kind !== "array" || currentLeft.rank !== currentRight.rank)
                    return false;
                pending.push([currentLeft.element, currentRight.element]);
                break;
            case "tuple":
                if (currentRight.kind !== "tuple" || !queueLists(currentLeft.elements, currentRight.elements))
                    return false;
                break;
            case "pointer":
                if (currentRight.kind !== "pointer" || currentLeft.mutability !== currentRight.mutability)
                    return false;
                pending.push([currentLeft.pointee, currentRight.pointee]);
                break;
            case "function-pointer":
                if (currentRight.kind !== "function-pointer"
                    || !stringListEquals(currentLeft.abi ?? [], currentRight.abi ?? [])
                    || !queueLists(currentLeft.args, currentRight.args))
                    return false;
                pending.push([currentLeft.result, currentRight.result]);
                break;
            case "opaque":
                if (currentRight.kind !== "opaque" || currentLeft.id !== currentRight.id)
                    return false;
                break;
            case "associated-type":
                if (currentRight.kind !== "associated-type" || currentLeft.name !== currentRight.name)
                    return false;
                pending.push([currentLeft.owner, currentRight.owner]);
                break;
            case "lifetime":
                if (currentRight.kind !== "lifetime" || currentLeft.name !== currentRight.name)
                    return false;
                break;
            case "target-specific":
                if (currentRight.kind !== "target-specific"
                    || currentLeft.target !== currentRight.target
                    || currentLeft.name !== currentRight.name
                    || !Object.is(currentLeft.value, currentRight.value))
                    return false;
                break;
        }
    }
    return true;
}
function stringListEquals(left, right) {
    return left.length === right.length && left.every((item, index) => item === right[index]);
}
//# sourceMappingURL=facts.js.map