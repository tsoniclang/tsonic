import type { CheckedSourceProgram } from "@tsonic/tsts";
import type { SourceHostInput } from "../../host-input/index.js";
import type { SourceProgramSemantics } from "../../host-input/semantics-types.js";
import { type SourceSolvedValueModel } from "./solver.js";
import { type SourceValueModelFacts } from "./program-facts.js";
import type { SourceTypeFlowSource } from "./types.js";
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
export declare function createSourceTypeFlowTestProgram(checked: CheckedSourceProgram): SourceTypeFlowTestProgram;
//# sourceMappingURL=type-flow-test-program.d.ts.map