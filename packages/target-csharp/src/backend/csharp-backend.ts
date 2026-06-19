import type { TargetBackend, TargetBackendContext, TargetCompileInput, TargetCompileResult } from "@tsonic/target-api";
import { createCsharpSemanticContext } from "./semantic-context.js";

export function createCsharpBackend(_context: TargetBackendContext): TargetBackend {
  return {
    compile(input: TargetCompileInput): TargetCompileResult {
      createCsharpSemanticContext(input.checker, input.facts);
      return {
        artifacts: [],
        diagnostics: [{
          code: "CSHARP_BACKEND_NOT_IMPLEMENTED",
          category: "error",
          message: "Fresh C# backend skeleton is installed. Target AST planning is the next implementation step.",
          source: "tsonic-csharp",
          evidence: [
            "Backend input must be TSTS AST plus finalized TSTS extension facts.",
            "Backend output must be C# AST printed to C# source files.",
          ],
        }],
      };
    },
  };
}
