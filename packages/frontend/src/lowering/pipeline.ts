import { error, ok, type Result } from "../types/result.js";
import type { Diagnostic } from "../types/diagnostic.js";
import type { TsonicProgram } from "../program/types.js";
import { createLoweringInput } from "./input.js";
import { createLoweringModulePlan } from "./module-plan.js";
import type {
  BackendTargetId,
  LoweringPipelineOptions,
  LoweringPipelineResult,
  LoweringTypeRefPlan,
} from "./types.js";
import type { TstsSourceFile, TstsSymbol } from "@tsonic/tsts";

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
  const context = {
    input,
    options,
    checkerForSourceFile: (sourceFile: TstsSourceFile) =>
      program.sourceProgram.withTypeChecker(sourceFile, (checker) => checker),
    diagnostics,
    symbolStorageTypes: new Map<TstsSymbol, LoweringTypeRefPlan>(),
    resolvingStorageSymbols: new Set<TstsSymbol>(),
  };

  for (const sourceFile of program.sourceFiles) {
    const result = createLoweringModulePlan(sourceFile, context, options);
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
