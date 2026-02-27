/**
 * Call expression emitter
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import {
  emitTypeArgumentsAst,
  generateSpecializedName,
} from "../identifiers.js";
import { emitTypeAst } from "../../type-emitter.js";
import { emitMemberAccess } from "../access.js";
import {
  isLValue,
  getPassingModifierFromCast,
  isJsonSerializerCall,
  isGlobalJsonCall,
  isInstanceMemberAccess,
  shouldEmitFluentExtensionCall,
  getTypeNamespace,
  registerJsonAotType,
  needsIntCast,
  isPromiseChainMethod,
  isAsyncWrapperType,
} from "./call-analysis.js";
import { extractCalleeNameFromAst } from "../../core/format/backend-ast/utils.js";
import type {
  CSharpBlockStatementAst,
  CSharpCatchClauseAst,
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import {
  DYNAMIC_OPS_FQN,
  resolveImportPath,
  typeContainsDynamicAny,
} from "../../core/semantic/index.js";

/**
 * Wrap an expression AST with an optional argument modifier (ref/out/in/params).
 */
const wrapArgModifier = (
  modifier: string | undefined,
  expr: CSharpExpressionAst
): CSharpExpressionAst =>
  modifier
    ? { kind: "argumentModifierExpression", modifier, expression: expr }
    : expr;

/**
 * Wrap an invocation AST with an optional (int) cast.
 */
const wrapIntCast = (
  needsCast: boolean,
  expr: CSharpExpressionAst
): CSharpExpressionAst =>
  needsCast
    ? {
        kind: "castExpression",
        type: { kind: "predefinedType", keyword: "int" },
        expression: expr,
      }
    : expr;

const isTaskTypeAst = (
  typeAst: CSharpTypeAst
): typeAst is Extract<CSharpTypeAst, { kind: "identifierType" }> => {
  if (typeAst.kind !== "identifierType") return false;
  const simple = typeAst.name.includes(".")
    ? typeAst.name.slice(typeAst.name.lastIndexOf(".") + 1)
    : typeAst.name;
  return simple === "Task";
};

const containsVoidTypeAst = (typeAst: CSharpTypeAst): boolean => {
  if (typeAst.kind === "predefinedType" && typeAst.keyword === "void") {
    return true;
  }
  if (typeAst.kind === "identifierType") {
    if (typeAst.name === "void" || typeAst.name.endsWith(".void")) {
      return true;
    }
    return (typeAst.typeArguments ?? []).some((t) => containsVoidTypeAst(t));
  }
  if (typeAst.kind === "arrayType") {
    return containsVoidTypeAst(typeAst.elementType);
  }
  if (typeAst.kind === "nullableType") {
    return containsVoidTypeAst(typeAst.underlyingType);
  }
  if (typeAst.kind === "pointerType") {
    return containsVoidTypeAst(typeAst.elementType);
  }
  if (typeAst.kind === "tupleType") {
    return typeAst.elements.some((e) => containsVoidTypeAst(e.type));
  }
  return false;
};

const getTaskResultType = (
  typeAst: CSharpTypeAst
): CSharpTypeAst | undefined =>
  isTaskTypeAst(typeAst) && typeAst.typeArguments?.length === 1
    ? typeAst.typeArguments[0]
    : undefined;

const callbackParameterCount = (callbackExpr: IrExpression): number => {
  if (
    callbackExpr.kind === "arrowFunction" ||
    callbackExpr.kind === "functionExpression"
  ) {
    return callbackExpr.parameters.length;
  }
  const callbackType = callbackExpr.inferredType;
  if (callbackType?.kind === "functionType") {
    return callbackType.parameters.length;
  }
  return 1;
};

const callbackReturnsAsyncWrapper = (callbackExpr: IrExpression): boolean => {
  const callbackType = callbackExpr.inferredType;
  return callbackType?.kind === "functionType"
    ? isAsyncWrapperType(callbackType.returnType)
    : false;
};

const buildInvocation = (
  expression: CSharpExpressionAst,
  args: readonly CSharpExpressionAst[]
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression,
  arguments: args,
});

const buildAwait = (expression: CSharpExpressionAst): CSharpExpressionAst => ({
  kind: "awaitExpression",
  expression,
});

const boolLiteral = (value: boolean): CSharpExpressionAst => ({
  kind: "literalExpression",
  text: value ? "true" : "false",
});

