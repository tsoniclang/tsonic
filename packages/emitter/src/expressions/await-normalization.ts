import { IrType, isAwaitableIrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import { identifierExpression } from "../core/format/backend-ast/builders.js";
import { splitRuntimeNullishUnionMembers } from "../core/semantic/type-resolution.js";
import {
  buildRuntimeUnionLayout,
  findRuntimeUnionMemberIndex,
} from "../core/semantic/runtime-unions.js";
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

const buildUnionFactoryCallAst = (
  unionTypeAst: CSharpTypeAst,
  memberIndex: number,
  valueAst: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: {
    kind: "memberAccessExpression",
    expression: {
      kind: "typeReferenceExpression",
      type: unionTypeAst,
    },
    memberName: `From${memberIndex}`,
  },
  arguments: [valueAst],
});

const requiresExplicitTaskFromResultType = (
  exprAst: CSharpExpressionAst
): boolean =>
  exprAst.kind === "nullLiteralExpression" ||
  exprAst.kind === "defaultExpression";

const buildDefaultTaskAst = (
  resultType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  if (!resultType || resultType.kind === "voidType") {
    return [buildCompletedTaskAst(), context];
  }

  const [resultTypeAst, nextContext] = emitTypeAst(resultType, context);
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

const buildPromotedAwaitResultValueAst = (
  valueAst: CSharpExpressionAst,
  valueType: IrType,
  resultType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, CSharpTypeAst | undefined, EmitterContext] => {
  if (!resultType || resultType.kind === "voidType") {
    return [valueAst, undefined, context];
  }

  const [resultTypeAst, resultTypeContext] = emitTypeAst(resultType, context);
  if (resultType.kind !== "unionType") {
    return [valueAst, resultTypeAst, resultTypeContext];
  }

  const [runtimeLayout, layoutContext] = buildRuntimeUnionLayout(
    resultType,
    resultTypeContext,
    emitTypeAst
  );
  if (!runtimeLayout) {
    return [valueAst, resultTypeAst, resultTypeContext];
  }

  const runtimeMemberIndex = findRuntimeUnionMemberIndex(
    runtimeLayout.members,
    valueType,
    layoutContext
  );
  if (runtimeMemberIndex === undefined) {
    return [valueAst, resultTypeAst, layoutContext];
  }

  return [
    buildUnionFactoryCallAst(resultTypeAst, runtimeMemberIndex + 1, valueAst),
    resultTypeAst,
    layoutContext,
  ];
};

export const emitNormalizedAwaitTaskAst = (
  valueAst: CSharpExpressionAst,
  valueType: IrType | undefined,
  resultType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;

  if (isDefinitelyNonAwaitableType(valueType)) {
    const explicitResultType = requiresExplicitTaskFromResultType(valueAst)
      ? resultType ?? valueType
      : undefined;
    const [resultTypeAst, resultTypeContext] = explicitResultType
      ? emitTypeAst(explicitResultType, currentContext)
      : [undefined, currentContext];

    return [
      buildTaskFromResultExpression(valueAst, resultTypeAst),
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
    if (allNonAwaitableMembers && resultType && resultType.kind !== "voidType") {
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

  if (!resultType || resultType.kind === "voidType") {
    return [buildCompletedTaskAst(), currentContext];
  }

  const needsExplicitResultType = requiresExplicitTaskFromResultType(valueAst);
  const [resultTypeAst, resultTypeContext] = needsExplicitResultType
    ? emitTypeAst(resultType, currentContext)
    : [undefined, currentContext];

  return [
    buildTaskFromResultExpression(valueAst, resultTypeAst),
    resultTypeContext,
  ];
};
