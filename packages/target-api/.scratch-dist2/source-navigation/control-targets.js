import { BreakOrContinueStatement_Label, IterationStatement_Statement, LabeledStatement_Label, LabeledStatement_Statement } from "../source-model/ast.js";
import { sourceNodeHasRole } from "../source-model/callable-boundaries.js";
export function sourceControlTransferTarget(ast, node) {
    const kind = ast.kindName(node);
    if (kind !== "KindBreakStatement" && kind !== "KindContinueStatement")
        return undefined;
    const label = BreakOrContinueStatement_Label(ast, node);
    const labelText = label === undefined ? undefined : ast.text(label);
    let remaining = 2048;
    for (let parent = ast.parent(node); parent !== undefined && remaining > 0; parent = ast.parent(parent)) {
        remaining -= 1;
        const parentKind = ast.kindName(parent);
        // A jump never leaves its execution (a callable body or a class static block, E13 execution-barrier).
        if (sourceNodeHasRole(ast, parent, "execution-barrier"))
            return undefined;
        if (labelText !== undefined) {
            if (parentKind !== "KindLabeledStatement")
                continue;
            const declaration = LabeledStatement_Label(ast, parent);
            if (declaration === undefined || ast.text(declaration) !== labelText)
                continue;
            if (kind === "KindBreakStatement")
                return parent;
            let statement = LabeledStatement_Statement(ast, parent);
            while (statement !== undefined && ast.is.IsLabeledStatement(statement) && remaining > 0) {
                remaining -= 1;
                statement = LabeledStatement_Statement(ast, statement);
            }
            return statement !== undefined && sourceNodeIsIteration(ast, statement) ? statement : undefined;
        }
        if (sourceNodeIsIteration(ast, parent) || kind === "KindBreakStatement" && parentKind === "KindSwitchStatement")
            return parent;
    }
    return undefined;
}
export function sourceNodeIsIteration(ast, node) {
    const kind = ast.kindName(node);
    return kind === "KindWhileStatement" || kind === "KindForStatement" || kind === "KindForOfStatement" ||
        kind === "KindForInStatement" || kind === "KindDoStatement";
}
export function sourceLabeledStatementTarget(ast, node) {
    const label = LabeledStatement_Label(ast, node);
    const body = LabeledStatement_Statement(ast, node);
    if (label === undefined || body === undefined)
        return undefined;
    let current = body;
    while (current !== undefined && ast.is.IsLabeledStatement(current))
        current = LabeledStatement_Statement(ast, current);
    const loop = current !== undefined && sourceNodeIsIteration(ast, current) ? current : undefined;
    return Object.freeze({ name: ast.text(label), body, loop, loopBody: loop === undefined ? undefined : IterationStatement_Statement(ast, loop) });
}
//# sourceMappingURL=control-targets.js.map