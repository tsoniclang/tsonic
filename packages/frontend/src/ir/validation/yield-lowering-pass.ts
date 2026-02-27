/**
 * Yield Lowering Pass
 *
 * Transforms yield expressions in generator functions into IrYieldStatement nodes.
 * This pass runs after IR building and before numeric proof pass.
 *
 * Supported patterns:
 * - `yield expr;` → IrYieldStatement with no receiveTarget
 * - `const x = yield expr;` → IrYieldStatement with receiveTarget = identifierPattern
 * - `x = yield expr;` → IrYieldStatement with receiveTarget = identifierPattern
 * - `const {a, b} = yield expr;` → IrYieldStatement with receiveTarget = objectPattern
 * - `const [a, b] = yield expr;` → IrYieldStatement with receiveTarget = arrayPattern
 * - `return yield expr;` → IrYieldStatement + IrGeneratorReturnStatement(temp)
 * - `throw yield expr;` → IrYieldStatement + IrThrowStatement(temp)
 * - `for (x = yield expr; ... )` → IrYieldStatement + ForStatement(without initializer)
 * - `for (; yield cond; ... )` → ForStatement(condition=true) + loop-body condition prelude
 * - `for (...; ...; yield update)` → ForStatement(update=undefined) + loop-body update prelude
 * - `for (... of yield expr)` / `for (... in yield expr)` → IrYieldStatement + loop over temp
 * - `if (yield expr) { ... }` → IrYieldStatement + IfStatement(temp)
 * - `switch (yield expr) { ... }` → IrYieldStatement + SwitchStatement(temp)
 * - `while (yield expr) { ... }` → While(true) with per-iteration yield+guard
 *
 * Unsupported patterns (emit TSN6101 diagnostic):
 * - `foo(yield x)` - yield in call argument
 * - `yield x + yield y` - multiple yields in expression
 * - `[yield x, 1]` - yield in array literal
 * - `{a: yield x}` - yield in object literal
 * - `cond ? yield a : b` - yield in ternary
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
  IrBlockStatement,
  IrYieldStatement,
  IrGeneratorReturnStatement,
  IrYieldExpression,
  IrPattern,
  IrType,
  IrClassMember,
} from "../types.js";

/**
 * Result of yield lowering pass
 */
export type YieldLoweringResult = {
  readonly ok: boolean;
  readonly modules: readonly IrModule[];
  readonly diagnostics: readonly Diagnostic[];
};

/**
 * Context for tracking state during yield lowering
 */
type LoweringContext = {
  readonly filePath: string;
  readonly diagnostics: Diagnostic[];
  /** True if we're inside a generator function */
  readonly inGenerator: boolean;
  yieldTempCounter: number;
};

/**
 * Create a source location for a module
 */
const moduleLocation = (ctx: LoweringContext): SourceLocation => ({
  file: ctx.filePath,
  line: 1,
  column: 1,
  length: 1,
});

/**
 * Check if an expression contains a yield expression anywhere in its tree.
 */
const containsYield = (expr: IrExpression): boolean => {
  switch (expr.kind) {
    case "yield":
      return true;

    case "binary":
    case "logical":
      return containsYield(expr.left) || containsYield(expr.right);

    case "unary":
    case "update":
    case "await":
    case "spread":
      return containsYield(expr.expression);

    case "conditional":
      return (
        containsYield(expr.condition) ||
        containsYield(expr.whenTrue) ||
        containsYield(expr.whenFalse)
      );

    case "assignment":
      return (
        (expr.left.kind !== "identifierPattern" &&
          expr.left.kind !== "arrayPattern" &&
          expr.left.kind !== "objectPattern" &&
          containsYield(expr.left)) ||
        containsYield(expr.right)
      );

    case "memberAccess":
      return (
        containsYield(expr.object) ||
        (typeof expr.property !== "string" && containsYield(expr.property))
      );

    case "call":
    case "new":
      return (
        containsYield(expr.callee) ||
        expr.arguments.some((a) => containsYield(a))
      );

    case "array":
      return expr.elements.some((e) => e !== undefined && containsYield(e));

    case "object":
      return expr.properties.some((p) => {
        if (p.kind === "property") {
          return (
            (typeof p.key !== "string" && containsYield(p.key)) ||
            containsYield(p.value)
          );
        }
        return containsYield(p.expression);
      });

    case "templateLiteral":
      return expr.expressions.some((e) => containsYield(e));

    case "arrowFunction":
    case "functionExpression":
      // Don't recurse into nested functions - they have their own generator context
      return false;

    default:
      return false;
  }
};

