/**
 * JS-surface length access emission.
 *
 * CLR/default-surface members are emitted through the normal declared-member
 * path. This module only owns the JavaScript-surface `.length` bridge for
 * array-like carriers that lower to native CLR storage.
 */

import { IrExpression, type IrType } from "@tsonic/frontend";
import { EmitterContext, contextSurfaceIncludesJs } from "../types.js";
import {
  resolveTypeAlias,
  stripNullish,
  resolveArrayLikeReceiverType,
} from "../core/semantic/type-resolution.js";
import { nullLiteral, nullableType } from "../core/format/backend-ast/builders.js";
import {
  clrTypeNameToTypeAst,
  sameConcreteTypeAstSurface,
  stripNullableTypeAst,
} from "../core/format/backend-ast/utils.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import {
  emitStorageCompatibleArrayWrapperElementTypeAst,
  resolveEmittedReceiverTypeAst,
  tryEmitBroadArrayAssertionReceiverStorageAst,
} from "./access-resolution.js";
import { buildNativeArrayInteropWrapAst } from "./array-interop.js";
import { hasSourceDeclaredMember } from "./access-resolution-types.js";
import { referenceTypeHasClrIdentity } from "../core/semantic/clr-type-identity.js";

const SYSTEM_STRING_CLR_NAMES = new Set([
  "System.String",
  "global::System.String",
]);
const SYSTEM_ARRAY_TYPE_AST = clrTypeNameToTypeAst("System.Array");

const isRuntimeUnionMemberProjectionAst = (
  exprAst: CSharpExpressionAst
): boolean => {
  let target = exprAst;
  while (
    target.kind === "parenthesizedExpression" ||
    target.kind === "castExpression"
  ) {
    target = target.expression;
  }

  return (
    target.kind === "invocationExpression" &&
    target.arguments.length === 0 &&
    target.expression.kind === "memberAccessExpression" &&
    /^As\d+$/.test(target.expression.memberName)
  );
};

export const isStringReceiverType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) return false;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    (resolved.kind === "primitiveType" && resolved.name === "string") ||
    (resolved.kind === "referenceType" &&
      (resolved.name === "string" ||
        resolved.name === "String" ||
        referenceTypeHasClrIdentity(resolved, SYSTEM_STRING_CLR_NAMES)))
  );
};

export const isLengthPropertyName = (propertyName: string): boolean =>
  propertyName === "length";

