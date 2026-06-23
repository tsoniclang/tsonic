import type { bool } from "../go/scalars.js";
import type { GoPtr } from "../go/compat.js";
import type { Node } from "../internal/ast/ast.js";
import { Node_Arguments, Node_Expression, Node_Symbol, Node_Text, Node_TypeArguments } from "../internal/ast/ast.js";
import type { Symbol } from "../internal/ast/symbol.js";
import { Node_Name } from "../internal/ast/spine.js";
import { AsElementAccessExpression, AsForInOrOfStatement, AsPropertyAccessExpression } from "../internal/ast/generated/casts.js";
import { KindElementAccessExpression, KindIdentifier, KindPrivateIdentifier, KindPropertyAccessExpression, KindQualifiedName } from "../internal/ast/generated/kinds.js";
import { TokenToString } from "../internal/scanner/scanner.js";
import type { Signature, Type } from "../internal/checker/types.js";
import type { Checker } from "../internal/checker/checker/state.js";
import { Checker_GetPropertyOfType } from "../internal/checker/exports.js";
import { Checker_GetAliasedSymbol, Checker_getResolvedSymbolOrNil } from "../internal/checker/checker/symbols.js";
import { Checker_getApplicableIndexInfo } from "../internal/checker/checker/signatures.js";
import { Checker_GetTypeAtLocation } from "../internal/checker/checker/types.js";
import { GetSourceFileOfNode, NodeIsSynthesized } from "../internal/ast/utilities.js";
import { ExtensionObservationPoint } from "./observations.js";
import type { CheckedCallMappingRequest, CheckedCallMappingResult, CheckedConversionMappingRequest, CheckedConversionMappingResult, CheckedElementAccessMappingRequest, CheckedIterationKind, CheckedOperationMappingResult, CheckedOperatorMappingRequest, CheckedPropertyAccessMappingRequest, ContextualTargetTypeRequest, ContextualTargetTypeResult, ExtensionFlowUseValidationRequest, ExtensionFlowUseValidationResult, ParameterPassingRequest, ParameterPassingResult, PostCheckAssignabilityObservationRequest, RuntimeCarrierFactRequest, RuntimeCarrierFactResult, TargetConstraintValidationRequest, TargetTypeArgumentMappingRequest, TargetTypeArgumentMappingResult } from "./observations.js";
import { argumentPassingFactKey, contextualTargetTypeFactKey, flowStateFactKey, providerVirtualDeclarationFactKey, runtimeCarrierFactKey, selectedTargetSignatureFactKey, sourcePrimitiveFactKey, targetBindingFactKey, targetConversionFactKey, targetOperationFactKey } from "./facts.js";
import type { ExtensionEvidence, ExtensionFactKey, ExtensionFactSubject, ExtensionHost } from "./host.js";
import { getExtensionHost } from "./host.js";

type CheckerWithProgram = Checker & { readonly program: object };

const noCheckedCallMapping: CheckedCallMappingResult = {
  selectedSignature: {
    member: {
      id: "tsts.core.noTargetCallMapping",
      sourceName: "",
      targetName: "",
      kind: "method",
      parameters: [],
    },
  },
};

const noCheckedOperationMapping: CheckedOperationMappingResult = {
  operation: {
    operationId: "tsts.core.noTargetOperationMapping",
    operationKind: "method",
    targetOperation: "",
  },
};

