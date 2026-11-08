import { sourceDeclarationUses } from "./declaration-uses.js";
import { sourceNodesEqual } from "./identity.js";
import { sourceTransparentExpressionOperand } from "../source-model/ast.js";
import { sourceExpressionSelectsOperandValue } from "./expression-use.js";
export function sourceExpressionValueFlow(ast, expression, sourceReferenceFor, declarationUses, declarationUseSummary) {
    const aliases = [];
    const queued = new Set();
    const uses = [];
    let memberWritten = false;
    let receiverUsed = false;
    let identityCompared = false;
    let captured = false;
    let returned = false;
    let yielded = false;
    let passedAsArgument = false;
    let storedOutsideBinding = false;
    let exported = false;
    let discarded = false;
    let hasUnclassifiedUse = false;
    const enqueueAlias = (declaration) => {
        if (queued.has(declaration)) {
            return;
        }
        queued.add(declaration);
        aliases.push(declaration);
    };
    const consumeUse = (use) => {
        uses.push(use);
        captured || (captured = use.captured);
        memberWritten || (memberWritten = use.role === "write" && use.throughMember);
        receiverUsed || (receiverUsed = use.role === "receiver");
        identityCompared || (identityCompared = use.role === "comparison");
        returned || (returned = use.role === "return");
        yielded || (yielded = use.role === "yield");
        passedAsArgument || (passedAsArgument = use.role === "argument");
        hasUnclassifiedUse || (hasUnclassifiedUse = use.role === "value");
        if (use.role === "storage") {
            const destination = exactBindingAliasDestination(ast, use.reference, sourceReferenceFor);
            if (destination === undefined) {
                storedOutsideBinding = true;
            }
            else {
                enqueueAlias(destination);
            }
        }
    };
    const directAlias = exactBindingAliasDestination(ast, expression, sourceReferenceFor);
    if (directAlias !== undefined) {
        enqueueAlias(directAlias);
    }
    else {
        const [directUse] = sourceDeclarationUses(ast, expression, [expression]);
        if (directUse !== undefined) {
            consumeUse(directUse);
        }
        const parent = transparentExpressionParent(ast, expression);
        discarded = parent !== undefined &&
            (ast.is.IsExpressionStatement(parent) || ast.is.IsVoidExpression(parent));
        exported = parent !== undefined && ast.is.IsExportAssignment(parent);
    }
    for (let index = 0; index < aliases.length; index += 1) {
        const declaration = aliases[index];
        const summary = declarationUseSummary(declaration);
        exported || (exported = summary.exported);
        for (const use of declarationUses(declaration)) {
            consumeUse(use);
        }
    }
    return Object.freeze({
        expression,
        aliasDeclarations: Object.freeze(aliases),
        uses: Object.freeze(uses),
        bindingAliased: aliases.length > 1,
        memberWritten,
        receiverUsed,
        identityCompared,
        captured,
        returned,
        yielded,
        passedAsArgument,
        storedOutsideBinding,
        exported,
        discarded,
        hasUnclassifiedUse,
        escapes: captured || returned || yielded || passedAsArgument ||
            storedOutsideBinding || exported,
    });
}
function exactBindingAliasDestination(ast, expression, sourceReferenceFor) {
    let current = expression;
    for (;;) {
        const parent = ast.parent(current);
        if (parent === undefined) {
            return undefined;
        }
        if (sourceNodesEqual(ast, sourceTransparentExpressionOperand(ast, parent), current) || sourceExpressionSelectsOperandValue(ast, parent, current)) {
            current = parent;
            continue;
        }
        if (ast.is.IsVariableDeclaration(parent) &&
            sourceNodesEqual(ast, ast.as.AsVariableDeclaration(parent)?.Initializer, current) &&
            ast.is.IsIdentifier(ast.name(parent))) {
            return parent;
        }
        if (ast.is.IsBinaryExpression(parent) &&
            ast.operatorKindName(parent) === "KindEqualsToken" &&
            sourceNodesEqual(ast, ast.as.AsBinaryExpression(parent)?.Right, current)) {
            const left = ast.as.AsBinaryExpression(parent)?.Left;
            return ast.is.IsIdentifier(left)
                ? sourceReferenceFor(left)?.declaration
                : undefined;
        }
        return undefined;
    }
}
function transparentExpressionParent(ast, expression) {
    let current = expression;
    for (;;) {
        const parent = ast.parent(current);
        if (parent === undefined || !sourceNodesEqual(ast, sourceTransparentExpressionOperand(ast, parent), current) &&
            !sourceExpressionSelectsOperandValue(ast, parent, current)) {
            return parent;
        }
        current = parent;
    }
}
//# sourceMappingURL=value-flow.js.map