/**
 * Yield Statement Lowering -- Simple Statement Forms
 *
 * Handles yield lowering for expression statements, variable declarations,
 * block statements, if statements, and while statements.
 */
import { IrStatement, IrExpression } from "../types.js";
import {
  type LoweringContext,
  containsYield,
  countYields,
  createYieldStatement,
  toReceivePattern,
  emitUnsupportedYieldDiagnostic,
  allocateYieldTempName,
  createTempVariableDeclaration,
  flattenStatement,
} from "./yield-lowering-helpers.js";
import {
  lowerExpressionWithYields,
  lowerMemberAccessAssignmentWithYields,
} from "./yield-expression-lowering.js";

/**
 * Process an expression statement containing yield.
 */
export const processExpressionStatement = (
  stmt: Extract<IrStatement, { kind: "expressionStatement" }>,
  ctx: LoweringContext
): IrStatement | readonly IrStatement[] => {
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
};

/**
 * Process a variable declaration containing yield.
 */
export const processVariableDeclaration = (
  stmt: Extract<IrStatement, { kind: "variableDeclaration" }>,
  ctx: LoweringContext
): IrStatement | readonly IrStatement[] => {
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
};

/**
 * Process an if statement containing yield.
 */
export const processIfStatement = (
  stmt: Extract<IrStatement, { kind: "ifStatement" }>,
  ctx: LoweringContext,
  processStatement: (
    s: IrStatement,
    c: LoweringContext
  ) => IrStatement | readonly IrStatement[]
): IrStatement | readonly IrStatement[] => {
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
};

/**
 * Process a while statement containing yield.
 */
export const processWhileStatement = (
  stmt: Extract<IrStatement, { kind: "whileStatement" }>,
  ctx: LoweringContext,
  processStatement: (
    s: IrStatement,
    c: LoweringContext
  ) => IrStatement | readonly IrStatement[]
): IrStatement | readonly IrStatement[] => {
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
};
