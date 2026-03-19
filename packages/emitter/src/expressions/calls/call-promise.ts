/**
 * Promise and async call emission.
 * Handles Promise.resolve/reject/all/race as Task equivalents,
 * and .then/.catch/.finally chains.
 */

import {
  getAwaitedIrType,
  isAwaitableIrType,
  IrBlockStatement,
  IrExpression,
  IrStatement,
  IrType,
  normalizedUnionType,
  stableIrTypeKey,
} from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../type-emitter.js";
import type {
  CSharpBlockStatementAst,
  CSharpCatchClauseAst,
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import {
  identifierExpression,
  identifierType,
  nullLiteral,
  stringLiteral,
} from "../../core/format/backend-ast/builders.js";
import { getIdentifierTypeLeafName } from "../../core/format/backend-ast/utils.js";
import { isAsyncWrapperType, isPromiseChainMethod } from "./call-analysis.js";
import { emitRuntimeCarrierTypeAst } from "../../core/semantic/runtime-unions.js";

const isTaskTypeAst = (typeAst: CSharpTypeAst): boolean =>
  getIdentifierTypeLeafName(typeAst) === "Task";

const containsVoidTypeAst = (typeAst: CSharpTypeAst): boolean => {
  if (typeAst.kind === "predefinedType" && typeAst.keyword === "void") {
    return true;
  }
  if (typeAst.kind === "identifierType") {
    if (typeAst.name === "void") {
      return true;
    }
    return (typeAst.typeArguments ?? []).some((t) => containsVoidTypeAst(t));
  }
  if (typeAst.kind === "qualifiedIdentifierType") {
    if (getIdentifierTypeLeafName(typeAst) === "void") {
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
): CSharpTypeAst | undefined => {
  if (!isTaskTypeAst(typeAst)) {
    return undefined;
  }
  if (
    typeAst.kind !== "identifierType" &&
    typeAst.kind !== "qualifiedIdentifierType"
  ) {
    return undefined;
  }
  return typeAst.typeArguments?.length === 1
    ? typeAst.typeArguments[0]
    : undefined;
};

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

const collectBlockReturnTypes = (
  block: IrBlockStatement
): readonly IrType[] => {
  const collectFromStatement = (statement: IrStatement): readonly IrType[] => {
    switch (statement.kind) {
      case "returnStatement":
        return statement.expression?.inferredType
          ? [statement.expression.inferredType]
          : [];
      case "blockStatement":
        return statement.statements.flatMap(collectFromStatement);
      case "ifStatement":
        return [
          ...collectFromStatement(statement.thenStatement),
          ...(statement.elseStatement
            ? collectFromStatement(statement.elseStatement)
            : []),
        ];
      case "whileStatement":
      case "forStatement":
      case "forOfStatement":
      case "forInStatement":
        return collectFromStatement(statement.body);
      case "switchStatement":
        return statement.cases.flatMap((switchCase) =>
          switchCase.statements.flatMap(collectFromStatement)
        );
      case "tryStatement":
        return [
          ...statement.tryBlock.statements.flatMap(collectFromStatement),
          ...(statement.catchClause
            ? statement.catchClause.body.statements.flatMap(
                collectFromStatement
              )
            : []),
          ...(statement.finallyBlock
            ? statement.finallyBlock.statements.flatMap(collectFromStatement)
            : []),
        ];
      case "functionDeclaration":
      case "classDeclaration":
      case "interfaceDeclaration":
      case "enumDeclaration":
      case "typeAliasDeclaration":
        return [];
      default:
        return [];
    }
  };

  return block.statements.flatMap(collectFromStatement);
};

const getCallbackDelegateReturnType = (
  callbackExpr: IrExpression
): IrType | undefined => {
  if (
    (callbackExpr.kind === "arrowFunction" ||
      callbackExpr.kind === "functionExpression") &&
    callbackExpr.body.kind === "blockStatement"
  ) {
    const returnTypes = collectBlockReturnTypes(callbackExpr.body);
    const concreteReturnTypes = returnTypes.filter(
      (type): type is IrType => !isVoidOrUnknownIrType(type)
    );

    if (concreteReturnTypes.length === 0) {
      return undefined;
    }

    const deduped = concreteReturnTypes.filter(
      (type, index, all) =>
        all.findIndex(
          (candidate) => stableIrTypeKey(candidate) === stableIrTypeKey(type)
        ) === index
    );

    if (deduped.length === 1) {
      return deduped[0];
    }

    return {
      kind: "unionType",
      types: deduped,
    };
  }

  return getCallbackReturnType(callbackExpr);
};

const callbackReturnsAsyncWrapper = (callbackExpr: IrExpression): boolean => {
  const delegateReturnType = getCallbackDelegateReturnType(callbackExpr);
  return delegateReturnType ? isAsyncWrapperType(delegateReturnType) : false;
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

export const buildDelegateType = (
  parameterTypes: readonly CSharpTypeAst[],
  returnType: CSharpTypeAst | undefined
): CSharpTypeAst => {
  const isVoidReturn =
    returnType?.kind === "predefinedType" && returnType.keyword === "void";
  if (returnType === undefined) {
    return parameterTypes.length === 0
      ? identifierType("global::System.Action")
      : identifierType("global::System.Action", parameterTypes);
  }
  if (isVoidReturn || getIdentifierTypeLeafName(returnType) === "void") {
    return parameterTypes.length === 0
      ? identifierType("global::System.Action")
      : identifierType("global::System.Action", parameterTypes);
  }

  return identifierType("global::System.Func", [...parameterTypes, returnType]);
};

const isVoidOrUnknownIrType = (type: IrType | undefined): boolean =>
  type === undefined ||
  type.kind === "voidType" ||
  type.kind === "unknownType" ||
  (type.kind === "primitiveType" && type.name === "undefined");

const getCallbackReturnType = (
  callbackExpr: IrExpression
): IrType | undefined => {
  if (
    callbackExpr.kind === "arrowFunction" &&
    callbackExpr.body.kind !== "blockStatement" &&
    !isVoidOrUnknownIrType(callbackExpr.body.inferredType)
  ) {
    return callbackExpr.body.inferredType;
  }

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

const isAsyncWrapperIrTypeLike = (type: IrType): boolean => {
  return isAwaitableIrType(type);
};

const containsPromiseChainArtifact = (type: IrType | undefined): boolean => {
  if (!type) return false;

  if (isAsyncWrapperIrTypeLike(type)) {
    return true;
  }

  if (type.kind === "unionType" || type.kind === "intersectionType") {
    return type.types.some(
      (member) => !!member && containsPromiseChainArtifact(member)
    );
  }

  return false;
};

const normalizePromiseChainResultIrType = (
  type: IrType | undefined
): IrType | undefined => {
  if (!type) return undefined;

  const awaited = getAwaitedIrType(type);
  if (awaited) {
    return awaited.kind === "voidType"
      ? awaited
      : normalizePromiseChainResultIrType(awaited);
  }

  if (type.kind === "unionType") {
    const normalizedTypes: IrType[] = [];
    const seen = new Set<string>();

    for (const member of type.types) {
      if (!member) continue;
      const normalized = normalizePromiseChainResultIrType(member);
      if (!normalized) continue;
      const key = stableIrTypeKey(normalized);
      if (seen.has(key)) continue;
      seen.add(key);
      normalizedTypes.push(normalized);
    }

    if (normalizedTypes.length === 0) return undefined;
    if (normalizedTypes.length === 1) return normalizedTypes[0];
    return normalizedUnionType(normalizedTypes);
  }

  return type;
};

const mergePromiseChainResultIrTypes = (
  ...types: readonly (IrType | undefined)[]
): IrType | undefined => {
  const merged: IrType[] = [];
  const seen = new Set<string>();

  for (const type of types) {
    const normalized = normalizePromiseChainResultIrType(type);
    if (!normalized) continue;

    if (normalized.kind === "unionType") {
      for (const member of normalized.types) {
        if (!member) continue;
        const key = stableIrTypeKey(member);
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(member);
      }
      continue;
    }

    const key = stableIrTypeKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(normalized);
  }

  if (merged.length === 0) return undefined;
  if (merged.length === 1) return merged[0];
  return normalizedUnionType(merged);
};

const buildTaskTypeAst = (
  resultType: CSharpTypeAst | undefined
): CSharpTypeAst =>
  resultType
    ? identifierType("global::System.Threading.Tasks.Task", [resultType])
    : identifierType("global::System.Threading.Tasks.Task");

export const buildTaskRunInvocation = (
  outputTaskType: CSharpTypeAst,
  body: CSharpBlockStatementAst,
  isAsync: boolean
): CSharpExpressionAst => {
  const resultType = getTaskResultType(outputTaskType);
  return {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: identifierExpression("global::System.Threading.Tasks.Task"),
      memberName: "Run",
    },
    arguments: [
      {
        kind: "lambdaExpression",
        isAsync,
        parameters: [],
        body,
      },
    ],
    typeArguments: resultType ? [resultType] : undefined,
  };
};

export const buildCompletedTaskAst = (): CSharpExpressionAst => ({
  kind: "memberAccessExpression",
  expression: identifierExpression("global::System.Threading.Tasks.Task"),
  memberName: "CompletedTask",
});

const buildPromiseRejectedExceptionAst = (
  reasonAst: CSharpExpressionAst | undefined
): CSharpExpressionAst => {
  const reasonExpr = reasonAst ?? (nullLiteral() satisfies CSharpExpressionAst);

  return {
    kind: "binaryExpression",
    operatorToken: "??",
    left: {
      kind: "asExpression",
      expression: reasonExpr,
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
              expression: reasonExpr,
              memberName: "ToString",
            },
            arguments: [],
          },
          right: {
            ...stringLiteral("Promise rejected"),
          },
        },
      ],
    },
  };
};

