import type { AstReader, Node, SourceFileQueries, Type } from "@tsonic/tsts";
import type { ResolvedSourceCallInfo } from "../source-navigation/call-info.js";
import type { SourceTypeComponentEvidence } from "./types.js";

export function getSourceMethodTypeArgumentComponent(
  argument: NonNullable<ResolvedSourceCallInfo["sourceSelectedMethodTypeArguments"]>[number],
): SourceTypeComponentEvidence {
  const authoredTypeNode = argument.explicitTypeNode ?? argument.defaultTypeNode;
  return Object.freeze({ selectedType: argument.selectedType,
    ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }) });
}

export interface SourceTypeArgumentBinding {
  readonly declaration: Node;
  readonly parameterType: Type;
  readonly argumentType: Type;
  readonly scope: "outer" | "local";
}

export function getSourceTypeArgumentBindings(
  ast: AstReader,
  queries: SourceFileQueries,
  type: Type,
): readonly SourceTypeArgumentBinding[] | undefined {
  const selected = queries.typeShape.getTypeReferenceArgumentInfos(type);
  if (selected === undefined) return undefined;
  const bindings: SourceTypeArgumentBinding[] = [];
  for (const entry of selected) {
    const symbol = queries.checker.getTypeSymbol(entry.parameter);
    const declaration = queries.checker.getPrimarySymbolDeclaration(symbol);
    if (declaration === undefined || !ast.is.IsTypeParameterDeclaration(declaration) ||
      !queries.checker.getSymbolDeclarations(symbol).includes(declaration) ||
      bindings.some(binding => binding.declaration === declaration)) return undefined;
    bindings.push(Object.freeze({ declaration, parameterType: entry.parameter,
      argumentType: entry.argument, scope: entry.scope }));
  }
  return Object.freeze(bindings);
}
