import {
  getAwaitedIrType,
  IrType,
  isAwaitableIrType,
  normalizedUnionType,
} from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  identifierExpression,
  identifierType,
} from "../core/format/backend-ast/builders.js";
import {
  resolveTypeAlias,
  splitRuntimeNullishUnionMembers,
  stripNullish,
} from "../core/semantic/type-resolution.js";
import {
  emitRuntimeCarrierTypeAst,
  findRuntimeUnionMemberIndex,
} from "../core/semantic/runtime-unions.js";
import { buildRuntimeUnionFactoryCallAst } from "../core/semantic/runtime-union-projection.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";

const buildCompletedTaskAst = (): CSharpExpressionAst => ({
  kind: "memberAccessExpression",
  expression: identifierExpression("global::System.Threading.Tasks.Task"),
  memberName: "CompletedTask",
});

const buildTaskFromResultExpression = (
  exprAst: CSharpExpressionAst,
  resultTypeAst?: CSharpTypeAst
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: {
    kind: "memberAccessExpression",
    expression: identifierExpression("global::System.Threading.Tasks.Task"),
    memberName: "FromResult",
  },
  typeArguments: resultTypeAst ? [resultTypeAst] : undefined,
  arguments: [exprAst],
});

const buildTaskTypeAst = (resultTypeAst?: CSharpTypeAst): CSharpTypeAst =>
  resultTypeAst
    ? identifierType("global::System.Threading.Tasks.Task", [resultTypeAst])
    : identifierType("global::System.Threading.Tasks.Task");

const requiresExplicitTaskFromResultType = (
  exprAst: CSharpExpressionAst
): boolean =>
  exprAst.kind === "nullLiteralExpression" ||
  exprAst.kind === "defaultExpression";

const normalizeAwaitTaskResultType = (
  resultType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!resultType) {
    return undefined;
  }

  const resolved = resolveTypeAlias(stripNullish(resultType), context);
  const awaited = getAwaitedIrType(resolved);
  if (awaited) {
    return (
      normalizeAwaitTaskResultType(awaited, context) ?? {
        kind: "voidType",
      }
    );
  }

  if (resolved.kind !== "unionType") {
    return resolved;
  }

  const nonVoidMembers: IrType[] = [];
  let sawVoidOnlyMember = false;

  for (const member of resolved.types) {
    if (!member) {
      continue;
    }

    const normalized = normalizeAwaitTaskResultType(member, context);
    if (!normalized || normalized.kind === "voidType") {
      sawVoidOnlyMember = true;
      continue;
    }

    if (normalized.kind === "unionType") {
      nonVoidMembers.push(...normalized.types);
    } else {
      nonVoidMembers.push(normalized);
    }
  }

  if (nonVoidMembers.length === 0) {
    return sawVoidOnlyMember ? { kind: "voidType" } : undefined;
  }

  return nonVoidMembers.length === 1
    ? nonVoidMembers[0]
    : normalizedUnionType(nonVoidMembers);
};

const getAwaitTaskResultCarrierType = (
  resultType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  const normalizedResultType = normalizeAwaitTaskResultType(
    resultType,
    context
  );
  if (!normalizedResultType || normalizedResultType.kind === "voidType") {
    return undefined;
  }

  const runtimeNullishSplit =
    splitRuntimeNullishUnionMembers(normalizedResultType);
  if (!runtimeNullishSplit) {
    return normalizedResultType;
  }

  const nonNullishMembers = [...runtimeNullishSplit.nonNullishMembers];
  if (nonNullishMembers.length === 0) {
    return undefined;
  }

  if (nonNullishMembers.length === 1) {
    return nonNullishMembers[0];
  }

  return normalizedResultType.kind === "unionType" &&
    normalizedResultType.runtimeUnionLayout === "carrierSlotOrder"
    ? {
        ...normalizedResultType,
        types: nonNullishMembers,
      }
    : {
        kind: "unionType",
        types: nonNullishMembers,
      };
};

const buildDefaultTaskAst = (
  resultType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const carrierType = getAwaitTaskResultCarrierType(resultType, context);
  if (!carrierType) {
    return [buildCompletedTaskAst(), context];
  }

  const [resultTypeAst, , nextContext] = emitRuntimeCarrierTypeAst(
    carrierType,
    context,
    emitTypeAst
  );
  return [
    buildTaskFromResultExpression(
      {
        kind: "defaultExpression",
        type: resultTypeAst,
      },
      resultTypeAst
    ),
    nextContext,
  ];
};

const buildAwaitMatchResultTypeAst = (
  resultType: IrType | undefined,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const carrierType = getAwaitTaskResultCarrierType(resultType, context);
  if (!carrierType) {
    return [buildTaskTypeAst(), context];
  }

  const [resultTypeAst, , nextContext] = emitRuntimeCarrierTypeAst(
    carrierType,
    context,
    emitTypeAst
  );
  return [buildTaskTypeAst(resultTypeAst), nextContext];
};

