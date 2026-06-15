/**
 * Program query functions
 */

import * as path from "node:path";
import type { TstsSourceFile } from "@tsonic/tsts";
import { getTstsSourceFileName } from "@tsonic/tsts";
import type { TsonicProgram } from "./types.js";

const normalizePath = (filePath: string): string =>
  path.resolve(filePath).replace(/\\/g, "/");

export const getProgramSourceFiles = (
  program: TsonicProgram
): readonly TstsSourceFile[] => program.sourceFiles;

export const getProgramDeclarationSourceFiles = (
  program: TsonicProgram
): readonly TstsSourceFile[] => program.declarationSourceFiles;

export const getProgramSemanticSourceFiles = (
  program: TsonicProgram
): readonly TstsSourceFile[] => program.sourceProgram.sourceFiles;

export const getProgramSourceFileName = (
  sourceFile: TstsSourceFile
): string => getTstsSourceFileName(sourceFile) ?? "";

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
  const sourceFiles = getProgramAllSourceFiles(program).filter(
    (candidate) =>
      normalizePath(getProgramSourceFileName(candidate)) === absolutePath
  );

  return sourceFiles.length === 1 ? (sourceFiles[0] ?? null) : null;
};
