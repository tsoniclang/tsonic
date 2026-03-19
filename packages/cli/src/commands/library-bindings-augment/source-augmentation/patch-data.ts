import * as ts from "typescript";
import type { Result } from "../../../types.js";
import type { SourceFunctionSignatureSurface as SourceFunctionSignatureDef } from "../../../aikya/source-function-surfaces.js";
import { collectSourceTypeImportsForSignature } from "../facade-patches.js";
import { collectExtensionWrapperImportsFromSourceType } from "../source-modules.js";
import {
  getPropertyNameText,
  printTypeNodeText,
  typeNodeUsesImportedTypeNames,
  unwrapParens,
} from "../shared.js";
import type {
  FacadeInfo,
  MemberOverride,
  ModuleSourceIndex,
  SourceModuleInfo,
  SourceTypeImportBinding,
} from "../types.js";

export type CollectedAugmentationData = {
  readonly overridesByInternalIndex: ReadonlyMap<
    string,
    readonly MemberOverride[]
  >;
  readonly brandOptionalTypesByInternalIndex: ReadonlyMap<
    string,
    ReadonlySet<string>
  >;
  readonly functionSignaturesByFacade: ReadonlyMap<
    string,
    ReadonlyMap<string, readonly SourceFunctionSignatureDef[]>
  >;
  readonly sourceTypeImportsByFacade: ReadonlyMap<
    string,
    ReadonlyMap<string, SourceTypeImportBinding>
  >;
};

