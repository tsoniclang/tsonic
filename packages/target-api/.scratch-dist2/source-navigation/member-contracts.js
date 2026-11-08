import { sourceMemberOwner, sourceObjectMemberDeclarations, sourceParameterIsProperty } from "../source-model/class-members.js";
import { sourceNodeIdentity, sourceNodesEqual } from "./identity.js";
export function createSourceMemberContractNavigation(ast, isProjectDeclaration, declaredHeritage, memberImplementation) {
    const cache = new WeakMap();
    const memberContracts = (implementationDeclaration) => {
        const existing = cache.get(implementationDeclaration);
        if (existing !== undefined) {
            return existing;
        }
        const result = resolveMemberContracts(ast, implementationDeclaration, isProjectDeclaration, declaredHeritage, memberImplementation);
        cache.set(implementationDeclaration, result);
        return result;
    };
    return Object.freeze({ memberContracts });
}
function resolveMemberContracts(ast, implementationDeclaration, isProjectDeclaration, declaredHeritage, memberImplementation) {
    const owner = sourceMemberOwner(ast, implementationDeclaration);
    if (!isProjectType(ast, owner) || !isProjectMember(ast, implementationDeclaration) ||
        !isProjectDeclaration(implementationDeclaration)) {
        return Object.freeze({
            kind: "unresolved",
            declaration: implementationDeclaration,
            reason: "Project member contracts require one exact project class or interface member declaration.",
        });
    }
    const inherited = collectInheritedProjectTypes(ast, owner, isProjectDeclaration, declaredHeritage);
    if (inherited.kind === "unresolved") {
        return Object.freeze({
            kind: "unresolved",
            declaration: implementationDeclaration,
            reason: inherited.reason,
        });
    }
    const contracts = [];
    const identities = new Set();
    for (const inheritedType of inherited.declarations) {
        for (const candidate of sourceObjectMemberDeclarations(ast, inheritedType)) {
            if (candidate === undefined || !isProjectMember(ast, candidate) ||
                ast.hasModifierKind(candidate, "static") ||
                ast.hasModifierKind(candidate, "private")) {
                continue;
            }
            const selected = memberImplementation(owner, candidate);
            if (selected.kind === "unrelated") {
                return Object.freeze({
                    kind: "unresolved",
                    declaration: implementationDeclaration,
                    reason: "An inherited project member contract was unrelated to its exact containing type.",
                });
            }
            if (selected.kind === "unresolved") {
                return Object.freeze({
                    kind: "unresolved",
                    declaration: implementationDeclaration,
                    reason: selected.reason,
                });
            }
            if (!sourceNodesEqual(ast, selected.implementation.declaration, implementationDeclaration)) {
                continue;
            }
            const identity = sourceNodeIdentity(ast, candidate);
            if (identity === undefined) {
                return Object.freeze({
                    kind: "unresolved",
                    declaration: implementationDeclaration,
                    reason: "An inherited project member contract has no exact source-node identity.",
                });
            }
            if (!identities.has(identity)) {
                identities.add(identity);
                contracts.push(candidate);
            }
        }
    }
    return Object.freeze({
        kind: "resolved",
        implementationDeclaration,
        contracts: Object.freeze(contracts),
    });
}
function collectInheritedProjectTypes(ast, declaration, isProjectDeclaration, declaredHeritage) {
    const declarations = [];
    const visited = new Set();
    const visit = (current) => {
        const result = declaredHeritage(current);
        if (result.kind === "unresolved") {
            return result.reason;
        }
        for (const edge of result.edges) {
            if (!edge.target.project || !isProjectDeclaration(edge.target.declaration)) {
                continue;
            }
            if (!isProjectType(ast, edge.target.declaration)) {
                return "An inherited project contract requires an exact class or interface declaration, not a constructor-valued member.";
            }
            const identity = sourceNodeIdentity(ast, edge.target.declaration);
            if (identity === undefined) {
                return "An inherited project type has no exact source-node identity.";
            }
            if (visited.has(identity)) {
                continue;
            }
            visited.add(identity);
            declarations.push(edge.target.declaration);
            const failure = visit(edge.target.declaration);
            if (failure !== undefined) {
                return failure;
            }
        }
        return undefined;
    };
    const failure = visit(declaration);
    return failure === undefined
        ? Object.freeze({ kind: "resolved", declarations: Object.freeze(declarations) })
        : Object.freeze({ kind: "unresolved", reason: failure });
}
function isProjectType(ast, node) {
    return node !== undefined &&
        (ast.is.IsClassDeclaration(node) || ast.is.IsClassExpression(node) || ast.is.IsInterfaceDeclaration(node));
}
function isProjectMember(ast, node) {
    const kind = ast.kindName(node);
    return kind === "KindMethodDeclaration" || kind === "KindMethodSignature" ||
        kind === "KindGetAccessor" || kind === "KindSetAccessor" ||
        kind === "KindPropertyDeclaration" || kind === "KindPropertySignature" ||
        sourceParameterIsProperty(ast, node);
}
//# sourceMappingURL=member-contracts.js.map