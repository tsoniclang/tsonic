import type { TargetBackendContext, TargetToolchain, TargetToolchainInput, TargetToolchainResult } from "@tsonic/target-api";

export function createDotnetToolchain(_context: TargetBackendContext): TargetToolchain {
  return {
    prepare(input: TargetToolchainInput): TargetToolchainResult {
      return {
        diagnostics: [`dotnet toolchain handoff is pending for target '${input.target.id}'.`],
        producedArtifacts: [],
      };
    },
  };
}
