import { createSourceMemberDispatchNavigation } from "./member-dispatch.js";
import { createSourceMemberImplementationNavigation } from "./member-implementation.js";
import { createSourceMemberContractNavigation } from "./member-contracts.js";
import { createSourceCallableImplementationNavigation } from "./callable-implementation.js";
import { sourceFileIdentity } from "./identity.js";
import { createSourceNodeInventory } from "./node-inventory.js";
import { createSourceHeritageNavigation } from "./heritage.js";
import { createSourceClassConstructorNavigation } from "./constructors.js";
import { sourceFileHasTopLevelAwait, sourceProjectModuleExports, sourceProjectModuleDependencies, sourceProjectModuleReferences, sourceProjectModuleSpecifierResolution, } from "./modules.js";
import { createSourceReferenceNavigation } from "./references.js";
import { sourceBindingWritesWithin, sourceEntityHasReferenceOutside, sourceEntityReferencesWithin } from "./references-usage.js";
import { sourceExpressionResultDisposition } from "./expression-use.js";
import { sourceDeclarationUses } from "./declaration-uses.js";
import { sourceDeclarationUseSummary, sourceParameterUseSummary } from "./declaration-use-summary.js";
import { sourceCountedLoop } from "./counted-loops.js";
import { sourceExpressionValueFlow } from "./value-flow.js";
/**
 * The program navigation. Its only checker input is `input` (host-input/navigation.ts, I3): every algorithm here
 * reads authored syntax and the Node-keyed host-input records; no checker Type, Signature or Symbol.
 */
