import type { bool } from "../go/scalars.js";
import type { GoPtr } from "../go/compat.js";
import type { Node } from "../internal/ast/ast.js";
import { Node_Arguments, Node_Expression, Node_Symbol, Node_Text, Node_TypeArguments } from "../internal/ast/ast.js";
import type { Symbol } from "../internal/ast/symbol.js";
import { Node_Name } from "../internal/ast/spine.js";
import { AsElementAccessExpression, AsTypeOfExpression } from "../internal/ast/generated/casts.js";
import { KindElementAccessExpression, KindIdentifier, KindPropertyAccessExpression, KindTypeOfExpression } from "../internal/ast/generated/kinds.js";
import { TokenToString } from "../internal/scanner/scanner.js";
import type { Type } from "../internal/checker/types.js";
import type { Checker } from "../internal/checker/checker/state.js";
import { Checker_getTypeOfExpression } from "../internal/checker/checker/types.js";
import { Checker_GetAliasedSymbol, Checker_GetSymbolAtLocation, Checker_getResolvedSymbol } from "../internal/checker/checker/symbols.js";
import { SymbolFlagsAlias } from "../internal/ast/generated/flags.js";
import { ExtensionDecisionQuestion } from "./decisions.js";
import type { AssignabilityRequest, ContextualTypeRequest, ContextualTypeResult, InferTypeArgumentsRequest, InferTypeArgumentsResult, ParameterModeRequest, ParameterModeResult, ResolveCallRequest, ResolveCallResult, ResolveConversionRequest, ResolveConversionResult, ResolveElementAccessRequest, ResolveIterationRequest, ResolveOperationResult, ResolveOperatorRequest, ResolvePropertyAccessRequest, RuntimeCarrierRequest, RuntimeCarrierResult, SatisfiesConstraintRequest, ValidateFlowUseRequest, ValidateFlowUseResult } from "./decisions.js";
import { argumentPassingFactKey, contextualTargetTypeFactKey, flowStateFactKey, providerVirtualDeclarationFactKey, runtimeCarrierFactKey, selectedTargetSignatureFactKey, sourcePrimitiveFactKey, targetBindingFactKey, targetConversionFactKey, targetIterationFactKey, targetOperationFactKey } from "./facts.js";
import type { RuntimeCarrierFact } from "./facts.js";
import type { ExtensionEvidence, ExtensionFactKey, ExtensionFactSubject, ExtensionHost } from "./host.js";
import { getExtensionHost } from "./host.js";

type CheckerWithProgram = Checker;

