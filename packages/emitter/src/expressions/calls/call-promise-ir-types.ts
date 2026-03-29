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
import { isAsyncWrapperType } from "./call-analysis.js";

export const callbackParameterCount = (callbackExpr: IrExpression): number => {
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

const isVoidOrUnknownIrType = (type: IrType | undefined): boolean =>
  type === undefined ||
  type.kind === "voidType" ||
  type.kind === "unknownType" ||
  (type.kind === "primitiveType" && type.name === "undefined");

export const getCallbackReturnType = (
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

export const getCallbackDelegateReturnType = (
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

export const callbackReturnsAsyncWrapper = (
  callbackExpr: IrExpression
): boolean => {
  const delegateReturnType = getCallbackDelegateReturnType(callbackExpr);
  return delegateReturnType ? isAsyncWrapperType(delegateReturnType) : false;
};

const isAsyncWrapperIrTypeLike = (type: IrType): boolean =>
  isAwaitableIrType(type);

export const containsPromiseChainArtifact = (
  type: IrType | undefined
): boolean => {
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

export const normalizePromiseChainResultIrType = (
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

export const mergePromiseChainResultIrTypes = (
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

export const getSequenceElementIrType = (
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
        return type.typeArguments[0];
      default:
        return undefined;
    }
  }

  return undefined;
};

export const isValueTaskLikeIrType = (type: IrType | undefined): boolean => {
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
