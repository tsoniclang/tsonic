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
import type { TstsNode } from "@tsonic/tsts";
import {
  getTstsInitializerNode,
  getTstsNodeText,
  getTstsTypeArguments,
  TstsSyntax,
} from "@tsonic/tsts";
import { inferNumericKindFromRaw } from "../types/numeric-helpers.js";
import type { TypeSystemState } from "./type-system-state.js";
import { stripNullishForInference } from "./type-system-state.js";
import { typesEqual } from "./type-system-relations.js";
import { convertTypeNode, resolveCall } from "./type-system-call-resolution.js";
import {
  isLambdaExpression,
  deriveTypeFromNumericKind,
  getExplicitTypeArgumentNodes,
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
import { attachConstructedReferenceMetadata } from "./constructor-return-metadata.js";

const isConstAssertionType = (node: TstsNode): boolean =>
  TstsSyntax.IsTypeReferenceNode(node) &&
  TstsSyntax.AsTypeReferenceNode(node)?.TypeName?.Kind ===
    TstsSyntax.KindIdentifier &&
  getTstsNodeText(TstsSyntax.AsTypeReferenceNode(node)?.TypeName) === "const" &&
  getTstsTypeArguments(node).length === 0;

export const tryInferTypeFromInitializer = (
  state: TypeSystemState,
  declNode: unknown
): IrType | undefined => {
  const literalType = tryInferTypeFromLiteralInitializer(state, declNode);
  if (literalType) return literalType;

  if (!declNode || typeof declNode !== "object") return undefined;

  const node = declNode as TstsNode;
  if (!TstsSyntax.IsVariableDeclaration(node)) return undefined;
  let init = getTstsInitializerNode(node);
  if (!init) return undefined;

  while (TstsSyntax.IsParenthesizedExpression(init)) {
    const expression = TstsSyntax.Node_Expression(init);
    if (!expression) break;
    init = expression;
  }

  // Explicit type assertions are deterministic sources for variable typing.
  if (TstsSyntax.IsAsExpression(init) || TstsSyntax.IsTypeAssertion(init)) {
    const assertedType = TstsSyntax.Node_Type(init);
    const expression = TstsSyntax.Node_Expression(init);
    if (!assertedType || !expression) return undefined;
    if (isConstAssertionType(assertedType)) {
      return inferExpressionType(state, expression, new Map());
    }

    return convertTypeNode(state, assertedType);
  }

  if (TstsSyntax.IsNonNullExpression(init)) {
    const expression = TstsSyntax.Node_Expression(init);
    if (!expression) return undefined;
    const inner = inferExpressionType(state, expression, new Map());
    if (!inner || inner.kind === "unknownType") return undefined;
    return stripNullishForInference(inner);
  }

  if (TstsSyntax.IsAwaitExpression(init)) {
    const expression = TstsSyntax.Node_Expression(init);
    if (!expression) return undefined;
    const inner = inferExpressionType(state, expression, new Map());
    if (!inner || inner.kind === "unknownType") return undefined;
    return unwrapAwaitedForInference(inner);
  }

  if (TstsSyntax.IsCallExpression(init)) {
    return tryInferReturnTypeFromCallExpression(state, init, new Map());
  }

  if (isLambdaExpression(init)) {
    return inferLambdaType(state, init, undefined);
  }

  if (TstsSyntax.IsArrayLiteralExpression(init)) {
    // Deterministic array literal typing for variable declarations:
    // infer `T[]` only when all element types are deterministically known and equal.
    const elementTypes: IrType[] = [];
    const emptyEnv = new Map<string, IrType>();
    for (const el of TstsSyntax.Node_Elements(init) ?? []) {
      if (!el || TstsSyntax.IsOmittedExpression(el)) {
        return undefined;
      }
      if (TstsSyntax.IsSpreadElement(el)) {
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

  // NewExpression branch: use constructor signature with argTypes.
  if (TstsSyntax.IsNewExpression(init)) {
    const sigId = state.resolveConstructorSignature(init);
    if (!sigId) return undefined;

    const initTypeArguments = getExplicitTypeArgumentNodes(init);
    const explicitTypeArgs =
      initTypeArguments.length > 0
        ? initTypeArguments.map((ta) => convertTypeNode(state, ta))
        : undefined;

    // Derive argTypes conservatively from syntax (same pattern as CallExpression)
    const args = (TstsSyntax.Node_Arguments(init) ?? []).filter(
      (arg): arg is TstsNode => arg !== undefined
    );
    const argTypes: (IrType | undefined)[] = args.map((arg) => {
      if (TstsSyntax.IsSpreadElement(arg)) return undefined;

      if (TstsSyntax.IsNumericLiteral(arg)) {
        const numericKind = inferNumericKindFromRaw(getTstsNodeText(arg) ?? "");
        return deriveTypeFromNumericKind(numericKind);
      }

      if (TstsSyntax.IsStringLiteral(arg)) {
        return { kind: "primitiveType" as const, name: "string" };
      }

      if (
        arg.Kind === TstsSyntax.KindTrueKeyword ||
        arg.Kind === TstsSyntax.KindFalseKeyword
      ) {
        return { kind: "primitiveType" as const, name: "boolean" };
      }

      if (TstsSyntax.IsIdentifier(arg)) {
        const argDeclId = state.resolveIdentifier(arg);
        if (!argDeclId) return undefined;
        const t = typeOfDecl(state, argDeclId);
        return t.kind === "unknownType" ? undefined : t;
      }

      // Recursive handling for nested new expressions
      if (TstsSyntax.IsNewExpression(arg)) {
        const nestedSigId = state.resolveConstructorSignature(arg);
        if (!nestedSigId) return undefined;

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

        if (nestedResolved.returnType.kind === "unknownType") {
          return undefined;
        }
        const nestedConstructorExpression = TstsSyntax.Node_Expression(arg);
        const nestedConstructorType = nestedConstructorExpression
          ? inferExpressionType(state, nestedConstructorExpression, new Map())
          : undefined;
        return (
          attachConstructedReferenceMetadata(
            nestedResolved.returnType,
            nestedConstructorType
          ) ?? nestedResolved.returnType
        );
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

    if (resolved.returnType.kind === "unknownType") {
      return undefined;
    }
    const constructorExpression = TstsSyntax.Node_Expression(init);
    const constructorType = constructorExpression
      ? inferExpressionType(state, constructorExpression, new Map())
      : undefined;
    return (
      attachConstructedReferenceMetadata(
        resolved.returnType,
        constructorType
      ) ?? resolved.returnType
    );
  }

  if (TstsSyntax.IsIdentifier(init)) {
    const sourceDeclId = state.resolveIdentifier(init);
    if (!sourceDeclId) return undefined;
    const sourceType = typeOfDecl(state, sourceDeclId);
    return sourceType.kind === "unknownType" ? undefined : sourceType;
  }

  // Property access: const output = response.outputStream
  if (TstsSyntax.IsPropertyAccessExpression(init)) {
    const receiver = TstsSyntax.Node_Expression(init);
    if (!receiver) return undefined;
    const receiverType = inferExpressionType(state, receiver, new Map());
    if (!receiverType || receiverType.kind === "unknownType") return undefined;

    const memberType = typeOfMember(state, receiverType, {
      kind: "byName",
      name: getTstsNodeText(TstsSyntax.Node_Name(init)) ?? "",
    });

    return memberType.kind === "unknownType" ? undefined : memberType;
  }

  // Element access: const first = items[0]
  if (TstsSyntax.IsElementAccessExpression(init)) {
    const inferred = inferExpressionType(state, init, new Map());
    return inferred && inferred.kind !== "unknownType" ? inferred : undefined;
  }

  return undefined;
};
