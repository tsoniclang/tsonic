import type { CheckedSourceProgram, Node, SourceFile, Symbol } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "./types.js";

export function createSourceDeclarationSymbolQuery(
  source: Pick<CheckedSourceProgram, "ast" | "getSourceFileQueries">,
  navigation: Pick<SourceProgramNavigation, "referencesToDeclaration" | "sourceReferenceFor">,
): (declaration: Node, sourceFile: SourceFile) => Symbol | undefined {
  const selections = new WeakMap<Node, Symbol | null>();
  return (declaration, sourceFile) => {
    const retained = selections.get(declaration);
    if (retained !== undefined) return retained ?? undefined;
    const checker = source.getSourceFileQueries(sourceFile).checker;
    let symbol = checker.getSymbolAtLocation(source.ast.name(declaration) ?? declaration);
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