/**
 * Count the number of yield expressions in an expression tree.
 */
const countYields = (expr: IrExpression): number => {
  switch (expr.kind) {
    case "yield":
      return 1 + (expr.expression ? countYields(expr.expression) : 0);

    case "binary":
    case "logical":
      return countYields(expr.left) + countYields(expr.right);

    case "unary":
    case "update":
    case "await":
    case "spread":
      return countYields(expr.expression);

    case "conditional":
      return (
        countYields(expr.condition) +
        countYields(expr.whenTrue) +
        countYields(expr.whenFalse)
      );

    case "assignment":
      return (
        (expr.left.kind !== "identifierPattern" &&
        expr.left.kind !== "arrayPattern" &&
        expr.left.kind !== "objectPattern"
          ? countYields(expr.left)
          : 0) + countYields(expr.right)
      );

    case "memberAccess":
      return (
        countYields(expr.object) +
        (typeof expr.property !== "string" ? countYields(expr.property) : 0)
      );

    case "call":
    case "new":
      return (
        countYields(expr.callee) +
        expr.arguments.reduce((sum, a) => sum + countYields(a), 0)
      );

    case "array":
      return expr.elements.reduce(
        (sum, e) => sum + (e !== undefined ? countYields(e) : 0),
        0
      );

    case "object":
      return expr.properties.reduce((sum, p) => {
        if (p.kind === "property") {
          return (
            sum +
            (typeof p.key !== "string" ? countYields(p.key) : 0) +
            countYields(p.value)
          );
        }
        return sum + countYields(p.expression);
      }, 0);

    case "templateLiteral":
      return expr.expressions.reduce((sum, e) => sum + countYields(e), 0);

    case "arrowFunction":
    case "functionExpression":
      return 0;

    default:
      return 0;
  }
};

/**
 * Create an IrYieldStatement from a yield expression.
 */
const createYieldStatement = (
  yieldExpr: IrYieldExpression,
  receiveTarget: IrPattern | undefined,
  receivedType: IrType | undefined
): IrYieldStatement => ({
  kind: "yieldStatement",
  output: yieldExpr.expression,
  delegate: yieldExpr.delegate,
  receiveTarget,
  receivedType,
});

const toReceivePattern = (
  target: IrExpression | IrPattern
): IrPattern | undefined => {
  if (
    target.kind === "identifierPattern" ||
    target.kind === "arrayPattern" ||
    target.kind === "objectPattern"
  ) {
    return target;
  }

  if (target.kind === "identifier") {
    return { kind: "identifierPattern", name: target.name };
  }

  return undefined;
};

/**
 * Create an IrGeneratorReturnStatement from a return statement's expression.
 * This captures the return value for generators with TReturn.
 */
const createGeneratorReturnStatement = (
  expression: IrExpression | undefined
): IrGeneratorReturnStatement => ({
  kind: "generatorReturnStatement",
  expression,
});

/**
 * Emit diagnostic for unsupported yield position.
 */
const emitUnsupportedYieldDiagnostic = (
  ctx: LoweringContext,
  position: string,
  location?: SourceLocation
): void => {
  ctx.diagnostics.push(
    createDiagnostic(
      "TSN6101",
      "error",
      `Yield expression in ${position} is not supported`,
      location ?? moduleLocation(ctx),
      "Extract yield to a separate statement: `const result = yield expr; use(result);`"
    )
  );
};

const allocateYieldTempName = (ctx: LoweringContext): string => {
  ctx.yieldTempCounter += 1;
  return `__tsonic_yield_${ctx.yieldTempCounter}`;
};

/**
 * Process a statement in a generator function body.
 * Returns the transformed statement(s) - may return multiple statements
 * when a single statement is split.
 */
