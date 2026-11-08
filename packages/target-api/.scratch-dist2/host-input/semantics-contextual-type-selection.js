import { ContextFlagsSkipBindingPatterns } from "@tsonic/tsts";
import { Node_Expression, Node_Initializer, Node_Type } from "../source-model/ast.js";
export function selectSourceContextualValueType(ast, types, checker, semantics, node) {
    const contextualType = checker.getContextualType(node, ContextFlagsSkipBindingPatterns);
    if (contextualType === undefined) {
        return { kind: "unavailable" };
    }
    const rawCandidates = types.isUnion(contextualType)
        ? types.getUnionOrIntersectionTypes(contextualType)
        : [contextualType];
    if (rawCandidates.some((candidate) => candidate === undefined)) {
        return { kind: "unavailable" };
    }
    const candidates = rawCandidates.filter((candidate) => candidate !== undefined && !types.isNullish(candidate));
    if (candidates.length === 1) {
        return { kind: "selected", component: contextualComponent(ast, semantics, node, candidates[0]) };
    }
    return candidates.length === 0
        ? { kind: "unavailable" }
        : { kind: "ambiguous", types: Object.freeze(candidates) };
}
export function selectSourceContextualType(ast, checker, semantics, node) {
    const selected = checker.getContextualType(node);
    return selected === undefined ? undefined : contextualComponent(ast, semantics, node, selected);
}
function contextualComponent(ast, semantics, node, selectedType) {
    let current = node;
    for (let parent = ast.parent(current); parent !== undefined; parent = ast.parent(current)) {
        const assertion = ast.is.IsAsExpression(parent) || ast.is.IsTypeAssertion(parent) || ast.is.IsSatisfiesExpression(parent);
        if (assertion && Node_Expression(ast, parent) === current && !ast.isConstAssertion(parent) ||
            (ast.is.IsVariableDeclaration(parent) || ast.is.IsParameterDeclaration(parent) || ast.is.IsPropertyDeclaration(parent)) &&
                Node_Initializer(ast, parent) === current) {
            const authoredTypeNode = Node_Type(ast, parent);
            return Object.freeze({ selectedType, ...(authoredTypeNode === undefined ||
                    semantics.types.authoredSelection(authoredTypeNode, selectedType).kind === "unrelated" ? {}
                    : { declaration: parent, authoredTypeNode }) });
        }
        if (ast.is.IsCallExpression(parent) || ast.is.IsNewExpression(parent)) {
            const call = semantics.operations.call(parent);
            const bindings = call?.sourceArgumentBindings.filter(binding => binding.sourceForm === "value" && call.sourceArguments[binding.sourceArgumentIndex]?.expression === current);
            return Object.freeze({ selectedType, ...(call?.sourceSelectedSignatureKind === "resolved" && bindings?.length === 1 &&
                    call.sourceSelectedSignatureParameters[bindings[0].sourceParameterIndex]?.parameterDeclaration !== undefined
                    ? { contextualCall: call } : {}) });
        }
        if (Node_Expression(ast, parent) !== current || !(ast.is.IsParenthesizedExpression(parent) ||
            ast.is.IsNonNullExpression(parent) || ast.isConstAssertion(parent)))
            break;
        current = parent;
    }
    return Object.freeze({ selectedType });
}
//# sourceMappingURL=semantics-contextual-type-selection.js.map