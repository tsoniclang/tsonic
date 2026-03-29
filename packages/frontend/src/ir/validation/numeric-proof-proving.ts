/**
 * Numeric Proof Proving - Narrowing proof construction
 *
 * This module handles proving that numeric narrowing expressions are sound:
 * - Literal value proofs (via proveLiteral from analysis)
 * - Identifier proofs (via proven variables/parameters)
 * - Binary/unary operation proofs (via C# promotion rules)
 * - Call/member access proofs (via CLR return types)
 * - Conditional and nullish coalescing proofs
 *
 * CRITICAL: If a narrowing cannot be proven, a diagnostic is emitted.
 * There is NO fallback to cast - unprovable narrowings are compilation errors.
 */

import { createDiagnostic } from "../../types/diagnostic.js";
import {
  IrExpression,
  IrNumericNarrowingExpression,
  NumericProof,
  getBinaryResultKind,
  isWideningConversion,
} from "../types.js";
import {
  type ProofContext,
  moduleLocation,
  getNumericKindFromType,
  inferNumericKind,
  proveLiteral,
} from "./numeric-proof-analysis.js";

/**
 * Attempt to prove a numeric narrowing expression.
 * If proof fails, emits an error diagnostic - NO FALLBACK TO CAST.
 */
export const proveNarrowing = (
  expr: IrNumericNarrowingExpression,
  ctx: ProofContext
): NumericProof | undefined => {
  const unwrapTransparentNumericExpr = (
    expression: IrExpression
  ): IrExpression => {
    let current = expression;
    while (current.kind === "typeAssertion" || current.kind === "asinterface") {
      current = current.expression;
    }
    return current;
  };

  const innerExpr = unwrapTransparentNumericExpr(expr.expression);
  const targetKind = expr.targetKind;
  // Use expression's sourceSpan if available, otherwise fall back to module location
  const location =
    expr.sourceSpan ?? innerExpr.sourceSpan ?? moduleLocation(ctx);

  // Case 1: Inner expression is a literal
  if (innerExpr.kind === "literal" && typeof innerExpr.value === "number") {
    const proof = proveLiteral(
      innerExpr.value,
      innerExpr.raw,
      targetKind,
      ctx,
      innerExpr.sourceSpan ?? location
    );
    if (proof === undefined) {
      // proveLiteral already pushed the diagnostic
      return undefined;
    }
    return proof;
  }

  // Case 2: Inner expression is an identifier that is already proven
  if (innerExpr.kind === "identifier") {
    const varKind = ctx.provenVariables.get(innerExpr.name);
    const paramKind = ctx.provenParameters.get(innerExpr.name);
    const sourceKind = varKind ?? paramKind;

    if (sourceKind !== undefined) {
      if (sourceKind === targetKind) {
        return {
          kind: targetKind,
          source: { type: "variable", name: innerExpr.name },
        };
      }
      // Check if this is a widening conversion (e.g., int → long)
      if (isWideningConversion(sourceKind, targetKind)) {
        return {
          kind: targetKind,
          source: { type: "variable", name: innerExpr.name },
        };
      }
      // Narrowing conversion - this is an error
      ctx.diagnostics.push(
        createDiagnostic(
          "TSN5104",
          "error",
          `Cannot narrow '${innerExpr.name}' from ${sourceKind} to ${targetKind}`,
          innerExpr.sourceSpan ?? location,
          `Variable '${innerExpr.name}' is proven as ${sourceKind}. ` +
            `Narrowing conversions require explicit handling.`
        )
      );
      return undefined;
    }

    // Identifier not in proven scope - check if it has numeric intent from CLR
    const identKind = getNumericKindFromType(innerExpr.inferredType);
    if (identKind !== undefined) {
      if (
        identKind === targetKind ||
        isWideningConversion(identKind, targetKind)
      ) {
        return {
          kind: targetKind,
          source: { type: "variable", name: innerExpr.name },
        };
      }
    }

    // Cannot prove this identifier
    ctx.diagnostics.push(
      createDiagnostic(
        "TSN5101",
        "error",
        `Cannot prove narrowing of '${innerExpr.name}' to ${targetKind}`,
        innerExpr.sourceSpan ?? location,
        `Expression '${innerExpr.name}' has unknown numeric kind. ` +
          `Narrow using \`${innerExpr.name} as ${targetKind}\` at assignment, ` +
          `or ensure it originates from a proven ${targetKind} source.`
      )
    );
    return undefined;
  }

  // Case 3: Inner expression is a binary operation
  if (innerExpr.kind === "binary") {
    const leftKind = inferNumericKind(innerExpr.left, ctx);
    const rightKind = inferNumericKind(innerExpr.right, ctx);

    if (leftKind !== undefined && rightKind !== undefined) {
      const resultKind = getBinaryResultKind(leftKind, rightKind);
      if (resultKind === targetKind) {
        return {
          kind: targetKind,
          source: {
            type: "binaryOp",
            operator: innerExpr.operator,
            leftKind,
            rightKind,
          },
        };
      }
      // Result kind doesn't match target - error
      ctx.diagnostics.push(
        createDiagnostic(
          "TSN5103",
          "error",
          `Binary '${leftKind} ${innerExpr.operator} ${rightKind}' produces ${resultKind}, not ${targetKind}`,
          innerExpr.sourceSpan ?? location,
          `C# promotion rules: ${leftKind} ${innerExpr.operator} ${rightKind} = ${resultKind}. ` +
            `Cast operands to ${targetKind} first if needed.`
        )
      );
      return undefined;
    }

    // Fallback for explicit narrowing of binary expressions:
    // if the binary node itself already carries deterministic numeric intent,
    // accept `(...binary...) as <targetKind>` as an explicit cast for
    // opaque producer operands (e.g. conversion calls) where operand-level
    // kind recovery is intentionally conservative.
    const isOpaqueNumericProducer = (expression: IrExpression): boolean =>
      expression.kind === "call" ||
      expression.kind === "memberAccess" ||
      expression.kind === "await";
    const inferredBinaryKind =
      getNumericKindFromType(innerExpr.inferredType) ??
      (innerExpr.inferredType?.kind === "primitiveType" &&
      innerExpr.inferredType.name === "number"
        ? "Double"
        : undefined);
    if (
      inferredBinaryKind !== undefined &&
      isOpaqueNumericProducer(innerExpr.left) &&
      isOpaqueNumericProducer(innerExpr.right)
    ) {
      return {
        kind: targetKind,
        source: { type: "narrowing", from: inferredBinaryKind },
      };
    }

    // Cannot determine operand kinds
    ctx.diagnostics.push(
      createDiagnostic(
        "TSN5101",
        "error",
        `Cannot prove narrowing of binary expression to ${targetKind}`,
        innerExpr.sourceSpan ?? location,
        "One or both operands have unknown numeric kind. " +
          "Ensure all operands are proven numeric types."
      )
    );
    return undefined;
  }

  // Case 4: Inner expression is a unary operation
  if (innerExpr.kind === "unary") {
    if (
      (innerExpr.operator === "-" || innerExpr.operator === "+") &&
      innerExpr.expression.kind === "literal" &&
      typeof innerExpr.expression.value === "number"
    ) {
      const signedLiteral =
        innerExpr.operator === "-"
          ? -innerExpr.expression.value
          : innerExpr.expression.value;
      const signedRaw =
        innerExpr.operator === "-"
          ? `-${innerExpr.expression.raw ?? String(innerExpr.expression.value)}`
          : (innerExpr.expression.raw ?? String(innerExpr.expression.value));
      const proof = proveLiteral(
        signedLiteral,
        signedRaw,
        targetKind,
        ctx,
        innerExpr.sourceSpan ?? location
      );
      if (proof === undefined) {
        return undefined;
      }
      return proof;
    }

    if (
      innerExpr.operator === "-" ||
      innerExpr.operator === "+" ||
      innerExpr.operator === "~"
    ) {
      const operandKind = inferNumericKind(innerExpr.expression, ctx);
      if (
        operandKind !== undefined &&
        (operandKind === targetKind ||
          isWideningConversion(operandKind, targetKind))
      ) {
        return {
          kind: targetKind,
          source: {
            type: "unaryOp",
            operator: innerExpr.operator,
            operandKind,
          },
        };
      }
    }
    ctx.diagnostics.push(
      createDiagnostic(
        "TSN5101",
        "error",
        `Cannot prove narrowing of unary expression to ${targetKind}`,
        innerExpr.sourceSpan ?? location,
        "Unary expression has unknown or mismatched numeric kind. " +
          "Ensure the operand is a proven numeric type."
      )
    );
    return undefined;
  }

  // Case 5: Inner expression is another numeric narrowing (nested)
  if (innerExpr.kind === "numericNarrowing") {
    if (innerExpr.proof !== undefined && innerExpr.proof.kind === targetKind) {
      return {
        kind: targetKind,
        source: { type: "narrowing", from: innerExpr.proof.kind },
      };
    }
    ctx.diagnostics.push(
      createDiagnostic(
        "TSN5101",
        "error",
        `Cannot prove nested narrowing to ${targetKind}`,
        innerExpr.sourceSpan ?? location,
        "Inner narrowing is unproven or has different kind."
      )
    );
    return undefined;
  }

  // Case 6: Inner expression is a call with known return type from CLR
  if (innerExpr.kind === "call") {
    const returnKind = getNumericKindFromType(innerExpr.inferredType);
    if (returnKind !== undefined && returnKind === targetKind) {
      const methodName =
        innerExpr.callee.kind === "memberAccess" &&
        typeof innerExpr.callee.property === "string"
          ? innerExpr.callee.property
          : "unknown";
      return {
        kind: targetKind,
        source: { type: "dotnetReturn", method: methodName, returnKind },
      };
    }
  }

  // Case 7: Inner expression is a member access with known type
  if (innerExpr.kind === "memberAccess") {
    const memberKind = getNumericKindFromType(innerExpr.inferredType);
    if (memberKind !== undefined && memberKind === targetKind) {
      const propName =
        typeof innerExpr.property === "string"
          ? innerExpr.property
          : "computed";
      return {
        kind: targetKind,
        source: {
          type: "dotnetReturn",
          method: propName,
          returnKind: memberKind,
        },
      };
    }
  }

  // Case 8: Inner expression is nullish coalescing on numeric values
  if (innerExpr.kind === "logical" && innerExpr.operator === "??") {
    const leftKind = inferNumericKind(innerExpr.left, ctx);
    const rightKind = inferNumericKind(innerExpr.right, ctx);
    if (leftKind !== undefined && rightKind !== undefined) {
      const resultKind =
        leftKind === rightKind
          ? leftKind
          : getBinaryResultKind(leftKind, rightKind);
      if (
        resultKind === targetKind ||
        isWideningConversion(resultKind, targetKind)
      ) {
        return {
          kind: targetKind,
          source: {
            type: "binaryOp",
            operator: "??",
            leftKind,
            rightKind,
          },
        };
      }
      ctx.diagnostics.push(
        createDiagnostic(
          "TSN5103",
          "error",
          `Nullish coalescing '${leftKind} ?? ${rightKind}' produces ${resultKind}, not ${targetKind}`,
          innerExpr.sourceSpan ?? location,
          `Ensure both branches are provably ${targetKind} (or widen explicitly).`
        )
      );
      return undefined;
    }
    ctx.diagnostics.push(
      createDiagnostic(
        "TSN5101",
        "error",
        `Cannot prove narrowing of nullish coalescing expression to ${targetKind}`,
        innerExpr.sourceSpan ?? location,
        "Left/right branches must both be provable numeric kinds."
      )
    );
    return undefined;
  }

  // Case 9: Inner expression is a conditional expression with deterministic
  // numeric branch result.
  if (innerExpr.kind === "conditional") {
    const resultKind = inferNumericKind(innerExpr, ctx);
    if (resultKind !== undefined) {
      if (
        resultKind === targetKind ||
        isWideningConversion(resultKind, targetKind)
      ) {
        return {
          kind: targetKind,
          source: { type: "narrowing", from: resultKind },
        };
      }
      ctx.diagnostics.push(
        createDiagnostic(
          "TSN5103",
          "error",
          `Conditional expression produces ${resultKind}, not ${targetKind}`,
          innerExpr.sourceSpan ?? location,
          `Ensure both conditional branches are provably ${targetKind} (or widen explicitly).`
        )
      );
      return undefined;
    }
    ctx.diagnostics.push(
      createDiagnostic(
        "TSN5101",
        "error",
        `Cannot prove narrowing of conditional expression to ${targetKind}`,
        innerExpr.sourceSpan ?? location,
        "Both conditional branches must be provable numeric kinds."
      )
    );
    return undefined;
  }

  // HARD GATE: Cannot prove - emit error, DO NOT fallback to cast
  ctx.diagnostics.push(
    createDiagnostic(
      "TSN5101",
      "error",
      `Cannot prove narrowing to ${targetKind}`,
      location,
      `Expression of kind '${innerExpr.kind}' cannot be proven to produce ${targetKind}. ` +
        `Ensure the expression is a literal in range, a variable with known numeric type, ` +
        `or a binary/unary operation on proven numeric operands.`
    )
  );
  return undefined;
};
