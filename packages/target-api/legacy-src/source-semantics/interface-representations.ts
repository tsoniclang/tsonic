import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceDeclaredHeritageEdge, SourceProgramNavigation } from "../source-navigation/index.js";
import type { SourceFileSemantics } from "./types.js";

export function sourceInterfaceRepresentationBase(
  declaration: Node,
  ast: AstReader,
  navigation: SourceProgramNavigation,
  semantics: SourceFileSemantics,
): SourceDeclaredHeritageEdge | undefined {
  if (!ast.is.IsInterfaceDeclaration(declaration)) return undefined;
  const type = semantics.declarations.declaredType(declaration);
  const symbol = type === undefined ? undefined : semantics.declarations.typeSymbol(type);
  const declarations = symbol === undefined ? [] : semantics.declarations.symbolDeclarations(symbol);
  if (type === undefined || declarations.length === 0 || declarations.some(member =>
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
  return edge?.kind === "extends" && semantics.types.isIdentical(type, edge.selectedType) ? edge : undefined;
}
