import { createHostSourceProgramInput } from "../../../packages/host/dist/host-input/program.js";
import { composeSourceProgram } from "../../../packages/target-api/dist/source-semantics/target-source-program.js";

export function sourceFlowOwnerFixture(options) {
  const original = createHostSourceProgramInput(options);
  const selected = composeSourceProgram(original.input);
  return Object.freeze({ program: selected.program, flow: selected.flow });
}
