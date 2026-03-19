import { IrExpression } from "@tsonic/frontend";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../type-emitter.js";
import type {
  CSharpExpressionAst,
} from "../../core/format/backend-ast/types.js";
import { identifierExpression } from "../../core/format/backend-ast/builders.js";
import type { EmitterContext } from "../../types.js";
import {
  buildCompletedTaskAst,
  buildTaskRunInvocation,
  getTaskResultType,
} from "./call-promise-task-types.js";
import {
  getSequenceElementIrType,
  normalizePromiseChainResultIrType,
} from "./call-promise-ir-types.js";
import {
  buildPromiseRejectedExceptionAst,
  emitPromiseNormalizedTaskAst,
  getPromiseStaticMethod,
} from "./call-promise-normalization.js";

export const emitPromiseStaticCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | null => {
  const method = getPromiseStaticMethod(expr);
  if (!method) return null;

  let currentContext = context;
  const [outputTaskType, outputTaskContext] = emitTypeAst(
    expr.inferredType ?? {
      kind: "referenceType",
      name: "Promise",
      typeArguments: [{ kind: "referenceType", name: "object" }],
    },
    currentContext
  );
  currentContext = outputTaskContext;
  const outputResultType = getTaskResultType(outputTaskType);

  if (method === "resolve") {
    const argument = expr.arguments[0];
    if (!argument) {
      return [buildCompletedTaskAst(), currentContext];
    }

    const [valueAst, valueContext] = emitExpressionAst(
      argument,
      currentContext,
      argument.inferredType
    );
    currentContext = valueContext;
    const normalizedResultIrType = normalizePromiseChainResultIrType(
      argument.inferredType
    );
    let preferredResultTypeAst = outputResultType;
    if (normalizedResultIrType) {
      const [normalizedResultTypeAst, normalizedResultTypeContext] =
        emitTypeAst(normalizedResultIrType, currentContext);
      preferredResultTypeAst = normalizedResultTypeAst;
      currentContext = normalizedResultTypeContext;
    }
    return emitPromiseNormalizedTaskAst(
      valueAst,
      argument.inferredType,
      preferredResultTypeAst,
      currentContext
    );
  }

  if (method === "reject") {
    const reason = expr.arguments[0];
    let reasonAst: CSharpExpressionAst | undefined;
    if (reason) {
      [reasonAst, currentContext] = emitExpressionAst(
        reason,
        currentContext,
        reason.inferredType
      );
    }

    const exceptionAst = buildPromiseRejectedExceptionAst(reasonAst);
    return [
      {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: identifierExpression(
            "global::System.Threading.Tasks.Task"
          ),
          memberName: "FromException",
        },
        typeArguments: outputResultType ? [outputResultType] : undefined,
        arguments: [exceptionAst],
      },
      currentContext,
    ];
  }

  const valuesArg = expr.arguments[0];
  if (!valuesArg) return null;

  const [valuesAst, valuesContext] = emitExpressionAst(
    valuesArg,
    currentContext,
    valuesArg.inferredType
  );
  currentContext = valuesContext;

  const inputElementType = getSequenceElementIrType(valuesArg.inferredType);
  const resultElementTypeAst =
    outputResultType?.kind === "arrayType"
      ? outputResultType.elementType
      : outputResultType;

  let normalizedValuesAst = valuesAst;
  if (inputElementType) {
    const [inputElementTypeAst, inputElementContext] = emitTypeAst(
      inputElementType,
      currentContext
    );
    currentContext = inputElementContext;

    const [normalizedTaskAst, normalizedTaskContext] =
      emitPromiseNormalizedTaskAst(
        {
          kind: "identifierExpression",
          identifier: "__tsonic_promise_item",
        },
        inputElementType,
        resultElementTypeAst,
        currentContext
      );
    currentContext = normalizedTaskContext;

    normalizedValuesAst = {
      kind: "invocationExpression",
      expression: identifierExpression("global::System.Linq.Enumerable.Select"),
      arguments: [
        valuesAst,
        {
          kind: "lambdaExpression",
          isAsync: false,
          parameters: [
            {
              name: "__tsonic_promise_item",
              type: inputElementTypeAst,
            },
          ],
          body: normalizedTaskAst,
        },
      ],
    };
  }

  if (method === "all") {
    return [
      {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: identifierExpression(
            "global::System.Threading.Tasks.Task"
          ),
          memberName: "WhenAll",
        },
        arguments: [normalizedValuesAst],
      },
      currentContext,
    ];
  }

  const whenAnyAst: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: identifierExpression("global::System.Threading.Tasks.Task"),
      memberName: "WhenAny",
    },
    arguments: [normalizedValuesAst],
  };

  if (!outputResultType) {
    return [
      buildTaskRunInvocation(
        outputTaskType,
        {
          kind: "blockStatement",
          statements: [
            {
              kind: "expressionStatement",
              expression: {
                kind: "awaitExpression",
                expression: {
                  kind: "awaitExpression",
                  expression: whenAnyAst,
                },
              },
            },
          ],
        },
        true
      ),
      currentContext,
    ];
  }

  return [
    buildTaskRunInvocation(
      outputTaskType,
      {
        kind: "blockStatement",
        statements: [
          {
            kind: "returnStatement",
            expression: {
              kind: "awaitExpression",
              expression: {
                kind: "awaitExpression",
                expression: whenAnyAst,
              },
            },
          },
        ],
      },
      true
    ),
    currentContext,
  ];
};
