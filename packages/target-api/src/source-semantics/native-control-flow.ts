import type { AstReader, Node } from "@tsonic/tsts";
import { sourceBindingCallableKinds } from "../source-navigation/binding-mutation-exposure.js";

export function sourceNodeIsNativeUnreachable(
  ast: AstReader,
  node: Node,
  conditionResult: (expression: Node) => boolean | undefined,
): boolean {
  let remaining = 2_048;
  const exits = (statement: Node | undefined): boolean => {
    if (statement === undefined || --remaining < 0) return false;
    const kind = ast.kindName(statement);
    if (kind === "KindReturnStatement" || kind === "KindThrowStatement") return true;
    if (kind === "KindBlock") {
      const statements = ast.statements(statement);
      if (statements === undefined) return false;
      for (const child of statements) {
        if (child === undefined || --remaining < 0) return false;
        if (exits(child)) return true;
      }
      return false;
    }
    if (kind !== "KindIfStatement") return false;
    const selected = ast.as.AsIfStatement(statement);
    if (selected?.Expression === undefined) return false;
    const result = conditionResult(selected.Expression);
    return result === true ? exits(selected.ThenStatement)
      : result === false ? exits(selected.ElseStatement)
      : exits(selected.ThenStatement) && exits(selected.ElseStatement);
  };
  for (let current = node; remaining > 0;) {
    remaining -= 1;
    const parent = ast.parent(current);
    if (parent === undefined || sourceBindingCallableKinds.has(ast.kindName(parent))) return false;
    if (ast.is.IsIfStatement(parent)) {
      const statement = ast.as.AsIfStatement(parent);
      const result = statement?.Expression === undefined ? undefined : conditionResult(statement.Expression);
      if (current === statement?.ThenStatement && result === false ||
        current === statement?.ElseStatement && result === true) return true;
    }
    if (ast.is.IsBlock(parent)) {
      const statements = ast.statements(parent);
      if (statements !== undefined) {
        for (const previous of statements) {
          if (previous === current) break;
          if (previous === undefined || --remaining < 0) return false;
          if (exits(previous)) return true;
        }
      }
    }
    current = parent;
  }
  return false;
}
