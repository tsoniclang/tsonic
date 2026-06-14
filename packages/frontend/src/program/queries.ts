/**
 * Program query functions
 */

import * as path from "node:path";
import type { TstsSourceFile } from "@tsonic/tsts";
import { getTstsSourceFileName } from "@tsonic/tsts";
import type { TsonicProgram } from "./types.js";
import type {
  TargetSurfaceArtifacts,
  TargetSurfaceProvider,
} from "../symbols/index.js";

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

export const getProgramTargetSurfaceProvider = (
  program: TsonicProgram
): TargetSurfaceProvider | undefined => program.targetSurfaceProvider;

export const getProgramTargetSurfaceArtifacts = (
  program: TsonicProgram
): TargetSurfaceArtifacts | undefined =>
  getProgramTargetSurfaceProvider(program)?.getArtifacts();

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
  const sourceFile = getProgramAllSourceFiles(program).find(
    (candidate) =>
      normalizePath(getProgramSourceFileName(candidate)) === absolutePath
  );

  return sourceFile ?? null;
};