export function recordExtensionCheckedCallMapping(checker: GoPtr<CheckerWithProgram>, callExpression: GoPtr<Node>, sourceSelectedSignature?: GoPtr<Signature>): void {
  if (checker === undefined || callExpression === undefined || !isUserSourceOperationNode(callExpression)) {
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
  const calleeSymbols = getReferenceSymbols(checker, callee);
  const calleeAccess = AsPropertyAccessExpression(callee);
  const calleeReceiver = calleeAccess?.Expression;
  const calleeReceiverType = calleeReceiver === undefined ? undefined : Checker_GetTypeAtLocation(checker, calleeReceiver);
  const calleeReceiverSymbols = getReferenceSymbols(checker, calleeReceiver);
  const sourceSelectedDeclaration = sourceSelectedSignature?.declaration;
  const sourceSelectedDeclarationContainer = sourceSelectedDeclaration?.Parent;
  const sourceSelectedContainerSymbol = sourceSelectedDeclarationContainer === undefined ? undefined : Node_Symbol(sourceSelectedDeclarationContainer);
  const requireOwner = hasAnyExtensionOwnedSubject(extensionHost, [
    callee,
    calleeSymbols.symbol,
    calleeSymbols.resolvedSymbol,
    calleeSymbols.aliasedSymbol,
    calleeReceiver,
    calleeReceiverSymbols.symbol,
    calleeReceiverSymbols.resolvedSymbol,
    calleeReceiverSymbols.aliasedSymbol,
    calleeReceiverType,
    calleeReceiverType?.symbol,
    sourceSelectedDeclaration,
    sourceSelectedDeclarationContainer,
    sourceSelectedContainerSymbol,
  ]);

  const result = extensionHost.runObservation(
    ExtensionObservationPoint.mapCheckedCall,
    {
      call: callExpression,
      callee,
      ...(calleeSymbols.symbol !== undefined ? { calleeSymbol: calleeSymbols.symbol } : {}),
      ...(calleeSymbols.resolvedSymbol !== undefined ? { calleeResolvedSymbol: calleeSymbols.resolvedSymbol } : {}),
      ...(calleeSymbols.aliasedSymbol !== undefined ? { calleeAliasedSymbol: calleeSymbols.aliasedSymbol } : {}),
      ...(calleeReceiver !== undefined ? { calleeReceiver } : {}),
      ...(calleeReceiverType !== undefined ? { calleeReceiverType } : {}),
      ...(calleeReceiverType?.symbol !== undefined ? { calleeReceiverTypeSymbol: calleeReceiverType.symbol } : {}),
      ...(calleeReceiverSymbols.symbol !== undefined ? { calleeReceiverSymbol: calleeReceiverSymbols.symbol } : {}),
      ...(calleeReceiverSymbols.resolvedSymbol !== undefined ? { calleeReceiverResolvedSymbol: calleeReceiverSymbols.resolvedSymbol } : {}),
      ...(calleeReceiverSymbols.aliasedSymbol !== undefined ? { calleeReceiverAliasedSymbol: calleeReceiverSymbols.aliasedSymbol } : {}),
      ...(calleeAccess?.name !== undefined ? { calleePropertyName: Node_Text(calleeAccess.name) } : {}),
      arguments: definedFactSubjects(Node_Arguments(callExpression) ?? []),
      ...(sourceSelectedSignature !== undefined ? { sourceSelectedSignature } : {}),
      ...(sourceSelectedDeclaration !== undefined ? { sourceSelectedDeclaration } : {}),
      ...(sourceSelectedDeclarationContainer !== undefined ? { sourceSelectedDeclarationContainer } : {}),
      ...(sourceSelectedContainerSymbol !== undefined ? { sourceSelectedContainerSymbol } : {}),
      ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    },
    () => {
      return noCheckedCallMapping;
    },
    { requireOwner },
  );

  if (result.kind !== "accept") {
    return;
  }

  const arguments_ = Node_Arguments(callExpression) ?? [];
  const selectedSignature = recordExtensionTargetTypeArgumentMapping(extensionHost, callee, sourceSelectedSignature, result.value, arguments_);
  extensionHost.facts.set(callExpression, selectedTargetSignatureFactKey, selectedSignature, result.evidence ?? []);
  recordExtensionCallParameterModes(extensionHost, { ...result.value, selectedSignature }, arguments_);
  recordExtensionCallArgumentConversions(extensionHost, { ...result.value, selectedSignature }, arguments_);
}

export function recordExtensionCheckedPropertyAccessMapping(checker: GoPtr<CheckerWithProgram>, propertyAccessExpression: GoPtr<Node>, receiverType?: GoPtr<Type>): void {
  if (checker === undefined || propertyAccessExpression === undefined || !isUserSourceOperationNode(propertyAccessExpression)) {
    return;
  }

  const extensionHost = getExtensionHost(checker.program);
  if (extensionHost === undefined || extensionHost.getObservationOwner(ExtensionObservationPoint.mapCheckedPropertyAccess) === undefined) {
    return;
  }

  const receiver = Node_Expression(propertyAccessExpression);
  const propertyNameNode = Node_Name(propertyAccessExpression) ?? AsPropertyAccessExpression(propertyAccessExpression)?.name;
  const propertyName = Node_Text(propertyNameNode);
  if (receiver === undefined || propertyName === "") {
    return;
  }
  const receiverSymbols = getReferenceSymbols(checker, receiver);
  const selectedPropertySymbol = receiverType === undefined
    ? propertyNameNode === undefined ? undefined : Node_Symbol(propertyNameNode)
    : Checker_GetPropertyOfType(checker, receiverType, propertyName) ?? (propertyNameNode === undefined ? undefined : Node_Symbol(propertyNameNode));
  const sourceSelectedDeclaration = getPrimaryDeclaration(selectedPropertySymbol);
  const sourceSelectedDeclarationContainer = sourceSelectedDeclaration?.Parent;
  const sourceSelectedContainerSymbol = sourceSelectedDeclarationContainer === undefined ? undefined : Node_Symbol(sourceSelectedDeclarationContainer);
  const requireOwner = hasAnyExtensionOwnedSubject(extensionHost, [
    receiver,
    receiverSymbols.symbol,
    receiverSymbols.resolvedSymbol,
    receiverSymbols.aliasedSymbol,
    selectedPropertySymbol,
    sourceSelectedDeclaration,
    sourceSelectedDeclarationContainer,
    sourceSelectedContainerSymbol,
  ]);

  const result = extensionHost.runObservation(
    ExtensionObservationPoint.mapCheckedPropertyAccess,
    {
      expression: propertyAccessExpression,
      receiver,
      ...(receiverType !== undefined ? { receiverType } : {}),
      ...(receiverType?.symbol !== undefined ? { receiverTypeSymbol: receiverType.symbol } : {}),
      ...(receiverSymbols.symbol !== undefined ? { receiverSymbol: receiverSymbols.symbol } : {}),
      ...(receiverSymbols.resolvedSymbol !== undefined ? { receiverResolvedSymbol: receiverSymbols.resolvedSymbol } : {}),
      ...(receiverSymbols.aliasedSymbol !== undefined ? { receiverAliasedSymbol: receiverSymbols.aliasedSymbol } : {}),
      ...(selectedPropertySymbol !== undefined ? { sourceSelectedPropertySymbol: selectedPropertySymbol } : {}),
      ...(sourceSelectedDeclaration !== undefined ? { sourceSelectedDeclaration } : {}),
      ...(sourceSelectedDeclarationContainer !== undefined ? { sourceSelectedDeclarationContainer } : {}),
      ...(sourceSelectedContainerSymbol !== undefined ? { sourceSelectedContainerSymbol } : {}),
      propertyName,
      ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    },
    () => {
      return noCheckedOperationMapping;
    },
    { requireOwner },
  );

  if (result.kind !== "accept") {
    return;
  }

  extensionHost.facts.set(propertyAccessExpression, targetOperationFactKey, result.value.operation, result.evidence ?? []);
}

export function recordExtensionCheckedElementAccessMapping(checker: GoPtr<CheckerWithProgram>, elementAccessExpression: GoPtr<Node>, receiverType?: GoPtr<Type>): void {
  if (checker === undefined || elementAccessExpression === undefined || !isUserSourceOperationNode(elementAccessExpression)) {
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
  const indexType = Checker_GetTypeAtLocation(checker, argument);
  const selectedIndexInfo = receiverType === undefined || indexType === undefined
    ? undefined
    : Checker_getApplicableIndexInfo(checker, receiverType, indexType);
  const sourceSelectedDeclaration = selectedIndexInfo?.declaration;
  const sourceSelectedDeclarationContainer = sourceSelectedDeclaration?.Parent;
  const sourceSelectedContainerSymbol = sourceSelectedDeclarationContainer === undefined ? undefined : Node_Symbol(sourceSelectedDeclarationContainer);
  const requireOwner = hasAnyExtensionOwnedSubject(extensionHost, [
    receiver,
    receiverType,
    receiverType?.symbol,
    sourceSelectedDeclaration,
    sourceSelectedDeclarationContainer,
    sourceSelectedContainerSymbol,
  ]);

  const result = extensionHost.runObservation(
    ExtensionObservationPoint.mapCheckedElementAccess,
    {
      expression: elementAccessExpression,
      receiver,
      ...(receiverType !== undefined ? { receiverType } : {}),
      ...(receiverType?.symbol !== undefined ? { receiverTypeSymbol: receiverType.symbol } : {}),
      ...(sourceSelectedDeclaration !== undefined ? { sourceSelectedDeclaration } : {}),
      ...(sourceSelectedDeclarationContainer !== undefined ? { sourceSelectedDeclarationContainer } : {}),
      ...(sourceSelectedContainerSymbol !== undefined ? { sourceSelectedContainerSymbol } : {}),
      argument,
      ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    },
    () => {
      return noCheckedOperationMapping;
    },
    { requireOwner },
  );

  if (result.kind !== "accept") {
    return;
  }

  extensionHost.facts.set(elementAccessExpression, targetOperationFactKey, result.value.operation, result.evidence ?? []);
}

export function recordExtensionCheckedOperatorMapping(checker: GoPtr<CheckerWithProgram>, expression: GoPtr<Node>, operatorToken: GoPtr<Node>, left: GoPtr<Node>, right: GoPtr<Node>): void {
  if (checker === undefined || expression === undefined || operatorToken === undefined || left === undefined || !isUserSourceOperationNode(expression)) {
    return;
  }

  recordExtensionCheckedOperatorMappingCore(checker, expression, TokenToString(operatorToken.Kind), left, right);
}

export function recordExtensionCheckedUnaryOperatorMapping(checker: GoPtr<CheckerWithProgram>, expression: GoPtr<Node>, operator: string, operand: GoPtr<Node>): void {
  if (checker === undefined || expression === undefined || operand === undefined || operator === "" || !isUserSourceOperationNode(expression)) {
    return;
  }

  recordExtensionCheckedOperatorMappingCore(checker, expression, operator, operand, undefined);
}

function recordExtensionCheckedOperatorMappingCore(checker: CheckerWithProgram, expression: Node, operator: string, left: Node, right: GoPtr<Node>): void {
  const extensionHost = getExtensionHost(checker.program);
  if (extensionHost === undefined || extensionHost.getObservationOwner(ExtensionObservationPoint.mapCheckedOperator) === undefined) {
    return;
  }

  const leftSymbols = getReferenceSymbols(checker, left);
  const rightSymbols = getReferenceSymbols(checker, right);
  const result = extensionHost.runObservation(
    ExtensionObservationPoint.mapCheckedOperator,
    {
      expression,
      operator,
      left,
      ...(leftSymbols.symbol !== undefined ? { leftSymbol: leftSymbols.symbol } : {}),
      ...(leftSymbols.resolvedSymbol !== undefined ? { leftResolvedSymbol: leftSymbols.resolvedSymbol } : {}),
      ...(leftSymbols.aliasedSymbol !== undefined ? { leftAliasedSymbol: leftSymbols.aliasedSymbol } : {}),
      ...(right !== undefined ? { right } : {}),
      ...(rightSymbols.symbol !== undefined ? { rightSymbol: rightSymbols.symbol } : {}),
      ...(rightSymbols.resolvedSymbol !== undefined ? { rightResolvedSymbol: rightSymbols.resolvedSymbol } : {}),
      ...(rightSymbols.aliasedSymbol !== undefined ? { rightAliasedSymbol: rightSymbols.aliasedSymbol } : {}),
      ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    },
    () => {
      return noCheckedOperationMapping;
    },
    { requireOwner: hasAnyExtensionOwnedSubject(extensionHost, [expression, left, leftSymbols.symbol, leftSymbols.resolvedSymbol, leftSymbols.aliasedSymbol, right, rightSymbols.symbol, rightSymbols.resolvedSymbol, rightSymbols.aliasedSymbol]) },
  );

  if (result.kind !== "accept") {
    return;
  }

  extensionHost.facts.set(expression, targetOperationFactKey, result.value.operation, result.evidence ?? []);
}

export function recordExtensionCheckedIterationMapping(checker: GoPtr<CheckerWithProgram>, statement: GoPtr<Node>, kind: CheckedIterationKind, sourceElementType?: GoPtr<Type>, sourceExpressionType?: GoPtr<Type>): void {
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

  const result = extensionHost.runObservation(
    ExtensionObservationPoint.mapCheckedIteration,
    {
      statement,
      expression,
      ...(sourceExpressionType !== undefined ? { sourceExpressionType } : {}),
      ...(data?.Initializer !== undefined ? { initializer: data.Initializer } : {}),
      kind,
      ...(sourceElementType !== undefined ? { sourceElementType } : {}),
      ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    },
    () => {
      return noCheckedOperationMapping;
    },
    { requireOwner: hasAnyExtensionOwnedSubject(extensionHost, [statement, expression, sourceElementType]) },
  );

  if (result.kind !== "accept") {
    return;
  }

  extensionHost.facts.set(statement, targetOperationFactKey, result.value.operation, result.evidence ?? []);
}

export function recordExtensionTargetConstraintValidation(checker: GoPtr<CheckerWithProgram>, typeReference: GoPtr<Node>, symbol: GoPtr<Symbol>): boolean {
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
      const result = extensionHost.runObservation(
        ExtensionObservationPoint.validateTargetConstraint,
        {
          source: argument,
          constraint,
          target: extensionHost.activeTarget ?? targetBinding.target,
        },
        () => {
          throw new Error("Extension-owned target constraint checking unexpectedly reached core fallback.");
        },
        { requireOwner: true },
      );
      if (result.kind !== "accept" || !result.value) {
        valid = false;
      }
    }
  }
  return valid;
}

