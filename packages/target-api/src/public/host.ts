// @tsonic/target-api/host: Host-internal entry for Host packages (source-core, target-analysis, host).
// Targets must not import it (I2): it exposes the Host-internal HostSourceProgram (no checker service, I3).
export { createHostSourceProgram } from "../source-semantics/target-source-program.js";
// The navigation input translator: Host packages and tests build navigation as
// createSourceProgramNavigation(createSourceNavigationInput(checked)).
export { createSourceNavigationInput } from "../host-input/navigation.js";
export type { SourceNavigationInput } from "../host-input/navigation.js";
export type { HostSourceProgram } from "../source-semantics/types.js";
export type * from "../source-semantics/index.js";
export * from "../source-semantics/index.js";
export * from "../source-navigation/index.js";
// Host analyses (B2): the analyses-group producer and the extension protocol for Host extension packages (source-core).
export { createSourceAnalysisFacts, createSourceAnalysisKey, hostSourceProgramOfAnalysisHost }
  from "../target-analysis/source-analyses.js";
