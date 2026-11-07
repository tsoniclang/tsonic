import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceDeclaredHeritageEdge, SourceProgramNavigation } from "../source-navigation/index.js";

/**
 * The single base an interface is represented by: every merged declaration of the interface is an interface with no
 * own members (no properties, methods, signatures or index signatures), and all of them together name exactly one
 * `extends` heritage edge. Such an interface has exactly its base's structure, so it is represented by that base.
 * Decided from declarations and authored heritage only (I3: no checked type identity).
 */
export function sourceInterfaceRepresentationBase(
  declaration: Node,
  ast: AstReader,
  navigation: Pick<SourceProgramNavigation, "mergedDeclarations" | "declaredHeritage">,
): SourceDeclaredHeritageEdge | undefined {
  if (!ast.is.IsInterfaceDeclaration(declaration)) return undefined;
  const declarations = navigation.mergedDeclarations(declaration);
  if (declarations.length === 0 || declarations.some(member =>
    !ast.is.IsInterfaceDeclaration(member) || ast.members(member).length !== 0)) return undefined;
  let edge: SourceDeclaredHeritageEdge | undefined;
  for (const member of declarations) {
    const heritage = navigation.declaredHeritage(member);
    if (heritage.kind !== "resolved" || heritage.edges.length > 1) return undefined;
    const selected = heritage.edges[0];
    if (selected === undefined) continue;
    if (edge !== undefined) return undefined;
    edge = selected;
  }
  return edge?.kind === "extends" ? edge : undefined;
}
