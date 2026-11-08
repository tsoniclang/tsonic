import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { SourceRefusal } from "../public/source/facts.js";
import type { SourceJsApiFacts } from "../public/source/objects.js";
import type { SourceSelectionFacts } from "../public/source/selections.js";
export interface SourceSelectionRefusalInput {
    readonly ast: AstReader;
    readonly sourceFiles: readonly SourceFile[];
    readonly selections: SourceSelectionFacts & {
        refusals(): readonly SourceRefusal[];
        iterationProtocolRefusal(site: Node): SourceRefusal | undefined;
    };
    readonly profile: SourceJsApiFacts;
}
/** Every selection refusal of the program, in source order of first request, computed once. */
export declare function createSourceSelectionRefusals(input: SourceSelectionRefusalInput): () => readonly SourceRefusal[];
//# sourceMappingURL=selection-refusals.d.ts.map