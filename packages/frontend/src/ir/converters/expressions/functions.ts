/**
 * Function expression converters (function expressions and arrow functions)
 */

import * as ts from "typescript";
import {
  IrFunctionExpression,
  IrArrowFunctionExpression,
  IrFunctionType,
  IrParameter,
  IrType,
} from "../../types.js";
import { getSourceSpan } from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import { convertBlockStatement } from "../statements/control.js";
import { convertBindingName } from "../../syntax/binding-patterns.js";
import { withParameterTypeEnv } from "../type-env.js";
import type { ProgramContext } from "../../program-context.js";
import { getReturnExpressionExpectedType } from "../return-expression-types.js";

const isNullishPrimitive = (type: IrType): boolean =>
  type.kind === "primitiveType" &&
  (type.name === "null" || type.name === "undefined");

const normalizeExpectedFunctionType = (
  expectedType: IrType | undefined,
  ctx: ProgramContext
): IrFunctionType | undefined => {
  if (!expectedType) return undefined;
  const candidates = ctx.typeSystem
    .collectExpectedReturnCandidates(expectedType)
    .filter(
      (member): member is IrType => !!member && !isNullishPrimitive(member)
    )
    .map((member) => {
      if (member.kind === "functionType") return member;
      return ctx.typeSystem.delegateToFunctionType(member);
    })
    .filter((member): member is IrFunctionType => member !== undefined);

  if (candidates.length !== 1) return undefined;
  return candidates[0];
};

const shouldUseExpectedReturnType = (
  expectedReturnType: IrType | undefined,
  typeSystem: ProgramContext["typeSystem"]
): boolean =>
  expectedReturnType !== undefined &&
  expectedReturnType.kind !== "typeParameterType" &&
  expectedReturnType.kind !== "unknownType" &&
  expectedReturnType.kind !== "anyType" &&
  !typeSystem.containsTypeParameter(expectedReturnType);

const getContextualRestElementType = (
  type: IrType | undefined,
  offset: number
): IrType | undefined => {
  if (!type) return undefined;

  if (type.kind === "arrayType") {
    return type.elementType;
  }

  if (type.kind === "tupleType") {
    return (
      type.elementTypes[offset] ??
      type.elementTypes[type.elementTypes.length - 1]
    );
  }

  if (
    type.kind === "referenceType" &&
    (type.name === "Array" ||
      type.name === "ReadonlyArray" ||
      type.name === "ArrayLike") &&
    type.typeArguments?.length === 1
  ) {
    return type.typeArguments[0];
  }

  return undefined;
};

/**
 * Extract lambda parameter types from an expected function type.
 * DETERMINISTIC: Uses only the IR type structure, not TS type inference.
 *
 * Rest callbacks contextual-type explicit lambda parameters positionally:
 * `(first, second)` against `(...args: unknown[]) => void` gives each explicit
 * parameter the rest element type (`unknown`), not the rest carrier type
 * (`unknown[]`). Only explicit `...rest` parameters keep the full carrier.
 */
const extractParamTypesFromExpectedType = (
  expectedType: IrType | undefined,
  parameters: readonly ts.ParameterDeclaration[]
): readonly (IrType | undefined)[] | undefined => {
  if (!expectedType) return undefined;
  if (expectedType.kind !== "functionType") return undefined;

  const contextualParameters = expectedType.parameters;
  const contextualRestIndex = contextualParameters.findIndex(
    (parameter) => parameter.isRest
  );
  const contextualRestParameter =
    contextualRestIndex >= 0
      ? contextualParameters[contextualRestIndex]
      : undefined;

  return parameters.map((parameter, index) => {
    if (
      contextualRestParameter === undefined ||
      contextualRestIndex < 0 ||
      index < contextualRestIndex
    ) {
      return contextualParameters[index]?.type;
    }

    if (parameter.dotDotDotToken) {
      return contextualRestParameter.type;
    }

    return getContextualRestElementType(
      contextualRestParameter.type,
      index - contextualRestIndex
    );
  });
};

