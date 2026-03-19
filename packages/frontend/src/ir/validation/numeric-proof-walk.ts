/**
 * Numeric Proof Walk - IR tree traversal and proof attachment
 *
 * This module handles walking the IR tree to:
 * - Process all expressions, attaching numeric proofs
 * - Process all statements, tracking proven variables
 * - Run the proof pass on modules and aggregate diagnostics
 *
 * CRITICAL: If this pass emits ANY errors, the emitter MUST NOT run.
 * Unlike the previous implementation, this pass does NOT allow fallback casts.
 * If we cannot prove a narrowing, compilation FAILS.
 */

import { Diagnostic, createDiagnostic } from "../../types/diagnostic.js";
import {
  IrModule,
  IrStatement,
  IrExpression,
  IrType,
  getBinaryResultKind,
} from "../types.js";
import {
  type ProofContext,
  moduleLocation,
  cloneProofContext,
  withInt32ProofsFromTruthyCondition,
  getNumericKindFromType,
  inferNumericKind,
} from "./numeric-proof-analysis.js";
import { proveNarrowing } from "./numeric-proof-proving.js";

/**
 * Result of numeric proof validation
 */
export type NumericProofResult = {
  readonly ok: boolean;
  readonly module: IrModule;
  readonly diagnostics: readonly Diagnostic[];
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
            (t) =>
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
        callee: processExpression(expr.callee, ctx),
        arguments: expr.arguments.map((a) => processExpression(a, ctx)),
        dynamicImportNamespace: expr.dynamicImportNamespace
          ? (processExpression(
              expr.dynamicImportNamespace,
              ctx
            ) as typeof expr.dynamicImportNamespace)
          : undefined,
      };

    case "new":
      return {
        ...expr,
        callee: processExpression(expr.callee, ctx),
        arguments: expr.arguments.map((a) => processExpression(a, ctx)),
      };

    case "stackalloc":
      return {
        ...expr,
        size: processExpression(expr.size, ctx),
      };

    case "defaultof":
      return expr;

    case "templateLiteral":
      return {
        ...expr,
        expressions: expr.expressions.map((e) => processExpression(e, ctx)),
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
            ? processStatement(expr.body, arrowCtx)
            : processExpression(expr.body, arrowCtx),
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
        body: processStatement(expr.body, funcCtx),
      };
    }

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
        // 0. Explicit type annotations (authoritative)
        // 1. numericNarrowing with proof (explicit `as int`)
        // 2. Binary/unary expressions that produce known numeric kinds
        // 3. Identifiers with known numeric types
        // We track both const and let (let can be reassigned, but at init we know the type)
        if (d.name.kind === "identifierPattern") {
          // If a variable has an explicit numeric type annotation, that type is authoritative.
          // We must not "re-prove" it from the initializer, or we'll incorrectly treat
          // `let x: long = 1;` as Int32 (because `1` is an Int32 literal by lexeme).
          const declaredKind = getNumericKindFromType(d.type);
          if (declaredKind !== undefined) {
            ctx.provenVariables.set(d.name.name, declaredKind);
          } else if (d.type === undefined && processedInit !== undefined) {
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

    case "ifStatement": {
      const processedCondition = processExpression(stmt.condition, ctx);
      const thenCtx = withInt32ProofsFromTruthyCondition(
        cloneProofContext(ctx),
        processedCondition
      );
      return {
        ...stmt,
        condition: processedCondition,
        thenStatement: processStatement(stmt.thenStatement, thenCtx),
        elseStatement: stmt.elseStatement
          ? processStatement(stmt.elseStatement, ctx)
          : undefined,
      } as T;
    }

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

    case "forInStatement":
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
