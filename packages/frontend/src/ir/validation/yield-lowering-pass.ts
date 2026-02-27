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
 * - `const x = cond ? (yield a) : (yield b)` → temp + branch-lowered yields
 *
 * Unsupported patterns (emit TSN6101 diagnostic):
 * - `(yield x) = y` - yield on assignment target side
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

type LoweredExpressionWithYields = {
  readonly prelude: readonly IrStatement[];
  readonly expression: IrExpression;
};

/**
 * Lower yield expressions that appear inside larger expression trees into
 * leading IrYieldStatement nodes plus a rewritten expression that references
 * temp identifiers.
 *
 * This preserves left-to-right evaluation order for supported expression forms.
 * Unsupported forms emit TSN6101 and return undefined.
 */
const lowerExpressionWithYields = (
  expression: IrExpression,
  ctx: LoweringContext,
  position: string,
  expectedType?: IrType
): LoweredExpressionWithYields | undefined => {
  const lower = (
    expr: IrExpression
  ): LoweredExpressionWithYields | undefined => {
    if (!containsYield(expr)) {
      return { prelude: [], expression: expr };
    }

    switch (expr.kind) {
      case "yield": {
        const tempName = allocateYieldTempName(ctx);
        return {
          prelude: [
            createYieldStatement(
              expr,
              { kind: "identifierPattern", name: tempName },
              expr.inferredType
            ),
          ],
          expression: { kind: "identifier", name: tempName },
        };
      }

      case "unary":
      case "update":
      case "await":
      case "spread":
      case "numericNarrowing":
      case "typeAssertion":
      case "asinterface":
      case "trycast": {
        const lowered = lower(expr.expression);
        if (!lowered) return undefined;
        return {
          prelude: lowered.prelude,
          expression: {
            ...expr,
            expression: lowered.expression,
          },
        };
      }

      case "stackalloc": {
        const loweredSize = lower(expr.size);
        if (!loweredSize) return undefined;
        return {
          prelude: loweredSize.prelude,
          expression: {
            ...expr,
            size: loweredSize.expression,
          },
        };
      }

      case "binary":
      case "logical": {
        const loweredLeft = lower(expr.left);
        if (!loweredLeft) return undefined;
        const loweredRight = lower(expr.right);
        if (!loweredRight) return undefined;
        return {
          prelude: [...loweredLeft.prelude, ...loweredRight.prelude],
          expression: {
            ...expr,
            left: loweredLeft.expression,
            right: loweredRight.expression,
          },
        };
      }

      case "assignment": {
        if (
          expr.left.kind !== "identifierPattern" &&
          expr.left.kind !== "arrayPattern" &&
          expr.left.kind !== "objectPattern" &&
          containsYield(expr.left)
        ) {
          emitUnsupportedYieldDiagnostic(ctx, `${position} assignment target`);
          return undefined;
        }
        const loweredRight = lower(expr.right);
        if (!loweredRight) return undefined;
        return {
          prelude: loweredRight.prelude,
          expression: {
            ...expr,
            right: loweredRight.expression,
          },
        };
      }

      case "memberAccess": {
        const loweredObject = lower(expr.object);
        if (!loweredObject) return undefined;
        let loweredProperty: IrExpression | string = expr.property;
        let propertyPrelude: readonly IrStatement[] = [];
        if (typeof expr.property !== "string") {
          const loweredPropExpr = lower(expr.property);
          if (!loweredPropExpr) return undefined;
          loweredProperty = loweredPropExpr.expression;
          propertyPrelude = loweredPropExpr.prelude;
        }
        return {
          prelude: [...loweredObject.prelude, ...propertyPrelude],
          expression: {
            ...expr,
            object: loweredObject.expression,
            property: loweredProperty,
          },
        };
      }

      case "call":
      case "new": {
        const loweredCallee = lower(expr.callee);
        if (!loweredCallee) return undefined;
        const preludes: IrStatement[] = [...loweredCallee.prelude];
        const loweredArgs: (
          | IrExpression
          | { kind: "spread"; expression: IrExpression }
        )[] = [];
        for (const argument of expr.arguments) {
          if (argument.kind === "spread") {
            const loweredSpreadExpr = lower(argument.expression);
            if (!loweredSpreadExpr) return undefined;
            preludes.push(...loweredSpreadExpr.prelude);
            loweredArgs.push({
              kind: "spread",
              expression: loweredSpreadExpr.expression,
            });
          } else {
            const loweredArg = lower(argument);
            if (!loweredArg) return undefined;
            preludes.push(...loweredArg.prelude);
            loweredArgs.push(loweredArg.expression);
          }
        }
        return {
          prelude: preludes,
          expression: {
            ...expr,
            callee: loweredCallee.expression,
            arguments: loweredArgs,
          },
        };
      }

      case "array": {
        const preludes: IrStatement[] = [];
        const loweredElements: (
          | IrExpression
          | { kind: "spread"; expression: IrExpression }
          | undefined
        )[] = [];
        for (const element of expr.elements) {
          if (!element) {
            loweredElements.push(undefined);
            continue;
          }
          if (element.kind === "spread") {
            const loweredSpreadExpr = lower(element.expression);
            if (!loweredSpreadExpr) return undefined;
            preludes.push(...loweredSpreadExpr.prelude);
            loweredElements.push({
              kind: "spread",
              expression: loweredSpreadExpr.expression,
            });
            continue;
          }
          const loweredElement = lower(element);
          if (!loweredElement) return undefined;
          preludes.push(...loweredElement.prelude);
          loweredElements.push(loweredElement.expression);
        }
        return {
          prelude: preludes,
          expression: {
            ...expr,
            elements: loweredElements,
          },
        };
      }

      case "object": {
        const preludes: IrStatement[] = [];
        const loweredProperties = [];
        for (const property of expr.properties) {
          if (property.kind === "spread") {
            const loweredSpreadExpr = lower(property.expression);
            if (!loweredSpreadExpr) return undefined;
            preludes.push(...loweredSpreadExpr.prelude);
            loweredProperties.push({
              kind: "spread" as const,
              expression: loweredSpreadExpr.expression,
            });
            continue;
          }

          let loweredKey: string | IrExpression = property.key;
          if (typeof property.key !== "string") {
            const loweredKeyExpr = lower(property.key);
            if (!loweredKeyExpr) return undefined;
            preludes.push(...loweredKeyExpr.prelude);
            loweredKey = loweredKeyExpr.expression;
          }

          const loweredValue = lower(property.value);
          if (!loweredValue) return undefined;
          preludes.push(...loweredValue.prelude);
          loweredProperties.push({
            kind: "property" as const,
            key: loweredKey,
            value: loweredValue.expression,
            shorthand: property.shorthand,
          });
        }
        return {
          prelude: preludes,
          expression: {
            ...expr,
            properties: loweredProperties,
          },
        };
      }

      case "templateLiteral": {
        const preludes: IrStatement[] = [];
        const loweredExpressions: IrExpression[] = [];
        for (const templateExpr of expr.expressions) {
          const loweredTemplateExpr = lower(templateExpr);
          if (!loweredTemplateExpr) return undefined;
          preludes.push(...loweredTemplateExpr.prelude);
          loweredExpressions.push(loweredTemplateExpr.expression);
        }
        return {
          prelude: preludes,
          expression: {
            ...expr,
            expressions: loweredExpressions,
          },
        };
      }

      case "conditional": {
        const loweredCondition = lower(expr.condition);
        if (!loweredCondition) return undefined;

        const loweredWhenTrue = lower(expr.whenTrue);
        if (!loweredWhenTrue) return undefined;

        const loweredWhenFalse = lower(expr.whenFalse);
        if (!loweredWhenFalse) return undefined;

        const tempType =
          expr.inferredType ??
          expectedType ??
          loweredWhenTrue.expression.inferredType ??
          loweredWhenFalse.expression.inferredType;

        if (!tempType) {
          emitUnsupportedYieldDiagnostic(
            ctx,
            `${position} conditional expression`,
            expr.sourceSpan
          );
          return undefined;
        }

        const tempName = allocateYieldTempName(ctx);
        const tempPattern: IrPattern = {
          kind: "identifierPattern",
          name: tempName,
        };

        const assignTrueStatement: IrStatement = {
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "=",
            left: tempPattern,
            right: loweredWhenTrue.expression,
          },
        };
        const assignFalseStatement: IrStatement = {
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "=",
            left: tempPattern,
            right: loweredWhenFalse.expression,
          },
        };

        return {
          prelude: [
            ...loweredCondition.prelude,
            {
              kind: "variableDeclaration",
              declarationKind: "let",
              isExported: false,
              declarations: [
                {
                  kind: "variableDeclarator",
                  name: tempPattern,
                  type: tempType,
                  initializer: { kind: "literal", value: undefined },
                },
              ],
            },
            {
              kind: "ifStatement",
              condition: loweredCondition.expression,
              thenStatement: {
                kind: "blockStatement",
                statements: [...loweredWhenTrue.prelude, assignTrueStatement],
              },
              elseStatement: {
                kind: "blockStatement",
                statements: [...loweredWhenFalse.prelude, assignFalseStatement],
              },
            },
          ],
          expression: { kind: "identifier", name: tempName },
        };
      }

      default:
        emitUnsupportedYieldDiagnostic(ctx, position, expr.sourceSpan);
        return undefined;
    }
  };

  return lower(expression);
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
        // Compound assignment (x += yield y) needs a temporary receive target,
        // then an explicit compound update statement.
        if (expr.operator !== "=") {
          if (
            expr.left.kind !== "identifierPattern" &&
            expr.left.kind !== "identifier"
          ) {
            emitUnsupportedYieldDiagnostic(
              ctx,
              "compound assignment to complex target",
              expr.right.sourceSpan
            );
            return stmt;
          }

          const tempName = allocateYieldTempName(ctx);
          const leftExpr =
            expr.left.kind === "identifierPattern"
              ? ({ kind: "identifier", name: expr.left.name } as const)
              : expr.left;

          return [
            createYieldStatement(
              expr.right,
              { kind: "identifierPattern", name: tempName },
              expr.right.inferredType
            ),
            {
              kind: "expressionStatement",
              expression: {
                ...expr,
                left: leftExpr,
                right: { kind: "identifier", name: tempName },
              },
            },
          ];
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
        const lowered = lowerExpressionWithYields(
          expr,
          ctx,
          "expression statement"
        );
        if (!lowered) {
          return stmt;
        }
        return [
          ...lowered.prelude,
          {
            ...stmt,
            expression: lowered.expression,
          },
        ];
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
          const lowered = lowerExpressionWithYields(
            decl.initializer,
            ctx,
            "variable initializer",
            decl.type ?? decl.initializer.inferredType
          );
          if (!lowered) {
            transformedDeclarations.push({
              kind: "variableDeclaration",
              declarationKind: stmt.declarationKind,
              declarations: [decl],
              isExported: false,
            });
            continue;
          }
          transformedDeclarations.push(...lowered.prelude);
          transformedDeclarations.push({
            kind: "variableDeclaration",
            declarationKind: stmt.declarationKind,
            declarations: [
              {
                ...decl,
                initializer: lowered.expression,
              },
            ],
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
      if (containsYield(stmt.condition)) {
        const loweredCondition = lowerExpressionWithYields(
          stmt.condition,
          ctx,
          "if condition"
        );
        if (!loweredCondition) {
          return {
            ...stmt,
            thenStatement: flattenStatement(
              processStatement(stmt.thenStatement, ctx)
            ),
            elseStatement: stmt.elseStatement
              ? flattenStatement(processStatement(stmt.elseStatement, ctx))
              : undefined,
          };
        }
        return [
          ...loweredCondition.prelude,
          {
            ...stmt,
            condition: loweredCondition.expression,
            thenStatement: flattenStatement(
              processStatement(stmt.thenStatement, ctx)
            ),
            elseStatement: stmt.elseStatement
              ? flattenStatement(processStatement(stmt.elseStatement, ctx))
              : undefined,
          },
        ];
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
      if (containsYield(stmt.condition)) {
        const loweredCondition = lowerExpressionWithYields(
          stmt.condition,
          ctx,
          "while condition"
        );
        if (!loweredCondition) {
          return {
            ...stmt,
            body: flattenStatement(processStatement(stmt.body, ctx)),
          };
        }
        const transformedBody = flattenStatement(
          processStatement(stmt.body, ctx)
        );
        const bodyStatements: IrStatement[] = [
          ...loweredCondition.prelude,
          {
            kind: "ifStatement",
            condition: {
              kind: "unary",
              operator: "!",
              expression: loweredCondition.expression,
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
      return {
        ...stmt,
        body: flattenStatement(processStatement(stmt.body, ctx)),
      };

    case "forStatement": {
      const leadingStatements: IrStatement[] = [];
      let initializer = stmt.initializer;

      if (initializer) {
        if (
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
        } else if (initializer.kind === "variableDeclaration") {
          const transformedDecls = initializer.declarations.map((decl) => {
            if (!decl.initializer || !containsYield(decl.initializer)) {
              return decl;
            }

            if (
              decl.initializer.kind === "yield" &&
              !decl.initializer.delegate
            ) {
              const tempName = allocateYieldTempName(ctx);
              leadingStatements.push(
                createYieldStatement(
                  decl.initializer,
                  { kind: "identifierPattern", name: tempName },
                  decl.type ?? decl.initializer.inferredType
                )
              );
              return {
                ...decl,
                initializer: {
                  kind: "identifier",
                  name: tempName,
                } as const,
              };
            }

            const loweredInitializer = lowerExpressionWithYields(
              decl.initializer,
              ctx,
              "for loop initializer",
              decl.type ?? decl.initializer.inferredType
            );
            if (!loweredInitializer) {
              return decl;
            }
            leadingStatements.push(...loweredInitializer.prelude);
            return {
              ...decl,
              initializer: loweredInitializer.expression,
            };
          });
          initializer = {
            ...initializer,
            declarations: transformedDecls,
          };
        } else if (containsYield(initializer)) {
          const loweredInitializer = lowerExpressionWithYields(
            initializer,
            ctx,
            "for loop initializer"
          );
          if (loweredInitializer) {
            leadingStatements.push(...loweredInitializer.prelude);
            initializer = loweredInitializer.expression;
          }
        }
      }

      const loweredCondition =
        stmt.condition && containsYield(stmt.condition)
          ? lowerExpressionWithYields(stmt.condition, ctx, "for loop condition")
          : undefined;
      const loweredUpdate =
        stmt.update && containsYield(stmt.update)
          ? lowerExpressionWithYields(stmt.update, ctx, "for loop update")
          : undefined;

      const transformedBody = flattenStatement(
        processStatement(stmt.body, ctx)
      );
      if (!loweredCondition && !loweredUpdate) {
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
      if (loweredUpdate) {
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
        const updateBodyStatements: IrStatement[] = [...loweredUpdate.prelude];
        if (!stmt.update || stmt.update.kind !== "yield") {
          updateBodyStatements.push({
            kind: "expressionStatement",
            expression: loweredUpdate.expression,
          });
        }
        bodyStatements.push({
          kind: "ifStatement",
          condition: {
            kind: "unary",
            operator: "!",
            expression: { kind: "identifier", name: updateFirstFlagName },
          },
          thenStatement: {
            kind: "blockStatement",
            statements: updateBodyStatements,
          },
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

      if (loweredCondition) {
        bodyStatements.push(...loweredCondition.prelude);
        bodyStatements.push({
          kind: "ifStatement",
          condition: {
            kind: "unary",
            operator: "!",
            expression: loweredCondition.expression,
          },
          thenStatement: { kind: "breakStatement" },
        });
      } else if (loweredUpdate && stmt.condition) {
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
        update: loweredUpdate ? undefined : stmt.update,
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
      if (containsYield(stmt.expression)) {
        const loweredExpression = lowerExpressionWithYields(
          stmt.expression,
          ctx,
          "for-of expression"
        );
        if (!loweredExpression) {
          return {
            ...stmt,
            body: flattenStatement(processStatement(stmt.body, ctx)),
          };
        }
        return [
          ...loweredExpression.prelude,
          {
            ...stmt,
            expression: loweredExpression.expression,
            body: flattenStatement(processStatement(stmt.body, ctx)),
          },
        ];
      }
      return {
        ...stmt,
        body: flattenStatement(processStatement(stmt.body, ctx)),
      };

    case "forInStatement":
      if (containsYield(stmt.expression)) {
        const loweredExpression = lowerExpressionWithYields(
          stmt.expression,
          ctx,
          "for-in expression"
        );
        if (!loweredExpression) {
          return {
            ...stmt,
            body: flattenStatement(processStatement(stmt.body, ctx)),
          };
        }
        return [
          ...loweredExpression.prelude,
          {
            ...stmt,
            expression: loweredExpression.expression,
            body: flattenStatement(processStatement(stmt.body, ctx)),
          },
        ];
      }
      return {
        ...stmt,
        body: flattenStatement(processStatement(stmt.body, ctx)),
      };

    case "switchStatement":
      if (containsYield(stmt.expression)) {
        const loweredExpression = lowerExpressionWithYields(
          stmt.expression,
          ctx,
          "switch expression"
        );
        if (!loweredExpression) {
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
        }
        return [
          ...loweredExpression.prelude,
          {
            ...stmt,
            expression: loweredExpression.expression,
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
      if (stmt.expression && containsYield(stmt.expression)) {
        const lowered = lowerExpressionWithYields(
          stmt.expression,
          ctx,
          "return expression"
        );
        if (!lowered) {
          return createGeneratorReturnStatement(stmt.expression);
        }
        return [
          ...lowered.prelude,
          createGeneratorReturnStatement(lowered.expression),
        ];
      }
      // Transform return statements in generators to IrGeneratorReturnStatement
      // This captures the return value for generators with TReturn
      // The emitter will emit: __returnValue = expr; yield break;
      return createGeneratorReturnStatement(stmt.expression);

    case "throwStatement":
      if (containsYield(stmt.expression)) {
        const lowered = lowerExpressionWithYields(
          stmt.expression,
          ctx,
          "throw expression"
        );
        if (!lowered) {
          return stmt;
        }
        return [
          ...lowered.prelude,
          {
            kind: "throwStatement",
            expression: lowered.expression,
          },
        ];
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
