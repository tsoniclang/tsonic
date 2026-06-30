export { compileProject } from "./build.js";
export type { CompileProjectInput, ProjectBuildResult, TargetBuildResult } from "./build.js";
export {
  collectTargetRuntimeContributions,
  collectTstsDiagnostics,
  compileTargetFromSemanticSession,
  createTargetCompilerExtensions,
  createTsonicSemanticSession,
  getSelectedSurfaceImplementations,
  getTargetRequiredProviderModules,
} from "./compiler-session.js";
export type {
  CollectedTargetRuntimeContributions,
  CollectTargetRuntimeContributionsOptions,
  CreateTargetCompilerExtensionsOptions,
  CreateTsonicSemanticSessionOptions,
  TargetCompilerExtensionComposition,
  TsonicSemanticSession,
} from "./compiler-session.js";
export { createProgramOptionsForProject } from "./program-options.js";
export type { CreatedProgramOptions, CreateProgramOptionsInput } from "./program-options.js";
export { parseTsonicProjectConfig } from "./project-config.js";
export { getTargetCompilationPaths, resolveProjectPaths } from "./project-paths.js";
export type { ProjectPathOptions, ProjectPaths } from "./project-paths.js";
