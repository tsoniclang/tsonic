import { Node_Initializer, VariableDeclarationList_Declarations, VariableStatement_DeclarationList } from "../../../source-navigation/index.js";
// Whole-program execution starts in every checked source file and in the body of every exported callable, which a
// caller outside the program may run (RULINGS 2026-10-23). An exported body runs in its declaration activation, whose
// parameters and receiver are the symbolic external inputs, so its writes are possible effects of the program.
export function createSourceStorageProgramEntries(source, transport, scopes, reachability, step) {
    const { ast, navigation } = source;
    let entries;
    const collect = () => {
        const regions = [];
        const exported = (declaration) => navigation.declarationUseSummary(declaration).exported;
        const entry = (callable) => {
            for (const region of transport.regions.callable(callable, undefined, undefined, undefined, undefined, "active"))
                regions.push(Object.freeze({ region, owner: callable }));
        };
        for (const file of transport.sourceFiles) {
            if (!step())
                return undefined;
            if (file.IsDeclarationFile)
                continue;
            regions.push(Object.freeze({ region: file }));
            for (const statement of ast.statements(file)) {
                if (statement === undefined || !step())
                    continue;
                if (ast.is.IsFunctionDeclaration(statement) && ast.body(statement) !== undefined && exported(statement))
                    entry(statement);
                else if (ast.is.IsClassDeclaration(statement) && exported(statement)) {
                    for (const member of ast.members(statement)) {
                        if (member === undefined || !step())
                            continue;
                        if (ast.body(member) === undefined || ast.hasModifierKind(member, "private"))
                            continue;
                        if (ast.is.IsConstructorDeclaration(member) || ast.is.IsMethodDeclaration(member) ||
                            ast.is.IsGetAccessorDeclaration(member) || ast.is.IsSetAccessorDeclaration(member))
                            entry(member);
                    }
                }
                else if (ast.is.IsVariableStatement(statement)) {
                    for (const declaration of VariableDeclarationList_Declarations(ast, VariableStatement_DeclarationList(ast, statement)) ?? []) {
                        if (declaration === undefined || !step() || !exported(declaration))
                            continue;
                        const initializer = Node_Initializer(ast, declaration);
                        if (initializer !== undefined && (ast.is.IsArrowFunction(initializer) || ast.is.IsFunctionExpression(initializer)))
                            entry(initializer);
                    }
                }
            }
        }
        return Object.freeze(regions);
    };
    // The region terms of every program entry that reaches the execution root's demand.
    return (term) => {
        entries ?? (entries = collect());
        if (entries === undefined)
            return undefined;
        const terms = [];
        for (const { region, owner } of entries) {
            const reaches = reachability.region(region, term.demand);
            const scope = owner === undefined ? scopes.empty : scopes.declarationFor(owner, scopes.empty);
            if (reaches === undefined || scope === undefined)
                return undefined;
            if (reaches)
                terms.push(Object.freeze({ kind: "region", region, scope, demand: term.demand, deferred: term.deferred }));
        }
        return terms;
    };
}
//# sourceMappingURL=program-entries.js.map