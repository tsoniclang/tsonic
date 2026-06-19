import type { TargetBackend, TargetBackendContext, TargetCompileInput, TargetCompileResult } from "@tsonic/target-api";
import { planCsharpArtifacts } from "./planner/csharp-planner.js";

export function createCsharpBackend(_context: TargetBackendContext): TargetBackend {
  return {
    compile(input: TargetCompileInput): TargetCompileResult {
      return planCsharpArtifacts(input);
    },
  };
}
