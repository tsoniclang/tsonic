export { compileProject } from "./build.js";
export type { CompileProjectInput, ProjectBuildResult, TargetBuildResult } from "./build.js";
export {
  collectTargetRuntimeContributions,
  collectTstsDiagnostics,
  compileTargetFromSemanticSession,
  createTargetCompilerExtensions,
  createTsonicSemanticSession,
  getSelectedSurfaceImplementations,
  getSelectedTargetCapabilities,
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
export { collectTargetSourceProfileContributions } from "./target/source-profile.js";
export type { CollectedTargetSourceProfile, CollectTargetSourceProfileOptions, TargetSourceProfileFile } from "./target/source-profile.js";
export { parseTsonicProjectConfig } from "./project-config.js";
export { getTargetCompilationPaths, resolveProjectPaths } from "./project-paths.js";
export type { ProjectPathOptions, ProjectPaths } from "./project-paths.js";
export { discoverInstalledTsonicPlugins } from "./plugins/discovery.js";
export type { InstalledTsonicPluginRegistry } from "./plugins/registry.js";
