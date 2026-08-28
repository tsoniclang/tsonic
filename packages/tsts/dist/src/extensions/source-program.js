import { Program_GetDefaultResolutionModeForFile, Program_GetSourceFileForResolvedModule, Program_GetSourceFile, Program_GetSourceFiles, Program_ResolveModuleName, } from "../internal/compiler/program.js";
import { ResolvedModule_IsResolved } from "../internal/module/types.js";
import { createAstReader } from "../services/ast-reader.js";
import { createTypeCheckerQueries } from "../services/type-checker.js";
import { createTypeShapeQueries } from "../services/type-shape.js";
export function createSourceProgramQueries(program, options = {}) {
    if (program === undefined) {
        throw new Error("Source program queries require a compiler program.");
    }
    const ast = options.ast ?? createAstReader();
    const sourceFileQueries = new WeakMap();
    const moduleSourceFiles = new WeakMap();
    const included = (sourceFile) => options.includeSourceFile?.(sourceFile) !== false;
    const getSourceFiles = () => (Program_GetSourceFiles(program) ?? []).filter((sourceFile) => sourceFile !== undefined && included(sourceFile));
    const getSourceFile = (fileName) => {
        const sourceFile = Program_GetSourceFile(program, fileName);
        return sourceFile !== undefined && included(sourceFile)
            ? sourceFile
            : undefined;
    };
    const getSourceFileQueries = (sourceFile) => {
        if (sourceFile === undefined || !included(sourceFile)) {
            throw new Error("Source-file queries require an included source file from the checked program.");
        }
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
        if (moduleSpecifier === undefined) {
            return undefined;
        }
        const kind = ast.kindName(moduleSpecifier);
        const containingSourceFile = ast.getSourceFile(moduleSpecifier);
        if ((kind !== "KindStringLiteral" && kind !== "KindNoSubstitutionTemplateLiteral") ||
            containingSourceFile === undefined || !included(containingSourceFile)) {
            return undefined;
        }
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
    });
}
//# sourceMappingURL=source-program.js.map