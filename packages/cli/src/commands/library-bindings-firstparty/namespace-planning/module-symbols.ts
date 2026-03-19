import type { IrModule } from "@tsonic/frontend";
import type { Result } from "../../../types.js";
import { collectModuleExports } from "../export-resolution.js";
import { normalizeModuleFileKey } from "../module-paths.js";
import {
  registerCrossNamespaceReexport,
  registerCrossNamespaceTypeDeclaration,
} from "../namespace-planning-helpers.js";
import type { ModuleContainerEntry } from "../types.js";
import type { NamespacePlanBuilder } from "./state.js";
import {
  registerFunctionExport,
  registerVariableExport,
} from "./value-exports.js";

export const collectModuleSymbols = (
  builder: NamespacePlanBuilder,
  module: IrModule
): Result<void, string> => {
  const moduleExports = collectModuleExports(module, builder.modulesByFileKey);
  if (!moduleExports.ok) return moduleExports;
  const containerMethods: ModuleContainerEntry["methods"] = [];
  const containerVariables: ModuleContainerEntry["variables"] = [];

  if (module.filePath.startsWith("__tsonic/")) {
    for (const statement of module.body) {
      if (statement.kind !== "classDeclaration") continue;
      if (!statement.name.startsWith("__Anon_")) continue;
      const key = `${statement.name}|class`;
      if (builder.seenTypeDeclarationKeys.has(key)) continue;
      builder.seenTypeDeclarationKeys.add(key);
      builder.typeDeclarations.push({
        exportName: statement.name,
        localName: statement.name,
        kind: "class",
        declaration: statement,
        declaringNamespace: module.namespace,
        declaringClassName: module.className,
        declaringFilePath: module.filePath,
      });
    }
  }

  for (const symbol of moduleExports.value) {
    if (
      symbol.kind === "class" ||
      symbol.kind === "interface" ||
      symbol.kind === "enum" ||
      symbol.kind === "typeAlias"
    ) {
      if (symbol.declaringNamespace !== builder.namespace) {
        registerCrossNamespaceReexport({
          namespace: builder.namespace,
          crossNamespaceReexportsGrouped:
            builder.crossNamespaceReexportsGrouped,
          declaringNamespace: symbol.declaringNamespace,
          exportName: symbol.exportName,
          localName: symbol.localName,
          kind:
            symbol.kind === "interface" || symbol.kind === "typeAlias"
              ? "type"
              : "value",
        });
        registerCrossNamespaceTypeDeclaration({
          namespace: builder.namespace,
          crossNamespaceTypeDeclarations:
            builder.crossNamespaceTypeDeclarations,
          seenCrossNamespaceTypeDeclarationKeys:
            builder.seenCrossNamespaceTypeDeclarationKeys,
          symbol,
        });
        continue;
      }
      if (
        symbol.kind === "typeAlias" &&
        symbol.declaration.kind === "typeAliasDeclaration" &&
        symbol.declaration.type.kind !== "objectType"
      ) {
        continue;
      }
      const key = `${symbol.declaringNamespace}|${symbol.declaringClassName}|${symbol.localName}|${symbol.kind}`;
      if (!builder.seenTypeDeclarationKeys.has(key)) {
        builder.seenTypeDeclarationKeys.add(key);
        builder.typeDeclarations.push(symbol);
      }
    }

    if (symbol.kind === "function") {
      if (symbol.declaringNamespace !== builder.namespace) {
        registerCrossNamespaceReexport({
          namespace: builder.namespace,
          crossNamespaceReexportsGrouped:
            builder.crossNamespaceReexportsGrouped,
          declaringNamespace: symbol.declaringNamespace,
          exportName: symbol.exportName,
          localName: symbol.localName,
          kind: "value",
        });
      }
      if (symbol.declaration.kind !== "functionDeclaration") continue;
      const symbolDeclarationModule = builder.modulesByFileKey.get(
        normalizeModuleFileKey(symbol.declaringFilePath)
      );
      if (!symbolDeclarationModule) {
        return {
          ok: false,
          error:
            `Unable to resolve declaring module for '${symbol.exportName}' while generating ${symbol.declaringFilePath}.\n` +
            "First-party bindings generation requires a stable source module for each exported value.",
        };
      }
      const registered = registerFunctionExport({
        builder,
        declarationModule: symbolDeclarationModule,
        declaringNamespace: symbol.declaringNamespace,
        declaringFilePath: symbol.declaringFilePath,
        localName: symbol.localName,
        exportName: symbol.exportName,
        functionDeclaration: symbol.declaration,
        containerMethods,
        containerModule: module,
      });
      if (!registered.ok) return registered;
      continue;
    }

    if (symbol.kind === "variable") {
      if (symbol.declaringNamespace !== builder.namespace) {
        registerCrossNamespaceReexport({
          namespace: builder.namespace,
          crossNamespaceReexportsGrouped:
            builder.crossNamespaceReexportsGrouped,
          declaringNamespace: symbol.declaringNamespace,
          exportName: symbol.exportName,
          localName: symbol.localName,
          kind: "value",
        });
      }
      if (symbol.declaration.kind !== "variableDeclaration") continue;
      const symbolDeclarationModule = builder.modulesByFileKey.get(
        normalizeModuleFileKey(symbol.declaringFilePath)
      );
      if (!symbolDeclarationModule) {
        return {
          ok: false,
          error:
            `Unable to resolve declaring module for '${symbol.exportName}' while generating ${symbol.declaringFilePath}.\n` +
            "First-party bindings generation requires a stable source module for each exported value.",
        };
      }
      const registered = registerVariableExport({
        builder,
        symbol,
        declarationModule: symbolDeclarationModule,
        declaration: symbol.declaration,
        containerVariables,
        containerModule: module,
      });
      if (!registered.ok) return registered;
    }
  }

  if (containerMethods.length > 0 || containerVariables.length > 0) {
    builder.moduleContainers.push({
      module,
      methods: containerMethods,
      variables: containerVariables,
    });
  }

  return { ok: true, value: undefined };
};
