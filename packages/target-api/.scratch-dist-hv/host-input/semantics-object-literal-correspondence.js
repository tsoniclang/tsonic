export function sourceObjectLiteralDestinationMember(element, destination, semantics) {
    const correspondence = semantics.types.structuralMembers(element.objectLiteralType, destination, "correspondence");
    if (correspondence.kind !== "available")
        return undefined;
    const pairs = correspondence.members.filter(pair => pair.kind === "present" &&
        (pair.source.declarations.includes(element.element) || element.sourceElementSymbol !== undefined &&
            pair.source.property.symbol === element.sourceElementSymbol));
    return pairs.length === 1 ? pairs[0].destination : undefined;
}
//# sourceMappingURL=semantics-object-literal-correspondence.js.map