export function recordExtensionRuntimeCarrierFact(checker: GoPtr<CheckerWithProgram>, typeReference: GoPtr<Node>, type: GoPtr<Type>, symbol: GoPtr<Symbol>): void {
  if (checker === undefined || type === undefined) {
    return;
  }

  const extensionHost = getExtensionHost(checker.program);
  if (extensionHost === undefined || extensionHost.getObservationOwner(ExtensionObservationPoint.resolveRuntimeCarrier) === undefined) {
    return;
  }

  if (!hasRuntimeCarrierOwnedSubject(extensionHost, type) && !hasRuntimeCarrierOwnedSubject(extensionHost, typeReference) && !hasRuntimeCarrierOwnedSubject(extensionHost, symbol) && !hasRuntimeCarrierOwnedSubject(extensionHost, type.symbol)) {
    return;
  }

  const result = extensionHost.runObservation(
    ExtensionObservationPoint.resolveRuntimeCarrier,
      {
        type,
        ...(typeReference !== undefined ? { sourceTypeReference: typeReference } : {}),
        ...(symbol !== undefined ? { sourceTypeSymbol: symbol } : {}),
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
      },
    () => {
      throw new Error("Extension-owned runtime carrier resolution unexpectedly reached core fallback.");
    },
    { requireOwner: true },
  );
  if (result.kind !== "accept") {
    return;
  }

  const fact = {
    carrier: result.value.carrier,
    ...(result.value.requiresAllocation !== undefined ? { requiresAllocation: result.value.requiresAllocation } : {}),
  };
  extensionHost.facts.set(type, runtimeCarrierFactKey, fact, result.evidence ?? []);
  setFactOnOptionalSubject(extensionHost, typeReference, runtimeCarrierFactKey, fact, result.evidence ?? []);
  setFactOnOptionalSubject(extensionHost, symbol, runtimeCarrierFactKey, fact, result.evidence ?? []);
  setFactOnOptionalSubject(extensionHost, type.symbol, runtimeCarrierFactKey, fact, result.evidence ?? []);
}

