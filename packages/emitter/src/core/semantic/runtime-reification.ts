import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import {
  identifierExpression,
  identifierType,
  nullLiteral,
  stringLiteral,
} from "../format/backend-ast/builders.js";
import {
  getIdentifierTypeName,
  stableTypeKeyFromAst,
} from "../format/backend-ast/utils.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../format/backend-ast/types.js";
import {
  buildRuntimeUnionFrame,
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
  emitRuntimeCarrierTypeAst,
  findRuntimeUnionMemberIndex,
} from "./runtime-unions.js";
import { resolveTypeAlias, stripNullish } from "./type-resolution.js";

export type EmitTypeAstFn = (
  type: IrType,
  context: EmitterContext
) => [CSharpTypeAst, EmitterContext];

export type RuntimeReificationPlan = {
  readonly condition: CSharpExpressionAst;
  readonly value: CSharpExpressionAst;
  readonly context: EmitterContext;
};

const unwrapNullableTypeAst = (typeAst: CSharpTypeAst): CSharpTypeAst =>
  typeAst.kind === "nullableType" ? typeAst.underlyingType : typeAst;

const getRuntimeUnionCastMemberTypeAsts = (
  valueAst: CSharpExpressionAst
): readonly CSharpTypeAst[] | undefined => {
  const unwrappedValueAst =
    valueAst.kind === "parenthesizedExpression"
      ? valueAst.expression
      : valueAst;
  if (unwrappedValueAst.kind !== "castExpression") {
    return undefined;
  }

  const castTypeAst = unwrapNullableTypeAst(unwrappedValueAst.type);
  if (!isRuntimeUnionTypeAst(castTypeAst)) {
    return undefined;
  }

  if (
    castTypeAst.kind !== "identifierType" &&
    castTypeAst.kind !== "qualifiedIdentifierType"
  ) {
    return undefined;
  }

  return castTypeAst.typeArguments?.map(unwrapNullableTypeAst);
};

const isRuntimeUnionTypeAst = (type: CSharpTypeAst): boolean => {
  const name = getIdentifierTypeName(type);
  return (
    name === "global::Tsonic.Runtime.Union" ||
    name === "Tsonic.Runtime.Union" ||
    name === "Union"
  );
};

const buildArrayShapeCondition = (
  valueAst: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: identifierExpression("global::Tsonic.JSRuntime.JSArrayStatics.isArray"),
  arguments: [valueAst],
});

const buildInvalidReificationExpression = (
  description: string
): CSharpExpressionAst => ({
  kind: "throwExpression",
  expression: {
    kind: "objectCreationExpression",
    type: identifierType("global::System.InvalidCastException"),
    arguments: [stringLiteral(description)],
  },
});

const buildInvalidRuntimeMaterializationExpression = (
  sourceType: IrType,
  targetType: IrType
): CSharpExpressionAst =>
  buildInvalidReificationExpression(
    `Cannot materialize runtime union ${sourceType.kind} to ${targetType.kind}`
  );

const buildMaterializationMatchAst = (
  valueAst: CSharpExpressionAst,
  lambdaArgs: readonly CSharpExpressionAst[]
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: {
    kind: "memberAccessExpression",
    expression: valueAst,
    memberName: "Match",
  },
  arguments: [...lambdaArgs],
});

const maybeCastMaterializedValueAst = (
  valueAst: CSharpExpressionAst,
  actualTypeAst: CSharpTypeAst | undefined,
  targetTypeAst: CSharpTypeAst
): CSharpExpressionAst => {
  if (
    actualTypeAst &&
    stableTypeKeyFromAst(actualTypeAst) === stableTypeKeyFromAst(targetTypeAst)
  ) {
    return valueAst;
  }

  return {
    kind: "castExpression",
    type: targetTypeAst,
    expression: valueAst,
  };
};

