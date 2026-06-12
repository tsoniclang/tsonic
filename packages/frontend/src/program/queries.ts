/**
 * Program query functions
 */

import * as ts from "typescript";
import * as path from "node:path";
import { TsonicProgram } from "./types.js";

const normalizePath = (filePath: string): string =>
  path.resolve(filePath).replace(/\\/g, "/");

/**
 * Get a source file from the program by file path
 */
export const getSourceFile = (
  program: TsonicProgram,
  filePath: string
): ts.SourceFile | null => {
  const absolutePath = normalizePath(filePath);
  const sourceFile = [
    ...program.sourceFiles,
    ...program.declarationSourceFiles,
  ].find((candidate) => normalizePath(candidate.fileName) === absolutePath);

  return sourceFile ?? null;
};
