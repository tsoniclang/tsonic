import type { Node } from "@tsonic/tsts";
import type { TsonicSourceFileAnalysisContext } from "../analysis/context.js";
import type { SelectedProviderSourceCall } from "../analysis/source-call.js";

export function selectedAttributeInvocation(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
): Node | undefined {
  const callback = unwrapParentheses(selected.selection.sourceArguments[0]?.expression, context);
  if (
    selected.selection.sourceArguments.length !== 1 ||
    callback === undefined ||
    !context.ast.is.IsArrowFunction(callback) ||
    context.ast.parameters(callback).length !== 0 ||
    context.ast.typeParameters(callback).length !== 0 ||
    context.ast.hasModifierKind(callback, "async")
  ) {
    return undefined;
  }
  const invocation = unwrapParentheses(context.ast.body(callback), context);
  if (
    invocation === undefined ||
    (!context.ast.is.IsCallExpression(invocation) && !context.ast.is.IsNewExpression(invocation))
  ) {
    return undefined;
  }
  const call = context.checker.getResolvedCallInfo(invocation);
  return call?.outcome === "applicable" ? invocation : undefined;
}

function unwrapParentheses(
  node: Node | undefined,
  context: TsonicSourceFileAnalysisContext,
): Node | undefined {
  let current = node;
  while (current !== undefined && context.ast.is.IsParenthesizedExpression(current)) {
    current = context.ast.as.AsParenthesizedExpression(current)?.Expression;
  }
  return current;
}
