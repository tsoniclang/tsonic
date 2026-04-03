/**
 * Computed member access expression emitters.
 *
 * Handles element access via computed indexing (dict[key], arr[i], str[i]):
 * - Dictionary element access
 * - CLR indexer with Int32 proof
 * - String character access with ToString conversion
 * - Array element access with storage reification
 */

import { IrExpression, type IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  resolveTypeAlias,
  resolveArrayLikeReceiverType,
  stripNullish,
} from "../core/semantic/type-resolution.js";
import {
  extractCalleeNameFromAst,
  getIdentifierTypeName,
  stripNullableTypeAst,
} from "../core/format/backend-ast/utils.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import {
  identifierExpression,
  identifierType,
  nullLiteral,
  parseNumericLiteral,
} from "../core/format/backend-ast/builders.js";
import {
  hasInt32Proof,
  maybeReifyErasedArrayElement,
  type MemberAccessUsage,
  resolveEmittedReceiverTypeAst,
  tryEmitBroadArrayAssertionReceiverStorageAst,
} from "./access-resolution.js";
import { buildJsSafeDictionaryReadAst } from "./dictionary-safe-access.js";
import { normalizeRuntimeStorageType } from "../core/semantic/storage-types.js";
import { adaptStorageErasedValueAst } from "../core/semantic/storage-erased-adaptation.js";

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

const buildSafeJsStringIndexAst = (
  objectAst: CSharpExpressionAst,
  indexAst: CSharpExpressionAst
): CSharpExpressionAst => {
  const stringName = "__tsonic_string";
  const indexName = "__tsonic_index";
  const stringIdentifier = identifierExpression(stringName);
  const indexIdentifier = identifierExpression(indexName);
  const safeElementAccess: CSharpExpressionAst = {
    kind: "elementAccessExpression",
    expression: stringIdentifier,
    arguments: [indexIdentifier],
  };

  return {
    kind: "invocationExpression",
    expression: {
      kind: "parenthesizedExpression",
      expression: {
        kind: "castExpression",
        type: {
          kind: "qualifiedIdentifierType",
          name: {
            aliasQualifier: "global",
            segments: ["System", "Func"],
          },
          typeArguments: [
            { kind: "predefinedType", keyword: "string" },
            { kind: "predefinedType", keyword: "int" },
            { kind: "predefinedType", keyword: "string" },
          ],
        },
        expression: {
          kind: "parenthesizedExpression",
          expression: {
            kind: "lambdaExpression",
            isAsync: false,
            parameters: [
              {
                name: stringName,
                type: { kind: "predefinedType", keyword: "string" },
              },
              {
                name: indexName,
                type: { kind: "predefinedType", keyword: "int" },
              },
            ],
            body: {
              kind: "conditionalExpression",
              condition: {
                kind: "binaryExpression",
                operatorToken: "==",
                left: stringIdentifier,
                right: nullLiteral(),
              },
              whenTrue: nullLiteral(),
              whenFalse: {
                kind: "conditionalExpression",
                condition: {
                  kind: "binaryExpression",
                  operatorToken: "&&",
                  left: {
                    kind: "binaryExpression",
                    operatorToken: ">=",
                    left: indexIdentifier,
                    right: parseNumericLiteral("0"),
                  },
                  right: {
                    kind: "binaryExpression",
                    operatorToken: "<",
                    left: indexIdentifier,
                    right: {
                      kind: "memberAccessExpression",
                      expression: stringIdentifier,
                      memberName: "Length",
                    },
                  },
                },
                whenTrue: {
                  kind: "invocationExpression",
                  expression: {
                    kind: "memberAccessExpression",
                    expression: safeElementAccess,
                    memberName: "ToString",
                  },
                  arguments: [],
                },
                whenFalse: nullLiteral(),
              },
            },
          },
        },
      },
    },
    arguments: [objectAst, indexAst],
  };
};