export function recordExtensionContextualTargetTypeFact(checker: GoPtr<CheckerWithProgram>, expression: GoPtr<Node>, contextualType: GoPtr<Type>): void {
  if (checker === undefined || expression === undefined || contextualType === undefined) {
    return;
  }

  const extensionHost = getExtensionHost(checker.program);
  if (extensionHost === undefined || extensionHost.getObservationOwner(ExtensionObservationPoint.recordContextualTargetType) === undefined) {
    return;
  }

  const result = extensionHost.runObservation(
    ExtensionObservationPoint.recordContextualTargetType,
    {
      expression,
      context: contextualType,
      ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    },
    () => ({
      type: contextualType,
    }),
    { requireOwner: hasAnyExtensionOwnedSubject(extensionHost, [expression, contextualType]) },
  );
  if (result.kind !== "accept") {
    return;
  }

  extensionHost.facts.set(expression, contextualTargetTypeFactKey, {
    type: result.value.type,
    ...(result.value.targetType !== undefined ? { targetType: result.value.targetType } : {}),
  }, result.evidence ?? []);
}

export function recordExtensionPostCheckAssignabilityObservation(checker: GoPtr<CheckerWithProgram>, source: GoPtr<Type>, target: GoPtr<Type>, errorNode: GoPtr<Node>, expression: GoPtr<Node>, relation: PostCheckAssignabilityObservationRequest["relation"]): void {
  if (checker === undefined || source === undefined || target === undefined) {
    return;
  }

  const extensionHost = getExtensionHost(checker.program);
  if (extensionHost === undefined || extensionHost.getObservationOwner(ExtensionObservationPoint.observePostCheckAssignability) === undefined) {
    return;
  }

  if (
    !hasExtensionOwnedSubject(extensionHost, source)
    && !hasExtensionOwnedSubject(extensionHost, target)
    && !hasExtensionOwnedSubject(extensionHost, source?.symbol)
    && !hasExtensionOwnedSubject(extensionHost, target?.symbol)
    && !hasExtensionOwnedSubject(extensionHost, errorNode)
    && !hasExtensionOwnedSubject(extensionHost, expression)
  ) {
    return;
  }

  extensionHost.runObservation(
    ExtensionObservationPoint.observePostCheckAssignability,
    {
      source,
      target,
      ...(relation !== undefined ? { relation } : {}),
      ...(errorNode !== undefined ? { errorNode } : {}),
      ...(expression !== undefined ? { expression } : {}),
      ...(extensionHost.activeTarget !== undefined ? { targetPlatform: extensionHost.activeTarget } : {}),
    },
    () => undefined,
    { requireOwner: true },
  );
}

