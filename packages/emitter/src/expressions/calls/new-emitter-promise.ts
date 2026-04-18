import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../type-emitter.js";
import {
  booleanLiteral,
  identifierType,
  stringLiteral,
} from "../../core/format/backend-ast/builders.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import { buildInvokedLambdaExpressionAst } from "../invoked-lambda.js";

export const isPromiseConstructorCall = (
  expr: Extract<IrExpression, { kind: "new" }>
): boolean =>
  expr.callee.kind === "identifier" && expr.callee.name === "Promise";

const isVoidLikeType = (type: IrType | undefined): boolean => {
  if (!type) return false;
  return (
    type.kind === "voidType" ||
    (type.kind === "primitiveType" && type.name === "undefined")
  );
};

const containsVoidInGenericPosition = (type: IrType | undefined): boolean => {
  if (!type) return false;
  if (type.kind === "unionType") {
    return type.types.some(
      (t) => isVoidLikeType(t) || containsVoidInGenericPosition(t)
    );
  }
  if (type.kind === "referenceType" && type.typeArguments) {
    return type.typeArguments.some(
      (t) => isVoidLikeType(t) || containsVoidInGenericPosition(t)
    );
  }
  if (type.kind === "functionType") {
    return (
      type.parameters.some((p) => containsVoidInGenericPosition(p.type)) ||
      containsVoidInGenericPosition(type.returnType)
    );
  }
  return false;
};

const getPromiseValueType = (
  expr: Extract<IrExpression, { kind: "new" }>
): IrType | undefined => {
  const inferred = expr.inferredType;
  if (inferred?.kind === "referenceType") {
    const candidate = inferred.typeArguments?.[0];
    if (candidate && !isVoidLikeType(candidate)) {
      return candidate;
    }
    if (candidate && isVoidLikeType(candidate)) {
      return undefined;
    }
  }

  const explicit = expr.typeArguments?.[0];
  if (explicit && !isVoidLikeType(explicit)) {
    return explicit;
  }

  return undefined;
};

const isVoidPromiseValue = (
  expr: Extract<IrExpression, { kind: "new" }>
): boolean => {
  const inferred = expr.inferredType;
  if (inferred?.kind === "referenceType") {
    const candidate = inferred.typeArguments?.[0];
    if (candidate) {
      return isVoidLikeType(candidate);
    }
  }

  const explicit = expr.typeArguments?.[0];
  return explicit ? isVoidLikeType(explicit) : false;
};

const getExecutorArity = (
  expr: Extract<IrExpression, { kind: "new" }>
): number => {
  const executorType = expr.parameterTypes?.[0];
  const contextualArity =
    executorType?.kind === "functionType"
      ? executorType.parameters.length
      : undefined;
  const executor = expr.arguments[0];
  if (
    executor &&
    executor.kind !== "spread" &&
    (executor.kind === "arrowFunction" ||
      executor.kind === "functionExpression")
  ) {
    return Math.max(executor.parameters.length, contextualArity ?? 0);
  }

  return contextualArity ?? 1;
};

const normalizePromiseExecutorExpectedType = (
  expr: Extract<IrExpression, { kind: "new" }>,
  promiseValueType: IrType | undefined
): IrType | undefined => {
  const executorType = expr.parameterTypes?.[0];
  if (executorType?.kind !== "functionType") {
    return executorType;
  }

  const voidPromiseValue =
    promiseValueType === undefined && isVoidPromiseValue(expr);
  if (!promiseValueType && !voidPromiseValue) {
    return executorType;
  }

  return {
    ...executorType,
    parameters: executorType.parameters.map((parameter, index) => {
      if (
        index !== 0 ||
        parameter.type === undefined ||
        parameter.type.kind !== "functionType"
      ) {
        return parameter;
      }

      const resolveParameter = parameter.type.parameters[0];
      if (!resolveParameter) {
        return parameter;
      }

      return {
        ...parameter,
        type: {
          ...parameter.type,
          parameters: voidPromiseValue
            ? []
            : [
                {
                  ...resolveParameter,
                  type: promiseValueType,
                },
              ],
        },
      };
    }),
  };
};