const buildDynamicArgsArray = (
  args: readonly CSharpExpressionAst[]
): CSharpExpressionAst => ({
  kind: "arrayCreationExpression",
  elementType: {
    kind: "nullableType",
    underlyingType: { kind: "predefinedType", keyword: "object" },
  },
  initializer: args,
});

const buildDelegateType = (
  parameterTypes: readonly CSharpTypeAst[],
  returnType: CSharpTypeAst | undefined
): CSharpTypeAst => {
  const isVoidReturn =
    returnType?.kind === "predefinedType" && returnType.keyword === "void";
  if (returnType === undefined) {
    return parameterTypes.length === 0
      ? { kind: "identifierType", name: "global::System.Action" }
      : {
          kind: "identifierType",
          name: "global::System.Action",
          typeArguments: parameterTypes,
        };
  }
  if (
    isVoidReturn ||
    (returnType.kind === "identifierType" && returnType.name === "void")
  ) {
    return parameterTypes.length === 0
      ? { kind: "identifierType", name: "global::System.Action" }
      : {
          kind: "identifierType",
          name: "global::System.Action",
          typeArguments: parameterTypes,
        };
  }

  return {
    kind: "identifierType",
    name: "global::System.Func",
    typeArguments: [...parameterTypes, returnType],
  };
};

const isVoidOrUnknownIrType = (type: IrType | undefined): boolean =>
  type === undefined ||
  type.kind === "voidType" ||
  type.kind === "unknownType" ||
  (type.kind === "primitiveType" && type.name === "undefined");

const getCallbackReturnType = (
  callbackExpr: IrExpression
): IrType | undefined => {
  const declared =
    callbackExpr.inferredType?.kind === "functionType"
      ? callbackExpr.inferredType.returnType
      : undefined;
  if (!isVoidOrUnknownIrType(declared)) {
    return declared;
  }

  if (
    callbackExpr.kind === "arrowFunction" &&
    callbackExpr.body.kind !== "blockStatement"
  ) {
    return callbackExpr.body.inferredType;
  }

  return undefined;
};

const buildPromiseChainTaskRun = (
  outputTaskType: CSharpTypeAst,
  body: CSharpBlockStatementAst
): CSharpExpressionAst => {
  const resultType = getTaskResultType(outputTaskType);
  return {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: {
        kind: "identifierExpression",
        identifier: "global::System.Threading.Tasks.Task",
      },
      memberName: "Run",
    },
    arguments: [
      {
        kind: "lambdaExpression",
        isAsync: true,
        parameters: [],
        body,
      },
    ],
    typeArguments: resultType ? [resultType] : undefined,
  };
};

const getDynamicImportSpecifier = (
  expr: Extract<IrExpression, { kind: "call" }>
): string | undefined => {
  const [arg] = expr.arguments;
  if (!arg || arg.kind === "spread") return undefined;
  return arg.kind === "literal" && typeof arg.value === "string"
    ? arg.value
    : undefined;
};

const emitDynamicImportSideEffect = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | null => {
  if (expr.callee.kind !== "identifier" || expr.callee.name !== "import") {
    return null;
  }

  const specifier = getDynamicImportSpecifier(expr);
  if (!specifier) return null;

  const completedTaskExpr: CSharpExpressionAst = {
    kind: "memberAccessExpression",
    expression: {
      kind: "identifierExpression",
      identifier: "global::System.Threading.Tasks.Task",
    },
    memberName: "CompletedTask",
  };

  const currentFilePath = context.options.currentModuleFilePath;
  const moduleMap = context.options.moduleMap;
  if (!currentFilePath || !moduleMap) {
    return [completedTaskExpr, context];
  }

  const targetPath = resolveImportPath(currentFilePath, specifier);
  const targetModule = (() => {
    const direct = moduleMap.get(targetPath);
    if (direct) return direct;

    const normalizedTarget = targetPath.replace(/\\/g, "/");
    for (const [key, identity] of moduleMap.entries()) {
      const normalizedKey = key.replace(/\\/g, "/");
      if (
        normalizedKey === normalizedTarget ||
        normalizedKey.endsWith(`/${normalizedTarget}`) ||
        normalizedTarget.endsWith(`/${normalizedKey}`)
      ) {
        return identity;
      }
    }
    return undefined;
  })();
  if (!targetModule) {
    return [completedTaskExpr, context];
  }

  const containerName = targetModule.hasTypeCollision
    ? `${targetModule.className}__Module`
    : targetModule.className;
  const containerType: CSharpTypeAst = {
    kind: "identifierType",
    name: `global::${targetModule.namespace}.${containerName}`,
  };

  const runClassConstructor: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: {
        kind: "identifierExpression",
        identifier: "global::System.Runtime.CompilerServices.RuntimeHelpers",
      },
      memberName: "RunClassConstructor",
    },
    arguments: [
      {
        kind: "memberAccessExpression",
        expression: {
          kind: "typeofExpression",
          type: containerType,
        },
        memberName: "TypeHandle",
      },
    ],
  };

  const taskRun: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: {
        kind: "identifierExpression",
        identifier: "global::System.Threading.Tasks.Task",
      },
      memberName: "Run",
    },
    arguments: [
      {
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [],
        body: runClassConstructor,
      },
    ],
  };

  return [taskRun, context];
};

const emitDynamicAnyCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | null => {
  const calleeIsDynamic =
    typeContainsDynamicAny(expr.callee.inferredType, context) ||
    (expr.callee.kind === "memberAccess" &&
      typeContainsDynamicAny(expr.callee.object.inferredType, context));
  if (!calleeIsDynamic) return null;

  let currentContext = context;

  if (expr.callee.kind === "memberAccess") {
    const [targetAst, targetContext] = emitExpressionAst(
      expr.callee.object,
      currentContext
    );
    currentContext = targetContext;

    let keyAst: CSharpExpressionAst;
    if (expr.callee.isComputed) {
      if (typeof expr.callee.property === "string") {
        keyAst = {
          kind: "literalExpression",
          text: JSON.stringify(expr.callee.property),
        };
      } else {
        const [computedAst, computedContext] = emitExpressionAst(
          expr.callee.property,
          currentContext
        );
        keyAst = computedAst;
        currentContext = computedContext;
      }
    } else {
      keyAst = {
        kind: "literalExpression",
        text: JSON.stringify(expr.callee.property as string),
      };
    }

    const [argAsts, argContext] = emitCallArguments(
      expr.arguments,
      expr,
      currentContext
    );
    currentContext = argContext;
    const argsArray = buildDynamicArgsArray(argAsts);

    return [
      {
        kind: "invocationExpression",
        expression: {
          kind: "identifierExpression",
          identifier: `${DYNAMIC_OPS_FQN}.InvokeMember`,
        },
        arguments: [
          targetAst,
          keyAst,
          argsArray,
          boolLiteral(expr.isOptional || expr.callee.isOptional),
        ],
      },
      currentContext,
    ];
  }

  const [calleeAst, calleeContext] = emitExpressionAst(
    expr.callee,
    currentContext
  );
  currentContext = calleeContext;
  const [argAsts, argContext] = emitCallArguments(
    expr.arguments,
    expr,
    currentContext
  );
  currentContext = argContext;
  const argsArray = buildDynamicArgsArray(argAsts);
  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "identifierExpression",
        identifier: `${DYNAMIC_OPS_FQN}.Invoke`,
      },
      arguments: [calleeAst, argsArray, boolLiteral(expr.isOptional)],
    },
    currentContext,
  ];
};