const processStatement = (
  stmt: IrStatement,
  ctx: LoweringContext
): IrStatement | readonly IrStatement[] => {
  if (!ctx.inGenerator) {
    // Not in generator - just recurse into nested functions
    return processNonGeneratorStatement(stmt, ctx);
  }

  switch (stmt.kind) {
    case "expressionStatement": {
      const expr = stmt.expression;

      // Pattern 1: yield expr; (yield in statement position)
      if (expr.kind === "yield") {
        return createYieldStatement(expr, undefined, undefined);
      }

      // Pattern 3: x = yield expr; (assignment with yield on right)
      if (
        expr.kind === "assignment" &&
        expr.right.kind === "yield" &&
        !expr.right.delegate
      ) {
        // Only support simple assignment operators (=)
        if (expr.operator !== "=") {
          emitUnsupportedYieldDiagnostic(
            ctx,
            "compound assignment",
            expr.right.sourceSpan
          );
          return stmt;
        }

        // Extract the target pattern
        const receiveTarget = toReceivePattern(expr.left);
        if (receiveTarget) {
          return createYieldStatement(
            expr.right,
            receiveTarget,
            expr.right.inferredType
          );
        }

        // Assignment to member expression or other LHS - not supported
        emitUnsupportedYieldDiagnostic(
          ctx,
          "assignment to complex target",
          expr.right.sourceSpan
        );
        return stmt;
      }

      // Check for yield in unsupported positions
      if (containsYield(expr)) {
        emitUnsupportedYieldDiagnostic(
          ctx,
          "complex expression",
          expr.sourceSpan
        );
      }

      return stmt;
    }

    case "variableDeclaration": {
      // Pattern 2: const x = yield expr; (variable declaration with yield initializer)
      const transformedDeclarations: IrStatement[] = [];

      for (const decl of stmt.declarations) {
        if (decl.initializer?.kind === "yield" && !decl.initializer.delegate) {
          // Check for multiple yields in initializer
          if (countYields(decl.initializer) > 1) {
            emitUnsupportedYieldDiagnostic(
              ctx,
              "multiple yields in initializer",
              decl.initializer.sourceSpan
            );
            transformedDeclarations.push({
              kind: "variableDeclaration",
              declarationKind: stmt.declarationKind,
              declarations: [decl],
              isExported: false,
            });
            continue;
          }

          // Transform to yield statement with receiveTarget
          transformedDeclarations.push(
            createYieldStatement(
              decl.initializer,
              decl.name,
              decl.type ?? decl.initializer.inferredType
            )
          );
        } else if (decl.initializer && containsYield(decl.initializer)) {
          // Yield nested in initializer expression - not supported
          emitUnsupportedYieldDiagnostic(
            ctx,
            "nested initializer expression",
            decl.initializer.sourceSpan
          );
          transformedDeclarations.push({
            kind: "variableDeclaration",
            declarationKind: stmt.declarationKind,
            declarations: [decl],
            isExported: false,
          });
        } else {
          // No yield - keep original declaration
          transformedDeclarations.push({
            kind: "variableDeclaration",
            declarationKind: stmt.declarationKind,
            declarations: [decl],
            isExported: false,
          });
        }
      }

      // Return single statement or array of statements
      if (
        transformedDeclarations.length === 1 &&
        transformedDeclarations[0] !== undefined
      ) {
        return transformedDeclarations[0];
      }
      return transformedDeclarations;
    }

    case "blockStatement":
      return {
        ...stmt,
        statements: stmt.statements.flatMap((s) => {
          const result = processStatement(s, ctx);
          return Array.isArray(result) ? result : [result];
        }),
      };

    case "ifStatement":
      if (stmt.condition.kind === "yield" && !stmt.condition.delegate) {
        const tempName = allocateYieldTempName(ctx);
        return [
          createYieldStatement(
            stmt.condition,
            { kind: "identifierPattern", name: tempName },
            stmt.condition.inferredType
          ),
          {
            ...stmt,
            condition: { kind: "identifier", name: tempName },
            thenStatement: flattenStatement(
              processStatement(stmt.thenStatement, ctx)
            ),
            elseStatement: stmt.elseStatement
              ? flattenStatement(processStatement(stmt.elseStatement, ctx))
              : undefined,
          },
        ];
      }
      if (containsYield(stmt.condition)) {
        emitUnsupportedYieldDiagnostic(
          ctx,
          "if condition",
          stmt.condition.sourceSpan
        );
      }
      return {
        ...stmt,
        thenStatement: flattenStatement(
          processStatement(stmt.thenStatement, ctx)
        ),
        elseStatement: stmt.elseStatement
          ? flattenStatement(processStatement(stmt.elseStatement, ctx))
          : undefined,
      };

    case "whileStatement":
      if (stmt.condition.kind === "yield" && !stmt.condition.delegate) {
        const tempName = allocateYieldTempName(ctx);
        const transformedBody = flattenStatement(
          processStatement(stmt.body, ctx)
        );
        const bodyStatements: IrStatement[] = [
          createYieldStatement(
            stmt.condition,
            { kind: "identifierPattern", name: tempName },
            stmt.condition.inferredType
          ),
          {
            kind: "ifStatement",
            condition: {
              kind: "unary",
              operator: "!",
              expression: { kind: "identifier", name: tempName },
            },
            thenStatement: { kind: "breakStatement" },
          },
        ];
        if (transformedBody.kind === "blockStatement") {
          bodyStatements.push(...transformedBody.statements);
        } else {
          bodyStatements.push(transformedBody);
        }
        return {
          kind: "whileStatement",
          condition: { kind: "literal", value: true },
          body: {
            kind: "blockStatement",
            statements: bodyStatements,
          },
        };
      }
      if (containsYield(stmt.condition)) {
        emitUnsupportedYieldDiagnostic(
          ctx,
          "while condition",
          stmt.condition.sourceSpan
        );
      }
      return {
        ...stmt,
        body: flattenStatement(processStatement(stmt.body, ctx)),
      };

    case "forStatement": {
      const leadingStatements: IrStatement[] = [];
      let initializer = stmt.initializer;

      if (
        initializer &&
        initializer.kind === "assignment" &&
        initializer.operator === "=" &&
        initializer.right.kind === "yield" &&
        !initializer.right.delegate
      ) {
        const receiveTarget = toReceivePattern(initializer.left);
        if (!receiveTarget) {
          emitUnsupportedYieldDiagnostic(
            ctx,
            "for loop initializer",
            initializer.right.sourceSpan
          );
        } else {
          leadingStatements.push(
            createYieldStatement(
              initializer.right,
              receiveTarget,
              initializer.right.inferredType
            )
          );
          initializer = undefined;
        }
      } else if (initializer) {
        if (
          initializer.kind === "variableDeclaration" &&
          initializer.declarations.some(
            (d) => d.initializer && containsYield(d.initializer)
          )
        ) {
          emitUnsupportedYieldDiagnostic(ctx, "for loop initializer");
        } else if (
          initializer.kind !== "variableDeclaration" &&
          containsYield(initializer)
        ) {
          emitUnsupportedYieldDiagnostic(ctx, "for loop initializer");
        }
      }

      const directConditionYield =
        stmt.condition &&
        stmt.condition.kind === "yield" &&
        !stmt.condition.delegate
          ? stmt.condition
          : undefined;
      const directUpdateYield =
        stmt.update && stmt.update.kind === "yield" && !stmt.update.delegate
          ? stmt.update
          : undefined;

      if (
        stmt.condition &&
        !directConditionYield &&
        containsYield(stmt.condition)
      ) {
        emitUnsupportedYieldDiagnostic(
          ctx,
          "for loop condition",
          stmt.condition.sourceSpan
        );
      }
      if (stmt.update && !directUpdateYield && containsYield(stmt.update)) {
        emitUnsupportedYieldDiagnostic(
          ctx,
          "for loop update",
          stmt.update.sourceSpan
        );
      }

      const transformedBody = flattenStatement(
        processStatement(stmt.body, ctx)
      );
      if (!directConditionYield && !directUpdateYield) {
        const transformedFor: IrStatement = {
          ...stmt,
          initializer,
          body: transformedBody,
        };
        if (leadingStatements.length === 0) {
          return transformedFor;
        }
        return [...leadingStatements, transformedFor];
      }

      const bodyStatements: IrStatement[] = [];
      let updateFirstFlagName: string | undefined;
      if (directUpdateYield) {
        updateFirstFlagName = allocateYieldTempName(ctx);
        leadingStatements.push({
          kind: "variableDeclaration",
          declarationKind: "let",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: updateFirstFlagName },
              type: { kind: "primitiveType", name: "boolean" },
              initializer: { kind: "literal", value: true },
            },
          ],
        });
        bodyStatements.push({
          kind: "ifStatement",
          condition: {
            kind: "unary",
            operator: "!",
            expression: { kind: "identifier", name: updateFirstFlagName },
          },
          thenStatement: createYieldStatement(
            directUpdateYield,
            undefined,
            undefined
          ),
        });
        bodyStatements.push({
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "=",
            left: { kind: "identifierPattern", name: updateFirstFlagName },
            right: { kind: "literal", value: false },
          },
        });
      }

      if (directConditionYield) {
        const conditionTempName = allocateYieldTempName(ctx);
        bodyStatements.push(
          createYieldStatement(
            directConditionYield,
            { kind: "identifierPattern", name: conditionTempName },
            directConditionYield.inferredType
          )
        );
        bodyStatements.push({
          kind: "ifStatement",
          condition: {
            kind: "unary",
            operator: "!",
            expression: { kind: "identifier", name: conditionTempName },
          },
          thenStatement: { kind: "breakStatement" },
        });
      } else if (directUpdateYield && stmt.condition) {
        bodyStatements.push({
          kind: "ifStatement",
          condition: {
            kind: "unary",
            operator: "!",
            expression: stmt.condition,
          },
          thenStatement: { kind: "breakStatement" },
        });
      }

      if (transformedBody.kind === "blockStatement") {
        bodyStatements.push(...transformedBody.statements);
      } else {
        bodyStatements.push(transformedBody);
      }

      const transformedFor: IrStatement = {
        ...stmt,
        initializer,
        condition: { kind: "literal", value: true },
        update: directUpdateYield ? undefined : stmt.update,
        body: {
          kind: "blockStatement",
          statements: bodyStatements,
        },
      };

      if (leadingStatements.length === 0) {
        return transformedFor;
      }
      return [...leadingStatements, transformedFor];
    }

    case "forOfStatement":
      if (stmt.expression.kind === "yield" && !stmt.expression.delegate) {
        const tempName = allocateYieldTempName(ctx);
        return [
          createYieldStatement(
            stmt.expression,
            { kind: "identifierPattern", name: tempName },
            stmt.expression.inferredType
          ),
          {
            ...stmt,
            expression: { kind: "identifier", name: tempName },
            body: flattenStatement(processStatement(stmt.body, ctx)),
          },
        ];
      }
      if (containsYield(stmt.expression)) {
        emitUnsupportedYieldDiagnostic(
          ctx,
          "for-of expression",
          stmt.expression.sourceSpan
        );
      }
      return {
        ...stmt,
        body: flattenStatement(processStatement(stmt.body, ctx)),
      };

    case "forInStatement":
      if (stmt.expression.kind === "yield" && !stmt.expression.delegate) {
        const tempName = allocateYieldTempName(ctx);
        return [
          createYieldStatement(
            stmt.expression,
            { kind: "identifierPattern", name: tempName },
            stmt.expression.inferredType
          ),
          {
            ...stmt,
            expression: { kind: "identifier", name: tempName },
            body: flattenStatement(processStatement(stmt.body, ctx)),
          },
        ];
      }
      if (containsYield(stmt.expression)) {
        emitUnsupportedYieldDiagnostic(
          ctx,
          "for-in expression",
          stmt.expression.sourceSpan
        );
      }
      return {
        ...stmt,
        body: flattenStatement(processStatement(stmt.body, ctx)),
      };

    case "switchStatement":
      if (stmt.expression.kind === "yield" && !stmt.expression.delegate) {
        const tempName = allocateYieldTempName(ctx);
        return [
          createYieldStatement(
            stmt.expression,
            { kind: "identifierPattern", name: tempName },
            stmt.expression.inferredType
          ),
          {
            ...stmt,
            expression: { kind: "identifier", name: tempName },
            cases: stmt.cases.map((c) => ({
              ...c,
              statements: c.statements.flatMap((s) => {
                const result = processStatement(s, ctx);
                return Array.isArray(result) ? result : [result];
              }),
            })),
          },
        ];
      }
      if (containsYield(stmt.expression)) {
        emitUnsupportedYieldDiagnostic(
          ctx,
          "switch expression",
          stmt.expression.sourceSpan
        );
      }
      return {
        ...stmt,
        cases: stmt.cases.map((c) => ({
          ...c,
          statements: c.statements.flatMap((s) => {
            const result = processStatement(s, ctx);
            return Array.isArray(result) ? result : [result];
          }),
        })),
      };

    case "tryStatement":
      return {
        ...stmt,
        tryBlock: flattenStatement(
          processStatement(stmt.tryBlock, ctx)
        ) as IrBlockStatement,
        catchClause: stmt.catchClause
          ? {
              ...stmt.catchClause,
              body: flattenStatement(
                processStatement(stmt.catchClause.body, ctx)
              ) as IrBlockStatement,
            }
          : undefined,
        finallyBlock: stmt.finallyBlock
          ? (flattenStatement(
              processStatement(stmt.finallyBlock, ctx)
            ) as IrBlockStatement)
          : undefined,
      };

    case "returnStatement":
      if (
        stmt.expression &&
        stmt.expression.kind === "yield" &&
        !stmt.expression.delegate
      ) {
        const tempName = allocateYieldTempName(ctx);
        return [
          createYieldStatement(
            stmt.expression,
            { kind: "identifierPattern", name: tempName },
            stmt.expression.inferredType
          ),
          createGeneratorReturnStatement({
            kind: "identifier",
            name: tempName,
          }),
        ];
      }
      // Check for yield in return expression
      if (stmt.expression && containsYield(stmt.expression)) {
        emitUnsupportedYieldDiagnostic(
          ctx,
          "return expression",
          stmt.expression.sourceSpan
        );
      }
      // Transform return statements in generators to IrGeneratorReturnStatement
      // This captures the return value for generators with TReturn
      // The emitter will emit: __returnValue = expr; yield break;
      return createGeneratorReturnStatement(stmt.expression);

    case "throwStatement":
      if (stmt.expression.kind === "yield" && !stmt.expression.delegate) {
        const tempName = allocateYieldTempName(ctx);
        return [
          createYieldStatement(
            stmt.expression,
            { kind: "identifierPattern", name: tempName },
            stmt.expression.inferredType
          ),
          {
            kind: "throwStatement",
            expression: {
              kind: "identifier",
              name: tempName,
            },
          },
        ];
      }
      // Check for yield in throw expression
      if (containsYield(stmt.expression)) {
        emitUnsupportedYieldDiagnostic(
          ctx,
          "throw expression",
          stmt.expression.sourceSpan
        );
      }
      return stmt;

    default:
      return stmt;
  }
};

