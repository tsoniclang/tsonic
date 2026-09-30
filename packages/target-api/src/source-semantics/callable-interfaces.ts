import type { AstReader, Type } from "@tsonic/tsts";
import type { SourceCallableTypeEvidence, SourceFileSemantics } from "./types.js";

export function sourceCallableInterface(
  type: Type | undefined,
  semantics: SourceFileSemantics,
  ast: AstReader,
): SourceCallableTypeEvidence | undefined {
  if (type === undefined || semantics.types.propertyInfos(type).length !== 0 ||
    semantics.types.indexInfos(type).length !== 0 || semantics.types.constructSignatures(type).length !== 0) return undefined;
  const symbol = semantics.declarations.typeSymbol(type);
  const declarations = symbol === undefined ? [] : semantics.declarations.symbolDeclarations(symbol);
  if (declarations.length === 0 || declarations.some(declaration => !ast.is.IsInterfaceDeclaration(declaration))) return undefined;
  return semantics.types.callable(type);
}
