import type { AstReader, Type } from "@tsonic/tsts";
import type { SourceFileSemantics, TargetSourceProgram } from "./types.js";

export function sourceTypeIsAuthoredEmptyObject(
  type: Type,
  ast: AstReader,
  semantics: SourceFileSemantics,
  navigation: Pick<TargetSourceProgram["navigation"], "isProjectDeclaration">,
): boolean {
  const symbol = semantics.declarations.typeSymbol(type);
  if (symbol === undefined) return false;
  const declarations = semantics.declarations.symbolDeclarations(symbol);
  if (declarations.length === 0) return false;
  for (const declaration of declarations) {
    if (declaration === undefined || !navigation.isProjectDeclaration(declaration) ||
      !ast.is.IsObjectLiteralExpression(declaration) || ast.properties(declaration).length !== 0) return false;
  }
  return true;
}
