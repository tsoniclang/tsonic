/**
 * Program type definitions
 */

import type { TstsSourceFile } from "@tsonic/tsts";
import type { DeclarationModuleAlias } from "./declaration-module-aliases.js";
import type { SurfaceCapabilities } from "../surface/profiles.js";
import type { WorkspaceGraphSnapshot } from "./workspace-fingerprint.js";
import type { BackendCapabilityManifest } from "../capabilities/backend-capabilities.js";
import type { BackendTargetId } from "../lowering/index.js";
import type { TstsSourceProgram } from "../source-frontend/index.js";

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
  };

export type TsonicProgram<Target extends BackendTargetId = BackendTargetId> = {
  readonly sourceProgram: TstsSourceProgram;
  readonly options: CompilerOptions<Target>;
  readonly surfaceCapabilities: SurfaceCapabilities;
  readonly workspaceGraph: WorkspaceGraphSnapshot;
  readonly authoritativeTsonicPackageRoots: ReadonlyMap<string, string>;
  readonly declarationModuleAliases: ReadonlyMap<
    string,
    DeclarationModuleAlias
  >;
  /**
   * Runtime source closure selected from the TSTS module graph.
   *
   * This is intentionally distinct from `sourceProgram.sourceFiles`, which is
   * the full semantic graph including declarations and support files.
   */
  readonly runtimeSourceFiles: readonly TstsSourceFile[];
};