export function recordExtensionCallResolution(checker: GoPtr<CheckerWithProgram>, callExpression: GoPtr<Node>): void {
  if (checker === undefined || callExpression === undefined) {
    return;
  }

  const extensionHost = getExtensionHost(checker.program);
  if (
    extensionHost === undefined ||
    (
      extensionHost.getDecisionOwner(ExtensionDecisionQuestion.resolveCall) === undefined &&
      !extensionHost.hasDecisionHook(ExtensionDecisionQuestion.resolveCall)
    )
  ) {
    return;
  }

  const callee = Node_Expression(callExpression);
  if (callee === undefined) {
    return;
  }

  const receiver = getPropertyAccessCallReceiver(callee);
  const receiverSymbol = receiver === undefined ? undefined : getCallReceiverSymbol(checker, receiver);
  const resolvedReceiverSymbol = receiver === undefined ? undefined : getCallReceiverResolvedSymbol(checker, receiver);
  const receiverType = receiver === undefined ? undefined : Checker_getTypeOfExpression(checker, receiver);
  const calleeSymbol = getCallCalleeSymbol(checker, callee);
  const resolvedCalleeSymbol = getCallCalleeResolvedSymbol(checker, callee);
  const calleeType = Checker_getTypeOfExpression(checker, callee);
  const argumentNodes = definedFactSubjects(Node_Arguments(callExpression) ?? []);
  const argumentSymbols = argumentNodes.map((argument) =>
    isNodeSubject(argument) ? getCallArgumentSymbol(checker, argument) : undefined);
  const resolvedArgumentSymbols = argumentNodes.map((argument) =>
    isNodeSubject(argument) ? getCallArgumentResolvedSymbol(checker, argument) : undefined);
  const argumentTypes = argumentNodes.map((argument) =>
    isNodeSubject(argument) ? Checker_getTypeOfExpression(checker, argument) : undefined);
  const result = extensionHost.runDecision(
    ExtensionDecisionQuestion.resolveCall,
    {
      call: callExpression,
      callee,
      ...(receiver !== undefined ? { receiver } : {}),
      ...(receiverSymbol !== undefined ? { receiverSymbol } : {}),
      ...(resolvedReceiverSymbol !== undefined && resolvedReceiverSymbol !== receiverSymbol ? { resolvedReceiverSymbol } : {}),
      ...(receiverType !== undefined ? { receiverType } : {}),
      ...(calleeSymbol !== undefined ? { calleeSymbol } : {}),
      ...(resolvedCalleeSymbol !== undefined && resolvedCalleeSymbol !== calleeSymbol ? { resolvedCalleeSymbol } : {}),
      ...(calleeType !== undefined ? { calleeType } : {}),
      arguments: argumentNodes,
      argumentSymbols,
      resolvedArgumentSymbols,
      argumentTypes,
      ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    },
    () => {
      throw new Error("Optional extension call resolution unexpectedly reached core fallback.");
    },
    { deferWhenUnanswered: true },
  );

  if (result.kind !== "accept") {
    return;
  }

  const arguments_ = Node_Arguments(callExpression) ?? [];
  const selectedSignature = recordExtensionCallTypeArgumentInference(extensionHost, callee, result.value, arguments_);
  extensionHost.facts.set(callExpression, selectedTargetSignatureFactKey, selectedSignature, result.evidence ?? []);
  recordExtensionCallReturnCarrier(extensionHost, callExpression, result.value, result.evidence ?? []);
  recordExtensionCallParameterModes(extensionHost, { ...result.value, selectedSignature }, arguments_);
  recordExtensionCallArgumentConversions(extensionHost, { ...result.value, selectedSignature }, arguments_);
}

function recordExtensionCallReturnCarrier(
  extensionHost: ExtensionHost,
  callExpression: Node,
  callResult: ResolveCallResult,
  evidence: readonly ExtensionEvidence[],
): void {
  if (callResult.returnType === undefined) {
    return;
  }
  const inlineCarrier = asRuntimeCarrierFact(callResult.returnType);
  if (inlineCarrier !== undefined) {
    extensionHost.facts.set(callExpression, runtimeCarrierFactKey, inlineCarrier, evidence);
    return;
  }
  const carrier = extensionHost.facts.get(callResult.returnType, runtimeCarrierFactKey) ??
    extensionHost.factResolver.resolve(callResult.returnType, runtimeCarrierFactKey);
  if (carrier !== undefined) {
    extensionHost.facts.set(callExpression, runtimeCarrierFactKey, carrier, evidence);
  }
}

function asRuntimeCarrierFact(subject: ExtensionFactSubject): RuntimeCarrierFact | undefined {
  const candidate = subject as Partial<RuntimeCarrierFact>;
  return candidate.carrier === undefined ? undefined : {
    carrier: candidate.carrier,
    ...(candidate.requiresAllocation === undefined ? {} : { requiresAllocation: candidate.requiresAllocation }),
  };
}

