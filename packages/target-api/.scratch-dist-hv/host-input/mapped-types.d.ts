import type { AstReader, Node, Type } from "@tsonic/tsts";
import type { SourceFileSemantics } from "./semantics-types.js";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
/** The syntax services the homomorphic-input translation reads (authored references through the reference index). */
export interface SourceHomomorphicInputSource {
    readonly ast: AstReader;
    readonly navigation: Pick<SourceProgramNavigation, "sourceReferenceFor">;
}
export declare function sourceTypeFlowHomomorphicInput(source: SourceHomomorphicInputSource, queries: SourceFileSemantics, type: Type, authoredTypeNode?: Node): Type | undefined;
//# sourceMappingURL=mapped-types.d.ts.map