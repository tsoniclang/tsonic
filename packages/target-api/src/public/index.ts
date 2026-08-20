export type {
  TargetId,
  TargetSelection,
  TargetSelectionOptions,
  TargetSurfaceId,
  TsonicProjectConfig,
} from "../config.js";
export {
  getTargetIdValidationMessage,
  isValidTargetId,
  isValidTargetSurfaceId,
} from "../config.js";
export type {
  TargetBackend,
  TargetBackendContext,
  TargetCompilationPaths,
  TargetCompileInput,
  TargetPack,
  TargetToolchain,
  TargetToolchainContext,
  TargetToolchainInput,
  TargetToolchainResult,
  TsonicPlugin,
  TsonicTargetPlugin,
} from "../target-contracts.js";
export type {
  TargetSourcePackage,
  TargetSourcePackageComponent,
  TargetSourcePackageExport,
  TargetSourcePackageGraph,
} from "../source-packages/model.js";
export { createTargetRegistry } from "../registry.js";
export type { TargetRegistry } from "../registry.js";
