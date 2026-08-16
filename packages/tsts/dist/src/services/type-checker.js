import { Background } from "../go/context.js";
import { Node_Text } from "../internal/ast/ast.js";
import { NodeFlagsOptionalChain, SymbolFlagsAlias, SymbolFlagsNamespace, SymbolFlagsType, SymbolFlagsValue, } from "../internal/ast/generated/flags.js";
import { IsElementAccessExpression, IsGetAccessorDeclaration, IsIdentifier, IsObjectLiteralExpression, IsPropertyAccessExpression, IsPropertyAssignment, IsSetAccessorDeclaration, IsShorthandPropertyAssignment, } from "../internal/ast/generated/predicates.js";
import { GetSourceFileOfNode, GetContainingFunction, IsCallOrNewExpression, IsObjectLiteralMethod, OEKAssertions, OEKParentheses, SkipOuterExpressions, } from "../internal/ast/utilities.js";
import { Program_GetTypeCheckerForFile } from "../internal/compiler/program.js";
import { Checker_GetPropertyOfType, Checker_ResolveName, Checker_GetReturnTypeOfSignature, Checker_GetSignaturesOfType, Checker_GetTypeFromTypeNode, Checker_GetTypeOfPropertyOfType, } from "../internal/checker/exports.js";
import { Checker_finalizeResolvedCallEvidence, Checker_getResolvedSignature, } from "../internal/checker/checker/signatures.js";
import { CheckModeNormal } from "../internal/checker/checker/state.js";
import { Checker_GetAliasedSymbol, Checker_getResolvedSourceElementAccessInfo, Checker_getResolvedSourcePropertyAccessInfo, Checker_GetSymbolAtLocation, Checker_getDeclaredTypeOfSymbol, Checker_getSymbolOfDeclaration, Checker_getResolvedSymbolOrNil, Checker_getTypeOfSymbol, Checker_getWriteTypeOfSymbol, Checker_resolveExternalModuleName, Checker_resolveExternalModuleSymbol, } from "../internal/checker/checker/symbols.js";
import { Checker_getApparentTypeOfContextualType, Checker_getContextualType, Checker_getContextualTypeForObjectLiteralElement, Checker_GetTypeAtLocation, } from "../internal/checker/checker/types.js";
import { Checker_isAssignmentToReadonlyEntity } from "../internal/checker/checker/relations.js";
import { AssignmentKindDefinite } from "../internal/checker/utilities.js";
import { Checker_getResolvedSourceIterationInfo } from "../internal/checker/checker/syntax-checking.js";
import { Checker_GetConstantValue, Checker_GetExportsOfModule } from "../internal/checker/services.js";
import { Checker_TypeToString } from "../internal/checker/printer.js";
import { ContextFlagsNone, SignatureKindCall, SignatureKindConstruct } from "../internal/checker/types.js";
import { resolveSourceGeneratorInfo, resolveSourceResourceManagementInfo, resolveSourceWellKnownSymbolInfo, resolveSourceYieldInfo, } from "./source-control-flow-evidence.js";
export function createTypeCheckerQueries(program, defaultOptions) {
    if (program === undefined || defaultOptions.sourceFile === undefined) {
        throw new Error("Type-checker queries require one source file from the compiler program.");
    }
    const callInfos = new WeakMap();
    const propertyAccessInfos = new WeakMap();
    const elementAccessInfos = new WeakMap();
    const iterationInfos = new WeakMap();
    const objectLiteralElementInfos = new WeakMap();
    const storageInfos = new WeakMap();
    const generatorInfos = new WeakMap();
    const yieldInfos = new WeakMap();
    const wellKnownSymbolInfos = new WeakMap();
    const resourceManagementInfos = new WeakMap();
    const queries = {
        getTypeAtLocation: (node) => withCheckerForNode(program, node, defaultOptions, (checker) => Checker_GetTypeAtLocation(checker, node)),
        getTypeFromTypeNode: (node) => withCheckerForNode(program, node, defaultOptions, (checker) => Checker_GetTypeFromTypeNode(checker, node)),
        getContextualType: (node, contextFlags = ContextFlagsNone) => withCheckerForNode(program, node, defaultOptions, (checker) => Checker_getContextualType(checker, node, contextFlags)),
        getSymbolAtLocation: (node) => withCheckerForNode(program, node, defaultOptions, (checker) => Checker_GetSymbolAtLocation(checker, node)),
        getLexicallyResolvedSymbol: (identifier) => withCheckerForNode(program, identifier, defaultOptions, (checker) => IsIdentifier(identifier)
            ? Checker_ResolveName(checker, Node_Text(identifier), identifier, (SymbolFlagsValue | SymbolFlagsType | SymbolFlagsNamespace | SymbolFlagsAlias), false)
            : undefined),
        getResolvedSymbol: (node) => withCheckerForNode(program, node, defaultOptions, (checker) => getDiagnosticFreeResolvedSymbol(checker, node)),
        getResolvedSymbolOrNil: (node) => withCheckerForNode(program, node, defaultOptions, (checker) => Checker_getResolvedSymbolOrNil(checker, node)),
        getAliasedSymbol: (symbol) => withCheckerForSymbol(program, symbol, defaultOptions, (checker) => Checker_GetAliasedSymbol(checker, symbol)),
        getTypeOfSymbol: (symbol) => withCheckerForSymbol(program, symbol, defaultOptions, (checker) => Checker_getTypeOfSymbol(checker, symbol)),
        getWriteTypeOfSymbol: (symbol) => withCheckerForSymbol(program, symbol, defaultOptions, (checker) => Checker_getWriteTypeOfSymbol(checker, symbol)),
        getDeclaredTypeOfSymbol: (symbol) => withCheckerForSymbol(program, symbol, defaultOptions, (checker) => Checker_getDeclaredTypeOfSymbol(checker, symbol)),
        getResolvedSignature: (node) => withCheckerForNode(program, node, defaultOptions, (checker) => Checker_getResolvedSignature(checker, node, undefined, CheckModeNormal)),
        getResolvedCallInfo: (node) => memoizeResolvedNodeQuery(callInfos, node, () => withCheckerForNode(program, node, defaultOptions, (checker) => {
            if (!IsCallOrNewExpression(node)) {
                return undefined;
            }
            Checker_getResolvedSignature(checker, node, undefined, CheckModeNormal);
            const sourceResultType = Checker_GetTypeAtLocation(checker, node);
            return Checker_finalizeResolvedCallEvidence(checker, node, sourceResultType);
        })),
        getResolvedPropertyAccessInfo: (node) => memoizeResolvedNodeQuery(propertyAccessInfos, node, () => withCheckerForNode(program, node, defaultOptions, (checker) => withResolvedSourceReceiverValueEvidence(checker, Checker_getResolvedSourcePropertyAccessInfo(checker, node)))),
        getResolvedElementAccessInfo: (node) => memoizeResolvedNodeQuery(elementAccessInfos, node, () => withCheckerForNode(program, node, defaultOptions, (checker) => withResolvedSourceReceiverValueEvidence(checker, Checker_getResolvedSourceElementAccessInfo(checker, node)))),
        getResolvedIterationInfo: (node) => memoizeResolvedNodeQuery(iterationInfos, node, () => withCheckerForNode(program, node, defaultOptions, (checker) => Checker_getResolvedSourceIterationInfo(checker, node))),
        getResolvedObjectLiteralElementInfo: (node) => memoizeResolvedNodeQuery(objectLiteralElementInfos, node, () => withCheckerForNode(program, node, defaultOptions, (checker) => getResolvedSourceObjectLiteralElementInfo(checker, node))),
        getResolvedStorageInfo: (node) => memoizeResolvedNodeQuery(storageInfos, node, () => withCheckerForNode(program, node, defaultOptions, (checker) => getResolvedSourceStorageInfo(checker, node))),
        getResolvedGeneratorInfo: (node) => memoizeResolvedNodeQuery(generatorInfos, node, () => withCheckerForNode(program, node, defaultOptions, (checker) => resolveSourceGeneratorInfo(checker, node))),
        getResolvedYieldInfo: (node) => memoizeResolvedNodeQuery(yieldInfos, node, () => withCheckerForNode(program, node, defaultOptions, (checker) => {
            const declaration = GetContainingFunction(node);
            const generator = memoizeResolvedNodeQuery(generatorInfos, declaration, () => resolveSourceGeneratorInfo(checker, declaration));
            return resolveSourceYieldInfo(checker, node, generator);
        })),
        getResolvedWellKnownSymbolInfo: (node) => memoizeResolvedNodeQuery(wellKnownSymbolInfos, node, () => withCheckerForNode(program, node, defaultOptions, (checker) => resolveSourceWellKnownSymbolInfo(checker, node))),
        getResolvedResourceManagementInfo: (node) => memoizeResolvedNodeQuery(resourceManagementInfos, node, () => withCheckerForNode(program, node, defaultOptions, (checker) => resolveSourceResourceManagementInfo(checker, node))),
        getReturnTypeOfSignature: (signature) => withCheckerForSignature(program, signature, defaultOptions, (checker) => Checker_GetReturnTypeOfSignature(checker, signature)),
        getCallSignaturesOfType: (type) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_GetSignaturesOfType(checker, type, SignatureKindCall)) ?? [],
        getConstructSignaturesOfType: (type) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_GetSignaturesOfType(checker, type, SignatureKindConstruct)) ?? [],
        getPropertyOfType: (type, name) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_GetPropertyOfType(checker, type, name)),
        getTypeOfPropertyOfType: (type, name) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_GetTypeOfPropertyOfType(checker, type, name)),
        getConstantValue: (node) => withCheckerForNode(program, node, defaultOptions, (checker) => Checker_GetConstantValue(checker, node)),
        typeToString: (type) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_TypeToString(checker, type)) ?? "",
        getModuleSymbolFromSpecifier: (moduleSpecifier) => withCheckerForNode(program, moduleSpecifier, defaultOptions, (checker) => Checker_resolveExternalModuleName(checker, moduleSpecifier, moduleSpecifier, true)),
        getResolvedExternalModuleSymbol: (moduleSymbol, dontResolveAlias = false) => withCheckerForSymbol(program, moduleSymbol, defaultOptions, (checker) => Checker_resolveExternalModuleSymbol(checker, moduleSymbol, dontResolveAlias)),
        getExportsOfModule: (moduleSymbol) => withCheckerForSymbol(program, moduleSymbol, defaultOptions, (checker) => Checker_GetExportsOfModule(checker, moduleSymbol)) ?? [],
        getSymbolName: (symbol) => symbol?.Name ?? "",
        getSymbolDeclarations: (symbol) => symbol?.Declarations ?? [],
        getSymbolValueDeclaration: (symbol) => symbol?.ValueDeclaration,
        getPrimarySymbolDeclaration: (symbol) => getPrimarySymbolDeclaration(symbol),
        getSymbolSourceFile: (symbol) => getSymbolSourceFile(symbol),
        getTypeSymbol: (type) => type?.symbol,
        getTypeAliasSymbol: (type) => type?.alias?.symbol,
        getSignatureDeclaration: (signature) => signature?.declaration,
        getSignatureParameters: (signature) => signature?.parameters ?? [],
        getSignatureThisParameter: (signature) => signature?.thisParameter,
    };
    return Object.freeze(queries);
}
function getResolvedSourceObjectLiteralElementInfo(checker, element) {
    const elementKind = resolvedSourceObjectLiteralElementKind(element);
    const objectLiteral = element?.Parent;
    if (checker === undefined || element === undefined || elementKind === undefined ||
        objectLiteral === undefined ||
        !IsObjectLiteralExpression(objectLiteral)) {
        return undefined;
    }
    const objectLiteralType = Checker_GetTypeAtLocation(checker, objectLiteral);
    const sourceElementType = Checker_GetTypeAtLocation(checker, element);
    const contextualType = Checker_getApparentTypeOfContextualType(checker, objectLiteral, ContextFlagsNone);
    const sourceElementSymbol = Checker_getSymbolOfDeclaration(checker, element);
    if (objectLiteralType === undefined || sourceElementType === undefined ||
        sourceElementSymbol === undefined) {
        return undefined;
    }
    const selectedOwnerType = contextualType ?? objectLiteralType;
    const sourceSelectedSymbol = Checker_GetPropertyOfType(checker, selectedOwnerType, sourceElementSymbol.Name);
    const sourceSelectedType = contextualType === undefined
        ? sourceSelectedSymbol === undefined
            ? sourceElementType
            : Checker_getTypeOfSymbol(checker, sourceSelectedSymbol)
        : Checker_getContextualTypeForObjectLiteralElement(checker, element, ContextFlagsNone);
    if (sourceSelectedType === undefined) {
        return undefined;
    }
    const rawSourceSelectedDeclarations = sourceSelectedSymbol?.Declarations ?? [];
    if (rawSourceSelectedDeclarations.some((declaration) => declaration === undefined)) {
        return undefined;
    }
    const sourceSelectedDeclarations = Object.freeze([
        ...rawSourceSelectedDeclarations,
    ]);
    return Object.freeze({
        objectLiteral,
        element,
        elementKind,
        objectLiteralType,
        ...(contextualType === undefined ? {} : { contextualType }),
        sourceElementSymbol,
        sourceElementType,
        ...(sourceSelectedSymbol === undefined ? {} : { sourceSelectedSymbol }),
        ...(() => {
            const sourceSelectedDeclaration = getPrimarySymbolDeclaration(sourceSelectedSymbol);
            return sourceSelectedDeclaration === undefined ? {} : { sourceSelectedDeclaration };
        })(),
        sourceSelectedDeclarations,
        sourceSelectedType,
    });
}
function resolvedSourceObjectLiteralElementKind(element) {
    if (IsPropertyAssignment(element)) {
        return "property";
    }
    if (IsShorthandPropertyAssignment(element)) {
        return "shorthand";
    }
    if (IsObjectLiteralMethod(element)) {
        return "method";
    }
    if (IsGetAccessorDeclaration(element)) {
        return "get";
    }
    if (IsSetAccessorDeclaration(element)) {
        return "set";
    }
    return undefined;
}
function getResolvedSourceStorageInfo(checker, expression) {
    if (checker === undefined || expression === undefined) {
        return undefined;
    }
    const storageExpression = SkipOuterExpressions(expression, (OEKAssertions | OEKParentheses));
    if (storageExpression === undefined
        || (storageExpression.Flags & NodeFlagsOptionalChain) !== 0) {
        return undefined;
    }
    if (IsIdentifier(storageExpression)) {
        const symbol = getDiagnosticFreeResolvedSymbol(checker, storageExpression);
        const type = Checker_GetTypeAtLocation(checker, storageExpression);
        if (symbol === undefined || type === undefined) {
            return undefined;
        }
        const declaration = getPrimarySymbolDeclaration(symbol);
        return Object.freeze({
            expression,
            storageExpression,
            type,
            symbol,
            ...(declaration === undefined ? {} : { declaration }),
            writable: !Checker_isAssignmentToReadonlyEntity(checker, storageExpression, symbol, AssignmentKindDefinite),
        });
    }
    if (IsPropertyAccessExpression(storageExpression)) {
        const selected = Checker_getResolvedSourcePropertyAccessInfo(checker, storageExpression);
        const type = selectedAccessType(selected);
        if (selected === undefined || type === undefined) {
            return undefined;
        }
        return Object.freeze({
            expression,
            storageExpression,
            type,
            ...(selected.selectedSymbol === undefined
                ? {}
                : { symbol: selected.selectedSymbol }),
            ...(selected.selectedDeclaration === undefined
                ? {}
                : { declaration: selected.selectedDeclaration }),
            writable: selected.writable,
        });
    }
    if (IsElementAccessExpression(storageExpression)) {
        const selected = Checker_getResolvedSourceElementAccessInfo(checker, storageExpression);
        const type = selectedAccessType(selected);
        if (selected === undefined || type === undefined) {
            return undefined;
        }
        return Object.freeze({
            expression,
            storageExpression,
            type,
            ...(selected.selectedSymbol === undefined
                ? {}
                : { symbol: selected.selectedSymbol }),
            ...(selected.selectedDeclaration === undefined
                ? {}
                : { declaration: selected.selectedDeclaration }),
            writable: selected.writable,
        });
    }
    return undefined;
}
function selectedAccessType(selected) {
    if (selected === undefined) {
        return undefined;
    }
    switch (selected.accessMode) {
        case "read":
        case "delete":
            return selected.sourceReadType;
        case "write":
            return selected.sourceWriteType;
        case "read-write":
            return selected.sourceReadType;
    }
}
function memoizeResolvedNodeQuery(cache, node, query) {
    if (node === undefined) {
        return undefined;
    }
    const cached = cache.get(node);
    if (cached !== undefined) {
        return cached;
    }
    const resolved = query();
    if (resolved !== undefined) {
        cache.set(node, resolved);
    }
    return resolved;
}
function getDiagnosticFreeResolvedSymbol(checker, node) {
    const resolved = Checker_getResolvedSymbolOrNil(checker, node);
    return resolved !== undefined && resolved !== checker?.unknownSymbol
        ? resolved
        : undefined;
}
function withResolvedSourceReceiverValueEvidence(checker, selected) {
    if (checker === undefined || selected === undefined) {
        return undefined;
    }
    const sourceSymbol = getDiagnosticFreeResolvedSymbol(checker, selected.receiver.expression);
    const valueSymbol = sourceSymbol !== undefined &&
        (sourceSymbol.Flags & SymbolFlagsAlias) !== 0
        ? Checker_GetAliasedSymbol(checker, sourceSymbol)
        : sourceSymbol;
    if (valueSymbol === undefined || valueSymbol === checker.unknownSymbol) {
        return selected;
    }
    return Object.freeze({
        ...selected,
        receiver: Object.freeze({
            ...selected.receiver,
            valueSymbol,
            ...(valueSymbol.ValueDeclaration === undefined
                ? {}
                : { valueDeclaration: valueSymbol.ValueDeclaration }),
        }),
    });
}
function withCheckerForNode(program, node, defaultOptions, callback) {
    if (node === undefined) {
        return undefined;
    }
    return withChecker(program, defaultOptions.sourceFile, defaultOptions, callback);
}
function withCheckerForSymbol(program, symbol, defaultOptions, callback) {
    if (symbol === undefined) {
        return undefined;
    }
    return withChecker(program, defaultOptions.sourceFile, defaultOptions, callback);
}
function withCheckerForType(program, type, defaultOptions, callback) {
    if (type === undefined) {
        return undefined;
    }
    if (type.checker !== undefined) {
        return callback(type.checker);
    }
    return withChecker(program, defaultOptions.sourceFile, defaultOptions, callback);
}
function withCheckerForSignature(program, signature, defaultOptions, callback) {
    if (signature === undefined) {
        return undefined;
    }
    return withChecker(program, defaultOptions.sourceFile, defaultOptions, callback);
}
function withChecker(program, sourceFile, defaultOptions, callback) {
    if (program === undefined || sourceFile === undefined) {
        return undefined;
    }
    const context = defaultOptions.context ?? Background();
    const [checker, done] = Program_GetTypeCheckerForFile(program, context, sourceFile);
    try {
        return callback(checker);
    }
    finally {
        done();
    }
}
function getSymbolSourceFile(symbol) {
    const declaration = getPrimarySymbolDeclaration(symbol);
    return GetSourceFileOfNode(declaration);
}
function getPrimarySymbolDeclaration(symbol) {
    return symbol?.ValueDeclaration ?? symbol?.Declarations?.find((candidate) => candidate !== undefined);
}
//# sourceMappingURL=type-checker.js.map