import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceHostInput } from "../../host-input/index.js";
import { Node_Expression } from "../../source-model/ast.js";
import { createSourceTypeFlowRefusal } from "./refusals.js";
import type { SourceTypeFlowRefusal, SourceTypeFlowSource } from "./types.js";

export function sourceTypeFlowCallableReturns(ast: AstReader, declaration: Node): {
  readonly returned: readonly Node[];
  readonly absent: boolean;
} {
  const body = ast.body(declaration);
  const pending = body === undefined ? [] : [body];
  const returned: Node[] = [];
  let absent = false;
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (node !== body && (ast.is.IsFunctionDeclaration(node) || ast.is.IsFunctionExpression(node) ||
      ast.is.IsArrowFunction(node) || ast.is.IsMethodDeclaration(node) || ast.is.IsGetAccessorDeclaration(node) ||
      ast.is.IsSetAccessorDeclaration(node) || ast.is.IsClassDeclaration(node) || ast.is.IsClassExpression(node))) continue;
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
  return { returned, absent };
}

// The recursive-return rule (Host): an unannotated callable with a body, one of whose returned expressions (in body
// order, sourceTypeFlowCallableReturns) reaches the callable's own type, is refused (TSONIC_LOCAL_TYPE_SIGNATURE) at the
// first such expression. Only the reachability itself is a checker witness (host-input returnReachesCallable).
export function sourceTypeFlowRecursiveSignatures(source: SourceTypeFlowSource, input: SourceHostInput,
  nodes: readonly Node[]): ReadonlyMap<Node, SourceTypeFlowRefusal> {
  const { ast } = source;
  const refusals = new Map<Node, SourceTypeFlowRefusal>();
  for (const declaration of nodes) {
    if (!(ast.is.IsFunctionDeclaration(declaration) || ast.is.IsFunctionExpression(declaration) ||
      ast.is.IsArrowFunction(declaration) || ast.is.IsMethodDeclaration(declaration)) ||
      ast.typeNode(declaration) !== undefined || ast.body(declaration) === undefined) continue;
    const returned = sourceTypeFlowCallableReturns(ast, declaration).returned
      .find(expression => input.returnReachesCallable(declaration, expression));
    if (returned !== undefined) {
      refusals.set(declaration, Object.freeze({ ...createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_SIGNATURE", returned, declaration),
        reason: "This unannotated callable return depends on itself. Annotate the return type." }));
    }
  }
  return refusals;
}
