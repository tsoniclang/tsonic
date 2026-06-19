import type { TargetBackend, TargetBackendContext, TargetCompileInput, TargetCompileResult } from "@tsonic/target-api";
import { createCsharpSemanticContext } from "./semantic-context.js";
import { planCsharpArtifacts } from "./planner/csharp-planner.js";

export function createCsharpBackend(_context: TargetBackendContext): TargetBackend {
  return {
    compile(input: TargetCompileInput): TargetCompileResult {
      createCsharpSemanticContext(input.checker, input.facts);
      return planCsharpArtifacts(input);
    },
  };
}