export const tryEmitJsSurfaceArrayLikeLengthAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  objectAst: CSharpExpressionAst,
  objectType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    !contextSurfaceIncludesJs(context) ||
    expr.isComputed ||
    typeof expr.property !== "string" ||
    !isLengthPropertyName(expr.property)
  ) {
    return undefined;
  }

  const arrayLikeReceiver = resolveArrayLikeReceiverType(objectType, context);
  if (arrayLikeReceiver && isRuntimeUnionMemberProjectionAst(objectAst)) {
    return [
      expr.isOptional
        ? {
            kind: "conditionalExpression",
            condition: {
              kind: "binaryExpression",
              operatorToken: "==",
              left: objectAst,
              right: nullLiteral(),
            },
            whenTrue: {
              kind: "defaultExpression",
              type: nullableType({ kind: "predefinedType", keyword: "int" }),
            },
            whenFalse: {
              kind: "memberAccessExpression",
              expression: objectAst,
              memberName: "Length",
            },
          }
        : {
            kind: "memberAccessExpression",
            expression: objectAst,
            memberName: "Length",
          },
      context,
    ];
  }

  const preservedReceiver = tryEmitBroadArrayAssertionReceiverStorageAst(
    expr.object,
    context
  );
  const effectiveObjectAst = preservedReceiver?.[0] ?? objectAst;
  const effectiveObjectContext = preservedReceiver?.[1] ?? context;
  const [receiverTypeAst, receiverTypeContext] = resolveEmittedReceiverTypeAst(
    expr.object,
    effectiveObjectContext
  );
  const concreteReceiverTypeAst = receiverTypeAst
    ? stripNullableTypeAst(receiverTypeAst)
    : undefined;
  const declaredReceiverType =
    expr.object.kind === "identifier"
      ? (context.localSemanticTypes?.get(expr.object.name) ??
        context.localValueTypes?.get(expr.object.name))
      : undefined;

  if (
    hasSourceDeclaredMember(
      declaredReceiverType ?? objectType,
      expr.property,
      "value",
      effectiveObjectContext
    )
  ) {
    return [
      expr.isOptional
        ? {
            kind: "conditionalExpression",
            condition: {
              kind: "binaryExpression",
              operatorToken: "==",
              left: effectiveObjectAst,
              right: nullLiteral(),
            },
            whenTrue: {
              kind: "defaultExpression",
              type: nullableType({ kind: "predefinedType", keyword: "int" }),
            },
            whenFalse: {
              kind: "memberAccessExpression",
              expression: effectiveObjectAst,
              memberName: expr.property,
            },
          }
        : {
            kind: "memberAccessExpression",
            expression: effectiveObjectAst,
            memberName: expr.property,
          },
      receiverTypeContext,
    ];
  }

  const buildOptionalArrayWrapperLengthAccess = (
    nextContext: EmitterContext
  ): [CSharpExpressionAst, EmitterContext] => [
    expr.isOptional
      ? {
          kind: "conditionalExpression",
          condition: {
            kind: "binaryExpression",
            operatorToken: "==",
            left: objectAst,
            right: nullLiteral(),
          },
          whenTrue: {
            kind: "defaultExpression",
            type: nullableType({ kind: "predefinedType", keyword: "int" }),
          },
          whenFalse: {
            kind: "memberAccessExpression",
            expression: buildNativeArrayInteropWrapAst(objectAst),
            memberName: "length",
          },
        }
      : {
          kind: "memberAccessExpression",
          expression: buildNativeArrayInteropWrapAst(objectAst),
          memberName: "length",
        },
    nextContext,
  ];

  if (concreteReceiverTypeAst?.kind === "arrayType") {
    return [
      expr.isOptional
        ? {
            kind: "conditionalExpression",
            condition: {
              kind: "binaryExpression",
              operatorToken: "==",
              left: effectiveObjectAst,
              right: nullLiteral(),
            },
            whenTrue: {
              kind: "defaultExpression",
              type: nullableType({ kind: "predefinedType", keyword: "int" }),
            },
            whenFalse: {
              kind: "memberAccessExpression",
              expression: effectiveObjectAst,
              memberName: "Length",
            },
          }
        : {
            kind: "memberAccessExpression",
            expression: effectiveObjectAst,
            memberName: "Length",
          },
      receiverTypeContext,
    ];
  }

  if (
    concreteReceiverTypeAst &&
    sameConcreteTypeAstSurface(concreteReceiverTypeAst, SYSTEM_ARRAY_TYPE_AST)
  ) {
    return [
      expr.isOptional
        ? {
            kind: "conditionalExpression",
            condition: {
              kind: "binaryExpression",
              operatorToken: "==",
              left: objectAst,
              right: nullLiteral(),
            },
            whenTrue: {
              kind: "defaultExpression",
              type: nullableType({ kind: "predefinedType", keyword: "int" }),
            },
            whenFalse: {
              kind: "memberAccessExpression",
              expression: effectiveObjectAst,
              memberName: "Length",
            },
          }
        : {
            kind: "memberAccessExpression",
            expression: effectiveObjectAst,
            memberName: "Length",
          },
      receiverTypeContext,
    ];
  }

  if (!arrayLikeReceiver) {
    return undefined;
  }
  const [, typeContext] = emitStorageCompatibleArrayWrapperElementTypeAst(
    expr.object,
    objectType,
    arrayLikeReceiver.elementType,
    context
  );

  return buildOptionalArrayWrapperLengthAccess(typeContext);
};