export const tryBuildRuntimeMaterializationAst = (
  valueAst: CSharpExpressionAst,
  sourceType: IrType,
  targetType: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn,
  selectedSourceMemberNs?: ReadonlySet<number>
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const [sourceLayout, sourceLayoutContext] = buildRuntimeUnionLayout(
    sourceType,
    context,
    emitTypeAst
  );
  if (!sourceLayout) {
    return undefined;
  }

  const [targetLayout, targetLayoutContext] = buildRuntimeUnionLayout(
    targetType,
    sourceLayoutContext,
    emitTypeAst
  );

  if (targetLayout) {
    const concreteTargetUnionTypeAst = buildRuntimeUnionTypeAst(targetLayout);
    const expectedMemberIndexByAstKey = new Map<string, number>();
    for (
      let index = 0;
      index < targetLayout.memberTypeAsts.length;
      index += 1
    ) {
      const memberTypeAst = targetLayout.memberTypeAsts[index];
      if (!memberTypeAst) {
        continue;
      }
      expectedMemberIndexByAstKey.set(
        stableTypeKeyFromAst(memberTypeAst),
        index
      );
    }

    const lambdaArgs: CSharpExpressionAst[] = [];
    for (let index = 0; index < sourceLayout.members.length; index += 1) {
      const actualMember = sourceLayout.members[index];
      if (!actualMember) {
        continue;
      }

      const parameterName = `__tsonic_union_member_${index + 1}`;
      const parameterExpr: CSharpExpressionAst = {
        kind: "identifierExpression",
        identifier: parameterName,
      };

      if (
        selectedSourceMemberNs &&
        !selectedSourceMemberNs.has(index + 1)
      ) {
        lambdaArgs.push({
          kind: "lambdaExpression",
          isAsync: false,
          parameters: [{ name: parameterName }],
          body: buildInvalidRuntimeMaterializationExpression(
            actualMember,
            targetType
          ),
        });
        continue;
      }

      const actualMemberTypeAst = sourceLayout.memberTypeAsts[index];
      const expectedMemberIndex =
        (actualMemberTypeAst
          ? expectedMemberIndexByAstKey.get(
              stableTypeKeyFromAst(actualMemberTypeAst)
            )
          : undefined) ??
        findRuntimeUnionMemberIndex(
          targetLayout.members,
          actualMember,
          targetLayoutContext
        );

      if (expectedMemberIndex === undefined) {
        lambdaArgs.push({
          kind: "lambdaExpression",
          isAsync: false,
          parameters: [{ name: parameterName }],
          body: buildInvalidRuntimeMaterializationExpression(
            actualMember,
            targetType
          ),
        });
        continue;
      }

      const targetMemberTypeAst =
        targetLayout.memberTypeAsts[expectedMemberIndex];
      const materializedValue =
        targetMemberTypeAst === undefined
          ? parameterExpr
          : maybeCastMaterializedValueAst(
              parameterExpr,
              actualMemberTypeAst,
              targetMemberTypeAst
            );

      lambdaArgs.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: parameterName }],
        body: {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: {
              kind: "typeReferenceExpression",
              type: concreteTargetUnionTypeAst,
            },
            memberName: `From${expectedMemberIndex + 1}`,
          },
          arguments: [materializedValue],
        },
      });
    }

    return [
      buildMaterializationMatchAst(valueAst, lambdaArgs),
      targetLayoutContext,
    ];
  }

  const [targetTypeAst, nextContext] = emitTypeAst(targetType, targetLayoutContext);
  const concreteTargetTypeAst = unwrapNullableTypeAst(targetTypeAst);
  const concreteTargetTypeKey = stableTypeKeyFromAst(concreteTargetTypeAst);
  const sourceSurfaceMemberTypeAsts = getRuntimeUnionCastMemberTypeAsts(valueAst);
  const matchingSourceIndices = sourceLayout.members.flatMap((member, index) =>
    member &&
    (!selectedSourceMemberNs || selectedSourceMemberNs.has(index + 1)) &&
    (((() => {
      const sourceMemberTypeAst =
        sourceSurfaceMemberTypeAsts?.[index] ?? sourceLayout.memberTypeAsts[index];
      if (!sourceMemberTypeAst) {
        return false;
      }
      return (
        stableTypeKeyFromAst(unwrapNullableTypeAst(sourceMemberTypeAst)) ===
        concreteTargetTypeKey
      );
    })()) ||
      findRuntimeUnionMemberIndex([member], targetType, nextContext) === 0)
      ? [index]
      : []
  );

  if (matchingSourceIndices.length === 0) {
    return undefined;
  }

  const lambdaArgs: CSharpExpressionAst[] = [];
  for (let index = 0; index < sourceLayout.members.length; index += 1) {
    const actualMember = sourceLayout.members[index];
    if (!actualMember) {
      continue;
    }

    const parameterName = `__tsonic_union_member_${index + 1}`;
    const parameterExpr: CSharpExpressionAst = {
      kind: "identifierExpression",
      identifier: parameterName,
    };

    if (
      selectedSourceMemberNs &&
      !selectedSourceMemberNs.has(index + 1)
    ) {
      lambdaArgs.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: parameterName }],
        body: buildInvalidRuntimeMaterializationExpression(
          actualMember,
          targetType
        ),
      });
      continue;
    }

    if (!matchingSourceIndices.includes(index)) {
      lambdaArgs.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: parameterName }],
        body: buildInvalidRuntimeMaterializationExpression(
          actualMember,
          targetType
        ),
      });
      continue;
    }

    lambdaArgs.push({
      kind: "lambdaExpression",
      isAsync: false,
      parameters: [{ name: parameterName }],
      body: maybeCastMaterializedValueAst(
        parameterExpr,
        sourceSurfaceMemberTypeAsts?.[index] ?? sourceLayout.memberTypeAsts[index],
        concreteTargetTypeAst
      ),
    });
  }

  return [
    buildMaterializationMatchAst(valueAst, lambdaArgs),
    nextContext,
  ];
};

