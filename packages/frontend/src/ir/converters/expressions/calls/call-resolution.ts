/**
 * Call resolution helpers
 *
 * Contains callable-candidate resolution, overload scoring, and
 * getDeclaredReturnType for call/new expressions.
 *
 * ALICE'S SPEC: All call resolution goes through TypeSystem.resolveCall().
 * NO FALLBACKS ALLOWED. If TypeSystem can't resolve, return unknownType.
 */

import * as ts from "typescript";
import { IrCallExpression, getSpreadTupleShape } from "../../../types.js";
import { IrType } from "../../../types.js";
import type { ProgramContext } from "../../../program-context.js";
import type { ResolvedCall } from "../../../type-system/type-system.js";

// DELETED: getReturnTypeFromFunctionType - Was part of fallback path
// DELETED: getCalleesDeclaredType - Was part of fallback path
// Alice's spec: TypeSystem.resolveCall() is the single source of truth.

export const flattenCallableCandidates = (
  type: IrType | undefined,
  ctx: ProgramContext
): readonly Extract<IrType, { kind: "functionType" }>[] => {
  if (!type) return [];

  if (type.kind === "functionType") {
    return [type];
  }

  if (type.kind === "intersectionType") {
    return type.types.flatMap((member) =>
      flattenCallableCandidates(member, ctx)
    );
  }

  const delegated = ctx.typeSystem.delegateToFunctionType(type);
  return delegated ? [delegated] : [];
};

export const countRequiredParameters = (
  type: Extract<IrType, { kind: "functionType" }>
): number =>
  type.parameters.filter(
    (parameter) => !parameter.isOptional && !parameter.isRest
  ).length;

export const canAcceptArgumentCount = (
  type: Extract<IrType, { kind: "functionType" }>,
  argumentCount: number
): boolean => {
  const required = countRequiredParameters(type);
  if (argumentCount < required) return false;

  const hasRest = type.parameters.some((parameter) => parameter.isRest);
  if (!hasRest && argumentCount > type.parameters.length) {
    return false;
  }

  return true;
};

export const collectResolutionArguments = (
  args: readonly IrCallExpression["arguments"][number][]
): {
  readonly argumentCount: number;
  readonly argTypes: readonly (IrType | undefined)[];
} => {
  const argTypes: (IrType | undefined)[] = [];

  for (const arg of args) {
    if (arg.kind !== "spread") {
      argTypes.push(arg.inferredType);
      continue;
    }

    const spreadShape = arg.inferredType
      ? getSpreadTupleShape(arg.inferredType)
      : undefined;
    if (!spreadShape) {
      continue;
    }

    for (const elementType of spreadShape.prefixElementTypes) {
      argTypes.push(elementType);
    }
  }

  return {
    argumentCount: argTypes.length,
    argTypes,
  };
};

export const scoreCallableCandidate = (
  type: Extract<IrType, { kind: "functionType" }>,
  argumentCount: number
): readonly [number, number, number, number] => {
  const hasRest = type.parameters.some((parameter) => parameter.isRest);
  const required = countRequiredParameters(type);
  return [
    hasRest ? 0 : 1,
    Math.max(0, required - argumentCount) === 0 ? 1 : 0,
    type.parameters.length === argumentCount ? 1 : 0,
    -type.parameters.length,
  ];
};

const NUMERIC_TYPE_NAMES = new Set([
  "number",
  "int",
  "byte",
  "sbyte",
  "short",
  "ushort",
  "uint",
  "long",
  "ulong",
  "float",
  "double",
  "decimal",
]);

const isNumericType = (type: IrType): boolean => {
  if (type.kind === "primitiveType") {
    return NUMERIC_TYPE_NAMES.has(type.name);
  }

  if (type.kind === "referenceType") {
    const simpleName = type.name.split(".").pop() ?? type.name;
    return NUMERIC_TYPE_NAMES.has(simpleName);
  }

  return false;
};

