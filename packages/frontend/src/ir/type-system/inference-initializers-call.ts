/**
 * Literal and Call Return Type Inference
 *
 * Contains:
 * - tryInferTypeFromLiteralInitializer: simple literal → IrType
 * - tryInferReturnTypeFromCallExpression: call expression → return type
 *
 * DAG position: depends on inference-utilities, inference-expressions,
 *               inference-declarations, inference-member-resolution
 */

import type { IrType } from "../types/index.js";
import type { TstsNode } from "@tsonic/tsts";
import {
  getTstsInitializerNode,
  getTstsNodeText,
  getTstsTypeArguments,
  TstsSyntax,
} from "@tsonic/tsts";
import { inferNumericKindFromRaw } from "../types/numeric-helpers.js";
import type { TypeSystemState } from "./type-system-state.js";
import { convertTypeNode, resolveCall } from "./type-system-call-resolution.js";
import {
  isLambdaExpression,
  deriveTypeFromNumericKind,
  collectResolutionArgTypes,
  getExplicitTypeArgumentNodes,
} from "./inference-utilities.js";
import {
  inferExpressionType,
  inferLambdaType,
} from "./inference-expressions.js";
import { typeOfDecl } from "./inference-declarations.js";
import { attachConstructedReferenceMetadata } from "./constructor-return-metadata.js";

/**
 * Try to infer type from a variable declaration's literal initializer.
 *
 * DETERMINISM: Uses the raw lexeme form of the literal, not TS computed types.
 * Only handles simple literal initializers:
 * - Numeric literals → inferred via inferNumericKindFromRaw
 * - String literals → primitiveType("string")
 * - Boolean literals → primitiveType("boolean")
 *
 * Returns undefined if the initializer is not a simple literal.
 */
export const tryInferTypeFromLiteralInitializer = (
  _state: TypeSystemState,
  declNode: unknown
): IrType | undefined => {
  // TypeScript's VariableDeclaration has an `initializer` property
  const decl = declNode as TstsNode | undefined;

  // Must have an initializer
  const init = getTstsInitializerNode(decl);
  if (!init) return undefined;

  if (TstsSyntax.IsNumericLiteral(init)) {
    const raw = getTstsNodeText(init) ?? "";
    const numericKind = inferNumericKindFromRaw(raw);
    return deriveTypeFromNumericKind(numericKind);
  }

  if (TstsSyntax.IsStringLiteral(init)) {
    return { kind: "primitiveType", name: "string" };
  }

  if (
    TstsSyntax.IsNoSubstitutionTemplateLiteral(init) ||
    TstsSyntax.IsTemplateExpression(init)
  ) {
    return { kind: "primitiveType", name: "string" };
  }

  if (
    init.Kind === TstsSyntax.KindTrueKeyword ||
    init.Kind === TstsSyntax.KindFalseKeyword
  ) {
    return { kind: "primitiveType", name: "boolean" };
  }

  // Not a simple literal - cannot infer
  return undefined;
};

/**
 * Try to infer type from a variable declaration's initializer using only
 * deterministic sources (declarations + explicit syntax).
 *
 * Handles:
 * - simple literals (delegates to tryInferTypeFromLiteralInitializer)
 * - call expressions where the callee has an explicit declared return type
 * - new expressions with selected constructor signatures
 * - identifier initializers (propagate deterministically)
 */
