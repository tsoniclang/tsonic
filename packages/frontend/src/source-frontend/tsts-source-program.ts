import * as fs from "node:fs";
import * as path from "node:path";
import type {
  CompilerExtension,
  ExtensionDiagnostic,
  ExtensionHost,
  TstsSourceFile,
} from "@tsonic/tsts";
import {
  createExtensionHost,
  parseTstsSourceFile,
} from "@tsonic/tsts";
import { createTsonicNumericPrimitiveExtension } from "../tsonic-extension/index.js";

export type TstsSourceProgram = {
  readonly engine: "tsts";
  readonly sourceFiles: readonly TstsSourceFile[];
  readonly extensionHost: ExtensionHost;
  readonly diagnostics: readonly ExtensionDiagnostic[];
};

export type CreateTstsSourceProgramOptions = {
  readonly extensions?: readonly CompilerExtension[];
  readonly readFile?: (filePath: string) => string;
};

const isTsxPath = (filePath: string): boolean =>
  filePath.endsWith(".tsx") || filePath.endsWith(".jsx");

const readSourceFile = (filePath: string): string =>
  fs.readFileSync(filePath, "utf8");

const defaultExtensions = (): readonly CompilerExtension[] => [
  createTsonicNumericPrimitiveExtension(),
];

export const createTstsSourceProgram = (
  filePaths: readonly string[],
  options: CreateTstsSourceProgramOptions = {},
): TstsSourceProgram => {
  const extensions = options.extensions ?? defaultExtensions();
  const extensionHost = createExtensionHost(extensions);
  const readFile = options.readFile ?? readSourceFile;
  const sourceFiles = filePaths.map((filePath) => {
    const resolvedPath = path.resolve(filePath);
    let sourceFile: TstsSourceFile | undefined;
    try {
      sourceFile = parseTstsSourceFile(readFile(resolvedPath), {
        fileName: resolvedPath,
        tsx: isTsxPath(resolvedPath),
        useCaseSensitiveFileNames: true,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new Error(`TSTS parser failed for ${resolvedPath}: ${message}`);
    }

    if (!sourceFile) {
      throw new Error(`TSTS parser did not return a source file for ${resolvedPath}.`);
    }

    return sourceFile;
  });

  extensionHost.configure();
  for (const sourceFile of sourceFiles) {
    extensionHost.afterParseSourceFile(sourceFile);
  }

  return {
    engine: "tsts",
    sourceFiles,
    extensionHost,
    diagnostics: extensionHost.diagnostics.all(),
  };
};

export const createEmptyTstsSourceProgramForTests = (): TstsSourceProgram => {
  const extensionHost = createExtensionHost(defaultExtensions());
  extensionHost.configure();
  return {
    engine: "tsts",
    sourceFiles: [],
    extensionHost,
    diagnostics: extensionHost.diagnostics.all(),
  };
};
