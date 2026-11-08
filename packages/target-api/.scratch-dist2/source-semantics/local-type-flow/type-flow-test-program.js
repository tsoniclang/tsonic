import { buildHostSourceProgram } from "../target-source-program.js";
import { analyzeSourceEffectiveTypes } from "./solver.js";
import { buildSourceValueModelFacts } from "./program-facts.js";
import { createSourceTypeDescriptorUnions } from "./terms.js";
import { hostProgramFixturePlatform } from "../host-program-fixtures.js";
export function createSourceTypeFlowTestProgram(checked) {
    // The value-model tests do not read the JS API profile.
    const built = buildHostSourceProgram(checked, { profile: () => Object.freeze({}),
        platform: hostProgramFixturePlatform });
    const host = built.program;
    const services = Object.freeze({ ast: host.ast, sourceFiles: host.sourceFiles,
        sourceFacts: host.sourceFacts, navigation: host.navigation, platform: hostProgramFixturePlatform,
        enumIntegerWidth: (declaration) => host.enums.integerWidth(declaration) });
    const { input, semantics } = built;
    const effectiveTypes = analyzeSourceEffectiveTypes(services, createSourceTypeDescriptorUnions(host.ast, checked.programSourceFiles), input);
    return Object.freeze({ ...services, semantics, input, effectiveTypes,
        valueFacts: buildSourceValueModelFacts(services, checked.programSourceFiles, input) });
}
//# sourceMappingURL=type-flow-test-program.js.map