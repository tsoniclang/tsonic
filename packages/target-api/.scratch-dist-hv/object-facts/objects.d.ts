import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { SourceRefusal, SourceValueFacts } from "../public/source/facts.js";
import type { SourceObjectFacts } from "../public/source/objects.js";
import type { SourceSelectionFacts } from "../public/source/selections.js";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import type { SourceMemberKey, SourceTypeDescriptor } from "../source-semantics/local-type-flow/types.js";
export interface SourceObjectFactsInput {
    readonly ast: AstReader;
    /** The program files whose declarations the eager refusal census reads (R5). */
    readonly sourceFiles: readonly SourceFile[];
    readonly navigation: SourceProgramNavigation;
    readonly values: SourceValueFacts;
    readonly selections: SourceSelectionFacts;
    /** The sole substitution (SourceSumFacts.substitute, I6): heritage defaults over earlier bindings. */
    readonly substitute: (type: SourceTypeDescriptor, bindings: ReadonlyMap<Node, SourceTypeDescriptor>) => SourceTypeDescriptor;
    /** The one union builder (SourceSumFacts.join, I6): a joined member's read type over the arms. */
    readonly join: (components: readonly SourceTypeDescriptor[]) => SourceTypeDescriptor | undefined;
}
export declare function createSourceObjectFacts(input: SourceObjectFactsInput): SourceObjectFacts & {
    refusals(): readonly SourceRefusal[];
};
export declare function memberKeysEqual(left: SourceMemberKey, right: SourceMemberKey): boolean;
//# sourceMappingURL=objects.d.ts.map