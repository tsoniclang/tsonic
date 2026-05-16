/**
 * JS-surface length access emission.
 *
 * CLR/default-surface members are emitted through the normal declared-member
 * path. This module only owns JavaScript-surface `.length` access for
 * array-like carriers whose storage shape is native CLR array-like storage.
 */

import { IrExpression, type IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { resolveArrayLikeReceiverType } from "../core/semantic/type-resolution.js";
import {
  nullLiteral,
  nullableType,
} from "../core/format/backend-ast/builders.js";
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
import { surfaceMemberReadsArrayLength } from "../core/semantic/surface-member-semantics.js";

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

export const tryEmitJsSurfaceArrayLikeLengthAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  objectAst: CSharpExpressionAst,
  objectType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    !expr.memberBinding ||
    !surfaceMemberReadsArrayLength(expr.memberBinding, context) ||
    expr.isComputed ||
    typeof expr.property !== "string"
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
      ? context.localSemanticTypes?.get(expr.object.name)
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