const emitPromiseThenCatchFinally = (
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
  const outputTaskType: CSharpTypeAst =
    isTaskTypeAst(rawOutputTaskType) &&
    rawOutputTaskType.typeArguments?.length === 1 &&
    containsVoidTypeAst(rawOutputTaskType.typeArguments[0] as CSharpTypeAst)
      ? { kind: "identifierType", name: "global::System.Threading.Tasks.Task" }
      : rawOutputTaskType;

  const [sourceTaskType, sourceTaskCtx] = emitTypeAst(
    expr.callee.object.inferredType ?? { kind: "referenceType", name: "Task" },
    currentContext
  );
  currentContext = sourceTaskCtx;

  const sourceResultType = getTaskResultType(sourceTaskType);
  const outputResultType = getTaskResultType(outputTaskType);
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

  const awaitReceiverStatement =
    sourceResultType === undefined
      ? ({
          kind: "expressionStatement",
          expression: buildAwait(receiverAst),
        } as const satisfies CSharpStatementAst)
      : ({
          kind: "localDeclarationStatement",
          modifiers: [],
          type: { kind: "identifierType", name: "var" },
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
    const callbackReturnIr = getCallbackReturnType(
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
    const callbackReturnIr = getCallbackReturnType(rejectedArg as IrExpression);
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
              [{ kind: "identifierType", name: "global::System.Exception" }],
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
    const callbackReturnIr = getCallbackReturnType(finallyArg as IrExpression);
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
                type: {
                  kind: "identifierType",
                  name: "global::System.Exception",
                },
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
      buildPromiseChainTaskRun(outputTaskType, {
        kind: "blockStatement",
        statements: bodyStatements,
      }),
      currentContext,
    ];
  }

  if (expr.callee.property === "catch") {
    const successPath: readonly CSharpStatementAst[] =
      sourceResultType === undefined
        ? [{ kind: "expressionStatement", expression: buildAwait(receiverAst) }]
        : [
            {
              kind: "returnStatement",
              expression: buildAwait(receiverAst),
            },
          ];
    const catches: readonly CSharpCatchClauseAst[] = [
      {
        type: { kind: "identifierType", name: "global::System.Exception" },
        identifier: exIdent,
        body: {
          kind: "blockStatement",
          statements: invokeRejected(),
        },
      },
    ];
    return [
      buildPromiseChainTaskRun(outputTaskType, {
        kind: "blockStatement",
        statements: [
          {
            kind: "tryStatement",
            body: { kind: "blockStatement", statements: successPath },
            catches,
          },
        ],
      }),
      currentContext,
    ];
  }

  if (expr.callee.property === "finally") {
    const tryStatements: readonly CSharpStatementAst[] =
      sourceResultType === undefined
        ? [{ kind: "expressionStatement", expression: buildAwait(receiverAst) }]
        : [{ kind: "returnStatement", expression: buildAwait(receiverAst) }];
    return [
      buildPromiseChainTaskRun(outputTaskType, {
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
      }),
      currentContext,
    ];
  }

  return null;
};

/**
 * Emit call arguments as typed AST array.
 * Handles spread (params), castModifier (ref/out from cast), and argumentPassing modes.
 */
const emitCallArguments = (
  args: readonly IrExpression[],
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [readonly CSharpExpressionAst[], EmitterContext] => {
  const parameterTypes = expr.parameterTypes ?? [];
  let currentContext = context;
  const argAsts: CSharpExpressionAst[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    const expectedType = parameterTypes[i];

    if (arg.kind === "spread") {
      const [spreadAst, ctx] = emitExpressionAst(
        arg.expression,
        currentContext
      );
      argAsts.push(wrapArgModifier("params", spreadAst));
      currentContext = ctx;
    } else {
      const castModifier = getPassingModifierFromCast(arg);
      if (castModifier && isLValue(arg)) {
        const [argAst, ctx] = emitExpressionAst(arg, currentContext);
        argAsts.push(wrapArgModifier(castModifier, argAst));
        currentContext = ctx;
      } else {
        const [argAst, ctx] = emitExpressionAst(
          arg,
          currentContext,
          expectedType
        );
        const passingMode = expr.argumentPassing?.[i];
        const modifier =
          passingMode && passingMode !== "value" && isLValue(arg)
            ? passingMode
            : undefined;
        argAsts.push(wrapArgModifier(modifier, argAst));
        currentContext = ctx;
      }
    }
  }

  return [argAsts, currentContext];
};

/**
 * Emit a JsonSerializer call with NativeAOT-compatible options.
 */
const emitJsonSerializerCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  method: "Serialize" | "Deserialize"
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;

  // Register the type with the JSON AOT registry
  if (method === "Serialize") {
    const firstArg = expr.arguments[0];
    if (firstArg && firstArg.kind !== "spread") {
      registerJsonAotType(firstArg.inferredType, context);
    }
  } else {
    const typeArg = expr.typeArguments?.[0];
    if (typeArg) {
      registerJsonAotType(typeArg, context);
    }
  }

  // Emit type arguments for Deserialize<T>
  let typeArgAsts: readonly CSharpTypeAst[] = [];
  if (expr.typeArguments && expr.typeArguments.length > 0) {
    const [typeArgs, typeContext] = emitTypeArgumentsAst(
      expr.typeArguments,
      currentContext
    );
    typeArgAsts = typeArgs;
    currentContext = typeContext;
  }

  // Emit arguments
  const argAsts: CSharpExpressionAst[] = [];
  for (const arg of expr.arguments) {
    if (arg.kind === "spread") {
      const [spreadAst, ctx] = emitExpressionAst(
        arg.expression,
        currentContext
      );
      argAsts.push(spreadAst);
      currentContext = ctx;
    } else {
      const [argAst, ctx] = emitExpressionAst(arg, currentContext);
      argAsts.push(argAst);
      currentContext = ctx;
    }
  }

  // Add TsonicJson.Options when NativeAOT JSON context generation is enabled.
  if (context.options.jsonAotRegistry) {
    argAsts.push({
      kind: "identifierExpression",
      identifier: "TsonicJson.Options",
    });
  }

  const invocation: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: {
        kind: "identifierExpression",
        identifier: "global::System.Text.Json.JsonSerializer",
      },
      memberName: method,
    },
    arguments: argAsts,
    typeArguments: typeArgAsts.length > 0 ? typeArgAsts : undefined,
  };
  return [invocation, currentContext];
};

