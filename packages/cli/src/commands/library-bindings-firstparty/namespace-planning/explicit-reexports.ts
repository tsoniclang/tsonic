import type { IrModule } from "@tsonic/frontend";
import type { Result } from "../../../types.js";
import {
  classifyDeclarationKind,
  resolveExportedDeclaration,
} from "../export-resolution.js";
import {
  registerCrossNamespaceReexport,
  registerCrossNamespaceTypeDeclaration,
} from "../namespace-planning-helpers.js";
import {
  registerFunctionExport,
  registerVariableExport,
} from "./value-exports.js";
import type { NamespacePlanBuilder } from "./state.js";

export const collectExplicitReexports = (
  builder: NamespacePlanBuilder,
  module: IrModule
): Result<void, string> => {
  for (const exportItem of module.exports) {
    if (exportItem.kind !== "reexport") continue;
    const resolved = resolveExportedDeclaration(
      module,
      exportItem.name,
      builder.modulesByFileKey
    );
    if (!resolved.ok) return resolved;
    const declaration = resolved.value.declaration;
    const declarationModule = resolved.value.module;
    const exportKind = classifyDeclarationKind(
      declaration,
      declarationModule.filePath,
      exportItem.name
    );
    if (!exportKind.ok) return exportKind;
    if (declarationModule.namespace !== builder.namespace) {
      registerCrossNamespaceReexport({
        namespace: builder.namespace,
        crossNamespaceReexportsGrouped: builder.crossNamespaceReexportsGrouped,
        declaringNamespace: declarationModule.namespace,
        exportName: exportItem.name,
        localName: resolved.value.clrName,
        kind:
          exportKind.value === "interface" || exportKind.value === "typeAlias"
            ? "type"
            : "value",
      });
    }

    if (exportKind.value === "function") {
      if (declaration.kind !== "functionDeclaration") {
        return {
          ok: false,
          error: `Invalid function export '${exportItem.name}' in ${declarationModule.filePath}: expected function declaration.`,
        };
      }
      const registered = registerFunctionExport({
        builder,
        declarationModule,
        declaringNamespace: declarationModule.namespace,
        declaringFilePath: declarationModule.filePath,
        localName: resolved.value.clrName,
        exportName: exportItem.name,
        functionDeclaration: declaration,
      });
      if (!registered.ok) return registered;
      continue;
    }

    if (exportKind.value === "variable") {
      if (declaration.kind !== "variableDeclaration") {
        return {
          ok: false,
          error: `Invalid variable export '${exportItem.name}' in ${declarationModule.filePath}: expected variable declaration.`,
        };
      }
      const registered = registerVariableExport({
        builder,
        symbol: {
          exportName: exportItem.name,
          localName: resolved.value.clrName,
          declaringNamespace: declarationModule.namespace,
          declaringClassName: declarationModule.className,
          declaringFilePath: declarationModule.filePath,
        },
        declarationModule,
        declaration,
      });
      if (!registered.ok) return registered;
      continue;
    }

    if (
      exportKind.value === "class" ||
      exportKind.value === "interface" ||
      exportKind.value === "enum" ||
      exportKind.value === "typeAlias"
    ) {
      if (declarationModule.namespace !== builder.namespace) {
        registerCrossNamespaceTypeDeclaration({
          namespace: builder.namespace,
          crossNamespaceTypeDeclarations:
            builder.crossNamespaceTypeDeclarations,
          seenCrossNamespaceTypeDeclarationKeys:
            builder.seenCrossNamespaceTypeDeclarationKeys,
          symbol: {
            exportName: exportItem.name,
            localName: resolved.value.clrName,
            kind: exportKind.value,
            declaration,
            declaringNamespace: declarationModule.namespace,
            declaringClassName: declarationModule.className,
            declaringFilePath: declarationModule.filePath,
          },
        });
        continue;
      }
      if (
        exportKind.value === "typeAlias" &&
        declaration.kind === "typeAliasDeclaration" &&
        declaration.type.kind !== "objectType"
      ) {
        continue;
      }
      const typeKey = `${declarationModule.namespace}|${declarationModule.className}|${resolved.value.clrName}|${exportKind.value}`;
      if (builder.seenTypeDeclarationKeys.has(typeKey)) continue;
      builder.seenTypeDeclarationKeys.add(typeKey);
      builder.typeDeclarations.push({
        exportName: exportItem.name,
        localName: resolved.value.clrName,
        kind: exportKind.value,
        declaration,
        declaringNamespace: declarationModule.namespace,
        declaringClassName: declarationModule.className,
        declaringFilePath: declarationModule.filePath,
      });
    }
  }

  return { ok: true, value: undefined };
};
