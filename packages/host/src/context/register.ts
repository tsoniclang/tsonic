import type { ContextFactory } from "./contract.js";
import { resourceLimitDiagnostic } from "./failures.js";
import { createProgram } from "./program.js";

export const contextFactory: ContextFactory = Object.freeze<ContextFactory>({
  create: options => createProgram(options),
  resourceLimitDiagnostic: error => resourceLimitDiagnostic(error),
});
