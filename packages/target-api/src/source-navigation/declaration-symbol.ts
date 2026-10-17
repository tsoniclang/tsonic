import type { CheckedSourceProgram, Node, SourceFile, Symbol } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "./types.js";

export function createSourceDeclarationSymbolQuery(
  source: Pick<CheckedSourceProgram, "ast" | "sourceFiles" | "containsSourceFile" | "getSourceFileQueries">,
  navigation: Pick<SourceProgramNavigation, "referencesToDeclaration" | "sourceReferenceFor">,
): (declaration: Node, sourceFile: SourceFile) => Symbol | undefined {
  const includedFiles = new Set(source.sourceFiles);
  const selections = new WeakMap<SourceFile, WeakMap<Node, Symbol | null>>();
  return (declaration, sourceFile) => {
    if (!includedFiles.has(sourceFile)) throw new Error("A declaration-symbol query requires its actual included checked consumer context.");
    let byDeclaration = selections.get(sourceFile);
    const retained = byDeclaration?.get(declaration);
    if (retained !== undefined) return retained ?? undefined;
    const declarationFile = source.ast.getSourceFile(declaration);
    let symbol: Symbol | undefined;
    if (declarationFile !== undefined && source.containsSourceFile(declarationFile)) {
      const checker = source.getSourceFileQueries(sourceFile).checker;
      symbol = checker.getSymbolAtLocation(source.ast.name(declaration) ?? declaration);
      if (symbol === undefined) {
        for (const node of navigation.referencesToDeclaration(declaration)) {
          const reference = navigation.sourceReferenceFor(node);
          if (reference?.declaration !== declaration || reference.symbol === undefined) continue;
          symbol = reference.symbol;
          break;
        }
      }
    }
    byDeclaration ??= new WeakMap();
    byDeclaration.set(declaration, symbol ?? null);
    selections.set(sourceFile, byDeclaration);
    return symbol;
  };
}
