/**
 * Program type definitions
 */

import * as ts from "typescript";
import { DotnetMetadataRegistry } from "../dotnet-metadata.js";
import { BindingRegistry } from "./bindings.js";
import { ClrBindingsResolver } from "../resolver/clr-bindings-resolver.js";
import type { Binding } from "../ir/binding/index.js";
import type { DeclarationModuleAlias } from "./declaration-module-aliases.js";

export type SurfaceMode = string;

export type CompilerOptions = {
  readonly projectRoot: string; // Directory containing package.json (for node_modules resolution)
  readonly sourceRoot: string;
  readonly rootNamespace: string;
  readonly surface?: SurfaceMode;
  readonly strict?: boolean;
  readonly typeRoots?: readonly string[];
  readonly verbose?: boolean;
};

export type TsonicProgram = {
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
  readonly options: CompilerOptions;
  readonly authoritativeTsonicPackageRoots?: ReadonlyMap<string, string>;
  readonly declarationModuleAliases?: ReadonlyMap<
    string,
    DeclarationModuleAlias
  >;
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
