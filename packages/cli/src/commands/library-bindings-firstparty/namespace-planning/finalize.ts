import {
  collectAnonymousHelperClassNamesByShape,
  collectAnonymousMemberOverrides,
} from "../namespace-planning-helpers.js";
import { finalizeCrossNamespaceReexports } from "../export-resolution.js";
import type { Result } from "../../../types.js";
import type { NamespacePlan } from "../types.js";
import type { NamespacePlanBuilder } from "./state.js";

export const finalizeNamespacePlan = (
  builder: NamespacePlanBuilder
): Result<NamespacePlan, string> => {
  const anonymousHelperClassNamesByShape =
    collectAnonymousHelperClassNamesByShape({
      typeDeclarations: builder.typeDeclarations,
      internalHelperTypeDeclarationsByKey:
        builder.internalHelperTypeDeclarationsByKey,
    });
  const anonymousMemberOverrides = collectAnonymousMemberOverrides({
    anonymousHelperClassNamesByShape,
    sourceIndexByFileKey: builder.sourceIndexByFileKey,
    modulesByFileKey: builder.modulesByFileKey,
    wrapperImportByAlias: builder.wrapperImportByAlias,
  });
  if (!anonymousMemberOverrides.ok) return anonymousMemberOverrides;
  builder.memberOverrides.push(...anonymousMemberOverrides.value);

  return {
    ok: true,
    value: {
      namespace: builder.namespace,
      typeDeclarations: builder.typeDeclarations.sort((left, right) =>
        left.exportName.localeCompare(right.exportName)
      ),
      internalHelperTypeDeclarations: Array.from(
        builder.internalHelperTypeDeclarationsByKey.values()
      ).sort((left, right) => left.key.localeCompare(right.key)),
      moduleContainers: builder.moduleContainers.sort((left, right) =>
        left.module.className.localeCompare(right.module.className)
      ),
      crossNamespaceReexports: finalizeCrossNamespaceReexports(
        builder.crossNamespaceReexportsGrouped
      ),
      crossNamespaceTypeDeclarations: builder.crossNamespaceTypeDeclarations.sort(
        (left, right) => {
          const leftKey = `${left.exportName}|${left.declaringNamespace}|${left.localName}|${left.kind}`;
          const rightKey = `${right.exportName}|${right.declaringNamespace}|${right.localName}|${right.kind}`;
          return leftKey.localeCompare(rightKey);
        }
      ),
      sourceAliases: builder.sourceAliasPlans.sort((left, right) =>
        left.declaration.name.localeCompare(right.declaration.name)
      ),
      memberOverrides: builder.memberOverrides.sort((left, right) => {
        const classCmp = left.className.localeCompare(right.className);
        if (classCmp !== 0) return classCmp;
        return left.memberName.localeCompare(right.memberName);
      }),
      internalTypeImports: Array.from(
        builder.internalTypeImportByAlias.values()
      ).sort((left, right) => left.localName.localeCompare(right.localName)),
      facadeTypeImports: Array.from(
        builder.facadeTypeImportByAlias.values()
      ).sort((left, right) => left.localName.localeCompare(right.localName)),
      wrapperImports: Array.from(builder.wrapperImportByAlias.values()).sort(
        (left, right) => left.aliasName.localeCompare(right.aliasName)
      ),
      valueExports: Array.from(builder.valueExportsMap.values()).sort(
        (left, right) => left.exportName.localeCompare(right.exportName)
      ),
    },
  };
};