const getPromiseStaticMethod = (
  expr: Extract<IrExpression, { kind: "call" }>
): "resolve" | "reject" | "all" | "race" | undefined => {
  if (expr.callee.kind !== "memberAccess") return undefined;
  if (expr.callee.isComputed) return undefined;
  if (typeof expr.callee.property !== "string") return undefined;
  if (expr.callee.object.kind !== "identifier") return undefined;

  const objectName = expr.callee.object.originalName ?? expr.callee.object.name;
  const simpleObjectName = objectName.split(".").pop() ?? objectName;
  if (simpleObjectName !== "Promise") return undefined;

  switch (expr.callee.property) {
    case "resolve":
    case "reject":
    case "all":
    case "race":
      return expr.callee.property;
    default:
      return undefined;
  }
};

const getSequenceElementIrType = (
  type: IrType | undefined
): IrType | undefined => {
  if (!type) return undefined;

  if (type.kind === "arrayType") return type.elementType;
  if (type.kind === "tupleType") {
    if (type.elementTypes.length === 0) return undefined;
    if (type.elementTypes.length === 1) return type.elementTypes[0];
    return normalizedUnionType(type.elementTypes);
  }

  if (
    type.kind === "referenceType" &&
    type.typeArguments &&
    type.typeArguments.length > 0
  ) {
    const simpleName = type.name.split(".").pop() ?? type.name;
    switch (simpleName) {
      case "Array":
      case "ReadonlyArray":
      case "Iterable":
      case "IterableIterator":
      case "IEnumerable":
      case "IReadOnlyList":
      case "List":
      case "Set":
      case "ReadonlySet":
      case "JSArray":
        return type.typeArguments[0];
      default:
        return undefined;
    }
  }

  return undefined;
};

