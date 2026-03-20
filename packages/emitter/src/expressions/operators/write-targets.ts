import { IrExpression } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitMemberAccess } from "../access.js";
import { getMemberAccessNarrowKey } from "../../core/semantic/narrowing-keys.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";
import { unwrapTransparentExpression } from "../../core/semantic/transparent-expressions.js";

const shouldSuppressWriteTargetBinding = (
  bindingKey: string,
  context: EmitterContext,
  isRoot: boolean
): boolean => {
  const narrowed = context.narrowedBindings?.get(bindingKey);
  if (!narrowed) {
    return false;
  }

  if (narrowed.kind === "rename") {
    return isRoot;
  }

  return true;
};

const collectWriteTargetNarrowKeys = (
  expr: IrExpression,
  context: EmitterContext,
  isRoot = true,
  out: Set<string> = new Set<string>()
): ReadonlySet<string> => {
  const unwrapped = unwrapTransparentExpression(expr);

  if (unwrapped.kind === "identifier") {
    if (shouldSuppressWriteTargetBinding(unwrapped.name, context, isRoot)) {
      out.add(unwrapped.name);
    }
    return out;
  }

  if (unwrapped.kind === "memberAccess") {
    const narrowKey = getMemberAccessNarrowKey(unwrapped);
    if (
      narrowKey &&
      shouldSuppressWriteTargetBinding(narrowKey, context, isRoot)
    ) {
      out.add(narrowKey);
    }
    collectWriteTargetNarrowKeys(unwrapped.object, context, false, out);
  }

  return out;
};

const suppressWriteTargetNarrowing = (
  expr: IrExpression,
  context: EmitterContext
): EmitterContext => {
  if (!context.narrowedBindings || context.narrowedBindings.size === 0) {
    return context;
  }

  const keys = collectWriteTargetNarrowKeys(expr, context);
  if (keys.size === 0) {
    return context;
  }

  let changed = false;
  const narrowedBindings = new Map(context.narrowedBindings);
  for (const key of keys) {
    changed = narrowedBindings.delete(key) || changed;
  }

  return changed ? { ...context, narrowedBindings } : context;
};

export const emitWritableTargetAst = (
  expr: IrExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const suppressedContext = suppressWriteTargetNarrowing(expr, context);
  const rawTarget = unwrapTransparentExpression(expr);
  const [targetAst, targetContext] =
    rawTarget.kind === "memberAccess"
      ? emitMemberAccess(rawTarget, suppressedContext, "write")
      : emitExpressionAst(rawTarget, suppressedContext);

  if (suppressedContext === context) {
    return [targetAst, targetContext];
  }

  return [
    targetAst,
    {
      ...targetContext,
      narrowedBindings: context.narrowedBindings,
    },
  ];
};
