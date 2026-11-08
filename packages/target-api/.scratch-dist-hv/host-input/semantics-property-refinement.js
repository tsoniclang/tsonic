import { selectSourceTypeRefinement } from "./semantics-type-refinement.js";
import { selectSourcePropertyDeclaration } from "./semantics-selected-property-declarations.js";
export function selectRefinedSourcePropertyAccess(selected, refinement, checker, types, facts, ast) {
    if (selected.selectedDeclaration !== undefined || selected.selectedSymbol === undefined ||
        selected.accessMode !== "read" || refinement.kind !== "resolved") {
        return selected;
    }
    const selectedRefinement = selectSourceTypeRefinement(types, checker, facts, refinement.declaredType, selected.receiver.type);
    if (selectedRefinement.kind !== "members" || selectedRefinement.types.length !== 1)
        return selected;
    const property = checker.getPropertyOfType(selectedRefinement.types[0], checker.getSymbolName(selected.selectedSymbol));
    if (property === undefined)
        return selected;
    const propertyType = checker.getTypeOfSymbol(property);
    if (propertyType === undefined || !types.isTypeIdenticalTo(propertyType, selected.sourceReadType)) {
        return selected;
    }
    const declarations = checker.getSymbolDeclarations(property).filter((node) => node !== undefined);
    const declaration = selectSourcePropertyDeclaration(ast, declarations, "read");
    if (declaration === undefined)
        return selected;
    const selectedDeclarations = new Set([
        ...checker.getSymbolDeclarations(selected.selectedSymbol),
        ...checker.getRootSymbols(selected.selectedSymbol).flatMap(symbol => symbol === undefined ? [] : checker.getSymbolDeclarations(symbol)),
    ].filter((candidate) => candidate !== undefined));
    return selectedDeclarations.has(declaration)
        ? Object.freeze({ ...selected, selectedDeclaration: declaration, selectedReadDeclaration: declaration })
        : selected;
}
//# sourceMappingURL=semantics-property-refinement.js.map