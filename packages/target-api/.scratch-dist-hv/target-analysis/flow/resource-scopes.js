import { AsVariableDeclaration } from "../../source-navigation/checked-casts.js";
export function analyzeSourceResourceScopes(ast, nodes, erased) {
    const variables = new Map();
    const scopes = new Map();
    const tails = new Map();
    const resource = (node) => ast.variableDeclarationKind(node) === "using" || ast.variableDeclarationKind(node) === "await using";
    for (const node of nodes) {
        if (erased(node))
            continue;
        const list = ast.is.IsVariableStatement(node) ? ast.as.AsVariableStatement(node)?.DeclarationList : node;
        if (ast.is.IsVariableDeclaration(node))
            variables.set(node, Object.freeze([node]));
        else if (list !== undefined && ast.is.IsVariableDeclarationList(list)) {
            const declarations = ast.as.AsVariableDeclarationList(list)?.Declarations?.Nodes;
            if (!Array.isArray(declarations))
                continue;
            const selected = [];
            let valid = true;
            for (let index = 0; index < declarations.length; index += 1) {
                const descriptor = Object.getOwnPropertyDescriptor(declarations, index);
                const declaration = descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
                if (declaration === undefined || declaration === null || !ast.is.IsVariableDeclaration(declaration) ||
                    ast.parent(declaration) !== list) {
                    valid = false;
                    break;
                }
                if (!erased(declaration))
                    selected.push(declaration);
            }
            if (valid)
                variables.set(node, Object.freeze(selected));
        }
    }
    const publish = (owner, declarations, remainder) => {
        const resources = declarations.filter(resource);
        if (resources.length === 0)
            return;
        scopes.set(owner, Object.freeze({ declarations: Object.freeze(resources),
            kind: resources.some(declaration => ast.variableDeclarationKind(declaration) === "await using") ? "async" : "sync" }));
        for (const declaration of resources)
            tails.set(declaration, Object.freeze(remainder(declaration)));
    };
    for (const owner of nodes) {
        if (erased(owner))
            continue;
        if (ast.is.IsVariableStatement(owner)) {
            const resources = (variables.get(owner) ?? []).filter(resource);
            if (resources.length !== 0)
                scopes.set(owner, Object.freeze({ declarations: Object.freeze(resources),
                    kind: resources.some(declaration => ast.variableDeclarationKind(declaration) === "await using") ? "async" : "sync" }));
        }
        else if (ast.is.IsBlock(owner) || ast.is.IsSourceFile(owner)) {
            const statements = ast.statements(owner).filter((statement) => statement !== undefined && !erased(statement));
            const declarations = statements.flatMap(statement => variables.get(statement) ?? []);
            publish(owner, declarations, declaration => {
                const list = ast.parent(declaration);
                const statement = list === undefined ? undefined : ast.parent(list);
                const position = statement === undefined ? -1 : statements.indexOf(statement);
                const siblings = statement === undefined ? [] : variables.get(statement) ?? [];
                const followingInitializers = siblings.slice(siblings.indexOf(declaration) + 1).flatMap(sibling => {
                    const initializer = AsVariableDeclaration(ast, sibling)?.Initializer;
                    return initializer === undefined ? [] : [initializer];
                });
                return [...followingInitializers, ...statements.slice(position + 1)];
            });
        }
        else if (ast.is.IsForStatement(owner) || ast.is.IsForOfStatement(owner)) {
            const statement = ast.is.IsForStatement(owner) ? ast.as.AsForStatement(owner) : ast.as.AsForInOrOfStatement(owner);
            const declarations = statement?.Initializer === undefined ? [] : variables.get(statement.Initializer) ?? [];
            const body = statement?.Statement;
            publish(owner, declarations, () => ast.is.IsForStatement(owner) ? [owner] : body === undefined ? [] : [body]);
        }
    }
    return Object.freeze({ variables, scopes, tails });
}
//# sourceMappingURL=resource-scopes.js.map