import type { IrModule } from "@tsonic/frontend";
import * as ts from "typescript";
import type { Result } from "../../../types.js";
import {
  normalizeModuleFileKey,
  resolveLocalModuleFile,
} from "../module-paths.js";
import type {
  ModuleSourceIndex,
  SourceTypeAliasDef,
  WrapperImport,
} from "../types.js";
import { unwrapParens } from "./type-helpers.js";

export const collectExtensionWrapperImportsFromSourceType = (opts: {
  readonly startModuleKey: string;
  readonly typeNode: ts.TypeNode;
  readonly sourceIndexByFileKey: ReadonlyMap<string, ModuleSourceIndex>;
  readonly modulesByFileKey: ReadonlyMap<string, IrModule>;
}): Result<readonly WrapperImport[], string> => {
  const wrappers: WrapperImport[] = [];

  let currentModuleKey = opts.startModuleKey;
  let currentNode: ts.TypeNode = opts.typeNode;
  let subst = new Map<string, ts.TypeNode>();
  const aliasStack: string[] = [];

  while (true) {
    currentNode = unwrapParens(currentNode);
    if (!ts.isTypeReferenceNode(currentNode)) break;
    if (!ts.isIdentifier(currentNode.typeName)) break;

    const ident = currentNode.typeName.text;
    const info = opts.sourceIndexByFileKey.get(currentModuleKey);
    if (!info) break;

    const substituted = subst.get(ident);
    if (substituted) {
      currentNode = substituted;
      continue;
    }

    const expandAlias = (
      aliasKey: string,
      alias: SourceTypeAliasDef,
      typeArgs: readonly ts.TypeNode[]
    ): void => {
      if (aliasStack.includes(aliasKey)) return;
      aliasStack.push(aliasKey);

      if (alias.typeParameterNames.length === typeArgs.length) {
        const next = new Map(subst);
        for (let i = 0; i < alias.typeParameterNames.length; i += 1) {
          const paramName = alias.typeParameterNames[i];
          const arg = typeArgs[i];
          if (!paramName || !arg) continue;
          next.set(paramName, arg);
        }
        subst = next;
      }

      currentNode = alias.type;
    };

    const localAlias = info.typeAliasesByName.get(ident);
    if (localAlias) {
      expandAlias(
        `${currentModuleKey}:${ident}`,
        localAlias,
        currentNode.typeArguments ?? []
      );
      continue;
    }

    const imported = info.typeImportsByLocalName.get(ident);
    if (
      imported &&
      (imported.source.startsWith(".") || imported.source.startsWith("/"))
    ) {
      const targetModule = resolveLocalModuleFile(
        imported.source,
        currentModuleKey,
        opts.modulesByFileKey
      );
      if (targetModule) {
        const targetKey = normalizeModuleFileKey(targetModule.filePath);
        const targetInfo = opts.sourceIndexByFileKey.get(targetKey);
        const targetAlias = targetInfo?.typeAliasesByName.get(
          imported.importedName
        );
        if (targetAlias) {
          currentModuleKey = targetKey;
          expandAlias(
            `${targetKey}:${imported.importedName}`,
            targetAlias,
            currentNode.typeArguments ?? []
          );
          continue;
        }
      }
    }

    const wrapperImport = info.wrapperImportsByLocalName.get(ident);
    if (!wrapperImport) break;
    const args = currentNode.typeArguments ?? [];
    if (args.length !== 1) {
      return {
        ok: false,
        error:
          `ExtensionMethods wrapper '${ident}' must have exactly 1 type argument.\n` +
          `Found: ${args.length} in ${currentModuleKey}.`,
      };
    }

    wrappers.push({
      source: wrapperImport.source,
      importedName: wrapperImport.importedName,
      localName: ident,
      aliasName: `__TsonicExt_${ident}`,
    });

    const nextNode = args[0];
    if (!nextNode) {
      return {
        ok: false,
        error: `ExtensionMethods wrapper '${ident}' is missing its type argument in ${currentModuleKey}.`,
      };
    }
    currentNode = nextNode;
  }

  return { ok: true, value: wrappers };
};
