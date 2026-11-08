import type { Node } from "@tsonic/tsts";
import type { SourceAnalysisExtension, SourceAnalysisFacts, SourceAnalysisHost, SourceAnalysisKey } from "../public/source/analyses.js";
import type { SourceCallSignatureParameter } from "../public/source/selections.js";
import type { HostSourceProgram } from "../source-semantics/types.js";
import type { SourcePlatformFacts } from "../source-semantics/platform-model.js";
/** Host-internal: open the opaque handle an extension factory receives. Exported only from `@tsonic/target-api/host`. */
export declare function hostSourceProgramOfAnalysisHost(host: SourceAnalysisHost): HostSourceProgram;
/** A typed extension analysis key (source-core and other Host extension packages declare one per analysis group). */
export declare function createSourceAnalysisKey<T>(id: string): SourceAnalysisKey<T>;
/**
 * Build the analyses group. `owner` returns the Host program once it is assembled; members are only called after that
 * (the facts object is published together with the program), so every member reads the finished program.
 */
export declare function createSourceAnalysisFacts(owner: () => HostSourceProgram, extensions: readonly SourceAnalysisExtension<unknown>[], platform: SourcePlatformFacts, 
/** The selection owner's signature slots (object-facts/selections.ts): one translation with the call selections. */
signatureParameters: (signature: Node) => readonly SourceCallSignatureParameter[] | undefined): SourceAnalysisFacts;
//# sourceMappingURL=source-analyses.d.ts.map