export const tryBuildRuntimeReificationPlan = (
  valueAst: CSharpExpressionAst,
  expectedType: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn
): RuntimeReificationPlan | undefined => {
  const resolvedExpected = resolveTypeAlias(
    stripNullish(expectedType),
    context
  );

  if (
    resolvedExpected.kind === "unknownType" ||
    resolvedExpected.kind === "anyType" ||
    resolvedExpected.kind === "neverType" ||
    resolvedExpected.kind === "voidType" ||
    resolvedExpected.kind === "objectType" ||
    (resolvedExpected.kind === "referenceType" && resolvedExpected.name === "object")
  ) {
    return undefined;
  }

  if (
    resolvedExpected.kind === "primitiveType" &&
    (resolvedExpected.name === "null" || resolvedExpected.name === "undefined")
  ) {
    return {
      condition: {
        kind: "binaryExpression",
        operatorToken: "==",
        left: valueAst,
        right: nullLiteral(),
      },
      value: { kind: "defaultExpression" },
      context,
    };
  }

  if (resolvedExpected.kind === "unionType") {
    const [unionTypeAst, runtimeLayout, unionTypeContext] =
      emitRuntimeCarrierTypeAst(expectedType, context, emitTypeAst);
    const concreteUnionTypeAst = unwrapNullableTypeAst(unionTypeAst);
    if (!runtimeLayout || !isRuntimeUnionTypeAst(concreteUnionTypeAst)) {
      return undefined;
    }

    const runtimeFrame = buildRuntimeUnionFrame(expectedType, unionTypeContext);
    const members = runtimeFrame?.members ?? runtimeLayout.members;

    const cases: RuntimeReificationPlan[] = [
      {
        condition: {
          kind: "isExpression",
          expression: valueAst,
          pattern: {
            kind: "typePattern",
            type: concreteUnionTypeAst,
          },
        },
        value: {
          kind: "castExpression",
          type: concreteUnionTypeAst,
          expression: valueAst,
        },
        context: unionTypeContext,
      },
    ];

    let currentContext = unionTypeContext;
    for (let index = 0; index < members.length; index += 1) {
      const member = members[index];
      if (!member) continue;
      const memberPlan = tryBuildRuntimeReificationPlan(
        valueAst,
        member,
        currentContext,
        emitTypeAst
      );
      if (!memberPlan) continue;
      currentContext = memberPlan.context;
      cases.push({
        condition: memberPlan.condition,
        value: {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: {
              kind: "typeReferenceExpression",
              type: concreteUnionTypeAst,
            },
            memberName: `From${index + 1}`,
          },
          arguments: [memberPlan.value],
        },
        context: currentContext,
      });
    }

    if (cases.length === 0) {
      return undefined;
    }

    let conditionAst = cases[0]!.condition;
    let valueExpression = buildInvalidReificationExpression(
      "Unreachable runtime union reification path"
    );
    let finalContext = cases[cases.length - 1]!.context;

    for (let index = 1; index < cases.length; index += 1) {
      conditionAst = {
        kind: "binaryExpression",
        operatorToken: "||",
        left: conditionAst,
        right: cases[index]!.condition,
      };
    }

    for (let index = cases.length - 1; index >= 0; index -= 1) {
      valueExpression = {
        kind: "conditionalExpression",
        condition: cases[index]!.condition,
        whenTrue: cases[index]!.value,
        whenFalse: valueExpression,
      };
      finalContext = cases[index]!.context;
    }

    return {
      condition: conditionAst,
      value: valueExpression,
      context: finalContext,
    };
  }

  const [typeAst, typeContext] = emitTypeAst(expectedType, context);
  const concreteTypeAst = unwrapNullableTypeAst(typeAst);

  if (
    resolvedExpected.kind === "arrayType" ||
    resolvedExpected.kind === "tupleType" ||
    (resolvedExpected.kind === "referenceType" &&
      (resolvedExpected.name === "Array" ||
        resolvedExpected.name === "ReadonlyArray" ||
        resolvedExpected.name === "JSArray"))
  ) {
    return {
      condition: buildArrayShapeCondition(valueAst),
      value: {
        kind: "castExpression",
        type: concreteTypeAst,
        expression: valueAst,
      },
      context: typeContext,
    };
  }

  return {
    condition: {
      kind: "isExpression",
      expression: valueAst,
      pattern: {
        kind: "typePattern",
        type: concreteTypeAst,
      },
    },
    value: {
      kind: "castExpression",
      type: concreteTypeAst,
      expression: valueAst,
    },
    context: typeContext,
  };
};
