import type { IrModule } from "@tsonic/frontend";
import type { Result } from "../../../types.js";
import { normalizeModuleFileKey } from "../module-paths.js";
import type { ModuleSourceIndex, NamespacePlan } from "../types.js";
import { collectExplicitReexports } from "./explicit-reexports.js";
import { finalizeNamespacePlan } from "./finalize.js";
import { collectModuleSymbols } from "./module-symbols.js";
import { collectModuleSourceMetadata } from "./source-metadata.js";
import { createNamespacePlanBuilder } from "./state.js";

export const collectNamespacePlans = (
  modules: readonly IrModule[],
  assemblyName: string,
  rootNamespace: string,
  sourceIndexByFileKey: ReadonlyMap<string, ModuleSourceIndex>
): Result<readonly NamespacePlan[], string> => {
  const modulesByNamespace = new Map<string, IrModule[]>();
  modulesByNamespace.set(rootNamespace, []);
  const modulesByFileKey = new Map<string, IrModule>();
  for (const module of modules) {
    const syntheticAnonymousModule =
      module.filePath.startsWith("__tsonic/") &&
      module.body.some(
        (statement) =>
          statement.kind === "classDeclaration" &&
          statement.name.startsWith("__Anon_")
      );
    if (module.filePath.startsWith("__tsonic/") && !syntheticAnonymousModule) {
      continue;
    }
    const list = modulesByNamespace.get(module.namespace) ?? [];
    list.push(module);
    modulesByNamespace.set(module.namespace, list);
    modulesByFileKey.set(normalizeModuleFileKey(module.filePath), module);
  }

  const plans: NamespacePlan[] = [];
  for (const [namespace, moduleList] of Array.from(
    modulesByNamespace.entries()
  )) {
    const builder = createNamespacePlanBuilder({
      namespace,
      assemblyName,
      sourceIndexByFileKey,
      modulesByFileKey,
    });

    for (const module of moduleList.sort((left, right) =>
      left.filePath.localeCompare(right.filePath)
    )) {
      const sourceMetadata = collectModuleSourceMetadata(builder, module);
      if (!sourceMetadata.ok) return sourceMetadata;

      const explicitReexports = collectExplicitReexports(builder, module);
      if (!explicitReexports.ok) return explicitReexports;

      const moduleSymbols = collectModuleSymbols(builder, module);
      if (!moduleSymbols.ok) return moduleSymbols;
    }

    const finalized = finalizeNamespacePlan(builder);
    if (!finalized.ok) return finalized;
    plans.push(finalized.value);
  }

  return {
    ok: true,
    value: plans.sort((left, right) =>
      left.namespace.localeCompare(right.namespace)
    ),
  };
};