export function recordExtensionPropertyAccessResolution(checker: GoPtr<CheckerWithProgram>, propertyAccessExpression: GoPtr<Node>, receiverType: GoPtr<Type>): void {
  if (checker === undefined || propertyAccessExpression === undefined) {
    return;
  }

  const extensionHost = getExtensionHost(checker.program);
  if (
    extensionHost === undefined ||
    (
      extensionHost.getDecisionOwner(ExtensionDecisionQuestion.resolvePropertyAccess) === undefined &&
      !extensionHost.hasDecisionHook(ExtensionDecisionQuestion.resolvePropertyAccess)
    )
  ) {
    return;
  }

  const receiver = Node_Expression(propertyAccessExpression);
  const propertyName = Node_Text(Node_Name(propertyAccessExpression));
  if (receiver === undefined || propertyName === "") {
    return;
  }
  const receiverSymbol = getCallReceiverSymbol(checker, receiver);
  const resolvedReceiverSymbol = getCallReceiverResolvedSymbol(checker, receiver);
  const propertyNameNode = Node_Name(propertyAccessExpression);
  const propertySymbol = Node_Symbol(propertyNameNode);

  const result = extensionHost.runDecision(
    ExtensionDecisionQuestion.resolvePropertyAccess,
    {
      expression: propertyAccessExpression,
      receiver,
      ...(receiverSymbol !== undefined ? { receiverSymbol } : {}),
      ...(resolvedReceiverSymbol !== undefined && resolvedReceiverSymbol !== receiverSymbol ? { resolvedReceiverSymbol } : {}),
      ...(receiverType !== undefined ? { receiverType } : {}),
      ...(propertySymbol !== undefined ? { propertySymbol } : {}),
      propertyName,
      ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    },
    () => {
      throw new Error("Optional extension property access resolution unexpectedly reached core fallback.");
    },
    { deferWhenUnanswered: true },
  );

  if (result.kind !== "accept") {
    return;
  }

  extensionHost.facts.set(propertyAccessExpression, targetOperationFactKey, result.value.operation, result.evidence ?? []);
}

