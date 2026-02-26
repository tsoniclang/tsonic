/**
 * New expression emitter
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import {
  emitTypeArgumentsAst,
  generateSpecializedName,
} from "../identifiers.js";
import { emitTypeAst } from "../../type-emitter.js";
import { isLValue, getPassingModifierFromCast } from "./call-analysis.js";
import { extractCalleeNameFromAst } from "../../core/format/backend-ast/utils.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";

/**
 * Check if a new expression is new List<T>([...]) with an array literal argument
 */
const isListConstructorWithArrayLiteral = (
  expr: Extract<IrExpression, { kind: "new" }>
): boolean => {
  const inferredType = expr.inferredType;
  if (inferredType?.kind !== "referenceType") {
    return false;
  }
  const typeId = inferredType.typeId;
  if (
    !typeId ||
    !typeId.clrName.startsWith("System.Collections.Generic.List")
  ) {
    return false;
  }

  if (!expr.typeArguments || expr.typeArguments.length !== 1) {
    return false;
  }

  if (expr.callee.kind !== "identifier" || expr.callee.name !== "List") {
    return false;
  }

  if (expr.arguments.length !== 1) {
    return false;
  }

  const arg = expr.arguments[0];
  if (!arg || arg.kind === "spread" || arg.kind !== "array") {
    return false;
  }

  for (const element of arg.elements) {
    if (!element || element.kind === "spread") {
      return false;
    }
  }

  return true;
};

/**
 * Emit new List<T>([...]) as collection initializer: new List<T> { ... }
 */
