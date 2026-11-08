import type { CheckedSourceProgram, Node, SourceFile } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import type { SourceEnumConstantIndex } from "../source-semantics/enum-model.js";
import type { SourceFlowConditions } from "../source-semantics/value-flow-model.js";
import type { SourcePropertyNameIndex } from "../source-semantics/property-names-model.js";
import type { SourceProgramSemantics } from "./semantics-types.js";
export interface SourceSemanticsInputServices {
    readonly navigation: SourceProgramNavigation;
    /** The Host enum constant facts (source-semantics/enum-constants.ts); property names read enum member keys from them. */
    readonly enumConstants: SourceEnumConstantIndex;
}
/** The program's checker views plus the flow-condition witness translator. One instance per program (R4, I5). */
export interface SourceSemanticsInput {
    readonly semantics: SourceProgramSemantics;
    /** The checker's flow-condition witness at a reference, as a Node-only Host record (no retention applied). */
    flowConditions(reference: Node): SourceFlowConditions | undefined;
    /** The property-name facts of one checked file (checker-free records). */
    propertyNames(sourceFile: SourceFile): SourcePropertyNameIndex;
}
export declare function createSourceSemanticsInput(source: CheckedSourceProgram, services: SourceSemanticsInputServices): SourceSemanticsInput;
//# sourceMappingURL=semantics-program.d.ts.map