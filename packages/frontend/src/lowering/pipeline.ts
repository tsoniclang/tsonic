import { error, ok, type Result } from "../types/result.js";
import type { Diagnostic } from "../types/diagnostic.js";
import type { TsonicProgram } from "../program/types.js";
import { createLoweringInput } from "./input.js";
import { createLoweringModulePlan } from "./module-plan.js";
import type {
  BackendTargetId,
  LoweringPipelineOptions,
  LoweringPipelineResult,
} from "./types.js";

export const runLoweringPipeline = <
  Target extends BackendTargetId = BackendTargetId,
>(
  program: TsonicProgram<Target>,
  options: LoweringPipelineOptions<Target>
): Result<LoweringPipelineResult<Target>, readonly Diagnostic[]> => {
  const input = createLoweringInput(
    program.sourceProgram,
    options.backendCapabilities
  );
  const diagnostics: Diagnostic[] = [];
  const modules = [];

  for (const sourceFile of program.sourceProgram.sourceFiles) {
    const result = createLoweringModulePlan(sourceFile, input, options);
    if (result.ok) {
      modules.push(result.plan);
    } else {
      diagnostics.push(result.diagnostic);
    }
  }

  if (diagnostics.length > 0) {
    return error(diagnostics);
  }

  return ok({ input, modules });
};
