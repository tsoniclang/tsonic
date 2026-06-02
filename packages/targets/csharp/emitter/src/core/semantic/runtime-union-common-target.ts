import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type { CSharpExpressionAst } from "../format/backend-ast/types.js";
import type { EmitTypeAstFn } from "./runtime-reification.js";
import {
  buildRuntimeUnionLayout,
  type RuntimeUnionLayout,
} from "./runtime-unions.js";
import { buildRuntimeUnionMatchAst } from "./runtime-union-projection.js";
import { isReferenceAssignableThroughHeritage } from "./type-compatibility.js";
import { resolveTypeAlias, stripNullish } from "./type-resolution.js";

const unwrapTransparentValueAst = (
  valueAst: CSharpExpressionAst
): CSharpExpressionAst => {
  let current = valueAst;
  while (
    current.kind === "parenthesizedExpression" ||
    current.kind === "castExpression"
  ) {
    current = current.expression;
  }
  return current;
};

const isEmissionIdentityAssignableToType = (
  fromType: IrType,
  toType: IrType,
  context: EmitterContext
): boolean => {
  const from = resolveTypeAlias(stripNullish(fromType), context);
  const to = resolveTypeAlias(stripNullish(toType), context);

  if (from.kind === "referenceType" && to.kind === "referenceType") {
    return isReferenceAssignableThroughHeritage(from, to, context, new Set());
  }

  if (from.kind === "primitiveType" && to.kind === "primitiveType") {
    return from.name === to.name;
  }

  if (from.kind === "literalType" && to.kind === "literalType") {
    return from.value === to.value;
  }

  return false;
};

export const tryResolveRuntimeUnionCommonTarget = (opts: {
  readonly actualType: IrType | undefined;
  readonly expectedType: IrType | undefined;
  readonly context: EmitterContext;
  readonly emitTypeAst: EmitTypeAstFn;
}):
  | {
      readonly layout: RuntimeUnionLayout;
      readonly layoutContext: EmitterContext;
    }
  | undefined => {
  const { actualType, expectedType, context, emitTypeAst } = opts;
  if (!actualType || !expectedType) {
    return undefined;
  }

  const resolvedExpected = resolveTypeAlias(stripNullish(expectedType), context);
  if (resolvedExpected.kind === "unionType") {
    return undefined;
  }

  const [layout, layoutContext] = buildRuntimeUnionLayout(
    actualType,
    context,
    emitTypeAst
  );
  if (!layout || layout.members.length < 2) {
    return undefined;
  }

  const everyMemberAssignable = layout.members.every((member) =>
    isEmissionIdentityAssignableToType(member, expectedType, layoutContext)
  );
  if (!everyMemberAssignable) {
    return undefined;
  }

  return { layout, layoutContext };
};

export const tryProjectRuntimeUnionToCommonTargetAst = (opts: {
  readonly valueAst: CSharpExpressionAst;
  readonly actualType: IrType | undefined;
  readonly expectedType: IrType | undefined;
  readonly context: EmitterContext;
  readonly emitTypeAst: EmitTypeAstFn;
}): [CSharpExpressionAst, EmitterContext] | undefined => {
  const { valueAst, actualType, expectedType, context, emitTypeAst } = opts;
  if (!actualType || !expectedType) {
    return undefined;
  }
  const plan = tryResolveRuntimeUnionCommonTarget({
    actualType,
    expectedType,
    context,
    emitTypeAst,
  });
  if (!plan) {
    return undefined;
  }
  const { layout, layoutContext } = plan;

  const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
    expectedType,
    layoutContext
  );
  const lambdaArgs = layout.members.map((_, index): CSharpExpressionAst => {
    const parameterName = `__tsonic_union_member_${index + 1}`;
    return {
      kind: "lambdaExpression",
      isAsync: false,
      parameters: [{ name: parameterName }],
      body: {
        kind: "identifierExpression",
        identifier: parameterName,
      },
    };
  });

  return [
    buildRuntimeUnionMatchAst(
      unwrapTransparentValueAst(valueAst),
      lambdaArgs,
      [expectedTypeAst]
    ),
    expectedTypeContext,
  ];
};
