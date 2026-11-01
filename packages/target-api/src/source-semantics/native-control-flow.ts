import type { AstReader, Node } from "@tsonic/tsts";
import { sourceBindingCallableKinds } from "../source-navigation/binding-mutation-exposure.js";

export function sourceStatementAlwaysExits(
  ast: AstReader,
  statement: Node | undefined,
  conditionResult: (expression: Node) => boolean | undefined,
  enter: () => boolean,
): boolean {
  if (statement === undefined || !enter()) return false;
  const kind = ast.kindName(statement);
  if (kind === "KindReturnStatement" || kind === "KindThrowStatement") return true;
  if (kind === "KindBlock") {
    const statements = ast.statements(statement);
    if (statements === undefined) return false;
    for (const child of statements) {
      if (child === undefined || !enter()) return false;
      if (sourceStatementAlwaysExits(ast, child, conditionResult, enter)) return true;
    }
    return false;
  }
  if (!ast.is.IsIfStatement(statement)) return false;
  const selected = ast.as.AsIfStatement(statement);
  if (selected?.Expression === undefined) return false;
  const result = conditionResult(selected.Expression);
  return result === true ? sourceStatementAlwaysExits(ast, selected.ThenStatement, conditionResult, enter)
    : result === false ? sourceStatementAlwaysExits(ast, selected.ElseStatement, conditionResult, enter)
    : sourceStatementAlwaysExits(ast, selected.ThenStatement, conditionResult, enter) &&
      sourceStatementAlwaysExits(ast, selected.ElseStatement, conditionResult, enter);
}

export function sourceNodeIsNativeUnreachable(
  ast: AstReader,
  node: Node,
  conditionResult: (expression: Node) => boolean | undefined,
): boolean {
  let remaining = 2_048;
  const exits = (statement: Node | undefined): boolean =>
    sourceStatementAlwaysExits(ast, statement, conditionResult, () => --remaining >= 0);
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
    if (ast.is.IsBlock(parent) && !ast.is.IsFunctionDeclaration(current)) {
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
