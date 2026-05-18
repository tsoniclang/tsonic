/**
 * Format/output modules — C# text generation and output assembly.
 */

export { defaultOptions } from "./options.js";
export { emitExport } from "./exports.js";
export { emitModule } from "./module-emitter.js";
export { emitAttributes, emitParameterAttributes } from "./attributes.js";
export {
  allocateLocalName,
  emitRemappedLocalName,
  registerLocalName,
} from "./local-names.js";
