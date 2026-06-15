import { relative, resolve } from "node:path";
import { error, ok, type Result } from "../types/result.js";
import { createDiagnostic, type Diagnostic } from "../types/diagnostic.js";
import {
  type BackendTargetId,
  type LoweringModulePlan,
} from "../lowering/index.js";
import { runLoweringPipeline } from "../lowering/pipeline.js";
import type { SurfaceCapabilities } from "../surface/profiles.js";
import type { TsonicProgram } from "./types.js";
import type { WorkspaceGraphSnapshot } from "./workspace-fingerprint.js";

export type LoweringModuleGraphResult<
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

export const createLoweringModuleGraph = <
  Target extends BackendTargetId = BackendTargetId,
>(
  program: TsonicProgram<Target>,
  entryFile: string
): Result<LoweringModuleGraphResult<Target>, readonly Diagnostic[]> => {
  const options = program.options;
  const entryAbs = resolve(entryFile);
  const sourceRootAbs = resolve(options.sourceRoot);
  const loweringResult = runLoweringPipeline<Target>(program, {
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
    surfaceCapabilities: program.surfaceCapabilities,
    workspaceGraph: program.workspaceGraph,
  });
};
