import { IrExpression } from "@tsonic/frontend";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../type-emitter.js";
import type {
  CSharpCatchClauseAst,
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import { identifierType } from "../../core/format/backend-ast/builders.js";
import type { EmitterContext } from "../../types.js";
import { isAsyncWrapperType, isPromiseChainMethod } from "./call-analysis.js";
import {
  buildDelegateType,
  buildTaskRunInvocation,
  buildTaskTypeAst,
  containsVoidTypeAst,
  getTaskResultType,
} from "./call-promise-task-types.js";
import {
  callbackParameterCount,
  callbackReturnsAsyncWrapper,
  containsPromiseChainArtifact,
  getCallbackDelegateReturnType,
  getCallbackReturnType,
  mergePromiseChainResultIrTypes,
  normalizePromiseChainResultIrType,
} from "./call-promise-ir-types.js";
import {
  buildAwait,
  buildInvocation,
} from "./call-promise-normalization.js";

export const emitPromiseThenCatchFinally = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | null => {
  if (expr.callee.kind !== "memberAccess") return null;
  if (typeof expr.callee.property !== "string") return null;
  if (!isPromiseChainMethod(expr.callee.property)) return null;
  if (expr.callee.isOptional || expr.isOptional) return null;
  if (!isAsyncWrapperType(expr.callee.object.inferredType)) return null;

  let currentContext = context;
  const [receiverAst, receiverCtx] = emitExpressionAst(
    expr.callee.object,
    currentContext
  );
  currentContext = receiverCtx;

  const outputTypeHint =
    context.returnType && isAsyncWrapperType(context.returnType)
      ? context.returnType
      : expr.inferredType;
  const [rawOutputTaskType, outputTaskCtx] = emitTypeAst(
    outputTypeHint ?? { kind: "referenceType", name: "Task" },
    currentContext
  );
  currentContext = outputTaskCtx;
  const rawOutputTaskResultType = getTaskResultType(rawOutputTaskType);
  const defaultOutputTaskType: CSharpTypeAst =
    rawOutputTaskResultType && containsVoidTypeAst(rawOutputTaskResultType)
      ? identifierType("global::System.Threading.Tasks.Task")
      : rawOutputTaskType;

  const [sourceTaskType, sourceTaskCtx] = emitTypeAst(
    expr.callee.object.inferredType ?? { kind: "referenceType", name: "Task" },
    currentContext
  );
  currentContext = sourceTaskCtx;

  const sourceResultType = getTaskResultType(sourceTaskType);
  const sourceResultIr = normalizePromiseChainResultIrType(
    expr.callee.object.inferredType
  );
  const exIdent = "__tsonic_promise_ex";
  const valueIdent = "__tsonic_promise_value";

  const fulfilledArg = expr.arguments[0];
  const rejectedArg =
    expr.callee.property === "then" ? expr.arguments[1] : expr.arguments[0];
  const finallyArg =
    expr.callee.property === "finally" ? expr.arguments[0] : undefined;

  let fulfilledAst: CSharpExpressionAst | undefined;
  let rejectedAst: CSharpExpressionAst | undefined;
  let finallyAst: CSharpExpressionAst | undefined;

  if (fulfilledArg && fulfilledArg.kind !== "spread") {
    const [fAst, fCtx] = emitExpressionAst(fulfilledArg, currentContext);
    fulfilledAst = fAst;
    currentContext = fCtx;
  }
  if (rejectedArg && rejectedArg.kind !== "spread") {
    const [rAst, rCtx] = emitExpressionAst(rejectedArg, currentContext);
    rejectedAst = rAst;
    currentContext = rCtx;
  }
  if (finallyArg && finallyArg.kind !== "spread") {
    const [fiAst, fiCtx] = emitExpressionAst(finallyArg, currentContext);
    finallyAst = fiAst;
    currentContext = fiCtx;
  }

  const fulfilledResultIr =
    fulfilledArg && fulfilledArg.kind !== "spread"
      ? normalizePromiseChainResultIrType(
          getCallbackReturnType(fulfilledArg as IrExpression)
        )
      : undefined;
  const rejectedResultIr =
    rejectedArg && rejectedArg.kind !== "spread"
      ? normalizePromiseChainResultIrType(
          getCallbackReturnType(rejectedArg as IrExpression)
        )
      : undefined;
  const normalizedPromiseChainResultIr = (() => {
    if (expr.callee.property === "then") {
      if (rejectedArg && rejectedArg.kind !== "spread") {
        return mergePromiseChainResultIrTypes(
          fulfilledResultIr ?? sourceResultIr,
          rejectedResultIr
        );
      }
      return fulfilledResultIr ?? sourceResultIr;
    }
    if (expr.callee.property === "catch") {
      return mergePromiseChainResultIrTypes(sourceResultIr, rejectedResultIr);
    }
    if (expr.callee.property === "finally") {
      return sourceResultIr;
    }
    return undefined;
  })();
  const normalizedFrontendPromiseChainResultIr =
    normalizePromiseChainResultIrType(expr.inferredType);
  const preferredPromiseChainResultIr =
    normalizedFrontendPromiseChainResultIr &&
    !containsPromiseChainArtifact(normalizedFrontendPromiseChainResultIr)
      ? normalizedFrontendPromiseChainResultIr
      : normalizedPromiseChainResultIr;

  let outputResultType = getTaskResultType(defaultOutputTaskType);
  let outputTaskType = defaultOutputTaskType;
  if (preferredPromiseChainResultIr) {
    const [normalizedResultAst, normalizedCtx] = emitTypeAst(
      preferredPromiseChainResultIr,
      currentContext
    );
    currentContext = normalizedCtx;
    outputResultType = containsVoidTypeAst(normalizedResultAst)
      ? undefined
      : normalizedResultAst;
    outputTaskType = buildTaskTypeAst(outputResultType);
  }

  const awaitReceiverStatement =
    sourceResultType === undefined
      ? ({
          kind: "expressionStatement",
          expression: buildAwait(receiverAst),
        } as const satisfies CSharpStatementAst)
      : ({
          kind: "localDeclarationStatement",
          modifiers: [],
          type: { kind: "varType" },
          declarators: [
            {
              name: valueIdent,
              initializer: buildAwait(receiverAst),
            },
          ],
        } as const satisfies CSharpStatementAst);

  const invokeFulfilled = (): readonly CSharpStatementAst[] => {
    if (!fulfilledAst) {
      if (sourceResultType === undefined) return [];
      return [
        {
          kind: "returnStatement",
          expression: {
            kind: "identifierExpression",
            identifier: valueIdent,
          },
        },
      ];
    }

    const fulfilledArgs: CSharpExpressionAst[] = [];
    if (
      sourceResultType !== undefined &&
      callbackParameterCount(fulfilledArg as IrExpression) > 0
    ) {
      fulfilledArgs.push({
        kind: "identifierExpression",
        identifier: valueIdent,
      });
    }

    const delegateParamTypes: CSharpTypeAst[] =
      sourceResultType !== undefined &&
      callbackParameterCount(fulfilledArg as IrExpression) > 0
        ? [sourceResultType]
        : [];
    const callbackReturnIr = getCallbackDelegateReturnType(
      fulfilledArg as IrExpression
    );
    let callbackReturnTypeAst: CSharpTypeAst | undefined = outputResultType;
    if (callbackReturnIr !== undefined) {
      const [cbRetAst, cbRetCtx] = emitTypeAst(
        callbackReturnIr,
        currentContext
      );
      callbackReturnTypeAst =
        (cbRetAst.kind === "predefinedType" && cbRetAst.keyword === "void") ||
        (cbRetAst.kind === "identifierType" && cbRetAst.name === "void")
          ? undefined
          : cbRetAst;
      currentContext = cbRetCtx;
    }
    if (outputResultType !== undefined && callbackReturnTypeAst === undefined) {
      callbackReturnTypeAst = outputResultType;
    }
    if (
      callbackReturnTypeAst === undefined &&
      fulfilledArg?.kind === "arrowFunction" &&
      fulfilledArg.body.kind !== "blockStatement"
    ) {
      callbackReturnTypeAst = { kind: "predefinedType", keyword: "object" };
    }
    const callbackCallee =
      fulfilledAst.kind === "lambdaExpression"
        ? ({
            kind: "castExpression",
            type: buildDelegateType(delegateParamTypes, callbackReturnTypeAst),
            expression: fulfilledAst,
          } as const satisfies CSharpExpressionAst)
        : fulfilledAst;
    const callbackCall =
      callbackCallee.kind === "castExpression"
        ? buildInvocation(
            {
              kind: "memberAccessExpression",
              expression: callbackCallee,
              memberName: "Invoke",
            },
            fulfilledArgs
          )
        : buildInvocation(callbackCallee, fulfilledArgs);
    const callbackExpr = callbackReturnsAsyncWrapper(
      fulfilledArg as IrExpression
    )
      ? buildAwait(callbackCall)
      : callbackCall;

    if (outputResultType === undefined) {
      return [{ kind: "expressionStatement", expression: callbackExpr }];
    }

    return [{ kind: "returnStatement", expression: callbackExpr }];
  };

  const invokeRejected = (): readonly CSharpStatementAst[] => {
    if (!rejectedAst) {
      return [{ kind: "throwStatement" }];
    }

    const rejectedArgs: CSharpExpressionAst[] = [];
    if (callbackParameterCount(rejectedArg as IrExpression) > 0) {
      rejectedArgs.push({
        kind: "identifierExpression",
        identifier: exIdent,
      });
    }
    const callbackReturnIr = getCallbackDelegateReturnType(
      rejectedArg as IrExpression
    );
    let callbackReturnTypeAst: CSharpTypeAst | undefined = outputResultType;
    if (callbackReturnIr !== undefined) {
      const [cbRetAst, cbRetCtx] = emitTypeAst(
        callbackReturnIr,
        currentContext
      );
      callbackReturnTypeAst =
        (cbRetAst.kind === "predefinedType" && cbRetAst.keyword === "void") ||
        (cbRetAst.kind === "identifierType" && cbRetAst.name === "void")
          ? undefined
          : cbRetAst;
      currentContext = cbRetCtx;
    }
    if (outputResultType !== undefined && callbackReturnTypeAst === undefined) {
      callbackReturnTypeAst = outputResultType;
    }
    if (
      callbackReturnTypeAst === undefined &&
      rejectedArg?.kind === "arrowFunction" &&
      rejectedArg.body.kind !== "blockStatement"
    ) {
      callbackReturnTypeAst = { kind: "predefinedType", keyword: "object" };
    }
    const callbackCallee =
      rejectedAst.kind === "lambdaExpression"
        ? ({
            kind: "castExpression",
            type: buildDelegateType(
              [identifierType("global::System.Exception")],
              callbackReturnTypeAst
            ),
            expression: rejectedAst,
          } as const satisfies CSharpExpressionAst)
        : rejectedAst;
    const callbackCall =
      callbackCallee.kind === "castExpression"
        ? buildInvocation(
            {
              kind: "memberAccessExpression",
              expression: callbackCallee,
              memberName: "Invoke",
            },
            rejectedArgs
          )
        : buildInvocation(callbackCallee, rejectedArgs);
    const callbackExpr = callbackReturnsAsyncWrapper(
      rejectedArg as IrExpression
    )
      ? buildAwait(callbackCall)
      : callbackCall;

    if (outputResultType === undefined) {
      return [{ kind: "expressionStatement", expression: callbackExpr }];
    }

    return [{ kind: "returnStatement", expression: callbackExpr }];
  };

  const invokeFinally = (): readonly CSharpStatementAst[] => {
    if (!finallyAst) return [];
    const callbackReturnIr = getCallbackDelegateReturnType(
      finallyArg as IrExpression
    );
    let callbackReturnTypeAst: CSharpTypeAst | undefined = undefined;
    if (callbackReturnIr !== undefined) {
      const [cbRetAst, cbRetCtx] = emitTypeAst(
        callbackReturnIr,
        currentContext
      );
      callbackReturnTypeAst = cbRetAst;
      currentContext = cbRetCtx;
    }
    if (
      callbackReturnTypeAst === undefined &&
      finallyArg?.kind === "arrowFunction" &&
      finallyArg.body.kind !== "blockStatement"
    ) {
      callbackReturnTypeAst = { kind: "predefinedType", keyword: "object" };
    }
    const callbackCallee =
      finallyAst.kind === "lambdaExpression"
        ? ({
            kind: "castExpression",
            type: buildDelegateType([], callbackReturnTypeAst),
            expression: finallyAst,
          } as const satisfies CSharpExpressionAst)
        : finallyAst;
    const callbackCall =
      callbackCallee.kind === "castExpression"
        ? buildInvocation(
            {
              kind: "memberAccessExpression",
              expression: callbackCallee,
              memberName: "Invoke",
            },
            []
          )
        : buildInvocation(callbackCallee, []);
    const callbackExpr = callbackReturnsAsyncWrapper(finallyArg as IrExpression)
      ? buildAwait(callbackCall)
      : callbackCall;
    return [{ kind: "expressionStatement", expression: callbackExpr }];
  };

  if (expr.callee.property === "then") {
    const thenStatements: CSharpStatementAst[] = [
      awaitReceiverStatement,
      ...invokeFulfilled(),
    ];
    const bodyStatements: CSharpStatementAst[] = rejectedAst
      ? [
          {
            kind: "tryStatement",
            body: { kind: "blockStatement", statements: thenStatements },
            catches: [
              {
                type: identifierType("global::System.Exception"),
                identifier: exIdent,
                body: {
                  kind: "blockStatement",
                  statements: invokeRejected(),
                },
              },
            ],
          },
        ]
      : thenStatements;
    return [
      buildTaskRunInvocation(
        outputTaskType,
        {
          kind: "blockStatement",
          statements: bodyStatements,
        },
        true
      ),
      currentContext,
    ];
  }

  if (expr.callee.property === "catch") {
    const successPath: readonly CSharpStatementAst[] =
      sourceResultType === undefined
        ? [{ kind: "expressionStatement", expression: buildAwait(receiverAst) }]
        : [{ kind: "returnStatement", expression: buildAwait(receiverAst) }];
    const catches: readonly CSharpCatchClauseAst[] = [
      {
        type: identifierType("global::System.Exception"),
        identifier: exIdent,
        body: {
          kind: "blockStatement",
          statements: invokeRejected(),
        },
      },
    ];
    return [
      buildTaskRunInvocation(
        outputTaskType,
        {
          kind: "blockStatement",
          statements: [
            {
              kind: "tryStatement",
              body: { kind: "blockStatement", statements: successPath },
              catches,
            },
          ],
        },
        true
      ),
      currentContext,
    ];
  }

  if (expr.callee.property === "finally") {
    const tryStatements: readonly CSharpStatementAst[] =
      sourceResultType === undefined
        ? [{ kind: "expressionStatement", expression: buildAwait(receiverAst) }]
        : [{ kind: "returnStatement", expression: buildAwait(receiverAst) }];
    return [
      buildTaskRunInvocation(
        outputTaskType,
        {
          kind: "blockStatement",
          statements: [
            {
              kind: "tryStatement",
              body: { kind: "blockStatement", statements: tryStatements },
              catches: [],
              finallyBody: {
                kind: "blockStatement",
                statements: invokeFinally(),
              },
            },
          ],
        },
        true
      ),
      currentContext,
    ];
  }

  return null;
};
