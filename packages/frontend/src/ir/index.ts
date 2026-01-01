/**
 * IR module exports
 */

export * from "./types.js";
export {
  buildIr,
  buildIrModule,
  isExecutableStatement,
  type IrBuildOptions,
} from "./builder.js";
export {
  getTypeRegistry,
  getNominalEnv,
  clearTypeRegistries,
} from "./statement-converter.js";
export { createBinding, type Binding } from "./binding/index.js";
