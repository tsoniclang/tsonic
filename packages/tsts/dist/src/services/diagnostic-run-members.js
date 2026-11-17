// The added diagnostics a published diagnostic stands for: the run members compactAndMergeRelatedInfos recorded on its
// clone, or the diagnostic itself when it was published unchanged (a run of one). A cause recorded on an added diagnostic
// leads to the published one when it is in this list.
export function getDiagnosticRunMembers(diagnostic) {
    const members = diagnostic.runMembers;
    if (members === undefined)
        return [diagnostic];
    const present = [];
    for (const member of members) {
        if (member === undefined)
            throw new Error("A published diagnostic's run members contain an undefined entry.");
        present.push(member);
    }
    return present;
}
//# sourceMappingURL=diagnostic-run-members.js.map