export function createSourceProgramNavigation(input) {
    const source = input;
    const sourceFiles = sourceProjectFiles(input);
    const nodeInventory = createSourceNodeInventory(source, sourceFiles);
    const sourceFileSet = new Set(sourceFiles.map((sourceFile) => sourceFileIdentity(source.ast, sourceFile)));
    // The program's other files (declaration files, provider modules): indexed at their ambient value positions only.
    const ambientFiles = Object.freeze(source.sourceFiles.filter((sourceFile) => sourceFile !== undefined && !sourceFiles.includes(sourceFile)));
    const references = createSourceReferenceNavigation(source, sourceFiles, ambientFiles);
    const dispatch = createSourceMemberDispatchNavigation(source, sourceFiles, references.referenceFor, references.isProjectDeclaration);
    const heritage = createSourceHeritageNavigation(source, references.isProjectDeclaration);
    const memberImplementations = createSourceMemberImplementationNavigation(source, references.referenceFor, references.isProjectDeclaration, heritage.declaredHeritagePath);
    const memberContracts = createSourceMemberContractNavigation(source.ast, references.isProjectDeclaration, heritage.declaredHeritage, memberImplementations.memberImplementation);
    const callableImplementations = createSourceCallableImplementationNavigation(source, references.isProjectDeclaration);
    const classConstructors = createSourceClassConstructorNavigation(source, references.isProjectDeclaration);
    const moduleDependencyCache = new Map();
    const moduleReferenceCache = new Map();
    const topLevelAwaitCache = new Map();
    const moduleExportCache = new Map();
    const declarationUsesCache = new WeakMap();
    const declarationUseSummaryCache = new WeakMap();
    const expressionValueFlowCache = new WeakMap();
    const expressionResultDispositions = new WeakMap();
    const expressionResultDisposition = (expression) => {
        const cached = expressionResultDispositions.get(expression);
        if (cached !== undefined)
            return cached;
        const selected = sourceExpressionResultDisposition(source.ast, expression);
        expressionResultDispositions.set(expression, selected);
        return selected;
    };
    const declarationUses = (declaration) => {
        const cached = declarationUsesCache.get(declaration);
        if (cached !== undefined) {
            return cached;
        }
        const uses = sourceDeclarationUses(source.ast, declaration, references.referencesToDeclaration(declaration));
        declarationUsesCache.set(declaration, uses);
        return uses;
    };
    const declarationUseSummary = (declaration) => {
        const cached = declarationUseSummaryCache.get(declaration);
        if (cached !== undefined) {
            return cached;
        }
        const summary = sourceDeclarationUseSummary(source.ast, declaration, declarationUses(declaration));
        declarationUseSummaryCache.set(declaration, summary);
        return summary;
    };
    const moduleDependencies = (sourceFile) => {
        const sourceFileKey = sourceFileIdentity(source.ast, sourceFile);
        if (sourceFileKey === undefined) {
            return Object.freeze([]);
        }
        const cached = moduleDependencyCache.get(sourceFileKey);
        if (cached !== undefined) {
            return cached;
        }
        const dependencies = sourceProjectModuleDependencies(source, sourceFileSet, sourceFile);
        moduleDependencyCache.set(sourceFileKey, dependencies);
        return dependencies;
    };
    const moduleHasTopLevelAwait = (sourceFile) => {
        const sourceFileKey = sourceFileIdentity(source.ast, sourceFile);
        if (sourceFileKey === undefined) {
            return false;
        }
        const cached = topLevelAwaitCache.get(sourceFileKey);
        if (cached !== undefined) {
            return cached;
        }
        const result = sourceFileHasTopLevelAwait(source.ast, sourceFile);
        topLevelAwaitCache.set(sourceFileKey, result);
        return result;
    };
    const moduleReferences = (sourceFile) => {
        const sourceFileKey = sourceFileIdentity(source.ast, sourceFile);
        if (sourceFileKey === undefined) {
            return Object.freeze([]);
        }
        const cached = moduleReferenceCache.get(sourceFileKey);
        if (cached !== undefined) {
            return cached;
        }
        const references = sourceProjectModuleReferences(source, sourceFileSet, sourceFile);
        moduleReferenceCache.set(sourceFileKey, references);
        return references;
    };
    const moduleSpecifierResolution = (moduleSpecifier) => sourceProjectModuleSpecifierResolution(source, sourceFileSet, moduleSpecifier);
    const moduleExports = (sourceFile) => {
        const sourceFileKey = sourceFileIdentity(source.ast, sourceFile);
        if (sourceFileKey === undefined) {
            return Object.freeze([]);
        }
        const cached = moduleExportCache.get(sourceFileKey);
        if (cached !== undefined) {
            return cached;
        }
        const exports = sourceProjectModuleExports(source, sourceFile);
        moduleExportCache.set(sourceFileKey, exports);
        return exports;
    };
    return Object.freeze({
        sourceFiles,
        nodes: nodeInventory.nodes,
        nodesForFiles: nodeInventory.nodesForFiles,
        referenceIndexStatistics: references.referenceIndexStatistics,
        sourceReferenceFor: references.sourceReferenceFor,
        referenceFor: references.referenceFor,
        declarationFor: references.declarationFor,
        moduleDependencies,
        moduleReferences,
        moduleSpecifierResolution,
        moduleExports,
        moduleHasTopLevelAwait,
        memberDispatch: dispatch.memberDispatch,
        memberImplementation: memberImplementations.memberImplementation,
        memberContracts: memberContracts.memberContracts,
        callableImplementation: callableImplementations.callableImplementation,
        classConstructors,
        declaredHeritage: heritage.declaredHeritage,
        declaredHeritagePath: heritage.declaredHeritagePath,
        mergedDeclarations: (declaration) => input.mergedDeclarations(declaration),
        bindingWritesWithin(declaration, root) {
            return sourceBindingWritesWithin(source.ast, declaration, root, references.referencesToEntity);
        },
        referencesWithin(declaration, root) {
            return sourceEntityReferencesWithin(source.ast, declaration, root, references.referencesToEntity);
        },
        referencesToDeclaration: references.referencesToDeclaration,
        declarationUses,
        declarationUseSummary,
        parameterUseSummary(parameter) {
            return sourceParameterUseSummary(source.ast, parameter, declarationUses(parameter));
        },
        countedLoop(statement) {
            return sourceCountedLoop(source.ast, statement, references.sourceReferenceFor, (declaration, root) => sourceBindingWritesWithin(source.ast, declaration, root, references.referencesToEntity));
        },
        expressionValueFlow(expression) {
            const cached = expressionValueFlowCache.get(expression);
            if (cached !== undefined) {
                return cached;
            }
            const summary = sourceExpressionValueFlow(source.ast, expression, references.sourceReferenceFor, declarationUses, declarationUseSummary);
            expressionValueFlowCache.set(expression, summary);
            return summary;
        },
        expressionResultDisposition,
        expressionResultUse: (expression) => expressionResultDisposition(expression).kind === "discarded" ? "discarded" : "consumed",
        hasReferenceOutside(declaration, excludedNode) {
            return sourceEntityHasReferenceOutside(source.ast, declaration, excludedNode, references.referencesToEntity);
        },
        isProjectDeclaration: references.isProjectDeclaration,
        call: (use) => input.call(use),
        memberAccess: (access) => input.memberAccess(access),
        declaredParameters: (declaration) => input.declaredParameters(declaration),
    });
}
export function sourceProjectFiles(source) {
    return Object.freeze(source.sourceFiles.filter((sourceFile) => sourceFile !== undefined &&
        !sourceFile.IsDeclarationFile &&
        !source.ast.getFileName(sourceFile).startsWith("tsts-provider://")));
}
//# sourceMappingURL=navigation.js.map