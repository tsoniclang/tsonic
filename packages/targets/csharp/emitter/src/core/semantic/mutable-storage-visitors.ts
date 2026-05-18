import { IrModule } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import {
  type MutableStorageAnalysis,
  buildClassMap,
  buildInterfaceMap,
  collectTopLevelConstBindings,
} from "./mutable-storage-detection.js";
import { visitStatement } from "./mutable-storage-statement-visitor.js";

export const analyzeMutableStorage = (
  module: IrModule,
  context: EmitterContext
): MutableStorageAnalysis => {
  const classes = buildClassMap(module);
  const interfaces = buildInterfaceMap(module);
  const topLevelConstBindings = collectTopLevelConstBindings(module);
  const mutableModuleBindings = new Set<string>();
  const mutablePropertySlots = new Set<string>();

  for (const stmt of module.body) {
    visitStatement(
      stmt,
      context,
      classes,
      interfaces,
      topLevelConstBindings,
      mutableModuleBindings,
      mutablePropertySlots,
      []
    );
  }

  return {
    mutableModuleBindings,
    mutablePropertySlots,
  };
};
