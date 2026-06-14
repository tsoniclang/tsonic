/**
 * Module dependency graph builder backed by the TSTS module graph and Tsonic
 * lowering plans.
 */

import { relative, resolve } from "node:path";
import { error, ok, type Result } from "../types/result.js";
import { createDiagnostic, type Diagnostic } from "../types/diagnostic.js";
import {
  runLoweringPipeline,
  type BackendTargetId,
  type LoweringModulePlan,
} from "../lowering/index.js";
import {
  resolveSurfaceCapabilities,
  type SurfaceCapabilities,
} from "../surface/profiles.js";
import { createProgram } from "./creation.js";
import { discoverProgramInputs } from "./program-input-discovery.js";
import type { CompilerOptions, TsonicProgram } from "./types.js";
import {
  buildWorkspaceGraphSnapshot,
  type WorkspaceGraphSnapshot,
} from "./workspace-fingerprint.js";

export type ModuleDependencyGraphResult<
  Target extends BackendTargetId = BackendTargetId,
> = {
  readonly modules: readonly LoweringModulePlan<Target>[];
  readonly entryModule: LoweringModulePlan<Target>;
  readonly surfaceCapabilities: SurfaceCapabilities;
  readonly workspaceGraph: WorkspaceGraphSnapshot;
};

const sortModulesBySourceIdentity = <
  Target extends BackendTargetId = BackendTargetId,
>(
  modules: readonly LoweringModulePlan<Target>[]
): readonly LoweringModulePlan<Target>[] =>
  [...modules].sort((left, right) =>
    left.identity.filePath.localeCompare(right.identity.filePath)
  );

export const buildModuleDependencyGraph = <
  Target extends BackendTargetId = BackendTargetId,
>(
  entryFile: string,
  options: CompilerOptions<Target>
): Result<ModuleDependencyGraphResult<Target>, readonly Diagnostic[]> => {
  const entryAbs = resolve(entryFile);
  const sourceRootAbs = resolve(options.sourceRoot);
  const surfaceCapabilities = resolveSurfaceCapabilities(options.surface, {
    projectRoot: options.projectRoot,
  });
  const discovery = discoverProgramInputs(
    [entryAbs],
    { ...options, sourceRoot: sourceRootAbs },
    surfaceCapabilities
  );

  if (discovery.diagnostics.length > 0) {
    return error(discovery.diagnostics);
  }

  const programResult = createProgram([entryAbs], {
    ...options,
    sourceRoot: sourceRootAbs,
  });
  if (!programResult.ok) {
    return error(programResult.error.diagnostics);
  }

  const tsonicProgram = programResult.value as TsonicProgram<Target>;
  const loweringResult = runLoweringPipeline(tsonicProgram, {
    sourceRoot: sourceRootAbs,
    rootNamespace: options.rootNamespace,
    backendCapabilities: options.backendCapabilities,
    backendTargetId: options.backendTargetId,
  });
  if (!loweringResult.ok) {
    return error(loweringResult.error);
  }

  const modules = sortModulesBySourceIdentity(loweringResult.value.modules);
  const entryRelative = relative(sourceRootAbs, entryAbs).replace(/\\/g, "/");
  const entryModule =
    modules.find((module) => module.identity.filePath === entryRelative) ??
    modules[0];
  if (entryModule === undefined) {
    return error([
      createDiagnostic("TSN1001", "error", "No modules found in the project", {
        file: entryAbs,
        line: 1,
        column: 1,
        length: 1,
      }),
    ]);
  }

  return ok({
    modules,
    entryModule,
    surfaceCapabilities: tsonicProgram.surfaceCapabilities ?? surfaceCapabilities,
    workspaceGraph: buildWorkspaceGraphSnapshot({
      projectRoot: options.projectRoot,
      sourceRoot: sourceRootAbs,
      sourceFiles: discovery.allFiles,
      ambientFiles: discovery.ambientSupportFiles,
      typeRoots: discovery.typeRoots,
      edges: discovery.dependencyEdges,
      options,
      surfaceCapabilities:
        tsonicProgram.surfaceCapabilities ?? surfaceCapabilities,
    }),
  });
};
