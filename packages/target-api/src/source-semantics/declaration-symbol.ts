import type { AstReader, Node, Symbol, TypeCheckerQueries } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../source-navigation/types.js";

export function createSourceDeclarationSymbolQuery(
  ast: AstReader,
  checker: TypeCheckerQueries,
  navigation: Pick<SourceProgramNavigation, "referencesToDeclaration" | "sourceReferenceFor">,
): (declaration: Node) => Symbol | undefined {
  const selections = new WeakMap<Node, Symbol | null>();
  return declaration => {
    const retained = selections.get(declaration);
    if (retained !== undefined) return retained ?? undefined;
    let symbol = checker.getSymbolAtLocation(ast.name(declaration) ?? declaration);
    if (symbol === undefined) {
      for (const node of navigation.referencesToDeclaration(declaration)) {
        const reference = navigation.sourceReferenceFor(node);
        if (reference?.declaration !== declaration || reference.symbol === undefined) continue;
        symbol = reference.symbol;
        break;
      }
    }
    selections.set(declaration, symbol ?? null);
    return symbol;
  };
}
