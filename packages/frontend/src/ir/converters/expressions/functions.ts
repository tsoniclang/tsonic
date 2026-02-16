/**
 * Function expression converters (function expressions and arrow functions)
 */

import * as ts from "typescript";
import {
  IrFunctionExpression,
  IrArrowFunctionExpression,
  IrParameter,
  IrType,
} from "../../types.js";
import { getSourceSpan } from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import { convertBlockStatement } from "../../statement-converter.js";
import { convertBindingName } from "../../syntax/binding-patterns.js";
import type { ProgramContext } from "../../program-context.js";

/**
 * Extract parameter types from an expected function type.
 * DETERMINISTIC: Uses only the IR type structure, not TS type inference.
 */
const extractParamTypesFromExpectedType = (
  expectedType: IrType | undefined
): readonly (IrType | undefined)[] | undefined => {
  if (!expectedType) return undefined;
  if (expectedType.kind !== "functionType") return undefined;
  return expectedType.parameters.map((p) => p.type);
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
  const expectedParamTypes = extractParamTypesFromExpectedType(expectedType);

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
  // Get return type from declared annotation for contextual typing
  const returnType = node.type
    ? typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(node.type))
    : undefined;
  // DETERMINISTIC: Pass expectedType for parameter type inference
  const parameters = convertLambdaParameters(node, ctx, expectedType);

  const bodyCtx: ProgramContext = (() => {
    const env = new Map<number, IrType>(ctx.typeEnv ?? []);
    for (let i = 0; i < parameters.length; i++) {
      const p = parameters[i];
      const paramDecl = node.parameters[i];
      if (!p || !paramDecl) continue;
      if (p.pattern.kind !== "identifierPattern" || !p.type) continue;
      if (!ts.isIdentifier(paramDecl.name)) continue;

      const declId = ctx.binding.resolveIdentifier(paramDecl.name);
      if (!declId) continue;
      env.set(declId.id, p.type);
    }
    return { ...ctx, typeEnv: env };
  })();

  // DETERMINISTIC: Build function type from declared parameters and return type
  const inferredType = {
    kind: "functionType" as const,
    parameters,
    returnType: returnType ?? { kind: "voidType" as const },
  };

  return {
    kind: "functionExpression",
    name: node.name?.text,
    parameters,
    returnType,
    // Pass return type to body for contextual typing of return statements
    body: node.body
      ? convertBlockStatement(node.body, bodyCtx, returnType)
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
  const expectedFnType =
    expectedType?.kind === "functionType"
      ? expectedType
      : expectedType
        ? typeSystem.delegateToFunctionType(expectedType)
        : undefined;

  // Get return type from declared annotation, or from expectedType if available
  const declaredReturnType = node.type
    ? typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(node.type))
    : undefined;
  // DETERMINISTIC: Use expectedType's return type if no explicit annotation
  const expectedReturnType = expectedFnType?.returnType;

  const shouldUseExpectedReturnType =
    expectedReturnType !== undefined &&
    expectedReturnType.kind !== "typeParameterType" &&
    !typeSystem.containsTypeParameter(expectedReturnType);

  const contextualReturnType =
    declaredReturnType ??
    (shouldUseExpectedReturnType ? expectedReturnType : undefined);

  // DETERMINISTIC: Pass expectedType for parameter type inference
  const parameters = convertLambdaParameters(
    node,
    ctx,
    expectedFnType ?? expectedType
  );

  const bodyCtx: ProgramContext = (() => {
    const env = new Map<number, IrType>(ctx.typeEnv ?? []);
    for (let i = 0; i < parameters.length; i++) {
      const p = parameters[i];
      const paramDecl = node.parameters[i];
      if (!p || !paramDecl) continue;
      if (p.pattern.kind !== "identifierPattern" || !p.type) continue;
      if (!ts.isIdentifier(paramDecl.name)) continue;

      const declId = ctx.binding.resolveIdentifier(paramDecl.name);
      if (!declId) continue;
      env.set(declId.id, p.type);
    }
    return { ...ctx, typeEnv: env };
  })();

  // Pass return type to body for contextual typing:
  // - Block body: return statements get the expected type
  // - Expression body: the expression gets the expected type
  const body = ts.isBlock(node.body)
    ? convertBlockStatement(
        node.body,
        bodyCtx,
        declaredReturnType ?? expectedReturnType
      )
    : convertExpression(node.body, bodyCtx, contextualReturnType);

  const returnType =
    declaredReturnType ??
    (shouldUseExpectedReturnType
      ? expectedReturnType
      : !ts.isBlock(node.body)
        ? (body as ReturnType<typeof convertExpression>).inferredType ??
          ({ kind: "voidType" } as const)
        : expectedReturnType);

  // DETERMINISTIC TYPING: contextualType comes from expectedType
  const contextualType = expectedType;

  // DETERMINISTIC: Build function type from declared parameters and return type
  const inferredType = {
    kind: "functionType" as const,
    parameters,
    returnType: returnType ?? { kind: "voidType" as const },
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
