import type { IrModule, IrStatement } from "@tsonic/frontend";
import { normalizeModuleFileKey } from "../module-paths.js";
import { getPropertyNameText, printTypeNodeText } from "../portable-types.js";
import {
  collectExtensionWrapperImportsFromSourceType,
  typeNodeUsesImportedTypeNames,
  unwrapParens,
} from "../export-resolution.js";
import {
  registerSourceTypeImportCandidates,
  registerWrapperImports,
} from "../namespace-planning-helpers.js";
import type { Result } from "../../../types.js";
import type { NamespacePlanBuilder } from "./state.js";
import * as ts from "typescript";

export const collectModuleSourceMetadata = (
  builder: NamespacePlanBuilder,
  module: IrModule
): Result<void, string> => {
  const moduleKey = normalizeModuleFileKey(module.filePath);
  const sourceIndex = builder.sourceIndexByFileKey.get(moduleKey);
  if (!sourceIndex) return { ok: true, value: undefined };

  const registered = registerSourceTypeImportCandidates({
    namespace: builder.namespace,
    sourceIndex,
    moduleKey,
    moduleFilePath: module.filePath,
    modulesByFileKey: builder.modulesByFileKey,
    internalTypeImportByAlias: builder.internalTypeImportByAlias,
    facadeTypeImportByAlias: builder.facadeTypeImportByAlias,
  });
  if (!registered.ok) return registered;

  collectSourceAliasPlans(builder, module, sourceIndex);

  const exportedClasses = module.body.filter(
    (stmt): stmt is Extract<IrStatement, { kind: "classDeclaration" }> =>
      stmt.kind === "classDeclaration" && stmt.isExported
  );
  for (const cls of exportedClasses) {
    const sourceMembers = sourceIndex.memberTypesByClassAndMember.get(cls.name);
    if (!sourceMembers) continue;
    for (const member of cls.members) {
      if (member.kind !== "propertyDeclaration") continue;
      if (member.isStatic || member.accessibility === "private") continue;
      const sourceMember = sourceMembers.get(member.name);
      if (!sourceMember) continue;
      const registeredOverride = registerMemberOverride({
        builder,
        module,
        moduleKey,
        sourceIndex,
        className: cls.name,
        memberName: member.name,
        typeNode: sourceMember.typeNode,
        sourceTypeText: sourceMember.typeText,
        isOptional: sourceMember.isOptional,
      });
      if (!registeredOverride.ok) return registeredOverride;
    }
  }

  const exportedInterfaces = module.body.filter(
    (stmt): stmt is Extract<IrStatement, { kind: "interfaceDeclaration" }> =>
      stmt.kind === "interfaceDeclaration" && stmt.isExported
  );
  for (const iface of exportedInterfaces) {
    const sourceMembers = sourceIndex.memberTypesByClassAndMember.get(
      iface.name
    );
    if (!sourceMembers) continue;
    for (const member of iface.members) {
      if (member.kind !== "propertySignature") continue;
      const sourceMember = sourceMembers.get(member.name);
      if (!sourceMember) continue;
      const registeredOverride = registerMemberOverride({
        builder,
        module,
        moduleKey,
        sourceIndex,
        className: iface.name,
        memberName: member.name,
        typeNode: sourceMember.typeNode,
        sourceTypeText: sourceMember.typeText,
        isOptional: sourceMember.isOptional,
        emitOptionalPropertySyntax: true,
      });
      if (!registeredOverride.ok) return registeredOverride;
    }
  }

  const exportedAliases = module.body.filter(
    (stmt): stmt is Extract<IrStatement, { kind: "typeAliasDeclaration" }> =>
      stmt.kind === "typeAliasDeclaration" && stmt.isExported
  );
  for (const alias of exportedAliases) {
    const sourceAlias = sourceIndex.typeAliasesByName.get(alias.name);
    if (!sourceAlias) continue;
    const aliasType = unwrapParens(sourceAlias.type);
    if (!ts.isTypeLiteralNode(aliasType)) continue;
    const internalAliasName = `${alias.name}__Alias${
      sourceAlias.typeParameterNames.length > 0
        ? `_${sourceAlias.typeParameterNames.length}`
        : ""
    }`;
    for (const member of aliasType.members) {
      if (!ts.isPropertySignature(member)) continue;
      if (!member.name || !member.type) continue;
      const memberName = getPropertyNameText(member.name);
      if (!memberName) continue;
      const registeredOverride = registerMemberOverride({
        builder,
        module,
        moduleKey,
        sourceIndex,
        className: internalAliasName,
        memberName,
        typeNode: member.type,
        sourceTypeText: printTypeNodeText(member.type, member.getSourceFile()),
        isOptional: member.questionToken !== undefined,
      });
      if (!registeredOverride.ok) return registeredOverride;
    }
  }

  return { ok: true, value: undefined };
};

const collectSourceAliasPlans = (
  builder: NamespacePlanBuilder,
  module: IrModule,
  sourceIndex: NonNullable<
    ReturnType<(typeof builder)["sourceIndexByFileKey"]["get"]>
  >
): void => {
  const exportedAliasDecls = module.body.filter(
    (stmt): stmt is Extract<IrStatement, { kind: "typeAliasDeclaration" }> =>
      stmt.kind === "typeAliasDeclaration" && stmt.isExported
  );
  for (const alias of exportedAliasDecls) {
    const sourceAlias = sourceIndex.typeAliasesByName.get(alias.name);
    builder.sourceAliasPlans.push({
      declaration: alias,
      sourceAlias,
      typeImportsByLocalName: sourceIndex.typeImportsByLocalName,
    });
  }
};

const registerMemberOverride = (opts: {
  readonly builder: NamespacePlanBuilder;
  readonly module: IrModule;
  readonly moduleKey: string;
  readonly sourceIndex: NonNullable<
    ReturnType<NamespacePlanBuilder["sourceIndexByFileKey"]["get"]>
  >;
  readonly className: string;
  readonly memberName: string;
  readonly typeNode: ts.TypeNode;
  readonly sourceTypeText: string;
  readonly isOptional: boolean;
  readonly emitOptionalPropertySyntax?: boolean;
}): Result<void, string> => {
  const wrappersResult = collectExtensionWrapperImportsFromSourceType({
    startModuleKey: opts.moduleKey,
    typeNode: opts.typeNode,
    sourceIndexByFileKey: opts.builder.sourceIndexByFileKey,
    modulesByFileKey: opts.builder.modulesByFileKey,
  });
  if (!wrappersResult.ok) return wrappersResult;
  const wrappers = wrappersResult.value;
  const canUseSourceTypeText = !typeNodeUsesImportedTypeNames(
    opts.typeNode,
    opts.sourceIndex.typeImportsByLocalName
  );
  if (!canUseSourceTypeText && wrappers.length === 0) {
    return { ok: true, value: undefined };
  }
  const wrapperRegistered = registerWrapperImports(
    opts.builder.wrapperImportByAlias,
    wrappers,
    opts.module.filePath
  );
  if (!wrapperRegistered.ok) return wrapperRegistered;
  opts.builder.memberOverrides.push({
    className: opts.className,
    memberName: opts.memberName,
    sourceTypeText: canUseSourceTypeText ? opts.sourceTypeText : undefined,
    replaceWithSourceType: canUseSourceTypeText,
    isOptional: opts.isOptional,
    emitOptionalPropertySyntax: opts.emitOptionalPropertySyntax,
    wrappers,
  });
  return { ok: true, value: undefined };
};