const isDeterministicallyNumericCompatible = (
  parameterType: IrType,
  argumentType: IrType
): boolean => {
  if (parameterType.kind === "unionType") {
    return parameterType.types.some((member) =>
      isDeterministicallyNumericCompatible(member, argumentType)
    );
  }

  if (argumentType.kind === "unionType") {
    return argumentType.types.every((member) =>
      isDeterministicallyNumericCompatible(parameterType, member)
    );
  }

  return isNumericType(parameterType) && isNumericType(argumentType);
};

const scoreTypeCompatibility = (
  parameterType: IrType,
  argumentType: IrType,
  ctx: ProgramContext
): number => {
  if (ctx.typeSystem.typesEqual(parameterType, argumentType)) {
    return 4;
  }

  if (ctx.typeSystem.isAssignableTo(argumentType, parameterType)) {
    return 3;
  }

  if (isDeterministicallyNumericCompatible(parameterType, argumentType)) {
    return 2;
  }

  const parameterFn =
    parameterType.kind === "functionType"
      ? parameterType
      : ctx.typeSystem.delegateToFunctionType(parameterType);
  const argumentFn =
    argumentType.kind === "functionType"
      ? argumentType
      : ctx.typeSystem.delegateToFunctionType(argumentType);
  if (parameterFn && argumentFn) {
    let score = 0;

    if (parameterFn.parameters.length === argumentFn.parameters.length) {
      score += 8;
    } else {
      score -=
        Math.abs(parameterFn.parameters.length - argumentFn.parameters.length) *
        2;
    }

    const pairCount = Math.min(
      parameterFn.parameters.length,
      argumentFn.parameters.length
    );
    for (let index = 0; index < pairCount; index += 1) {
      const parameter = parameterFn.parameters[index];
      const argument = argumentFn.parameters[index];
      if (!parameter?.type || !argument?.type) continue;
      score += scoreTypeCompatibility(parameter.type, argument.type, ctx);
    }

    if (
      argumentFn.returnType.kind !== "unknownType" &&
      argumentFn.returnType.kind !== "anyType"
    ) {
      score += scoreTypeCompatibility(
        parameterFn.returnType,
        argumentFn.returnType,
        ctx
      );
    }

    return score;
  }

  return 0;
};

export const compareCallableScores = (
  left: readonly [number, number, number, number],
  right: readonly [number, number, number, number]
): number => {
  for (let index = 0; index < left.length; index += 1) {
    const leftScore = left[index];
    const rightScore = right[index];
    if (leftScore === undefined || rightScore === undefined) {
      continue;
    }
    const delta = leftScore - rightScore;
    if (delta !== 0) return delta;
  }
  return 0;
};

export const chooseCallableCandidate = (
  type: IrType | undefined,
  argumentCount: number,
  ctx: ProgramContext,
  argTypes?: readonly (IrType | undefined)[]
): Extract<IrType, { kind: "functionType" }> | undefined => {
  return ctx.typeSystem.resolveCallableType(type, {
    argumentCount,
    argTypes,
  }).callableType;
};

export const resolveCallableCandidate = (
  type: IrType | undefined,
  argumentCount: number,
  ctx: ProgramContext,
  argTypes?: readonly (IrType | undefined)[],
  explicitTypeArgs?: readonly IrType[],
  expectedReturnType?: IrType
): {
  readonly callableType: Extract<IrType, { kind: "functionType" }> | undefined;
  readonly resolved: ResolvedCall | undefined;
} =>
  ctx.typeSystem.resolveCallableType(type, {
    argumentCount,
    argTypes,
    explicitTypeArgs,
    expectedReturnType,
  });

/**
 * Walk a property access chain and build a qualified name.
 * For `Foo.Bar.Baz`, returns "Foo.Bar.Baz" by walking the AST identifiers.
 * This avoids getText() which bakes source formatting into type identity.
 */
export const buildQualifiedName = (expr: ts.Expression): string | undefined => {
  if (ts.isIdentifier(expr)) {
    return expr.text;
  }

  if (ts.isPropertyAccessExpression(expr)) {
    const parts: string[] = [];
    let current: ts.Expression = expr;

    while (ts.isPropertyAccessExpression(current)) {
      parts.unshift(current.name.text);
      current = current.expression;
    }

    if (ts.isIdentifier(current)) {
      parts.unshift(current.text);
      return parts.join(".");
    }
  }

  return undefined;
};

