import { sourceStorageInvocationReceiver, sourceStorageIsGenerator } from "../model/host-reads.js";
export function createSourceStorageGeneratorResumes(source, budget, queries) {
    return (invocation) => budget.withRows(rows => {
        const result = new Set();
        if (queries.invocationEffects.get(invocation)?.resumeReceiver !== true)
            return result;
        const receiver = sourceStorageInvocationReceiver(source, invocation);
        const selected = receiver === undefined ? undefined : queries.subjectFor(receiver);
        const origins = selected === undefined ? undefined : queries.originsFor(selected);
        if (origins === undefined)
            return undefined;
        for (const origin of origins) {
            if (!budget.step())
                return undefined;
            if (origin.kind !== "value" || origin.projection.length !== 0 || !source.ast.is.IsCallExpression(origin.node))
                continue;
            const implementations = queries.implementationsFor(origin.node);
            if (implementations === undefined)
                return undefined;
            for (const candidate of implementations) {
                if (!budget.step())
                    return undefined;
                if (!sourceStorageIsGenerator(source, candidate) || result.has(candidate))
                    continue;
                if (!rows.add(1))
                    return undefined;
                result.add(candidate);
            }
        }
        return result;
    });
}
//# sourceMappingURL=generator-resumes.js.map