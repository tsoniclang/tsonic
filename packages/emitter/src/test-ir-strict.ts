import {
  createIfBranchPlans,
  assumeEmittableIrModule as assumeFrontendEmittableIrModule,
  type EmittableIrModule,
  type IrIfStatement,
  type IrModule,
} from "@tsonic/frontend";
import { emitModule as emitStrictModule } from "./emitter.js";
import type { EmitterOptions } from "./types.js";

export type TestIrModule = IrModule;

export const assumeEmittableIrModule = (
  module: TestIrModule
): EmittableIrModule => assumeFrontendEmittableIrModule(module);

export const emitModule = (
  module: TestIrModule,
  options: Partial<EmitterOptions> = {}
): string => emitStrictModule(module, options);

export const testIfStatement = (
  statement: Omit<IrIfStatement, "thenPlan" | "elsePlan">
): IrIfStatement => ({
  ...statement,
  ...createIfBranchPlans(statement.condition),
});
