export function assembleSourceProgramFacts(parts) {
    const { refusalSources } = parts;
    return Object.freeze({
        documents: parts.documents,
        values: parts.values,
        sums: parts.sums,
        relations: parts.relations,
        instantiations: parts.instantiations,
        selections: parts.selections,
        navigation: parts.navigation,
        objects: parts.objects,
        profile: parts.profile,
        analyses: parts.analyses,
        obligations: parts.obligations,
        refusals() {
            const seen = new Set();
            const all = [];
            for (const source of refusalSources) {
                for (const refusal of source()) {
                    if (seen.has(refusal) || all.some(entry => entry.code === refusal.code && entry.site === refusal.site))
                        continue;
                    seen.add(refusal);
                    all.push(refusal);
                }
            }
            return Object.freeze(all);
        },
    });
}
//# sourceMappingURL=assembly.js.map