const emitListCollectionInitializer = (
  expr: Extract<IrExpression, { kind: "new" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;

  const [calleeAst, calleeContext] = emitExpressionAst(
    expr.callee,
    currentContext
  );
  currentContext = calleeContext;
  let calleeText = extractCalleeNameFromAst(calleeAst);

  let typeArgAsts: readonly CSharpTypeAst[] = [];
  if (expr.typeArguments && expr.typeArguments.length > 0) {
    if (expr.requiresSpecialization) {
      const [specializedName, specContext] = generateSpecializedName(
        calleeText,
        expr.typeArguments,
        currentContext
      );
      calleeText = specializedName;
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

  const arrayLiteral = expr.arguments[0] as Extract<
    IrExpression,
    { kind: "array" }
  >;

  const elemAsts: CSharpExpressionAst[] = [];
  for (const element of arrayLiteral.elements) {
    if (element === undefined) {
      continue;
    }
    if (element.kind === "spread") {
      const [fallbackAst, fallbackContext] = emitNew(expr, currentContext);
      return [fallbackAst, fallbackContext];
    } else {
      const [elemAst, ctx] = emitExpressionAst(element, currentContext);
      elemAsts.push(elemAst);
      currentContext = ctx;
    }
  }

  const typeAst: CSharpTypeAst =
    typeArgAsts.length > 0
      ? { kind: "identifierType", name: calleeText, typeArguments: typeArgAsts }
      : { kind: "identifierType", name: calleeText };

  const result: CSharpExpressionAst = {
    kind: "objectCreationExpression",
    type: typeAst,
    arguments: elemAsts.length === 0 ? [] : [],
    initializer: elemAsts.length > 0 ? elemAsts : undefined,
  };

  return [result, currentContext];
};

/**
 * Check if a new expression is new Array<T>(size)
 */
const isArrayConstructorCall = (
  expr: Extract<IrExpression, { kind: "new" }>
): boolean => {
  if (expr.callee.kind !== "identifier" || expr.callee.name !== "Array") {
    return false;
  }

  if (!expr.typeArguments || expr.typeArguments.length !== 1) {
    return false;
  }

  return true;
};

/**
 * Emit new Array<T>(size) as new T[size]
 */
const emitArrayConstructor = (
  expr: Extract<IrExpression, { kind: "new" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;

  const typeArgs = expr.typeArguments;
  const elementType = typeArgs?.[0];
  if (!elementType) {
    return [
      {
        kind: "arrayCreationExpression",
        elementType: { kind: "predefinedType", keyword: "object" },
        sizeExpression: { kind: "literalExpression", text: "0" },
      },
      currentContext,
    ];
  }
  const [elementTypeAst, typeContext] = emitTypeAst(
    elementType,
    currentContext
  );
  currentContext = typeContext;

  let sizeAstNode: CSharpExpressionAst = {
    kind: "literalExpression",
    text: "0",
  };
  if (expr.arguments.length > 0) {
    const sizeArg = expr.arguments[0];
    if (sizeArg && sizeArg.kind !== "spread") {
      const [sizeAst, sizeContext] = emitExpressionAst(sizeArg, currentContext);
      sizeAstNode = sizeAst;
      currentContext = sizeContext;
    }
  }

  const result: CSharpExpressionAst = {
    kind: "arrayCreationExpression",
    elementType: elementTypeAst,
    sizeExpression: sizeAstNode,
  };
  return [result, currentContext];
};

const isPromiseConstructorCall = (
  expr: Extract<IrExpression, { kind: "new" }>
): boolean => {
  return expr.callee.kind === "identifier" && expr.callee.name === "Promise";
};

const isVoidLikeType = (type: IrType | undefined): boolean => {
  if (!type) return false;
  return (
    type.kind === "voidType" ||
    (type.kind === "primitiveType" && type.name === "undefined")
  );
};

/**
 * Check if a type contains `void` in a position where it would be emitted
 * as a C# generic type argument.
 */
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

const getExecutorArity = (
  expr: Extract<IrExpression, { kind: "new" }>
): number => {
  const executor = expr.arguments[0];
  if (
    executor &&
    executor.kind !== "spread" &&
    (executor.kind === "arrowFunction" ||
      executor.kind === "functionExpression")
  ) {
    return executor.parameters.length;
  }

  const executorType = expr.parameterTypes?.[0];
  if (executorType?.kind === "functionType") {
    return executorType.parameters.length;
  }

  return 1;
};

const emitPromiseConstructor = (
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
    : [
        {
          kind: "identifierType" as const,
          name: "global::System.Threading.Tasks.Task",
        },
        currentContext,
      ];
  currentContext = taskTypeContext;
  const taskTypeAst: CSharpTypeAst =
    taskTypeAstRaw.kind === "identifierType" && taskTypeAstRaw.name.length === 0
      ? { kind: "identifierType", name: "global::System.Threading.Tasks.Task" }
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

  // Track resolve parameter name for void promise
  const resolveParam =
    !promiseValueType &&
    (executor.kind === "arrowFunction" ||
      executor.kind === "functionExpression")
      ? executor.parameters[0]
      : undefined;
  const resolveParamName =
    resolveParam?.pattern.kind === "identifierPattern"
      ? resolveParam.pattern.name
      : undefined;

  const executorEmitContext = resolveParamName
    ? { ...currentContext, voidResolveNames: new Set([resolveParamName]) }
    : currentContext;

  const resolveParamHasVoidGeneric =
    resolveParam?.type?.kind === "functionType" &&
    resolveParam.type.parameters.some((p) =>
      containsVoidInGenericPosition(p.type)
    );
  const emittedExecutor =
    resolveParamHasVoidGeneric &&
    (executor.kind === "arrowFunction" ||
      executor.kind === "functionExpression")
      ? {
          ...executor,
          parameters: executor.parameters.map((p, i) =>
            i === 0 ? { ...p, type: undefined } : p
          ),
        }
      : executor;

  const [executorAst, executorContext] = emitExpressionAst(
    emittedExecutor,
    executorEmitContext,
    expr.parameterTypes?.[0]
  );
  currentContext = resolveParamName
    ? { ...executorContext, voidResolveNames: undefined }
    : executorContext;

  const executorArity = getExecutorArity(expr);

  const tcsTypeAst: CSharpTypeAst = {
    kind: "identifierType",
    name: "global::System.Threading.Tasks.TaskCompletionSource",
    typeArguments: [valueTypeAst],
  };

  const resolveCallbackTypeAst: CSharpTypeAst = promiseValueType
    ? {
        kind: "identifierType",
        name: "global::System.Action",
        typeArguments: [valueTypeAst],
      }
    : { kind: "identifierType", name: "global::System.Action" };

  const rejectCallbackTypeAst: CSharpTypeAst = {
    kind: "identifierType",
    name: "global::System.Action",
    typeArguments: [
      {
        kind: "nullableType",
        underlyingType: { kind: "identifierType", name: "object" },
      },
    ],
  };

  const executorDelegateTypeAst: CSharpTypeAst =
    executorArity >= 2
      ? {
          kind: "identifierType",
          name: "global::System.Action",
          typeArguments: [resolveCallbackTypeAst, rejectCallbackTypeAst],
        }
      : {
          kind: "identifierType",
          name: "global::System.Action",
          typeArguments: [resolveCallbackTypeAst],
        };

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
                arguments: [{ kind: "literalExpression", text: "true" }],
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
          underlyingType: { kind: "identifierType", name: "object" },
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
                  type: {
                    kind: "identifierType",
                    name: "global::System.Exception",
                  },
                },
                right: {
                  kind: "objectCreationExpression",
                  type: {
                    kind: "identifierType",
                    name: "global::System.Exception",
                  },
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
                      right: {
                        kind: "literalExpression",
                        text: '"Promise rejected"',
                      },
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
          type: { kind: "identifierType", name: "global::System.Exception" },
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

  // IIFE: ((System.Func<Task<T>>)(() => { body }))()
  const funcTypeAst: CSharpTypeAst = {
    kind: "identifierType",
    name: "global::System.Func",
    typeArguments: [taskTypeAst],
  };
  const lambdaAst: CSharpExpressionAst = {
    kind: "lambdaExpression",
    isAsync: false,
    parameters: [],
    body: {
      kind: "blockStatement",
      statements: bodyStatements,
    },
  };
  const castAst: CSharpExpressionAst = {
    kind: "castExpression",
    type: funcTypeAst,
    expression: {
      kind: "parenthesizedExpression",
      expression: lambdaAst,
    },
  };
  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "parenthesizedExpression",
        expression: castAst,
      },
      arguments: [],
    },
    currentContext,
  ];
};

/**
 * Emit a new expression as CSharpExpressionAst
 */
export const emitNew = (
  expr: Extract<IrExpression, { kind: "new" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  // Special case: new Array<T>(size) → new T[size]
  if (isArrayConstructorCall(expr)) {
    return emitArrayConstructor(expr, context);
  }

  // Special case: new List<T>([...]) → new List<T> { ... }
  if (isListConstructorWithArrayLiteral(expr)) {
    return emitListCollectionInitializer(expr, context);
  }

  // Promise constructor lowering
  if (isPromiseConstructorCall(expr)) {
    return emitPromiseConstructor(expr, context);
  }

  const [calleeAst, newContext] = emitExpressionAst(expr.callee, context);
  let currentContext = newContext;
  let calleeText = extractCalleeNameFromAst(calleeAst);

  let typeArgAsts: readonly CSharpTypeAst[] = [];

  if (expr.typeArguments && expr.typeArguments.length > 0) {
    if (expr.requiresSpecialization) {
      const [specializedName, specContext] = generateSpecializedName(
        calleeText,
        expr.typeArguments,
        currentContext
      );
      calleeText = specializedName;
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

  const argAsts: CSharpExpressionAst[] = [];
  const parameterTypes = expr.parameterTypes ?? [];
  for (let i = 0; i < expr.arguments.length; i++) {
    const arg = expr.arguments[i];
    if (!arg) continue;
    if (arg.kind === "spread") {
      const [spreadAst, ctx] = emitExpressionAst(
        arg.expression,
        currentContext
      );
      argAsts.push({
        kind: "argumentModifierExpression",
        modifier: "params",
        expression: spreadAst,
      });
      currentContext = ctx;
    } else {
      const expectedType = parameterTypes[i];
      const castModifier = getPassingModifierFromCast(arg);
      if (castModifier && isLValue(arg)) {
        const [argAst, ctx] = emitExpressionAst(arg, currentContext);
        argAsts.push({
          kind: "argumentModifierExpression",
          modifier: castModifier,
          expression: argAst,
        });
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
        argAsts.push(
          modifier
            ? {
                kind: "argumentModifierExpression",
                modifier,
                expression: argAst,
              }
            : argAst
        );
        currentContext = ctx;
      }
    }
  }

  const typeAst: CSharpTypeAst =
    typeArgAsts.length > 0
      ? { kind: "identifierType", name: calleeText, typeArguments: typeArgAsts }
      : { kind: "identifierType", name: calleeText };

  const result: CSharpExpressionAst = {
    kind: "objectCreationExpression",
    type: typeAst,
    arguments: argAsts,
  };
  return [result, currentContext];
};