/**
 * Emit a computed member access expression as CSharpExpressionAst.
 *
 * Called by the main emitMemberAccess when expr.isComputed is true.
 */
export const emitComputedAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  objectAst: CSharpExpressionAst,
  objectType: IrType | undefined,
  receiverSourceContext: EmitterContext,
  context: EmitterContext,
  usage: MemberAccessUsage = "value",
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const accessKind = expr.accessKind;
  if (accessKind === undefined || accessKind === "unknown") {
    const sourceInfo = expr.sourceSpan
      ? ` at ${expr.sourceSpan.file}:${String(expr.sourceSpan.line)}:${String(expr.sourceSpan.column)}`
      : "";
    throw new Error(
      `Internal Compiler Error: Computed accessKind was not classified during IR build ` +
        `(accessKind=${accessKind ?? "undefined"})${sourceInfo}.`
    );
  }

  const indexContext = { ...context, isArrayIndex: true };
  const [propAst, contextWithIndex] = emitExpressionAst(
    expr.property as IrExpression,
    indexContext
  );
  const finalContext = { ...contextWithIndex, isArrayIndex: false };
  const indexExpr = expr.property as IrExpression;
  const resolvedObjectType = objectType
    ? resolveTypeAlias(stripNullish(objectType), context)
    : undefined;

  if (accessKind === "dictionary") {
    if (context.options.surface === "@tsonic/js" && usage !== "write") {
      const fallbackType =
        expectedType ??
        expr.inferredType ??
        (resolvedObjectType?.kind === "dictionaryType"
          ? resolvedObjectType.valueType
          : undefined);
      const [resultTypeAst, typeContext] = fallbackType
        ? emitTypeAst(fallbackType, finalContext)
        : [identifierType("object"), finalContext];
      return [
        buildJsSafeDictionaryReadAst(
          objectAst,
          propAst,
          expr.isOptional,
          resultTypeAst
        ),
        typeContext,
      ];
    }

    return [
      {
        kind: "elementAccessExpression",
        expression: objectAst,
        arguments: [propAst],
      },
      finalContext,
    ];
  }

  // HARD GATE: clrIndexer + stringChar require Int32 proof
  if (!hasInt32Proof(indexExpr)) {
    const propText = extractCalleeNameFromAst(propAst);
    throw new Error(
      `Internal Compiler Error: CLR indexer requires Int32 index (accessKind=${accessKind}). ` +
        `Expression '${propText}' has no Int32 proof. ` +
        `This should have been caught by the numeric proof pass (TSN5107).`
    );
  }

  if (expr.accessProtocol?.getterMember) {
    if (expr.isOptional) {
      return [
        {
          kind: "invocationExpression",
          expression: {
            kind: "conditionalMemberAccessExpression",
            expression: objectAst,
            memberName: expr.accessProtocol.getterMember,
          },
          arguments: [propAst],
        },
        finalContext,
      ];
    }

    return [
      {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: objectAst,
          memberName: expr.accessProtocol.getterMember,
        },
        arguments: [propAst],
      },
      finalContext,
    ];
  }

  if (accessKind === "stringChar") {
    const elementAccess: CSharpExpressionAst = {
      kind: "elementAccessExpression",
      expression: objectAst,
      arguments: [propAst],
    };
    const charElementAccess: CSharpExpressionAst = expr.isOptional
      ? {
          kind: "conditionalElementAccessExpression",
          expression: objectAst,
          arguments: [propAst],
        }
      : elementAccess;

    const narrowedExpectedType = expectedType
      ? stripNullish(expectedType)
      : undefined;
    const resolvedExpectedType = narrowedExpectedType
      ? resolveTypeAlias(narrowedExpectedType, context)
      : undefined;
    const expectsChar =
      (resolvedExpectedType?.kind === "primitiveType" &&
        resolvedExpectedType.name === "char") ||
      (resolvedExpectedType?.kind === "referenceType" &&
        resolvedExpectedType.name === "char");

    if (expectsChar) {
      return [charElementAccess, finalContext];
    }

    return [buildSafeJsStringIndexAst(objectAst, propAst), finalContext];
  }

  if (expr.isOptional) {
    return [
      {
        kind: "conditionalElementAccessExpression",
        expression: objectAst,
        arguments: [propAst],
      },
      finalContext,
    ];
  }

  const receiverResolutionContext =
    expr.object.kind === "typeAssertion" ||
    expr.object.kind === "asinterface" ||
    expr.object.kind === "trycast"
      ? receiverSourceContext
      : finalContext;
  const preservedReceiver =
    tryEmitBroadArrayAssertionReceiverStorageAst(
      expr.object,
      receiverResolutionContext
    );
  const desiredType = expectedType ?? expr.inferredType;
  const adaptBroadArrayElementRead = (
    valueAst: CSharpExpressionAst,
    nextContext: EmitterContext
  ): [CSharpExpressionAst, EmitterContext] => {
    if (usage !== "value") {
      return [valueAst, nextContext];
    }

    const storageReceiverType =
      normalizeRuntimeStorageType(objectType, context) ?? objectType;
    const storageElementType =
      storageReceiverType &&
      resolveArrayLikeReceiverType(storageReceiverType, context)?.elementType;
    const adapted = adaptStorageErasedValueAst({
      valueAst,
      semanticType: expr.inferredType,
      storageType: storageElementType,
      expectedType: desiredType,
      context: nextContext,
      emitTypeAst,
    });
    return adapted ?? [valueAst, nextContext];
  };
  const effectiveObjectAst = preservedReceiver?.[0] ?? objectAst;
  const effectiveObjectContext =
    preservedReceiver?.[1] ?? receiverResolutionContext;
  const [receiverTypeAst, receiverTypeContext] = resolveEmittedReceiverTypeAst(
    expr.object,
    effectiveObjectContext
  );
  const concreteReceiverTypeAst = receiverTypeAst
    ? stripNullableTypeAst(receiverTypeAst)
    : undefined;
  if (preservedReceiver && concreteReceiverTypeAst?.kind === "arrayType") {
    return adaptBroadArrayElementRead(
      {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: effectiveObjectAst,
          memberName: "GetValue",
        },
        arguments: [propAst],
      },
      receiverTypeContext
    );
  }
  const receiverTypeName = concreteReceiverTypeAst
    ? getIdentifierTypeName(concreteReceiverTypeAst)
    : undefined;
  if (
    receiverTypeName === "global::System.Array" ||
    receiverTypeName === "System.Array"
  ) {
    return adaptBroadArrayElementRead(
      {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: effectiveObjectAst,
          memberName: "GetValue",
        },
        arguments: [propAst],
      },
      receiverTypeContext
    );
  }

  const accessAst: CSharpExpressionAst = {
    kind: "elementAccessExpression",
    expression: objectAst,
    arguments: [propAst],
  };

  const arrayLikeReceiver = resolveArrayLikeReceiverType(objectType, context);
  if (usage === "value" && arrayLikeReceiver && isRuntimeUnionMemberProjectionAst(objectAst)) {
    const storageReceiverType =
      normalizeRuntimeStorageType(objectType, context) ?? objectType;
    const storageElementType =
      storageReceiverType &&
      resolveArrayLikeReceiverType(storageReceiverType, context)?.elementType;
    const adapted = adaptStorageErasedValueAst({
      valueAst: accessAst,
      semanticType: expr.inferredType,
      storageType: storageElementType,
      expectedType: desiredType,
      context: finalContext,
      emitTypeAst,
    });
    return adapted ?? [accessAst, finalContext];
  }

  return usage === "value"
    ? maybeReifyErasedArrayElement(
        accessAst,
        expr.object,
        desiredType,
        finalContext
      )
    : [accessAst, finalContext];
};
