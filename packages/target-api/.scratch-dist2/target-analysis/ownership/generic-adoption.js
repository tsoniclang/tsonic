import { sourceAnalysisValueType } from "../analysis-program.js";
import { Node_Expression, sourceCallableDefinitionIsDiscarded, sourceLexicalFunctionIsUnused, sourceNodesOutsideErasedSubtrees, } from "../../source-navigation/index.js";
import { createSourceGenericAdoptionDiagnostics } from "./generic-adoption-diagnostics.js";
import { sourceDeclarationOwnershipContractProblem, sourceDeclarationOwnershipUnresolved } from "./contracts.js";
export { sourceGenericAdoptionDiagnosticMessage } from "./generic-adoption-diagnostics.js";
export const sourceGenericAdoptionDiagnosticCode = "TSONIC_GENERIC_ASYNC_ADOPTION_UNSUPPORTED";
export function analyzeSourceDeclarationGenericAdoption(input) {
    const { source, budget } = input;
    const { ast } = source;
    const root = input.nodes[0] ?? source.sourceFiles[0];
    if (root === undefined)
        return Object.freeze({ kind: "resolved", issues: Object.freeze([]) });
    const domain = sourceNodesOutsideErasedSubtrees(ast, input.nodes, node => ast.is.IsArrowFunction(node) || ast.is.IsFunctionExpression(node)
        ? sourceCallableDefinitionIsDiscarded(node, ast, source.navigation)
        : sourceLexicalFunctionIsUnused(node, ast, source.navigation));
    if (domain.kind === "unresolved")
        return sourceDeclarationOwnershipUnresolved(root, domain.reason);
    const rows = budget.createRows(root);
    const format = createSourceGenericAdoptionDiagnostics(source, input.projectRoot);
    const issues = [];
    const issuedSites = new Set();
    try {
        for (const node of domain.nodes) {
            if (!budget.step(node))
                return budget.failure();
            if (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node)) {
                const selected = source.navigation.call(node);
                const declaration = selected?.selection === "resolved" ? selected.signature : undefined;
                if (selected !== undefined && declaration !== undefined) {
                    const published = source.facts.selections.call(node);
                    if (published === undefined || published.kind === "refused")
                        return sourceDeclarationOwnershipUnresolved(node, "Generic adoption requires the published call selection.");
                    const completion = input.premises.completionFor(node, published);
                    if (completion.kind === "unresolved")
                        return completion;
                    if (completion.kind === "async") {
                        const problem = sourceDeclarationOwnershipContractProblem(source, node, { type: published.result, call: node }, completion.contract);
                        if (problem !== undefined)
                            return sourceDeclarationOwnershipUnresolved(node, problem);
                    }
                }
            }
            if (!ast.is.IsAwaitExpression(node) || issuedSites.has(node))
                continue;
            const operand = Node_Expression(ast, node);
            const type = operand === undefined ? undefined : sourceAnalysisValueType(source, operand);
            if (operand === undefined || type === undefined)
                return sourceDeclarationOwnershipUnresolved(node, "Await admission requires its original checked operand and type.");
            if (source.navigation.expressionResultUse(node) === "discarded")
                continue;
            // The awaited operand's Host type is exactly a type parameter (a declared reference to its declaration).
            const parameter = type.kind === "declared" && ast.is.IsTypeParameterDeclaration(type.declaration) ? type.declaration : undefined;
            if (parameter === undefined || input.exemptTypeParameter?.(parameter) === true)
                continue;
            const declaration = ast.parent(parameter);
            const formatted = declaration === undefined ? undefined : format(node, declaration, node, parameter, operand);
            if (declaration === undefined || formatted === undefined)
                return sourceDeclarationOwnershipUnresolved(node, "Await diagnostics require their exact checked declaration, operand and source spans.");
            if (!rows.add(2))
                return budget.failure();
            issuedSites.add(node);
            issues.push(Object.freeze({ site: node, parameter, declaration, operation: node, ...formatted }));
        }
        return Object.freeze({ kind: "resolved", issues: Object.freeze(issues) });
    }
    finally {
        rows.release();
    }
}
//# sourceMappingURL=generic-adoption.js.map