/**
 * Program type definitions
 */

import * as ts from "typescript";
import { ExternalMetadataRegistry } from "../external-metadata.js";
import { BindingRegistry } from "./bindings.js";
import { ExternalBindingsResolver } from "../resolver/external-bindings-resolver.js";
import type { Binding } from "../ir/binding/index.js";
import type { DeclarationModuleAlias } from "./declaration-module-aliases.js";
import type { SurfaceCapabilities } from "../surface/profiles.js";
import type { BackendCapabilityManifest } from "../capabilities/backend-capabilities.js";
import type { TargetSurfaceArtifacts } from "../symbols/index.js";

export type SurfaceMode = string;

export type CompilerOptions = {
  readonly projectRoot: string; // Directory containing package.json (for node_modules resolution)
  readonly sourceRoot: string;
  readonly rootNamespace: string;
  readonly surface?: SurfaceMode;
  readonly strict?: boolean;
  readonly typeRoots?: readonly string[];
  readonly verbose?: boolean;
  readonly backendCapabilities?: BackendCapabilityManifest;
};

export type TsonicProgram = {
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
  readonly options: CompilerOptions;
  readonly surfaceCapabilities?: SurfaceCapabilities;
  readonly authoritativeTsonicPackageRoots?: ReadonlyMap<string, string>;
  readonly declarationModuleAliases?: ReadonlyMap<
    string,
    DeclarationModuleAlias
  >;
  readonly sourceFiles: readonly ts.SourceFile[];
  /** Declaration files from typeRoots (globals, external surface types, etc.) */
  readonly declarationSourceFiles: readonly ts.SourceFile[];
  readonly metadata: ExternalMetadataRegistry;
  readonly bindings: BindingRegistry;
  /** Resolver for external namespace imports (import-driven discovery) */
  readonly externalResolver: ExternalBindingsResolver;
  /** Symbol resolution binding layer (replaces direct checker calls) */
  readonly binding: Binding;
  /** Target-neutral symbol surface plus target render table produced for the active compilation. */
  readonly targetSurfaceArtifacts?: TargetSurfaceArtifacts;
};
