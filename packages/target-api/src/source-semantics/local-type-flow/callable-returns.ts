import type { Node } from "@tsonic/tsts";
import { Node_Expression } from "../../source-navigation/ast.js";
import type { SourceTypeFlowSource } from "./types.js";

export function sourceTypeFlowCallableReturns(source: Pick<SourceTypeFlowSource, "ast" | "navigation">, declaration: Node): {
  readonly returned: readonly Node[];
  readonly absent: boolean;
} {
  const { ast, navigation } = source;
  const body = ast.body(declaration);
  const pending = body === undefined ? [] : [body];
  const returned: Node[] = [];
  let absent = false;
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (node !== body && navigation.enclosing(node, "body") !== declaration) continue;
    if (node === body && !ast.is.IsBlock(node)) returned.push(node);
    else if (ast.is.IsReturnStatement(node)) {
      const expression = Node_Expression(ast, node);
      if (expression !== undefined) returned.push(expression);
      else absent = true;
    } else {
      const children = ast.children(node);
      for (let index = children.length - 1; index >= 0; index -= 1) {
        const child = children[index];
        if (child !== undefined) pending.push(child);
      }
    }
  }
  return Object.freeze({ returned: Object.freeze(returned), absent });
}
