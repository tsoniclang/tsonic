import type { bool } from "@tsonic/core/types.js";
import type { GoPtr } from "../go/compat.js";
import type { SourceFile } from "../internal/ast/ast.js";
import { ScriptKindTS, ScriptKindTSX } from "../internal/core/scriptkind.js";
import type { ScriptKind } from "../internal/core/scriptkind.js";
import { ParseSourceFile } from "../internal/parser/parser/statements-declarations.js";
import {
  GetEncodedRootLength,
  NormalizePath,
  ToPath,
} from "../internal/tspath/path.js";

export type ParseTstsSourceOptions = {
  readonly fileName?: string;
  readonly tsx?: boolean;
  readonly useCaseSensitiveFileNames?: boolean;
};

const normalizeParseFileName = (fileName: string): string => {
  const rootedFileName =
    GetEncodedRootLength(fileName) === 0 ? `/${fileName}` : fileName;
  return NormalizePath(rootedFileName);
};

export const parseTstsSourceFile = (
  sourceText: string,
  options: ParseTstsSourceOptions = {},
): GoPtr<SourceFile> => {
  const fileName = normalizeParseFileName(options.fileName ?? "/input.ts");
  const useCaseSensitiveFileNames =
    options.useCaseSensitiveFileNames ?? true;
  const scriptKind: ScriptKind = options.tsx === true ? ScriptKindTSX : ScriptKindTS;

  return ParseSourceFile(
    {
      FileName: fileName,
      Path: ToPath(
        fileName,
        "/",
        useCaseSensitiveFileNames as bool,
      ),
    },
    sourceText,
    scriptKind,
  );
};
