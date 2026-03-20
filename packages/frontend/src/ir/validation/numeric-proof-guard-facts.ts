/**
 * Numeric Proof Guard Facts — Int32 guard fact collection from conditional expressions
 *
 * Extracts Int32 guard facts from expressions like:
 * - Number.isInteger(x) — proves x is integer
 * - x >= min && x <= max — proves bounds
 *
 * Used by numeric-proof-proving.ts and numeric-proof-walk.ts.
 */

import { Diagnostic, SourceLocation } from "../../types/diagnostic.js";
import {
  IrExpression,
  NumericKind,
  NUMERIC_RANGES,
  isValidIntegerLexeme,
  parseBigIntFromRaw,
} from "../types.js";

/**
 * Context for tracking numeric proofs during IR walk
 */
export type ProofContext = {
  readonly filePath: string;
  readonly diagnostics: Diagnostic[];
  /** Maps variable names to their proven numeric kinds */
  readonly provenVariables: Map<string, NumericKind>;
  /** Maps parameter names to their numeric kinds */
  readonly provenParameters: Map<string, NumericKind>;
};

type Int32GuardFact = {
  readonly integerChecked: boolean;
  readonly lowerBound?: bigint;
  readonly upperBound?: bigint;
};

/**
 * Create a source location for a module
 */
export const moduleLocation = (ctx: ProofContext): SourceLocation => ({
  file: ctx.filePath,
  line: 1,
  column: 1,
  length: 1,
});

const INT32_RANGE = NUMERIC_RANGES.get("Int32");

export const cloneProofContext = (ctx: ProofContext): ProofContext => ({
  ...ctx,
  provenVariables: new Map(ctx.provenVariables),
  provenParameters: new Map(ctx.provenParameters),
});

const extractIntegerLiteralBound = (expr: IrExpression): bigint | undefined => {
  if (expr.kind === "literal" && typeof expr.value === "number") {
    if (expr.raw !== undefined && isValidIntegerLexeme(expr.raw)) {
      return parseBigIntFromRaw(expr.raw);
    }
    if (Number.isInteger(expr.value)) {
      return BigInt(expr.value);
    }
    return undefined;
  }

  if (
    expr.kind === "unary" &&
    (expr.operator === "-" || expr.operator === "+") &&
    expr.expression.kind === "literal" &&
    typeof expr.expression.value === "number"
  ) {
    const inner = extractIntegerLiteralBound(expr.expression);
    if (inner === undefined) return undefined;
    return expr.operator === "-" ? -inner : inner;
  }

  return undefined;
};

const isIdentifierExpr = (
  expr: IrExpression
): expr is Extract<IrExpression, { kind: "identifier" }> =>
  expr.kind === "identifier";

const memberAccessName = (expr: IrExpression): string | undefined => {
  if (expr.kind !== "memberAccess" || expr.isComputed) {
    return undefined;
  }
  return typeof expr.property === "string"
    ? expr.property
    : expr.property.kind === "literal" &&
        typeof expr.property.value === "string"
      ? expr.property.value
      : undefined;
};

const extractNumberIsIntegerFact = (
  expr: IrExpression
): readonly [string, Int32GuardFact] | undefined => {
  if (expr.kind !== "call" || expr.arguments.length !== 1) {
    return undefined;
  }
  const callee = expr.callee;
  if (
    callee.kind !== "memberAccess" ||
    !isIdentifierExpr(callee.object) ||
    callee.object.name !== "Number" ||
    memberAccessName(callee) !== "isInteger"
  ) {
    return undefined;
  }
  const arg = expr.arguments[0];
  if (!arg || !isIdentifierExpr(arg)) {
    return undefined;
  }
  return [arg.name, { integerChecked: true }];
};

const extractInt32BoundFact = (
  expr: IrExpression
): readonly [string, Int32GuardFact] | undefined => {
  if (expr.kind !== "binary") {
    return undefined;
  }

  const leftBound = extractIntegerLiteralBound(expr.right);
  const rightBound = extractIntegerLiteralBound(expr.left);
  const directIdentifier =
    isIdentifierExpr(expr.left) && leftBound !== undefined
      ? {
          name: expr.left.name,
          bound: leftBound,
          operator: expr.operator,
          reversed: false,
        }
      : isIdentifierExpr(expr.right) && rightBound !== undefined
        ? {
            name: expr.right.name,
            bound: rightBound,
            operator: expr.operator,
            reversed: true,
          }
        : undefined;

  if (!directIdentifier) {
    return undefined;
  }

  const { name, bound, operator, reversed } = directIdentifier;
  const effectiveOperator = reversed
    ? operator === ">="
      ? "<="
      : operator === ">"
        ? "<"
        : operator === "<="
          ? ">="
          : operator === "<"
            ? ">"
            : operator
    : operator;

  switch (effectiveOperator) {
    case ">=":
      return [name, { integerChecked: false, lowerBound: bound }];
    case ">":
      return [name, { integerChecked: false, lowerBound: bound + 1n }];
    case "<=":
      return [name, { integerChecked: false, upperBound: bound }];
    case "<":
      return [name, { integerChecked: false, upperBound: bound - 1n }];
    default:
      return undefined;
  }
};

const mergeInt32GuardFact = (
  left: Int32GuardFact | undefined,
  right: Int32GuardFact
): Int32GuardFact => ({
  integerChecked: (left?.integerChecked ?? false) || right.integerChecked,
  lowerBound:
    left?.lowerBound === undefined
      ? right.lowerBound
      : right.lowerBound === undefined
        ? left.lowerBound
        : left.lowerBound > right.lowerBound
          ? left.lowerBound
          : right.lowerBound,
  upperBound:
    left?.upperBound === undefined
      ? right.upperBound
      : right.upperBound === undefined
        ? left.upperBound
        : left.upperBound < right.upperBound
          ? left.upperBound
          : right.upperBound,
});

const collectInt32GuardFactsInTruthyCondition = (
  expr: IrExpression
): ReadonlyMap<string, Int32GuardFact> => {
  if (expr.kind === "logical" && expr.operator === "&&") {
    const out = new Map<string, Int32GuardFact>();
    for (const [name, fact] of collectInt32GuardFactsInTruthyCondition(
      expr.left
    )) {
      out.set(name, fact);
    }
    for (const [name, fact] of collectInt32GuardFactsInTruthyCondition(
      expr.right
    )) {
      out.set(name, mergeInt32GuardFact(out.get(name), fact));
    }
    return out;
  }

  const integerFact = extractNumberIsIntegerFact(expr);
  if (integerFact) {
    return new Map([[integerFact[0], integerFact[1]]]);
  }

  const boundFact = extractInt32BoundFact(expr);
  if (boundFact) {
    return new Map([[boundFact[0], boundFact[1]]]);
  }

  return new Map();
};

export const withInt32ProofsFromTruthyCondition = (
  ctx: ProofContext,
  condition: IrExpression
): ProofContext => {
  if (!INT32_RANGE) {
    return ctx;
  }

  const facts = collectInt32GuardFactsInTruthyCondition(condition);
  if (facts.size === 0) {
    return ctx;
  }

  const next = cloneProofContext(ctx);
  for (const [name, fact] of facts) {
    if (
      fact.integerChecked &&
      fact.lowerBound !== undefined &&
      fact.upperBound !== undefined &&
      fact.lowerBound >= INT32_RANGE.min &&
      fact.upperBound <= INT32_RANGE.max
    ) {
      next.provenVariables.set(name, "Int32");
    }
  }
  return next;
};
