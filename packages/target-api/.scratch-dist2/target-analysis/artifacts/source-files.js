import { sourceFileIdentity } from "../../source-navigation/identity.js";
export function analyzeSourceArtifactFiles(input) {
    const owners = new Map();
    const filesByOwner = new Map();
    const issues = [];
    for (const file of input.sourceFiles) {
        const identity = sourceFileIdentity(input.ast, file);
        if (identity === undefined) {
            issues.push(Object.freeze({ kind: "source-identity", sourceFile: file }));
            continue;
        }
        const owner = `source-file:${identity}`;
        const existing = filesByOwner.get(owner);
        if (existing !== undefined && existing !== file) {
            issues.push(Object.freeze({ kind: "source-conflict", sourceFile: file, owner }));
            continue;
        }
        filesByOwner.set(owner, file);
        owners.set(file, owner);
    }
    const files = [];
    for (const [file, owner] of owners) {
        const dependencies = new Map();
        const add = (target, construction) => {
            const dependencyOwner = owners.get(target);
            if (dependencyOwner === undefined) {
                issues.push(Object.freeze({ kind: construction ? "construction-identity" : "module-identity", sourceFile: file, owner }));
                return;
            }
            if (dependencyOwner === owner)
                return;
            const facet = construction ? "source-file-implementation" : "source-file-public-surface";
            dependencies.set(`${dependencyOwner.length}:${dependencyOwner}:${facet}`, Object.freeze({ owner: dependencyOwner, facet }));
        };
        for (const reference of input.navigation.moduleReferences(file))
            add(reference.sourceFile, false);
        for (const construction of input.constructions)
            if (construction.sourceFile === file)
                add(construction.targetSourceFile, true);
        files.push(Object.freeze({ sourceFile: file, owner, dependencies: Object.freeze([...dependencies.values()].sort((left, right) => left.owner.localeCompare(right.owner, "en") || left.facet.localeCompare(right.facet, "en"))) }));
    }
    return Object.freeze({ files: Object.freeze(files), issues: Object.freeze(issues) });
}
//# sourceMappingURL=source-files.js.map