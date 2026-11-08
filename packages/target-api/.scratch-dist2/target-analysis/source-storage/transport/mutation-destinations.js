export function createSourceStorageMutationDestinations(source, budget, memberFlow, lineagesFor) {
    return (origin, declarations, receiverType) => {
        const destinations = new Set();
        const ordinary = () => {
            if (memberFlow.excludes(origin, receiverType))
                return true;
            for (const declaration of declarations) {
                if (!budget.step())
                    return false;
                const member = memberFlow.memberFor(origin, declaration, receiverType);
                if (member === undefined || member.kind === "absent" && !member.destination.optional)
                    return false;
                for (const original of member.kind === "present" ? member.source.declarations : member.destination.declarations) {
                    if (!budget.step())
                        return false;
                    destinations.add(original);
                }
            }
            return true;
        };
        if (!source.ast.is.IsNewExpression(origin.node))
            return ordinary() ? destinations : undefined;
        const lineages = lineagesFor(origin);
        if (lineages === undefined || lineages.length === 0)
            return undefined;
        for (const lineage of lineages) {
            if (!budget.step())
                return undefined;
            if (lineage.classes.length === 0) {
                if (!ordinary())
                    return undefined;
                continue;
            }
            if (!lineage.complete)
                return undefined;
            for (const declaration of declarations) {
                if (!budget.step())
                    return undefined;
                const selected = memberFlow.membersInLineage(lineage, declaration, receiverType);
                if (selected === undefined || selected.absent)
                    return undefined;
                for (const member of selected.members) {
                    if (!budget.step())
                        return undefined;
                    destinations.add(member.declaration);
                }
            }
        }
        return destinations;
    };
}
//# sourceMappingURL=mutation-destinations.js.map