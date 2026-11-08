import { normalizeSourcePropertyAccessDeclarations, selectedSourcePropertyDeclarations, } from "./semantics-selected-property-declarations.js";
import { selectRefinedSourcePropertyAccess } from "./semantics-property-refinement.js";
import { selectSourceTypeRefinement } from "./semantics-type-refinement.js";
import { sourceDeclarationSymbol, sourceDeclaredValueType } from "./navigation-checker.js";
import { aliasedSymbol, createSourceNavigationReferenceSelector, primaryDeclaration, symbolAtReferenceNode } from "./navigation-references.js";
export function createSourceNavigationInput(source) {
    const { ast } = source;
    const selectReference = createSourceNavigationReferenceSelector(ast);
    const merged = new WeakMap();
    const calls = new WeakMap();
    const accesses = new WeakMap();
    const constructs = new WeakMap();
    const ignoreModuleExports = () => undefined;
    const queriesOf = (node) => {
        const sourceFile = ast.getSourceFile(node);
        if (sourceFile === undefined)
            throw new Error("Navigation input requires a node of the checked program.");
        return source.getSourceFileQueries(sourceFile);
    };
    const checkerOf = (node) => queriesOf(node).checker;
    const defined = (values) => Object.freeze(values.filter((value) => value !== undefined));
    // The declaration's symbol in its own file's checker: the one declaration -> symbol selector (navigation-checker.ts).
    const declarationSymbol = (declaration) => sourceDeclarationSymbol(ast, checkerOf(declaration), declaration);
    // Program membership: the project's own implementation files (no declaration files, no provider virtual modules).
    const projectSourceFiles = Object.freeze(source.sourceFiles.filter((sourceFile) => sourceFile !== undefined && !sourceFile.IsDeclarationFile && !ast.getFileName(sourceFile).startsWith("tsts-provider://")));
    const projectFiles = new Set(projectSourceFiles);
    const isProjectNode = (node) => {
        const sourceFile = node === undefined ? undefined : ast.getSourceFile(node);
        return sourceFile !== undefined && projectFiles.has(sourceFile);
    };
    const reference = (node, reserveModuleExports = ignoreModuleExports) => {
        const sourceFile = ast.getSourceFile(node);
        return sourceFile === undefined ? undefined
            : selectReference(source.getSourceFileQueries(sourceFile).checker, node, reserveModuleExports);
    };
    const selectionQueries = new WeakMap();
    const selectionQueriesOf = (queries) => {
        let selected = selectionQueries.get(queries);
        if (selected === undefined) {
            const { checker, typeShape } = queries;
            selected = Object.freeze({
                declarations: Object.freeze({
                    rootSymbols: (symbol) => defined(checker.getRootSymbols(symbol)),
                    aliasedSymbol: (symbol) => checker.getAliasedSymbol(symbol),
                    symbolDeclarations: (symbol) => defined(checker.getSymbolDeclarations(symbol)),
                }),
                types: Object.freeze({ propertyInfos: typeShape.getPropertyInfos }),
            });
            selectionQueries.set(queries, selected);
        }
        return selected;
    };
    const mergedDeclarations = (declaration) => {
        const known = merged.get(declaration);
        if (known !== undefined)
            return known;
        const symbol = declarationSymbol(declaration);
        const declarations = symbol === undefined ? [] : defined(checkerOf(declaration).getSymbolDeclarations(symbol));
        const selected = declarations.includes(declaration) ? declarations : Object.freeze([declaration]);
        merged.set(declaration, selected);
        return selected;
    };
    const constructSignatures = (declaration) => {
        const known = constructs.get(declaration);
        if (known !== undefined)
            return known;
        const selected = selectConstructSignatures(source, declaration, checkerOf);
        constructs.set(declaration, selected);
        return selected;
    };
    const declaredMember = (typeDeclaration, member) => {
        const checker = checkerOf(typeDeclaration);
        const memberSymbol = checkerOf(member).getSymbolAtLocation(ast.name(member) ?? member);
        if (memberSymbol === undefined || !checkerOf(member).getSymbolDeclarations(memberSymbol).includes(member))
            return undefined;
        const property = checker.getPropertyOfType(checker.getDeclaredTypeOfSymbol(declarationSymbol(typeDeclaration)), checker.getSymbolName(memberSymbol));
        if (property === undefined)
            return Object.freeze([]);
        const primary = primaryDeclaration(checker, property);
        const declarations = defined(checker.getSymbolDeclarations(property));
        return Object.freeze(primary === undefined ? declarations : [primary, ...declarations.filter(entry => entry !== primary)]);
    };
    const call = (use) => {
        const known = calls.get(use);
        if (known !== undefined)
            return known ?? undefined;
        const checker = checkerOf(use);
        const info = checker.getResolvedCallInfo(use);
        const selected = info === undefined ? undefined : Object.freeze({
            call: info.call,
            selection: info.sourceSelectedSignatureKind,
            applicable: info.outcome === "applicable",
            optionalChain: info.optionalChain,
            ...(() => {
                const signature = checker.getSignatureDeclaration(info.selectedSignature);
                return signature === undefined ? {} : { signature };
            })(),
            callee: info.sourceCallee.expression,
            ...(info.sourceReceiver === undefined ? {} : { receiver: info.sourceReceiver.expression }),
            ...(info.sourceCalleeAccess === undefined ? {} : { calleeAccess: Object.freeze({ kind: info.sourceCalleeAccess.kind,
                    ...(() => {
                        const access = info.sourceCalleeAccess;
                        const declaration = access?.kind === "property" ? access.selectedDeclaration ?? access.declaration : undefined;
                        return declaration === undefined ? {} : { declaration };
                    })() }) }),
            arguments: Object.freeze(info.sourceArguments.map(argument => argument.expression)),
            bindings: Object.freeze(info.sourceArgumentBindings.map(binding => Object.freeze({
                sourceArgumentIndex: binding.sourceArgumentIndex,
                effectiveArgumentIndex: binding.effectiveArgumentIndex,
                sourceForm: binding.sourceForm,
                ...(binding.spreadElementIndex === undefined ? {} : { spreadElementIndex: binding.spreadElementIndex }),
                sourceParameterIndex: binding.sourceParameterIndex,
                sourceParameterForm: binding.sourceParameterForm,
            }))),
            parameters: Object.freeze(info.sourceSelectedSignatureParameters.map(parameter => Object.freeze({
                parameterIndex: parameter.parameterIndex,
                parameterName: parameter.parameterName,
                ...(parameter.parameterDeclaration === undefined ? {} : { parameterDeclaration: parameter.parameterDeclaration }),
                ...(parameter.authoredTypeNode === undefined ? {} : { authoredTypeNode: parameter.authoredTypeNode }),
                acceptsOmission: parameter.acceptsOmission,
                rest: parameter.rest,
            }))),
        });
        calls.set(use, selected ?? null);
        return selected;
    };
    const memberAccess = (access) => {
        const known = accesses.get(access);
        if (known !== undefined)
            return known ?? undefined;
        const queries = queriesOf(access);
        const selected = ast.is.IsPropertyAccessExpression(access) ? propertyAccess(access, queries)
            : ast.is.IsElementAccessExpression(access) ? elementAccess(access, queries) : undefined;
        accesses.set(access, selected ?? null);
        return selected;
    };
    // A property access: the checker selection, role-normalized (an accessor pair selects the get accessor for reads and
    // the set accessor for writes) and, for an unselected read through a narrowed project reference, the member of the
    // one refined receiver arm (selectRefinedSourcePropertyAccess). The one property-access declaration answer.
    function propertyAccess(access, queries) {
        const info = queries.checker.getResolvedPropertyAccessInfo(access);
        if (info === undefined)
            return undefined;
        const selectedQueries = selectionQueriesOf(queries);
        const normalized = normalizeSourcePropertyAccessDeclarations(ast, selectedQueries, info);
        const selected = refinedPropertyAccess(normalized, queries);
        return memberAccessRecord(access, selected.receiver.expression, selected.selectedDeclaration, selected.selectedReadDeclaration, selected.selectedWriteDeclaration, () => selectedSourcePropertyDeclarations(selectedQueries, undefined, selected.selectedSymbol) ?? [], selected.accessMode, selected.optionalChain, selected.callCallee);
    }
    function refinedPropertyAccess(selected, queries) {
        if (selected.selectedDeclaration !== undefined || selected.selectedSymbol === undefined || selected.accessMode !== "read")
            return selected;
        const receiver = selected.receiver.expression;
        if (!isProjectNode(receiver) || ast.is.IsTypeQueryNode(receiver))
            return selected;
        const selectedReference = reference(receiver);
        if (selectedReference === undefined || !isProjectNode(selectedReference.declaration))
            return selected;
        const { checker, typeShape } = queries;
        const declaredType = sourceDeclaredValueType(ast, checker, declaration => sourceDeclarationSymbol(ast, checker, declaration), selectedReference.declaration);
        if (declaredType === undefined)
            return selected;
        const selectedType = selected.receiver.type;
        return selectRefinedSourcePropertyAccess(selected, Object.freeze({ kind: "resolved", reference: selectedReference,
            declaredType, selectedType, refinement: selectSourceTypeRefinement(typeShape, checker, source.sourceFacts, declaredType, selectedType) }), checker, typeShape, source.sourceFacts, ast);
    }
    function elementAccess(access, queries) {
        const info = queries.checker.getResolvedElementAccessInfo(access);
        if (info === undefined)
            return undefined;
        return memberAccessRecord(access, info.receiver.expression, info.selectedDeclaration, undefined, undefined, () => selectedSourcePropertyDeclarations(selectionQueriesOf(queries), undefined, info.selectedSymbol) ?? [], info.accessMode, info.optionalChain, info.callCallee);
    }
    return Object.freeze({
        ast,
        sourceFiles: source.sourceFiles,
        projectSourceFiles,
        containsSourceFile: (sourceFile) => source.containsSourceFile(sourceFile),
        reference,
        mergedDeclarations,
        heritageTarget(heritage) {
            const reference = ast.is.IsExpressionWithTypeArguments(heritage)
                ? ast.as.AsExpressionWithTypeArguments(heritage)?.Expression : heritage;
            if (reference === undefined || ast.getSourceFile(reference) === undefined)
                return undefined;
            const checker = checkerOf(reference);
            const selected = symbolAtReferenceNode(ast, checker, reference);
            return primaryDeclaration(checker, aliasedSymbol(ast, checker, selected) ?? selected);
        },
        constructSignatures,
        declaredMember,
        declaredParameters(declaration) {
            const checker = checkerOf(declaration);
            const signature = checker.getSignatureFromDeclaration(declaration);
            return signature === undefined ? undefined : signatureParameterDeclarations(ast, checker, signature);
        },
        moduleExports(sourceFile) {
            const checker = source.getSourceFileQueries(sourceFile).checker;
            const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
            if (moduleSymbol === undefined)
                return Object.freeze([]);
            const exports = [];
            for (const exported of checker.getExportsOfModule(moduleSymbol)) {
                if (exported === undefined)
                    continue;
                const declaration = primaryDeclaration(checker, aliasedSymbol(ast, checker, exported) ?? exported);
                const declarationFile = ast.getSourceFile(declaration);
                if (declaration === undefined || declarationFile === undefined)
                    continue;
                exports.push(Object.freeze({ exportName: checker.getSymbolName(exported), declaration, sourceFile: declarationFile }));
            }
            return Object.freeze(exports);
        },
        moduleSourceFile: (moduleSpecifier) => source.resolveModuleSourceFile(moduleSpecifier),
        call,
        memberAccess,
    });
}
function signatureParameterDeclarations(ast, checker, signature) {
    const parameters = [];
    for (const symbol of checker.getSignatureParameters(signature)) {
        const parameter = symbol === undefined ? undefined : checker.getPrimarySymbolDeclaration(symbol);
        if (parameter === undefined || !ast.is.IsParameterDeclaration(parameter) || parameters.includes(parameter))
            return undefined;
        parameters.push(parameter);
    }
    return Object.freeze(parameters);
}
function selectConstructSignatures(source, declaration, checkerOf) {
    const { ast } = source;
    const unresolved = (site, reason) => Object.freeze({ kind: "unresolved", site, reason });
    const name = ast.name(declaration);
    const sourceFile = ast.getSourceFile(declaration);
    const expression = ast.is.IsClassExpression(declaration);
    if ((!expression && name === undefined) || sourceFile === undefined) {
        return unresolved(declaration, "The project class has no exact source declaration.");
    }
    const queries = source.getSourceFileQueries(sourceFile);
    const checker = checkerOf(declaration);
    const symbol = name === undefined ? undefined : checker.getSymbolAtLocation(name);
    const valueType = expression ? checker.getTypeAtLocation(declaration)
        : symbol === undefined ? undefined : checker.getTypeOfSymbol(symbol);
    const rawSignatures = valueType === undefined ? [] : checker.getConstructSignaturesOfType(valueType);
    const signatures = rawSignatures.filter((signature) => signature !== undefined);
    if (valueType === undefined || signatures.length === 0 || signatures.length !== rawSignatures.length) {
        return unresolved(declaration, "The checked source program did not provide an effective constructor signature for the project class.");
    }
    const selected = [];
    for (const signature of signatures) {
        const parameters = [];
        const requiredParameterCount = queries.typeShape.getSignatureParameterInfos(signature)
            .filter(parameter => !parameter.acceptsOmission).length;
        const parameterSymbols = checker.getSignatureParameters(signature);
        for (let index = 0; index < parameterSymbols.length; index += 1) {
            const parameterSymbol = parameterSymbols[index];
            if (parameterSymbol === undefined) {
                return unresolved(declaration, "An effective constructor signature contains an absent selected parameter symbol.");
            }
            const parameterDeclaration = checker.getPrimarySymbolDeclaration(parameterSymbol);
            const parameter = parameterDeclaration === undefined ? undefined : ast.as.AsParameterDeclaration(parameterDeclaration);
            if (parameterDeclaration === undefined || !ast.is.IsParameterDeclaration(parameterDeclaration) || parameter === undefined) {
                return unresolved(declaration, "A non-empty effective constructor signature has no exact parameter declaration.");
            }
            const parameterName = checker.getSymbolName(parameterSymbol);
            if (parameterName.length === 0) {
                return unresolved(parameterDeclaration, "The selected constructor parameter has no exact name.");
            }
            parameters.push(Object.freeze({
                parameterIndex: index,
                parameterName,
                parameterDeclaration,
                ...(parameter.Type === undefined ? {} : { authoredTypeNode: parameter.Type }),
                acceptsOmission: index >= requiredParameterCount,
                rest: parameter.DotDotDotToken !== undefined,
            }));
        }
        const signatureDeclaration = checker.getSignatureDeclaration(signature);
        selected.push(Object.freeze({
            ...(signatureDeclaration === undefined ? {} : { declaration: signatureDeclaration }),
            parameters: Object.freeze(parameters),
        }));
    }
    return Object.freeze({ kind: "signatures", signatures: Object.freeze(selected) });
}
function memberAccessRecord(access, receiver, declaration, read, write, members, accessMode, optionalChain, callCallee) {
    const selected = [...new Set([read, declaration, write].filter((node) => node !== undefined))];
    return Object.freeze({
        access,
        receiver,
        ...(declaration === undefined ? {} : { declaration }),
        ...(read === undefined ? {} : { readDeclaration: read }),
        ...(write === undefined ? {} : { writeDeclaration: write }),
        declarations: Object.freeze(selected.length > 0 ? selected : [...members()]),
        accessMode,
        optionalChain,
        callCallee,
    });
}
//# sourceMappingURL=navigation.js.map