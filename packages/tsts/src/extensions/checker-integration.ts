import type { bool } from "../go/scalars.js";
import type { GoPtr } from "../go/compat.js";
import type { Node } from "../internal/ast/ast.js";
import { Node_Arguments, Node_Expression, Node_Text, Node_TypeArguments } from "../internal/ast/ast.js";
import type { Symbol } from "../internal/ast/symbol.js";
import { Node_Name } from "../internal/ast/spine.js";
import { AsElementAccessExpression } from "../internal/ast/generated/casts.js";
import { TokenToString } from "../internal/scanner/scanner.js";
import type { Type } from "../internal/checker/types.js";
import { ExtensionDecisionQuestion } from "./decisions.js";
import type { AssignabilityRequest, ContextualTypeRequest, ContextualTypeResult, InferTypeArgumentsRequest, InferTypeArgumentsResult, ParameterModeRequest, ParameterModeResult, ResolveCallRequest, ResolveCallResult, ResolveConversionRequest, ResolveConversionResult, ResolveElementAccessRequest, ResolveOperationResult, ResolveOperatorRequest, ResolvePropertyAccessRequest, RuntimeCarrierRequest, RuntimeCarrierResult, SatisfiesConstraintRequest, ValidateFlowUseRequest, ValidateFlowUseResult } from "./decisions.js";
import { argumentPassingFactKey, contextualTargetTypeFactKey, flowStateFactKey, providerVirtualDeclarationFactKey, runtimeCarrierFactKey, selectedTargetSignatureFactKey, sourcePrimitiveFactKey, targetBindingFactKey, targetConversionFactKey, targetOperationFactKey } from "./facts.js";
import type { ExtensionEvidence, ExtensionFactKey, ExtensionFactSubject, ExtensionHost } from "./host.js";
import { getExtensionHost } from "./host.js";

interface CheckerWithProgram {
  readonly program: object;
}

export function recordExtensionCallResolution(checker: GoPtr<CheckerWithProgram>, callExpression: GoPtr<Node>): void {
  if (checker === undefined || callExpression === undefined) {
    return;
  }

  const extensionHost = getExtensionHost(checker.program);
  if (extensionHost === undefined || extensionHost.getDecisionOwner(ExtensionDecisionQuestion.resolveCall) === undefined) {
    return;
  }

  const callee = Node_Expression(callExpression);
  if (callee === undefined) {
    return;
  }

  const result = extensionHost.runDecision(
    ExtensionDecisionQuestion.resolveCall,
    {
      call: callExpression,
      callee,
      arguments: definedFactSubjects(Node_Arguments(callExpression) ?? []),
      ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    },
    () => {
      throw new Error("Extension-owned call resolution unexpectedly reached core fallback.");
    },
    { requireOwner: true },
  );

  if (result.kind !== "accept") {
    return;
  }

  const arguments_ = Node_Arguments(callExpression) ?? [];
  const selectedSignature = recordExtensionCallTypeArgumentInference(extensionHost, callee, result.value, arguments_);
  extensionHost.facts.set(callExpression, selectedTargetSignatureFactKey, selectedSignature, result.evidence ?? []);
  recordExtensionCallParameterModes(extensionHost, { ...result.value, selectedSignature }, arguments_);
  recordExtensionCallArgumentConversions(extensionHost, { ...result.value, selectedSignature }, arguments_);
}

export function recordExtensionPropertyAccessResolution(checker: GoPtr<CheckerWithProgram>, propertyAccessExpression: GoPtr<Node>): void {
  if (checker === undefined || propertyAccessExpression === undefined) {
    return;
  }

  const extensionHost = getExtensionHost(checker.program);
  if (extensionHost === undefined || extensionHost.getDecisionOwner(ExtensionDecisionQuestion.resolvePropertyAccess) === undefined) {
    return;
  }

  const receiver = Node_Expression(propertyAccessExpression);
  const propertyName = Node_Text(Node_Name(propertyAccessExpression));
  if (receiver === undefined || propertyName === "") {
    return;
  }

  const result = extensionHost.runDecision(
    ExtensionDecisionQuestion.resolvePropertyAccess,
    {
      expression: propertyAccessExpression,
      receiver,
      propertyName,
      ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    },
    () => {
      throw new Error("Extension-owned property access resolution unexpectedly reached core fallback.");
    },
    { requireOwner: true },
  );

  if (result.kind !== "accept") {
    return;
  }

  extensionHost.facts.set(propertyAccessExpression, targetOperationFactKey, result.value.operation, result.evidence ?? []);
}

