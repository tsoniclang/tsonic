/**
 * Yield Statement Lowering -- Loop and Complex Statement Forms
 *
 * Handles yield lowering for for/forOf/forIn/switch/try/return/throw
 * statements.
 */
import {
  IrStatement,
  IrBlockStatement,
  IrVariableDeclarator,
} from "../types.js";
import {
  type LoweringContext,
  containsYield,
  createYieldStatement,
  toReceivePattern,
  createGeneratorReturnStatement,
  emitUnsupportedYieldDiagnostic,
  allocateYieldTempName,
  flattenStatement,
} from "./yield-lowering-helpers.js";
import {
  lowerExpressionWithYields,
  lowerMemberAccessAssignmentWithYields,
} from "./yield-expression-lowering.js";

/**
 * Process a for statement containing yield.
 */
export const processForStatement = (
  stmt: Extract<IrStatement, { kind: "forStatement" }>,
  ctx: LoweringContext,
  processStatement: (
    s: IrStatement,
    c: LoweringContext
  ) => IrStatement | readonly IrStatement[]
): IrStatement | readonly IrStatement[] => {
  const leadingStatements: IrStatement[] = [];
  let initializer = stmt.initializer;

  if (initializer) {
    if (
      initializer.kind === "assignment" &&
      initializer.operator === "=" &&
      ((initializer.right.kind === "yield" && !initializer.right.delegate) ||
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
        const loweredMemberAssignment = lowerMemberAccessAssignmentWithYields(
          initializer,
          ctx,
          {
            object: "for loop initializer target object",
            property: "for loop initializer target property",
            right: "for loop initializer value",
          }
        );
        if (!loweredMemberAssignment) {
          emitUnsupportedYieldDiagnostic(
            ctx,
            "for loop initializer",
            initializer.right.sourceSpan
          );
        } else {
          leadingStatements.push(...loweredMemberAssignment.leadingStatements);
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
      const transformedDecls = initializer.declarations.map(
        (decl: IrVariableDeclarator) => {
          if (!decl.initializer || !containsYield(decl.initializer)) {
            return decl;
          }

          if (decl.initializer.kind === "yield" && !decl.initializer.delegate) {
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
        }
      );
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

  const transformedBody = flattenStatement(processStatement(stmt.body, ctx));
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
};

/**
 * Process a for-of statement containing yield.
 */
export const processForOfStatement = (
  stmt: Extract<IrStatement, { kind: "forOfStatement" }>,
  ctx: LoweringContext,
  processStatement: (
    s: IrStatement,
    c: LoweringContext
  ) => IrStatement | readonly IrStatement[]
): IrStatement | readonly IrStatement[] => {
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
};

/**
 * Process a for-in statement containing yield.
 */
export const processForInStatement = (
  stmt: Extract<IrStatement, { kind: "forInStatement" }>,
  ctx: LoweringContext,
  processStatement: (
    s: IrStatement,
    c: LoweringContext
  ) => IrStatement | readonly IrStatement[]
): IrStatement | readonly IrStatement[] => {
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
};

/**
 * Process a switch statement containing yield.
 */
export const processSwitchStatement = (
  stmt: Extract<IrStatement, { kind: "switchStatement" }>,
  ctx: LoweringContext,
  processStatement: (
    s: IrStatement,
    c: LoweringContext
  ) => IrStatement | readonly IrStatement[]
): IrStatement | readonly IrStatement[] => {
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
};

/**
 * Process a try statement containing yield.
 */
export const processTryStatement = (
  stmt: Extract<IrStatement, { kind: "tryStatement" }>,
  ctx: LoweringContext,
  processStatement: (
    s: IrStatement,
    c: LoweringContext
  ) => IrStatement | readonly IrStatement[]
): IrStatement => ({
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
});

/**
 * Process a return statement containing yield.
 */
export const processReturnStatement = (
  stmt: Extract<IrStatement, { kind: "returnStatement" }>,
  ctx: LoweringContext
): IrStatement | readonly IrStatement[] => {
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
};

/**
 * Process a throw statement containing yield.
 */
export const processThrowStatement = (
  stmt: Extract<IrStatement, { kind: "throwStatement" }>,
  ctx: LoweringContext
): IrStatement | readonly IrStatement[] => {
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
};
