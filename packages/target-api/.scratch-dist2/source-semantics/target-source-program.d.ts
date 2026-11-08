import type { CheckedSourceProgram } from "@tsonic/tsts";
import { type SourceHostInput } from "../host-input/index.js";
import type { SourceProgramSemantics } from "../host-input/semantics-types.js";
import { type SourceJsApiFactsFactory } from "../public/source/assembly.js";
import type { TargetSourceProgramFacts } from "../public/source/index.js";
import type { SourceAnalysisExtension } from "../public/source/analyses.js";
import type { HostSourceProgram } from "./types.js";
import type { SourcePlatformFacts } from "./platform-model.js";
export interface TargetSourceProgramOptions {
    /** The JS API profile builder (js-source-profile createJsSourceApiFacts), supplied by the composition root. */
    readonly profile: SourceJsApiFactsFactory;
    /** Host extension analyses (source-core), published as facts.analyses.extension(key); supplied by the composition root. */
    readonly analyses?: readonly SourceAnalysisExtension<unknown>[];
    /**
     * The active target/toolchain ABI premise for native-int / native-uint (E24, N5): known 32 / 64, missing or
     * conflicting. The composition root passes the selected target's own premise for the compilation being built; it is
     * never the coordinating machine's width. Published unchanged as facts.analyses.platform.
     */
    readonly platform: SourcePlatformFacts;
}
/** The target-facing program: published facts, documents, the authored-syntax reader and the extension facts only (I1). */
export declare function createTargetSourceProgram(source: CheckedSourceProgram, options: TargetSourceProgramOptions): TargetSourceProgramFacts;
/** The Host-internal program owner. Every per-program table (inputs, value model, roles, objects) lives here (I5). */
export declare function createHostSourceProgram(source: CheckedSourceProgram, options: TargetSourceProgramOptions): HostSourceProgram;
/**
 * The Host program plus its host-input instances. Host-internal: createHostSourceProgram keeps only `program`; the
 * test fixtures (host-program-fixtures.ts) also expose the checker views and the host-input adapter to host-input tests.
 * Every input is built exactly once per program and shared (R4): one navigation input, one checker semantics input,
 * one SourceHostInput (value model and object witnesses), one value model.
 */
export declare function buildHostSourceProgram(source: CheckedSourceProgram, options: TargetSourceProgramOptions): {
    readonly program: HostSourceProgram;
    readonly semantics: SourceProgramSemantics;
    readonly input: SourceHostInput;
};
//# sourceMappingURL=target-source-program.d.ts.map