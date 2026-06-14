import { ScriptKindTS, ScriptKindTSX } from "../internal/core/scriptkind.js";
import { ParseSourceFile } from "../internal/parser/parser/statements-declarations.js";
import { GetEncodedRootLength, NormalizePath, ToPath, } from "../internal/tspath/path.js";
const normalizeParseFileName = (fileName) => {
    const rootedFileName = GetEncodedRootLength(fileName) === 0 ? `/${fileName}` : fileName;
    return NormalizePath(rootedFileName);
};
export const parseTstsSourceFile = (sourceText, options = {}) => {
    const fileName = normalizeParseFileName(options.fileName ?? "/input.ts");
    const useCaseSensitiveFileNames = options.useCaseSensitiveFileNames ?? true;
    const scriptKind = options.tsx === true ? ScriptKindTSX : ScriptKindTS;
    return ParseSourceFile({
        FileName: fileName,
        Path: ToPath(fileName, "/", useCaseSensitiveFileNames),
    }, sourceText, scriptKind);
};
//# sourceMappingURL=parse-source.js.map