export const emitPromiseConstructor = (
  expr: Extract<IrExpression, { kind: "new" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const executor = expr.arguments[0];
  if (!executor || executor.kind === "spread") {
    throw new Error(
      "Unsupported Promise constructor form: expected an executor function argument."
    );
  }

  let currentContext = context;
  const [taskTypeAstRaw, taskTypeContext] = expr.inferredType
    ? emitTypeAst(expr.inferredType, currentContext)
    : [identifierType("global::System.Threading.Tasks.Task"), currentContext];
  currentContext = taskTypeContext;
  const taskTypeAst: CSharpTypeAst =
    taskTypeAstRaw.kind === "identifierType" && taskTypeAstRaw.name.length === 0
      ? identifierType("global::System.Threading.Tasks.Task")
      : taskTypeAstRaw;
  const promiseValueType = getPromiseValueType(expr);
  let valueTypeAst: CSharpTypeAst = {
    kind: "predefinedType",
    keyword: "bool",
  };
  if (promiseValueType) {
    const [vTypeAst, valueTypeContext] = emitTypeAst(
      promiseValueType,
      currentContext
    );
    valueTypeAst = vTypeAst;
    currentContext = valueTypeContext;
  }

  const resolveParam =
    executor.kind === "arrowFunction" || executor.kind === "functionExpression"
      ? executor.parameters[0]
      : undefined;
  const resolveParamName =
    resolveParam?.pattern.kind === "identifierPattern"
      ? resolveParam.pattern.name
      : undefined;
  const promiseResolveValueTypes =
    resolveParamName !== undefined && promiseValueType
      ? new Map(currentContext.promiseResolveValueTypes ?? [])
      : undefined;
  if (
    promiseResolveValueTypes &&
    promiseValueType &&
    resolveParamName !== undefined
  ) {
    promiseResolveValueTypes.set(resolveParamName, promiseValueType);
  }

  const executorEmitContext = resolveParamName
    ? {
        ...currentContext,
        voidResolveNames: promiseValueType
          ? currentContext.voidResolveNames
          : new Set([resolveParamName]),
        promiseResolveValueTypes:
          promiseResolveValueTypes ?? currentContext.promiseResolveValueTypes,
      }
    : currentContext;

  const resolveParamHasVoidGeneric =
    resolveParam?.type?.kind === "functionType" &&
    resolveParam.type.parameters.some((p) =>
      containsVoidInGenericPosition(p.type)
    );
  const resolveParamNeedsPromiseLikeNormalization =
    promiseValueType !== undefined &&
    resolveParam?.type?.kind === "functionType" &&
    resolveParam.type.parameters.some((p) => p.type?.kind === "unionType");
  const emittedExecutor =
    (resolveParamHasVoidGeneric || resolveParamNeedsPromiseLikeNormalization) &&
    (executor.kind === "arrowFunction" ||
      executor.kind === "functionExpression")
      ? {
          ...executor,
          parameters: executor.parameters.map((p, i) =>
            i === 0 ? { ...p, type: undefined } : p
          ),
        }
      : executor;
  const executorExpectedType = normalizePromiseExecutorExpectedType(
    expr,
    promiseValueType
  );

  const [executorAst, executorContext] = emitExpressionAst(
    emittedExecutor,
    executorEmitContext,
    executorExpectedType
  );
  currentContext = resolveParamName
    ? {
        ...executorContext,
        voidResolveNames: currentContext.voidResolveNames,
        promiseResolveValueTypes: currentContext.promiseResolveValueTypes,
      }
    : executorContext;

  const executorArity = getExecutorArity(expr);

  const tcsTypeAst: CSharpTypeAst = identifierType(
    "global::System.Threading.Tasks.TaskCompletionSource",
    [valueTypeAst]
  );

  const resolveCallbackTypeAst: CSharpTypeAst = promiseValueType
    ? identifierType("global::System.Action", [valueTypeAst])
    : identifierType("global::System.Action");

  const rejectCallbackTypeAst: CSharpTypeAst = identifierType(
    "global::System.Action",
    [
      {
        kind: "nullableType",
        underlyingType: { kind: "predefinedType", keyword: "object" },
      },
    ]
  );

  const executorDelegateTypeAst: CSharpTypeAst =
    executorArity >= 2
      ? identifierType("global::System.Action", [
          resolveCallbackTypeAst,
          rejectCallbackTypeAst,
        ])
      : identifierType("global::System.Action", [resolveCallbackTypeAst]);

  const resolveLambda: CSharpExpressionAst = promiseValueType
    ? {
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: "value", type: valueTypeAst }],
        body: {
          kind: "blockStatement",
          statements: [
            {
              kind: "expressionStatement",
              expression: {
                kind: "invocationExpression",
                expression: {
                  kind: "memberAccessExpression",
                  expression: {
                    kind: "identifierExpression",
                    identifier: "__tsonic_tcs",
                  },
                  memberName: "TrySetResult",
                },
                arguments: [
                  { kind: "identifierExpression", identifier: "value" },
                ],
              },
            },
          ],
        },
      }
    : {
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [],
        body: {
          kind: "blockStatement",
          statements: [
            {
              kind: "expressionStatement",
              expression: {
                kind: "invocationExpression",
                expression: {
                  kind: "memberAccessExpression",
                  expression: {
                    kind: "identifierExpression",
                    identifier: "__tsonic_tcs",
                  },
                  memberName: "TrySetResult",
                },
                arguments: [booleanLiteral(true)],
              },
            },
          ],
        },
      };

  const rejectLambda: CSharpExpressionAst = {
    kind: "lambdaExpression",
    isAsync: false,
    parameters: [
      {
        name: "error",
        type: {
          kind: "nullableType",
          underlyingType: { kind: "predefinedType", keyword: "object" },
        },
      },
    ],
    body: {
      kind: "blockStatement",
      statements: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "invocationExpression",
            expression: {
              kind: "memberAccessExpression",
              expression: {
                kind: "identifierExpression",
                identifier: "__tsonic_tcs",
              },
              memberName: "TrySetException",
            },
            arguments: [
              {
                kind: "binaryExpression",
                operatorToken: "??",
                left: {
                  kind: "asExpression",
                  expression: {
                    kind: "identifierExpression",
                    identifier: "error",
                  },
                  type: identifierType("global::System.Exception"),
                },
                right: {
                  kind: "objectCreationExpression",
                  type: identifierType("global::System.Exception"),
                  arguments: [
                    {
                      kind: "binaryExpression",
                      operatorToken: "??",
                      left: {
                        kind: "invocationExpression",
                        expression: {
                          kind: "conditionalMemberAccessExpression",
                          expression: {
                            kind: "identifierExpression",
                            identifier: "error",
                          },
                          memberName: "ToString",
                        },
                        arguments: [],
                      },
                      right: stringLiteral("Promise rejected"),
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };

  const invokeTarget: CSharpExpressionAst = {
    kind: "parenthesizedExpression",
    expression: {
      kind: "castExpression",
      type: executorDelegateTypeAst,
      expression: {
        kind: "parenthesizedExpression",
        expression: executorAst,
      },
    },
  };

  const invokeArgs: CSharpExpressionAst[] =
    executorArity >= 2
      ? [
          { kind: "identifierExpression", identifier: "__tsonic_resolve" },
          { kind: "identifierExpression", identifier: "__tsonic_reject" },
        ]
      : [{ kind: "identifierExpression", identifier: "__tsonic_resolve" }];

  const bodyStatements: CSharpStatementAst[] = [
    {
      kind: "localDeclarationStatement",
      modifiers: [],
      type: { kind: "varType" },
      declarators: [
        {
          name: "__tsonic_tcs",
          initializer: {
            kind: "objectCreationExpression",
            type: tcsTypeAst,
            arguments: [],
          },
        },
      ],
    },
    {
      kind: "localDeclarationStatement",
      modifiers: [],
      type: resolveCallbackTypeAst,
      declarators: [{ name: "__tsonic_resolve", initializer: resolveLambda }],
    },
    {
      kind: "localDeclarationStatement",
      modifiers: [],
      type: rejectCallbackTypeAst,
      declarators: [{ name: "__tsonic_reject", initializer: rejectLambda }],
    },
    {
      kind: "tryStatement",
      body: {
        kind: "blockStatement",
        statements: [
          {
            kind: "expressionStatement",
            expression: {
              kind: "invocationExpression",
              expression: invokeTarget,
              arguments: invokeArgs,
            },
          },
        ],
      },
      catches: [
        {
          type: identifierType("global::System.Exception"),
          identifier: "ex",
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: {
                  kind: "invocationExpression",
                  expression: {
                    kind: "memberAccessExpression",
                    expression: {
                      kind: "identifierExpression",
                      identifier: "__tsonic_tcs",
                    },
                    memberName: "TrySetException",
                  },
                  arguments: [
                    { kind: "identifierExpression", identifier: "ex" },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
    {
      kind: "returnStatement",
      expression: {
        kind: "memberAccessExpression",
        expression: {
          kind: "identifierExpression",
          identifier: "__tsonic_tcs",
        },
        memberName: "Task",
      },
    },
  ];

  return [
    buildInvokedLambdaExpressionAst({
      parameters: [],
      parameterTypes: [],
      body: {
        kind: "blockStatement",
        statements: bodyStatements,
      },
      arguments: [],
      returnType: taskTypeAst,
      context: currentContext,
    }),
    currentContext,
  ];
};
