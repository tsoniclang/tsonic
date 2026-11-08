// @tsonic/target-api/host: Host-internal entry for Host packages (source-core, target-analysis, host).
// Targets must not import it (I2): it exposes the Host-internal HostSourceProgram (no checker service, I3).
// The composition factories (K-2668): both take the checked program (checker-typed), so they live on this Host-only
// entry. createTargetSourceProgram builds what a target receives; createHostSourceProgram the Host-internal owner.
export { createHostSourceProgram, createTargetSourceProgram } from "../source-semantics/target-source-program.js";
// The navigation input translator: Host packages and tests build navigation as
// createSourceProgramNavigation(createSourceNavigationInput(checked)).
export { createSourceNavigationInput } from "../host-input/navigation.js";
export * from "../source-semantics/index.js";
export * from "../source-navigation/index.js";
// Host analyses (B2): the analyses-group producer and the extension protocol for Host extension packages (source-core).
export { createSourceAnalysisFacts, createSourceAnalysisKey, hostSourceProgramOfAnalysisHost } from "../target-analysis/source-analyses.js";
// The program a published storage query was built over (the public record names none, R2/R8); Host packages only.
export { sourceStorageQueriesProgram } from "../target-analysis/source-storage/queries.js";
// The Host value descriptor of a value node, or undefined when the Host refused it (FX-CORE X1); Host packages only.
export { sourceAnalysisValueType } from "../target-analysis/analysis-program.js";
//# sourceMappingURL=host.js.map