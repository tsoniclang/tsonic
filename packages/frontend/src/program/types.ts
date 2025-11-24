/**
 * Program type definitions
 */

import * as ts from "typescript";
import { DotnetMetadataRegistry } from "../dotnet-metadata.js";
import { BindingRegistry } from "./bindings.js";

export type CompilerOptions = {
  readonly sourceRoot: string;
  readonly rootNamespace: string;
  readonly strict?: boolean;
  readonly typeRoots?: readonly string[];
  readonly verbose?: boolean;
};

export type TsonicProgram = {
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
  readonly options: CompilerOptions;
  readonly sourceFiles: readonly ts.SourceFile[];
  readonly metadata: DotnetMetadataRegistry;
  readonly bindings: BindingRegistry;
};
