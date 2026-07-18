import { ExtensionObservationPoint } from "./observations.js";
import { selectedTargetSignatureEquals, targetParameterEquals, targetTypeRefEquals } from "./facts.js";
export function checkedOperationRequestEquals(observation, left, right) {
    return differingCheckedOperationRequestFields(observation, left, right).length === 0;
}
export function differingCheckedOperationRequestFields(observation, left, right) {
    const differences = [];
    switch (observation) {
        case ExtensionObservationPoint.mapCheckedCall:
            compareCallRequests(left, right, differences);
            break;
        case ExtensionObservationPoint.mapCheckedPropertyAccess:
            comparePropertyRequests(left, right, differences);
            break;
        case ExtensionObservationPoint.mapCheckedElementAccess:
            compareElementRequests(left, right, differences);
            break;
        case ExtensionObservationPoint.mapCheckedOperator:
            compareOperatorRequests(left, right, differences);
            break;
        case ExtensionObservationPoint.mapCheckedIteration:
            compareIterationRequests(left, right, differences);
            break;
        case ExtensionObservationPoint.mapCheckedConversion:
            compareConversionRequests(left, right, differences);
            break;
    }
    return Object.freeze(differences);
}
function compareCallRequests(left, right, differences) {
    compareIdentity(differences, "call", left.call, right.call);
    compareIdentity(differences, "callee", left.callee, right.callee);
    compareArray(differences, "arguments", left.arguments, right.arguments, Object.is);
    compareIdentity(differences, "callKind", left.callKind, right.callKind);
    compareIdentity(differences, "sourceSelectedSignature", left.sourceSelectedSignature, right.sourceSelectedSignature);
    compareIdentity(differences, "sourceSelectedDeclaration", left.sourceSelectedDeclaration, right.sourceSelectedDeclaration);
    compareArray(differences, "sourceSelectedMethodTypeArguments", left.sourceSelectedMethodTypeArguments, right.sourceSelectedMethodTypeArguments, selectedMethodTypeArgumentEquals);
    compareArray(differences, "sourceSelectedSignatureParameters", left.sourceSelectedSignatureParameters, right.sourceSelectedSignatureParameters, selectedSignatureParameterEquals);
    compareIdentity(differences, "sourceSelectedSignatureKind", left.sourceSelectedSignatureKind, right.sourceSelectedSignatureKind);
    compareArray(differences, "sourceArgumentBindings", left.sourceArgumentBindings, right.sourceArgumentBindings, selectedCallArgumentBindingEquals);
    compareSelectedSourceValueEvidence(differences, "sourceCallee", left.sourceCallee, right.sourceCallee);
    compareArray(differences, "sourceArguments", left.sourceArguments, right.sourceArguments, selectedSourceValueEvidenceEquals);
    compareSelectedSourceValueEvidence(differences, "sourceResult", left.sourceResult, right.sourceResult);
    compareOptionalSelectedSourceValueEvidence(differences, "sourceReceiver", left.sourceReceiver, right.sourceReceiver);
    compareIdentity(differences, "optionalChain", left.optionalChain, right.optionalChain);
    compareIdentity(differences, "target", left.target, right.target);
}
function comparePropertyRequests(left, right, differences) {
    compareIdentity(differences, "expression", left.expression, right.expression);
    compareIdentity(differences, "receiver", left.receiver, right.receiver);
    compareIdentity(differences, "propertyName", left.propertyName, right.propertyName);
    compareIdentity(differences, "accessMode", left.accessMode, right.accessMode);
    compareIdentity(differences, "callCallee", left.callCallee, right.callCallee);
    compareSelectedSourceValueEvidence(differences, "sourceReceiver", left.sourceReceiver, right.sourceReceiver);
    compareSelectedSourceValueEvidence(differences, "sourceResult", left.sourceResult, right.sourceResult);
    compareIdentity(differences, "optionalChain", left.optionalChain, right.optionalChain);
    compareIdentity(differences, "target", left.target, right.target);
}
function compareElementRequests(left, right, differences) {
    compareIdentity(differences, "expression", left.expression, right.expression);
    compareIdentity(differences, "receiver", left.receiver, right.receiver);
    compareIdentity(differences, "argument", left.argument, right.argument);
    compareIdentity(differences, "accessMode", left.accessMode, right.accessMode);
    compareIdentity(differences, "callCallee", left.callCallee, right.callCallee);
    compareSelectedSourceValueEvidence(differences, "sourceReceiver", left.sourceReceiver, right.sourceReceiver);
    compareSelectedSourceValueEvidence(differences, "sourceArgument", left.sourceArgument, right.sourceArgument);
    compareSelectedSourceValueEvidence(differences, "sourceResult", left.sourceResult, right.sourceResult);
    compareIdentity(differences, "sourceSelectedElementIndex", left.sourceSelectedElementIndex, right.sourceSelectedElementIndex);
    compareIdentity(differences, "optionalChain", left.optionalChain, right.optionalChain);
    compareIdentity(differences, "target", left.target, right.target);
}
function compareOperatorRequests(left, right, differences) {
    compareIdentity(differences, "expression", left.expression, right.expression);
    compareIdentity(differences, "operator", left.operator, right.operator);
    compareIdentity(differences, "left", left.left, right.left);
    compareIdentity(differences, "right", left.right, right.right);
    compareOptionalSelectedSourceValueEvidence(differences, "sourceLeft", left.sourceLeft, right.sourceLeft);
    compareOptionalSelectedSourceValueEvidence(differences, "sourceRight", left.sourceRight, right.sourceRight);
    compareSelectedSourceValueEvidence(differences, "sourceResult", left.sourceResult, right.sourceResult);
    compareIdentity(differences, "target", left.target, right.target);
}
function compareIterationRequests(left, right, differences) {
    compareIdentity(differences, "statement", left.statement, right.statement);
    compareIdentity(differences, "expression", left.expression, right.expression);
    compareIdentity(differences, "initializer", left.initializer, right.initializer);
    compareIdentity(differences, "kind", left.kind, right.kind);
    compareSelectedSourceValueEvidence(differences, "sourceIterable", left.sourceIterable, right.sourceIterable);
    compareSelectedSourceTypeEvidence(differences, "sourceElement", left.sourceElement, right.sourceElement);
    compareIdentity(differences, "target", left.target, right.target);
}
function compareConversionRequests(left, right, differences) {
    compareIdentity(differences, "conversionKind", left.conversionKind, right.conversionKind);
    compareIdentity(differences, "expression", left.expression, right.expression);
    compareSelectedSourceValueEvidence(differences, "source", left.source, right.source);
    compareIdentity(differences, "targetPlatform", left.targetPlatform, right.targetPlatform);
    if (left.conversionKind === "call-argument" && right.conversionKind === "call-argument") {
        compareValue(differences, "target", left.target, right.target, targetTypeRefEquals);
        compareIdentity(differences, "call", left.call, right.call);
        compareIdentity(differences, "slot", left.slot, right.slot);
        compareIdentity(differences, "sourceArgumentIndex", left.sourceArgumentIndex, right.sourceArgumentIndex);
        compareIdentity(differences, "targetParameterIndex", left.targetParameterIndex, right.targetParameterIndex);
        compareIdentity(differences, "sourceForm", left.sourceForm, right.sourceForm);
        compareIdentity(differences, "spreadElementIndex", left.spreadElementIndex, right.spreadElementIndex);
        compareIdentity(differences, "targetForm", left.targetForm, right.targetForm);
        compareValue(differences, "targetParameter", left.targetParameter, right.targetParameter, targetParameterEquals);
        compareIdentity(differences, "sourceSelectedSignature", left.sourceSelectedSignature, right.sourceSelectedSignature);
        compareValue(differences, "selectedSignature", left.selectedSignature, right.selectedSignature, selectedTargetSignatureEquals);
        compareValue(differences, "sourceBinding", left.sourceBinding, right.sourceBinding, selectedCallArgumentBindingEquals);
        return;
    }
    if (left.conversionKind === "assertion" && right.conversionKind === "assertion") {
        compareSelectedSourceTypeEvidence(differences, "target", left.target, right.target);
        compareIdentity(differences, "assertionKind", left.assertionKind, right.assertionKind);
        compareIdentity(differences, "explicitTargetTypeNode", left.explicitTargetTypeNode, right.explicitTargetTypeNode);
    }
}
function compareSelectedSourceTypeEvidence(differences, field, left, right) {
    if (!selectedSourceTypeEvidenceEquals(left, right)) {
        differences.push(field);
    }
}
function compareSelectedSourceValueEvidence(differences, field, left, right) {
    if (!selectedSourceValueEvidenceEquals(left, right)) {
        differences.push(field);
    }
}
function compareOptionalSelectedSourceValueEvidence(differences, field, left, right) {
    compareOptionalValue(differences, field, left, right, selectedSourceValueEvidenceEquals);
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
function compareIdentity(differences, field, left, right) {
    if (!Object.is(left, right)) {
        differences.push(field);
    }
}
function compareValue(differences, field, left, right, equals) {
    if (!equals(left, right)) {
        differences.push(field);
    }
}
function compareOptionalValue(differences, field, left, right, equals) {
    if (left === undefined || right === undefined) {
        if (left !== right) {
            differences.push(field);
        }
        return;
    }
    compareValue(differences, field, left, right, equals);
}
function compareArray(differences, field, left, right, equals) {
    if (!optionalArrayEquals(left, right, equals)) {
        differences.push(field);
    }
}
function optionalArrayEquals(left, right, equals) {
    if (left === right) {
        return true;
    }
    if (left === undefined || right === undefined || left.length !== right.length) {
        return false;
    }
    for (let index = 0; index < left.length; index++) {
        const leftValue = left[index];
        const rightValue = right[index];
        if (leftValue === undefined || rightValue === undefined || !equals(leftValue, rightValue)) {
            return false;
        }
    }
    return true;
}
function selectedMethodTypeArgumentEquals(left, right) {
    return left.typeParameterName === right.typeParameterName
        && left.typeParameter === right.typeParameter
        && left.selectedType === right.selectedType
        && left.explicitTypeNode === right.explicitTypeNode;
}
function selectedSignatureParameterEquals(left, right) {
    return left.parameterIndex === right.parameterIndex
        && left.parameterName === right.parameterName
        && left.parameterSymbol === right.parameterSymbol
        && left.parameterDeclaration === right.parameterDeclaration
        && left.selectedType === right.selectedType
        && left.authoredTypeNode === right.authoredTypeNode
        && left.acceptsOmission === right.acceptsOmission
        && left.rest === right.rest;
}
function selectedCallArgumentBindingEquals(left, right) {
    return left.sourceArgumentIndex === right.sourceArgumentIndex
        && left.effectiveArgumentIndex === right.effectiveArgumentIndex
        && left.sourceForm === right.sourceForm
        && left.spreadElementIndex === right.spreadElementIndex
        && left.sourceParameterIndex === right.sourceParameterIndex
        && left.sourceParameterForm === right.sourceParameterForm
        && left.selectedArgumentType === right.selectedArgumentType
        && left.selectedParameterType === right.selectedParameterType;
}
//# sourceMappingURL=checked-operation-request-equality.js.map