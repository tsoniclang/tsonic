/**
 * Program query functions
 */

import * as ts from "typescript";
import * as path from "node:path";
import { TsonicProgram } from "./types.js";

const normalizePath = (filePath: string): string =>
  path.resolve(filePath).replace(/\\/g, "/");

export const getProgramCompilerOptions = (
  program: TsonicProgram
): ts.CompilerOptions => program.tsCompilerOptions;

export const getProgramSourceFiles = (
  program: TsonicProgram
): readonly ts.SourceFile[] => program.sourceFiles;

export const getProgramDeclarationSourceFiles = (
  program: TsonicProgram
): readonly ts.SourceFile[] => program.declarationSourceFiles;

export const getProgramAllSourceFiles = (
  program: TsonicProgram
): readonly ts.SourceFile[] => [
  ...getProgramSourceFiles(program),
  ...getProgramDeclarationSourceFiles(program),
];

/**
 * Get a source file from the program by file path
 */
export const getSourceFile = (
  program: TsonicProgram,
  filePath: string
): ts.SourceFile | null => {
  const absolutePath = normalizePath(filePath);
  const sourceFile = getProgramAllSourceFiles(program).find(
    (candidate) => normalizePath(candidate.fileName) === absolutePath
  );

  return sourceFile ?? null;
};
