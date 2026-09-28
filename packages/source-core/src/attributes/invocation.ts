import type { Node } from "@tsonic/tsts";
import type { SourceFileQueries } from "@tsonic/tsts";
import type { SelectedProviderSourceCall } from "../analysis/source-call.js";
import { unwrapParenthesizedExpression } from "../analysis/source-call.js";

export function selectedAttributeInvocation(
  selected: SelectedProviderSourceCall,
  context: Pick<SourceFileQueries, "ast" | "checker">,
): Node | undefined {
  const callback = unwrapParenthesizedExpression(selected.selection.sourceArguments[0]?.expression, context);
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
  const invocation = unwrapParenthesizedExpression(context.ast.body(callback), context);
  if (
    invocation === undefined ||
    (!context.ast.is.IsCallExpression(invocation) && !context.ast.is.IsNewExpression(invocation))
  ) {
    return undefined;
  }
  const call = context.checker.getResolvedCallInfo(invocation);
  return call?.outcome === "applicable" ? invocation : undefined;
}