export function recordExtensionFlowUseValidation(checker: GoPtr<CheckerWithProgram>, useSite: GoPtr<Node>, symbol: GoPtr<Symbol>): void {
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

  const result = extensionHost.runObservation(
    ExtensionObservationPoint.validateExtensionFlowUse,
    {
      useSite,
      symbol,
      mode: "read",
      ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    },
    () => {
      throw new Error("Extension-owned flow validation unexpectedly reached core fallback.");
    },
    { requireOwner: true },
  );
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

function recordExtensionCallParameterModes(extensionHost: ExtensionHost, callResult: CheckedCallMappingResult, arguments_: readonly GoPtr<Node>[]): void {
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
    const result = extensionHost.runObservation(
      ExtensionObservationPoint.resolveParameterPassing,
      {
        parameter,
        argument,
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
      },
      () => {
        throw new Error("Extension-owned parameter mode checking unexpectedly reached core fallback.");
      },
      { requireOwner: true },
    );
    if (result.kind !== "accept") {
      continue;
    }
    extensionHost.facts.set(argument, argumentPassingFactKey, result.value.passing, result.evidence ?? []);
  }
}

function recordExtensionTargetTypeArgumentMapping(extensionHost: ExtensionHost, callee: Node, sourceSelectedSignature: GoPtr<Signature> | undefined, callResult: CheckedCallMappingResult, arguments_: readonly GoPtr<Node>[]): CheckedCallMappingResult["selectedSignature"] {
  if (extensionHost.getObservationOwner(ExtensionObservationPoint.mapInferredSourceTypeArgumentsToTarget) === undefined) {
    return callResult.selectedSignature;
  }

  const result = extensionHost.runObservation(
    ExtensionObservationPoint.mapInferredSourceTypeArgumentsToTarget,
    {
      declaration: callee,
      arguments: definedFactSubjects(arguments_),
      ...(sourceSelectedSignature !== undefined ? { sourceSelectedSignature } : {}),
      ...(callResult.returnType !== undefined ? { contextualType: callResult.returnType } : {}),
    },
    () => ({
      targetTypeArguments: [],
    }),
    { requireOwner: true },
  );
  if (result.kind !== "accept") {
    return callResult.selectedSignature;
  }
  return {
    ...callResult.selectedSignature,
    targetTypeArguments: result.value.targetTypeArguments,
  };
}

