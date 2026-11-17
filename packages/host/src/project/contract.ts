import type { Result } from "../diag/contract.js";
import type { EffectFailure, EffectResult, TargetSelection } from "../snapshot/contract.js";

export interface ProjectConfiguration {
  readonly entryPoint: string;
  readonly rootFiles: readonly string[];
  readonly rootDir: string;
  readonly outDir: string;
  readonly cacheDir: string;
  readonly targets: readonly TargetSelection[];
}

export interface ProjectPaths {
  readonly projectFilePath: string;
  readonly projectDirectory: string;
  readonly projectRoot: string;
  readonly entryPointPath: string;
  readonly rootFilePaths: readonly string[];
  readonly outputRoot: string;
  readonly cacheRoot: string;
}

export interface ProjectResolution {
  readonly configuration: ProjectConfiguration;
  readonly paths: ProjectPaths;
}

export type PathEntry =
  | { readonly kind: "file"; readonly path: string; readonly realPath: string }
  | { readonly kind: "directory"; readonly path: string; readonly realPath: string }
  | { readonly kind: "symlink"; readonly path: string; readonly realPath: string; readonly target: string }
  | { readonly kind: "absent"; readonly path: string }
  | { readonly kind: "failed"; readonly path: string; readonly failure: EffectFailure };

export interface ProjectCapturePlan {
  readonly projectFilePath: string;
  readonly configuration: ProjectConfiguration;
  readonly paths: readonly string[];
}

export interface ProjectDeps {
  readonly workingDirectory: string;
  readonly pathStyle: "posix" | "windows";
}

export type ParseProject = (
  deps: ProjectDeps,
  projectFilePath: string,
  configText: string,
) => Result<ProjectCapturePlan>;

export type ResolveProject = (
  deps: ProjectDeps,
  plan: ProjectCapturePlan,
  entries: readonly PathEntry[],
) => Result<ProjectResolution>;

export interface ProjectEffects {
  readonly readText: (path: string) => Promise<EffectResult<string>>;
  readonly capturePaths: (paths: readonly string[]) => Promise<readonly PathEntry[]>;
}
