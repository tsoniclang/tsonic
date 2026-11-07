export { createTsonicCoreSourceExtension } from "../extension/source-extension.js";
/** Composition root: register with createTargetSourceProgram(source, { analyses: [tsonicCoreSourceAnalyses] }). */
export { tsonicCoreSourceAnalyses } from "../analysis/host-analyses.js";
export { tsonicCoreSourceSemanticsModules } from "../extension/source-modules.js";
export type { TsonicCoreSourceExtensionOptions } from "../extension/source-extension.js";
export type { TsonicDataLayoutRegistration } from "@tsonic/target-api/provider";
