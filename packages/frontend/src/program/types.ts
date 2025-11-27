/**
 * Program type definitions
 */

import * as ts from "typescript";
import { DotnetMetadataRegistry } from "../dotnet-metadata.js";
import { BindingRegistry } from "./bindings.js";

export type RuntimeMode = "js" | "dotnet";

export type CompilerOptions = {
  readonly sourceRoot: string;
  readonly rootNamespace: string;
  readonly strict?: boolean;
  readonly typeRoots?: readonly string[];
  readonly verbose?: boolean;
  /** Use TypeScript standard lib (Array, Promise, etc.) instead of noLib mode */
  readonly useStandardLib?: boolean;
  /**
   * Runtime mode:
   * - "js": JS built-ins available via Tsonic.JSRuntime
   * - "dotnet": Pure .NET mode, JS built-ins forbidden
   * Defaults to "js"
   */
  readonly runtime?: RuntimeMode;
};

export type TsonicProgram = {
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
  readonly options: CompilerOptions;
  readonly sourceFiles: readonly ts.SourceFile[];
  readonly metadata: DotnetMetadataRegistry;
  readonly bindings: BindingRegistry;
};
