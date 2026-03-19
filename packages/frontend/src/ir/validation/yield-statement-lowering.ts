/**
 * Yield Statement Lowering
 *
 * Transforms yield expressions within generator function statements into
 * IrYieldStatement nodes. Handles all statement forms (expression-statements,
 * variable declarations, if/while/for/switch/try, return, throw).
 */
import { IrStatement, IrExpression, IrBlockStatement } from "../types.js";
import {
  type LoweringContext,
  containsYield,
  countYields,
  createYieldStatement,
  toReceivePattern,
  createGeneratorReturnStatement,
  emitUnsupportedYieldDiagnostic,
  allocateYieldTempName,
  createTempVariableDeclaration,
  flattenStatement,
} from "./yield-lowering-helpers.js";
import {
  lowerExpressionWithYields,
  lowerMemberAccessAssignmentWithYields,
} from "./yield-expression-lowering.js";
import { processNonGeneratorStatement } from "./yield-module-processing.js";

/**
 * Process a statement in a generator function body.
 * Returns the transformed statement(s) - may return multiple statements
 * when a single statement is split.
 */
export const processStatement = (
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
      if (expr.kind === "assignment") {
        if (
          expr.operator === "=" &&
          expr.left.kind === "memberAccess" &&
          ((expr.right.kind === "yield" && !expr.right.delegate) ||
            containsYield(expr.left))
        ) {
          const loweredMemberAssignment = lowerMemberAccessAssignmentWithYields(
            expr,
            ctx,
            {
              object: "assignment target object",
              property: "assignment target property",
              right: "assignment value",
            }
          );
          if (!loweredMemberAssignment) {
            return stmt;
          }
          return [
            ...loweredMemberAssignment.leadingStatements,
            {
              kind: "expressionStatement",
              expression: loweredMemberAssignment.loweredAssignment,
            },
          ];
        }

        if (expr.right.kind === "yield" && !expr.right.delegate) {
          // Compound assignment (x += yield y) needs a temporary receive target,
          // then an explicit compound update statement.
          if (expr.operator !== "=") {
            if (
              expr.left.kind !== "identifierPattern" &&
              expr.left.kind !== "identifier" &&
              expr.left.kind !== "memberAccess"
            ) {
              emitUnsupportedYieldDiagnostic(
                ctx,
                "compound assignment to complex target",
                expr.right.sourceSpan
              );
              return stmt;
            }

            if (
              expr.left.kind === "identifierPattern" ||
              expr.left.kind === "identifier"
            ) {
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

            const loweredObject = lowerExpressionWithYields(
              expr.left.object,
              ctx,
              "compound assignment target object",
              expr.left.object.inferredType
            );
            if (!loweredObject) {
              return stmt;
            }
            const objectTempName = allocateYieldTempName(ctx);
            const leadingStatements: IrStatement[] = [
              ...loweredObject.prelude,
              createTempVariableDeclaration(
                objectTempName,
                loweredObject.expression,
                loweredObject.expression.inferredType
              ),
            ];

            let propertyExpr: IrExpression | string = expr.left.property;
            if (typeof expr.left.property !== "string") {
              const loweredProperty = lowerExpressionWithYields(
                expr.left.property,
                ctx,
                "compound assignment target property",
                expr.left.property.inferredType
              );
              if (!loweredProperty) {
                return stmt;
              }
              leadingStatements.push(...loweredProperty.prelude);
              const propertyTempName = allocateYieldTempName(ctx);
              leadingStatements.push(
                createTempVariableDeclaration(
                  propertyTempName,
                  loweredProperty.expression,
                  loweredProperty.expression.inferredType
                )
              );
              propertyExpr = { kind: "identifier", name: propertyTempName };
            }

            const receiveTempName = allocateYieldTempName(ctx);
            return [
              ...leadingStatements,
              createYieldStatement(
                expr.right,
                { kind: "identifierPattern", name: receiveTempName },
                expr.right.inferredType
              ),
              {
                kind: "expressionStatement",
                expression: {
                  ...expr,
                  left: {
                    ...expr.left,
                    object: { kind: "identifier", name: objectTempName },
                    property: propertyExpr,
                  },
                  right: { kind: "identifier", name: receiveTempName },
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
          ((initializer.right.kind === "yield" &&
            !initializer.right.delegate) ||
            (initializer.left.kind === "memberAccess" &&
              containsYield(initializer.left)))
        ) {
          const receiveTarget = toReceivePattern(initializer.left);
          if (
            receiveTarget &&
            initializer.right.kind === "yield" &&
            !initializer.right.delegate
          ) {
            leadingStatements.push(
              createYieldStatement(
                initializer.right,
                receiveTarget,
                initializer.right.inferredType
              )
            );
            initializer = undefined;
          } else if (receiveTarget) {
            emitUnsupportedYieldDiagnostic(
              ctx,
              "for loop initializer",
              initializer.right.sourceSpan
            );
          } else if (initializer.left.kind === "memberAccess") {
            const loweredMemberAssignment =
              lowerMemberAccessAssignmentWithYields(initializer, ctx, {
                object: "for loop initializer target object",
                property: "for loop initializer target property",
                right: "for loop initializer value",
              });
            if (!loweredMemberAssignment) {
              emitUnsupportedYieldDiagnostic(
                ctx,
                "for loop initializer",
                initializer.right.sourceSpan
              );
            } else {
              leadingStatements.push(
                ...loweredMemberAssignment.leadingStatements
              );
              leadingStatements.push({
                kind: "expressionStatement",
                expression: loweredMemberAssignment.loweredAssignment,
              });
              initializer = undefined;
            }
          } else {
            emitUnsupportedYieldDiagnostic(
              ctx,
              "for loop initializer",
              initializer.right.sourceSpan
            );
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