export function recordExtensionElementAccessResolution(checker: GoPtr<CheckerWithProgram>, elementAccessExpression: GoPtr<Node>, receiverType: GoPtr<Type>): void {
  if (checker === undefined || elementAccessExpression === undefined) {
    return;
  }

  const extensionHost = getExtensionHost(checker.program);
  if (
    extensionHost === undefined ||
    (
      extensionHost.getDecisionOwner(ExtensionDecisionQuestion.resolveElementAccess) === undefined &&
      !extensionHost.hasDecisionHook(ExtensionDecisionQuestion.resolveElementAccess)
    )
  ) {
    return;
  }

  const receiver = Node_Expression(elementAccessExpression);
  const argument = AsElementAccessExpression(elementAccessExpression)?.ArgumentExpression;
  if (receiver === undefined || argument === undefined) {
    return;
  }
  const receiverSymbol = getCallReceiverSymbol(checker, receiver);
  const resolvedReceiverSymbol = getCallReceiverResolvedSymbol(checker, receiver);
  const argumentSymbol = getCallArgumentSymbol(checker, argument);
  const resolvedArgumentSymbol = getCallArgumentResolvedSymbol(checker, argument);
  const argumentType = Checker_getTypeOfExpression(checker, argument);

  const result = extensionHost.runDecision(
    ExtensionDecisionQuestion.resolveElementAccess,
    {
      expression: elementAccessExpression,
      receiver,
      ...(receiverSymbol !== undefined ? { receiverSymbol } : {}),
      ...(resolvedReceiverSymbol !== undefined && resolvedReceiverSymbol !== receiverSymbol ? { resolvedReceiverSymbol } : {}),
      ...(receiverType !== undefined ? { receiverType } : {}),
      argument,
      ...(argumentSymbol !== undefined ? { argumentSymbol } : {}),
      ...(resolvedArgumentSymbol !== undefined ? { resolvedArgumentSymbol } : {}),
      ...(argumentType !== undefined ? { argumentType } : {}),
      ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    },
    () => {
      throw new Error("Optional extension element access resolution unexpectedly reached core fallback.");
    },
    { deferWhenUnanswered: true },
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
  if (
    extensionHost === undefined ||
    (
      extensionHost.getDecisionOwner(ExtensionDecisionQuestion.resolveOperator) === undefined &&
      !extensionHost.hasDecisionHook(ExtensionDecisionQuestion.resolveOperator)
    )
  ) {
    return;
  }

  const leftType = Checker_getTypeOfExpression(checker, left);
  const rightType = right === undefined ? undefined : Checker_getTypeOfExpression(checker, right);
  const leftSymbol = getOperatorOperandSymbol(checker, left);
  const rightSymbol = getOperatorOperandSymbol(checker, right);
  const leftResolvedSymbol = getOperatorOperandResolvedSymbol(checker, left);
  const rightResolvedSymbol = getOperatorOperandResolvedSymbol(checker, right);
  const leftAliasedSymbol = getAliasedSymbol(checker, leftResolvedSymbol ?? leftSymbol);
  const rightAliasedSymbol = getAliasedSymbol(checker, rightResolvedSymbol ?? rightSymbol);
  const leftSourcePrimitive = getOperatorOperandSourcePrimitive(extensionHost, left, leftType, leftSymbol);
  const rightSourcePrimitive = getOperatorOperandSourcePrimitive(extensionHost, right, rightType, rightSymbol);
  const leftTypeofOperand = getTypeofOperand(left);
  const rightTypeofOperand = getTypeofOperand(right);
  const leftTypeofOperandType = leftTypeofOperand === undefined ? undefined : Checker_getTypeOfExpression(checker, leftTypeofOperand);
  const rightTypeofOperandType = rightTypeofOperand === undefined ? undefined : Checker_getTypeOfExpression(checker, rightTypeofOperand);
  const leftTypeofOperandSymbol = getOperatorOperandSymbol(checker, leftTypeofOperand);
  const rightTypeofOperandSymbol = getOperatorOperandSymbol(checker, rightTypeofOperand);
  const leftTypeofOperandResolvedSymbol = getOperatorOperandResolvedSymbol(checker, leftTypeofOperand);
  const rightTypeofOperandResolvedSymbol = getOperatorOperandResolvedSymbol(checker, rightTypeofOperand);
  const leftTypeofOperandAliasedSymbol = getAliasedSymbol(checker, leftTypeofOperandResolvedSymbol ?? leftTypeofOperandSymbol);
  const rightTypeofOperandAliasedSymbol = getAliasedSymbol(checker, rightTypeofOperandResolvedSymbol ?? rightTypeofOperandSymbol);
  const leftTypeofOperandSourcePrimitive = getOperatorOperandSourcePrimitive(extensionHost, leftTypeofOperand, leftTypeofOperandType, leftTypeofOperandSymbol);
  const rightTypeofOperandSourcePrimitive = getOperatorOperandSourcePrimitive(extensionHost, rightTypeofOperand, rightTypeofOperandType, rightTypeofOperandSymbol);
  const result = extensionHost.runDecision(
    ExtensionDecisionQuestion.resolveOperator,
    {
      expression,
      operator: TokenToString(operatorToken.Kind),
      left,
      ...(leftType !== undefined ? { leftType } : {}),
      ...(leftSymbol !== undefined ? { leftSymbol } : {}),
      ...(leftResolvedSymbol !== undefined && leftResolvedSymbol !== leftSymbol ? { leftResolvedSymbol } : {}),
      ...(leftAliasedSymbol !== undefined && leftAliasedSymbol !== leftResolvedSymbol && leftAliasedSymbol !== leftSymbol ? { leftAliasedSymbol } : {}),
      ...(leftSourcePrimitive !== undefined ? { leftSourcePrimitive } : {}),
      ...(leftTypeofOperand !== undefined ? { leftTypeofOperand } : {}),
      ...(leftTypeofOperandType !== undefined ? { leftTypeofOperandType } : {}),
      ...(leftTypeofOperandSymbol !== undefined ? { leftTypeofOperandSymbol } : {}),
      ...(leftTypeofOperandResolvedSymbol !== undefined && leftTypeofOperandResolvedSymbol !== leftTypeofOperandSymbol ? { leftTypeofOperandResolvedSymbol } : {}),
      ...(leftTypeofOperandAliasedSymbol !== undefined && leftTypeofOperandAliasedSymbol !== leftTypeofOperandResolvedSymbol && leftTypeofOperandAliasedSymbol !== leftTypeofOperandSymbol ? { leftTypeofOperandAliasedSymbol } : {}),
      ...(leftTypeofOperandSourcePrimitive !== undefined ? { leftTypeofOperandSourcePrimitive } : {}),
      ...(right !== undefined ? { right } : {}),
      ...(rightType !== undefined ? { rightType } : {}),
      ...(rightSymbol !== undefined ? { rightSymbol } : {}),
      ...(rightResolvedSymbol !== undefined && rightResolvedSymbol !== rightSymbol ? { rightResolvedSymbol } : {}),
      ...(rightAliasedSymbol !== undefined && rightAliasedSymbol !== rightResolvedSymbol && rightAliasedSymbol !== rightSymbol ? { rightAliasedSymbol } : {}),
      ...(rightSourcePrimitive !== undefined ? { rightSourcePrimitive } : {}),
      ...(rightTypeofOperand !== undefined ? { rightTypeofOperand } : {}),
      ...(rightTypeofOperandType !== undefined ? { rightTypeofOperandType } : {}),
      ...(rightTypeofOperandSymbol !== undefined ? { rightTypeofOperandSymbol } : {}),
      ...(rightTypeofOperandResolvedSymbol !== undefined && rightTypeofOperandResolvedSymbol !== rightTypeofOperandSymbol ? { rightTypeofOperandResolvedSymbol } : {}),
      ...(rightTypeofOperandAliasedSymbol !== undefined && rightTypeofOperandAliasedSymbol !== rightTypeofOperandResolvedSymbol && rightTypeofOperandAliasedSymbol !== rightTypeofOperandSymbol ? { rightTypeofOperandAliasedSymbol } : {}),
      ...(rightTypeofOperandSourcePrimitive !== undefined ? { rightTypeofOperandSourcePrimitive } : {}),
      ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    },
    () => {
      throw new Error("Optional extension operator resolution unexpectedly reached core fallback.");
    },
    { deferWhenUnanswered: true },
  );

  if (result.kind !== "accept") {
    return;
  }

  extensionHost.facts.set(expression, targetOperationFactKey, result.value.operation, result.evidence ?? []);
}

function getTypeofOperand(expression: GoPtr<Node>): GoPtr<Node> {
  return expression?.Kind === KindTypeOfExpression
    ? AsTypeOfExpression(expression)?.Expression
    : undefined;
}

export function recordExtensionUnaryOperatorResolution(checker: GoPtr<CheckerWithProgram>, expression: GoPtr<Node>, operator: number, operand: GoPtr<Node>): void {
  if (checker === undefined || expression === undefined || operand === undefined) {
    return;
  }

  const extensionHost = getExtensionHost(checker.program);
  if (
    extensionHost === undefined ||
    (
      extensionHost.getDecisionOwner(ExtensionDecisionQuestion.resolveOperator) === undefined &&
      !extensionHost.hasDecisionHook(ExtensionDecisionQuestion.resolveOperator)
    )
  ) {
    return;
  }

  const operandType = Checker_getTypeOfExpression(checker, operand);
  const operandSymbol = getOperatorOperandSymbol(checker, operand);
  const operandSourcePrimitive = getOperatorOperandSourcePrimitive(extensionHost, operand, operandType, operandSymbol);
  const result = extensionHost.runDecision(
    ExtensionDecisionQuestion.resolveOperator,
    {
      expression,
      operator: TokenToString(operator),
      left: operand,
      ...(operandType !== undefined ? { leftType: operandType } : {}),
      ...(operandSymbol !== undefined ? { leftSymbol: operandSymbol } : {}),
      ...(operandSourcePrimitive !== undefined ? { leftSourcePrimitive: operandSourcePrimitive } : {}),
      ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    },
    () => {
      throw new Error("Optional extension unary operator resolution unexpectedly reached core fallback.");
    },
    { deferWhenUnanswered: true },
  );

  if (result.kind !== "accept") {
    return;
  }

  extensionHost.facts.set(expression, targetOperationFactKey, result.value.operation, result.evidence ?? []);
}

function getOperatorOperandSymbol(checker: GoPtr<CheckerWithProgram>, operand: GoPtr<Node>): GoPtr<Symbol> {
  switch (operand?.Kind) {
    case KindIdentifier:
    case KindElementAccessExpression:
      return Checker_GetSymbolAtLocation(checker, operand);
    case KindPropertyAccessExpression:
      return Node_Symbol(Node_Name(operand));
    default:
      return undefined;
  }
}

function getOperatorOperandResolvedSymbol(checker: GoPtr<CheckerWithProgram>, operand: GoPtr<Node>): GoPtr<Symbol> {
  switch (operand?.Kind) {
    case KindIdentifier:
      return Checker_getResolvedSymbol(checker, operand);
    case KindPropertyAccessExpression:
      return Node_Symbol(Node_Name(operand));
    default:
      return undefined;
  }
}

function getAliasedSymbol(checker: GoPtr<CheckerWithProgram>, symbol: GoPtr<Symbol>): GoPtr<Symbol> {
  if (checker === undefined || symbol === undefined || (symbol.Flags & SymbolFlagsAlias) === 0) {
    return undefined;
  }
  return Checker_GetAliasedSymbol(checker, symbol);
}

function getCallCalleeSymbol(checker: GoPtr<CheckerWithProgram>, callee: GoPtr<Node>): GoPtr<Symbol> {
  switch (callee?.Kind) {
    case KindIdentifier:
    case KindPropertyAccessExpression:
    case KindElementAccessExpression:
      return Checker_GetSymbolAtLocation(checker, callee);
    default:
      return undefined;
  }
}

function getCallCalleeResolvedSymbol(checker: GoPtr<CheckerWithProgram>, callee: GoPtr<Node>): GoPtr<Symbol> {
  switch (callee?.Kind) {
    case KindIdentifier:
      return Checker_getResolvedSymbol(checker, callee);
    case KindPropertyAccessExpression:
      return Node_Symbol(Node_Name(callee));
    default:
      return undefined;
  }
}

function getPropertyAccessCallReceiver(callee: GoPtr<Node>): GoPtr<Node> {
  return callee?.Kind === KindPropertyAccessExpression ? Node_Expression(callee) : undefined;
}

function getCallReceiverSymbol(checker: GoPtr<CheckerWithProgram>, receiver: GoPtr<Node>): GoPtr<Symbol> {
  switch (receiver?.Kind) {
    case KindIdentifier:
    case KindElementAccessExpression:
      return Checker_GetSymbolAtLocation(checker, receiver);
    case KindPropertyAccessExpression:
      return Node_Symbol(Node_Name(receiver));
    default:
      return undefined;
  }
}

function getCallReceiverResolvedSymbol(checker: GoPtr<CheckerWithProgram>, receiver: GoPtr<Node>): GoPtr<Symbol> {
  switch (receiver?.Kind) {
    case KindIdentifier:
      return Checker_getResolvedSymbol(checker, receiver);
    case KindPropertyAccessExpression:
      return Node_Symbol(Node_Name(receiver));
    default:
      return undefined;
  }
}

function getCallArgumentSymbol(checker: GoPtr<CheckerWithProgram>, argument: GoPtr<Node>): GoPtr<Symbol> {
  switch (argument?.Kind) {
    case KindIdentifier:
    case KindElementAccessExpression:
      return Checker_GetSymbolAtLocation(checker, argument);
    case KindPropertyAccessExpression:
      return Node_Symbol(Node_Name(argument));
    default:
      return undefined;
  }
}

function getCallArgumentResolvedSymbol(checker: GoPtr<CheckerWithProgram>, argument: GoPtr<Node>): GoPtr<Symbol> {
  switch (argument?.Kind) {
    case KindIdentifier:
      return Checker_getResolvedSymbol(checker, argument);
    case KindPropertyAccessExpression:
      return Node_Symbol(Node_Name(argument));
    default:
      return undefined;
  }
}

function getOperatorOperandSourcePrimitive(
  extensionHost: ExtensionHost,
  operand: GoPtr<Node>,
  operandType: GoPtr<Type>,
  operandSymbol: GoPtr<Symbol>,
) {
  return resolveOptionalSourcePrimitive(extensionHost, operand) ??
    resolveOptionalSourcePrimitive(extensionHost, operandSymbol) ??
    resolveOptionalSourcePrimitive(extensionHost, operandType) ??
    resolveOptionalSourcePrimitive(extensionHost, operandType?.symbol);
}

function resolveOptionalSourcePrimitive(extensionHost: ExtensionHost, subject: ExtensionFactSubject | undefined) {
  return subject === undefined ? undefined : extensionHost.factResolver.resolve(subject, sourcePrimitiveFactKey);
}

export function recordExtensionIterationResolution(
  checker: GoPtr<CheckerWithProgram>,
  statement: GoPtr<Node>,
  iterable: GoPtr<Node>,
  iterableType: GoPtr<Type>,
  iteratedType: GoPtr<Type>,
  iterationKind: ResolveIterationRequest["iterationKind"],
): void {
  if (checker === undefined || statement === undefined || iterable === undefined) {
    return;
  }

  const extensionHost = getExtensionHost(checker.program);
  if (
    extensionHost === undefined ||
    (
      extensionHost.getDecisionOwner(ExtensionDecisionQuestion.resolveIteration) === undefined &&
      !extensionHost.hasDecisionHook(ExtensionDecisionQuestion.resolveIteration)
    )
  ) {
    return;
  }

  const result = extensionHost.runDecision(
    ExtensionDecisionQuestion.resolveIteration,
    {
      statement,
      iterable,
      ...(iterableType !== undefined ? { iterableType } : {}),
      iterationKind,
      ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    },
    () => {
      throw new Error("Optional extension iteration resolution unexpectedly reached core fallback.");
    },
    { deferWhenUnanswered: true },
  );

  if (result.kind !== "accept") {
    return;
  }

  const iteration = result.value.iteration.elementType === undefined && result.value.elementType !== undefined
    ? { ...result.value.iteration, elementType: result.value.elementType }
    : result.value.iteration;
  const fact = iteration.elementType === undefined && iteratedType !== undefined
    ? { ...iteration, elementType: iteratedType }
    : iteration;
  extensionHost.facts.set(statement, targetIterationFactKey, fact, result.evidence ?? []);
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
  const parameterModeOwner = extensionHost.getDecisionOwner(ExtensionDecisionQuestion.getParameterMode);
  const parameters = callResult.selectedSignature.member.parameters;
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index];
    const parameter = getSourceArgumentTargetParameter(callResult, index);
    if (parameter === undefined || argument === undefined) {
      continue;
    }
    if (parameterModeOwner === undefined) {
      if (parameter.passingMode !== "by-value") {
        extensionHost.facts.set(argument, argumentPassingFactKey, {
          mode: parameter.passingMode,
          targetExpression: argument,
        }, [{
          message: "selected target signature parameter passing mode",
          details: {
            memberId: callResult.selectedSignature.member.id,
            parameterName: parameter.name,
          },
        }]);
      }
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
  const conversionOwner = extensionHost.getDecisionOwner(ExtensionDecisionQuestion.resolveConversion);
  if (conversionOwner === undefined) {
    recordSelectedSignatureArgumentConversions(extensionHost, callResult, arguments_);
    return;
  }
  const parameters = callResult.selectedSignature.member.parameters;
  if (parameters.length === 0) {
    return;
  }
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index];
    const parameter = getSourceArgumentTargetParameter(callResult, index);
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

function recordSelectedSignatureArgumentConversions(extensionHost: ExtensionHost, callResult: ResolveCallResult, arguments_: readonly GoPtr<Node>[]): void {
  const conversions = callResult.selectedSignature.argumentConversions;
  if (conversions === undefined) {
    return;
  }
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index];
    const convertedType = conversions[index];
    if (argument === undefined || convertedType === undefined) {
      continue;
    }
    extensionHost.facts.set(argument, targetConversionFactKey, {
      convertedType,
    }, [{
      message: "selected target signature argument conversion",
      details: {
        memberId: callResult.selectedSignature.member.id,
        argumentIndex: index,
      },
    }]);
  }
}

function getSourceArgumentTargetParameter(
  callResult: ResolveCallResult,
  sourceArgumentIndex: number,
): ResolveCallResult["selectedSignature"]["member"]["parameters"][number] | undefined {
  const parameters = callResult.selectedSignature.member.parameters;
  const receiverArgumentIndex = callResult.selectedSignature.member.receiverArgumentIndex;
  if (receiverArgumentIndex === undefined) {
    return parameters[sourceArgumentIndex];
  }
  const targetParameterIndex = sourceArgumentIndex < receiverArgumentIndex
    ? sourceArgumentIndex
    : sourceArgumentIndex + 1;
  return parameters[targetParameterIndex];
}

function definedFactSubjects<T extends object>(subjects: readonly (T | undefined)[]): readonly ExtensionFactSubject[] {
  return subjects.filter((subject): subject is T => subject !== undefined);
}

function isNodeSubject(subject: ExtensionFactSubject): subject is Node {
  return typeof subject === "object" &&
    subject !== null &&
    typeof (subject as { readonly Kind?: unknown }).Kind === "number";
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
