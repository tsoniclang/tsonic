import {
  createSourceSemanticsExtension,
} from "@tsonic/tsts";
import type {
  CompilerExtension,
} from "@tsonic/tsts";
import {
  tsonicCoreProviderVersion,
  tsonicCoreSourceExtensionId,
} from "./identity.js";
import {
  tsonicCoreSourceSemanticsModules,
} from "./source-modules.js";
import {
  createTsonicCoreVirtualModulesProvider,
} from "./virtual-modules.js";

export function createTsonicCoreSourceExtension(): CompilerExtension {
  const sourceSemantics = createSourceSemanticsExtension({
    identity: {
      id: tsonicCoreSourceExtensionId,
      version: tsonicCoreProviderVersion,
      capabilityNamespace: "tsonic.source-core",
    },
    modules: tsonicCoreSourceSemanticsModules(),
  });
  return {
    ...sourceSemantics,
    initialize(context): void {
      context.registerTargetBindingProvider(createTsonicCoreVirtualModulesProvider());
      sourceSemantics.initialize?.(context);
    },
  };
}
