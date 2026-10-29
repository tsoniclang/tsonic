import type { AstReader, Node, ReadonlySourceFactResolver, ResolvedSourcePropertyAccessInfo, TypeCheckerQueries, TypeShapeQueries } from "@tsonic/tsts";
import type { SourceValueTypeRefinementSelection } from "./types.js";
import { selectSourceTypeRefinement } from "./type-refinement.js";
import { selectSourcePropertyDeclaration } from "./selected-property-declarations.js";

export function selectRefinedSourcePropertyAccess(
  selected: ResolvedSourcePropertyAccessInfo,
  refinement: SourceValueTypeRefinementSelection,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  facts: ReadonlySourceFactResolver,
  ast: AstReader,
): ResolvedSourcePropertyAccessInfo {
  if (selected.selectedDeclaration !== undefined || selected.selectedSymbol === undefined ||
    selected.accessMode !== "read" || refinement.kind !== "resolved") {
    return selected;
  }
  const selectedRefinement = selectSourceTypeRefinement(types, checker, facts,
    refinement.declaredType, selected.receiver.type);
  if (selectedRefinement.kind !== "members" || selectedRefinement.types.length !== 1) return selected;
  const property = checker.getPropertyOfType(
    selectedRefinement.types[0],
    checker.getSymbolName(selected.selectedSymbol),
  );
  if (property === undefined) return selected;
  const propertyType = checker.getTypeOfSymbol(property);
  if (propertyType === undefined || !types.isTypeIdenticalTo(propertyType, selected.sourceReadType)) {
    return selected;
  }
  const declarations = checker.getSymbolDeclarations(property).filter((node): node is Node => node !== undefined);
  const declaration = selectSourcePropertyDeclaration(ast, declarations, "read");
  if (declaration === undefined) return selected;
  const selectedDeclarations = new Set<Node>([
    ...checker.getSymbolDeclarations(selected.selectedSymbol),
    ...checker.getRootSymbols(selected.selectedSymbol).flatMap(symbol =>
      symbol === undefined ? [] : checker.getSymbolDeclarations(symbol)),
  ].filter((candidate): candidate is Node => candidate !== undefined));
  return selectedDeclarations.has(declaration)
    ? Object.freeze({ ...selected, selectedDeclaration: declaration, selectedReadDeclaration: declaration })
    : selected;
}