export const unwrapExpr = (expr: ts.Expression): ts.Expression => {
  let current = expr;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
};

export const isArrayNamespaceExpression = (expr: ts.Expression): boolean => {
  const unwrapped = unwrapExpr(expr);
  if (ts.isIdentifier(unwrapped)) {
    return unwrapped.text === "Array";
  }

  if (ts.isPropertyAccessExpression(unwrapped)) {
    return (
      ts.isIdentifier(unwrapped.expression) &&
      unwrapped.expression.text === "globalThis" &&
      unwrapped.name.text === "Array"
    );
  }

  return false;
};

export const isArrayIsArrayCall = (expr: ts.Expression): boolean => {
  const unwrapped = unwrapExpr(expr);
  return (
    ts.isPropertyAccessExpression(unwrapped) &&
    unwrapped.name.text === "isArray" &&
    isArrayNamespaceExpression(unwrapped.expression)
  );
};

// DELETED: getDeclaredReturnTypeFallback - Alice's spec: no fallbacks allowed
// TypeSystem.resolveCall() is the single source of truth.

// DELETED: normalizeReceiverToNominal - No longer needed without NominalEnv fallback
// DELETED: getDeclaredReturnTypeNominalEnvFallback - Alice's spec: no fallbacks allowed
// TypeSystem.resolveCall() is the single source of truth.

/**
 * Get the declared return type from a call or new expression's signature.
 *
 * ALICE'S SPEC: Uses TypeSystem.resolveCall() EXCLUSIVELY.
 * NO FALLBACKS. If TypeSystem can't resolve, return unknownType.
 * This ensures any missing TypeSystem functionality surfaces as test failures.
 */
export const getDeclaredReturnType = (
  node: ts.CallExpression | ts.NewExpression,
  ctx: ProgramContext,
  receiverIrType?: IrType
): IrType | undefined => {
  const DEBUG = process.env.DEBUG_RETURN_TYPE === "1";
  const methodName =
    ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      ? node.expression.name.text
      : undefined;
  if (DEBUG && methodName) {
    console.log(
      "[getDeclaredReturnType]",
      methodName,
      "receiver:",
      receiverIrType
    );
  }

  // Handle new expressions specially - they construct the type from the expression
  if (ts.isNewExpression(node)) {
    // For new expressions with explicit type arguments
    if (node.typeArguments && node.typeArguments.length > 0) {
      const typeName = buildQualifiedName(node.expression);
      if (typeName) {
        // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
        const typeSystem = ctx.typeSystem;
        return {
          kind: "referenceType",
          name: typeName,
          typeArguments: node.typeArguments.map((ta) =>
            typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(ta))
          ),
        };
      }
    }
    // For constructors without type arguments, use the class name
    const typeName = buildQualifiedName(node.expression);
    if (typeName) {
      return { kind: "referenceType", name: typeName };
    }
    return undefined;
  }

  // For call expressions, use TypeSystem.resolveCall() EXCLUSIVELY
  const typeSystem = ctx.typeSystem;

  const sigId = ctx.binding.resolveCallSignature(node);
  if (!sigId) {
    if (DEBUG && methodName)
      console.log(
        "[getDeclaredReturnType]",
        methodName,
        "No signature resolved"
      );
    return undefined;
  }

  // Get argument count for totality
  const argumentCount = node.arguments.length;

  // Extract explicit type arguments from call site if any
  // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
  const explicitTypeArgs = node.typeArguments
    ? node.typeArguments.map((ta) =>
        typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(ta))
      )
    : undefined;

  // Use TypeSystem.resolveCall() - guaranteed to return a result
  // NO FALLBACK: If TypeSystem returns unknownType, that's the answer
  const resolved = typeSystem.resolveCall({
    sigId,
    argumentCount,
    receiverType: receiverIrType,
    explicitTypeArgs,
  });

  if (DEBUG && methodName) {
    console.log(
      "[getDeclaredReturnType]",
      methodName,
      "TypeSystem returned:",
      resolved.returnType
    );
  }

  // Return TypeSystem's answer directly - no fallbacks
  return resolved.returnType;
};
