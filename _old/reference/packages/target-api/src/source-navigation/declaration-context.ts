import type { AstReader, Node } from "@tsonic/tsts";

export function sourceDeclarationAmbientContext(ast: AstReader, node: Node, inheritedAmbient: boolean): boolean {
  return inheritedAmbient || (ast.is.IsSourceFile(node)
    ? ast.getSourceFile(node)?.IsDeclarationFile === true : ast.hasModifierKind(node, "ambient"));
}