const buildNullableAwaitableTaskAst = (
  valueAst: CSharpExpressionAst,
  valueType: IrType,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  if (isValueTaskLikeIrType(valueType)) {
    return [
      {
        kind: "binaryExpression",
        operatorToken: "??",
        left: {
          kind: "invocationExpression",
          expression: {
            kind: "conditionalMemberAccessExpression",
            expression: valueAst,
            memberName: "AsTask",
          },
          arguments: [],
        },
        right: buildCompletedTaskAst(),
      },
      context,
    ];
  }

  return [
    {
      kind: "binaryExpression",
      operatorToken: "??",
      left: valueAst,
      right: buildCompletedTaskAst(),
    },
    context,
  ];
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

const isDefinitelyNonAwaitableType = (type: IrType | undefined): boolean => {
  if (!type) return false;

  const runtimeNullishUnion = splitRuntimeNullishUnionMembers(type);
  const candidateMembers =
    runtimeNullishUnion?.nonNullishMembers ??
    (type.kind === "unionType" ? type.types : [type]);

  if (candidateMembers.length === 0) {
    return true;
  }

  return candidateMembers.every(
    (member) => member !== undefined && !isAwaitableIrType(member)
  );
};

const resolveSemanticAwaitNormalizationType = (
  type: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!type || type.kind === "unionType") {
    return type;
  }

  const resolved = resolveTypeAlias(stripNullish(type), context);
  return resolved.kind === "unionType" ? resolved : type;
};

const buildPromotedAwaitResultValueAst = (
  valueAst: CSharpExpressionAst,
  valueType: IrType,
  resultType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, CSharpTypeAst | undefined, EmitterContext] => {
  if (!resultType || resultType.kind === "voidType") {
    return [valueAst, undefined, context];
  }

  const carrierType = getAwaitTaskResultCarrierType(resultType, context);
  if (!carrierType) {
    return [valueAst, undefined, context];
  }

  const [resultTypeAst, runtimeLayout, resultTypeContext] =
    emitRuntimeCarrierTypeAst(carrierType, context, emitTypeAst);
  if (!runtimeLayout) {
    return [valueAst, resultTypeAst, resultTypeContext];
  }

  const runtimeMemberIndex = findRuntimeUnionMemberIndex(
    runtimeLayout.members,
    valueType,
    resultTypeContext
  );
  if (runtimeMemberIndex === undefined) {
    return [valueAst, resultTypeAst, resultTypeContext];
  }

  return [
    buildRuntimeUnionFactoryCallAst(
      resultTypeAst,
      runtimeMemberIndex + 1,
      valueAst
    ),
    resultTypeAst,
    resultTypeContext,
  ];
};

