/**
 * Arrow Return Finalization Pass
 *
 * For expression-bodied arrow functions without explicit return type,
 * this pass infers the return type from the body expression's inferredType.
 *
 * This pass runs AFTER numeric proof pass, so that the body expression's
 * inferredType has been finalized with proper numeric kinds.
 *
 * Example:
 *   xs.map(x => x + 1)
 *   - x is inferred as number from contextual type
 *   - x + 1 has inferredType: primitiveType("number")
 *   - Arrow's returnType is set to primitiveType("number")
 */

import {
  IrModule,
  IrStatement,
  IrExpression,
  IrBlockStatement,
  IrArrowFunctionExpression,
  IrFunctionExpression,
  IrParameter,
  IrClassMember,
} from "../types.js";

/**
 * Result of arrow return finalization pass
 */
export type ArrowReturnFinalizationResult = {
  readonly ok: true;
  readonly modules: readonly IrModule[];
};

/**
 * Run arrow return finalization pass on modules
 */
export const runArrowReturnFinalizationPass = (
  modules: readonly IrModule[]
): ArrowReturnFinalizationResult => {
  const processedModules = modules.map(processModule);
  return { ok: true, modules: processedModules };
};

/**
 * Process a single module
 */
const processModule = (module: IrModule): IrModule => ({
  ...module,
  body: module.body.map(processStatement),
  exports: module.exports.map((exp) => {
    switch (exp.kind) {
      case "declaration":
        return {
          ...exp,
          declaration: processStatement(exp.declaration),
        };
      case "default":
        return {
          ...exp,
          expression: processExpression(exp.expression),
        };
      case "named":
      case "reexport":
        return exp;
      default:
        return exp;
    }
  }),
});

/**
 * Process a statement, recursively handling nested expressions
 */
const processStatement = (stmt: IrStatement): IrStatement => {
  switch (stmt.kind) {
    case "variableDeclaration":
      return {
        ...stmt,
        declarations: stmt.declarations.map((decl) => ({
          ...decl,
          initializer: decl.initializer
            ? processExpression(decl.initializer)
            : undefined,
        })),
      };

    case "functionDeclaration":
      return {
        ...stmt,
        body: processBlockStatement(stmt.body),
      };

    case "classDeclaration":
      return {
        ...stmt,
        members: stmt.members.map(processClassMember),
      };

    case "interfaceDeclaration":
      return stmt;

    case "typeAliasDeclaration":
      return stmt;

    case "expressionStatement":
      return {
        ...stmt,
        expression: processExpression(stmt.expression),
      };

    case "returnStatement":
      return {
        ...stmt,
        expression: stmt.expression
          ? processExpression(stmt.expression)
          : undefined,
      };

    case "ifStatement":
      return {
        ...stmt,
        condition: processExpression(stmt.condition),
        thenStatement: processStatement(stmt.thenStatement),
        elseStatement: stmt.elseStatement
          ? processStatement(stmt.elseStatement)
          : undefined,
      };

    case "blockStatement":
      return processBlockStatement(stmt);

    case "forStatement":
      return {
        ...stmt,
        initializer: stmt.initializer
          ? "kind" in stmt.initializer &&
            stmt.initializer.kind === "variableDeclaration"
            ? (processStatement(stmt.initializer) as typeof stmt.initializer)
            : processExpression(stmt.initializer as IrExpression)
          : undefined,
        condition: stmt.condition
          ? processExpression(stmt.condition)
          : undefined,
        update: stmt.update ? processExpression(stmt.update) : undefined,
        body: processStatement(stmt.body),
      };

    case "forOfStatement":
      return {
        ...stmt,
        expression: processExpression(stmt.expression),
        body: processStatement(stmt.body),
      };

    case "whileStatement":
      return {
        ...stmt,
        condition: processExpression(stmt.condition),
        body: processStatement(stmt.body),
      };

    case "switchStatement":
      return {
        ...stmt,
        expression: processExpression(stmt.expression),
        cases: stmt.cases.map((c) => ({
          ...c,
          test: c.test ? processExpression(c.test) : undefined,
          statements: c.statements.map(processStatement),
        })),
      };

    case "throwStatement":
      return {
        ...stmt,
        expression: processExpression(stmt.expression),
      };

    case "tryStatement":
      return {
        ...stmt,
        tryBlock: processBlockStatement(stmt.tryBlock),
        catchClause: stmt.catchClause
          ? {
              ...stmt.catchClause,
              body: processBlockStatement(stmt.catchClause.body),
            }
          : undefined,
        finallyBlock: stmt.finallyBlock
          ? processBlockStatement(stmt.finallyBlock)
          : undefined,
      };

    case "yieldStatement":
      return {
        ...stmt,
        output: stmt.output ? processExpression(stmt.output) : undefined,
      };

    case "generatorReturnStatement":
      return {
        ...stmt,
        expression: stmt.expression
          ? processExpression(stmt.expression)
          : undefined,
      };

    case "breakStatement":
    case "continueStatement":
    case "emptyStatement":
      return stmt;

    default:
      return stmt;
  }
};

/**
 * Process a block statement
 */
const processBlockStatement = (block: IrBlockStatement): IrBlockStatement => ({
  ...block,
  statements: block.statements.map(processStatement),
});

/**
 * Process a class member
 */
