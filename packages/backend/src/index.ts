/**
 * Tsonic Backend - .NET build orchestration
 */

// Export main build function
export { buildNativeAot } from "./build-orchestrator.js";

// Export types
export type {
  BuildOptions,
  BuildResult,
  BuildConfig,
  EntryInfo,
  NuGetPackage,
  DotnetResult,
  OutputType,
  OutputConfig,
  ExecutableConfig,
  LibraryConfig,
  ConsoleAppConfig,
  PackageMetadata,
} from "./types.js";

// Export utilities
export { checkDotnetInstalled, detectRid } from "./dotnet.js";
export { generateCsproj } from "./project-generator.js";
export { generateProgramCs } from "./program-generator.js";
