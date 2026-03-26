import { IrExpression, IrStatement } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { lowerPatternAst } from "../../patterns.js";
import { allocateLocalName } from "../../core/format/local-names.js";
import type {
  CSharpStatementAst,
  CSharpExpressionAst,
} from "../../core/format/backend-ast/types.js";

const getDirectYieldExpectedType = (
  context: EmitterContext
): IrExpression["inferredType"] | undefined => {
  const returnType = context.returnType;
  if (!returnType || returnType.kind !== "referenceType") {
    return undefined;
  }

  switch (returnType.name) {
    case "Iterable":
    case "IterableIterator":
    case "AsyncIterable":
    case "AsyncIterableIterator":
      return returnType.typeArguments?.[0];
    default:
      return undefined;
  }
};

export const emitYieldExpressionAst = (
  expr: Extract<IrExpression, { kind: "yield" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  let currentContext = context;
  const parts: CSharpStatementAst[] = [];

  if (expr.delegate) {
    if (expr.expression) {
      const [delegateAst, newContext] = emitExpressionAst(
        expr.expression,
        currentContext
      );
      currentContext = newContext;
      const itemAlloc = allocateLocalName("item", currentContext);
      currentContext = itemAlloc.context;
      parts.push({
        kind: "foreachStatement",
        isAwait: currentContext.isAsync,
        type: { kind: "varType" },
        identifier: itemAlloc.emittedName,
        expression: delegateAst,
        body: {
          kind: "yieldStatement",
          isBreak: false,
          expression: {
            kind: "identifierExpression",
            identifier: itemAlloc.emittedName,
          },
        },
      });
    }
  } else {
    if (expr.expression) {
      const directYieldExpectedType = getDirectYieldExpectedType(currentContext);
      const [valueAst, newContext] = emitExpressionAst(
        expr.expression,
        currentContext,
        directYieldExpectedType
      );
      currentContext = newContext;
      const exchangeVar = currentContext.generatorExchangeVar;
      if (!exchangeVar) {
        parts.push({
          kind: "yieldStatement",
          isBreak: false,
          expression: valueAst,
        });
        return [parts, currentContext];
      }
      parts.push({
        kind: "expressionStatement",
        expression: {
          kind: "assignmentExpression",
          operatorToken: "=",
          left: {
            kind: "memberAccessExpression",
            expression: {
              kind: "identifierExpression",
              identifier: exchangeVar,
            },
            memberName: "Output",
          },
          right: valueAst,
        },
      });
      parts.push({
        kind: "yieldStatement",
        isBreak: false,
        expression: {
          kind: "identifierExpression",
          identifier: exchangeVar,
        },
      });
    } else {
      const exchangeVar = currentContext.generatorExchangeVar;
      parts.push({
        kind: "yieldStatement",
        isBreak: false,
        expression: exchangeVar
          ? {
              kind: "identifierExpression",
              identifier: exchangeVar,
            }
          : undefined,
      });
    }
  }

  return [parts, currentContext];
};

export const emitYieldStatementAst = (
  stmt: Extract<IrStatement, { kind: "yieldStatement" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  let currentContext = context;
  const parts: CSharpStatementAst[] = [];

  if (stmt.delegate) {
    if (stmt.output) {
      const [delegateAst, newContext] = emitExpressionAst(
        stmt.output,
        currentContext
      );
      currentContext = newContext;
      const itemAlloc = allocateLocalName("item", currentContext);
      currentContext = itemAlloc.context;
      parts.push({
        kind: "foreachStatement",
        isAwait: currentContext.isAsync,
        type: { kind: "varType" },
        identifier: itemAlloc.emittedName,
        expression: delegateAst,
        body: {
          kind: "yieldStatement",
          isBreak: false,
          expression: {
            kind: "identifierExpression",
            identifier: itemAlloc.emittedName,
          },
        },
      });
    }
  } else {
    if (stmt.output) {
      const directYieldExpectedType = getDirectYieldExpectedType(currentContext);
      const [valueAst, newContext] = emitExpressionAst(
        stmt.output,
        currentContext,
        directYieldExpectedType
      );
      currentContext = newContext;
      const exchangeVar = currentContext.generatorExchangeVar;
      if (!exchangeVar) {
        parts.push({
          kind: "yieldStatement",
          isBreak: false,
          expression: valueAst,
        });
        return [parts, currentContext];
      }
      parts.push({
        kind: "expressionStatement",
        expression: {
          kind: "assignmentExpression",
          operatorToken: "=",
          left: {
            kind: "memberAccessExpression",
            expression: {
              kind: "identifierExpression",
              identifier: exchangeVar,
            },
            memberName: "Output",
          },
          right: valueAst,
        },
      });
    }
    const exchangeVar = currentContext.generatorExchangeVar;
    parts.push({
      kind: "yieldStatement",
      isBreak: false,
      expression: exchangeVar
        ? {
            kind: "identifierExpression",
            identifier: exchangeVar,
          }
        : undefined,
    });

    if (stmt.receiveTarget && exchangeVar) {
      const inputExpr: CSharpExpressionAst = {
        kind: "parenthesizedExpression",
        expression: {
          kind: "binaryExpression",
          operatorToken: "??",
          left: {
            kind: "memberAccessExpression",
            expression: {
              kind: "identifierExpression",
              identifier: exchangeVar,
            },
            memberName: "Input",
          },
          right: {
            kind: "suppressNullableWarningExpression",
            expression: { kind: "defaultExpression" },
          },
        },
      };
      const lowered = lowerPatternAst(
        stmt.receiveTarget,
        inputExpr,
        stmt.receivedType,
        currentContext
      );
      parts.push(...lowered.statements);
      currentContext = lowered.context;
    }
  }

  return [parts, currentContext];
};

export const emitGeneratorReturnStatementAst = (
  stmt: Extract<IrStatement, { kind: "generatorReturnStatement" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  let currentContext = context;
  const returnVar = currentContext.generatorReturnValueVar ?? "__returnValue";
  const parts: CSharpStatementAst[] = [];

  if (stmt.expression) {
    const [valueAst, newContext] = emitExpressionAst(
      stmt.expression,
      currentContext
    );
    currentContext = newContext;
    parts.push({
      kind: "expressionStatement",
      expression: {
        kind: "assignmentExpression",
        operatorToken: "=",
        left: { kind: "identifierExpression", identifier: returnVar },
        right: valueAst,
      },
    });
  }

  parts.push({ kind: "yieldStatement", isBreak: true });

  return [parts, currentContext];
};
