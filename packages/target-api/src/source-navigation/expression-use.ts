import type { AstReader, Node } from "@tsonic/tsts";
import { sourceNodesEqual } from "./identity.js";

export function sourceExpressionResultUse(
  ast: AstReader,
  expression: Node,
): "consumed" | "discarded" {
  let current = expression;
  for (;;) {
    const parent = ast.parent(current);
    if (parent === undefined) {
      return "consumed";
    }
    if (ast.is.IsParenthesizedExpression(parent)) {
      const wrapper = ast.as.AsParenthesizedExpression(parent);
      if (sourceNodesEqual(ast, wrapper?.Expression, current)) {
        current = parent;
        continue;
      }
    }
    if (ast.is.IsAsExpression(parent)) {
      const wrapper = ast.as.AsAsExpression(parent);
      if (sourceNodesEqual(ast, wrapper?.Expression, current)) {
        current = parent;
        continue;
      }
    }
    if (ast.is.IsSatisfiesExpression(parent)) {
      const wrapper = ast.as.AsSatisfiesExpression(parent);
      if (sourceNodesEqual(ast, wrapper?.Expression, current)) {
        current = parent;
        continue;
      }
    }
    if (ast.is.IsNonNullExpression(parent)) {
      const wrapper = ast.as.AsNonNullExpression(parent);
      if (sourceNodesEqual(ast, wrapper?.Expression, current)) {
        current = parent;
        continue;
      }
    }
    if (ast.is.IsTypeAssertion(parent)) {
      const wrapper = ast.as.AsTypeAssertion(parent);
      if (sourceNodesEqual(ast, wrapper?.Expression, current)) {
        current = parent;
        continue;
      }
    }
    if (ast.is.IsExpressionStatement(parent)) {
      return sourceNodesEqual(
          ast,
          ast.as.AsExpressionStatement(parent)?.Expression,
          current,
        )
        ? "discarded"
        : "consumed";
    }
    if (ast.is.IsVoidExpression(parent)) {
      return sourceNodesEqual(ast, ast.as.AsVoidExpression(parent)?.Expression, current)
        ? "discarded"
        : "consumed";
    }
    if (ast.is.IsBinaryExpression(parent)) {
      const binary = ast.as.AsBinaryExpression(parent);
      if (ast.operatorKindName(parent) !== "KindCommaToken") {
        return "consumed";
      }
      if (sourceNodesEqual(ast, binary?.Left, current)) {
        return "discarded";
      }
      if (sourceNodesEqual(ast, binary?.Right, current)) {
        current = parent;
        continue;
      }
      return "consumed";
    }
    if (ast.is.IsForStatement(parent)) {
      const statement = ast.as.AsForStatement(parent);
      return sourceNodesEqual(ast, statement?.Initializer, current) ||
          sourceNodesEqual(ast, statement?.Incrementor, current)
        ? "discarded"
        : "consumed";
    }
    return "consumed";
  }
}
