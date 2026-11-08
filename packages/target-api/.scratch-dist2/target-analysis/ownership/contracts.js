import { sourceAnalysisIncludesNode, sourceAnalysisValueType } from "../analysis-program.js";
import { sourceTypeDescriptorsEqual } from "../../source-semantics/descriptor-model.js";
import { isSourceCallableSignatureDeclaration } from "../../source-model/callable-boundaries.js";
import { sourceStorageRoleDeclaration } from "../source-storage/model/components.js";
export const defaultSourceDeclarationOwnershipLimits = Object.freeze({
    maximumSteps: 33554432,
    maximumTransportRows: 4194304,
});
export function sourceDeclarationOwnershipUnresolved(at, reason) {
    return Object.freeze({ kind: "unresolved", at, reason, cause: Object.freeze({ kind: "required-fact" }) });
}
export function createSourceDeclarationParameterUseQuery(input) {
    const { source, budget } = input;
    const declarations = new Map();
    const publish = (declaration) => {
        if (!budget.step(declaration))
            return budget.failure();
        const existing = declarations.get(declaration);
        if (existing !== undefined)
            return existing;
        const body = source.ast.body(declaration);
        if (body === undefined || !source.navigation.isProjectDeclaration(declaration))
            return sourceDeclarationOwnershipUnresolved(declaration, "A native parameter use requires its published declaration contract.");
        const selected = new Map();
        const rows = budget.createRows(declaration);
        let published = false;
        try {
            for (const parameter of source.ast.parameters(declaration)) {
                if (parameter === undefined)
                    continue;
                if (!budget.step(parameter))
                    return budget.failure();
                const type = sourceAnalysisValueType(source, parameter);
                if (type === undefined)
                    continue;
                const sites = [];
                let use;
                let complete = true;
                for (const reference of source.navigation.declarationUses(parameter)) {
                    if (!budget.step(reference.reference))
                        return budget.failure();
                    if (reference.kind === "type-only" || reference.kind === "source-linkage")
                        continue;
                    if (reference.captured || reference.throughMember) {
                        complete = false;
                        break;
                    }
                    const disposition = source.navigation.expressionResultDisposition(reference.reference);
                    if (disposition.kind !== "returned" && disposition.kind !== "stored") {
                        complete = false;
                        break;
                    }
                    sites.push(reference.reference);
                    if (disposition.kind === "stored")
                        use = "retained";
                    else
                        use ?? (use = "result");
                }
                if (!complete || use === undefined)
                    continue;
                if (!rows.add(3 + sites.length))
                    return budget.failure();
                selected.set(parameter, Object.freeze({ kind: "resolved", declaration, parameter, use,
                    sites: Object.freeze(sites), contract: Object.freeze({ kind: "declaration", declaration: parameter,
                        component: Object.freeze({ type, declaration: parameter }) }) }));
            }
            if (!rows.add(1))
                return budget.failure();
            declarations.set(declaration, selected);
            published = true;
            return selected;
        }
        finally {
            if (!published)
                rows.release();
        }
    };
    return Object.freeze({
        forArgument(call, argument) {
            if (!budget.step(call))
                return budget.failure();
            if (!sourceAnalysisIncludesNode(source, call) || !source.ast.is.IsCallExpression(call))
                return sourceDeclarationOwnershipUnresolved(call, "Native parameter consumption requires its original checked direct call.");
            const selected = source.navigation.call(call);
            const declaration = selected?.selection === "resolved" ? selected.signature : undefined;
            if (declaration === undefined || selected?.selection !== "resolved")
                return sourceDeclarationOwnershipUnresolved(call, "Native parameter consumption requires its exact selected declaration.");
            const index = source.ast.arguments(call).indexOf(argument);
            const bindings = selected.bindings.filter(binding => binding.sourceArgumentIndex === index && binding.sourceForm === "value");
            const parameter = bindings.length === 1 ? selected.parameters.find(candidate => candidate.parameterIndex === bindings[0].sourceParameterIndex)?.parameterDeclaration : undefined;
            if (index < 0 || parameter === undefined || !source.ast.parameters(declaration).includes(parameter))
                return sourceDeclarationOwnershipUnresolved(call, "Native parameter use requires one exact checked argument-to-formal correspondence.");
            const contracts = publish(declaration);
            if ("kind" in contracts)
                return contracts;
            return contracts.get(parameter) ?? sourceDeclarationOwnershipUnresolved(call, "The selected native parameter has no completed direct result or retained-input contract.");
        },
    });
}
export function createSourceDeclarationOwnershipBudget(subject, limits) {
    let failure;
    const invalid = (at, reason) => {
        failure ?? (failure = Object.freeze({ kind: "unresolved", at, reason, cause: Object.freeze({ kind: "invalid-input" }) }));
        return false;
    };
    const exhausted = (at, category, limit) => {
        failure ?? (failure = Object.freeze({ kind: "unresolved", at,
            reason: `Declaration ownership exhausted its ${category} limit (${limit}).`,
            cause: Object.freeze({ kind: "resource-limit", subject: at, category, limit }) }));
        return false;
    };
    let maximumSteps = 0;
    let maximumRows = 0;
    if (typeof limits !== "object" || limits === null) {
        invalid(subject, "Declaration ownership limits require finite own data values.");
    }
    else {
        for (const key of ["maximumSteps", "maximumTransportRows"]) {
            const descriptor = Object.getOwnPropertyDescriptor(limits, key);
            if (descriptor === undefined || !("value" in descriptor) || typeof descriptor.value !== "number" ||
                !Number.isSafeInteger(descriptor.value) || descriptor.value <= 0 ||
                descriptor.value > defaultSourceDeclarationOwnershipLimits[key]) {
                invalid(subject, `Declaration ownership ${key} must be a positive safe integer within its finite default.`);
                break;
            }
            if (key === "maximumSteps")
                maximumSteps = descriptor.value;
            else
                maximumRows = descriptor.value;
        }
    }
    let steps = 0;
    let rows = 0;
    return Object.freeze({
        step(at) {
            if (failure !== undefined)
                return false;
            steps++;
            return steps <= maximumSteps || exhausted(at, "step", maximumSteps);
        },
        createRows(at) {
            let retained = 0;
            let released = false;
            return Object.freeze({
                add(cost) {
                    if (failure !== undefined)
                        return false;
                    if (released || !Number.isSafeInteger(cost) || cost <= 0)
                        return invalid(at, "Declaration ownership accounting requires a live positive finite row reservation.");
                    if (rows + cost > maximumRows)
                        return exhausted(at, "row", maximumRows);
                    rows += cost;
                    retained += cost;
                    return true;
                },
                release() {
                    if (released)
                        return;
                    released = true;
                    rows -= retained;
                    retained = 0;
                },
            });
        },
        failure: () => failure,
        usage: () => Object.freeze({ steps, rows }),
    });
}
export function sourceDeclarationOwnershipContractProblem(source, node, component, contract) {
    if (!sourceAnalysisIncludesNode(source, node))
        return "Ownership evidence requires its original checked source operation or value.";
    if (!sourceTypeDescriptorsEqual(component.type, contract.component.type))
        return "Ownership evidence does not describe the exact completed checked component.";
    if (contract.kind === "expression")
        return contract.expression === node ? undefined
            : "Ownership expression evidence belongs to a different checked operation or value.";
    const declarationFile = source.ast.getSourceFile(contract.declaration);
    if (declarationFile === undefined)
        return "Ownership evidence requires the actual checked declaration, including checked provider declarations.";
    const declarations = new Set();
    if (isSourceCallableSignatureDeclaration(source.ast, node) || source.ast.is.IsParameterDeclaration(node) ||
        source.ast.is.IsVariableDeclaration(node) || source.ast.is.IsPropertyDeclaration(node) ||
        source.ast.is.IsPropertySignatureDeclaration(node))
        declarations.add(node);
    const reference = source.navigation.sourceReferenceFor(node);
    if (reference !== undefined)
        declarations.add(reference.declaration);
    if (source.ast.is.IsCallExpression(node) || source.ast.is.IsNewExpression(node)) {
        const selected = source.navigation.call(node);
        const selectedDeclaration = selected?.selection === "resolved" ? selected.signature : undefined;
        if (selectedDeclaration !== undefined)
            declarations.add(selectedDeclaration);
    }
    if (source.ast.is.IsPropertyAccessExpression(node)) {
        // The read and the write declaration of the selected member (an accessor pair contributes both accessors).
        const selected = source.navigation.memberAccess(node)?.declaration;
        for (const mode of ["read", "write"]) {
            const declaration = selected === undefined ? undefined : sourceStorageRoleDeclaration(source, selected, mode);
            if (declaration !== undefined)
                declarations.add(declaration);
        }
    }
    return declarations.has(contract.declaration) ? undefined
        : "Ownership evidence must identify this operation's selected declaration, not a declaration of its type.";
}
//# sourceMappingURL=contracts.js.map