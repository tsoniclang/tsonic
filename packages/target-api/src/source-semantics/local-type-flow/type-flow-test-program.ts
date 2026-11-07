// Test support for local-type-flow Host tests (no production caller). Builds the Host program owner once and exposes
// the services the type-flow stages read, the solved value model and the published value facts of the same program.
import type { CheckedSourceProgram } from "@tsonic/tsts";
import { buildHostSourceProgram } from "../target-source-program.js";
import type { SourceJsApiFacts } from "../../public/source/objects.js";
import type { SourceHostInput } from "../../host-input/index.js";
import type { SourceProgramSemantics } from "../../host-input/semantics-types.js";
import { analyzeSourceEffectiveTypes, type SourceSolvedValueModel } from "./solver.js";
import { buildSourceValueModelFacts, type SourceValueModelFacts } from "./program-facts.js";
import { createSourceTypeDescriptorUnions } from "./terms.js";
import type { SourceTypeFlowSource } from "./types.js";
import { hostProgramFixturePlatform } from "../host-program-fixtures.js";

export interface SourceTypeFlowTestProgram extends SourceTypeFlowSource {
  /** The checker services, for tests that compare Host facts with checker answers (tests only; never production). */
  readonly semantics: SourceProgramSemantics;
  /** One solver run over this program (its own descriptor owner: `effectiveTypes.owner`). */
  readonly effectiveTypes: SourceSolvedValueModel;
  /** The published value-model facts (an independent build over the same services). */
  readonly valueFacts: SourceValueModelFacts;
  /** The program's one host-input adapter (the program builder's; shared by the solver run and the published facts). */
  readonly input: SourceHostInput;
}

export function createSourceTypeFlowTestProgram(checked: CheckedSourceProgram): SourceTypeFlowTestProgram {
  // The value-model tests do not read the JS API profile.
  const built = buildHostSourceProgram(checked, { profile: () => Object.freeze({}) as unknown as SourceJsApiFacts,
    platform: hostProgramFixturePlatform });
  const host = built.program;
  const services: SourceTypeFlowSource = Object.freeze({ ast: host.ast, sourceFiles: host.sourceFiles,
    sourceFacts: host.sourceFacts, navigation: host.navigation, platform: hostProgramFixturePlatform });
  const { input, semantics } = built;
  const effectiveTypes = analyzeSourceEffectiveTypes(services, createSourceTypeDescriptorUnions(host.ast, checked.programSourceFiles), input);
  return Object.freeze({ ...services, semantics, input, effectiveTypes,
    valueFacts: buildSourceValueModelFacts(services, checked.programSourceFiles, input) });
}
