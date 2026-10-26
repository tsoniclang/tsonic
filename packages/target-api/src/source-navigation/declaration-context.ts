import type { AstReader, Node } from "@tsonic/tsts";

export function sourceDeclarationIsAmbient(ast: AstReader, declaration: Node,
  step: () => boolean): boolean | undefined {
  for (let owner: Node | undefined = declaration; owner !== undefined && !ast.is.IsSourceFile(owner); owner = ast.parent(owner)) {
    if (!step()) return undefined;
    if (ast.hasModifierKind(owner, "ambient")) return true;
  }
  return false;
}
