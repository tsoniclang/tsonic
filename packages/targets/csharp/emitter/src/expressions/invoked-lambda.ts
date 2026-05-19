import { identifierType } from "../core/format/backend-ast/builders.js";
import type {
  CSharpBlockStatementAst,
  CSharpExpressionAst,
  CSharpLambdaParameterAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import type { EmitterContext } from "../types.js";
import { buildDelegateType } from "./structural-adaptation-types.js";

const requiresAsyncContext = (node: unknown): boolean => {
  if (node === null || node === undefined) {
    return false;
  }

  if (Array.isArray(node)) {
    return node.some((item) => requiresAsyncContext(item));
  }

  if (typeof node !== "object") {
    return false;
  }

  const record = node as Record<string, unknown>;
  const kind = typeof record.kind === "string" ? record.kind : undefined;

  if (kind === "awaitExpression") {
    return true;
  }

  if (kind === "foreachStatement" && record.isAwait === true) {
    return true;
  }

  if (kind === "lambdaExpression" || kind === "localFunctionStatement") {
    return false;
  }

  return Object.entries(record).some(([key, value]) => {
    if (key === "kind") {
      return false;
    }
    return requiresAsyncContext(value);
  });
};

export const buildInvokedLambdaExpressionAst = (opts: {
  readonly parameters: readonly CSharpLambdaParameterAst[];
  readonly parameterTypes: readonly CSharpTypeAst[];
  readonly body: CSharpExpressionAst | CSharpBlockStatementAst;
  readonly arguments: readonly CSharpExpressionAst[];
  readonly returnType: CSharpTypeAst;
  readonly context: Pick<EmitterContext, "isAsync">;
}): CSharpExpressionAst => {
  const {
    parameters,
    parameterTypes,
    body,
    arguments: args,
    returnType,
    context,
  } = opts;

  const needsAsyncLambda = requiresAsyncContext(body);
  if (needsAsyncLambda && !context.isAsync) {
    throw new Error(
      "ICE: awaited expression-lambda IIFE reached the emitter in a non-async context."
    );
  }

  const delegateReturnType = needsAsyncLambda
    ? identifierType("global::System.Threading.Tasks.Task", [returnType])
    : returnType;

  const lambdaAst: CSharpExpressionAst = {
    kind: "lambdaExpression",
    isAsync: needsAsyncLambda,
    parameters,
    body,
  };

  const invocationAst: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "parenthesizedExpression",
      expression: {
        kind: "castExpression",
        type: buildDelegateType(parameterTypes, delegateReturnType),
        expression: {
          kind: "parenthesizedExpression",
          expression: lambdaAst,
        },
      },
    },
    arguments: args,
  };

  return needsAsyncLambda
    ? {
        kind: "awaitExpression",
        expression: invocationAst,
      }
    : invocationAst;
};

export const blockRequiresAsyncContext = (
  statements: readonly CSharpStatementAst[]
): boolean => requiresAsyncContext(statements);
