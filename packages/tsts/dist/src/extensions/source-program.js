import { Program_GetSourceFile, Program_GetSourceFiles, } from "../internal/compiler/program.js";
import { createAstReader } from "../services/ast-reader.js";
import { createTypeCheckerQueries } from "../services/type-checker.js";
import { createTypeShapeQueries } from "../services/type-shape.js";
export function createSourceProgramQueries(program, options = {}) {
    if (program === undefined) {
        throw new Error("Source program queries require a compiler program.");
    }
    const ast = createAstReader();
    const sourceFileQueries = new WeakMap();
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
        const created = Object.freeze({
            sourceFile,
            ast,
            checker: createTypeCheckerQueries(program, {
                sourceFile,
                ...(options.context === undefined ? {} : { context: options.context }),
            }),
            typeShape: createTypeShapeQueries(program, {
                sourceFile,
                ...(options.context === undefined ? {} : { context: options.context }),
            }),
        });
        sourceFileQueries.set(sourceFile, created);
        return created;
    };
    return Object.freeze({
        ast,
        getSourceFiles,
        getSourceFile,
        getSourceFileQueries,
    });
}
//# sourceMappingURL=source-program.js.map