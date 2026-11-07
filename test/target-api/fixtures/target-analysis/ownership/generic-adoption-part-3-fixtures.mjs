import { defaultSourceDeclarationOwnershipLimits } from "../../../../../packages/target-api/dist/target-analysis/ownership/contracts.js";
import assert from "node:assert/strict";
import { hostCallIsSettled, sourceSpan } from "./generic-adoption-fixtures.mjs";
import { sourceTypeDescriptorsEqual } from "../../../../../packages/target-api/dist/public/source.js";
import { analyzeSourceDeclarationGenericAdoption } from "../../../../../packages/target-api/dist/target-analysis/ownership/generic-adoption.js";
import { createSourceDeclarationOwnershipBudget, sourceDeclarationOwnershipUnresolved } from "../../../../../packages/target-api/dist/target-analysis/ownership/contracts.js";
function declaredQuery(current, limits = defaultSourceDeclarationOwnershipLimits) {
    const node = current.nodes[0];
    const budget = createSourceDeclarationOwnershipBudget(node, limits);
    return analyzeSourceDeclarationGenericAdoption({ source: current.source, nodes: current.nodes, projectRoot: "/src", budget,
        premises: { completionFor(call, selected) {
                const declaration = selected.signature;
                if (declaration === undefined)
                    return sourceDeclarationOwnershipUnresolved(call, "The unit native contract requires its real selected declaration.");
                if (hostCallIsSettled(current.source, call, selected))
                    return { kind: "not-async" };
                return { kind: "async", resultPolicy: "must-observe", contract: { kind: "declaration", declaration,
                        component: { type: selected.result, call } } };
            } } });
}
export function checkedOperation(current, expression) {
    const { source } = current;
    const candidates = current.nodes.filter(node => (source.ast.is.IsCallExpression(node) || source.ast.is.IsNewExpression(node) ||
        source.ast.is.IsPropertyAccessExpression(node)) && current.textFor(node) === expression);
    assert.equal(candidates.length, 1, "the original checked operation remains unique");
    const node = candidates[0];
    // The Host descriptor of the operation (facts.values), the navigation call witness and the per-use instantiation.
    const outcome = source.facts.values.type(node);
    assert.equal(outcome.kind === "refused", false, "the original operation retains its exact Host result type");
    const type = outcome.kind === "refused" ? undefined : outcome.type;
    const selected = source.ast.is.IsCallExpression(node) || source.ast.is.IsNewExpression(node)
        ? source.navigation.call(node) : undefined;
    let declaration;
    let typeArguments = [];
    if (selected !== undefined) {
        if (selected.selection !== "resolved")
            assert.fail("the same checked call must select its signature");
        declaration = selected.signature;
        assert.equal(declaration !== undefined && current.nodes.includes(declaration), true, "the selected declaration belongs to the original checked program");
        const selection = source.facts.selections.call(node);
        assert.equal(selection !== undefined && selection.kind !== "refused" && type !== undefined &&
            sourceTypeDescriptorsEqual(selection.result, type), true, "the selected native result and original expression keep the same Host component");
        const instantiation = source.facts.instantiations.at(node);
        typeArguments = instantiation === undefined || instantiation.kind === "refused" ? [] : instantiation.method;
        for (const binding of typeArguments) {
            assert.equal(source.ast.is.IsTypeParameterDeclaration(binding.declaration) && current.nodes.includes(binding.declaration),
                true, "each selected generic argument retains its real checked formal");
        }
    }
    else {
        assert.equal(source.ast.is.IsPropertyAccessExpression(node), true, "only an original member read has no call signature");
    }
    return { node, type, declaration, typeArgumentCount: typeArguments.length,
        sourceSpan: sourceSpan(source, node) };
}
export { declaredQuery };
