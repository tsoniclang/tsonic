import type {
  ExtensionImportBinding,
  ExtensionImportIndex,
} from "@tsonic/tsts";
import {
  CORE_LANG_MODULE_SPECIFIERS,
  CORE_TYPES_MODULE_SPECIFIERS,
} from "../source-frontend/core-module-identity.js";

export const coreTypesModules = CORE_TYPES_MODULE_SPECIFIERS;

export const coreLangModules = CORE_LANG_MODULE_SPECIFIERS;

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
