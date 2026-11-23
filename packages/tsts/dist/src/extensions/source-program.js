import { Node_ModuleSpecifier } from "../internal/ast/ast.js";
import { Program_GetDefaultResolutionModeForFile, Program_GetResolvedModuleFromModuleSpecifier, Program_GetSourceFileForResolvedModule, Program_GetSourceFile, Program_GetSourceFiles, Program_ResolveModuleName, } from "../internal/compiler/program.js";
import { ResolvedModule_IsResolved } from "../internal/module/types.js";
import { createAstReader } from "../services/ast-reader.js";
import { createTypeCheckerQueries } from "../services/type-checker.js";
import { createTypeShapeQueries } from "../services/type-shape.js";
export function createSourceProgramQueries(program, options = {}) {
    if (program === undefined) {
        throw new Error("Source program queries require a compiler program.");
    }
    const ast = options.ast ?? createAstReader();
    const programSourceFiles = Object.freeze((Program_GetSourceFiles(program) ?? [])
        .filter((sourceFile) => sourceFile !== undefined));
    const sourceFileQueries = new WeakMap();
    const moduleSourceFiles = new WeakMap();
    const included = (sourceFile) => options.includeSourceFile?.(sourceFile) !== false;
    const containsSourceFile = (sourceFile) => sourceFile !== undefined && Program_GetSourceFile(program, ast.getFileName(sourceFile)) === sourceFile;
    const getSourceFiles = () => programSourceFiles.filter(included);
    const getSourceFile = (fileName) => {
        const sourceFile = Program_GetSourceFile(program, fileName);
        return sourceFile !== undefined && included(sourceFile)
            ? sourceFile
            : undefined;
    };
    const getSourceFileQueries = (sourceFile) => {
        if (sourceFile === undefined || !containsSourceFile(sourceFile)) {
            throw new Error("Source-file queries require an exact source file from the checked program.");
        }
        const existing = sourceFileQueries.get(sourceFile);
        if (existing !== undefined) {
            return existing;
        }
        const sourceChecker = createTypeCheckerQueries(program, {
            ...(options.context === undefined ? {} : { context: options.context }),
            ...(options.admitsCheckerDiagnostic === undefined ? {} : { admitsCheckerDiagnostic: options.admitsCheckerDiagnostic }),
            sourceFile,
        });
        const sourceTypeShape = createTypeShapeQueries(program, {
            ...(options.context === undefined ? {} : { context: options.context }),
            ...(options.admitsCheckerDiagnostic === undefined ? {} : { admitsCheckerDiagnostic: options.admitsCheckerDiagnostic }),
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
    const getCheckedModulePackage = (moduleSpecifier) => {
        if (moduleSpecifier === undefined)
            return undefined;
        const kind = ast.kindName(moduleSpecifier);
        const parent = ast.parent(moduleSpecifier);
        const parentKind = ast.kindName(parent);
        const owner = parentKind === "KindLiteralType" ? ast.parent(parent) : undefined;
        const staticReference = (parentKind === "KindImportDeclaration" || parentKind === "KindExportDeclaration")
            ? Node_ModuleSpecifier(parent) === moduleSpecifier
            : parentKind === "KindLiteralType" && ast.as.AsLiteralTypeNode(parent)?.Literal === moduleSpecifier &&
                ast.kindName(owner) === "KindImportType" && ast.as.AsImportTypeNode(owner)?.Argument === parent;
        const file = ast.getSourceFile(moduleSpecifier);
        if (!staticReference || (kind !== "KindStringLiteral" && kind !== "KindNoSubstitutionTemplateLiteral") ||
            file === undefined || !containsSourceFile(file) || !included(file))
            return undefined;
        const resolved = Program_GetResolvedModuleFromModuleSpecifier(program, file, moduleSpecifier);
        return resolved?.PackageId.Name ? resolved.PackageId : undefined;
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
        programSourceFiles,
        containsSourceFile,
        getSourceFiles,
        getSourceFile,
        getSourceFileQueries,
        getBackingConstraints() {
            const visited = new Set();
            const constraints = [];
            for (const file of programSourceFiles) {
                const vector = getSourceFileQueries(file).checker.getBackingConstraints();
                if (visited.has(vector))
                    continue;
                visited.add(vector);
                constraints.push(...vector);
            }
            return Object.freeze(constraints);
        },
        getCheckedModulePackage,
        resolveModuleSourceFile,
    });
}
//# sourceMappingURL=source-program.js.map