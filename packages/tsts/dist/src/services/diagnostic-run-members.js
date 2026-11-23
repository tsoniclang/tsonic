export function createCheckerDiagnosticPublication() {
    let published;
    return {
        admits: (diagnostic) => published?.members.has(diagnostic) ?? true,
        publish(roots) {
            if (published !== undefined)
                return published.roots;
            const members = new WeakSet();
            for (const root of roots) {
                if (root === undefined)
                    throw new Error("A published checker diagnostic inventory must be dense.");
                for (const member of getDiagnosticRunMembers(root))
                    members.add(member);
            }
            published = { roots, members };
            return roots;
        },
    };
}
// The added diagnostics a published diagnostic stands for: the run members compactAndMergeRelatedInfos recorded on its
// clone, or the diagnostic itself when it was published unchanged (a run of one). A cause recorded on an added diagnostic
// leads to the published one when it is in this list.
export function getDiagnosticRunMembers(diagnostic) {
    const members = diagnostic.runMembers;
    if (members === undefined)
        return [diagnostic];
    if (!hasCompleteRun(members))
        throw new Error("A published diagnostic's run members contain an undefined entry.");
    return members;
}
function hasCompleteRun(members) {
    for (const member of members) {
        if (member === undefined)
            return false;
    }
    return true;
}
//# sourceMappingURL=diagnostic-run-members.js.map