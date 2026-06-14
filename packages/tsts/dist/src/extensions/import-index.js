import { KindIdentifier, KindImportDeclaration, KindImportSpecifier, KindNamedImports, KindNamespaceImport, KindStringLiteral, } from "../internal/ast/generated/kinds.js";
import { AsIdentifier, AsImportClause, AsImportDeclaration, AsImportSpecifier, AsNamedImports, AsNamespaceImport, AsStringLiteral, } from "../internal/ast/generated/casts.js";
import { Node_IsTypeOnly } from "../internal/ast/ast.js";
const nodeText = (node) => {
    if (!node)
        return undefined;
    if (node.Kind === KindIdentifier) {
        return AsIdentifier(node)?.Text;
    }
    if (node.Kind === KindStringLiteral) {
        return AsStringLiteral(node)?.Text;
    }
    return undefined;
};
const nodesOf = (list) => list?.Nodes ?? [];
const collectNamedBindings = (namedImports, importNode, isImportClauseTypeOnly) => {
    const bindings = [];
    for (const specifierNode of nodesOf(namedImports?.Elements)) {
        if (specifierNode?.Kind !== KindImportSpecifier)
            continue;
        const specifier = AsImportSpecifier(specifierNode);
        if (!specifier)
            continue;
        const localName = nodeText(specifier.name);
        const importedName = nodeText(specifier.PropertyName) ?? localName;
        if (!localName || !importedName)
            continue;
        bindings.push({
            kind: "named",
            localName,
            importedName,
            isTypeOnly: isImportClauseTypeOnly || specifier.IsTypeOnly === true,
            importNode,
            bindingNode: specifierNode,
        });
    }
    return bindings;
};
const collectImportBindings = (declaration, importNode) => {
    const clauseNode = declaration?.ImportClause;
    if (!clauseNode)
        return [];
    const clause = AsImportClause(clauseNode);
    if (!clause)
        return [];
    const bindings = [];
    const isImportClauseTypeOnly = isTypeOnlyImportClause(clauseNode);
    const defaultName = nodeText(clause.name);
    if (defaultName) {
        bindings.push({
            kind: "default",
            localName: defaultName,
            importedName: "default",
            isTypeOnly: isImportClauseTypeOnly,
            importNode,
            bindingNode: clause.name,
        });
    }
    const namedBindings = clause.NamedBindings;
    if (namedBindings?.Kind === KindNamedImports) {
        bindings.push(...collectNamedBindings(AsNamedImports(namedBindings), importNode, isImportClauseTypeOnly));
    }
    if (namedBindings?.Kind === KindNamespaceImport) {
        const namespaceImport = AsNamespaceImport(namedBindings);
        const namespaceName = nodeText(namespaceImport?.name);
        if (namespaceName) {
            bindings.push({
                kind: "namespace",
                localName: namespaceName,
                importedName: "*",
                isTypeOnly: isImportClauseTypeOnly,
                importNode,
                bindingNode: namedBindings,
            });
        }
    }
    return bindings;
};
const isTypeOnlyImportClause = (clause) => Node_IsTypeOnly(clause);
export const createExtensionImportIndex = (sourceFile) => {
    const modules = [];
    const bindingsByLocalName = new Map();
    for (const statement of nodesOf(sourceFile?.Statements)) {
        if (statement?.Kind !== KindImportDeclaration)
            continue;
        const declaration = AsImportDeclaration(statement);
        if (!declaration)
            continue;
        const moduleSpecifier = AsStringLiteral(declaration.ModuleSpecifier);
        const specifier = moduleSpecifier?.Text;
        if (!specifier)
            continue;
        const bindings = collectImportBindings(declaration, statement);
        for (const binding of bindings) {
            bindingsByLocalName.set(binding.localName, binding);
        }
        modules.push({
            specifier,
            isTypeOnly: bindings.length > 0 &&
                bindings.every((binding) => binding.isTypeOnly),
            importNode: statement,
            bindings,
        });
    }
    return {
        sourceFile,
        modules,
        getBindingsFrom: (specifier) => modules
            .filter((module) => module.specifier === specifier)
            .flatMap((module) => module.bindings),
        resolveLocalName: (localName) => bindingsByLocalName.get(localName),
    };
};
//# sourceMappingURL=import-index.js.map