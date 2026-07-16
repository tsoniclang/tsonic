import { Node_Arguments, Node_Expression, Node_Symbol, Node_Text, Node_Type, Node_TypeArguments } from "../internal/ast/ast.js";
import { Node_Name } from "../internal/ast/spine.js";
import { SkipParentheses } from "../internal/ast/utilities.js";
import { AsElementAccessExpression, AsForInOrOfStatement } from "../internal/ast/generated/casts.js";
import { NodeFlagsOptionalChain } from "../internal/ast/generated/flags.js";
import { TokenToString } from "../internal/scanner/scanner.js";
import { signatureHasRestParameter } from "../internal/checker/checker/state.js";
import { Type_Flags, Type_Symbol, TypeFlagsUniqueESSymbol } from "../internal/checker/types.js";
import { Checker_GetReturnTypeOfSignature } from "../internal/checker/exports.js";
import { Checker_getMinArgumentCount, Checker_isTypeIdenticalTo } from "../internal/checker/relater.js";
import { Checker_getTypeOfParameter } from "../internal/checker/checker/signatures.js";
import { Checker_getResolvedSymbolOrNil, Checker_resolveSymbol } from "../internal/checker/checker/symbols.js";
import { ExtensionObservationPoint } from "./observations.js";
import { argumentPassingFactKey, contextualTargetTypeFactKey, flowStateFactKey, providerTypeFamilyFactKey, providerVirtualDeclarationFactKey, runtimeCarrierFactKey, selectedTargetSignatureFactKey, sourcePrimitiveFactKey, targetBindingFactKey, targetConversionFactKey, targetOperationFactKey } from "./facts.js";
import { getExtensionHost } from "./host.js";
import { recordProviderTypeFamilyReferenceFacts } from "./compiler-integration.js";
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
    const unwrappedCallee = SkipParentheses(callee);
    const sourceCalleeSymbol = selectedSourceSymbol(checker, resolvedCalleeSymbol ?? Checker_getResolvedSymbolOrNil(checker, unwrappedCallee) ?? Node_Symbol(unwrappedCallee));
    const sourceCalleeDeclaration = primarySymbolDeclaration(sourceCalleeSymbol);
    const sourceSelectedCalleeSymbol = selectedSourceSymbol(checker, sourceCalleeSymbol === undefined ? undefined : Checker_resolveSymbol(checker, sourceCalleeSymbol));
    const sourceSelectedCalleeDeclaration = primarySymbolDeclaration(sourceSelectedCalleeSymbol);
    const sourceSelectedMethodTypeArguments = getSourceSelectedMethodTypeArguments(callExpression, sourceSelectedSignature);
    const sourceSelectedSignatureParameters = getSourceSelectedSignatureParameters(checker, sourceSelectedSignature);
    const sourceSelectedSignatureKind = getSourceSelectedSignatureKind(checker, sourceSelectedSignature);
    const sourceReturnType = sourceSelectedSignature === undefined ? undefined : Checker_GetReturnTypeOfSignature(checker, sourceSelectedSignature);
    const sourceProvenance = {
        sourceSelectedSignature,
        sourceSelectedMethodTypeArguments,
        sourceSelectedSignatureParameters,
        sourceSelectedSignatureKind,
        sourceCalleeSymbol,
        sourceCalleeDeclaration,
        sourceSelectedCalleeSymbol,
        sourceSelectedCalleeDeclaration,
        sourceReturnType,
    };
    const result = extensionHost.runObservation(ExtensionObservationPoint.mapCheckedCall, {
        call: callExpression,
        callee,
        arguments: definedFactSubjects(Node_Arguments(callExpression) ?? []),
        ...(sourceSelectedSignature !== undefined ? { sourceSelectedSignature } : {}),
        ...(sourceSelectedSignature?.declaration !== undefined ? { sourceSelectedDeclaration: sourceSelectedSignature.declaration } : {}),
        ...(sourceSelectedMethodTypeArguments !== undefined ? { sourceSelectedMethodTypeArguments } : {}),
        ...(sourceSelectedSignatureParameters !== undefined ? { sourceSelectedSignatureParameters } : {}),
        ...(sourceSelectedSignatureKind !== undefined ? { sourceSelectedSignatureKind } : {}),
        ...(sourceCalleeSymbol !== undefined ? { sourceCalleeSymbol } : {}),
        ...(sourceCalleeDeclaration !== undefined ? { sourceCalleeDeclaration } : {}),
        ...(sourceSelectedCalleeSymbol !== undefined ? { sourceSelectedCalleeSymbol } : {}),
        ...(sourceSelectedCalleeDeclaration !== undefined ? { sourceSelectedCalleeDeclaration } : {}),
        ...(sourceReturnType !== undefined ? { sourceReturnType } : {}),
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    }, () => {
        throw new Error("Extension-owned checked call mapping unexpectedly reached core fallback.");
    }, { requireOwner: true });
    if (result.kind !== "accept") {
        return;
    }
    const arguments_ = Node_Arguments(callExpression) ?? [];
    const selectedSignature = withSelectedTargetSignatureProvenance(recordExtensionTargetTypeArgumentMapping(extensionHost, callExpression, callee, sourceProvenance, result.value, arguments_), sourceProvenance);
    extensionHost.facts.set(callExpression, selectedTargetSignatureFactKey, selectedSignature, result.evidence ?? []);
    recordExtensionCallParameterModes(extensionHost, callExpression, selectedSignature, arguments_);
    recordExtensionCallArgumentConversions(extensionHost, callExpression, selectedSignature, arguments_);
}
export function recordExtensionCheckedPropertyAccessMapping(checker, propertyAccessExpression, resolvedSelectedSymbol, sourceResultType) {
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
        ...(sourceResultType !== undefined ? { sourceResultType } : {}),
        ...(((propertyAccessExpression.Flags ?? 0) & NodeFlagsOptionalChain) !== 0 ? { optionalChain: true } : {}),
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    }, () => {
        throw new Error("Extension-owned checked property access mapping unexpectedly reached core fallback.");
    }, { requireOwner: true });
    if (result.kind !== "accept") {
        return;
    }
    const operationWithResult = withCheckedOperationResultType(result.value.operation, result.value.resultType);
    const operation = result.value.provenance === undefined
        ? operationWithResult
        : withTargetOperationProvenance(operationWithResult, result.value.provenance);
    const operationWithProvenance = withTargetOperationProvenance(operation, {
        sourceExpression: propertyAccessExpression,
        sourceReceiver: receiver,
        ...(sourceSelectedSymbol !== undefined ? { sourceSelectedSymbol } : {}),
        ...(sourceSelectedDeclaration !== undefined ? { sourceSelectedDeclaration } : {}),
        ...(sourceResultType !== undefined ? { sourceResultType } : {}),
    });
    extensionHost.facts.set(propertyAccessExpression, targetOperationFactKey, preserveEquivalentCheckedSourceResultType(checker, extensionHost, propertyAccessExpression, operationWithProvenance, sourceResultType), result.evidence ?? []);
}
export function recordExtensionCheckedElementAccessMapping(checker, elementAccessExpression, resolvedSelectedSymbol, sourceResultType, sourceSelectedElementIndex) {
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
        ...(sourceSelectedElementIndex !== undefined ? { sourceSelectedElementIndex } : {}),
        ...(sourceResultType !== undefined ? { sourceResultType } : {}),
        ...(((elementAccessExpression.Flags ?? 0) & NodeFlagsOptionalChain) !== 0 ? { optionalChain: true } : {}),
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    }, () => {
        throw new Error("Extension-owned checked element access mapping unexpectedly reached core fallback.");
    }, { requireOwner: true });
    if (result.kind !== "accept") {
        return;
    }
    const operationWithResult = withCheckedOperationResultType(result.value.operation, result.value.resultType);
    const operation = result.value.provenance === undefined
        ? operationWithResult
        : withTargetOperationProvenance(operationWithResult, result.value.provenance);
    const operationWithProvenance = withTargetOperationProvenance(operation, {
        sourceExpression: elementAccessExpression,
        sourceReceiver: receiver,
        ...(sourceSelectedSymbol !== undefined ? { sourceSelectedSymbol } : {}),
        ...(sourceSelectedDeclaration !== undefined ? { sourceSelectedDeclaration } : {}),
        ...(sourceResultType !== undefined ? { sourceResultType } : {}),
    });
    extensionHost.facts.set(elementAccessExpression, targetOperationFactKey, preserveEquivalentCheckedSourceResultType(checker, extensionHost, elementAccessExpression, operationWithProvenance, sourceResultType), result.evidence ?? []);
}
export function recordExtensionCheckedAssertionConversion(checker, assertionExpression, sourceType, targetType, assertionKind) {
    if (checker === undefined || assertionExpression === undefined || sourceType === undefined || targetType === undefined) {
        return;
    }
    const extensionHost = getExtensionHost(checker.program);
    if (extensionHost === undefined) {
        return;
    }
    const sourceExpression = Node_Expression(assertionExpression);
    const explicitTargetTypeNode = Node_Type(assertionExpression);
    if (sourceExpression === undefined || explicitTargetTypeNode === undefined) {
        return;
    }
    const sourceSelectedSymbol = selectedSourceSymbol(checker, Checker_getResolvedSymbolOrNil(checker, SkipParentheses(sourceExpression)));
    const sourceSelectedDeclaration = primarySymbolDeclaration(sourceSelectedSymbol);
    const sourceSelectedDeclarationTypeNode = sourceSelectedDeclaration === undefined ? undefined : Node_Type(sourceSelectedDeclaration);
    recordExtensionCheckedConversion(extensionHost, {
        conversionKind: "assertion",
        assertionKind,
        expression: assertionExpression,
        source: sourceType,
        target: targetType,
        sourceExpression,
        ...(sourceSelectedSymbol !== undefined ? { sourceSelectedSymbol } : {}),
        ...(sourceSelectedDeclaration !== undefined ? { sourceSelectedDeclaration } : {}),
        ...(sourceSelectedDeclarationTypeNode !== undefined ? { sourceSelectedDeclarationTypeNode } : {}),
        explicitTargetTypeNode,
        ...(extensionHost.activeTarget !== undefined ? { targetPlatform: extensionHost.activeTarget } : {}),
    });
}
export function recordExtensionCheckedOperatorMapping(checker, expression, operatorToken, left, right) {
    if (operatorToken === undefined) {
        return;
    }
    recordExtensionCheckedOperatorKindMapping(checker, expression, operatorToken.Kind, left, right);
}
export function recordExtensionCheckedOperatorKindMapping(checker, expression, operator, left, right) {
    if (checker === undefined || expression === undefined || operator === undefined || left === undefined) {
        return;
    }
    const extensionHost = getExtensionHost(checker.program);
    if (extensionHost === undefined || extensionHost.getObservationOwner(ExtensionObservationPoint.mapCheckedOperator) === undefined) {
        return;
    }
    const result = extensionHost.runObservation(ExtensionObservationPoint.mapCheckedOperator, {
        expression,
        operator: TokenToString(operator),
        left,
        ...(right !== undefined ? { right } : {}),
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    }, () => {
        throw new Error("Extension-owned checked operator mapping unexpectedly reached core fallback.");
    }, { requireOwner: true });
    if (result.kind !== "accept") {
        return;
    }
    const operationWithResult = withCheckedOperationResultType(result.value.operation, result.value.resultType);
    const operation = result.value.provenance === undefined
        ? operationWithResult
        : withTargetOperationProvenance(operationWithResult, result.value.provenance);
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
    const operationWithResult = withCheckedOperationResultType(result.value.operation, result.value.resultType);
    const operation = result.value.provenance === undefined
        ? operationWithResult
        : withTargetOperationProvenance(operationWithResult, result.value.provenance);
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
    if (extensionHost === undefined) {
        return;
    }
    recordProviderTypeFamilyReferenceFacts(extensionHost, typeReference, type, symbol);
    if (extensionHost.getObservationOwner(ExtensionObservationPoint.resolveRuntimeCarrier) === undefined) {
        return;
    }
    if (!hasExtensionOwnedSubject(extensionHost, type) && !hasExtensionOwnedSubject(extensionHost, typeReference) && !hasExtensionOwnedSubject(extensionHost, symbol) && !hasExtensionOwnedSubject(extensionHost, type.symbol)) {
        return;
    }
    const result = extensionHost.runObservation(ExtensionObservationPoint.resolveRuntimeCarrier, {
        type,
        ...(typeReference !== undefined ? { sourceTypeReference: typeReference } : {}),
        ...(symbol !== undefined ? { sourceSymbol: symbol } : {}),
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
function recordExtensionCallParameterModes(extensionHost, callExpression, selectedSignature, arguments_) {
    if (extensionHost.getObservationOwner(ExtensionObservationPoint.resolveParameterPassing) === undefined) {
        return;
    }
    const parameters = selectedSignature.member.parameters;
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
            targetParameter: parameter,
            ...(callExpression !== undefined ? { call: callExpression } : {}),
            selectedSignature,
            ...(selectedSignature.sourceSignature !== undefined ? { sourceSelectedSignature: selectedSignature.sourceSignature } : {}),
            ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
        }, () => {
            throw new Error("Extension-owned parameter mode checking unexpectedly reached core fallback.");
        }, { requireOwner: true });
        if (result.kind !== "accept") {
            continue;
        }
        extensionHost.facts.set(argument, argumentPassingFactKey, withArgumentPassingProvenance(result.value.passing, selectedSignature, parameter, index), result.evidence ?? []);
    }
}
function recordExtensionTargetTypeArgumentMapping(extensionHost, callExpression, callee, sourceProvenance, callResult, arguments_) {
    if (extensionHost.getObservationOwner(ExtensionObservationPoint.mapInferredSourceTypeArgumentsToTarget) === undefined) {
        return callResult.selectedSignature;
    }
    const result = extensionHost.runObservation(ExtensionObservationPoint.mapInferredSourceTypeArgumentsToTarget, {
        ...(callExpression !== undefined ? { call: callExpression } : {}),
        declaration: callee,
        arguments: definedFactSubjects(arguments_),
        ...(sourceProvenance.sourceSelectedSignature !== undefined ? { sourceSelectedSignature: sourceProvenance.sourceSelectedSignature } : {}),
        ...(sourceProvenance.sourceSelectedSignature?.declaration !== undefined ? { sourceSelectedDeclaration: sourceProvenance.sourceSelectedSignature.declaration } : {}),
        ...(sourceProvenance.sourceSelectedMethodTypeArguments !== undefined ? { sourceSelectedMethodTypeArguments: sourceProvenance.sourceSelectedMethodTypeArguments } : {}),
        ...(sourceProvenance.sourceSelectedSignatureParameters !== undefined ? { sourceSelectedSignatureParameters: sourceProvenance.sourceSelectedSignatureParameters } : {}),
        ...(sourceProvenance.sourceSelectedSignatureKind !== undefined ? { sourceSelectedSignatureKind: sourceProvenance.sourceSelectedSignatureKind } : {}),
        ...(sourceProvenance.sourceCalleeSymbol !== undefined ? { sourceCalleeSymbol: sourceProvenance.sourceCalleeSymbol } : {}),
        ...(sourceProvenance.sourceCalleeDeclaration !== undefined ? { sourceCalleeDeclaration: sourceProvenance.sourceCalleeDeclaration } : {}),
        ...(sourceProvenance.sourceSelectedCalleeSymbol !== undefined ? { sourceSelectedCalleeSymbol: sourceProvenance.sourceSelectedCalleeSymbol } : {}),
        ...(sourceProvenance.sourceSelectedCalleeDeclaration !== undefined ? { sourceSelectedCalleeDeclaration: sourceProvenance.sourceSelectedCalleeDeclaration } : {}),
        ...(sourceProvenance.sourceReturnType !== undefined ? { sourceReturnType: sourceProvenance.sourceReturnType } : {}),
        ...(callResult.returnType !== undefined ? { contextualType: callResult.returnType } : {}),
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
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
function recordExtensionCallArgumentConversions(extensionHost, callExpression, selectedSignature, arguments_) {
    if (callExpression === undefined || extensionHost.getObservationOwner(ExtensionObservationPoint.mapCheckedConversion) === undefined) {
        return;
    }
    const parameters = selectedSignature.member.parameters;
    for (let index = 0; index < parameters.length; index++) {
        const parameter = parameters[index];
        const argument = arguments_[index];
        if (parameter === undefined || argument === undefined) {
            continue;
        }
        recordExtensionCheckedConversion(extensionHost, {
            conversionKind: "call-argument",
            expression: argument,
            source: argument,
            target: parameter.type,
            call: callExpression,
            parameterIndex: index,
            targetParameter: parameter,
            ...(selectedSignature.sourceSignature !== undefined ? { sourceSelectedSignature: selectedSignature.sourceSignature } : {}),
            selectedSignature,
            ...(extensionHost.activeTarget !== undefined ? { targetPlatform: extensionHost.activeTarget } : {}),
        });
    }
}
function recordExtensionCheckedConversion(extensionHost, request) {
    if (extensionHost.getObservationOwner(ExtensionObservationPoint.mapCheckedConversion) === undefined) {
        return;
    }
    const result = extensionHost.runObservation(ExtensionObservationPoint.mapCheckedConversion, request, () => {
        throw new Error("Extension-owned conversion resolution unexpectedly reached core fallback.");
    }, { requireOwner: true });
    if (result.kind !== "accept" || (result.value.convertedType === undefined && result.value.operation === undefined)) {
        return;
    }
    extensionHost.facts.set(request.expression, targetConversionFactKey, {
        ...(result.value.convertedType !== undefined ? { convertedType: result.value.convertedType } : {}),
        ...(result.value.operation !== undefined ? { operation: result.value.operation } : {}),
    }, result.evidence ?? []);
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
function withSelectedTargetSignatureProvenance(signature, provenance) {
    const sourceSelectedSignature = provenance.sourceSelectedSignature;
    const sourceSelectedMethodTypeArguments = provenance.sourceSelectedMethodTypeArguments;
    const sourceSelectedSignatureParameters = provenance.sourceSelectedSignatureParameters;
    const providerDeclaration = signature.providerDeclaration ?? signature.member.providerDeclaration;
    return {
        member: signature.member,
        ...(signature.targetTypeArguments !== undefined ? { targetTypeArguments: signature.targetTypeArguments } : {}),
        ...(signature.argumentConversions !== undefined ? { argumentConversions: signature.argumentConversions } : {}),
        ...(sourceSelectedMethodTypeArguments !== undefined ? { sourceSelectedMethodTypeArguments } : {}),
        ...(sourceSelectedSignatureParameters !== undefined ? { sourceSelectedSignatureParameters } : {}),
        ...(provenance.sourceSelectedSignatureKind !== undefined ? { sourceSelectedSignatureKind: provenance.sourceSelectedSignatureKind } : {}),
        ...(sourceSelectedSignature !== undefined ? { sourceSignature: sourceSelectedSignature } : {}),
        ...(sourceSelectedSignature?.declaration !== undefined ? { sourceDeclaration: sourceSelectedSignature.declaration } : {}),
        ...(provenance.sourceCalleeSymbol !== undefined ? { sourceCalleeSymbol: provenance.sourceCalleeSymbol } : {}),
        ...(provenance.sourceCalleeDeclaration !== undefined ? { sourceCalleeDeclaration: provenance.sourceCalleeDeclaration } : {}),
        ...(provenance.sourceSelectedCalleeSymbol !== undefined ? { sourceSelectedCalleeSymbol: provenance.sourceSelectedCalleeSymbol } : {}),
        ...(provenance.sourceSelectedCalleeDeclaration !== undefined ? { sourceSelectedCalleeDeclaration: provenance.sourceSelectedCalleeDeclaration } : {}),
        ...(provenance.sourceReturnType !== undefined ? { sourceReturnType: provenance.sourceReturnType } : {}),
        ...(providerDeclaration !== undefined ? { providerDeclaration } : {}),
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
function getSourceSelectedSignatureParameters(checker, sourceSelectedSignature) {
    if (checker === undefined || sourceSelectedSignature === undefined) {
        return undefined;
    }
    const selected = [];
    const minimumArgumentCount = Checker_getMinArgumentCount(checker, sourceSelectedSignature);
    const restParameterIndex = signatureHasRestParameter(sourceSelectedSignature) ? sourceSelectedSignature.parameters.length - 1 : -1;
    for (let parameterIndex = 0; parameterIndex < sourceSelectedSignature.parameters.length; parameterIndex++) {
        const parameterSymbol = sourceSelectedSignature.parameters[parameterIndex];
        if (parameterSymbol === undefined) {
            return undefined;
        }
        const selectedType = Checker_getTypeOfParameter(checker, parameterSymbol);
        if (selectedType === undefined) {
            return undefined;
        }
        const parameterDeclaration = primarySymbolDeclaration(parameterSymbol);
        const authoredTypeNode = parameterDeclaration === undefined ? undefined : Node_Type(parameterDeclaration);
        selected.push({
            parameterIndex,
            parameterName: parameterSymbol.Name,
            parameterSymbol,
            ...(parameterDeclaration !== undefined ? { parameterDeclaration } : {}),
            selectedType,
            ...(authoredTypeNode !== undefined ? { authoredTypeNode } : {}),
            acceptsOmission: parameterIndex >= minimumArgumentCount,
            rest: parameterIndex === restParameterIndex,
        });
    }
    return selected;
}
function getSourceSelectedSignatureKind(checker, sourceSelectedSignature) {
    if (checker === undefined || sourceSelectedSignature === undefined) {
        return undefined;
    }
    if (sourceSelectedSignature === checker.anySignature) {
        return "untyped";
    }
    if (sourceSelectedSignature === checker.unknownSignature) {
        return "error";
    }
    if (sourceSelectedSignature === checker.silentNeverSignature) {
        return "silent-never";
    }
    return "resolved";
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
function preserveEquivalentCheckedSourceResultType(checker, extensionHost, subject, incoming, incomingSourceResultType) {
    if (incomingSourceResultType === undefined) {
        return incoming;
    }
    const existing = extensionHost.facts.get(subject, targetOperationFactKey);
    const existingSourceResultType = existing?.provenance?.sourceResultType;
    if (existing === undefined || existingSourceResultType === undefined || existingSourceResultType === incomingSourceResultType) {
        return incoming;
    }
    const withExistingSourceResultType = withTargetOperationProvenance(incoming, {
        sourceResultType: existingSourceResultType,
    });
    if (!targetOperationFactKey.equals(existing, withExistingSourceResultType)) {
        return incoming;
    }
    return checkedSourceResultTypesEquivalent(checker, existingSourceResultType, incomingSourceResultType)
        ? withExistingSourceResultType
        : incoming;
}
function checkedSourceResultTypesEquivalent(checker, left, right) {
    if (Checker_isTypeIdenticalTo(checker, left, right)) {
        return true;
    }
    if ((Type_Flags(left) & TypeFlagsUniqueESSymbol) === 0 || (Type_Flags(right) & TypeFlagsUniqueESSymbol) === 0) {
        return false;
    }
    const leftSymbol = Type_Symbol(left);
    const rightSymbol = Type_Symbol(right);
    if (leftSymbol === undefined || leftSymbol !== rightSymbol) {
        return false;
    }
    const declaration = primarySymbolDeclaration(leftSymbol);
    return declaration !== undefined && declaration === primarySymbolDeclaration(rightSymbol);
}
function withCheckedOperationResultType(operation, resultType) {
    if (operation.resultType !== undefined || resultType === undefined) {
        return operation;
    }
    return {
        ...operation,
        resultType,
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
        || extensionHost.facts.get(subject, providerTypeFamilyFactKey) !== undefined
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