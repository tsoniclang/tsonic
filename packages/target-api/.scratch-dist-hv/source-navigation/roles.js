import { sourceTransparentExpressionOperand } from "../source-model/ast.js";
import { isSourceCallableBodyBoundary, sourceEnclosing, sourceNodeRoles } from "../source-model/callable-boundaries.js";
import { sourceLexicalFunctionIsUnused } from "./callable-invocations.js";
import { sourceControlTransferTarget } from "./control-targets.js";
import { sourceDeclarationHasOnlyTypeUses } from "./declaration-use-summary.js";
import { sourceConstructValueInputs, sourceExpressionValueInputs } from "./expression-use.js";
import { sourceExpressionEffects } from "./expression-effects.js";
import { sourceNodeIdentity } from "./identity.js";
import { createSourceLexicalCaptureQuery, sourceBindingIterationScope, sourceBindingScope, sourceDeclarationIsModuleScoped, } from "./lexical-captures.js";
import { sourceReceiverOwner } from "./receiver-owner.js";
import { sourceCallableUsesLexicalThis, sourceExpressionUsesLexicalThis } from "../source-semantics/lexical-this.js";
import { sourceNodeIsNativeUnreachable } from "../source-semantics/native-control-flow.js";
const projectShapeKinds = new Set([
    "KindClassDeclaration", "KindClassExpression", "KindInterfaceDeclaration", "KindEnumDeclaration", "KindEnumMember",
]);
export function createSourceRoleModel(input) {
    const { ast, navigation } = input;
    const roles = new WeakMap();
    const suspensionsMemo = new WeakMap();
    const capturesMemo = new WeakMap();
    const effectsMemo = new WeakMap();
    // The one expression-effects owner: authored syntax plus Host value primitiveness (the raw navigation has no effects).
    const effectsInput = Object.freeze({ ast, operandIsPrimitive: (operand) => input.valueIsPrimitive(operand) });
    const sourceFileOf = (node) => {
        const sourceFile = ast.getSourceFile(node);
        if (sourceFile === undefined)
            throw new Error("Source roles require a node of the checked program.");
        return sourceFile;
    };
    const projectValueDeclaration = (node) => {
        if (ast.isDeclarationFile(sourceFileOf(node)))
            return undefined;
        const declaration = input.valueTypeDeclaration(node);
        return declaration !== undefined && navigation.isProjectDeclaration(declaration) ? declaration : undefined;
    };
    const target = (reference) => {
        const selected = navigation.sourceReferenceFor(reference);
        return selected === undefined ? undefined
            : Object.freeze({ declaration: selected.declaration, sourceFile: selected.sourceFile, project: selected.project });
    };
    // Roles are additive (one predicate per role, callable-boundaries.ts); memoized per program (I5).
    const role = (node) => {
        const known = roles.get(node);
        if (known !== undefined)
            return known;
        const selected = sourceNodeRoles(ast, node);
        roles.set(node, selected);
        return selected;
    };
    // One walk per purpose over the memoized roles; the nearest strict ancestor holding the role.
    const enclosing = (node, selected) => sourceEnclosing(ast, node, selected, (candidate, wanted) => role(candidate).includes(wanted));
    const suspensions = (callable) => {
        const known = suspensionsMemo.get(callable);
        if (known !== undefined)
            return known;
        if (!isSourceCallableBodyBoundary(ast, callable))
            throw new Error("Suspension facts require a callable with a body.");
        const found = [];
        const body = ast.body(callable);
        const visit = (node) => {
            if (node !== callable && isSourceCallableBodyBoundary(ast, node))
                return;
            const kind = ast.kindName(node);
            if (kind === "KindAwaitExpression" || kind === "KindYieldExpression")
                found.push(node);
            else if (kind === "KindForOfStatement" && ast.as.AsForInOrOfStatement(node)?.AwaitModifier !== undefined)
                found.push(node);
            else if (kind === "KindVariableDeclarationList" && ast.variableDeclarationKind(node) === "await using")
                found.push(node);
            ast.forEachChild(node, child => { if (child !== undefined)
                visit(child); });
        };
        if (body !== undefined)
            visit(body);
        const frozen = Object.freeze(found);
        suspensionsMemo.set(callable, frozen);
        return frozen;
    };
    // A projection of the one lexical capture selection (lexical-captures.ts, facts.analyses.lexicalCaptures): the same
    // owner domain (callable-body ∪ class-scope; any other node throws) and the same roots [owner], so parameter-initializer
    // captures are included. Only the binding and its written flag are projected.
    const lexicalCaptures = createSourceLexicalCaptureQuery(ast, navigation);
    const captures = (callable) => {
        const known = capturesMemo.get(callable);
        if (known !== undefined)
            return known;
        const selection = lexicalCaptures(callable);
        const result = Object.freeze(selection.captures.map(capture => Object.freeze({
            declaration: capture.declaration,
            written: navigation.declarationUseSummary(capture.declaration).bindingWritten,
        })));
        capturesMemo.set(callable, result);
        return result;
    };
    const stable = (expression) => {
        const operand = transparentOperand(expression);
        const kind = ast.kindName(operand);
        if (kind === "KindThisKeyword" || kind === "KindStringLiteral" || kind === "KindNumericLiteral" ||
            kind === "KindBigIntLiteral" || kind === "KindTrueKeyword" || kind === "KindFalseKeyword" ||
            kind === "KindNullKeyword" || kind === "KindNoSubstitutionTemplateLiteral")
            return true;
        if (kind !== "KindIdentifier")
            return false;
        const selected = navigation.sourceReferenceFor(operand);
        if (selected === undefined || !selected.project)
            return false;
        const summary = navigation.declarationUseSummary(selected.declaration);
        return !summary.bindingWritten && !summary.mutatedAfterInitialization;
    };
    const transparentOperand = (expression) => {
        let current = expression;
        for (let operand = sourceTransparentExpressionOperand(ast, current); operand !== undefined; operand = sourceTransparentExpressionOperand(ast, current))
            current = operand;
        return current;
    };
    return Object.freeze({
        // The one node inventory (node-inventory.ts), the same one the storage transport walks (FX-CC-H4).
        nodesForFiles: (files) => navigation.nodesForFiles(files),
        identity: Object.freeze({
            target,
            declarations: (declaration) => navigation.mergedDeclarations(declaration),
            isProjectDeclaration: (node) => navigation.isProjectDeclaration(node),
            // R2 #44: the project declaration the Host value type at `node` names (`this`, `new C()`, a call result): the
            // replacement of the removed checked-type fallback of declarationFor / referenceFor, from the value model (R3).
            valueDeclaration: (node) => projectValueDeclaration(node),
            isProjectShape(node) {
                const declaration = projectValueDeclaration(node);
                return declaration !== undefined && projectShapeKinds.has(ast.kindName(declaration));
            },
            isProjectConstructibleObject(node) {
                const declaration = projectValueDeclaration(node);
                return declaration !== undefined && (ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration)) &&
                    acceptsNoConstructorArguments(ast, declaration);
            },
            identity(node) {
                const identity = sourceNodeIdentity(ast, node);
                if (identity === undefined)
                    throw new Error("Source identity requires a node of the checked program.");
                return identity;
            },
        }),
        modules: Object.freeze({
            dependencies: (sourceFile) => navigation.moduleDependencies(sourceFile),
            references: (sourceFile) => navigation.moduleReferences(sourceFile),
            exports(sourceFile) {
                return Object.freeze(navigation.moduleExports(sourceFile).map(entry => Object.freeze({
                    exportName: entry.exportName, declaration: entry.declaration, sourceFile: entry.sourceFile,
                    project: navigation.isProjectDeclaration(entry.declaration),
                })));
            },
            specifier: (moduleSpecifier) => navigation.moduleSpecifierResolution(moduleSpecifier),
            hasTopLevelAwait: (sourceFile) => navigation.moduleHasTopLevelAwait(sourceFile),
        }),
        uses: Object.freeze({
            uses: (declaration) => navigation.declarationUses(declaration),
            summary: (declaration) => navigation.declarationUseSummary(declaration),
            parameterSummary: (parameter) => navigation.parameterUseSummary(parameter),
            references: (declaration) => navigation.referencesToDeclaration(declaration),
            referencesWithin: (declaration, root) => navigation.referencesWithin(declaration, root),
            writesWithin(declaration, root) {
                return Object.freeze(navigation.bindingWritesWithin(declaration, root).map(write => {
                    const value = write.values.find(entry => entry.kind === "value")?.expression;
                    return Object.freeze({
                        write: write.reference,
                        ...(value === undefined ? {} : { value }),
                        compound: write.kind === "update" || write.kind === "assignment" && compoundAssignment(ast, write.operation),
                    });
                }));
            },
            referencedOutside: (declaration, excluded) => navigation.hasReferenceOutside(declaration, excluded),
            hasOnlyTypeUses: (declaration) => sourceDeclarationHasOnlyTypeUses(navigation.declarationUseSummary(declaration)),
        }),
        expressions: Object.freeze({
            effects: (expression) => sourceExpressionEffects(effectsInput, expression, effectsMemo),
            valueFlow: (expression) => navigation.expressionValueFlow(expression),
            resultUse: (expression) => navigation.expressionResultUse(expression),
            resultDisposition: (expression) => navigation.expressionResultDisposition(expression),
            // A call, `new` or tagged template whose inputs the expression walk does not list takes its construct inputs.
            valueInputs(expression) {
                const kind = ast.kindName(expression);
                return kind === "KindNewExpression" || kind === "KindCallExpression" || kind === "KindTaggedTemplateExpression"
                    ? sourceExpressionValueInputs(ast, expression) ?? sourceConstructValueInputs(ast, expression)
                    : sourceExpressionValueInputs(ast, expression);
            },
            constructInputs: (owner) => sourceConstructValueInputs(ast, owner),
            transparentOperand,
            stable,
        }),
        scopes: Object.freeze({
            role,
            enclosing,
            bindingScope(declaration) {
                const scope = sourceBindingScope(declaration, ast);
                if (scope === undefined)
                    throw new Error("A binding scope requires a binding declaration.");
                return scope;
            },
            iterationScope: (declaration) => sourceBindingIterationScope(declaration, ast),
            isModuleScoped: (declaration) => sourceDeclarationIsModuleScoped(declaration, ast),
            thisBinder: (node) => sourceReceiverOwner(node, ast, "lexical-capture"),
            usesLexicalThis: (node) => isSourceCallableBodyBoundary(ast, node)
                ? sourceCallableUsesLexicalThis(ast, node) : sourceExpressionUsesLexicalThis(ast, node),
            captures,
            suspensions,
            controlTransferTarget: (statement) => sourceControlTransferTarget(ast, statement),
            countedLoop(statement) {
                const loop = navigation.countedLoop(statement);
                return loop === undefined ? undefined : Object.freeze({
                    statement: loop.statement, counter: loop.counterDeclaration, start: loop.start, bound: loop.bound, body: loop.body,
                });
            },
            unreachable: (node) => sourceNodeIsNativeUnreachable(ast, node, input.conditionValue),
            unused: (callable) => sourceLexicalFunctionIsUnused(callable, ast, navigation),
        }),
    });
}
function compoundAssignment(ast, operation) {
    if (!ast.is.IsBinaryExpression(operation))
        return false;
    const operator = ast.as.AsBinaryExpression(operation)?.OperatorToken;
    return operator !== undefined && ast.kindName(operator) !== "KindEqualsToken";
}
/** A class constructible with no arguments: no constructor, or one whose every parameter is optional, defaulted or rest. */
function acceptsNoConstructorArguments(ast, classDeclaration) {
    const constructors = ast.members(classDeclaration)
        .filter((member) => member !== undefined && ast.is.IsConstructorDeclaration(member));
    return constructors.length === 0 || constructors.some(constructor => ast.parameters(constructor).every(parameter => {
        const declaration = parameter === undefined ? undefined : ast.as.AsParameterDeclaration(parameter);
        return declaration !== undefined && (declaration.QuestionToken !== undefined || declaration.Initializer !== undefined ||
            declaration.DotDotDotToken !== undefined);
    }));
}
//# sourceMappingURL=roles.js.map