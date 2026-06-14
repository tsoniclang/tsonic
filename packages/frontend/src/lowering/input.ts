import type { BackendCapabilityManifest } from "../capabilities/backend-capabilities.js";
import type { TstsSourceProgram } from "../source-frontend/index.js";
import type { LoweringInput } from "./types.js";

export const createLoweringInput = (
  sourceProgram: TstsSourceProgram,
  capabilities?: BackendCapabilityManifest
): LoweringInput => ({
  sourceProgram,
  moduleGraph: sourceProgram.moduleGraph,
  facts: sourceProgram.extensionHost.facts,
  capabilities,
});
