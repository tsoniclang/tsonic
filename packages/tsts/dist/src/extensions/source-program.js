import { Program_GetDefaultResolutionModeForFile, Program_GetSourceFileForResolvedModule, Program_GetSourceFile, Program_GetSourceFiles, Program_ResolveModuleName, } from "../internal/compiler/program.js";
import { ResolvedModule_IsResolved } from "../internal/module/types.js";
import { createAstReader } from "../services/ast-reader.js";
import { createTypeCheckerQueries } from "../services/type-checker.js";
import { createTypeShapeQueries } from "../services/type-shape.js";
import { assertSemanticProgramActive, assertSemanticSourceFileOwned } from "../services/semantic-query-ownership.js";
import { extensionHostResolveElaborationReference, getExtensionHost } from "./host.js";
export function createSourceProgramQueries(program, options = {}) {
    if (program === undefined) {
        throw new Error("Source program queries require a compiler program.");
    }
    const ast = options.ast ?? createAstReader();
    const sourceFileQueries = new WeakMap();
    const moduleSourceFiles = new WeakMap();
    const included = (sourceFile) => options.includeSourceFile?.(sourceFile) !== false;
    const getSourceFiles = () => {
        assertSemanticProgramActive(program);
        return (Program_GetSourceFiles(program) ?? []).filter((sourceFile) => sourceFile !== undefined && included(sourceFile));
    };
    const getSourceFile = (fileName) => {
        assertSemanticProgramActive(program);
        const sourceFile = Program_GetSourceFile(program, fileName);
        return sourceFile !== undefined && included(sourceFile)
            ? sourceFile
            : undefined;
    };
    const getSourceFileQueries = (sourceFile) => {
        assertSemanticProgramActive(program);
        if (sourceFile === undefined || !included(sourceFile)) {
            throw new Error("Source-file queries require an included source file from the checked program.");
        }
        assertSemanticSourceFileOwned(program, sourceFile);
        const existing = sourceFileQueries.get(sourceFile);
        if (existing !== undefined) {
            return existing;
        }
        const sourceChecker = createTypeCheckerQueries(program, {
            ...(options.context === undefined ? {} : { context: options.context }),
            sourceFile,
        });
        const sourceTypeShape = createTypeShapeQueries(program, {
            ...(options.context === undefined ? {} : { context: options.context }),
            sourceFile,
        });
        const created = Object.freeze({
            sourceFile,
            ast,
            checker: sourceChecker,
            typeShape: sourceTypeShape,
        });
        sourceFileQueries.set(sourceFile, created);
        return created;
    };
    const resolveModuleSourceFile = (moduleSpecifier) => {
        assertSemanticProgramActive(program);
        if (moduleSpecifier === undefined) {
            return undefined;
        }
        const kind = ast.kindName(moduleSpecifier);
        const containingSourceFile = ast.getSourceFile(moduleSpecifier);
        if ((kind !== "KindStringLiteral" && kind !== "KindNoSubstitutionTemplateLiteral") ||
            containingSourceFile === undefined || !included(containingSourceFile)) {
            return undefined;
        }
        assertSemanticSourceFileOwned(program, containingSourceFile);
        const cached = moduleSourceFiles.get(moduleSpecifier);
        if (cached !== undefined) {
            return cached ?? undefined;
        }
        const resolutionMode = Program_GetDefaultResolutionModeForFile(program, containingSourceFile);
        const resolved = Program_ResolveModuleName(program, ast.text(moduleSpecifier), ast.getFileName(containingSourceFile), resolutionMode);
        const sourceFile = ResolvedModule_IsResolved(resolved)
            ? Program_GetSourceFileForResolvedModule(program, resolved.ResolvedFileName)
            : undefined;
        const selected = sourceFile !== undefined && included(sourceFile)
            ? sourceFile
            : undefined;
        moduleSourceFiles.set(moduleSpecifier, selected ?? null);
        return selected;
    };
    return Object.freeze({
        ast,
        getSourceFiles,
        getSourceFile,
        getSourceFileQueries,
        resolveModuleSourceFile,
        resolveElaborationReference(reference) {
            assertSemanticProgramActive(program);
            const host = getExtensionHost(program);
            if (host === undefined) {
                throw new Error("Source reference resolution requires an owning elaboration session.");
            }
            const node = host[extensionHostResolveElaborationReference](reference);
            const file = ast.getSourceFile(node);
            if (file === undefined || !included(file)) {
                throw new Error("Source reference resolution requires an included source file.");
            }
            assertSemanticSourceFileOwned(program, file);
            return node;
        },
    });
}
//# sourceMappingURL=source-program.js.map