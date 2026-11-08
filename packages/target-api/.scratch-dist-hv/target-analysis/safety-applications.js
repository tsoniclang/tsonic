import { Node_Expression } from "../source-model/ast.js";
import { isAstNode } from "../source-navigation/node-access.js";
export function createTargetSafetyApplicationIndex(input) {
    const all = [];
    const bySourceFile = new Map();
    const byDeclaration = new Map();
    const bySubject = new Map();
    const enclosingDeclarations = new Map();
    const wrappers = [];
    for (const sourceFile of input.sourceFiles) {
        const applications = [];
        walkSubtree(sourceFile, input.ast, (node) => {
            const parent = input.ast.parent(node);
            let enclosing = parent === undefined ? undefined : enclosingDeclarations.get(parent);
            if (input.ast.is.IsParenthesizedExpression(node)) {
                wrappers.push(node);
            }
            const unsafeContext = input.readUnsafeContext(node);
            if (unsafeContext !== undefined) {
                bySubject.set(node, Object.freeze({ kind: "unsafe-context", fact: unsafeContext }));
            }
            const builder = input.readSafetyBuilder(node);
            if (builder !== undefined) {
                bySubject.set(node, Object.freeze({ kind: "safety-builder", fact: builder }));
                const application = resolveApplication(node, sourceFile, builder, input);
                if (isApplicationFact(application)) {
                    applications.push(application);
                    all.push(application);
                }
                if (application.targetDeclarations.length > 0) {
                    const declarations = new Set(enclosing);
                    for (const declaration of application.targetDeclarations) {
                        declarations.add(declaration);
                        if (isApplicationFact(application)) {
                            const existing = byDeclaration.get(declaration) ?? [];
                            existing.push(application);
                            byDeclaration.set(declaration, existing);
                        }
                    }
                    enclosing = declarations;
                }
            }
            if (enclosing !== undefined)
                enclosingDeclarations.set(node, enclosing);
        });
        bySourceFile.set(sourceFile, Object.freeze(applications));
    }
    const byExpression = new Map(bySubject);
    for (let index = wrappers.length - 1; index >= 0; index -= 1) {
        const wrapper = wrappers[index];
        const operand = Node_Expression(input.ast, wrapper);
        const operation = bySubject.get(wrapper) ?? (operand === undefined ? undefined : byExpression.get(operand));
        if (operation !== undefined)
            byExpression.set(wrapper, operation);
    }
    for (const applications of byDeclaration.values())
        Object.freeze(applications);
    const emptyApplications = Object.freeze([]);
    return Object.freeze({
        all: Object.freeze(all),
        forSourceFile: (sourceFile) => bySourceFile.get(sourceFile) ?? emptyApplications,
        forDeclaration: (declaration) => byDeclaration.get(declaration) ?? emptyApplications,
        isCompileTimeApplicationReference: (declaration, reference) => enclosingDeclarations.get(reference)?.has(declaration) === true,
        operationForSubject: (subject) => bySubject.get(subject),
        operationForExpression: (expression) => byExpression.get(expression),
    });
}
function isApplicationFact(fact) {
    return fact.kind === "application";
}
function resolveApplication(sourceSubject, sourceFile, fact, input) {
    const selectedMemberDeclarations = Object.freeze([
        ...(fact.selectedMemberDeclarations ?? []),
        fact.selectedMemberDeclaration,
        fact.selectedMember,
    ].filter((subject) => isAstNode(input.ast, subject)));
    const applicationTarget = isAstNode(input.ast, fact.applicationTarget)
        ? fact.applicationTarget
        : undefined;
    const resolvedRootDeclaration = applicationTarget === undefined
        ? undefined
        : projectDeclaration(applicationTarget, input.identity);
    const application = {
        ...fact,
        sourceSubject,
        sourceFile,
        selectedMemberDeclarations,
        ...(resolvedRootDeclaration === undefined ? {} : { resolvedRootDeclaration }),
        targetDeclarations: applicationDeclarations(fact.applicationPlacement, selectedMemberDeclarations, resolvedRootDeclaration, input.ast),
    };
    return Object.freeze(application);
}
/**
 * The project declaration an application target names. The target must be a node of a project source file; a reference
 * to a project declaration resolves to that declaration, and any other project node is its own root.
 */
function projectDeclaration(subject, identity) {
    if (!identity.isProjectDeclaration(subject))
        return undefined;
    const target = identity.target(subject);
    return target?.project === true ? target.declaration : subject;
}
function applicationDeclarations(placement, selectedMemberDeclarations, resolvedRootDeclaration, ast) {
    switch (placement) {
        case "declaration":
            return uniqueNodes([...selectedMemberDeclarations, resolvedRootDeclaration]);
        case "constructor":
            return resolvedRootDeclaration === undefined || !ast.is.IsClassDeclaration(resolvedRootDeclaration)
                ? Object.freeze([])
                : uniqueNodes([
                    resolvedRootDeclaration,
                    ...ast.members(resolvedRootDeclaration).filter((member) => member !== undefined && ast.is.IsConstructorDeclaration(member)),
                ]);
        case "getter":
            return uniqueNodes(selectedMemberDeclarations.filter((declaration) => ast.is.IsGetAccessorDeclaration(declaration) || carriesBothAccessors(ast, declaration)));
        case "setter":
            return uniqueNodes(selectedMemberDeclarations.filter((declaration) => ast.is.IsSetAccessorDeclaration(declaration) || carriesBothAccessors(ast, declaration)));
    }
}
function carriesBothAccessors(ast, declaration) {
    return ast.is.IsIndexSignatureDeclaration(declaration) ||
        ast.is.IsPropertyDeclaration(declaration) ||
        ast.is.IsPropertySignatureDeclaration(declaration);
}
function uniqueNodes(nodes) {
    return Object.freeze([...new Set(nodes.filter((node) => node !== undefined))]);
}
function walkSubtree(root, ast, visit) {
    const pending = [root];
    while (pending.length > 0) {
        const node = pending.pop();
        if (node === undefined) {
            continue;
        }
        visit(node);
        const children = ast.children(node).filter((child) => child !== undefined);
        for (let index = children.length - 1; index >= 0; index -= 1) {
            pending.push(children[index]);
        }
    }
}
//# sourceMappingURL=safety-applications.js.map