/**
 * Type guard to check if a result is a single statement (has 'kind' property).
 */
const isSingleStatement = (
  result: IrStatement | readonly IrStatement[]
): result is IrStatement => {
  return "kind" in result && typeof result.kind === "string";
};

/**
 * Flatten a statement result to a single statement (wrap in block if needed).
 */
const flattenStatement = (
  result: IrStatement | readonly IrStatement[]
): IrStatement => {
  if (isSingleStatement(result)) {
    return result;
  }
  // result is now readonly IrStatement[]
  if (result.length === 1 && result[0] !== undefined) {
    return result[0];
  }
  return {
    kind: "blockStatement",
    statements: [...result],
  };
};

/**
 * Process statements in non-generator functions (just recurse into nested generators).
 */
const processNonGeneratorStatement = (
  stmt: IrStatement,
  ctx: LoweringContext
): IrStatement => {
  switch (stmt.kind) {
    case "functionDeclaration":
      if (stmt.isGenerator) {
        const generatorCtx: LoweringContext = {
          ...ctx,
          inGenerator: true,
        };
        return {
          ...stmt,
          body: flattenStatement(
            processStatement(stmt.body, generatorCtx)
          ) as IrBlockStatement,
        };
      }
      return {
        ...stmt,
        body: flattenStatement(
          processStatement(stmt.body, ctx)
        ) as IrBlockStatement,
      };

    case "classDeclaration":
      return {
        ...stmt,
        members: stmt.members.map((m) => processClassMember(m, ctx)),
      };

    case "blockStatement":
      return {
        ...stmt,
        statements: stmt.statements.map((s) =>
          processNonGeneratorStatement(s, ctx)
        ),
      };

    case "ifStatement":
      return {
        ...stmt,
        thenStatement: processNonGeneratorStatement(stmt.thenStatement, ctx),
        elseStatement: stmt.elseStatement
          ? processNonGeneratorStatement(stmt.elseStatement, ctx)
          : undefined,
      };

    case "whileStatement":
      return {
        ...stmt,
        body: processNonGeneratorStatement(stmt.body, ctx),
      };

    case "forStatement":
      // Only process the body - initializer can't contain nested generator functions
      return {
        ...stmt,
        body: processNonGeneratorStatement(stmt.body, ctx),
      };

    case "forOfStatement":
      return {
        ...stmt,
        body: processNonGeneratorStatement(stmt.body, ctx),
      };

    case "switchStatement":
      return {
        ...stmt,
        cases: stmt.cases.map((c) => ({
          ...c,
          statements: c.statements.map((s) =>
            processNonGeneratorStatement(s, ctx)
          ),
        })),
      };

    case "tryStatement":
      return {
        ...stmt,
        tryBlock: processNonGeneratorStatement(
          stmt.tryBlock,
          ctx
        ) as IrBlockStatement,
        catchClause: stmt.catchClause
          ? {
              ...stmt.catchClause,
              body: processNonGeneratorStatement(
                stmt.catchClause.body,
                ctx
              ) as IrBlockStatement,
            }
          : undefined,
        finallyBlock: stmt.finallyBlock
          ? (processNonGeneratorStatement(
              stmt.finallyBlock,
              ctx
            ) as IrBlockStatement)
          : undefined,
      };

    default:
      return stmt;
  }
};