function recordExtensionCallArgumentConversions(extensionHost: ExtensionHost, callResult: CheckedCallMappingResult, arguments_: readonly GoPtr<Node>[]): void {
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
    const result = extensionHost.runObservation(
      ExtensionObservationPoint.mapCheckedConversion,
      {
        expression: argument,
        source: argument,
        target: parameter.type,
        ...(extensionHost.activeTarget !== undefined ? { targetPlatform: extensionHost.activeTarget } : {}),
      },
      () => {
        throw new Error("Extension-owned conversion resolution unexpectedly reached core fallback.");
      },
      { requireOwner: true },
    );
    if (result.kind !== "accept" || (result.value.convertedType === undefined && result.value.operation === undefined)) {
      continue;
    }
    extensionHost.facts.set(argument, targetConversionFactKey, {
      ...(result.value.convertedType !== undefined ? { convertedType: result.value.convertedType } : {}),
      ...(result.value.operation !== undefined ? { operation: result.value.operation } : {}),
    }, result.evidence ?? []);
  }
}

function definedFactSubjects<T extends object>(subjects: readonly (T | undefined)[]): readonly ExtensionFactSubject[] {
  return subjects.filter((subject): subject is T => subject !== undefined);
}

function hasAnyExtensionOwnedSubject(extensionHost: ExtensionHost, subjects: readonly (ExtensionFactSubject | undefined)[]): boolean {
  return subjects.some((subject) => hasExtensionOwnedSubject(extensionHost, subject));
}

