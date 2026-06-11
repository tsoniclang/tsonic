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
import type { BackendTargetId } from "../ir/types.js";
import type {
  TargetSurfaceArtifacts,
  TargetSurfaceProvider,
} from "../symbols/index.js";
import type {
  SourceFrontendEngine,
  TypeScriptSemanticView,
} from "../source-frontend/index.js";

export type SurfaceMode = string;

export type ProgramInputScope = "package" | "entrypoint";

export type CompilerOptions<Target extends BackendTargetId = BackendTargetId> =
  {
    readonly projectRoot: string; // Directory containing package.json (for node_modules resolution)
    readonly sourceRoot: string;
    readonly rootNamespace: string;
    readonly surface?: SurfaceMode;
    readonly strict?: boolean;
    readonly typeRoots?: readonly string[];
    readonly verbose?: boolean;
    readonly backendCapabilities?: BackendCapabilityManifest;
    readonly backendTargetId?: Target;
    readonly programInputScope?: ProgramInputScope;
    readonly sourceFrontend?: SourceFrontendEngine;
  };

export type TsonicProgram<Target extends BackendTargetId = BackendTargetId> = {
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
  readonly sourceSemantics: TypeScriptSemanticView;
  readonly options: CompilerOptions<Target>;
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
  /** Active target surface contract used to produce symbol artifacts after bindings discovery. */
  readonly targetSurfaceProvider?: TargetSurfaceProvider;
};
