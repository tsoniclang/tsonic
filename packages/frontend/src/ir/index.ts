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
export { getTypeRegistry, getNominalEnv } from "./statement-converter.js";