export const tryInferReturnTypeFromCallExpression = (
  state: TypeSystemState,
  call: TstsNode,
  env: ReadonlyMap<string, IrType>
): IrType | undefined => {
  if (!TstsSyntax.IsCallExpression(call)) return undefined;
  const sigId = state.resolveCallSignature(call);
  if (!sigId) return undefined;

  const explicitTypeArgs =
    getTstsTypeArguments(call).length > 0
      ? getTstsTypeArguments(call).map((ta) => convertTypeNode(state, ta))
      : undefined;

  const receiverType = (() => {
    const expression = TstsSyntax.Node_Expression(call);
    if (!expression || !TstsSyntax.IsPropertyAccessExpression(expression)) {
      return undefined;
    }
    const receiverExpr = TstsSyntax.Node_Expression(expression);
    if (!receiverExpr) return undefined;
    const receiver = inferExpressionType(state, receiverExpr, env);
    return receiver && receiver.kind !== "unknownType" ? receiver : undefined;
  })();

  const callArguments = (TstsSyntax.Node_Arguments(call) ?? []).filter(
    (arg): arg is TstsNode => arg !== undefined
  );
  const argumentCount = callArguments.length;

  // Two-pass: resolve once to get expected parameter types, then infer non-lambda args,
  // then infer lambda arg types (from expected types + body), then final resolve.
  const initialResolved = resolveCall(state, {
    sigId,
    argumentCount,
    receiverType,
    explicitTypeArgs,
  });
  const initialParameterTypes = initialResolved.parameterTypes;

  const argTypesWorking: (IrType | undefined)[] =
    Array(argumentCount).fill(undefined);

  for (let index = 0; index < callArguments.length; index++) {
    const arg = callArguments[index];
    if (!arg) continue;
    if (TstsSyntax.IsSpreadElement(arg)) {
      const expression = TstsSyntax.Node_Expression(arg);
      if (!expression) continue;
      const spreadType = inferExpressionType(state, expression, env);
      if (spreadType && spreadType.kind !== "unknownType") {
        argTypesWorking[index] = spreadType;
      }
      continue;
    }
    if (isLambdaExpression(arg)) continue;

    if (TstsSyntax.IsNumericLiteral(arg)) {
      const numericKind = inferNumericKindFromRaw(getTstsNodeText(arg) ?? "");
      argTypesWorking[index] = deriveTypeFromNumericKind(numericKind);
      continue;
    }

    if (TstsSyntax.IsStringLiteral(arg)) {
      argTypesWorking[index] = { kind: "primitiveType", name: "string" };
      continue;
    }

    if (
      arg.Kind === TstsSyntax.KindTrueKeyword ||
      arg.Kind === TstsSyntax.KindFalseKeyword
    ) {
      argTypesWorking[index] = {
        kind: "primitiveType",
        name: "boolean",
      };
      continue;
    }

    if (TstsSyntax.IsIdentifier(arg)) {
      const argDeclId = state.resolveIdentifier(arg);
      if (!argDeclId) continue;
      const t = typeOfDecl(state, argDeclId);
      if (t.kind !== "unknownType") {
        argTypesWorking[index] = t;
      }
      continue;
    }

    if (TstsSyntax.IsCallExpression(arg)) {
      const t = tryInferReturnTypeFromCallExpression(state, arg, env);
      if (t) {
        argTypesWorking[index] = t;
      }
      continue;
    }

    if (TstsSyntax.IsNewExpression(arg)) {
      const nestedSigId = state.resolveConstructorSignature(arg);
      if (!nestedSigId) continue;

      const nestedTypeArguments = getExplicitTypeArgumentNodes(arg);
      const nestedExplicitTypeArgs =
        nestedTypeArguments.length > 0
          ? nestedTypeArguments.map((ta) => convertTypeNode(state, ta))
          : undefined;
      const nestedArguments = TstsSyntax.Node_Arguments(arg) ?? [];

      const nestedResolved = resolveCall(state, {
        sigId: nestedSigId,
        argumentCount: nestedArguments.length,
        explicitTypeArgs: nestedExplicitTypeArgs,
      });

      if (nestedResolved.returnType.kind !== "unknownType") {
        const constructorExpression = TstsSyntax.Node_Expression(arg);
        const constructorType = constructorExpression
          ? inferExpressionType(state, constructorExpression, env)
          : undefined;
        argTypesWorking[index] =
          attachConstructedReferenceMetadata(
            nestedResolved.returnType,
            constructorType
          ) ?? nestedResolved.returnType;
      }
      continue;
    }

    // Fallback: infer from a small deterministic expression set
    const t = inferExpressionType(state, arg, env);
    if (t && t.kind !== "unknownType") {
      argTypesWorking[index] = t;
      continue;
    }
  }

  const lambdaResolutionArgs = collectResolutionArgTypes(argTypesWorking);

  const lambdaContextResolved = resolveCall(state, {
    sigId,
    argumentCount:
      lambdaResolutionArgs.argumentCount > 0
        ? lambdaResolutionArgs.argumentCount
        : argumentCount,
    receiverType,
    explicitTypeArgs,
    argTypes:
      lambdaResolutionArgs.argumentCount > 0
        ? lambdaResolutionArgs.argTypes
        : argTypesWorking,
  });

  const parameterTypesForLambdaContext =
    lambdaContextResolved.parameterTypes ?? initialParameterTypes;

  for (let index = 0; index < callArguments.length; index++) {
    const arg = callArguments[index];
    if (!arg) continue;
    if (TstsSyntax.IsSpreadElement(arg)) continue;
    if (!isLambdaExpression(arg)) continue;

    const expectedType = parameterTypesForLambdaContext[index];
    const lambdaType = inferLambdaType(state, arg, expectedType);
    if (lambdaType) {
      argTypesWorking[index] = lambdaType;
    }
  }

  const finalResolutionArgs = collectResolutionArgTypes(argTypesWorking);

  const finalResolved = resolveCall(state, {
    sigId,
    argumentCount:
      finalResolutionArgs.argumentCount > 0
        ? finalResolutionArgs.argumentCount
        : argumentCount,
    receiverType,
    explicitTypeArgs,
    argTypes:
      finalResolutionArgs.argumentCount > 0
        ? finalResolutionArgs.argTypes
        : argTypesWorking,
  });

  return finalResolved.returnType.kind === "unknownType"
    ? undefined
    : finalResolved.returnType;
};
