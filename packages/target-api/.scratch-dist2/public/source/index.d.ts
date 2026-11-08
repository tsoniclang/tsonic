import type { AstReader, ReadonlySourceFactResolver, SourceFile } from "@tsonic/tsts";
import type { SourceProgramDocuments } from "../../source-semantics/documents-model.js";
import type { SourceProgramFacts } from "./facts.js";
export type * from "./facts.js";
export type * from "./selections.js";
export type * from "./roles.js";
export type * from "./objects.js";
export type * from "./analyses.js";
/**
 * What a target receives (TargetCompileInput.source). Built by createTargetSourceProgram from the Host program owner.
 * - `facts`: every Source answer (types, sums, relations, instantiations, selections, roles, objects, profile, refusals).
 * - `syntax`: the sanctioned authored-syntax reader, for emission of authored text, names and structure only.
 *   It must not be used to answer a Source type question.
 * - `sourceFacts`: the sanctioned source-core / provider extension fact protocol.
 * The checker services (`semantics`, SourceFinalTypeQueries, operation and declaration proxies), raw navigation and
 * `effectiveTypes` are Host-internal (HostSourceProgram) and not reachable from here.
 */
export interface TargetSourceProgramFacts {
    readonly facts: SourceProgramFacts;
    readonly documents: SourceProgramDocuments;
    readonly sourceFiles: readonly SourceFile[];
    readonly syntax: AstReader;
    readonly sourceFacts: ReadonlySourceFactResolver;
}
//# sourceMappingURL=index.d.ts.map