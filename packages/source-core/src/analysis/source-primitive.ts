import { sourcePrimitiveFactKey } from "@tsonic/tsts";
import type { Node, SourcePrimitiveFact } from "@tsonic/tsts";
import type { TsonicSourceFileAnalysisContext } from "./context.js";
import { readSourceFact } from "./source-call.js";

export function readSourcePrimitiveAnnotation(
  context: TsonicSourceFileAnalysisContext,
  annotation: Node | undefined,
): SourcePrimitiveFact | undefined {
  const { ast, checker } = context;
  const visited = new Set<Node>();
  let current = annotation;
  while (current !== undefined && !visited.has(current)) {
    visited.add(current);
    const primitive = readSourceFact(context, current, sourcePrimitiveFactKey);
    if (primitive !== undefined) return primitive;
    if (ast.is.IsParenthesizedTypeNode(current)) {
      current = ast.as.AsParenthesizedTypeNode(current)?.Type;
      continue;
    }
    if (!ast.is.IsTypeReferenceNode(current) || ast.typeArguments(current).length !== 0) return undefined;
    const name = ast.as.AsTypeReferenceNode(current)?.TypeName;
    let symbol = checker.getSymbolAtLocation(name);
    if (symbol === undefined) return undefined;
    let declarations = checker.getSymbolDeclarations(symbol);
    if (declarations.some((declaration) => declaration !== undefined && (
      ast.is.IsImportSpecifier(declaration) || ast.is.IsImportClause(declaration) ||
      ast.is.IsExportSpecifier(declaration)
    ))) {
      symbol = checker.getAliasedSymbol(symbol);
      if (symbol === undefined) return undefined;
      declarations = checker.getSymbolDeclarations(symbol);
    }
    if (declarations.length !== 1) return undefined;
    const declaration = declarations[0];
    if (declaration === undefined || !ast.is.IsTypeAliasDeclaration(declaration) ||
        ast.typeParameters(declaration).length !== 0) return undefined;
    current = ast.as.AsTypeAliasDeclaration(declaration)?.Type;
  }
  return undefined;
}