const processClassMember = (member: IrClassMember): IrClassMember => {
  switch (member.kind) {
    case "methodDeclaration":
      return member.body
        ? {
            ...member,
            body: processBlockStatement(member.body),
          }
        : member;

    case "constructorDeclaration":
      return member.body
        ? {
            ...member,
            body: processBlockStatement(member.body),
          }
        : member;

    case "propertyDeclaration":
      return member.initializer
        ? {
            ...member,
            initializer: processExpression(member.initializer),
          }
        : member;

    default:
      return member;
  }
};

/**
 * Process an expression, handling arrow functions specially
 */
const processExpression = (expr: IrExpression): IrExpression => {
  switch (expr.kind) {
    case "arrowFunction":
      return processArrowFunction(expr);

    case "functionExpression":
      return processFunctionExpression(expr);

    case "array":
      return {
        ...expr,
        elements: expr.elements.map((el) =>
          el === undefined ? undefined : processExpression(el)
        ),
      };

    case "object":
      return {
        ...expr,
        properties: expr.properties.map((prop) => {
          if (prop.kind === "spread") {
            return {
              ...prop,
              expression: processExpression(prop.expression),
            };
          }
          return {
            ...prop,
            key:
              typeof prop.key === "string"
                ? prop.key
                : processExpression(prop.key),
            value: processExpression(prop.value),
          };
        }),
      };

    case "call":
      return {
        ...expr,
        callee: processExpression(expr.callee),
        arguments: expr.arguments.map((arg) =>
          arg.kind === "spread"
            ? { ...arg, expression: processExpression(arg.expression) }
            : processExpression(arg)
        ),
      };

    case "new":
      return {
        ...expr,
        callee: processExpression(expr.callee),
        arguments: expr.arguments.map((arg) =>
          arg.kind === "spread"
            ? { ...arg, expression: processExpression(arg.expression) }
            : processExpression(arg)
        ),
      };

    case "memberAccess":
      return {
        ...expr,
        object: processExpression(expr.object),
        property:
          typeof expr.property === "string"
            ? expr.property
            : processExpression(expr.property),
      };

    case "binary":
      return {
        ...expr,
        left: processExpression(expr.left),
        right: processExpression(expr.right),
      };

    case "logical":
      return {
        ...expr,
        left: processExpression(expr.left),
        right: processExpression(expr.right),
      };

    case "unary":
      return {
        ...expr,
        expression: processExpression(expr.expression),
      };

    case "update":
      return {
        ...expr,
        expression: processExpression(expr.expression),
      };

    case "conditional":
      return {
        ...expr,
        condition: processExpression(expr.condition),
        whenTrue: processExpression(expr.whenTrue),
        whenFalse: processExpression(expr.whenFalse),
      };

    case "assignment":
      return {
        ...expr,
        left:
          "kind" in expr.left && expr.left.kind !== undefined
            ? processExpression(expr.left as IrExpression)
            : expr.left,
        right: processExpression(expr.right),
      };

    case "templateLiteral":
      return {
        ...expr,
        expressions: expr.expressions.map(processExpression),
      };

    case "spread":
      return {
        ...expr,
        expression: processExpression(expr.expression),
      };

    case "await":
      return {
        ...expr,
        expression: processExpression(expr.expression),
      };

    case "yield":
      return {
        ...expr,
        expression: expr.expression
          ? processExpression(expr.expression)
          : undefined,
      };

    case "numericNarrowing":
      return {
        ...expr,
        expression: processExpression(expr.expression),
      };

    case "typeAssertion":
      return {
        ...expr,
        expression: processExpression(expr.expression),
      };

    case "trycast":
      return {
        ...expr,
        expression: processExpression(expr.expression),
      };

    // Leaf expressions - no recursion needed
    case "literal":
    case "identifier":
    case "this":
      return expr;

    default:
      return expr;
  }
};

/**
 * Process arrow function - finalize return type from body if needed
 */
const processArrowFunction = (
  expr: IrArrowFunctionExpression
): IrArrowFunctionExpression => {
  // Process nested expressions in parameters (default values)
  const processedParams = expr.parameters.map(processParameter);

  // Process the body
  const processedBody =
    expr.body.kind === "blockStatement"
      ? processBlockStatement(expr.body)
      : processExpression(expr.body);

  // If returnType is already set (explicit annotation), keep it
  if (expr.returnType !== undefined) {
    return {
      ...expr,
      parameters: processedParams,
      body: processedBody,
    };
  }

  // For expression-bodied arrows without explicit return type,
  // infer return type from body's inferredType
  if (processedBody.kind !== "blockStatement") {
    const bodyInferredType = processedBody.inferredType;
    if (bodyInferredType !== undefined) {
      return {
        ...expr,
        parameters: processedParams,
        body: processedBody,
        returnType: bodyInferredType,
      };
    }
  }

  // Block-bodied arrows without explicit return type:
  // The escape hatch validation (TSN7430) should have caught this.
  // If we reach here, just return the processed arrow without returnType.
  return {
    ...expr,
    parameters: processedParams,
    body: processedBody,
  };
};

/**
 * Process function expression
 */
const processFunctionExpression = (
  expr: IrFunctionExpression
): IrFunctionExpression => ({
  ...expr,
  parameters: expr.parameters.map(processParameter),
  body: processBlockStatement(expr.body),
});

/**
 * Process a parameter (handle default values)
 */
const processParameter = (param: IrParameter): IrParameter => ({
  ...param,
  initializer: param.initializer
    ? processExpression(param.initializer)
    : undefined,
});
