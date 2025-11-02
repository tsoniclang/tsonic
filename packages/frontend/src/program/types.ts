/**
 * Program type definitions
 */

import * as ts from "typescript";
import { DotnetMetadataRegistry } from "../dotnet-metadata.js";

export type CompilerOptions = {
  readonly sourceRoot: string;
  readonly rootNamespace: string;
  readonly strict?: boolean;
};

export type TsonicProgram = {
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
  readonly options: CompilerOptions;
  readonly sourceFiles: readonly ts.SourceFile[];
  readonly metadata: DotnetMetadataRegistry;
};