export const emitNormalizedAwaitTaskAst = (
  valueAst: CSharpExpressionAst,
  valueType: IrType | undefined,
  resultType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;
  const semanticValueType = resolveSemanticAwaitNormalizationType(
    valueType,
    currentContext
  );

  if (semanticValueType && semanticValueType !== valueType) {
    return emitNormalizedAwaitTaskAst(
      valueAst,
      semanticValueType,
      resultType,
      currentContext
    );
  }

  if (isDefinitelyNonAwaitableType(valueType)) {
    const shouldPromoteToResultType =
      !!valueType &&
      valueType.kind !== "unionType" &&
      !!resultType &&
      resultType.kind !== "voidType";
    const [promotedValueAst, promotedResultTypeAst, promotedContext] =
      shouldPromoteToResultType
        ? buildPromotedAwaitResultValueAst(
            valueAst,
            valueType,
            resultType,
            currentContext
          )
        : [valueAst, undefined, currentContext];
    currentContext = promotedContext;
    const explicitResultType =
      promotedResultTypeAst === undefined &&
      requiresExplicitTaskFromResultType(promotedValueAst)
        ? getAwaitTaskResultCarrierType(resultType ?? valueType, currentContext)
        : undefined;
    let resultTypeAst: CSharpTypeAst | undefined;
    let resultTypeContext = currentContext;
    if (explicitResultType) {
      [resultTypeAst, , resultTypeContext] = emitRuntimeCarrierTypeAst(
        explicitResultType,
        currentContext,
        emitTypeAst
      );
    }

    return [
      buildTaskFromResultExpression(
        promotedValueAst,
        promotedResultTypeAst ?? resultTypeAst
      ),
      resultTypeContext,
    ];
  }

  const runtimeNullishUnion = valueType
    ? splitRuntimeNullishUnionMembers(valueType)
    : undefined;
  if (runtimeNullishUnion?.hasRuntimeNullish) {
    const nonNullMembers = runtimeNullishUnion.nonNullishMembers;

    if (nonNullMembers.length === 0) {
      return buildDefaultTaskAst(resultType, currentContext);
    }

    const allNonAwaitableMembers = nonNullMembers.every(
      (member) => !isAwaitableIrType(member)
    );
    if (
      allNonAwaitableMembers &&
      resultType &&
      resultType.kind !== "voidType"
    ) {
      const arms: CSharpExpressionAst[] = [];
      for (let index = 0; index < nonNullMembers.length; index += 1) {
        const memberType = nonNullMembers[index];
        if (!memberType) continue;

        const memberName = `__tsonic_await_value_${index}`;
        const [promotedValueAst, promotedResultTypeAst, promotedContext] =
          buildPromotedAwaitResultValueAst(
            {
              kind: "identifierExpression",
              identifier: memberName,
            },
            memberType,
            resultType,
            currentContext
          );
        currentContext = promotedContext;

        arms.push({
          kind: "lambdaExpression",
          isAsync: false,
          parameters: [{ name: memberName }],
          body: buildTaskFromResultExpression(
            promotedValueAst,
            promotedResultTypeAst
          ),
        });
      }

      const [fallbackTaskAst, fallbackContext] = buildDefaultTaskAst(
        resultType,
        currentContext
      );
      currentContext = fallbackContext;
      const [matchResultTypeAst, matchResultTypeContext] =
        buildAwaitMatchResultTypeAst(resultType, currentContext);
      currentContext = matchResultTypeContext;

      return [
        {
          kind: "binaryExpression",
          operatorToken: "??",
          left: {
            kind: "invocationExpression",
            expression: {
              kind: "conditionalMemberAccessExpression",
              expression: valueAst,
              memberName: "Match",
            },
            typeArguments: [matchResultTypeAst],
            arguments: arms,
          },
          right: fallbackTaskAst,
        },
        currentContext,
      ];
    }

    if (nonNullMembers.length === 1) {
      const onlyMember = nonNullMembers[0];
      if (!onlyMember) {
        return buildDefaultTaskAst(resultType, currentContext);
      }

      if (isAwaitableIrType(onlyMember)) {
        return buildNullableAwaitableTaskAst(
          valueAst,
          onlyMember,
          currentContext
        );
      }

      return emitNormalizedAwaitTaskAst(
        valueAst,
        onlyMember,
        resultType,
        currentContext
      );
    }

    const arms: CSharpExpressionAst[] = [];
    for (let index = 0; index < nonNullMembers.length; index += 1) {
      const memberType = nonNullMembers[index];
      if (!memberType) continue;

      const memberName = `__tsonic_await_value_${index}`;
      const [normalizedArm, normalizedContext] = emitNormalizedAwaitTaskAst(
        {
          kind: "identifierExpression",
          identifier: memberName,
        },
        memberType,
        resultType,
        currentContext
      );
      currentContext = normalizedContext;

      arms.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: memberName }],
        body: normalizedArm,
      });
    }

    const [fallbackTaskAst, fallbackContext] = buildDefaultTaskAst(
      resultType,
      currentContext
    );
    currentContext = fallbackContext;
    const [matchResultTypeAst, matchResultTypeContext] =
      buildAwaitMatchResultTypeAst(resultType, currentContext);
    currentContext = matchResultTypeContext;

    return [
      {
        kind: "binaryExpression",
        operatorToken: "??",
        left: {
          kind: "invocationExpression",
          expression: {
            kind: "conditionalMemberAccessExpression",
            expression: valueAst,
            memberName: "Match",
          },
          typeArguments: [matchResultTypeAst],
          arguments: arms,
        },
        right: fallbackTaskAst,
      },
      currentContext,
    ];
  }

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

  if (valueType?.kind === "unionType") {
    const arms: CSharpExpressionAst[] = [];

    for (let index = 0; index < valueType.types.length; index += 1) {
      const memberType = valueType.types[index];
      if (!memberType) continue;

      const memberName = `__tsonic_await_value_${index}`;
      const [normalizedArm, normalizedContext] = emitNormalizedAwaitTaskAst(
        {
          kind: "identifierExpression",
          identifier: memberName,
        },
        memberType,
        resultType,
        currentContext
      );
      currentContext = normalizedContext;

      arms.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: memberName }],
        body: normalizedArm,
      });
    }
    const [matchResultTypeAst, matchResultTypeContext] =
      buildAwaitMatchResultTypeAst(resultType, currentContext);
    currentContext = matchResultTypeContext;

    return [
      {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: valueAst,
          memberName: "Match",
        },
        typeArguments: [matchResultTypeAst],
        arguments: arms,
      },
      currentContext,
    ];
  }

  if (!resultType || resultType.kind === "voidType") {
    return [buildCompletedTaskAst(), currentContext];
  }

  const needsExplicitResultType = requiresExplicitTaskFromResultType(valueAst);
  const explicitCarrierType = needsExplicitResultType
    ? getAwaitTaskResultCarrierType(resultType, currentContext)
    : undefined;
  let resultTypeAst: CSharpTypeAst | undefined;
  let resultTypeContext = currentContext;
  if (explicitCarrierType) {
    [resultTypeAst, , resultTypeContext] = emitRuntimeCarrierTypeAst(
      explicitCarrierType,
      currentContext,
      emitTypeAst
    );
  }

  return [
    buildTaskFromResultExpression(valueAst, resultTypeAst),
    resultTypeContext,
  ];
};
