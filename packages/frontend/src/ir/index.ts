/**
 * IR module exports
 *
 * IR public API.
 * Each compilation creates a fresh ProgramContext via buildIr().
 */

export * from "./types.js";
export {
  getClrIdentityKey,
  referenceTypeIdentity,
  referenceTypeHasClrIdentity,
} from "./types/index.js";
export {
  buildIr,
  buildIrModule,
  isExecutableStatement,
  type IrBuildOptions,
} from "./builder.js";
export { createBinding, type Binding } from "./binding/index.js";
export {
  createProgramContext,
  type ProgramContext,
} from "./program-context.js";
export {
  selectUnionArm,
  type UnionArmSelectionInput,
} from "./converters/union-arm-selection.js";
export { createIfBranchPlans } from "./converters/statements/control/if-branch-plan.js";