const isValueTaskLikeIrType = (type: IrType | undefined): boolean => {
  if (!type || type.kind !== "referenceType") return false;
  const simpleName = type.name.split(".").pop() ?? type.name;
  const clrName = type.resolvedClrType ?? type.name;
  return (
    simpleName === "ValueTask" ||
    simpleName === "ValueTask_1" ||
    simpleName === "ValueTask`1" ||
    clrName === "System.Threading.Tasks.ValueTask" ||
    clrName.startsWith("System.Threading.Tasks.ValueTask`1")
  );
};

const emitPromiseNormalizedTaskAst = (
  valueAst: CSharpExpressionAst,
  valueType: IrType | undefined,
  resultTypeAst: CSharpTypeAst | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;

  if (valueType && isAwaitableIrType(valueType)) {
    if (isValueTaskLikeIrType(valueType)) {
      return [
        {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: valueAst,
            memberName: "AsTask",
          },
          arguments: [],
        },
        currentContext,
      ];
    }
    return [valueAst, currentContext];
  }

  if (valueType) {
    const [, runtimeLayout, emittedUnionTypeContext] =
      emitRuntimeCarrierTypeAst(valueType, currentContext, emitTypeAst);
    currentContext = emittedUnionTypeContext;
    if (!runtimeLayout) {
      if (!resultTypeAst) {
        return [buildCompletedTaskAst(), currentContext];
      }

      return [
        {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: identifierExpression(
              "global::System.Threading.Tasks.Task"
            ),
            memberName: "FromResult",
          },
          typeArguments: [resultTypeAst],
          arguments: [valueAst],
        },
        currentContext,
      ];
    }

    const members = runtimeLayout.members;
    const memberTypeAsts: CSharpTypeAst[] = [...runtimeLayout.memberTypeAsts];
    const arms: CSharpExpressionAst[] = [];
    for (let index = 0; index < members.length; index++) {
      const memberType = members[index];
      if (!memberType) continue;

      let memberTypeAst = memberTypeAsts[index];
      if (!memberTypeAst) {
        const [emittedMemberTypeAst, memberTypeContext] = emitTypeAst(
          memberType,
          currentContext
        );
        currentContext = memberTypeContext;
        memberTypeAst = emittedMemberTypeAst;
        memberTypeAsts[index] = emittedMemberTypeAst;
      }

      const memberName = `__tsonic_promise_value_${index}`;
      const [normalizedArm, normalizedContext] = emitPromiseNormalizedTaskAst(
        {
          kind: "identifierExpression",
          identifier: memberName,
        },
        memberType,
        resultTypeAst,
        currentContext
      );
      currentContext = normalizedContext;

      arms.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [
          {
            name: memberName,
            type:
              memberTypeAst ??
              ({
                kind: "predefinedType",
                keyword: "object",
              } satisfies CSharpTypeAst),
          },
        ],
        body: normalizedArm,
      });
    }

    return [
      {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: valueAst,
          memberName: "Match",
        },
        arguments: arms,
      },
      currentContext,
    ];
  }

  if (!resultTypeAst) {
    return [buildCompletedTaskAst(), currentContext];
  }

  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: identifierExpression("global::System.Threading.Tasks.Task"),
        memberName: "FromResult",
      },
      typeArguments: [resultTypeAst],
      arguments: [valueAst],
    },
    currentContext,
  ];
};

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
        : [
            {
              kind: "returnStatement",
              expression: buildAwait(receiverAst),
            },
          ];
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

export { isPromiseChainMethod } from "./call-analysis.js";
