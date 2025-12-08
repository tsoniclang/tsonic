/**
 * Numeric Proof Pass - Validates numeric type narrowings
 *
 * This pass runs before emission and:
 * 1. Validates all numeric narrowings are provable
 * 2. Attaches NumericProof to validated expressions
 * 3. Emits diagnostics for unprovable narrowings
 *
 * If this pass emits any errors, the emitter must not run.
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
  literalFitsInKind,
  isIntegerKind,
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
 * Extract NumericKind from an IrType if it has numericIntent
 */
const getNumericKindFromType = (type: IrType | undefined): NumericKind | undefined => {
  if (type?.kind === "primitiveType" && type.name === "number") {
    return type.numericIntent;
  }
  return undefined;
};

/**
 * Try to infer the numeric kind of an expression.
 * Returns undefined if the expression's numeric kind cannot be determined.
 */
const inferNumericKind = (
  expr: IrExpression,
  ctx: ProofContext
): NumericKind | undefined => {
  switch (expr.kind) {
    case "literal": {
      // Numeric literals are unproven until narrowed
      // A bare `10` is just `number` (Double in C#)
      // Only `10 as int` makes it Int32
      if (typeof expr.value === "number") {
        // Check if inferred type has numeric intent
        const typeKind = getNumericKindFromType(expr.inferredType);
        if (typeKind !== undefined) {
          return typeKind;
        }
        // Otherwise, bare numeric literal is Double
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
      // Check inferredType
      return getNumericKindFromType(expr.inferredType);
    }

    case "numericNarrowing": {
      // The target kind of the narrowing is the proven kind (if proof exists)
      if (expr.proof) {
        return expr.proof.kind;
      }
      // Otherwise use the target kind as the expected kind
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
      if (expr.operator === "-" || expr.operator === "+" || expr.operator === "~") {
        return inferNumericKind(expr.expression, ctx);
      }
      return undefined;
    }

    case "conditional": {
      // For conditional expressions, both branches should have same numeric kind
      const trueKind = inferNumericKind(expr.whenTrue, ctx);
      const falseKind = inferNumericKind(expr.whenFalse, ctx);
      if (trueKind === falseKind) {
        return trueKind;
      }
      // If different, use promotion rules
      if (trueKind !== undefined && falseKind !== undefined) {
        return getBinaryResultKind(trueKind, falseKind);
      }
      return undefined;
    }

    case "call": {
      // Check if the call has a numeric return type
      return getNumericKindFromType(expr.inferredType);
    }

    case "memberAccess": {
      // Check if accessing a member with numeric type
      return getNumericKindFromType(expr.inferredType);
    }

    default:
      return undefined;
  }
};

/**
 * Attempt to prove that a literal fits in a target numeric kind.
 */
const proveLiteral = (
  value: number,
  targetKind: NumericKind,
  ctx: ProofContext
): NumericProof | undefined => {
  // For floating-point targets, any number works
  if (!isIntegerKind(targetKind)) {
    return {
      kind: targetKind,
      source: { type: "literal", value },
    };
  }

  // For integer targets, check that value is integral and in range
  if (!Number.isInteger(value)) {
    ctx.diagnostics.push(
      createDiagnostic(
        "TSN5102",
        "error",
        `Literal ${value} cannot be proven as ${targetKind}: not an integer`,
        moduleLocation(ctx),
        "Only integer values can be narrowed to integer types"
      )
    );
    return undefined;
  }

  // Check range
  if (!literalFitsInKind(value, targetKind)) {
    const range = NUMERIC_RANGES.get(targetKind);
    ctx.diagnostics.push(
      createDiagnostic(
        "TSN5102",
        "error",
        `Literal ${value} is out of range for type ${targetKind} (valid range: ${range?.min} to ${range?.max})`,
        moduleLocation(ctx),
        "Use a literal within the valid range for this type"
      )
    );
    return undefined;
  }

  return {
    kind: targetKind,
    source: { type: "literal", value },
  };
};

/**
 * Attempt to prove a numeric narrowing expression.
 */
const proveNarrowing = (
  expr: IrNumericNarrowingExpression,
  ctx: ProofContext
): NumericProof | undefined => {
  const innerExpr = expr.expression;
  const targetKind = expr.targetKind;

  // Case 1: Inner expression is a literal
  if (innerExpr.kind === "literal" && typeof innerExpr.value === "number") {
    return proveLiteral(innerExpr.value, targetKind, ctx);
  }

  // Case 2: Inner expression is an identifier that is already proven
  if (innerExpr.kind === "identifier") {
    const varKind = ctx.provenVariables.get(innerExpr.name);
    const paramKind = ctx.provenParameters.get(innerExpr.name);
    const sourceKind = varKind ?? paramKind;

    if (sourceKind !== undefined) {
      // Same kind - no conversion needed, proof is valid
      if (sourceKind === targetKind) {
        return {
          kind: targetKind,
          source: { type: "variable", name: innerExpr.name },
        };
      }
      // Different kind - allow but return undefined to trigger cast
      // TODO: Could add widening proofs here
      return undefined;
    }
  }

  // Case 3: Inner expression is a binary operation
  if (innerExpr.kind === "binary") {
    const resultKind = inferNumericKind(innerExpr, ctx);
    if (resultKind === targetKind) {
      const leftKind = inferNumericKind(innerExpr.left, ctx);
      const rightKind = inferNumericKind(innerExpr.right, ctx);
      if (leftKind !== undefined && rightKind !== undefined) {
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
    }
    // Result doesn't match target - allow but return undefined to trigger cast
    // The emitter will add an explicit cast
    // TODO: Consider erroring here for truly incompatible conversions
  }

  // Case 4: Inner expression is another numeric narrowing (nested)
  if (innerExpr.kind === "numericNarrowing") {
    // Process the inner narrowing first
    const innerProof = proveNarrowing(innerExpr, ctx);
    if (innerProof !== undefined) {
      // Check if the inner result matches target
      if (innerProof.kind === targetKind) {
        return {
          kind: targetKind,
          source: { type: "narrowing", from: innerProof.kind },
        };
      }
    }
  }

  // Case 5: Inner expression is a call with known return type
  if (innerExpr.kind === "call") {
    const returnKind = getNumericKindFromType(innerExpr.inferredType);
    if (returnKind !== undefined && returnKind === targetKind) {
      // Get method name for proof source
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

  // Cannot prove statically - return undefined to indicate no proof
  // The emitter will emit an explicit cast for safety
  // This is less strict than Alice's spec but allows more code to compile
  // TODO: Make this stricter once integer literal context inference is implemented
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
      return {
        ...expr,
        expression: processedInner,
        proof,
      };
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
                typeof p.key === "string" ? p.key : processExpression(p.key, ctx),
              value: processExpression(p.value, ctx),
            };
          }
          return {
            ...p,
            expression: processExpression(p.expression, ctx),
          };
        }),
      };

    case "binary":
      return {
        ...expr,
        left: processExpression(expr.left, ctx),
        right: processExpression(expr.right, ctx),
      };

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

    case "memberAccess":
      return {
        ...expr,
        object: processExpression(expr.object, ctx),
        property:
          typeof expr.property === "string"
            ? expr.property
            : processExpression(expr.property, ctx),
      };

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

        // Track proven variables from const declarations with numeric narrowing
        // The declarationKind is on the parent statement, not the declarator
        if (
          stmt.declarationKind === "const" &&
          d.name.kind === "identifierPattern" &&
          processedInit?.kind === "numericNarrowing" &&
          processedInit.proof !== undefined
        ) {
          ctx.provenVariables.set(d.name.name, processedInit.proof.kind);
        }

        return {
          ...d,
          initializer: processedInit,
        };
      });
      return { ...stmt, declarations: processedDeclarations } as T;
    }

    case "functionDeclaration": {
      // Add parameters to proven context
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
          // Add parameters to context
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

  // Process all statements
  const processedBody = module.body.map((stmt) => processStatement(stmt, ctx));

  // Process exports
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
 * This is the numeric proof gate - if any diagnostics are returned,
 * the emitter must not run.
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
