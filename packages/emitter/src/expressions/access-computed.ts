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
  stripNullish,
} from "../core/semantic/type-resolution.js";
import { extractCalleeNameFromAst } from "../core/format/backend-ast/utils.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import { identifierType } from "../core/format/backend-ast/builders.js";
import {
  hasInt32Proof,
  maybeReifyErasedArrayElement,
  type MemberAccessUsage,
} from "./access-resolution.js";
import { buildJsSafeDictionaryReadAst } from "./dictionary-safe-access.js";

/**
 * Emit a computed member access expression as CSharpExpressionAst.
 *
 * Called by the main emitMemberAccess when expr.isComputed is true.
 */
export const emitComputedAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  objectAst: CSharpExpressionAst,
  objectType: IrType | undefined,
  context: EmitterContext,
  usage: MemberAccessUsage = "value",
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const accessKind = expr.accessKind;
  if (accessKind === undefined || accessKind === "unknown") {
    throw new Error(
      `Internal Compiler Error: Computed accessKind was not classified during IR build ` +
        `(accessKind=${accessKind ?? "undefined"}).`
    );
  }

  const indexContext = { ...context, isArrayIndex: true };
  const [propAst, contextWithIndex] = emitExpressionAst(
    expr.property as IrExpression,
    indexContext
  );
  const finalContext = { ...contextWithIndex, isArrayIndex: false };
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
  const indexExpr = expr.property as IrExpression;
  if (!hasInt32Proof(indexExpr)) {
    const propText = extractCalleeNameFromAst(propAst);
    throw new Error(
      `Internal Compiler Error: CLR indexer requires Int32 index (accessKind=${accessKind}). ` +
        `Expression '${propText}' has no Int32 proof. ` +
        `This should have been caught by the numeric proof pass (TSN5107).`
    );
  }

  if (accessKind === "stringChar") {
    const elementAccess: CSharpExpressionAst = expr.isOptional
      ? {
          kind: "conditionalElementAccessExpression",
          expression: objectAst,
          arguments: [propAst],
        }
      : {
          kind: "elementAccessExpression",
          expression: objectAst,
          arguments: [propAst],
        };

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
      return [elementAccess, finalContext];
    }

    // str[i] returns char in C#, but JS/TS surface semantics expect a string
    // in non-char contexts. Convert char -> string at the emission boundary.
    return [
      {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: elementAccess,
          memberName: "ToString",
        },
        arguments: [],
      },
      finalContext,
    ];
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
  const accessAst: CSharpExpressionAst = {
    kind: "elementAccessExpression",
    expression: objectAst,
    arguments: [propAst],
  };
  return usage === "value"
    ? maybeReifyErasedArrayElement(
        accessAst,
        expr.object,
        expectedType ?? expr.inferredType,
        finalContext
      )
    : [accessAst, finalContext];
};
