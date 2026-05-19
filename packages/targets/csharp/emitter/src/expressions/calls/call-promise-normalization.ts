import { isAwaitableIrType, IrExpression, IrType } from "@tsonic/frontend";
import { emitTypeAst } from "../../type-emitter.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import {
  identifierExpression,
  identifierType,
  nullLiteral,
  stringLiteral,
} from "../../core/format/backend-ast/builders.js";
import { emitRuntimeCarrierTypeAst } from "../../core/semantic/runtime-unions.js";
import type { EmitterContext } from "../../types.js";
import { buildCompletedTaskAst } from "./call-promise-task-types.js";
import { isValueTaskLikeIrType } from "./call-promise-ir-types.js";

export const buildInvocation = (
  expression: CSharpExpressionAst,
  args: readonly CSharpExpressionAst[]
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression,
  arguments: args,
});

export const buildAwait = (
  expression: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "awaitExpression",
  expression,
});

export const buildPromiseRejectedExceptionAst = (
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

export const getPromiseStaticMethod = (
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

export const emitPromiseNormalizedTaskAst = (
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
