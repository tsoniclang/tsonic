/**
 * Program query functions
 */

import * as path from "node:path";
import type { TstsSourceFile } from "@tsonic/tsts";
import type { TsonicProgram } from "./types.js";

const normalizePath = (filePath: string): string =>
  path.resolve(filePath).replace(/\\/g, "/");

export const getProgramRuntimeSourceFiles = (
  program: TsonicProgram
): readonly TstsSourceFile[] => program.runtimeSourceFiles;

export const getProgramDeclarationSourceFiles = (
  program: TsonicProgram
): readonly TstsSourceFile[] =>
  program.sourceProgram.sourceFiles.filter(
    (sourceFile) => sourceFile.IsDeclarationFile === true
  );

export const getProgramSemanticSourceFiles = (
  program: TsonicProgram
): readonly TstsSourceFile[] => program.sourceProgram.sourceFiles;

export const getProgramSourceFileName = (sourceFile: TstsSourceFile): string =>
  sourceFile.FileName();

export const getProgramAllSourceFiles = (
  program: TsonicProgram
): readonly TstsSourceFile[] => getProgramSemanticSourceFiles(program);

/**
 * Get a source file from the program by file path
 */
export const getSourceFile = (
  program: TsonicProgram,
  filePath: string
): TstsSourceFile | null => {
  const absolutePath = normalizePath(filePath);
  let sourceFile: TstsSourceFile | null = null;
  for (const candidate of getProgramAllSourceFiles(program)) {
    if (normalizePath(getProgramSourceFileName(candidate)) !== absolutePath) {
      continue;
    }
    if (sourceFile !== null) return null;
    sourceFile = candidate;
  }
  return sourceFile;
};