/**
 * Convert parameters for lambda expressions (arrow functions and function expressions).
 *
 * DETERMINISTIC TYPING: Parameter types come from:
 * 1. Explicit type annotations on the parameter
 * 2. expectedType (function type passed from call site via extractParameterTypes)
 *
 * If no type is available, parameter type is undefined (unknownType poison).
 * Validation will emit TSN5202 for untyped lambda parameters.
 */
const convertLambdaParameters = (
  node: ts.ArrowFunction | ts.FunctionExpression,
  ctx: ProgramContext,
  expectedType: IrType | undefined
): readonly IrParameter[] => {
  // DETERMINISTIC: Extract parameter types from expectedType (the ONLY source for unannotated params)
  const expectedParamTypes = extractParamTypesFromExpectedType(
    expectedType,
    node.parameters
  );

  return node.parameters.map((param, index) => {
    let passing: "value" | "ref" | "out" | "in" = "value";
    let actualType: ts.TypeNode | undefined = param.type;
    let isExtensionReceiver = false;

    // Detect wrapper types (explicit annotation only):
    // - thisarg<T> marks an extension-method receiver parameter (emits C# `this`)
    // - ref<T>/out<T>/in<T> wrapper types mark passing mode (unwrap to T)
    while (
      actualType &&
      ts.isTypeReferenceNode(actualType) &&
      ts.isIdentifier(actualType.typeName) &&
      actualType.typeArguments &&
      actualType.typeArguments.length > 0
    ) {
      const typeName = actualType.typeName.text;

      if (typeName === "thisarg") {
        isExtensionReceiver = true;
        actualType = actualType.typeArguments[0];
        continue;
      }

      if (typeName === "ref" || typeName === "out" || typeName === "in") {
        passing = typeName === "in" ? "in" : typeName;
        actualType = actualType.typeArguments[0];
        continue;
      }

      break;
    }

    // Determine the IrType for this parameter
    // DETERMINISTIC Priority: 1. Explicit annotation, 2. expectedType from call site
    let irType: IrType | undefined;
    if (actualType) {
      // Explicit type annotation
      // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
      const typeSystem = ctx.typeSystem;
      irType = typeSystem.typeFromSyntax(
        ctx.binding.captureTypeSyntax(actualType)
      );
    } else if (expectedParamTypes && expectedParamTypes[index]) {
      // Use expectedType from call site (deterministic)
      irType = expectedParamTypes[index];
    }
    // If no type available, irType stays undefined (unknownType poison)
    // Validation will emit TSN5202 for untyped lambda parameters

    return {
      kind: "parameter" as const,
      pattern: convertBindingName(param.name, ctx),
      type: irType,
      // Pass parameter type for contextual typing of default value
      initializer: param.initializer
        ? convertExpression(param.initializer, ctx, irType)
        : undefined,
      isOptional: !!param.questionToken,
      isRest: !!param.dotDotDotToken,
      passing,
      isExtensionReceiver: isExtensionReceiver || undefined,
    };
  });
};

/**
 * Convert function expression
 *
 * DETERMINISTIC TYPING: Build function type from declared parameters and return type.
 * Parameter types come from explicit annotations or expectedType (no TS inference).
 */
