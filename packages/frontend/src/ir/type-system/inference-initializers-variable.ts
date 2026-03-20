/**
 * Variable Initializer Type Inference — tryInferTypeFromInitializer
 *
 * Infers variable types from initializer expressions using only
 * deterministic sources (declarations + explicit syntax).
 *
 * DAG position: depends on inference-utilities, inference-expressions,
 *               inference-declarations, inference-member-resolution,
 *               inference-initializers-call
 */

import type { IrType } from "../types/index.js";
import * as ts from "typescript";
import { inferNumericKindFromRaw } from "../types/numeric-helpers.js";
import type { TypeSystemState } from "./type-system-state.js";
import { stripNullishForInference } from "./type-system-state.js";
import { typesEqual } from "./type-system-relations.js";
import { convertTypeNode, resolveCall } from "./type-system-call-resolution.js";
import {
  isLambdaExpression,
  deriveTypeFromNumericKind,
  unwrapAwaitedForInference,
} from "./inference-utilities.js";
import {
  inferExpressionType,
  inferLambdaType,
} from "./inference-expressions.js";
import { typeOfDecl } from "./inference-declarations.js";
import { typeOfMember } from "./inference-member-resolution.js";
import {
  tryInferTypeFromLiteralInitializer,
  tryInferReturnTypeFromCallExpression,
} from "./inference-initializers-call.js";

export const tryInferTypeFromInitializer = (
  state: TypeSystemState,
  declNode: unknown
): IrType | undefined => {
  const literalType = tryInferTypeFromLiteralInitializer(state, declNode);
  if (literalType) return literalType;

  if (!declNode || typeof declNode !== "object") return undefined;

  const node = declNode as ts.Node;
  if (!ts.isVariableDeclaration(node)) return undefined;
  let init = node.initializer;
  if (!init) return undefined;

  while (ts.isParenthesizedExpression(init)) {
    init = init.expression;
  }

  // Explicit type assertions are deterministic sources for variable typing.
  if (ts.isAsExpression(init) || ts.isTypeAssertionExpression(init)) {
    return convertTypeNode(state, init.type);
  }

  if (ts.isNonNullExpression(init)) {
    const inner = inferExpressionType(state, init.expression, new Map());
    if (!inner || inner.kind === "unknownType") return undefined;
    return stripNullishForInference(inner);
  }

  if (ts.isAwaitExpression(init)) {
    const inner = inferExpressionType(state, init.expression, new Map());
    if (!inner || inner.kind === "unknownType") return undefined;
    return unwrapAwaitedForInference(inner);
  }

  if (ts.isCallExpression(init)) {
    return tryInferReturnTypeFromCallExpression(state, init, new Map());
  }

  if (isLambdaExpression(init)) {
    return inferLambdaType(state, init, undefined);
  }

  if (ts.isArrayLiteralExpression(init)) {
    // Deterministic array literal typing for variable declarations:
    // infer `T[]` only when all element types are deterministically known and equal.
    const elementTypes: IrType[] = [];
    const emptyEnv = new Map<string, IrType>();
    for (const el of init.elements) {
      if (ts.isOmittedExpression(el)) {
        return undefined;
      }
      if (ts.isSpreadElement(el)) {
        return undefined;
      }

      const t = inferExpressionType(state, el, emptyEnv);
      if (!t || t.kind === "unknownType") {
        return undefined;
      }
      elementTypes.push(t);
    }

    if (elementTypes.length === 0) return undefined;
    const first = elementTypes[0];
    if (first && elementTypes.every((t) => typesEqual(t, first))) {
      return { kind: "arrayType", elementType: first };
    }

    return undefined;
  }

  const fallback = inferExpressionType(state, init, new Map());
  if (fallback && fallback.kind !== "unknownType") {
    return fallback;
  }

  // Phase 15: NewExpression branch - use constructor signature with argTypes
  if (ts.isNewExpression(init)) {
    const sigId = state.resolveConstructorSignature(init);
    if (!sigId) return undefined;

    const explicitTypeArgs =
      init.typeArguments && init.typeArguments.length > 0
        ? init.typeArguments.map((ta) => convertTypeNode(state, ta))
        : undefined;

    // Derive argTypes conservatively from syntax (same pattern as CallExpression)
    const args = init.arguments ?? [];
    const argTypes: (IrType | undefined)[] = args.map((arg) => {
      if (ts.isSpreadElement(arg)) return undefined;

      if (ts.isNumericLiteral(arg)) {
        const numericKind = inferNumericKindFromRaw(arg.getText());
        return deriveTypeFromNumericKind(numericKind);
      }

      if (ts.isStringLiteral(arg)) {
        return { kind: "primitiveType" as const, name: "string" };
      }

      if (
        arg.kind === ts.SyntaxKind.TrueKeyword ||
        arg.kind === ts.SyntaxKind.FalseKeyword
      ) {
        return { kind: "primitiveType" as const, name: "boolean" };
      }

      if (ts.isIdentifier(arg)) {
        const argDeclId = state.resolveIdentifier(arg);
        if (!argDeclId) return undefined;
        const t = typeOfDecl(state, argDeclId);
        return t.kind === "unknownType" ? undefined : t;
      }

      // Recursive handling for nested new expressions
      if (ts.isNewExpression(arg)) {
        const nestedSigId = state.resolveConstructorSignature(arg);
        if (!nestedSigId) return undefined;

        const nestedExplicitTypeArgs =
          arg.typeArguments && arg.typeArguments.length > 0
            ? arg.typeArguments.map((ta) => convertTypeNode(state, ta))
            : undefined;

        const nestedResolved = resolveCall(state, {
          sigId: nestedSigId,
          argumentCount: arg.arguments?.length ?? 0,
          explicitTypeArgs: nestedExplicitTypeArgs,
        });

        return nestedResolved.returnType.kind === "unknownType"
          ? undefined
          : nestedResolved.returnType;
      }

      return undefined;
    });

    // Resolve constructor call with argTypes for inference
    const resolved = resolveCall(state, {
      sigId,
      argumentCount: args.length,
      explicitTypeArgs,
      argTypes,
    });

    return resolved.returnType.kind === "unknownType"
      ? undefined
      : resolved.returnType;
  }

  if (ts.isIdentifier(init)) {
    const sourceDeclId = state.resolveIdentifier(init);
    if (!sourceDeclId) return undefined;
    const sourceType = typeOfDecl(state, sourceDeclId);
    return sourceType.kind === "unknownType" ? undefined : sourceType;
  }

  // Property access: const output = response.outputStream
  if (ts.isPropertyAccessExpression(init)) {
    const receiverType = inferExpressionType(state, init.expression, new Map());
    if (!receiverType || receiverType.kind === "unknownType") return undefined;

    const memberType = typeOfMember(state, receiverType, {
      kind: "byName",
      name: init.name.text,
    });

    return memberType.kind === "unknownType" ? undefined : memberType;
  }

  // Element access: const first = items[0]
  if (ts.isElementAccessExpression(init)) {
    const inferred = inferExpressionType(state, init, new Map());
    return inferred && inferred.kind !== "unknownType" ? inferred : undefined;
  }

  const inferred = inferExpressionType(state, init, new Map());
  if (inferred && inferred.kind !== "unknownType") {
    return inferred;
  }

  return undefined;
};
