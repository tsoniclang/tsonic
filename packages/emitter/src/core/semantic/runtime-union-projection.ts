import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import {
  identifierExpression,
  identifierType,
  stringLiteral,
} from "../format/backend-ast/builders.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../format/backend-ast/types.js";
import {
  buildRuntimeUnionTypeAst,
  type RuntimeUnionLayout,
} from "./runtime-unions.js";
import { stripNullableTypeAst } from "../format/backend-ast/utils.js";
import {
  buildRuntimeUnionMemberIndexByAstKey,
  findMappedRuntimeUnionMemberIndex,
} from "./runtime-union-member-mapping.js";
import { describeIrTypeForDiagnostics } from "./deterministic-type-keys.js";
import { UNKNOWN_TYPE } from "./runtime-union-shared.js";

type RuntimeUnionProjectionBodyResult =
  | CSharpExpressionAst
  | readonly [CSharpExpressionAst, EmitterContext]
  | undefined;

const isRuntimeUnionMemberProjectionAst = (
  valueAst: CSharpExpressionAst
): boolean => {
  let target = valueAst;
  while (target.kind === "parenthesizedExpression") {
    target = target.expression;
  }

  return (
    target.kind === "invocationExpression" &&
    target.arguments.length === 0 &&
    target.expression.kind === "memberAccessExpression" &&
    /^As\d+$/.test(target.expression.memberName)
  );
};

export const buildRuntimeUnionFactoryCallAst = (
  unionTypeAst: ReturnType<typeof buildRuntimeUnionTypeAst>,
  memberIndex: number,
  valueAst: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: {
    kind: "memberAccessExpression",
    expression: {
      kind: "typeReferenceExpression",
      type: stripNullableTypeAst(unionTypeAst),
    },
    memberName: `From${memberIndex}`,
  },
  arguments: [valueAst],
});

export const buildRuntimeUnionMatchAst = (
  valueAst: CSharpExpressionAst,
  lambdaArgs: readonly CSharpExpressionAst[],
  typeArguments?: readonly CSharpTypeAst[]
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: {
    kind: "memberAccessExpression",
    expression: isRuntimeUnionMemberProjectionAst(valueAst)
      ? {
          kind: "parenthesizedExpression",
          expression: valueAst,
        }
      : valueAst,
    memberName: "Match",
  },
  ...(typeArguments && typeArguments.length > 0 ? { typeArguments } : {}),
  arguments: [...lambdaArgs],
});

export const buildInvalidRuntimeUnionCastExpression = (
  actualType: IrType,
  expectedType: IrType,
  context?: EmitterContext
): CSharpExpressionAst => ({
  kind: "throwExpression",
  expression: {
    kind: "objectCreationExpression",
    type: identifierType("global::System.InvalidCastException"),
    arguments: [
      stringLiteral(
        context
          ? `Cannot cast runtime union ${describeIrTypeForDiagnostics(
              actualType,
              context
            )} to ${describeIrTypeForDiagnostics(expectedType, context)}`
          : `Cannot cast runtime union ${actualType.kind} to ${expectedType.kind}`
      ),
    ],
  },
});

export const buildInvalidRuntimeUnionMaterializationExpression = (
  sourceType: IrType,
  targetType: IrType
): CSharpExpressionAst => ({
  kind: "throwExpression",
  expression: {
    kind: "objectCreationExpression",
    type: identifierType("global::System.InvalidCastException"),
    arguments: [
      stringLiteral(
        `Cannot materialize runtime union ${sourceType.kind} to ${targetType.kind}`
      ),
    ],
  },
});

