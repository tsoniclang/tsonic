import type {
  ExtensionImportBinding,
  ExtensionImportIndex,
} from "@tsonic/tsts";

export const coreTypesModules: ReadonlySet<string> = new Set([
  "@tsonic/core/types.js",
  "@tsonic/core/types",
]);

export const coreLangModules: ReadonlySet<string> = new Set([
  "@tsonic/core/lang.js",
  "@tsonic/core/lang",
]);

export const collectImportedNamesByLocalName = (
  imports: ExtensionImportIndex,
  modules: ReadonlySet<string>
): ReadonlyMap<string, ExtensionImportBinding> => {
  const bindings = new Map<string, ExtensionImportBinding>();
  for (const module of imports.modules) {
    if (!modules.has(module.specifier)) continue;
    for (const binding of module.bindings) {
      if (binding.kind !== "named") continue;
      bindings.set(binding.localName, binding);
    }
  }
  return bindings;
};
