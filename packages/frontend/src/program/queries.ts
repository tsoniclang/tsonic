/**
 * Program query functions
 */

import * as ts from "typescript";
import * as path from "node:path";
import { TsonicProgram } from "./types.js";

/**
 * Get a source file from the program by file path
 */
export const getSourceFile = (
  program: TsonicProgram,
  filePath: string
): ts.SourceFile | null => {
  const absolutePath = path.resolve(filePath);
  return program.program.getSourceFile(absolutePath) ?? null;
};