export function recordExtensionElementAccessResolution(checker: GoPtr<CheckerWithProgram>, elementAccessExpression: GoPtr<Node>): void {
  if (checker === undefined || elementAccessExpression === undefined) {
    return;
  }

  const extensionHost = getExtensionHost(checker.program);
  if (extensionHost === undefined || extensionHost.getDecisionOwner(ExtensionDecisionQuestion.resolveElementAccess) === undefined) {
    return;
  }

  const receiver = Node_Expression(elementAccessExpression);
  const argument = AsElementAccessExpression(elementAccessExpression)?.ArgumentExpression;
  if (receiver === undefined || argument === undefined) {
    return;
  }

  const result = extensionHost.runDecision(
    ExtensionDecisionQuestion.resolveElementAccess,
    {
      expression: elementAccessExpression,
      receiver,
      argument,
      ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    },
    () => {
      throw new Error("Extension-owned element access resolution unexpectedly reached core fallback.");
    },
    { requireOwner: true },
  );

  if (result.kind !== "accept") {
    return;
  }

  extensionHost.facts.set(elementAccessExpression, targetOperationFactKey, result.value.operation, result.evidence ?? []);
}

export function recordExtensionOperatorResolution(checker: GoPtr<CheckerWithProgram>, expression: GoPtr<Node>, operatorToken: GoPtr<Node>, left: GoPtr<Node>, right: GoPtr<Node>): void {
  if (checker === undefined || expression === undefined || operatorToken === undefined || left === undefined) {
    return;
  }

  const extensionHost = getExtensionHost(checker.program);
  if (extensionHost === undefined || extensionHost.getDecisionOwner(ExtensionDecisionQuestion.resolveOperator) === undefined) {
    return;
  }

  const result = extensionHost.runDecision(
    ExtensionDecisionQuestion.resolveOperator,
    {
      expression,
      operator: TokenToString(operatorToken.Kind),
      left,
      ...(right !== undefined ? { right } : {}),
      ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    },
    () => {
      throw new Error("Extension-owned operator resolution unexpectedly reached core fallback.");
    },
    { requireOwner: true },
  );

  if (result.kind !== "accept") {
    return;
  }

  extensionHost.facts.set(expression, targetOperationFactKey, result.value.operation, result.evidence ?? []);
}

