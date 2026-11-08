import { createTargetGraphComponentQuery } from "../graph-component-query.js";
import { sourceDeclarationOwnershipUnresolved } from "./contracts.js";
import { isSourceCallableBodyBoundary } from "../../source-navigation/index.js";
import { isSourceCallableSignatureDeclaration } from "../../source-model/callable-boundaries.js";
import { sourceTypeDescriptorsEqual } from "../../source-semantics/descriptor-model.js";
import { sourceStorageRoleDeclaration } from "../source-storage/model/components.js";
export function analyzeSourceDeclarationNativeTaskGraph(input) {
    const { source, values, budget } = input;
    if (input.spawns.length === 0)
        return Object.freeze({ kind: "resolved", graph: Object.freeze({
                lifecycleOwner: undefined, spawns: Object.freeze([]), owners: Object.freeze([]), parameterOwners: new Set(),
                calls: Object.freeze([]), entries: Object.freeze([])
            }) });
    const subject = input.spawns[0].node;
    const rows = budget.createRows(subject);
    const byOwner = new Map();
    const spawns = [];
    const spawnedOwners = new Set();
    const owners = new Set();
    const issues = [];
    const scopes = new Map();
    let published = false;
    let failure;
    const reject = (node, kind, reason) => {
        if (rows.add(1))
            issues.push(Object.freeze({ node, kind, reason }));
    };
    const generator = (declaration) => (source.ast.is.IsFunctionDeclaration(declaration) || source.ast.is.IsFunctionExpression(declaration) ||
        source.ast.is.IsMethodDeclaration(declaration)) && source.ast.children(declaration).some(child => child !== undefined && source.ast.kindName(child) === "KindAsteriskToken");
    const unsupportedOwner = (node) => {
        const visited = new Set();
        for (let current = node; current !== undefined; current = source.ast.parent(current)) {
            if (!budget.step(node)) {
                failure = budget.failure();
                return undefined;
            }
            if (visited.has(current)) {
                failure = sourceDeclarationOwnershipUnresolved(node, "A native task operation requires acyclic checked declaration ancestry.");
                return undefined;
            }
            visited.add(current);
            if (source.ast.is.IsClassStaticBlockDeclaration(current))
                return current;
            if (isSourceCallableBodyBoundary(source.ast, current))
                return generator(current) ? current : undefined;
            if (source.ast.is.IsSourceFile(current))
                return undefined;
        }
        return undefined;
    };
    const scopeFor = (declaration) => {
        if (!budget.step(declaration)) {
            failure = budget.failure();
            return undefined;
        }
        const existing = scopes.get(declaration);
        if (existing !== undefined)
            return existing;
        if (source.ast.is.IsSourceFile(declaration))
            return "none";
        const selected = input.scopeFor(declaration);
        if (selected.kind === "unresolved") {
            failure = selected;
            return undefined;
        }
        if (selected.contract.kind !== "declaration" || selected.contract.declaration !== declaration) {
            failure = sourceDeclarationOwnershipUnresolved(declaration, "A native scope requirement must be published by this exact selected declaration.");
            return undefined;
        }
        const file = source.ast.getSourceFile(declaration);
        if (file === undefined) {
            failure = sourceDeclarationOwnershipUnresolved(declaration, "A native task declaration must belong to the checked program.");
            return undefined;
        }
        // The declaration's Host component: its callable result, else its value type.
        const outcome = isSourceCallableSignatureDeclaration(source.ast, declaration)
            ? source.facts.values.callableReturn(declaration) : source.facts.values.type(declaration);
        const component = outcome.kind === "refused" ? undefined : outcome.type;
        if (component === undefined || !sourceTypeDescriptorsEqual(component, selected.contract.component.type)) {
            failure = sourceDeclarationOwnershipUnresolved(declaration, "A native task scope needs its exact selected declaration component, not an unrelated checked type.");
            return undefined;
        }
        if (!rows.add(1)) {
            failure = budget.failure();
            return undefined;
        }
        scopes.set(declaration, selected.kind);
        return selected.kind;
    };
    try {
        if (input.lifecycleOwner === undefined || !source.sourceFiles.includes(input.lifecycleOwner))
            reject(subject, "lifecycle-owner", "Native task scope requires its actual root lifecycle source identity.");
        for (const spawn of input.spawns) {
            if (!budget.step(spawn.node))
                return budget.failure();
            const unsupported = unsupportedOwner(spawn.operand);
            if (failure !== undefined)
                return failure;
            const region = unsupported === undefined ? values.regionFor(spawn.operand) : undefined;
            if (region !== undefined && "kind" in region)
                return region;
            const owner = unsupported ?? region.owner;
            if (!rows.add(3))
                return budget.failure();
            spawns.push(Object.freeze({ ...spawn, owner }));
            spawnedOwners.add(owner);
            owners.add(owner);
            if (unsupported !== undefined)
                reject(unsupported, "scope-owner", "Native explicit void spawn is unsupported in this selected constructor, initializer or generator.");
        }
        if (issues.some(issue => issue.kind === "scope-owner"))
            return budget.failure() ?? Object.freeze({ kind: "unresolved", issues: Object.freeze(issues) });
        for (const node of input.nodes) {
            if (!budget.step(node))
                return budget.failure();
            const targets = [];
            if (source.ast.is.IsCallExpression(node) || source.ast.is.IsNewExpression(node)) {
                const call = source.navigation.call(node);
                const declaration = call?.selection === "resolved" ? call.signature : undefined;
                if (declaration !== undefined)
                    targets.push(declaration);
            }
            else if (source.ast.is.IsPropertyAccessExpression(node)) {
                const access = source.navigation.memberAccess(node);
                const read = access?.accessMode !== "write" && access?.declaration !== undefined
                    ? sourceStorageRoleDeclaration(source, access.declaration, "read") : undefined;
                const write = access?.accessMode !== "read" && access?.declaration !== undefined
                    ? sourceStorageRoleDeclaration(source, access.declaration, "write") : undefined;
                if (read !== undefined && source.ast.is.IsGetAccessorDeclaration(read))
                    targets.push(read);
                if (write !== undefined && source.ast.is.IsSetAccessorDeclaration(write))
                    targets.push(write);
            }
            if (targets.length === 0)
                continue;
            const unsupported = unsupportedOwner(node);
            if (failure !== undefined)
                return failure;
            const region = unsupported === undefined ? values.regionFor(node) : undefined;
            if (region !== undefined && "kind" in region)
                return region;
            const owner = unsupported ?? region.owner;
            const previous = byOwner.get(owner);
            if (!rows.add(3 + targets.length))
                return budget.failure();
            const edge = Object.freeze({ node, owner, targets: Object.freeze(targets) });
            if (previous === undefined)
                byOwner.set(owner, [edge]);
            else
                previous.push(edge);
            owners.add(owner);
            for (const target of targets)
                owners.add(target);
        }
        const required = createTargetGraphComponentQuery(declaration => {
            if (!budget.step(declaration)) {
                failure = budget.failure();
                return undefined;
            }
            const declaredScope = source.ast.body(declaration) === undefined && !source.ast.is.IsSourceFile(declaration) &&
                !source.ast.is.IsClassDeclaration(declaration) && !source.ast.is.IsClassExpression(declaration) &&
                !source.ast.is.IsClassStaticBlockDeclaration(declaration) ? scopeFor(declaration) : undefined;
            if (failure !== undefined)
                return undefined;
            const neighbours = new Set();
            for (const edge of byOwner.get(declaration) ?? []) {
                for (const target of edge.targets) {
                    if (!budget.step(edge.node) || !rows.add(1)) {
                        failure = budget.failure();
                        return undefined;
                    }
                    neighbours.add(target);
                }
            }
            return { data: spawnedOwners.has(declaration) || declaredScope !== undefined && declaredScope !== "none", neighbours };
        }, members => members.some(member => member.data || member.successors.some(Boolean)), {
            step: () => budget.step(subject), createRows: () => budget.createRows(subject),
        });
        const needed = new Set();
        const calls = [];
        for (const declaration of owners) {
            if (!budget.step(declaration))
                return budget.failure();
            const selected = required(declaration);
            if (selected === undefined)
                return failure ?? budget.failure() ??
                    sourceDeclarationOwnershipUnresolved(declaration, "The native task declaration graph has no completed scope contract.");
            if (!selected)
                continue;
            needed.add(declaration);
            if (source.ast.is.IsSourceFile(declaration))
                continue;
            if (source.ast.is.IsConstructorDeclaration(declaration) || source.ast.is.IsClassDeclaration(declaration) ||
                source.ast.is.IsClassExpression(declaration) || source.ast.is.IsClassStaticBlockDeclaration(declaration) ||
                generator(declaration)) {
                reject(declaration, "scope-owner", "Native explicit void spawn is unsupported in this selected constructor, initializer or generator.");
                continue;
            }
            const scope = scopeFor(declaration);
            if (scope === undefined)
                return failure ?? budget.failure();
            if (scope !== "parameter")
                reject(declaration, "scope-owner", "A demanded native task declaration requires its exact declared scope input, not a captured or invented parameter.");
            const container = source.ast.parent(declaration);
            if (input.publishedDeclarations.has(declaration) || container !== undefined && input.publishedDeclarations.has(container))
                reject(declaration, "public-scope", "A public native signature cannot acquire an implicit executor input from its callers.");
        }
        for (const edges of byOwner.values())
            for (const edge of edges) {
                if (!budget.step(edge.node))
                    return budget.failure();
                if (!edge.targets.some(target => needed.has(target)))
                    continue;
                if (!rows.add(1))
                    return budget.failure();
                calls.push(edge);
            }
        const unresolved = failure ?? budget.failure();
        if (unresolved !== undefined)
            return unresolved;
        if (issues.length !== 0)
            return Object.freeze({ kind: "unresolved", issues: Object.freeze(issues) });
        const declarations = [...needed].filter(owner => !source.ast.is.IsSourceFile(owner));
        published = true;
        return Object.freeze({ kind: "resolved", graph: Object.freeze({ lifecycleOwner: input.lifecycleOwner,
                spawns: Object.freeze(spawns), owners: Object.freeze(declarations), parameterOwners: new Set(declarations),
                calls: Object.freeze(calls), entries: Object.freeze([...needed].filter(owner => source.ast.is.IsSourceFile(owner))) }) });
    }
    finally {
        if (!published)
            rows.release();
    }
}
//# sourceMappingURL=native-tasks.js.map