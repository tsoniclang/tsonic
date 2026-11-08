/** Every selection refusal of the program, in source order of first request, computed once. */
export function createSourceSelectionRefusals(input) {
    let collected;
    return () => {
        collected ?? (collected = collect(input));
        return collected;
    };
}
function collect(input) {
    const { ast, selections, profile } = input;
    const profileRefusals = [];
    const visit = (node) => {
        if (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node) || ast.is.IsTaggedTemplateExpression(node)) {
            const call = selections.call(node);
            if (call !== undefined && call.kind !== "refused" && call.declaration !== undefined) {
                const refusal = profile.callRefusal(call.declaration);
                if (refusal !== undefined) {
                    profileRefusals.push(Object.freeze({ kind: "refused", code: refusal.code, message: refusal.message, site: node }));
                }
            }
        }
        else if (ast.is.IsForOfStatement(node) || ast.is.IsSpreadElement(node)) {
            // The protocol witness only: a SpreadElement is not a value node, and the iterable / element value refusals are
            // the value model's own (R2 #28).
            selections.iterationProtocolRefusal(node);
        }
        else if (ast.is.IsVariableDeclarationList(node)) {
            const kind = ast.variableDeclarationKind(node);
            if (kind === "using" || kind === "await using") {
                for (const declaration of ast.as.AsVariableDeclarationList(node)?.Declarations?.Nodes ?? []) {
                    if (declaration !== undefined)
                        selections.resource(declaration);
                }
            }
        }
        else if (ast.is.IsYieldExpression(node)) {
            selections.yield(node);
        }
        ast.forEachChild(node, child => { if (child !== undefined)
            visit(child); });
    };
    for (const file of input.sourceFiles)
        visit(file);
    return Object.freeze([...selections.refusals(), ...profileRefusals]);
}
//# sourceMappingURL=selection-refusals.js.map