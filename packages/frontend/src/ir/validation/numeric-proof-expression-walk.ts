/**
 * Numeric Proof Walk — Expression processing
 *
 * Handles walking IR expressions to attach numeric proofs.
 * This module processes all expression kinds, proving numeric narrowings
 * and annotating expressions with their proven types.
 *
 * CRITICAL: If this pass emits ANY errors, the emitter MUST NOT run.
 */

import { createDiagnostic } from "../../types/diagnostic.js";
import {
  IrExpression,
  IrObjectProperty,
  IrType,
  getBinaryResultKind,
} from "../types.js";
import {
  type ProofContext,
  moduleLocation,
  getNumericKindFromType,
  inferNumericKind,
} from "./numeric-proof-analysis.js";
import { proveNarrowing } from "./numeric-proof-proving.js";
import type { StatementProcessor } from "./numeric-proof-statement-walk.js";

/**
 * Process an expression, proving numeric narrowings and returning
 * the expression with proofs attached.
 */
export const processExpression = (
  expr: IrExpression,
  ctx: ProofContext,
  processStmt: StatementProcessor
): IrExpression => {
  switch (expr.kind) {
    case "numericNarrowing": {
      const processedInner = processExpression(expr.expression, ctx, processStmt);
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
      // Preserve parameter passing modifiers (out<T>, ref<T>, inref<T>) from `as` casts.
      // When expression converter processes `value as out<int>`, it creates an identifier
      // with inferredType: { kind: "referenceType", name: "out", ... }. We must NOT
      // overwrite this with the numeric proof, as it would lose the cast information.
      if (
        expr.inferredType?.kind === "referenceType" &&
        (expr.inferredType.name === "out" ||
          expr.inferredType.name === "ref" ||
          expr.inferredType.name === "inref")
      ) {
        return expr;
      }

      // Annotate identifiers with their proven numeric kind
      // This allows the emitter to know that x is Int32 when used in binary expressions
      const varKind = ctx.provenVariables.get(expr.name);
      const paramKind = ctx.provenParameters.get(expr.name);
      const numericKind = varKind ?? paramKind;

      if (numericKind !== undefined) {
        // Update inferredType to reflect the proven numeric type
        // INVARIANT: "Int32" → primitiveType(name="int")
        const baseType: IrType =
          numericKind === "Int32"
            ? { kind: "primitiveType" as const, name: "int" as const }
            : { kind: "referenceType" as const, name: numericKind };

        // Preserve nullable wrapper: if the original type was `T | null` or
        // `T | undefined`, the proven type must remain nullable so that the
        // emitter does not treat it as a non-nullable value type and drop `??`.
        const originalIsNullable =
          expr.inferredType?.kind === "unionType" &&
          expr.inferredType.types.some(
            (t: IrType) =>
              t.kind === "primitiveType" &&
              (t.name === "null" || t.name === "undefined")
          );
        const inferredType: IrType = originalIsNullable
          ? {
              kind: "unionType" as const,
              types: [
                baseType,
                { kind: "primitiveType" as const, name: "null" as const },
              ],
            }
          : baseType;

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
        elements: expr.elements.map((e: IrExpression | undefined) =>
          e !== undefined ? processExpression(e, ctx, processStmt) : undefined
        ),
      };

    case "object":
      return {
        ...expr,
        properties: expr.properties.map((p: IrObjectProperty) => {
          if (p.kind === "property") {
            return {
              ...p,
              key:
                typeof p.key === "string"
                  ? p.key
                  : processExpression(p.key, ctx, processStmt),
              value: processExpression(p.value, ctx, processStmt),
            };
          }
          return {
            ...p,
            expression: processExpression(p.expression, ctx, processStmt),
          };
        }),
      };

    case "binary": {
      const processedLeft = processExpression(expr.left, ctx, processStmt);
      const processedRight = processExpression(expr.right, ctx, processStmt);

      // Comparison operators return boolean, not numeric - skip numeric annotation
      const comparisonOperators = new Set([
        "<",
        ">",
        "<=",
        ">=",
        "==",
        "!=",
        "===",
        "!==",
      ]);

      if (comparisonOperators.has(expr.operator)) {
        // Comparison operators produce boolean, NOT numeric types
        return {
          ...expr,
          left: processedLeft,
          right: processedRight,
        };
      }

      // Infer numeric kind from processed operands (only for arithmetic/bitwise ops)
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
        left: processExpression(expr.left, ctx, processStmt),
        right: processExpression(expr.right, ctx, processStmt),
      };

    case "unary":
    case "update":
    case "await":
    case "spread":
      return {
        ...expr,
        expression: processExpression(expr.expression, ctx, processStmt),
      };

    case "yield":
      return {
        ...expr,
        expression: expr.expression
          ? processExpression(expr.expression, ctx, processStmt)
          : undefined,
      };

    case "conditional":
      return {
        ...expr,
        condition: processExpression(expr.condition, ctx, processStmt),
        whenTrue: processExpression(expr.whenTrue, ctx, processStmt),
        whenFalse: processExpression(expr.whenFalse, ctx, processStmt),
      };

    case "assignment":
      return {
        ...expr,
        left:
          expr.left.kind === "identifierPattern" ||
          expr.left.kind === "arrayPattern" ||
          expr.left.kind === "objectPattern"
            ? expr.left
            : processExpression(expr.left, ctx, processStmt),
        right: processExpression(expr.right, ctx, processStmt),
      };

    case "memberAccess": {
      const processedObject = processExpression(expr.object, ctx, processStmt);
      const processedProperty =
        typeof expr.property === "string"
          ? expr.property
          : processExpression(expr.property, ctx, processStmt);

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
        // - stringChar: string character access
        // Dictionary access does NOT require Int32 proof (key is typed K, usually string)
        const requiresInt32 =
          accessKind === "clrIndexer" || accessKind === "stringChar";

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
        callee: processExpression(expr.callee, ctx, processStmt),
        arguments: expr.arguments.map((a: IrExpression) => processExpression(a, ctx, processStmt)),
        dynamicImportNamespace: expr.dynamicImportNamespace
          ? (processExpression(
              expr.dynamicImportNamespace,
              ctx,
              processStmt
            ) as typeof expr.dynamicImportNamespace)
          : undefined,
      };

    case "new":
      return {
        ...expr,
        callee: processExpression(expr.callee, ctx, processStmt),
        arguments: expr.arguments.map((a: IrExpression) => processExpression(a, ctx, processStmt)),
      };

    case "stackalloc":
      return {
        ...expr,
        size: processExpression(expr.size, ctx, processStmt),
      };

    case "defaultof":
      return expr;

    case "templateLiteral":
      return {
        ...expr,
        expressions: expr.expressions.map((e: IrExpression) => processExpression(e, ctx, processStmt)),
      };

    case "arrowFunction": {
      // Create context with arrow function parameters proven
      const arrowCtx: ProofContext = {
        ...ctx,
        provenParameters: new Map(ctx.provenParameters),
        provenVariables: new Map(ctx.provenVariables),
      };
      for (const param of expr.parameters) {
        if (param.pattern.kind === "identifierPattern") {
          const numericKind = getNumericKindFromType(param.type);
          if (numericKind !== undefined) {
            arrowCtx.provenParameters.set(param.pattern.name, numericKind);
          }
        }
      }
      return {
        ...expr,
        body:
          expr.body.kind === "blockStatement"
            ? processStmt(expr.body, arrowCtx)
            : processExpression(expr.body, arrowCtx, processStmt),
      };
    }

    case "functionExpression": {
      // Create context with function expression parameters proven
      const funcCtx: ProofContext = {
        ...ctx,
        provenParameters: new Map(ctx.provenParameters),
        provenVariables: new Map(ctx.provenVariables),
      };
      for (const param of expr.parameters) {
        if (param.pattern.kind === "identifierPattern") {
          const numericKind = getNumericKindFromType(param.type);
          if (numericKind !== undefined) {
            funcCtx.provenParameters.set(param.pattern.name, numericKind);
          }
        }
      }
      return {
        ...expr,
        body: processStmt(expr.body, funcCtx),
      };
    }

    default:
      return expr;
  }
};
