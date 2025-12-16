/**
 * Core emitter modules barrel exports
 */

export { defaultOptions } from "./options.js";
export { collectTypeParameters } from "./type-params.js";
export { processImports, resolveLocalImport } from "./imports.js";
export { emitExport } from "./exports.js";
export { emitModule } from "./module-emitter.js";
export { isAssignable, isIntegerType } from "./type-compatibility.js";
export { emitAttributes, emitParameterAttributes } from "./attributes.js";
