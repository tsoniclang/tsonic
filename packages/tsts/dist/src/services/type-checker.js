import { Background } from "../go/context.js";
import { GetSourceFileOfNode } from "../internal/ast/utilities.js";
import { Program_GetSourceFiles, Program_GetTypeCheckerForFile } from "../internal/compiler/program.js";
import { Checker_GetPropertyOfType, Checker_GetReturnTypeOfSignature, Checker_GetSignaturesOfType, Checker_GetTypeFromTypeNode, Checker_GetTypeOfPropertyOfType, } from "../internal/checker/exports.js";
import { Checker_getResolvedSignature } from "../internal/checker/checker/signatures.js";
import { CheckModeNormal } from "../internal/checker/checker/state.js";
import { Checker_GetAliasedSymbol, Checker_GetSymbolAtLocation, Checker_getDeclaredTypeOfSymbol, Checker_getResolvedSymbol, Checker_getResolvedSymbolOrNil, Checker_getTypeOfSymbol, Checker_resolveExternalModuleName, Checker_resolveExternalModuleSymbol, } from "../internal/checker/checker/symbols.js";
import { Checker_getContextualType, Checker_GetTypeAtLocation } from "../internal/checker/checker/types.js";
import { Checker_GetConstantValue, Checker_GetExportsOfModule } from "../internal/checker/services.js";
import { Checker_TypeToString } from "../internal/checker/printer.js";
import { ContextFlagsNone } from "../internal/checker/types.js";
export function createTypeCheckerQueries(program, defaultOptions = {}) {
    return {
        getTypeAtLocation: (node, options = {}) => withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_GetTypeAtLocation(checker, node)),
        getTypeFromTypeNode: (node, options = {}) => withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_GetTypeFromTypeNode(checker, node)),
        getContextualType: (node, contextFlags = ContextFlagsNone, options = {}) => withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_getContextualType(checker, node, contextFlags)),
        getSymbolAtLocation: (node, options = {}) => withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_GetSymbolAtLocation(checker, node)),
        getResolvedSymbol: (node, options = {}) => withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_getResolvedSymbol(checker, node)),
        getResolvedSymbolOrNil: (node, options = {}) => withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_getResolvedSymbolOrNil(checker, node)),
        getAliasedSymbol: (symbol, options = {}) => withCheckerForSymbol(program, symbol, defaultOptions, options, (checker) => Checker_GetAliasedSymbol(checker, symbol)),
        getTypeOfSymbol: (symbol, options = {}) => withCheckerForSymbol(program, symbol, defaultOptions, options, (checker) => Checker_getTypeOfSymbol(checker, symbol)),
        getDeclaredTypeOfSymbol: (symbol, options = {}) => withCheckerForSymbol(program, symbol, defaultOptions, options, (checker) => Checker_getDeclaredTypeOfSymbol(checker, symbol)),
        getResolvedSignature: (node, options = {}) => withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_getResolvedSignature(checker, node, undefined, CheckModeNormal)),
        getReturnTypeOfSignature: (signature, options = {}) => withCheckerForSubject(program, signature, defaultOptions, options, (checker) => Checker_GetReturnTypeOfSignature(checker, signature)),
        getSignaturesOfType: (type, kind, options = {}) => withCheckerForSubject(program, type, defaultOptions, options, (checker) => Checker_GetSignaturesOfType(checker, type, kind)) ?? [],
        getPropertyOfType: (type, name, options = {}) => withCheckerForSubject(program, type, defaultOptions, options, (checker) => Checker_GetPropertyOfType(checker, type, name)),
        getTypeOfPropertyOfType: (type, name, options = {}) => withCheckerForSubject(program, type, defaultOptions, options, (checker) => Checker_GetTypeOfPropertyOfType(checker, type, name)),
        getConstantValue: (node, options = {}) => withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_GetConstantValue(checker, node)),
        typeToString: (type, options = {}) => withCheckerForSubject(program, type, defaultOptions, options, (checker) => Checker_TypeToString(checker, type)) ?? "",
        getModuleSymbolFromSpecifier: (moduleSpecifier, options = {}) => withCheckerForNode(program, moduleSpecifier, defaultOptions, options, (checker) => Checker_resolveExternalModuleName(checker, moduleSpecifier, moduleSpecifier, true)),
        getResolvedExternalModuleSymbol: (moduleSymbol, dontResolveAlias = false, options = {}) => withCheckerForSymbol(program, moduleSymbol, defaultOptions, options, (checker) => Checker_resolveExternalModuleSymbol(checker, moduleSymbol, dontResolveAlias)),
        getExportsOfModule: (moduleSymbol, options = {}) => withCheckerForSymbol(program, moduleSymbol, defaultOptions, options, (checker) => Checker_GetExportsOfModule(checker, moduleSymbol)) ?? [],
    };
}
function withCheckerForNode(program, node, defaultOptions, options, callback) {
    if (node === undefined) {
        return undefined;
    }
    return withChecker(program, options.sourceFile ?? defaultOptions.sourceFile ?? GetSourceFileOfNode(node), defaultOptions, options, callback);
}
function withCheckerForSymbol(program, symbol, defaultOptions, options, callback) {
    if (symbol === undefined) {
        return undefined;
    }
    return withChecker(program, options.sourceFile ?? defaultOptions.sourceFile ?? getSymbolSourceFile(symbol), defaultOptions, options, callback);
}
function withCheckerForSubject(program, subject, defaultOptions, options, callback) {
    if (subject === undefined) {
        return undefined;
    }
    const sourceFile = options.sourceFile ?? defaultOptions.sourceFile ?? (isNode(subject) ? GetSourceFileOfNode(subject) : undefined) ?? Program_GetSourceFiles(program)?.[0];
    return withChecker(program, sourceFile, defaultOptions, options, callback);
}
function withChecker(program, sourceFile, defaultOptions, options, callback) {
    if (program === undefined || sourceFile === undefined) {
        return undefined;
    }
    const [checker, done] = Program_GetTypeCheckerForFile(program, options.context ?? defaultOptions.context ?? Background(), sourceFile);
    try {
        return callback(checker);
    }
    finally {
        done();
    }
}
function getSymbolSourceFile(symbol) {
    const declaration = symbol?.ValueDeclaration ?? symbol?.Declarations?.find((candidate) => candidate !== undefined);
    return GetSourceFileOfNode(declaration);
}
function isNode(subject) {
    return subject !== undefined && "Kind" in subject && "Loc" in subject;
}
//# sourceMappingURL=type-checker.js.map