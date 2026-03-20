import type { IrModule } from "@tsonic/frontend";
import type { Result } from "../../types.js";
import {
  isRelativeModuleSpecifier,
  resolveLocalModuleFile,
} from "./module-paths.js";
import {
  namespaceFacadeImportSpecifier,
  namespaceInternalImportSpecifier,
} from "./portable-types.js";
import type { SourceTypeImport, SourceTypeImportBinding } from "./types.js";

export const resolveSourceTypeImportBinding = (opts: {
  readonly context: "internal" | "facade";
  readonly currentNamespace: string;
  readonly currentModuleKey: string;
  readonly localName: string;
  readonly imported: SourceTypeImport;
  readonly modulesByFileKey: ReadonlyMap<string, IrModule>;
}): Result<SourceTypeImportBinding | undefined, string> => {
  const source = opts.imported.source.trim();
  if (source === "@tsonic/core/types.js") {
    return { ok: true, value: undefined };
  }

  if (!isRelativeModuleSpecifier(source)) {
    return {
      ok: true,
      value: {
        source,
        importedName: opts.imported.importedName,
        localName: opts.localName,
      },
    };
  }

  const targetModule = resolveLocalModuleFile(
    source,
    opts.currentModuleKey,
    opts.modulesByFileKey
  );
  if (!targetModule) {
    return {
      ok: false,
      error:
        `Unable to resolve source type import '${opts.localName}' from '${source}' in ${opts.currentModuleKey}.\n` +
        "First-party bindings generation requires public type dependencies to resolve deterministically.",
    };
  }

  if (targetModule.namespace === opts.currentNamespace) {
    return { ok: true, value: undefined };
  }

  return {
    ok: true,
    value: {
      source:
        opts.context === "internal"
          ? namespaceInternalImportSpecifier(
              opts.currentNamespace,
              targetModule.namespace
            )
          : namespaceFacadeImportSpecifier(
              opts.currentNamespace,
              targetModule.namespace
            ),
      importedName: opts.imported.importedName,
      localName: opts.localName,
    },
  };
};

export const registerSourceTypeImportBinding = (
  registry: Map<string, SourceTypeImportBinding>,
  binding: SourceTypeImportBinding,
  namespace: string,
  moduleFilePath: string
): Result<void, string> => {
  const existing = registry.get(binding.localName);
  if (existing) {
    if (
      existing.source !== binding.source ||
      existing.importedName !== binding.importedName
    ) {
      return {
        ok: false,
        error:
          `Conflicting source type import alias '${binding.localName}' while generating namespace ${namespace} from ${moduleFilePath}.\n` +
          `- ${existing.importedName} from '${existing.source}'\n` +
          `- ${binding.importedName} from '${binding.source}'\n` +
          "Disambiguate source type imports so generated bindings remain deterministic.",
      };
    }
    return { ok: true, value: undefined };
  }
  registry.set(binding.localName, binding);
  return { ok: true, value: undefined };
};