function isUserSourceOperationNode(node: Node): boolean {
  const sourceFile = GetSourceFileOfNode(node);
  return sourceFile !== undefined &&
    sourceFile.IsDeclarationFile !== true &&
    !NodeIsSynthesized(node);
}

function getReferenceSymbols(
  checker: GoPtr<CheckerWithProgram>,
  node: GoPtr<Node>,
): { readonly symbol?: Symbol; readonly resolvedSymbol?: Symbol; readonly aliasedSymbol?: Symbol } {
  if (checker === undefined || node === undefined || !isReferenceSymbolQueryNode(node)) {
    return {};
  }
  const symbol = Node_Symbol(node);
  const resolvedSymbol = Checker_getResolvedSymbolOrNil(checker, node);
  const aliasedSymbol = getAliasedSymbolIfAvailable(checker, resolvedSymbol ?? symbol);
  return {
    ...(symbol !== undefined ? { symbol } : {}),
    ...(resolvedSymbol !== undefined && resolvedSymbol !== symbol ? { resolvedSymbol } : {}),
    ...(aliasedSymbol !== undefined && aliasedSymbol !== symbol && aliasedSymbol !== resolvedSymbol ? { aliasedSymbol } : {}),
  };
}

function getAliasedSymbolIfAvailable(checker: GoPtr<CheckerWithProgram>, symbol: GoPtr<Symbol>): GoPtr<Symbol> {
  if (checker === undefined || symbol === undefined) {
    return undefined;
  }
  try {
    return Checker_GetAliasedSymbol(checker, symbol);
  } catch {
    return undefined;
  }
}

function isReferenceSymbolQueryNode(node: Node): boolean {
  return node.Kind === KindIdentifier ||
    node.Kind === KindPrivateIdentifier ||
    node.Kind === KindQualifiedName;
}

function getPrimaryDeclaration(symbol: GoPtr<Symbol>): GoPtr<Node> {
  return symbol?.ValueDeclaration ?? symbol?.Declarations?.find((candidate): candidate is Node => candidate !== undefined);
}

function hasExtensionOwnedSubject(extensionHost: ExtensionHost, subject: ExtensionFactSubject | undefined): boolean {
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

function hasRuntimeCarrierOwnedSubject(extensionHost: ExtensionHost, subject: ExtensionFactSubject | undefined): boolean {
  if (subject === undefined) {
    return false;
  }
  return extensionHost.facts.get(subject, sourcePrimitiveFactKey) !== undefined
    || extensionHost.facts.get(subject, argumentPassingFactKey) !== undefined
    || extensionHost.facts.get(subject, flowStateFactKey) !== undefined
    || extensionHost.facts.get(subject, runtimeCarrierFactKey) !== undefined;
}

function setFactOnOptionalSubject<T>(extensionHost: ExtensionHost, subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>, value: T, evidence: readonly ExtensionEvidence[]): void {
  if (subject !== undefined) {
    extensionHost.facts.set(subject, key, value, evidence);
  }
}
