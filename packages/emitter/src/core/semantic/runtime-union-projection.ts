import { IrType, stableIrTypeKey } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import {
  identifierExpression,
  identifierType,
  stringLiteral,
} from "../format/backend-ast/builders.js";
import type { CSharpExpressionAst } from "../format/backend-ast/types.js";
import {
  buildRuntimeUnionTypeAst,
  type RuntimeUnionLayout,
} from "./runtime-unions.js";
import {
  buildRuntimeUnionMemberIndexByAstKey,
  findMappedRuntimeUnionMemberIndex,
} from "./runtime-union-member-mapping.js";

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
      type: unionTypeAst,
    },
    memberName: `From${memberIndex}`,
  },
  arguments: [valueAst],
});

export const buildRuntimeUnionMatchAst = (
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

export const buildInvalidRuntimeUnionCastExpression = (
  actualType: IrType,
  expectedType: IrType
): CSharpExpressionAst => ({
  kind: "throwExpression",
  expression: {
    kind: "objectCreationExpression",
    type: identifierType("global::System.InvalidCastException"),
    arguments: [
      stringLiteral(
        `Cannot cast runtime union ${stableIrTypeKey(
          actualType
        )} to ${stableIrTypeKey(expectedType)}`
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
    readonly sourceMemberN: number;
    readonly context: EmitterContext;
  }) => CSharpExpressionAst | undefined;
}): [CSharpExpressionAst, EmitterContext] | undefined => {
  const targetUnionTypeAst = buildRuntimeUnionTypeAst(opts.targetLayout);
  const targetMemberIndexByAstKey = buildRuntimeUnionMemberIndexByAstKey(
    opts.targetLayout.memberTypeAsts
  );

  const lambdaArgs: CSharpExpressionAst[] = [];
  let currentContext = opts.context;

  for (let index = 0; index < opts.sourceLayout.members.length; index += 1) {
    const actualMember = opts.sourceLayout.members[index];
    const actualMemberTypeAst = opts.sourceLayout.memberTypeAsts[index];
    if (!actualMember || !actualMemberTypeAst) {
      continue;
    }

    const sourceMemberN = opts.candidateMemberNs?.[index] ?? index + 1;
    const parameterName = `__tsonic_union_member_${index + 1}`;
    const parameterExpr = identifierExpression(parameterName);

    const pushLambda = (body: CSharpExpressionAst): void => {
      lambdaArgs.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: parameterName }],
        body,
      });
    };

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
      const unmappedBody = opts.buildUnmappedMemberBody?.({
        actualMember,
        sourceMemberN,
        context: currentContext,
      });
      if (!unmappedBody) {
        return undefined;
      }
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

  return [buildRuntimeUnionMatchAst(opts.valueAst, lambdaArgs), currentContext];
};
