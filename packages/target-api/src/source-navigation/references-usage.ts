import type {
  CheckedSourceProgram,
  Node,
  SourceFile,
  Symbol,
} from "@tsonic/tsts";
import {
  aliasedSymbol,
  symbolAtReferenceNode,
} from "./syntax.js";
import {
  sourceNodeIdentity,
  sourceSymbolsEqual,
} from "./identity.js";

export function sourceSymbolHasReferenceOutside(
  source: CheckedSourceProgram,
  sourceFiles: readonly SourceFile[],
  symbol: Symbol,
  excludedNode: Node,
): boolean {
  let found = false;
  const excludedIdentity = sourceNodeIdentity(source.ast, excludedNode);
  const visit = (node: Node | undefined): void => {
    if (node === undefined || found) {
      return;
    }
    if (sourceNodeIdentity(source.ast, node) === excludedIdentity) {
      return;
    }
    const sourceFile = source.ast.getSourceFile(node);
    if (sourceFile !== undefined) {
      const checker = source.getSourceFileQueries(sourceFile).checker;
      const direct = symbolAtReferenceNode(
        source.ast,
        checker,
        node,
      );
      if (
        sourceSymbolsEqual(source.ast, checker, direct, symbol) ||
        sourceSymbolsEqual(
          source.ast,
          checker,
          aliasedSymbol(source.ast, checker, direct),
          symbol,
        )
      ) {
        found = true;
        return;
      }
    }
    source.ast.forEachChild(node, visit);
  };
  for (const sourceFile of sourceFiles) {
    visit(sourceFile);
    if (found) {
      return true;
    }
  }
  return false;
}
