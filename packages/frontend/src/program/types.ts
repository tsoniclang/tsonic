/**
 * Program type definitions
 */

import * as ts from "typescript";
import { DotnetMetadataRegistry } from "../dotnet-metadata.js";
import { BindingRegistry } from "./bindings.js";
import { ClrBindingsResolver } from "../resolver/clr-bindings-resolver.js";
import type { Binding } from "../ir/binding/index.js";

export type CompilerOptions = {
  readonly projectRoot: string; // Directory containing package.json (for node_modules resolution)
  readonly sourceRoot: string;
  readonly rootNamespace: string;
  readonly strict?: boolean;
  readonly typeRoots?: readonly string[];
  readonly verbose?: boolean;
  /** Use TypeScript standard lib (Array, Promise, etc.) instead of noLib mode */
  readonly useStandardLib?: boolean;
};

export type TsonicProgram = {
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
  readonly options: CompilerOptions;
  readonly sourceFiles: readonly ts.SourceFile[];
  /** Declaration files from typeRoots (globals, dotnet types, etc.) */
  readonly declarationSourceFiles: readonly ts.SourceFile[];
  readonly metadata: DotnetMetadataRegistry;
  readonly bindings: BindingRegistry;
  /** Resolver for CLR namespace imports (import-driven discovery) */
  readonly clrResolver: ClrBindingsResolver;
  /** Symbol resolution binding layer (replaces direct checker calls) */
  readonly binding: Binding;
};
