/**
 * Numeric Proof Analysis - Type inference, guard fact collection, and literal proofs
 *
 * This module handles the "analysis" side of numeric proof validation:
 * - Extracting numeric kinds from IR types
 * - Inferring numeric kinds of expressions
 * - Collecting Int32 guard facts from conditional expressions
 * - Proving literal values fit in target numeric kinds
 *
 * Used by numeric-proof-proving.ts and numeric-proof-walk.ts.
 */

import {
  Diagnostic,
  createDiagnostic,
  SourceLocation,
} from "../../types/diagnostic.js";
import {
  IrExpression,
  IrType,
  NumericKind,
  NumericProof,
  NUMERIC_RANGES,
  getBinaryResultKind,
  isIntegerKind,
  TSONIC_TO_NUMERIC_KIND,
  isValidIntegerLexeme,
  parseBigIntFromRaw,
  bigIntFitsInKind,
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

/**
 * Extract NumericKind from an IrType if it represents a known numeric type
 *
 * INVARIANT: "int" is a distinct primitive type (primitiveType(name="int")),
 * NOT primitiveType(name="number") with numericIntent.
 */
export const getNumericKindFromType = (
  type: IrType | undefined
): NumericKind | undefined => {
  if (type === undefined) {
    return undefined;
  }

  // Nullable numeric forms (e.g., int | undefined, long | null) should preserve
  // the underlying numeric kind for proof purposes.
  if (type.kind === "unionType") {
    const nonNullish = type.types.filter(
      (t) =>
        !(
          t.kind === "primitiveType" &&
          (t.name === "null" || t.name === "undefined")
        )
    );
    if (nonNullish.length === 1) {
      const only = nonNullish[0];
      return only ? getNumericKindFromType(only) : undefined;
    }
    return undefined;
  }

  // Check for primitiveType(name="int") - distinct integer primitive
  if (type.kind === "primitiveType" && type.name === "int") {
    return "Int32";
  }

  // Check for referenceType with known numeric type name (e.g., long, float, byte)
  // Use the TSONIC_TO_NUMERIC_KIND map from ir/types
  if (type.kind === "referenceType") {
    return TSONIC_TO_NUMERIC_KIND.get(type.name);
  }

  return undefined;
};

/**
 * Try to infer the numeric kind of an expression.
 * Returns undefined if the expression's numeric kind cannot be determined.
 *
 * For literals: follows C# semantics where integer-looking literals default to int.
 * A literal is Int32 if: no decimal point, no exponent, fits in Int32 range.
 * Otherwise it's Double.
 */
export const inferNumericKind = (
  expr: IrExpression,
  ctx: ProofContext
): NumericKind | undefined => {
  const unwrapTransparentNumericExpr = (
    expression: IrExpression
  ): IrExpression => {
    let current = expression;
    while (current.kind === "typeAssertion" || current.kind === "asinterface") {
      current = current.expression;
    }
    return current;
  };

  const unwrappedExpr = unwrapTransparentNumericExpr(expr);

  if (unwrappedExpr !== expr) {
    return inferNumericKind(unwrappedExpr, ctx);
  }

  switch (expr.kind) {
    case "literal": {
      if (typeof expr.value === "number") {
        // Check if inferred type has explicit numeric intent (from annotation)
        const typeKind = getNumericKindFromType(expr.inferredType);
        if (typeKind !== undefined) {
          return typeKind;
        }

        // For bare literals, follow C# semantics:
        // Integer-looking literals (no decimal, no exponent) are Int32/Int64 if in range
        // Otherwise, they're Double
        if (expr.raw !== undefined && isValidIntegerLexeme(expr.raw)) {
          const bigValue = parseBigIntFromRaw(expr.raw);
          if (bigValue !== undefined) {
            if (bigIntFitsInKind(bigValue, "Int32")) {
              return "Int32";
            }
            if (bigIntFitsInKind(bigValue, "Int64")) {
              return "Int64";
            }
          }
        }

        // Floating-point or out-of-range integer literals are Double
        return "Double";
      }
      return undefined;
    }

    case "identifier": {
      // Check if this variable is proven
      const varKind = ctx.provenVariables.get(expr.name);
      if (varKind !== undefined) {
        return varKind;
      }
      // Check if this is a parameter
      const paramKind = ctx.provenParameters.get(expr.name);
      if (paramKind !== undefined) {
        return paramKind;
      }
      // Check inferredType for CLR-typed identifiers
      return getNumericKindFromType(expr.inferredType);
    }

    case "numericNarrowing": {
      // The target kind of the narrowing is the proven kind (if proof exists)
      if (expr.proof) {
        return expr.proof.kind;
      }
      // Fall back to targetKind - the narrowing declares intent even without proof
      // This handles cases where we're inferring before proof is attached
      return expr.targetKind;
    }

    case "binary": {
      // Binary operators follow C# promotion rules
      const leftKind = inferNumericKind(expr.left, ctx);
      const rightKind = inferNumericKind(expr.right, ctx);
      if (leftKind !== undefined && rightKind !== undefined) {
        return getBinaryResultKind(leftKind, rightKind);
      }
      return undefined;
    }

    case "unary": {
      if (
        expr.operator === "-" ||
        expr.operator === "+" ||
        expr.operator === "~"
      ) {
        return inferNumericKind(expr.expression, ctx);
      }
      return undefined;
    }

    case "conditional": {
      const trueKind = inferNumericKind(expr.whenTrue, ctx);
      const falseKind = inferNumericKind(expr.whenFalse, ctx);
      if (trueKind === falseKind) {
        return trueKind;
      }
      if (trueKind !== undefined && falseKind !== undefined) {
        return getBinaryResultKind(trueKind, falseKind);
      }
      return undefined;
    }

    case "logical": {
      // `??` preserves the left kind when present, otherwise uses the right kind.
      // For proof, we require both sides to be numerically provable and derive
      // a deterministic promoted kind.
      if (expr.operator === "??") {
        const leftKind = inferNumericKind(expr.left, ctx);
        const rightKind = inferNumericKind(expr.right, ctx);
        if (leftKind === rightKind) return leftKind;
        if (leftKind !== undefined && rightKind !== undefined) {
          return getBinaryResultKind(leftKind, rightKind);
        }
      }
      return undefined;
    }

    case "call": {
      // Check if the call has a numeric return type from CLR metadata
      return getNumericKindFromType(expr.inferredType);
    }

    case "memberAccess": {
      return getNumericKindFromType(expr.inferredType);
    }

    default:
      return undefined;
  }
};

/**
 * Attempt to prove that a literal fits in a target numeric kind.
 * Uses the raw lexeme for integer validation (NOT the JS number).
 */
export const proveLiteral = (
  value: number,
  raw: string | undefined,
  targetKind: NumericKind,
  ctx: ProofContext,
  sourceSpan?: SourceLocation
): NumericProof | undefined => {
  const location = sourceSpan ?? moduleLocation(ctx);
  // For floating-point targets, any finite number works
  if (!isIntegerKind(targetKind)) {
    if (!Number.isFinite(value)) {
      ctx.diagnostics.push(
        createDiagnostic(
          "TSN5102",
          "error",
          `Literal ${value} cannot be proven as ${targetKind}: not a finite number`,
          location,
          "Only finite numbers can be used as floating-point types."
        )
      );
      return undefined;
    }
    return {
      kind: targetKind,
      source: { type: "literal", value },
    };
  }

  // For integer targets, we MUST have the raw lexeme
  if (raw === undefined) {
    ctx.diagnostics.push(
      createDiagnostic(
        "TSN5102",
        "error",
        `Cannot prove literal as ${targetKind}: raw lexeme not available`,
        location,
        "Integer literal proofs require the source lexeme for precision."
      )
    );
    return undefined;
  }

  // Check that the lexeme represents an integer (no decimal, no exponent)
  if (!isValidIntegerLexeme(raw)) {
    ctx.diagnostics.push(
      createDiagnostic(
        "TSN5102",
        "error",
        `Literal '${raw}' cannot be proven as ${targetKind}: not an integer lexeme`,
        location,
        "Use an integer literal (no decimal point or exponent), or use float/double."
      )
    );
    return undefined;
  }

  // Parse as BigInt for precise range checking
  const bigValue = parseBigIntFromRaw(raw);
  if (bigValue === undefined) {
    ctx.diagnostics.push(
      createDiagnostic(
        "TSN5102",
        "error",
        `Cannot parse literal '${raw}' as integer`,
        location,
        "The literal could not be parsed as an integer value."
      )
    );
    return undefined;
  }

  // JS Safe Integer check: Literals > 2^53-1 lose precision in JavaScript
  // This is a representation soundness check - the TypeScript parser may have
  // already lost precision by the time we see the JS number value.
  const JS_MAX_SAFE_INTEGER = BigInt("9007199254740991"); // 2^53 - 1
  const JS_MIN_SAFE_INTEGER = BigInt("-9007199254740991"); // -(2^53 - 1)
  if (bigValue > JS_MAX_SAFE_INTEGER || bigValue < JS_MIN_SAFE_INTEGER) {
    ctx.diagnostics.push(
      createDiagnostic(
        "TSN5108",
        "error",
        `Literal ${raw} exceeds JavaScript safe integer range (±${JS_MAX_SAFE_INTEGER})`,
        location,
        "Values outside ±2^53-1 cannot be exactly represented in JavaScript. " +
          "Use BigInt literals (e.g., 9007199254740992n) or string parsing."
      )
    );
    return undefined;
  }

  // Check range
  if (!bigIntFitsInKind(bigValue, targetKind)) {
    const range = NUMERIC_RANGES.get(targetKind);
    ctx.diagnostics.push(
      createDiagnostic(
        "TSN5102",
        "error",
        `Literal ${raw} is out of range for type ${targetKind} (valid range: ${range?.min} to ${range?.max})`,
        location,
        `Value must be in range ${range?.min} to ${range?.max} for ${targetKind}.`
      )
    );
    return undefined;
  }

  return {
    kind: targetKind,
    source: { type: "literal", value: bigValue },
  };
};
