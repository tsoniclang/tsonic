export { compileProject } from "./build.js";
export type { CompileProjectInput, ProjectBuildResult, TargetBuildResult } from "./build.js";
export { createProgramOptionsForProject } from "./program-options.js";
export type { SourceDeclarationSnapshot } from "./program-options.js";
export type { CreatedProgramOptions, CreateProgramOptionsInput } from "./program-options.js";
export { collectTargetSourceProfileContributions } from "./target/source-profile.js";
// The Host-only compiler extension of a target source-extension contribution (K-2682): for Host tests and tools that
// build a checked program directly from target contributions.
export { createTargetContributedCompilerExtension } from "./target/extensions.js";
export type { CollectedTargetSourceProfile, CollectTargetSourceProfileOptions, TargetSourceProfileFile } from "./target/source-profile.js";
export { parseTsonicProjectConfig } from "./project-config.js";
export { getTargetCompilationPaths, resolveProjectPaths } from "./project-paths.js";
export type { ProjectPathOptions, ProjectPaths } from "./project-paths.js";
export { discoverInstalledTsonicPlugins } from "./plugins/discovery.js";
export type { InstalledTsonicPluginRegistry } from "./plugins/registry.js";
