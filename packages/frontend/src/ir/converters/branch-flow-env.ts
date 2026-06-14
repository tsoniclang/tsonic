import type { ProgramContext } from "../program-context.js";
import type { IrExpression, IrIfBranchPlan } from "../types.js";

type SerializedIrAccessPath =
  | {
      readonly kind: "decl";
      readonly declId: number;
      readonly segments: readonly string[];
    }
  | {
      readonly kind: "this";
      readonly segments: readonly string[];
    };

const unwrapFlowTarget = (expression: IrExpression): IrExpression => {
  let current = expression;
  while (
    current.kind === "typeAssertion" ||
    current.kind === "asinterface" ||
    current.kind === "trycast"
  ) {
    current = current.expression;
  }
  return current;
};

const irAccessPathOf = (
  expression: IrExpression
): SerializedIrAccessPath | undefined => {
  const unwrapped = unwrapFlowTarget(expression);

  if (unwrapped.kind === "identifier") {
    return unwrapped.declId
      ? {
          kind: "decl",
          declId: unwrapped.declId.id,
          segments: [],
        }
      : undefined;
  }

  if (
    unwrapped.kind === "memberAccess" &&
    !unwrapped.isComputed &&
    typeof unwrapped.property === "string"
  ) {
    const basePath = irAccessPathOf(unwrapped.object);
    return basePath
      ? {
          ...basePath,
          segments: [...basePath.segments, unwrapped.property],
        }
      : undefined;
  }

  return undefined;
};

export const withBranchLoweringPlan = (
  ctx: ProgramContext,
  plan: IrIfBranchPlan
): ProgramContext => {
  const nextTypeEnv = new Map(ctx.typeEnv ?? []);
  const nextAccessEnv = new Map(ctx.accessEnv ?? []);

  for (const narrowing of plan.narrowedBindings) {
    const path = irAccessPathOf(narrowing.targetExpr);
    if (!path) {
      continue;
    }

    if (path.kind === "decl" && path.segments.length === 0) {
      nextTypeEnv.set(path.declId, narrowing.targetType);
      continue;
    }

    nextAccessEnv.set(JSON.stringify(path), narrowing.targetType);
  }

  return {
    ...ctx,
    typeEnv: nextTypeEnv,
    accessEnv: nextAccessEnv,
  };
};
