/**
 * Function expression converters (function expressions and arrow functions)
 */

import {
  getTstsBodyNode,
  getTstsIdentifierText,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
import {
  IrFunctionExpression,
  IrArrowFunctionExpression,
  IrFunctionType,
  IrParameter,
  IrType,
} from "../../types.js";
import { getSourceSpan, getTstsParameters, isTstsAsync } from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import { convertBlockStatement } from "../statements/control.js";
import { convertBindingName } from "../../syntax/binding-patterns.js";
import { withParameterTypeEnv } from "../type-env.js";
import type { ProgramContext } from "../../program-context.js";
import { getReturnExpressionExpectedType } from "../return-expression-types.js";
import { inferDeterministicBlockReturnType } from "../statements/declarations/return-type-inference.js";
import {
  extensionReceiverSemanticsFactKey,
  parameterPassingFactKey,
  parameterPassingModeFromFact,
  type IrParameterPassingMode,
} from "../../../source-frontend/index.js";

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

const isExpressionTreeReferenceType = (type: IrType | undefined): boolean => {
  if (!type || type.kind !== "referenceType") return false;
  if (type.typeArguments?.length !== 1) return false;
  return (
    type.typeId?.sourceName === "Expression_1" || type.name === "Expression_1"
  );
};

const withExpressionTreeLambdaContext = (
  ctx: ProgramContext,
  expectedType: IrType | undefined
): ProgramContext =>
  isExpressionTreeReferenceType(expectedType)
    ? {
        ...ctx,
        expressionTreeLambdaDepth: (ctx.expressionTreeLambdaDepth ?? 0) + 1,
      }
    : ctx;

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

type SourceParameterTypeUnwrap = {
  readonly typeNode: TstsNode | undefined;
  readonly passing: IrParameterPassingMode;
  readonly isExtensionReceiver: boolean;
};

const unwrapSourceParameterType = (
  parameter: TstsNode,
  ctx: ProgramContext
): SourceParameterTypeUnwrap => {
  let current = TstsSyntax.Node_Type(parameter);
  let passing: IrParameterPassingMode = "value";
  let isExtensionReceiver = false;

  while (current) {
    if (current.Kind === TstsSyntax.KindParenthesizedType) {
      current = TstsSyntax.Node_Type(current);
      continue;
    }

    if (current.Kind !== TstsSyntax.KindTypeReference) {
      break;
    }

    const typeArguments = TstsSyntax.Node_TypeArguments(current) ?? [];
    const innerType = typeArguments[0];
    if (!innerType || typeArguments.length !== 1) {
      break;
    }

    if (
      ctx.sourceSemantics.getFact(current, extensionReceiverSemanticsFactKey)
        ?.kind === "extension-receiver"
    ) {
      isExtensionReceiver = true;
      current = innerType;
      continue;
    }

    const nextPassing = parameterPassingModeFromFact(
      ctx.sourceSemantics.getFact(current, parameterPassingFactKey)
    );
    if (nextPassing && nextPassing !== "value") {
      passing = nextPassing;
      current = innerType;
      continue;
    }

    break;
  }

  return { typeNode: current, passing, isExtensionReceiver };
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
  parameters: readonly TstsNode[]
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

    if (TstsSyntax.AsParameterDeclaration(parameter)?.DotDotDotToken) {
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
  node: TstsNode,
  ctx: ProgramContext,
  expectedType: IrType | undefined
): readonly IrParameter[] => {
  const parameters = getTstsParameters(node);
  // DETERMINISTIC: Extract parameter types from expectedType (the ONLY source for unannotated params)
  const expectedParamTypes = extractParamTypesFromExpectedType(
    expectedType,
    parameters
  );

  return parameters.map((param, index) => {
    const unwrapped = unwrapSourceParameterType(param, ctx);

    // Determine the IrType for this parameter
    // DETERMINISTIC Priority: 1. Explicit annotation, 2. expectedType from call site
    let irType: IrType | undefined;
    if (unwrapped.typeNode) {
      // Convert explicit parameter syntax through the TypeSystem.
      const typeSystem = ctx.typeSystem;
      irType = typeSystem.typeFromSyntax(
        ctx.binding.captureTypeSyntax(unwrapped.typeNode)
      );
    } else if (expectedParamTypes && expectedParamTypes[index]) {
      // Use expectedType from call site (deterministic)
      irType = expectedParamTypes[index];
    }
    // If no type available, irType stays undefined (unknownType poison)
    // Validation will emit TSN5202 for untyped lambda parameters

    return {
      kind: "parameter" as const,
          pattern: convertBindingName(TstsSyntax.Node_Name(param) ?? param, ctx),
      type: irType,
      // Pass parameter type for contextual typing of default value
      initializer: TstsSyntax.Node_Initializer(param)
        ? convertExpression(TstsSyntax.Node_Initializer(param)!, ctx, irType)
        : undefined,
      isOptional: TstsSyntax.Node_QuestionToken(param) !== undefined,
      isRest: TstsSyntax.AsParameterDeclaration(param)?.DotDotDotToken !== undefined,
      passing: unwrapped.passing,
      isExtensionReceiver: unwrapped.isExtensionReceiver || undefined,
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
  node: TstsNode,
  ctx: ProgramContext,
  expectedType?: IrType
): IrFunctionExpression => {
  // Convert function syntax through the TypeSystem.
  const typeSystem = ctx.typeSystem;
  const expectedFnType = normalizeExpectedFunctionType(expectedType, ctx);

  // Get return type from declared annotation, or from expectedType if available.
  const declaredReturnType = TstsSyntax.Node_Type(node)
    ? typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(TstsSyntax.Node_Type(node)!))
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

  const bodyCtx = withExpressionTreeLambdaContext(
    withParameterTypeEnv(ctx, getTstsParameters(node), parameters),
    expectedType
  );

  const contextualReturnType =
    declaredReturnType ??
    (useExpectedReturnType ? expectedReturnType : undefined);
  const returnExpressionType = getReturnExpressionExpectedType(
    contextualReturnType,
    isTstsAsync(node)
  );

  const bodyNode = getTstsBodyNode(node);
  const body = bodyNode
    ? convertBlockStatement(bodyNode, bodyCtx, returnExpressionType)
    : { kind: "blockStatement" as const, statements: [] };
  const inferredBlockReturnType = inferDeterministicBlockReturnType(body);
  const returnType = contextualReturnType ?? inferredBlockReturnType;
  const inferredReturnType = returnType ?? ({ kind: "unknownType" } as const);

  // DETERMINISTIC: Build function type from declared parameters and return type
  const inferredType = {
    kind: "functionType" as const,
    parameters,
    returnType: inferredReturnType,
  };

  return {
    kind: "functionExpression",
    name: getTstsIdentifierText(TstsSyntax.Node_Name(node)),
    parameters,
    returnType,
    // Pass return type to body for contextual typing of return statements
    body,
    isAsync: isTstsAsync(node),
    isGenerator:
      TstsSyntax.AsFunctionExpression(node)?.AsteriskToken !== undefined ||
      TstsSyntax.AsMethodDeclaration(node)?.AsteriskToken !== undefined,
    inferredType,
    contextualType: expectedType,
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
  node: TstsNode,
  ctx: ProgramContext,
  expectedType?: IrType
): IrArrowFunctionExpression => {
  // Convert arrow syntax through the TypeSystem.
  const typeSystem = ctx.typeSystem;
  const expectedFnType = normalizeExpectedFunctionType(expectedType, ctx);

  // Get return type from declared annotation, or from expectedType if available
  const declaredReturnType = TstsSyntax.Node_Type(node)
    ? typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(TstsSyntax.Node_Type(node)!))
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
    isTstsAsync(node)
  );

  // DETERMINISTIC: Pass expectedType for parameter type inference
  const parameters = convertLambdaParameters(
    node,
    ctx,
    expectedFnType ?? expectedType
  );

  const bodyCtx = withExpressionTreeLambdaContext(
    withParameterTypeEnv(ctx, getTstsParameters(node), parameters),
    expectedType
  );

  // Pass return type to body for contextual typing:
  // - Block body: return statements get the expected type
  // - Expression body: the expression gets the expected type
  const bodyNode = getTstsBodyNode(node);
  if (!bodyNode) {
    throw new Error("ICE: arrow function without body reached IR conversion");
  }
  const body = bodyNode.Kind === TstsSyntax.KindBlock
    ? convertBlockStatement(bodyNode, bodyCtx, returnExpressionType)
    : convertExpression(bodyNode, bodyCtx, returnExpressionType);

  const expressionBodyReturnType = bodyNode.Kind !== TstsSyntax.KindBlock
    ? (body as ReturnType<typeof convertExpression>).inferredType
    : undefined;
  const inferredBlockReturnType =
    bodyNode.Kind === TstsSyntax.KindBlock && body.kind === "blockStatement"
      ? inferDeterministicBlockReturnType(body)
      : undefined;

  const returnType =
    contextualReturnType ?? expressionBodyReturnType ?? inferredBlockReturnType;
  const inferredReturnType =
    declaredReturnType ??
    expressionBodyReturnType ??
    inferredBlockReturnType ??
    (useExpectedReturnType ? expectedReturnType : undefined);

  // DETERMINISTIC TYPING: contextualType comes from expectedType
  const contextualType = expectedType;

  // DETERMINISTIC: Build function type from declared parameters and return type
  const inferredType = {
    kind: "functionType" as const,
    parameters,
    returnType: inferredReturnType ?? { kind: "unknownType" as const },
  };

  return {
    kind: "arrowFunction",
    parameters,
    returnType,
    body,
    isAsync: isTstsAsync(node),
    inferredType,
    contextualType,
    sourceSpan: getSourceSpan(node),
  };
};