export const tryBuildRuntimeUnionProjectionToLayoutAst = (opts: {
  readonly valueAst: CSharpExpressionAst;
  readonly sourceLayout: RuntimeUnionLayout;
  readonly targetLayout: RuntimeUnionLayout;
  readonly context: EmitterContext;
  readonly candidateMemberNs?: readonly number[];
  readonly selectedSourceMemberNs?: ReadonlySet<number>;
  readonly buildMappedMemberValue: (args: {
    readonly actualMember: IrType;
    readonly actualMemberTypeAst: RuntimeUnionLayout["memberTypeAsts"][number];
    readonly parameterExpr: CSharpExpressionAst;
    readonly targetMember: IrType;
    readonly targetMemberTypeAst: RuntimeUnionLayout["memberTypeAsts"][number];
    readonly sourceMemberN: number;
    readonly targetMemberIndex: number;
    readonly context: EmitterContext;
  }) => [CSharpExpressionAst, EmitterContext] | undefined;
  readonly buildExcludedMemberBody?: (args: {
    readonly actualMember: IrType;
    readonly sourceMemberN: number;
    readonly context: EmitterContext;
  }) => CSharpExpressionAst | undefined;
  readonly buildUnmappedMemberBody?: (args: {
    readonly actualMember: IrType;
    readonly parameterExpr: CSharpExpressionAst;
    readonly sourceMemberN: number;
    readonly context: EmitterContext;
  }) => RuntimeUnionProjectionBodyResult;
}): [CSharpExpressionAst, EmitterContext] | undefined => {
  const targetUnionTypeAst = buildRuntimeUnionTypeAst(opts.targetLayout);
  const targetMemberIndexByAstKey = buildRuntimeUnionMemberIndexByAstKey(
    opts.targetLayout.memberTypeAsts
  );

  const lambdaArgs: CSharpExpressionAst[] = [];
  let currentContext = opts.context;

  const sourceMemberIndexBySlot = new Map<number, number>();
  for (let index = 0; index < opts.sourceLayout.members.length; index += 1) {
    sourceMemberIndexBySlot.set(
      opts.candidateMemberNs?.[index] ?? index + 1,
      index
    );
  }
  const sourceArity = Math.max(
    opts.sourceLayout.runtimeUnionArity,
    opts.sourceLayout.members.length,
    ...(opts.candidateMemberNs ?? [])
  );

  for (let slotIndex = 0; slotIndex < sourceArity; slotIndex += 1) {
    const sourceMemberN = slotIndex + 1;
    const index = sourceMemberIndexBySlot.get(sourceMemberN);
    const actualMember =
      index !== undefined ? opts.sourceLayout.members[index] : undefined;
    const actualMemberTypeAst =
      index !== undefined ? opts.sourceLayout.memberTypeAsts[index] : undefined;
    const parameterName = `__tsonic_union_member_${sourceMemberN}`;
    const parameterExpr = identifierExpression(parameterName);

    const pushLambda = (body: CSharpExpressionAst): void => {
      lambdaArgs.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: parameterName }],
        body,
      });
    };

    if (!actualMember || !actualMemberTypeAst) {
      const excludedBody = opts.buildExcludedMemberBody?.({
        actualMember: UNKNOWN_TYPE,
        sourceMemberN,
        context: currentContext,
      });
      if (!excludedBody) {
        return undefined;
      }
      pushLambda(excludedBody);
      continue;
    }

    if (
      opts.selectedSourceMemberNs &&
      !opts.selectedSourceMemberNs.has(sourceMemberN)
    ) {
      const excludedBody = opts.buildExcludedMemberBody?.({
        actualMember,
        sourceMemberN,
        context: currentContext,
      });
      if (!excludedBody) {
        return undefined;
      }
      pushLambda(excludedBody);
      continue;
    }

    const targetMemberIndex = findMappedRuntimeUnionMemberIndex({
      targetMembers: opts.targetLayout.members,
      targetMemberIndexByAstKey,
      actualMember,
      actualMemberTypeAst,
      context: currentContext,
    });

    if (targetMemberIndex === undefined) {
      const unmappedBodyResult = opts.buildUnmappedMemberBody?.({
        actualMember,
        parameterExpr,
        sourceMemberN,
        context: currentContext,
      });
      const [unmappedBody, unmappedContext] = Array.isArray(unmappedBodyResult)
        ? unmappedBodyResult
        : [unmappedBodyResult, currentContext];
      if (!unmappedBody) {
        return undefined;
      }
      currentContext = unmappedContext;
      pushLambda(unmappedBody);
      continue;
    }

    const targetMember = opts.targetLayout.members[targetMemberIndex];
    const targetMemberTypeAst =
      opts.targetLayout.memberTypeAsts[targetMemberIndex];
    if (!targetMember || !targetMemberTypeAst) {
      return undefined;
    }

    const mappedValue = opts.buildMappedMemberValue({
      actualMember,
      actualMemberTypeAst,
      parameterExpr,
      targetMember,
      targetMemberTypeAst,
      sourceMemberN,
      targetMemberIndex,
      context: currentContext,
    });
    if (!mappedValue) {
      return undefined;
    }

    pushLambda(
      buildRuntimeUnionFactoryCallAst(
        targetUnionTypeAst,
        targetMemberIndex + 1,
        mappedValue[0]
      )
    );
    currentContext = mappedValue[1];
  }

  return [
    buildRuntimeUnionMatchAst(opts.valueAst, lambdaArgs, [targetUnionTypeAst]),
    currentContext,
  ];
};
