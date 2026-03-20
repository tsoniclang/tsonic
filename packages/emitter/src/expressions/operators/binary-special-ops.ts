/**
 * Binary operator special-case handlers — `in` operator and `instanceof`.
 *
 * Extracted from binary-dispatch.ts to keep the main dispatcher under 500 LOC.
 * These handlers are called early in emitBinary before the generic binary path.
 */

import { IrExpression } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../type-emitter.js";
import {
  resolveTypeAlias,
  stripNullish,
  hasDeterministicPropertyMembership,
} from "../../core/semantic/type-resolution.js";
import { getCanonicalRuntimeUnionMembers } from "../../core/semantic/runtime-unions.js";
import { isSemanticUnion } from "../../core/semantic/union-semantics.js";
import { normalizeInstanceofTargetType } from "../../core/semantic/instanceof-targets.js";
import {
  booleanLiteral,
  identifierType,
} from "../../core/format/backend-ast/builders.js";
import { extractCalleeNameFromAst } from "../../core/format/backend-ast/utils.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";

/**
 * Emit a `"prop" in x` expression — union narrowing or dictionary membership.
 */
export const emitInOperator = (
  expr: Extract<IrExpression, { kind: "binary" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  // LHS must be a string literal for deterministic lowering.
  if (expr.left.kind !== "literal" || typeof expr.left.value !== "string") {
    throw new Error(
      "ICE: Unsupported `in` operator form. Left-hand side must be a string literal."
    );
  }

  const rhsType = expr.right.inferredType;
  if (!rhsType) {
    throw new Error("ICE: `in` operator RHS missing inferredType.");
  }

  const [rhsAst, rhsCtx] = emitExpressionAst(expr.right, context);
  const resolvedRhs = resolveTypeAlias(stripNullish(rhsType), rhsCtx);

  // Semantic gate: only enter union dispatch if the RHS is semantically a union
  const runtimeMembers = isSemanticUnion(rhsType, rhsCtx)
    ? getCanonicalRuntimeUnionMembers(rhsType, rhsCtx)
    : undefined;

  // Union<T1..Tn>: `"error" in auth` -> auth.IsN() (where member N has the prop)
  if (runtimeMembers) {
    const propName = expr.left.value;
    const matchingMembers: number[] = [];
    const unresolvedMembers: string[] = [];

    for (let i = 0; i < runtimeMembers.length; i += 1) {
      const member = runtimeMembers[i];
      if (!member) continue;

      const hasMember = hasDeterministicPropertyMembership(
        member,
        propName,
        rhsCtx
      );
      if (hasMember === true) {
        matchingMembers.push(i + 1);
        continue;
      }
      if (hasMember === undefined) {
        unresolvedMembers.push(JSON.stringify(member));
      }
    }

    if (unresolvedMembers.length > 0) {
      throw new Error(
        "ICE: Unable to deterministically resolve `in`-operator membership for one or more union members. " +
          `Property: '${propName}'. Members: ${unresolvedMembers.join(", ")}`
      );
    }

    if (matchingMembers.length === 0) {
      return [booleanLiteral(false), rhsCtx];
    }

    // Build IsN() call ASTs and chain with ||
    const checkAsts: CSharpExpressionAst[] = matchingMembers.map(
      (n): CSharpExpressionAst => ({
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: rhsAst,
          memberName: `Is${n}`,
        },
        arguments: [],
      })
    );

    const orChain = checkAsts.reduce(
      (left, right): CSharpExpressionAst => ({
        kind: "binaryExpression",
        operatorToken: "||",
        left,
        right,
      })
    );

    // Wrap multi-member OR chains in parens so they compose correctly
    // with surrounding operators (e.g., `(x.Is1() || x.Is2()) && ok`).
    const result: CSharpExpressionAst =
      checkAsts.length > 1
        ? { kind: "parenthesizedExpression", expression: orChain }
        : orChain;

    return [result, rhsCtx];
  }

  // Dictionary<K,V>: `"k" in dict` -> dict.ContainsKey("k")
  if (resolvedRhs.kind === "dictionaryType") {
    const keyType = stripNullish(resolvedRhs.keyType);
    const isStringKey =
      (keyType.kind === "primitiveType" && keyType.name === "string") ||
      (keyType.kind === "referenceType" && keyType.name === "string");

    if (!isStringKey) {
      throw new Error(
        "ICE: Unsupported `in` operator on dictionary with non-string keys."
      );
    }

    const [keyAst, keyCtx] = emitExpressionAst(expr.left, rhsCtx);
    const containsKeyAst: CSharpExpressionAst = {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: rhsAst,
        memberName: "ContainsKey",
      },
      arguments: [keyAst],
    };
    return [containsKeyAst, keyCtx];
  }

  const deterministicMembership = hasDeterministicPropertyMembership(
    rhsType,
    expr.left.value,
    rhsCtx
  );
  if (deterministicMembership !== undefined) {
    return [booleanLiteral(deterministicMembership), rhsCtx];
  }

  throw new Error(
    "ICE: Unsupported `in` operator. Only union shape guards and Dictionary<string, T> membership are supported."
  );
};

/**
 * Emit an `instanceof` expression as a C# `is` pattern expression.
 */
export const emitInstanceof = (
  expr: Extract<IrExpression, { kind: "binary" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [leftAst, leftContext] = emitExpressionAst(expr.left, context);
  const normalizedTargetType = normalizeInstanceofTargetType(
    expr.right.inferredType
  );
  let rightContext = leftContext;
  let rightText: string | undefined;

  if (normalizedTargetType) {
    const [rightTypeAst, nextContext] = emitTypeAst(
      normalizedTargetType,
      leftContext
    );
    rightText = extractCalleeNameFromAst({
      kind: "typeReferenceExpression",
      type: rightTypeAst,
    });
    rightContext = nextContext;
  } else {
    const [rightAst, nextContext] = emitExpressionAst(expr.right, leftContext);
    rightText = extractCalleeNameFromAst(rightAst);
    rightContext = nextContext;
  }
  const isExpr: CSharpExpressionAst = {
    kind: "isExpression",
    expression: leftAst,
    pattern: {
      kind: "typePattern",
      type: identifierType(rightText ?? "object"),
    },
  };
  return [isExpr, rightContext];
};