/**
 * Process class members, looking for generator methods.
 */
const processClassMember = (
  member: IrClassMember,
  ctx: LoweringContext
): IrClassMember => {
  if (member.kind === "methodDeclaration" && member.body) {
    if (member.isGenerator) {
      const generatorCtx: LoweringContext = {
        ...ctx,
        inGenerator: true,
      };
      return {
        ...member,
        body: flattenStatement(
          processStatement(member.body, generatorCtx)
        ) as IrBlockStatement,
      };
    }
    return {
      ...member,
      body: flattenStatement(
        processStatement(member.body, ctx)
      ) as IrBlockStatement,
    };
  }
  if (member.kind === "constructorDeclaration" && member.body) {
    return {
      ...member,
      body: flattenStatement(
        processStatement(member.body, ctx)
      ) as IrBlockStatement,
    };
  }
  return member;
};

/**
 * Process a module, transforming yield expressions in generators.
 */
const processModule = (
  module: IrModule
): { module: IrModule; diagnostics: readonly Diagnostic[] } => {
  const ctx: LoweringContext = {
    filePath: module.filePath,
    diagnostics: [],
    inGenerator: false,
    yieldTempCounter: 0,
  };

  const processedBody = module.body.map((stmt) => {
    if (stmt.kind === "functionDeclaration" && stmt.isGenerator) {
      const generatorCtx: LoweringContext = {
        ...ctx,
        inGenerator: true,
      };
      return {
        ...stmt,
        body: flattenStatement(
          processStatement(stmt.body, generatorCtx)
        ) as IrBlockStatement,
      };
    }
    return processNonGeneratorStatement(stmt, ctx);
  });

  const processedExports = module.exports.map((exp) => {
    if (exp.kind === "declaration") {
      if (
        exp.declaration.kind === "functionDeclaration" &&
        exp.declaration.isGenerator
      ) {
        const generatorCtx: LoweringContext = {
          ...ctx,
          inGenerator: true,
        };
        return {
          ...exp,
          declaration: {
            ...exp.declaration,
            body: flattenStatement(
              processStatement(exp.declaration.body, generatorCtx)
            ) as IrBlockStatement,
          },
        };
      }
      return {
        ...exp,
        declaration: processNonGeneratorStatement(exp.declaration, ctx),
      };
    }
    return exp;
  });

  return {
    module: {
      ...module,
      body: processedBody,
      exports: processedExports,
    },
    diagnostics: ctx.diagnostics,
  };
};

/**
 * Run yield lowering pass on all modules.
 *
 * This pass transforms yield expressions in generator functions into
 * IrYieldStatement nodes that the emitter can directly consume.
 *
 * HARD GATE: If any diagnostics are returned, the emitter MUST NOT run.
 */
export const runYieldLoweringPass = (
  modules: readonly IrModule[]
): YieldLoweringResult => {
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
