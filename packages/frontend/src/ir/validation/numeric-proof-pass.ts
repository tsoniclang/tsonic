/**
 * Numeric Proof Pass - HARD GATE for numeric type narrowings
 *
 * This pass runs before emission and:
 * 1. Validates all numeric narrowings are provable
 * 2. Attaches NumericProof to validated expressions
 * 3. Emits error diagnostics for unprovable narrowings
 *
 * CRITICAL: If this pass emits ANY errors, the emitter MUST NOT run.
 * Unlike the previous implementation, this pass does NOT allow fallback casts.
 * If we cannot prove a narrowing, compilation FAILS.
 *
 * This follows Alice's "Provably-Sound Numeric Types" specification:
 * "If Tsonic cannot prove a numeric narrowing is sound, it must fail compilation."
 */

import {
  Diagnostic,
  createDiagnostic,
  SourceLocation,
} from "../../types/diagnostic.js";
import {
  IrModule,
  IrStatement,
  IrExpression,
  IrType,
  IrNumericNarrowingExpression,
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
 * Result of numeric proof validation
 */
export type NumericProofResult = {
  readonly ok: boolean;
  readonly module: IrModule;
  readonly diagnostics: readonly Diagnostic[];
};

/**
 * Context for tracking numeric proofs during IR walk
 */
type ProofContext = {
  readonly filePath: string;
  readonly diagnostics: Diagnostic[];
  /** Maps variable names to their proven numeric kinds */
  readonly provenVariables: Map<string, NumericKind>;
  /** Maps parameter names to their numeric kinds */
  readonly provenParameters: Map<string, NumericKind>;
};

/**
 * Create a source location for a module
 */
const moduleLocation = (ctx: ProofContext): SourceLocation => ({
  file: ctx.filePath,
  line: 1,
  column: 1,
  length: 1,
});

/**
 * Extract NumericKind from an IrType if it represents a known numeric type
 *
 * INVARIANT: "int" is a distinct primitive type (primitiveType(name="int")),
 * NOT primitiveType(name="number") with numericIntent.
 */
const getNumericKindFromType = (
  type: IrType | undefined
): NumericKind | undefined => {
  if (type === undefined) {
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
const inferNumericKind = (
  expr: IrExpression,
  ctx: ProofContext
): NumericKind | undefined => {
  switch (expr.kind) {
    case "literal": {
      if (typeof expr.value === "number") {
        // Check if inferred type has explicit numeric intent (from annotation)
        const typeKind = getNumericKindFromType(expr.inferredType);
        if (typeKind !== undefined) {
          return typeKind;
        }

        // For bare literals, follow C# semantics:
        // Integer-looking literals (no decimal, no exponent) are Int32 if in range
        // Otherwise, they're Double
        if (expr.raw !== undefined && isValidIntegerLexeme(expr.raw)) {
          const bigValue = parseBigIntFromRaw(expr.raw);
          if (bigValue !== undefined && bigIntFitsInKind(bigValue, "Int32")) {
            return "Int32";
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
const proveLiteral = (
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

/**
 * Attempt to prove a numeric narrowing expression.
 * If proof fails, emits an error diagnostic - NO FALLBACK TO CAST.
 */
const proveNarrowing = (
  expr: IrNumericNarrowingExpression,
  ctx: ProofContext
): NumericProof | undefined => {
  const innerExpr = expr.expression;
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
      // Different kind - this is an error, not a cast
      ctx.diagnostics.push(
        createDiagnostic(
          "TSN5104",
          "error",
          `Cannot narrow '${innerExpr.name}' from ${sourceKind} to ${targetKind}`,
          innerExpr.sourceSpan ?? location,
          `Variable '${innerExpr.name}' is proven as ${sourceKind}. ` +
            `Cast operands to ${targetKind} first if needed.`
        )
      );
      return undefined;
    }

    // Identifier not in proven scope - check if it has numeric intent from CLR
    const identKind = getNumericKindFromType(innerExpr.inferredType);
    if (identKind !== undefined && identKind === targetKind) {
      return {
        kind: targetKind,
        source: { type: "variable", name: innerExpr.name },
      };
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
      innerExpr.operator === "-" ||
      innerExpr.operator === "+" ||
      innerExpr.operator === "~"
    ) {
      const operandKind = inferNumericKind(innerExpr.expression, ctx);
      if (operandKind !== undefined && operandKind === targetKind) {
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

/**
 * Process an expression, proving numeric narrowings and returning
 * the expression with proofs attached.
 */
const processExpression = (
  expr: IrExpression,
  ctx: ProofContext
): IrExpression => {
  switch (expr.kind) {
    case "numericNarrowing": {
      const processedInner = processExpression(expr.expression, ctx);
      const proof = proveNarrowing(
        { ...expr, expression: processedInner },
        ctx
      );
      // Note: proof may be undefined if proveNarrowing failed (diagnostic pushed)
      // We still return the expression but without proof - emitter will fail if it sees this
      return {
        ...expr,
        expression: processedInner,
        proof,
      };
    }

    case "identifier": {
      // Annotate identifiers with their proven numeric kind
      // This allows the emitter to know that x is Int32 when used in binary expressions
      const varKind = ctx.provenVariables.get(expr.name);
      const paramKind = ctx.provenParameters.get(expr.name);
      const numericKind = varKind ?? paramKind;

      if (numericKind !== undefined) {
        // Update inferredType to reflect the proven numeric type
        // INVARIANT: "Int32" → primitiveType(name="int")
        const inferredType =
          numericKind === "Int32"
            ? { kind: "primitiveType" as const, name: "int" as const }
            : { kind: "referenceType" as const, name: numericKind };
        return {
          ...expr,
          inferredType,
        };
      }
      return expr;
    }

    case "array":
      return {
        ...expr,
        elements: expr.elements.map((e) =>
          e !== undefined ? processExpression(e, ctx) : undefined
        ),
      };

    case "object":
      return {
        ...expr,
        properties: expr.properties.map((p) => {
          if (p.kind === "property") {
            return {
              ...p,
              key:
                typeof p.key === "string"
                  ? p.key
                  : processExpression(p.key, ctx),
              value: processExpression(p.value, ctx),
            };
          }
          return {
            ...p,
            expression: processExpression(p.expression, ctx),
          };
        }),
      };

    case "binary": {
      const processedLeft = processExpression(expr.left, ctx);
      const processedRight = processExpression(expr.right, ctx);

      // Infer numeric kind from processed operands
      const leftKind = inferNumericKind(processedLeft, ctx);
      const rightKind = inferNumericKind(processedRight, ctx);

      // If both operands have numeric kinds, annotate the binary result
      if (leftKind !== undefined && rightKind !== undefined) {
        const resultKind = getBinaryResultKind(leftKind, rightKind);
        // INVARIANT: "Int32" → primitiveType(name="int")
        const inferredType =
          resultKind === "Int32"
            ? { kind: "primitiveType" as const, name: "int" as const }
            : { kind: "referenceType" as const, name: resultKind };
        return {
          ...expr,
          left: processedLeft,
          right: processedRight,
          inferredType,
        };
      }

      return {
        ...expr,
        left: processedLeft,
        right: processedRight,
      };
    }

    case "logical":
      return {
        ...expr,
        left: processExpression(expr.left, ctx),
        right: processExpression(expr.right, ctx),
      };

    case "unary":
    case "update":
    case "await":
    case "spread":
      return {
        ...expr,
        expression: processExpression(expr.expression, ctx),
      };

    case "yield":
      return {
        ...expr,
        expression: expr.expression
          ? processExpression(expr.expression, ctx)
          : undefined,
      };

    case "conditional":
      return {
        ...expr,
        condition: processExpression(expr.condition, ctx),
        whenTrue: processExpression(expr.whenTrue, ctx),
        whenFalse: processExpression(expr.whenFalse, ctx),
      };

    case "assignment":
      return {
        ...expr,
        left:
          expr.left.kind === "identifierPattern" ||
          expr.left.kind === "arrayPattern" ||
          expr.left.kind === "objectPattern"
            ? expr.left
            : processExpression(expr.left, ctx),
        right: processExpression(expr.right, ctx),
      };

    case "memberAccess": {
      const processedObject = processExpression(expr.object, ctx);
      const processedProperty =
        typeof expr.property === "string"
          ? expr.property
          : processExpression(expr.property, ctx);

      // ============================================================================
      // CONTRACT: Proof pass is the ONLY source of numeric proofs.
      // The emitter ONLY consumes markers (numericIntent); it never re-derives proofs.
      // If this pass doesn't annotate an index, the emitter will ICE.
      // ============================================================================

      // ARRAY INDEX VALIDATION: Use accessKind tag (set during IR build) to determine
      // whether Int32 proof is required. This is COMPILER-GRADE: no heuristic name matching.
      if (typeof processedProperty !== "string" && expr.isComputed) {
        const accessKind = expr.accessKind;

        // HARD GATE: accessKind MUST be set for computed access.
        // If missing or "unknown", this is a compiler bug - fail early with clear diagnostic.
        if (accessKind === undefined || accessKind === "unknown") {
          // Build debug info for diagnosis
          const objectType = processedObject.inferredType;
          const typeInfo = objectType
            ? `objectType.kind=${objectType.kind}` +
              (objectType.kind === "referenceType"
                ? `, name=${objectType.name}, resolvedClrType=${objectType.resolvedClrType ?? "undefined"}`
                : "")
            : "objectType=undefined";

          ctx.diagnostics.push(
            createDiagnostic(
              "TSN5109",
              "error",
              `Computed access kind was not classified during IR build (accessKind=${accessKind ?? "undefined"}, ${typeInfo})`,
              expr.sourceSpan ??
                processedProperty.sourceSpan ??
                moduleLocation(ctx),
              "This is a compiler bug: cannot validate index proof without access classification. " +
                "Report this issue with the source code that triggered it."
            )
          );
          // Return without annotation - emitter will ICE if it reaches this
          return {
            ...expr,
            object: processedObject,
            property: processedProperty,
          };
        }

        // Require Int32 proof for:
        // - clrIndexer: CLR collection indexers (List<T>, Array, etc.)
        // - jsRuntimeArray: Tsonic.JSRuntime.Array.get()
        // - stringChar: string character access
        // Dictionary access does NOT require Int32 proof (key is typed K, usually string)
        const requiresInt32 =
          accessKind === "clrIndexer" ||
          accessKind === "jsRuntimeArray" ||
          accessKind === "stringChar";

        if (requiresInt32) {
          const indexKind = inferNumericKind(processedProperty, ctx);
          if (indexKind !== "Int32") {
            ctx.diagnostics.push(
              createDiagnostic(
                "TSN5107",
                "error",
                `Array index must be Int32, got ${indexKind ?? "unknown"}`,
                processedProperty.sourceSpan ?? moduleLocation(ctx),
                "Use 'index as int' to narrow, or ensure index is derived from Int32 source."
              )
            );
            // Return without annotation - emitter will ICE if it reaches this
            return {
              ...expr,
              object: processedObject,
              property: processedProperty,
            };
          }

          // Annotate the index expression with int type so emitter can check it
          // without re-deriving the proof. This is the ONLY place proof markers should be set.
          // INVARIANT: Array indices must be primitiveType(name="int")
          const annotatedProperty = {
            ...processedProperty,
            inferredType: {
              kind: "primitiveType" as const,
              name: "int" as const,
            },
          };
          return {
            ...expr,
            object: processedObject,
            property: annotatedProperty,
          };
        }

        // For dictionary access (accessKind === "dictionary"): no Int32 requirement
        // Pass through without annotation - key type is handled by the dictionary itself
      }

      return {
        ...expr,
        object: processedObject,
        property: processedProperty,
      };
    }

    case "call":
      return {
        ...expr,
        callee: processExpression(expr.callee, ctx),
        arguments: expr.arguments.map((a) => processExpression(a, ctx)),
      };

    case "new":
      return {
        ...expr,
        callee: processExpression(expr.callee, ctx),
        arguments: expr.arguments.map((a) => processExpression(a, ctx)),
      };

    case "templateLiteral":
      return {
        ...expr,
        expressions: expr.expressions.map((e) => processExpression(e, ctx)),
      };

    case "arrowFunction":
      return {
        ...expr,
        body:
          expr.body.kind === "blockStatement"
            ? processStatement(expr.body, ctx)
            : processExpression(expr.body, ctx),
      };

    case "functionExpression":
      return {
        ...expr,
        body: processStatement(expr.body, ctx),
      };

    default:
      return expr;
  }
};

/**
 * Process a statement, proving numeric narrowings in expressions.
 */
const processStatement = <T extends IrStatement>(
  stmt: T,
  ctx: ProofContext
): T => {
  switch (stmt.kind) {
    case "variableDeclaration": {
      const processedDeclarations = stmt.declarations.map((d) => {
        const processedInit = d.initializer
          ? processExpression(d.initializer, ctx)
          : undefined;

        // Track proven variables from declarations with known numeric kind
        // This includes:
        // 1. numericNarrowing with proof (explicit `as int`)
        // 2. Binary/unary expressions that produce known numeric kinds
        // 3. Identifiers with known numeric types
        // We track both const and let (let can be reassigned, but at init we know the type)
        if (
          d.name.kind === "identifierPattern" &&
          processedInit !== undefined
        ) {
          // First check for explicit numericNarrowing
          if (
            processedInit.kind === "numericNarrowing" &&
            processedInit.proof !== undefined
          ) {
            ctx.provenVariables.set(d.name.name, processedInit.proof.kind);
          } else {
            // Otherwise, try to infer the numeric kind from the expression
            const inferredKind = inferNumericKind(processedInit, ctx);
            if (inferredKind !== undefined) {
              ctx.provenVariables.set(d.name.name, inferredKind);
            }
          }
        }

        return {
          ...d,
          initializer: processedInit,
        };
      });
      return { ...stmt, declarations: processedDeclarations } as T;
    }

    case "functionDeclaration": {
      const paramCtx: ProofContext = {
        ...ctx,
        provenParameters: new Map(ctx.provenParameters),
        provenVariables: new Map(ctx.provenVariables),
      };
      for (const param of stmt.parameters) {
        if (param.pattern.kind === "identifierPattern") {
          const numericKind = getNumericKindFromType(param.type);
          if (numericKind !== undefined) {
            paramCtx.provenParameters.set(param.pattern.name, numericKind);
          }
        }
      }
      return {
        ...stmt,
        body: processStatement(stmt.body, paramCtx),
      } as T;
    }

    case "classDeclaration": {
      const processedMembers = stmt.members.map((m) => {
        if (m.kind === "methodDeclaration" && m.body) {
          const methodCtx: ProofContext = {
            ...ctx,
            provenParameters: new Map(ctx.provenParameters),
            provenVariables: new Map(ctx.provenVariables),
          };
          for (const param of m.parameters) {
            if (param.pattern.kind === "identifierPattern") {
              const numericKind = getNumericKindFromType(param.type);
              if (numericKind !== undefined) {
                methodCtx.provenParameters.set(param.pattern.name, numericKind);
              }
            }
          }
          return { ...m, body: processStatement(m.body, methodCtx) };
        }
        if (m.kind === "propertyDeclaration" && m.initializer) {
          return { ...m, initializer: processExpression(m.initializer, ctx) };
        }
        if (m.kind === "constructorDeclaration" && m.body) {
          return { ...m, body: processStatement(m.body, ctx) };
        }
        return m;
      });
      return { ...stmt, members: processedMembers } as T;
    }

    case "expressionStatement":
      return {
        ...stmt,
        expression: processExpression(stmt.expression, ctx),
      } as T;

    case "returnStatement":
      return {
        ...stmt,
        expression: stmt.expression
          ? processExpression(stmt.expression, ctx)
          : undefined,
      } as T;

    case "ifStatement":
      return {
        ...stmt,
        condition: processExpression(stmt.condition, ctx),
        thenStatement: processStatement(stmt.thenStatement, ctx),
        elseStatement: stmt.elseStatement
          ? processStatement(stmt.elseStatement, ctx)
          : undefined,
      } as T;

    case "whileStatement":
      return {
        ...stmt,
        condition: processExpression(stmt.condition, ctx),
        body: processStatement(stmt.body, ctx),
      } as T;

    case "forStatement":
      return {
        ...stmt,
        initializer: stmt.initializer
          ? stmt.initializer.kind === "variableDeclaration"
            ? processStatement(stmt.initializer, ctx)
            : processExpression(stmt.initializer, ctx)
          : undefined,
        condition: stmt.condition
          ? processExpression(stmt.condition, ctx)
          : undefined,
        update: stmt.update ? processExpression(stmt.update, ctx) : undefined,
        body: processStatement(stmt.body, ctx),
      } as T;

    case "forOfStatement":
      return {
        ...stmt,
        expression: processExpression(stmt.expression, ctx),
        body: processStatement(stmt.body, ctx),
      } as T;

    case "switchStatement":
      return {
        ...stmt,
        expression: processExpression(stmt.expression, ctx),
        cases: stmt.cases.map((c) => ({
          ...c,
          test: c.test ? processExpression(c.test, ctx) : undefined,
          statements: c.statements.map((s) => processStatement(s, ctx)),
        })),
      } as T;

    case "throwStatement":
      return {
        ...stmt,
        expression: processExpression(stmt.expression, ctx),
      } as T;

    case "tryStatement":
      return {
        ...stmt,
        tryBlock: processStatement(stmt.tryBlock, ctx),
        catchClause: stmt.catchClause
          ? {
              ...stmt.catchClause,
              body: processStatement(stmt.catchClause.body, ctx),
            }
          : undefined,
        finallyBlock: stmt.finallyBlock
          ? processStatement(stmt.finallyBlock, ctx)
          : undefined,
      } as T;

    case "blockStatement":
      return {
        ...stmt,
        statements: stmt.statements.map((s) => processStatement(s, ctx)),
      } as T;

    case "yieldStatement":
      return {
        ...stmt,
        output: stmt.output ? processExpression(stmt.output, ctx) : undefined,
      } as T;

    case "generatorReturnStatement":
      return {
        ...stmt,
        expression: stmt.expression
          ? processExpression(stmt.expression, ctx)
          : undefined,
      } as T;

    default:
      return stmt;
  }
};

/**
 * Run numeric proof pass on a module.
 */
const processModule = (module: IrModule): NumericProofResult => {
  const ctx: ProofContext = {
    filePath: module.filePath,
    diagnostics: [],
    provenVariables: new Map(),
    provenParameters: new Map(),
  };

  const processedBody = module.body.map((stmt) => processStatement(stmt, ctx));

  const processedExports = module.exports.map((exp) => {
    if (exp.kind === "default") {
      return { ...exp, expression: processExpression(exp.expression, ctx) };
    }
    if (exp.kind === "declaration") {
      return { ...exp, declaration: processStatement(exp.declaration, ctx) };
    }
    return exp;
  });

  return {
    ok: ctx.diagnostics.length === 0,
    module: {
      ...module,
      body: processedBody,
      exports: processedExports,
    },
    diagnostics: ctx.diagnostics,
  };
};

/**
 * Run numeric proof validation on all modules.
 *
 * HARD GATE: If any diagnostics are returned, the emitter MUST NOT run.
 * This is not a warning system - unprovable narrowings are compilation errors.
 */
export const runNumericProofPass = (
  modules: readonly IrModule[]
): {
  readonly ok: boolean;
  readonly modules: readonly IrModule[];
  readonly diagnostics: readonly Diagnostic[];
} => {
  const processedModules: IrModule[] = [];
  const allDiagnostics: Diagnostic[] = [];

  for (const module of modules) {
    const result = processModule(module);
    processedModules.push(result.module);
    allDiagnostics.push(...result.diagnostics);
  }

  return {
    ok: allDiagnostics.length === 0,
    modules: processedModules,
    diagnostics: allDiagnostics,
  };
};
