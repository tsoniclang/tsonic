import { Program_GetSourceFile, Program_GetSourceFiles, } from "../internal/compiler/program.js";
import { createAstReader } from "../services/ast-reader.js";
import { createTypeCheckerQueries } from "../services/type-checker.js";
import { createTypeShapeQueries } from "../services/type-shape.js";
export function createSourceProgramQueries(program, options = {}) {
    if (program === undefined) {
        throw new Error("Source program queries require a compiler program.");
    }
    const ast = options.ast ?? createAstReader();
    const checker = options.checker ?? createTypeCheckerQueries(program, {
        ...(options.context === undefined ? {} : { context: options.context }),
    });
    const typeShape = options.typeShape ?? createTypeShapeQueries(program, {
        ...(options.context === undefined ? {} : { context: options.context }),
    });
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
            checker,
            typeShape,
        });
        sourceFileQueries.set(sourceFile, created);
        return created;
    };
    return Object.freeze({
        ast,
        checker,
        typeShape,
        getSourceFiles,
        getSourceFile,
        getSourceFileQueries,
    });
}
//# sourceMappingURL=source-program.js.map