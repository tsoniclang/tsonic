import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceProductionResult } from "./descriptor-contracts.js";
import type { SourceGuardContext } from "./value-flow-model.js";

export function sourceStatementAlwaysExits(
  ast: AstReader,
  statement: Node | undefined,
  conditionResult: (expression: Node) => SourceProductionResult<boolean | undefined>,
  enter: () => boolean,
): SourceProductionResult<boolean> {
  const resolved = (value: boolean): SourceProductionResult<boolean> => Object.freeze({ kind: "resolved", value });
  if (statement === undefined || !enter()) return resolved(false);
  const kind = ast.kindName(statement);
  if (kind === "KindReturnStatement" || kind === "KindThrowStatement") return resolved(true);
  if (kind === "KindBlock") {
    const statements = ast.statements(statement);
    if (statements === undefined) return resolved(false);
    for (const child of statements) {
      if (child === undefined || !enter()) return resolved(false);
      const selected = sourceStatementAlwaysExits(ast, child, conditionResult, enter);
      if (selected.kind !== "resolved" || selected.value) return selected;
    }
    return resolved(false);
  }
  if (!ast.is.IsIfStatement(statement)) return resolved(false);
  const selected = ast.as.AsIfStatement(statement);
  if (selected?.Expression === undefined) return resolved(false);
  const result = conditionResult(selected.Expression);
  if (result.kind !== "resolved") return result;
  if (result.value === true) return sourceStatementAlwaysExits(ast, selected.ThenStatement, conditionResult, enter);
  if (result.value === false) return sourceStatementAlwaysExits(ast, selected.ElseStatement, conditionResult, enter);
  const whenTrue = sourceStatementAlwaysExits(ast, selected.ThenStatement, conditionResult, enter);
  return whenTrue.kind !== "resolved" || !whenTrue.value ? whenTrue
    : sourceStatementAlwaysExits(ast, selected.ElseStatement, conditionResult, enter);
}

export function sourceNodeIsNativeUnreachable(
  source: Pick<SourceGuardContext, "ast" | "navigation" | "enclosing">,
  node: Node,
  conditionResult: (expression: Node) => SourceProductionResult<boolean | undefined>,
): SourceProductionResult<boolean> {
  const { ast } = source;
  const { navigation } = source;
  navigation.callableRoles(node);
  const resolved = (value: boolean): SourceProductionResult<boolean> => Object.freeze({ kind: "resolved", value });
  let remaining = 2_048;
  const execution = source.enclosing(node, "execution", () => --remaining >= 0);
  const exits = (statement: Node | undefined): SourceProductionResult<boolean> =>
    sourceStatementAlwaysExits(ast, statement, conditionResult, () => --remaining >= 0);
  for (let current = node; remaining > 0;) {
    remaining -= 1;
    const parent = ast.parent(current);
    if (parent === undefined || parent === execution) return resolved(false);
    if (ast.is.IsIfStatement(parent)) {
      const statement = ast.as.AsIfStatement(parent);
      const result = statement?.Expression === undefined ? Object.freeze({ kind: "resolved" as const, value: undefined })
        : conditionResult(statement.Expression);
      if (result.kind !== "resolved") return result;
      if (current === statement?.ThenStatement && result.value === false ||
        current === statement?.ElseStatement && result.value === true) return resolved(true);
    }
    if (ast.is.IsBlock(parent) && !ast.is.IsFunctionDeclaration(current)) {
      const statements = ast.statements(parent);
      if (statements !== undefined) {
        for (const previous of statements) {
          if (previous === current) break;
          if (previous === undefined || --remaining < 0) return resolved(false);
          const selected = exits(previous);
          if (selected.kind !== "resolved" || selected.value) return selected;
        }
      }
    }
    current = parent;
  }
  return resolved(false);
}