export const convertFunctionExpression = (
  node: ts.FunctionExpression,
  ctx: ProgramContext,
  expectedType?: IrType
): IrFunctionExpression => {
  // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
  const typeSystem = ctx.typeSystem;
  const expectedFnType = normalizeExpectedFunctionType(expectedType, ctx);

  // Get return type from declared annotation, or from expectedType if available.
  const declaredReturnType = node.type
    ? typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(node.type))
    : undefined;
  const expectedReturnType = expectedFnType?.returnType;
  const useExpectedReturnType = shouldUseExpectedReturnType(
    expectedReturnType,
    typeSystem
  );

  // DETERMINISTIC: Pass expectedType for parameter type inference
  const parameters = convertLambdaParameters(
    node,
    ctx,
    expectedFnType ?? expectedType
  );

  const bodyCtx = withParameterTypeEnv(ctx, node.parameters, parameters);

  const returnType =
    declaredReturnType ??
    (useExpectedReturnType ? expectedReturnType : undefined);
  const inferredReturnType = returnType ?? ({ kind: "unknownType" } as const);
  const returnExpressionType = getReturnExpressionExpectedType(
    returnType,
    !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)
  );

  // DETERMINISTIC: Build function type from declared parameters and return type
  const inferredType = {
    kind: "functionType" as const,
    parameters,
    returnType: inferredReturnType,
  };

  return {
    kind: "functionExpression",
    name: node.name?.text,
    parameters,
    returnType: declaredReturnType,
    // Pass return type to body for contextual typing of return statements
    body: node.body
      ? convertBlockStatement(node.body, bodyCtx, returnExpressionType)
      : { kind: "blockStatement", statements: [] },
    isAsync: !!node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.AsyncKeyword
    ),
    isGenerator: !!node.asteriskToken,
    inferredType,
    sourceSpan: getSourceSpan(node),
  };
};

/**
 * Convert arrow function expression
 *
 * DETERMINISTIC TYPING: Build function type from declared parameters and return type.
 * Parameter types come from explicit annotations or expectedType (no TS inference).
 */
export const convertArrowFunction = (
  node: ts.ArrowFunction,
  ctx: ProgramContext,
  expectedType?: IrType
): IrArrowFunctionExpression => {
  // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
  const typeSystem = ctx.typeSystem;
  const expectedFnType = normalizeExpectedFunctionType(expectedType, ctx);

  // Get return type from declared annotation, or from expectedType if available
  const declaredReturnType = node.type
    ? typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(node.type))
    : undefined;
  // DETERMINISTIC: Use expectedType's return type if no explicit annotation
  const expectedReturnType = expectedFnType?.returnType;
  const useExpectedReturnType = shouldUseExpectedReturnType(
    expectedReturnType,
    typeSystem
  );

  const contextualReturnType =
    declaredReturnType ??
    (useExpectedReturnType ? expectedReturnType : undefined);
  const returnExpressionType = getReturnExpressionExpectedType(
    contextualReturnType,
    !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)
  );

  // DETERMINISTIC: Pass expectedType for parameter type inference
  const parameters = convertLambdaParameters(
    node,
    ctx,
    expectedFnType ?? expectedType
  );

  const bodyCtx = withParameterTypeEnv(ctx, node.parameters, parameters);

  // Pass return type to body for contextual typing:
  // - Block body: return statements get the expected type
  // - Expression body: the expression gets the expected type
  const body = ts.isBlock(node.body)
    ? convertBlockStatement(node.body, bodyCtx, returnExpressionType)
    : convertExpression(node.body, bodyCtx, returnExpressionType);

  const expressionBodyReturnType = !ts.isBlock(node.body)
    ? (body as ReturnType<typeof convertExpression>).inferredType
    : undefined;

  const returnType =
    declaredReturnType ??
    (expressionBodyReturnType &&
    useExpectedReturnType &&
    expectedReturnType &&
    ctx.typeSystem.isAssignableTo(expressionBodyReturnType, expectedReturnType)
      ? expressionBodyReturnType
      : useExpectedReturnType
        ? expectedReturnType
        : (expressionBodyReturnType ?? expectedReturnType));

  // DETERMINISTIC TYPING: contextualType comes from expectedType
  const contextualType = expectedType;

  // DETERMINISTIC: Build function type from declared parameters and return type
  const inferredType = {
    kind: "functionType" as const,
    parameters,
    returnType: returnType ?? { kind: "unknownType" as const },
  };

  return {
    kind: "arrowFunction",
    parameters,
    returnType,
    body,
    isAsync: !!node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.AsyncKeyword
    ),
    inferredType,
    contextualType,
    sourceSpan: getSourceSpan(node),
  };
};
