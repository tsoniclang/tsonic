import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../source-semantics/types.js";

export interface SourceClosedCallableArgument {
  readonly call: Node;
  readonly argument: Node;
  readonly argumentIndex: number;
}

export function sourceExpressionCallArgument(
  reference: Node,
  source: {
    readonly ast: TargetSourceProgram["ast"];
    readonly semantics: Pick<TargetSourceProgram["semantics"], "forNode">;
  },
): SourceClosedCallableArgument | undefined {
  const { ast } = source;
  let argument = reference;
  let parent = ast.parent(argument);
  for (let depth = 0; parent !== undefined && depth < 256; depth += 1) {
    const expression = ast.is.IsParenthesizedExpression(parent) ? ast.as.AsParenthesizedExpression(parent)?.Expression
      : ast.is.IsSatisfiesExpression(parent) ? ast.as.AsSatisfiesExpression(parent)?.Expression : undefined;
    if (expression === undefined) break;
    if (expression !== argument) return undefined;
    argument = parent;
    parent = ast.parent(argument);
  }
  if (parent === undefined || !ast.is.IsCallExpression(parent) && !ast.is.IsNewExpression(parent)) return undefined;
  if (ast.is.IsCallExpression(parent)) {
    const call = ast.as.AsCallExpression(parent);
    if (call === undefined || call.QuestionDotToken !== undefined) return undefined;
  }
  const arguments_ = ast.arguments(parent);
  const argumentIndex = arguments_.indexOf(argument);
  if (argumentIndex < 0 || arguments_.filter(node => node === argument).length !== 1 ||
    ast.is.IsSpreadElement(argument)) return undefined;
  const checked = source.semantics.forNode(parent).operations.call(parent);
  if (checked?.sourceArguments[argumentIndex]?.expression !== argument) return undefined;
  return Object.freeze({ call: parent, argument, argumentIndex });
}
