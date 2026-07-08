import { Node_Arguments, Node_Expression, Node_Symbol, Node_Text, Node_TypeArguments } from "../internal/ast/ast.js";
import { Node_Name } from "../internal/ast/spine.js";
import { AsElementAccessExpression, AsForInOrOfStatement } from "../internal/ast/generated/casts.js";
import { TokenToString } from "../internal/scanner/scanner.js";
import { ExtensionObservationPoint } from "./observations.js";
import { argumentPassingFactKey, contextualTargetTypeFactKey, flowStateFactKey, providerVirtualDeclarationFactKey, runtimeCarrierFactKey, selectedTargetSignatureFactKey, sourcePrimitiveFactKey, targetBindingFactKey, targetConversionFactKey, targetOperationFactKey } from "./facts.js";
import { getExtensionHost } from "./host.js";
export function recordExtensionCheckedCallMapping(checker, callExpression, sourceSelectedSignature, resolvedCalleeSymbol) {
    if (checker === undefined || callExpression === undefined) {
        return;
    }
    const extensionHost = getExtensionHost(checker.program);
    if (extensionHost === undefined || extensionHost.getObservationOwner(ExtensionObservationPoint.mapCheckedCall) === undefined) {
        return;
    }
    const callee = Node_Expression(callExpression);
    if (callee === undefined) {
        return;
    }
    const sourceCalleeSymbol = selectedSourceSymbol(checker, resolvedCalleeSymbol ?? Node_Symbol(callee));
    const sourceCalleeDeclaration = primarySymbolDeclaration(sourceCalleeSymbol);
    const sourceSelectedMethodTypeArguments = getSourceSelectedMethodTypeArguments(callExpression, sourceSelectedSignature);
    const result = extensionHost.runObservation(ExtensionObservationPoint.mapCheckedCall, {
        call: callExpression,
        callee,
        arguments: definedFactSubjects(Node_Arguments(callExpression) ?? []),
        ...(sourceSelectedSignature !== undefined ? { sourceSelectedSignature } : {}),
        ...(sourceSelectedSignature?.declaration !== undefined ? { sourceSelectedDeclaration: sourceSelectedSignature.declaration } : {}),
        ...(sourceSelectedMethodTypeArguments !== undefined ? { sourceSelectedMethodTypeArguments } : {}),
        ...(sourceCalleeSymbol !== undefined ? { sourceCalleeSymbol } : {}),
        ...(sourceCalleeDeclaration !== undefined ? { sourceCalleeDeclaration } : {}),
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    }, () => {
        throw new Error("Extension-owned checked call mapping unexpectedly reached core fallback.");
    }, { requireOwner: true });
    if (result.kind !== "accept") {
        return;
    }
    const arguments_ = Node_Arguments(callExpression) ?? [];
    const selectedSignature = withSelectedTargetSignatureProvenance(recordExtensionTargetTypeArgumentMapping(extensionHost, callee, sourceSelectedSignature, sourceSelectedMethodTypeArguments, result.value, arguments_), sourceSelectedSignature, sourceSelectedMethodTypeArguments);
    extensionHost.facts.set(callExpression, selectedTargetSignatureFactKey, selectedSignature, result.evidence ?? []);
    recordExtensionCallParameterModes(extensionHost, { ...result.value, selectedSignature }, arguments_);
    recordExtensionCallArgumentConversions(extensionHost, { ...result.value, selectedSignature }, arguments_);
}
export function recordExtensionCheckedPropertyAccessMapping(checker, propertyAccessExpression, resolvedSelectedSymbol) {
    if (checker === undefined || propertyAccessExpression === undefined) {
        return;
    }
    const extensionHost = getExtensionHost(checker.program);
    if (extensionHost === undefined || extensionHost.getObservationOwner(ExtensionObservationPoint.mapCheckedPropertyAccess) === undefined) {
        return;
    }
    const receiver = Node_Expression(propertyAccessExpression);
    const propertyName = Node_Text(Node_Name(propertyAccessExpression));
    if (receiver === undefined || propertyName === "") {
        return;
    }
    const sourceSelectedSymbol = selectedSourceSymbol(checker, resolvedSelectedSymbol ?? Node_Symbol(Node_Name(propertyAccessExpression)));
    const sourceSelectedDeclaration = primarySymbolDeclaration(sourceSelectedSymbol);
    const result = extensionHost.runObservation(ExtensionObservationPoint.mapCheckedPropertyAccess, {
        expression: propertyAccessExpression,
        receiver,
        propertyName,
        ...(sourceSelectedSymbol !== undefined ? { sourceSelectedSymbol } : {}),
        ...(sourceSelectedDeclaration !== undefined ? { sourceSelectedDeclaration } : {}),
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    }, () => {
        throw new Error("Extension-owned checked property access mapping unexpectedly reached core fallback.");
    }, { requireOwner: true });
    if (result.kind !== "accept") {
        return;
    }
    const operation = result.value.provenance === undefined
        ? result.value.operation
        : withTargetOperationProvenance(result.value.operation, result.value.provenance);
    extensionHost.facts.set(propertyAccessExpression, targetOperationFactKey, withTargetOperationProvenance(operation, {
        sourceExpression: propertyAccessExpression,
        sourceReceiver: receiver,
        ...(sourceSelectedSymbol !== undefined ? { sourceSelectedSymbol } : {}),
        ...(sourceSelectedDeclaration !== undefined ? { sourceSelectedDeclaration } : {}),
    }), result.evidence ?? []);
}
export function recordExtensionCheckedElementAccessMapping(checker, elementAccessExpression, resolvedSelectedSymbol) {
    if (checker === undefined || elementAccessExpression === undefined) {
        return;
    }
    const extensionHost = getExtensionHost(checker.program);
    if (extensionHost === undefined || extensionHost.getObservationOwner(ExtensionObservationPoint.mapCheckedElementAccess) === undefined) {
        return;
    }
    const receiver = Node_Expression(elementAccessExpression);
    const argument = AsElementAccessExpression(elementAccessExpression)?.ArgumentExpression;
    if (receiver === undefined || argument === undefined) {
        return;
    }
    const sourceSelectedSymbol = selectedSourceSymbol(checker, resolvedSelectedSymbol ?? Node_Symbol(elementAccessExpression));
    const sourceSelectedDeclaration = primarySymbolDeclaration(sourceSelectedSymbol);
    const result = extensionHost.runObservation(ExtensionObservationPoint.mapCheckedElementAccess, {
        expression: elementAccessExpression,
        receiver,
        argument,
        ...(sourceSelectedSymbol !== undefined ? { sourceSelectedSymbol } : {}),
        ...(sourceSelectedDeclaration !== undefined ? { sourceSelectedDeclaration } : {}),
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    }, () => {
        throw new Error("Extension-owned checked element access mapping unexpectedly reached core fallback.");
    }, { requireOwner: true });
    if (result.kind !== "accept") {
        return;
    }
    const operation = result.value.provenance === undefined
        ? result.value.operation
        : withTargetOperationProvenance(result.value.operation, result.value.provenance);
    extensionHost.facts.set(elementAccessExpression, targetOperationFactKey, withTargetOperationProvenance(operation, {
        sourceExpression: elementAccessExpression,
        sourceReceiver: receiver,
        ...(sourceSelectedSymbol !== undefined ? { sourceSelectedSymbol } : {}),
        ...(sourceSelectedDeclaration !== undefined ? { sourceSelectedDeclaration } : {}),
    }), result.evidence ?? []);
}
export function recordExtensionCheckedOperatorMapping(checker, expression, operatorToken, left, right) {
    if (checker === undefined || expression === undefined || operatorToken === undefined || left === undefined) {
        return;
    }
    const extensionHost = getExtensionHost(checker.program);
    if (extensionHost === undefined || extensionHost.getObservationOwner(ExtensionObservationPoint.mapCheckedOperator) === undefined) {
        return;
    }
    const result = extensionHost.runObservation(ExtensionObservationPoint.mapCheckedOperator, {
        expression,
        operator: TokenToString(operatorToken.Kind),
        left,
        ...(right !== undefined ? { right } : {}),
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    }, () => {
        throw new Error("Extension-owned checked operator mapping unexpectedly reached core fallback.");
    }, { requireOwner: true });
    if (result.kind !== "accept") {
        return;
    }
    const operation = result.value.provenance === undefined
        ? result.value.operation
        : withTargetOperationProvenance(result.value.operation, result.value.provenance);
    extensionHost.facts.set(expression, targetOperationFactKey, withTargetOperationProvenance(operation, {
        sourceExpression: expression,
    }), result.evidence ?? []);
}
export function recordExtensionCheckedIterationMapping(checker, statement, kind, sourceElementType) {
    if (checker === undefined || statement === undefined) {
        return;
    }
    const extensionHost = getExtensionHost(checker.program);
    if (extensionHost === undefined || extensionHost.getObservationOwner(ExtensionObservationPoint.mapCheckedIteration) === undefined) {
        return;
    }
    const data = AsForInOrOfStatement(statement);
    const expression = data?.Expression;
    if (expression === undefined) {
        return;
    }
    const result = extensionHost.runObservation(ExtensionObservationPoint.mapCheckedIteration, {
        statement,
        expression,
        ...(data?.Initializer !== undefined ? { initializer: data.Initializer } : {}),
        kind,
        ...(sourceElementType !== undefined ? { sourceElementType } : {}),
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    }, () => {
        throw new Error("Extension-owned checked iteration mapping unexpectedly reached core fallback.");
    }, { requireOwner: true });
    if (result.kind !== "accept") {
        return;
    }
    const operation = result.value.provenance === undefined
        ? result.value.operation
        : withTargetOperationProvenance(result.value.operation, result.value.provenance);
    extensionHost.facts.set(statement, targetOperationFactKey, withTargetOperationProvenance(operation, {
        sourceExpression: statement,
        sourceReceiver: expression,
    }), result.evidence ?? []);
}
export function recordExtensionTargetConstraintValidation(checker, typeReference, symbol) {
    if (checker === undefined || typeReference === undefined || symbol === undefined) {
        return true;
    }
    const extensionHost = getExtensionHost(checker.program);
    if (extensionHost === undefined || extensionHost.getObservationOwner(ExtensionObservationPoint.validateTargetConstraint) === undefined) {
        return true;
    }
    const targetBinding = extensionHost.facts.get(symbol, targetBindingFactKey);
    const typeParameters = targetBinding?.typeParameters ?? [];
    const typeArguments = Node_TypeArguments(typeReference) ?? [];
    if (targetBinding === undefined || typeParameters.length === 0 || typeArguments.length === 0) {
        return true;
    }
    let valid = true;
    for (let parameterIndex = 0; parameterIndex < typeParameters.length; parameterIndex++) {
        const parameter = typeParameters[parameterIndex];
        const argument = typeArguments[parameterIndex];
        if (parameter === undefined || argument === undefined) {
            continue;
        }
        for (const constraint of parameter.constraints ?? []) {
            const result = extensionHost.runObservation(ExtensionObservationPoint.validateTargetConstraint, {
                source: argument,
                constraint,
                target: extensionHost.activeTarget ?? targetBinding.target,
            }, () => {
                throw new Error("Extension-owned target constraint checking unexpectedly reached core fallback.");
            }, { requireOwner: true });
            if (result.kind !== "accept" || !result.value) {
                valid = false;
            }
        }
    }
    return valid;
}
export function recordExtensionRuntimeCarrierFact(checker, typeReference, type, symbol) {
    if (checker === undefined || type === undefined) {
        return;
    }
    const extensionHost = getExtensionHost(checker.program);
    if (extensionHost === undefined || extensionHost.getObservationOwner(ExtensionObservationPoint.resolveRuntimeCarrier) === undefined) {
        return;
    }
    if (!hasExtensionOwnedSubject(extensionHost, type) && !hasExtensionOwnedSubject(extensionHost, typeReference) && !hasExtensionOwnedSubject(extensionHost, symbol) && !hasExtensionOwnedSubject(extensionHost, type.symbol)) {
        return;
    }
    const result = extensionHost.runObservation(ExtensionObservationPoint.resolveRuntimeCarrier, {
        type,
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    }, () => {
        throw new Error("Extension-owned runtime carrier resolution unexpectedly reached core fallback.");
    }, { requireOwner: true });
    if (result.kind !== "accept") {
        return;
    }
    const fact = {
        carrier: result.value.carrier,
        ...(result.value.requiresAllocation !== undefined ? { requiresAllocation: result.value.requiresAllocation } : {}),
        provenance: {
            ...(result.value.provenance !== undefined ? result.value.provenance : {}),
            sourceType: type,
            ...(typeReference !== undefined ? { sourceTypeReference: typeReference } : {}),
            ...(symbol !== undefined ? { sourceSymbol: symbol } : {}),
        },
    };
    extensionHost.facts.set(type, runtimeCarrierFactKey, fact, result.evidence ?? []);
    setFactOnOptionalSubject(extensionHost, typeReference, runtimeCarrierFactKey, fact, result.evidence ?? []);
    setFactOnOptionalSubject(extensionHost, symbol, runtimeCarrierFactKey, fact, result.evidence ?? []);
    setFactOnOptionalSubject(extensionHost, type.symbol, runtimeCarrierFactKey, fact, result.evidence ?? []);
}
export function recordExtensionContextualTargetTypeFact(checker, expression, contextualType) {
    if (checker === undefined || expression === undefined || contextualType === undefined) {
        return;
    }
    const extensionHost = getExtensionHost(checker.program);
    if (extensionHost === undefined || extensionHost.getObservationOwner(ExtensionObservationPoint.recordContextualTargetType) === undefined) {
        return;
    }
    const result = extensionHost.runObservation(ExtensionObservationPoint.recordContextualTargetType, {
        expression,
        context: contextualType,
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    }, () => ({
        type: contextualType,
    }));
    if (result.kind !== "accept") {
        return;
    }
    extensionHost.facts.set(expression, contextualTargetTypeFactKey, {
        type: result.value.type,
        ...(result.value.targetType !== undefined ? { targetType: result.value.targetType } : {}),
    }, result.evidence ?? []);
}
export function recordExtensionPostCheckAssignabilityObservation(checker, source, target, errorNode, expression, relation) {
    if (checker === undefined || source === undefined || target === undefined) {
        return;
    }
    const extensionHost = getExtensionHost(checker.program);
    if (extensionHost === undefined || extensionHost.getObservationOwner(ExtensionObservationPoint.observePostCheckAssignability) === undefined) {
        return;
    }
    if (!hasExtensionOwnedSubject(extensionHost, source)
        && !hasExtensionOwnedSubject(extensionHost, target)
        && !hasExtensionOwnedSubject(extensionHost, source?.symbol)
        && !hasExtensionOwnedSubject(extensionHost, target?.symbol)
        && !hasExtensionOwnedSubject(extensionHost, errorNode)
        && !hasExtensionOwnedSubject(extensionHost, expression)) {
        return;
    }
    extensionHost.runObservation(ExtensionObservationPoint.observePostCheckAssignability, {
        source,
        target,
        ...(relation !== undefined ? { relation } : {}),
        ...(errorNode !== undefined ? { errorNode } : {}),
        ...(expression !== undefined ? { expression } : {}),
        ...(extensionHost.activeTarget !== undefined ? { targetPlatform: extensionHost.activeTarget } : {}),
    }, () => undefined, { requireOwner: true });
}
export function recordExtensionFlowUseValidation(checker, useSite, symbol) {
    if (checker === undefined || useSite === undefined || symbol === undefined) {
        return;
    }
    const extensionHost = getExtensionHost(checker.program);
    if (extensionHost === undefined || extensionHost.getObservationOwner(ExtensionObservationPoint.validateExtensionFlowUse) === undefined) {
        return;
    }
    const useSiteFlowState = extensionHost.facts.getEntry(useSite, flowStateFactKey);
    if (useSiteFlowState !== undefined) {
        extensionHost.facts.set(symbol, flowStateFactKey, useSiteFlowState.value, useSiteFlowState.evidence);
        return;
    }
    const symbolFlowState = extensionHost.facts.get(symbol, flowStateFactKey);
    if (symbolFlowState === undefined) {
        return;
    }
    const result = extensionHost.runObservation(ExtensionObservationPoint.validateExtensionFlowUse, {
        useSite,
        symbol,
        mode: "read",
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    }, () => {
        throw new Error("Extension-owned flow validation unexpectedly reached core fallback.");
    }, { requireOwner: true });
    if (result.kind !== "accept") {
        return;
    }
    if (result.value.targetCompilerValidationRequired === true) {
        extensionHost.facts.set(useSite, flowStateFactKey, {
            state: "target-validation-required",
            ...(result.value.targetCompiler !== undefined ? { targetCompiler: result.value.targetCompiler } : {}),
        }, result.evidence ?? []);
    }
}
function recordExtensionCallParameterModes(extensionHost, callResult, arguments_) {
    if (extensionHost.getObservationOwner(ExtensionObservationPoint.resolveParameterPassing) === undefined) {
        return;
    }
    const parameters = callResult.selectedSignature.member.parameters;
    for (let index = 0; index < parameters.length; index++) {
        const parameter = parameters[index];
        const argument = arguments_[index];
        if (parameter === undefined || argument === undefined) {
            continue;
        }
        const result = extensionHost.runObservation(ExtensionObservationPoint.resolveParameterPassing, {
            parameter,
            argument,
            parameterIndex: index,
            selectedSignature: callResult.selectedSignature,
            ...(callResult.selectedSignature.sourceSignature !== undefined ? { sourceSelectedSignature: callResult.selectedSignature.sourceSignature } : {}),
            ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
        }, () => {
            throw new Error("Extension-owned parameter mode checking unexpectedly reached core fallback.");
        }, { requireOwner: true });
        if (result.kind !== "accept") {
            continue;
        }
        extensionHost.facts.set(argument, argumentPassingFactKey, withArgumentPassingProvenance(result.value.passing, callResult.selectedSignature, parameter, index), result.evidence ?? []);
    }
}
function recordExtensionTargetTypeArgumentMapping(extensionHost, callee, sourceSelectedSignature, sourceSelectedMethodTypeArguments, callResult, arguments_) {
    if (extensionHost.getObservationOwner(ExtensionObservationPoint.mapInferredSourceTypeArgumentsToTarget) === undefined) {
        return callResult.selectedSignature;
    }
    const result = extensionHost.runObservation(ExtensionObservationPoint.mapInferredSourceTypeArgumentsToTarget, {
        declaration: callee,
        arguments: definedFactSubjects(arguments_),
        ...(sourceSelectedSignature !== undefined ? { sourceSelectedSignature } : {}),
        ...(sourceSelectedMethodTypeArguments !== undefined ? { sourceSelectedMethodTypeArguments } : {}),
        ...(callResult.returnType !== undefined ? { contextualType: callResult.returnType } : {}),
    }, () => ({
        targetTypeArguments: [],
    }), { requireOwner: true });
    if (result.kind !== "accept") {
        return callResult.selectedSignature;
    }
    return {
        ...callResult.selectedSignature,
        targetTypeArguments: result.value.targetTypeArguments,
    };
}
function recordExtensionCallArgumentConversions(extensionHost, callResult, arguments_) {
    if (extensionHost.getObservationOwner(ExtensionObservationPoint.mapCheckedConversion) === undefined) {
        return;
    }
    const parameters = callResult.selectedSignature.member.parameters;
    for (let index = 0; index < parameters.length; index++) {
        const parameter = parameters[index];
        const argument = arguments_[index];
        if (parameter === undefined || argument === undefined) {
            continue;
        }
        const result = extensionHost.runObservation(ExtensionObservationPoint.mapCheckedConversion, {
            expression: argument,
            source: argument,
            target: parameter.type,
            ...(extensionHost.activeTarget !== undefined ? { targetPlatform: extensionHost.activeTarget } : {}),
        }, () => {
            throw new Error("Extension-owned conversion resolution unexpectedly reached core fallback.");
        }, { requireOwner: true });
        if (result.kind !== "accept" || (result.value.convertedType === undefined && result.value.operation === undefined)) {
            continue;
        }
        extensionHost.facts.set(argument, targetConversionFactKey, {
            ...(result.value.convertedType !== undefined ? { convertedType: result.value.convertedType } : {}),
            ...(result.value.operation !== undefined ? { operation: result.value.operation } : {}),
        }, result.evidence ?? []);
    }
}
function definedFactSubjects(subjects) {
    return subjects.filter((subject) => subject !== undefined);
}
function selectedSourceSymbol(checker, symbol) {
    return symbol === undefined || symbol === checker?.unknownSymbol ? undefined : symbol;
}
function primarySymbolDeclaration(symbol) {
    return symbol?.ValueDeclaration ?? symbol?.Declarations?.find((candidate) => candidate !== undefined);
}
function withSelectedTargetSignatureProvenance(signature, sourceSelectedSignature, sourceSelectedMethodTypeArguments) {
    return {
        ...signature,
        ...(signature.sourceSelectedMethodTypeArguments !== undefined || sourceSelectedMethodTypeArguments === undefined ? {} : { sourceSelectedMethodTypeArguments }),
        ...(signature.sourceSignature !== undefined || sourceSelectedSignature === undefined ? {} : { sourceSignature: sourceSelectedSignature }),
        ...(signature.sourceDeclaration !== undefined || sourceSelectedSignature?.declaration === undefined ? {} : { sourceDeclaration: sourceSelectedSignature.declaration }),
        ...(signature.providerDeclaration !== undefined || signature.member.providerDeclaration === undefined ? {} : { providerDeclaration: signature.member.providerDeclaration }),
    };
}
function getSourceSelectedMethodTypeArguments(callExpression, sourceSelectedSignature) {
    if (sourceSelectedSignature === undefined) {
        return undefined;
    }
    const typeParameters = sourceSelectedSignature.target?.typeParameters ?? sourceSelectedSignature.typeParameters ?? [];
    if (typeParameters.length === 0) {
        return undefined;
    }
    const explicitTypeNodes = Node_TypeArguments(callExpression) ?? [];
    const selected = [];
    for (let index = 0; index < typeParameters.length; index++) {
        const typeParameter = typeParameters[index];
        const typeParameterName = typeParameter?.symbol?.Name ?? "";
        if (typeParameter === undefined || typeParameterName === "") {
            return undefined;
        }
        const explicitTypeNode = explicitTypeNodes[index];
        const selectedType = sourceSelectedSignature.mapper?.data.Map(typeParameter);
        if (selectedType === undefined) {
            return undefined;
        }
        selected.push({
            typeParameterName,
            typeParameter,
            selectedType,
            ...(explicitTypeNode !== undefined ? { explicitTypeNode } : {}),
        });
    }
    return selected.length === 0 ? undefined : selected;
}
function withTargetOperationProvenance(operation, provenance) {
    return {
        ...operation,
        provenance: {
            ...(operation.provenance !== undefined ? operation.provenance : {}),
            ...provenance,
        },
    };
}
function withArgumentPassingProvenance(passing, selectedSignature, parameter, parameterIndex) {
    return {
        ...passing,
        parameterIndex: passing.parameterIndex ?? parameterIndex,
        ...(passing.targetParameter !== undefined ? {} : { targetParameter: parameter }),
        ...(passing.selectedSignature !== undefined ? {} : selectedSignature.providerDeclaration !== undefined
            ? { selectedSignature: selectedSignature.providerDeclaration }
            : selectedSignature.member.providerDeclaration !== undefined
                ? { selectedSignature: selectedSignature.member.providerDeclaration }
                : {}),
    };
}
function hasExtensionOwnedSubject(extensionHost, subject) {
    if (subject === undefined) {
        return false;
    }
    return extensionHost.facts.get(subject, targetBindingFactKey) !== undefined
        || extensionHost.facts.get(subject, providerVirtualDeclarationFactKey) !== undefined
        || extensionHost.facts.get(subject, sourcePrimitiveFactKey) !== undefined
        || extensionHost.facts.get(subject, argumentPassingFactKey) !== undefined
        || extensionHost.facts.get(subject, flowStateFactKey) !== undefined
        || extensionHost.facts.get(subject, runtimeCarrierFactKey) !== undefined;
}
function setFactOnOptionalSubject(extensionHost, subject, key, value, evidence) {
    if (subject !== undefined) {
        extensionHost.facts.set(subject, key, value, evidence);
    }
}
//# sourceMappingURL=checker-integration.js.map