/**
 * Emit a function call expression as CSharpExpressionAst
 */
export const emitCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const dynamicImport = emitDynamicImportSideEffect(expr, context);
  if (dynamicImport) return dynamicImport;

  const promiseChain = emitPromiseThenCatchFinally(expr, context);
  if (promiseChain) return promiseChain;

  const dynamicAnyCall = emitDynamicAnyCall(expr, context);
  if (dynamicAnyCall) return dynamicAnyCall;

  // Void promise resolve: emit as zero-arg call when safe.
  if (
    expr.callee.kind === "identifier" &&
    context.voidResolveNames?.has(expr.callee.name)
  ) {
    const isZeroArg = expr.arguments.length === 0;
    const isSingleUndefined =
      expr.arguments.length === 1 &&
      expr.arguments[0]?.kind === "identifier" &&
      expr.arguments[0].name === "undefined";

    if (isZeroArg || isSingleUndefined) {
      const [calleeAst, calleeCtx] = emitExpressionAst(expr.callee, context);
      return [
        {
          kind: "invocationExpression",
          expression: calleeAst,
          arguments: [],
        },
        calleeCtx,
      ];
    }
  }

  // Check for JsonSerializer calls (NativeAOT support)
  const jsonCall = isJsonSerializerCall(expr.callee);
  if (jsonCall) {
    return emitJsonSerializerCall(expr, context, jsonCall.method);
  }

  // Check for global JSON.stringify/parse calls
  const globalJsonCall = isGlobalJsonCall(expr.callee);
  if (globalJsonCall) {
    return emitJsonSerializerCall(expr, context, globalJsonCall.method);
  }

  // EF Core query canonicalization: ToList().ToArray() → ToArray()
  if (
    expr.callee.kind === "memberAccess" &&
    expr.callee.property === "ToArray" &&
    expr.arguments.length === 0 &&
    expr.callee.object.kind === "call"
  ) {
    const innerCall = expr.callee.object;

    if (
      innerCall.callee.kind === "memberAccess" &&
      innerCall.callee.memberBinding?.isExtensionMethod &&
      isInstanceMemberAccess(innerCall.callee, context) &&
      innerCall.callee.memberBinding.type.startsWith(
        "System.Linq.Enumerable"
      ) &&
      innerCall.callee.memberBinding.member === "ToList" &&
      innerCall.arguments.length === 0
    ) {
      let currentContext = context;

      currentContext.usings.add("System.Linq");

      const receiverExpr = innerCall.callee.object;
      const [receiverAst, receiverCtx] = emitExpressionAst(
        receiverExpr,
        currentContext
      );
      currentContext = receiverCtx;

      return [
        {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: receiverAst,
            memberName: "ToArray",
          },
          arguments: [],
        },
        currentContext,
      ];
    }
  }

  // Extension method lowering: emit explicit static invocation with receiver as first arg.
  if (
    expr.callee.kind === "memberAccess" &&
    expr.callee.memberBinding?.isExtensionMethod &&
    isInstanceMemberAccess(expr.callee, context)
  ) {
    let currentContext = context;

    const binding = expr.callee.memberBinding;
    const receiverExpr = expr.callee.object;

    const [receiverAst, receiverContext] = emitExpressionAst(
      receiverExpr,
      currentContext
    );
    currentContext = receiverContext;

    // Fluent extension method path
    if (shouldEmitFluentExtensionCall(binding.type, binding.member)) {
      const ns = getTypeNamespace(binding.type);
      if (ns) {
        currentContext.usings.add(ns);
      }

      let typeArgAsts: readonly CSharpTypeAst[] = [];
      if (expr.typeArguments && expr.typeArguments.length > 0) {
        const [typeArgs, typeContext] = emitTypeArgumentsAst(
          expr.typeArguments,
          currentContext
        );
        typeArgAsts = typeArgs;
        currentContext = typeContext;
      }

      const [argAsts, argContext] = emitCallArguments(
        expr.arguments,
        expr,
        currentContext
      );
      currentContext = argContext;

      const memberAccess: CSharpExpressionAst = expr.isOptional
        ? {
            kind: "conditionalMemberAccessExpression",
            expression: receiverAst,
            memberName: binding.member,
          }
        : {
            kind: "memberAccessExpression",
            expression: receiverAst,
            memberName: binding.member,
          };

      const invocation: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: memberAccess,
        arguments: argAsts,
        typeArguments: typeArgAsts.length > 0 ? typeArgAsts : undefined,
      };

      return [
        wrapIntCast(needsIntCast(expr, binding.member), invocation),
        currentContext,
      ];
    }

    let finalCalleeName = `global::${binding.type}.${binding.member}`;

    let typeArgAsts: readonly CSharpTypeAst[] = [];
    if (expr.typeArguments && expr.typeArguments.length > 0) {
      if (expr.requiresSpecialization) {
        const [specializedName, specContext] = generateSpecializedName(
          finalCalleeName,
          expr.typeArguments,
          currentContext
        );
        finalCalleeName = specializedName;
        currentContext = specContext;
      } else {
        const [typeArgs, typeContext] = emitTypeArgumentsAst(
          expr.typeArguments,
          currentContext
        );
        typeArgAsts = typeArgs;
        currentContext = typeContext;
      }
    }

    const [argAsts, argContext] = emitCallArguments(
      expr.arguments,
      expr,
      currentContext
    );
    currentContext = argContext;

    // Prepend receiver as first argument (static extension call)
    const allArgAsts: readonly CSharpExpressionAst[] = [
      receiverAst,
      ...argAsts,
    ];

    const invocation: CSharpExpressionAst = {
      kind: "invocationExpression",
      expression: {
        kind: "identifierExpression",
        identifier: finalCalleeName,
      },
      arguments: allArgAsts,
      typeArguments: typeArgAsts.length > 0 ? typeArgAsts : undefined,
    };

    // Wrap in ToArray() if result type is array
    const callAst: CSharpExpressionAst =
      expr.inferredType?.kind === "arrayType"
        ? {
            kind: "invocationExpression",
            expression: {
              kind: "identifierExpression",
              identifier: "global::System.Linq.Enumerable.ToArray",
            },
            arguments: [invocation],
          }
        : invocation;

    return [
      wrapIntCast(needsIntCast(expr, finalCalleeName), callAst),
      currentContext,
    ];
  }

  // Regular function call
  const [calleeAst, newContext] =
    expr.callee.kind === "memberAccess"
      ? emitMemberAccess(expr.callee, context, "call")
      : emitExpressionAst(expr.callee, context);
  let currentContext = newContext;

  let calleeExpr: CSharpExpressionAst = calleeAst;
  let typeArgAsts: readonly CSharpTypeAst[] = [];

  if (expr.typeArguments && expr.typeArguments.length > 0) {
    if (expr.requiresSpecialization) {
      const calleeText = extractCalleeNameFromAst(calleeAst);
      const [specializedName, specContext] = generateSpecializedName(
        calleeText,
        expr.typeArguments,
        currentContext
      );
      calleeExpr = {
        kind: "identifierExpression",
        identifier: specializedName,
      };
      currentContext = specContext;
    } else {
      const [typeArgs, typeContext] = emitTypeArgumentsAst(
        expr.typeArguments,
        currentContext
      );
      typeArgAsts = typeArgs;
      currentContext = typeContext;
    }
  }

  const [argAsts, argContext] = emitCallArguments(
    expr.arguments,
    expr,
    currentContext
  );
  currentContext = argContext;

  // Build the invocation target (may need optional chaining wrapper)
  const invocationTarget: CSharpExpressionAst = expr.isOptional
    ? (() => {
        // Optional call: callee?.(args) — in C# this requires the callee to be
        // a delegate and the call to be ?.Invoke(). For member access callees
        // the optional chaining is already handled by the member access emitter.
        // For identifiers, emit callee?.Invoke(args).
        if (calleeExpr.kind === "identifierExpression") {
          return {
            kind: "conditionalMemberAccessExpression" as const,
            expression: calleeExpr,
            memberName: "Invoke",
          };
        }
        return calleeExpr;
      })()
    : calleeExpr;

  const invocation: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: invocationTarget,
    arguments: argAsts,
    typeArguments: typeArgAsts.length > 0 ? typeArgAsts : undefined,
  };

  const calleeText = extractCalleeNameFromAst(calleeAst);
  return [
    wrapIntCast(needsIntCast(expr, calleeText), invocation),
    currentContext,
  ];
};