export function recordExtensionTypeArgumentConstraintResolution(checker: GoPtr<CheckerWithProgram>, typeReference: GoPtr<Node>, symbol: GoPtr<Symbol>): boolean {
  if (checker === undefined || typeReference === undefined || symbol === undefined) {
    return true;
  }

  const extensionHost = getExtensionHost(checker.program);
  if (extensionHost === undefined || extensionHost.getDecisionOwner(ExtensionDecisionQuestion.satisfiesConstraint) === undefined) {
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
      const result = extensionHost.runDecision(
        ExtensionDecisionQuestion.satisfiesConstraint,
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

export function recordExtensionRuntimeCarrierResolution(checker: GoPtr<CheckerWithProgram>, typeReference: GoPtr<Node>, type: GoPtr<Type>, symbol: GoPtr<Symbol>): void {
  if (checker === undefined || type === undefined) {
    return;
  }

  const extensionHost = getExtensionHost(checker.program);
  if (extensionHost === undefined || extensionHost.getDecisionOwner(ExtensionDecisionQuestion.getRuntimeCarrier) === undefined) {
    return;
  }

  if (!hasExtensionOwnedSubject(extensionHost, type) && !hasExtensionOwnedSubject(extensionHost, typeReference) && !hasExtensionOwnedSubject(extensionHost, symbol) && !hasExtensionOwnedSubject(extensionHost, type.symbol)) {
    return;
  }

  const result = extensionHost.runDecision(
    ExtensionDecisionQuestion.getRuntimeCarrier,
    {
      type,
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

export function recordExtensionContextualTypeResolution(checker: GoPtr<CheckerWithProgram>, expression: GoPtr<Node>, contextualType: GoPtr<Type>): void {
  if (checker === undefined || expression === undefined || contextualType === undefined) {
    return;
  }

  const extensionHost = getExtensionHost(checker.program);
  if (extensionHost === undefined || extensionHost.getDecisionOwner(ExtensionDecisionQuestion.getContextualType) === undefined) {
    return;
  }

  const result = extensionHost.runDecision(
    ExtensionDecisionQuestion.getContextualType,
    {
      expression,
      context: contextualType,
      ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    },
    () => ({
      type: contextualType,
    }),
    { requireOwner: true },
  );
  if (result.kind !== "accept") {
    return;
  }

  extensionHost.facts.set(expression, contextualTargetTypeFactKey, {
    type: result.value.type,
    ...(result.value.targetType !== undefined ? { targetType: result.value.targetType } : {}),
  }, result.evidence ?? []);
}

export function recordExtensionAssignabilityValidation(checker: GoPtr<CheckerWithProgram>, source: GoPtr<Type>, target: GoPtr<Type>, errorNode: GoPtr<Node>, expression: GoPtr<Node>, relation: AssignabilityRequest["relation"]): bool {
  if (checker === undefined || source === undefined || target === undefined) {
    return true as bool;
  }

  const extensionHost = getExtensionHost(checker.program);
  if (extensionHost === undefined || extensionHost.getDecisionOwner(ExtensionDecisionQuestion.isAssignableTo) === undefined) {
    return true as bool;
  }

  if (
    !hasExtensionOwnedSubject(extensionHost, source)
    && !hasExtensionOwnedSubject(extensionHost, target)
    && !hasExtensionOwnedSubject(extensionHost, source?.symbol)
    && !hasExtensionOwnedSubject(extensionHost, target?.symbol)
    && !hasExtensionOwnedSubject(extensionHost, errorNode)
    && !hasExtensionOwnedSubject(extensionHost, expression)
  ) {
    return true as bool;
  }

  const result = extensionHost.runDecision(
    ExtensionDecisionQuestion.isAssignableTo,
    {
      source,
      target,
      ...(relation !== undefined ? { relation } : {}),
      ...(errorNode !== undefined ? { errorNode } : {}),
      ...(expression !== undefined ? { expression } : {}),
      ...(extensionHost.activeTarget !== undefined ? { targetPlatform: extensionHost.activeTarget } : {}),
    },
    () => true,
    { requireOwner: true },
  );
  if (result.kind !== "accept") {
    return false as bool;
  }
  return result.value as bool;
}

export function recordExtensionFlowUseValidation(checker: GoPtr<CheckerWithProgram>, useSite: GoPtr<Node>, symbol: GoPtr<Symbol>): void {
  if (checker === undefined || useSite === undefined || symbol === undefined) {
    return;
  }

  const extensionHost = getExtensionHost(checker.program);
  if (extensionHost === undefined || extensionHost.getDecisionOwner(ExtensionDecisionQuestion.validateFlowUse) === undefined) {
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

  const result = extensionHost.runDecision(
    ExtensionDecisionQuestion.validateFlowUse,
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

function recordExtensionCallParameterModes(extensionHost: ExtensionHost, callResult: ResolveCallResult, arguments_: readonly GoPtr<Node>[]): void {
  if (extensionHost.getDecisionOwner(ExtensionDecisionQuestion.getParameterMode) === undefined) {
    return;
  }
  const parameters = callResult.selectedSignature.member.parameters;
  for (let index = 0; index < parameters.length; index++) {
    const parameter = parameters[index];
    const argument = arguments_[index];
    if (parameter === undefined || argument === undefined) {
      continue;
    }
    const result = extensionHost.runDecision(
      ExtensionDecisionQuestion.getParameterMode,
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

function recordExtensionCallTypeArgumentInference(extensionHost: ExtensionHost, callee: Node, callResult: ResolveCallResult, arguments_: readonly GoPtr<Node>[]): ResolveCallResult["selectedSignature"] {
  if (extensionHost.getDecisionOwner(ExtensionDecisionQuestion.inferTypeArguments) === undefined) {
    return callResult.selectedSignature;
  }

  const result = extensionHost.runDecision(
    ExtensionDecisionQuestion.inferTypeArguments,
    {
      declaration: callee,
      arguments: definedFactSubjects(arguments_),
      ...(callResult.returnType !== undefined ? { contextualType: callResult.returnType } : {}),
    },
    () => ({
      typeArguments: [],
    }),
    { requireOwner: true },
  );
  if (result.kind !== "accept") {
    return callResult.selectedSignature;
  }
  return {
    ...callResult.selectedSignature,
    typeArguments: result.value.typeArguments,
    ...(result.value.targetTypeArguments !== undefined ? { targetTypeArguments: result.value.targetTypeArguments } : {}),
  };
}

function recordExtensionCallArgumentConversions(extensionHost: ExtensionHost, callResult: ResolveCallResult, arguments_: readonly GoPtr<Node>[]): void {
  if (extensionHost.getDecisionOwner(ExtensionDecisionQuestion.resolveConversion) === undefined) {
    return;
  }
  const parameters = callResult.selectedSignature.member.parameters;
  for (let index = 0; index < parameters.length; index++) {
    const parameter = parameters[index];
    const argument = arguments_[index];
    if (parameter === undefined || argument === undefined) {
      continue;
    }
    const result = extensionHost.runDecision(
      ExtensionDecisionQuestion.resolveConversion,
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

function setFactOnOptionalSubject<T>(extensionHost: ExtensionHost, subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>, value: T, evidence: readonly ExtensionEvidence[]): void {
  if (subject !== undefined) {
    extensionHost.facts.set(subject, key, value, evidence);
  }
}
