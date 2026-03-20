import type {
  CSharpBlockStatementAst,
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import {
  identifierExpression,
  identifierType,
} from "../../core/format/backend-ast/builders.js";
import { getIdentifierTypeLeafName } from "../../core/format/backend-ast/utils.js";

export const isTaskTypeAst = (typeAst: CSharpTypeAst): boolean =>
  getIdentifierTypeLeafName(typeAst) === "Task";

export const containsVoidTypeAst = (typeAst: CSharpTypeAst): boolean => {
  if (typeAst.kind === "predefinedType" && typeAst.keyword === "void") {
    return true;
  }
  if (typeAst.kind === "identifierType") {
    if (typeAst.name === "void") {
      return true;
    }
    return (typeAst.typeArguments ?? []).some((member) =>
      containsVoidTypeAst(member)
    );
  }
  if (typeAst.kind === "qualifiedIdentifierType") {
    if (getIdentifierTypeLeafName(typeAst) === "void") {
      return true;
    }
    return (typeAst.typeArguments ?? []).some((member) =>
      containsVoidTypeAst(member)
    );
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
    return typeAst.elements.some((element) =>
      containsVoidTypeAst(element.type)
    );
  }
  return false;
};

export const getTaskResultType = (
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

export const buildTaskTypeAst = (
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