export const collectAugmentationData = (opts: {
  readonly sourceModulesByFile: ReadonlyMap<string, SourceModuleInfo>;
  readonly sourceIndexByFileKey: ReadonlyMap<string, ModuleSourceIndex>;
  readonly facadesByNamespace: ReadonlyMap<string, FacadeInfo>;
}): Result<CollectedAugmentationData, string> => {
  const overridesByInternalIndex = new Map<string, MemberOverride[]>();
  const brandOptionalTypesByInternalIndex = new Map<string, Set<string>>();
  const functionSignaturesByFacade = new Map<
    string,
    Map<string, SourceFunctionSignatureDef[]>
  >();
  const sourceTypeImportsByFacade = new Map<
    string,
    Map<string, SourceTypeImportBinding>
  >();

  for (const sourceModule of opts.sourceModulesByFile.values()) {
    const sourceIndex = sourceModule.sourceIndex;
    const hasExportedSourceFunctions =
      sourceIndex.exportedFunctionSignaturesByName.size > 0;
    if (
      sourceModule.exportedClassNames.length === 0 &&
      sourceModule.exportedInterfaceNames.length === 0 &&
      sourceModule.exportedTypeAliasNames.length === 0 &&
      sourceModule.allInterfaceNames.length === 0 &&
      sourceModule.allTypeAliasNames.length === 0 &&
      !hasExportedSourceFunctions
    ) {
      continue;
    }

    const info = opts.facadesByNamespace.get(sourceModule.namespace);
    if (!info) {
      return {
        ok: false,
        error: `Missing facade registration for namespace ${sourceModule.namespace}.`,
      };
    }

    const brandTargets =
      brandOptionalTypesByInternalIndex.get(info.internalIndexDtsPath) ??
      new Set<string>();
    for (const ifaceName of sourceModule.allInterfaceNames) {
      brandTargets.add(ifaceName);
    }
    for (const aliasName of sourceModule.allTypeAliasNames) {
      const sourceAlias = sourceIndex.typeAliasesByName.get(aliasName);
      if (!sourceAlias) continue;
      const aliasType = unwrapParens(sourceAlias.type);
      if (!ts.isTypeLiteralNode(aliasType)) continue;
      const arity = sourceAlias.typeParameters.length;
      const internalAliasName = `${aliasName}__Alias${arity > 0 ? `_${arity}` : ""}`;
      brandTargets.add(aliasName);
      brandTargets.add(internalAliasName);
    }
    if (brandTargets.size > 0) {
      brandOptionalTypesByInternalIndex.set(
        info.internalIndexDtsPath,
        brandTargets
      );
    }

    for (const [
      name,
      signatures,
    ] of sourceIndex.exportedFunctionSignaturesByName) {
      if (signatures.length === 0) continue;
      const byName =
        functionSignaturesByFacade.get(info.facadeDtsPath) ??
        new Map<string, SourceFunctionSignatureDef[]>();
      const list = byName.get(name) ?? [];
      list.push(...signatures);
      byName.set(name, list);
      functionSignaturesByFacade.set(info.facadeDtsPath, byName);

      const importsByLocal =
        sourceTypeImportsByFacade.get(info.facadeDtsPath) ??
        new Map<string, SourceTypeImportBinding>();
      for (const signature of signatures) {
        for (const binding of collectSourceTypeImportsForSignature(
          signature,
          sourceIndex.typeImportsByLocalName
        )) {
          const existing = importsByLocal.get(binding.localName);
          if (existing) {
            if (
              existing.source !== binding.source ||
              existing.importedName !== binding.importedName
            ) {
              return {
                ok: false,
                error:
                  `Conflicting source type import alias '${binding.localName}' while augmenting ${info.facadeDtsPath}.\n` +
                  `- ${existing.importedName} from '${existing.source}'\n` +
                  `- ${binding.importedName} from '${binding.source}'\n` +
                  "Fix: disambiguate source type imports for exported function signatures.",
              };
            }
            continue;
          }
          importsByLocal.set(binding.localName, binding);
        }
      }
      sourceTypeImportsByFacade.set(info.facadeDtsPath, importsByLocal);
    }

    const pushMemberOverride = (
      className: string,
      memberName: string,
      sourceTypeText: string | undefined,
      replaceWithSourceType: boolean,
      isOptional: boolean,
      wrappers: MemberOverride["wrappers"],
      emitOptionalPropertySyntax = false
    ): void => {
      const list =
        overridesByInternalIndex.get(info.internalIndexDtsPath) ?? [];
      list.push({
        namespace: sourceModule.namespace,
        className,
        memberName,
        sourceTypeText,
        replaceWithSourceType,
        isOptional,
        emitOptionalPropertySyntax,
        wrappers,
      });
      overridesByInternalIndex.set(info.internalIndexDtsPath, list);
    };

    for (const className of sourceModule.exportedClassNames) {
      const memberTypes =
        sourceIndex.memberTypesByClassAndMember.get(className);
      if (!memberTypes) continue;

      for (const [memberName, sourceMember] of memberTypes) {
        const wrappersResult = collectExtensionWrapperImportsFromSourceType({
          startModuleKey: sourceModule.fileKey,
          typeNode: sourceMember.typeNode,
          sourceIndexByFileKey: opts.sourceIndexByFileKey,
          sourceModulesByFileKey: opts.sourceModulesByFile,
        });
        if (!wrappersResult.ok) return wrappersResult;
        const wrappers = wrappersResult.value;
        const canUseSourceTypeText = !typeNodeUsesImportedTypeNames(
          sourceMember.typeNode,
          sourceIndex.typeImportsByLocalName
        );
        if (
          !canUseSourceTypeText &&
          wrappers.length === 0 &&
          !sourceMember.isOptional
        ) {
          continue;
        }

        pushMemberOverride(
          className,
          memberName,
          canUseSourceTypeText ? sourceMember.typeText : undefined,
          canUseSourceTypeText,
          sourceMember.isOptional,
          wrappers
        );
      }
    }

    for (const interfaceName of sourceModule.exportedInterfaceNames) {
      const memberTypes =
        sourceIndex.memberTypesByClassAndMember.get(interfaceName);
      if (!memberTypes) continue;

      for (const [memberName, sourceMember] of memberTypes) {
        const wrappersResult = collectExtensionWrapperImportsFromSourceType({
          startModuleKey: sourceModule.fileKey,
          typeNode: sourceMember.typeNode,
          sourceIndexByFileKey: opts.sourceIndexByFileKey,
          sourceModulesByFileKey: opts.sourceModulesByFile,
        });
        if (!wrappersResult.ok) return wrappersResult;
        const wrappers = wrappersResult.value;
        const canUseSourceTypeText = !typeNodeUsesImportedTypeNames(
          sourceMember.typeNode,
          sourceIndex.typeImportsByLocalName
        );
        if (!canUseSourceTypeText && wrappers.length === 0) continue;

        pushMemberOverride(
          interfaceName,
          memberName,
          canUseSourceTypeText ? sourceMember.typeText : undefined,
          canUseSourceTypeText,
          sourceMember.isOptional,
          wrappers,
          true
        );
      }
    }

    for (const aliasName of sourceModule.exportedTypeAliasNames) {
      const sourceAlias = sourceIndex.typeAliasesByName.get(aliasName);
      if (!sourceAlias) continue;
      const aliasType = unwrapParens(sourceAlias.type);
      if (!ts.isTypeLiteralNode(aliasType)) continue;
      const arity = sourceAlias.typeParameters.length;
      const internalAliasName = `${aliasName}__Alias${arity > 0 ? `_${arity}` : ""}`;

      for (const member of aliasType.members) {
        if (!ts.isPropertySignature(member)) continue;
        if (!member.name || !member.type) continue;
        const memberName = getPropertyNameText(member.name);
        if (!memberName) continue;

        const wrappersResult = collectExtensionWrapperImportsFromSourceType({
          startModuleKey: sourceModule.fileKey,
          typeNode: member.type,
          sourceIndexByFileKey: opts.sourceIndexByFileKey,
          sourceModulesByFileKey: opts.sourceModulesByFile,
        });
        if (!wrappersResult.ok) return wrappersResult;
        const wrappers = wrappersResult.value;

        const canUseSourceTypeText = !typeNodeUsesImportedTypeNames(
          member.type,
          sourceIndex.typeImportsByLocalName
        );
        if (!canUseSourceTypeText && wrappers.length === 0) continue;

        pushMemberOverride(
          internalAliasName,
          memberName,
          canUseSourceTypeText
            ? printTypeNodeText(member.type, member.getSourceFile())
            : undefined,
          canUseSourceTypeText,
          member.questionToken !== undefined,
          wrappers
        );
      }
    }
  }

  return {
    ok: true,
    value: {
      overridesByInternalIndex,
      brandOptionalTypesByInternalIndex,
      functionSignaturesByFacade,
      sourceTypeImportsByFacade,
    },
  };
};
