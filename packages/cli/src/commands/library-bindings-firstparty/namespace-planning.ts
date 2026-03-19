import type { IrModule, IrStatement } from "@tsonic/frontend";
import type { Result } from "../../types.js";
import {
  buildSemanticSignatureFromFunctionType,
  resolveFunctionTypeFromValueDeclarator,
  rewriteBindingSemanticType,
  toClrTypeName,
} from "./binding-semantics.js";
import {
  classifyDeclarationKind,
  collectExtensionWrapperImportsFromSourceType,
  collectModuleExports,
  finalizeCrossNamespaceReexports,
  resolveExportedDeclaration,
  typeNodeUsesImportedTypeNames,
  unwrapParens,
} from "./export-resolution.js";
import { normalizeModuleFileKey } from "./module-paths.js";
import { getPropertyNameText, printTypeNodeText } from "./portable-types.js";
import {
  collectAnonymousHelperClassNamesByShape,
  collectAnonymousMemberOverrides,
  registerCrossNamespaceReexport,
  registerCrossNamespaceTypeDeclaration,
  registerFacadeLocalTypeReferenceImports,
  registerSourceTypeImportCandidates,
  registerValueExport,
  registerWrapperImports,
} from "./namespace-planning-helpers.js";
import type {
  ExportedSymbol,
  FirstPartyBindingsExport,
  FirstPartyValueExportFacade,
  InternalHelperTypeDeclaration,
  MemberOverride,
  ModuleContainerEntry,
  ModuleSourceIndex,
  NamespacePlan,
  SourceAliasPlan,
  SourceTypeImportBinding,
  WrapperImport,
} from "./types.js";
import * as ts from "typescript";

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
    const typeDeclarations: ExportedSymbol[] = [];
    const moduleContainers: ModuleContainerEntry[] = [];
    const crossNamespaceReexportsGrouped = new Map<string, string[]>();
    const crossNamespaceTypeDeclarations: ExportedSymbol[] = [];
    const seenCrossNamespaceTypeDeclarationKeys = new Set<string>();
    const valueExportsMap = new Map<
      string,
      {
        readonly exportName: string;
        readonly binding: FirstPartyBindingsExport;
        readonly facade: FirstPartyValueExportFacade;
      }
    >();
    const seenTypeDeclarationKeys = new Set<string>();
    const sourceAliasPlans: SourceAliasPlan[] = [];
    const memberOverrides: MemberOverride[] = [];
    const internalTypeImportByAlias = new Map<
      string,
      SourceTypeImportBinding
    >();
    const facadeTypeImportByAlias = new Map<string, SourceTypeImportBinding>();
    const wrapperImportByAlias = new Map<string, WrapperImport>();
    const internalHelperTypeDeclarationsByKey = new Map<
      string,
      InternalHelperTypeDeclaration
    >();
    const internalHelperTypeRemapsByModuleKey = new Map<
      string,
      Map<string, string>
    >();

    for (const module of moduleList.sort((left, right) =>
      left.filePath.localeCompare(right.filePath)
    )) {
      const moduleKey = normalizeModuleFileKey(module.filePath);
      const sourceIndex = sourceIndexByFileKey.get(moduleKey);

      if (sourceIndex) {
        const registered = registerSourceTypeImportCandidates({
          namespace,
          sourceIndex,
          moduleKey,
          moduleFilePath: module.filePath,
          modulesByFileKey,
          internalTypeImportByAlias,
          facadeTypeImportByAlias,
        });
        if (!registered.ok) return registered;

        const exportedAliasDecls = module.body.filter(
          (
            stmt
          ): stmt is Extract<IrStatement, { kind: "typeAliasDeclaration" }> =>
            stmt.kind === "typeAliasDeclaration" && stmt.isExported
        );

        for (const alias of exportedAliasDecls) {
          const sourceAlias = sourceIndex.typeAliasesByName.get(alias.name);
          sourceAliasPlans.push({
            declaration: alias,
            sourceAlias,
            typeImportsByLocalName: sourceIndex.typeImportsByLocalName,
          });
        }

        const exportedClasses = module.body.filter(
          (stmt): stmt is Extract<IrStatement, { kind: "classDeclaration" }> =>
            stmt.kind === "classDeclaration" && stmt.isExported
        );
        const exportedInterfaces = module.body.filter(
          (
            stmt
          ): stmt is Extract<IrStatement, { kind: "interfaceDeclaration" }> =>
            stmt.kind === "interfaceDeclaration" && stmt.isExported
        );
        const exportedAliases = module.body.filter(
          (
            stmt
          ): stmt is Extract<IrStatement, { kind: "typeAliasDeclaration" }> =>
            stmt.kind === "typeAliasDeclaration" && stmt.isExported
        );

        for (const cls of exportedClasses) {
          const sourceMembers = sourceIndex.memberTypesByClassAndMember.get(
            cls.name
          );
          if (!sourceMembers) continue;
          for (const member of cls.members) {
            if (member.kind !== "propertyDeclaration") continue;
            if (member.isStatic || member.accessibility === "private") continue;
            const sourceMember = sourceMembers.get(member.name);
            if (!sourceMember) continue;
            const wrappersResult = collectExtensionWrapperImportsFromSourceType(
              {
                startModuleKey: moduleKey,
                typeNode: sourceMember.typeNode,
                sourceIndexByFileKey,
                modulesByFileKey,
              }
            );
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
            const wrapperRegistered = registerWrapperImports(
              wrapperImportByAlias,
              wrappers,
              module.filePath
            );
            if (!wrapperRegistered.ok) return wrapperRegistered;
            memberOverrides.push({
              className: cls.name,
              memberName: member.name,
              sourceTypeText: canUseSourceTypeText
                ? sourceMember.typeText
                : undefined,
              replaceWithSourceType: canUseSourceTypeText,
              isOptional: sourceMember.isOptional,
              wrappers,
            });
          }
        }

        for (const iface of exportedInterfaces) {
          const sourceMembers = sourceIndex.memberTypesByClassAndMember.get(
            iface.name
          );
          if (!sourceMembers) continue;
          for (const member of iface.members) {
            if (member.kind !== "propertySignature") continue;
            const sourceMember = sourceMembers.get(member.name);
            if (!sourceMember) continue;
            const wrappersResult = collectExtensionWrapperImportsFromSourceType(
              {
                startModuleKey: moduleKey,
                typeNode: sourceMember.typeNode,
                sourceIndexByFileKey,
                modulesByFileKey,
              }
            );
            if (!wrappersResult.ok) return wrappersResult;
            const wrappers = wrappersResult.value;
            const canUseSourceTypeText = !typeNodeUsesImportedTypeNames(
              sourceMember.typeNode,
              sourceIndex.typeImportsByLocalName
            );
            if (!canUseSourceTypeText && wrappers.length === 0) continue;
            const wrapperRegistered = registerWrapperImports(
              wrapperImportByAlias,
              wrappers,
              module.filePath
            );
            if (!wrapperRegistered.ok) return wrapperRegistered;
            memberOverrides.push({
              className: iface.name,
              memberName: member.name,
              sourceTypeText: canUseSourceTypeText
                ? sourceMember.typeText
                : undefined,
              replaceWithSourceType: canUseSourceTypeText,
              isOptional: sourceMember.isOptional,
              emitOptionalPropertySyntax: true,
              wrappers,
            });
          }
        }

        for (const alias of exportedAliases) {
          const sourceAlias = sourceIndex.typeAliasesByName.get(alias.name);
          if (!sourceAlias) continue;
          const aliasType = unwrapParens(sourceAlias.type);
          if (!ts.isTypeLiteralNode(aliasType)) continue;
          const arity = sourceAlias.typeParameterNames.length;
          const internalAliasName = `${alias.name}__Alias${arity > 0 ? `_${arity}` : ""}`;
          for (const member of aliasType.members) {
            if (!ts.isPropertySignature(member)) continue;
            if (!member.name || !member.type) continue;
            const memberName = getPropertyNameText(member.name);
            if (!memberName) continue;
            const wrappersResult = collectExtensionWrapperImportsFromSourceType(
              {
                startModuleKey: moduleKey,
                typeNode: member.type,
                sourceIndexByFileKey,
                modulesByFileKey,
              }
            );
            if (!wrappersResult.ok) return wrappersResult;
            const wrappers = wrappersResult.value;
            const canUseSourceTypeText = !typeNodeUsesImportedTypeNames(
              member.type,
              sourceIndex.typeImportsByLocalName
            );
            if (!canUseSourceTypeText && wrappers.length === 0) continue;
            const wrapperRegistered = registerWrapperImports(
              wrapperImportByAlias,
              wrappers,
              module.filePath
            );
            if (!wrapperRegistered.ok) return wrapperRegistered;
            memberOverrides.push({
              className: internalAliasName,
              memberName,
              sourceTypeText: canUseSourceTypeText
                ? printTypeNodeText(member.type, member.getSourceFile())
                : undefined,
              replaceWithSourceType: canUseSourceTypeText,
              isOptional: member.questionToken !== undefined,
              wrappers,
            });
          }
        }
      }

      for (const exportItem of module.exports) {
        if (exportItem.kind !== "reexport") continue;
        const resolved = resolveExportedDeclaration(
          module,
          exportItem.name,
          modulesByFileKey
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
        if (declarationModule.namespace !== namespace) {
          registerCrossNamespaceReexport({
            namespace,
            crossNamespaceReexportsGrouped,
            declaringNamespace: declarationModule.namespace,
            exportName: exportItem.name,
            localName: resolved.value.clrName,
            kind:
              exportKind.value === "interface" ||
              exportKind.value === "typeAlias"
                ? "type"
                : "value",
          });
        }
        if (exportKind.value === "function") {
          const functionDeclaration =
            declaration.kind === "functionDeclaration"
              ? declaration
              : undefined;
          if (!functionDeclaration) {
            return {
              ok: false,
              error: `Invalid function export '${exportItem.name}' in ${declarationModule.filePath}: expected function declaration.`,
            };
          }
          const declarationModuleKey = normalizeModuleFileKey(
            declarationModule.filePath
          );
          const declarationSourceIndex =
            sourceIndexByFileKey.get(declarationModuleKey);
          if (declarationSourceIndex) {
            const registered = registerSourceTypeImportCandidates({
              namespace,
              sourceIndex: declarationSourceIndex,
              moduleKey: declarationModuleKey,
              moduleFilePath: declarationModule.filePath,
              modulesByFileKey,
              internalTypeImportByAlias,
              facadeTypeImportByAlias,
            });
            if (!registered.ok) return registered;
          }
          const registeredLocalTypeRefs =
            registerFacadeLocalTypeReferenceImports({
              namespace,
              declarationModule,
              declarationNamespace: declarationModule.namespace,
              declarationFilePath: declarationModule.filePath,
              sourceIndex: declarationSourceIndex,
              typeParameters: functionDeclaration.typeParameters,
              parameterTypes: functionDeclaration.parameters.map(
                (parameter) => parameter.type
              ),
              returnType: functionDeclaration.returnType,
              sourceIndexByFileKey,
              modulesByFileKey,
              facadeTypeImportByAlias,
              internalHelperTypeRemapsByModuleKey,
              internalHelperTypeDeclarationsByKey,
            });
          if (!registeredLocalTypeRefs.ok) return registeredLocalTypeRefs;
          const registered = registerValueExport({
            namespace,
            valueExportsMap,
            valueExport: {
              exportName: exportItem.name,
              binding: {
                kind: "method",
                clrName: resolved.value.clrName,
                declaringClrType: toClrTypeName(
                  declarationModule.namespace,
                  declarationModule.className
                ),
                declaringAssemblyName: assemblyName,
              },
              facade: {
                kind: "function",
                declaration: functionDeclaration,
                localTypeNameRemaps: registeredLocalTypeRefs.value,
                sourceSignatures:
                  sourceIndexByFileKey
                    .get(normalizeModuleFileKey(declarationModule.filePath))
                    ?.exportedFunctionSignaturesByName.get(
                      resolved.value.clrName
                    ) ?? [],
              },
            },
          });
          if (!registered.ok) return registered;
          continue;
        }
        if (exportKind.value === "variable") {
          const declarationStatement =
            declaration.kind === "variableDeclaration"
              ? declaration
              : undefined;
          if (!declarationStatement) {
            return {
              ok: false,
              error: `Invalid variable export '${exportItem.name}' in ${declarationModule.filePath}: expected variable declaration.`,
            };
          }
          const declarationModuleKey = normalizeModuleFileKey(
            declarationModule.filePath
          );
          const declarationSourceIndex =
            sourceIndexByFileKey.get(declarationModuleKey);
          if (declarationSourceIndex) {
            const registered = registerSourceTypeImportCandidates({
              namespace,
              sourceIndex: declarationSourceIndex,
              moduleKey: declarationModuleKey,
              moduleFilePath: declarationModule.filePath,
              modulesByFileKey,
              internalTypeImportByAlias,
              facadeTypeImportByAlias,
            });
            if (!registered.ok) return registered;
          }
          const declarator = declarationStatement.declarations.find(
            (candidate) =>
              candidate.name.kind === "identifierPattern" &&
              candidate.name.name === resolved.value.clrName
          );
          const exportedFunctionType = resolveFunctionTypeFromValueDeclarator(
            declarator && declarator.name.kind === "identifierPattern"
              ? {
                  kind: declarator.kind,
                  name: declarator.name,
                  type: declarator.type,
                  initializer: declarator.initializer,
                }
              : undefined
          );
          const registeredLocalTypeRefs =
            registerFacadeLocalTypeReferenceImports({
              namespace,
              declarationModule,
              declarationNamespace: declarationModule.namespace,
              declarationFilePath: declarationModule.filePath,
              sourceIndex: declarationSourceIndex,
              typeParameters: undefined,
              parameterTypes: exportedFunctionType
                ? [exportedFunctionType]
                : declarator?.type
                  ? [declarator.type]
                  : [],
              returnType: undefined,
              sourceIndexByFileKey,
              modulesByFileKey,
              facadeTypeImportByAlias,
              internalHelperTypeRemapsByModuleKey,
              internalHelperTypeDeclarationsByKey,
            });
          if (!registeredLocalTypeRefs.ok) return registeredLocalTypeRefs;
          const registered = registerValueExport({
            namespace,
            valueExportsMap,
            valueExport: {
              exportName: exportItem.name,
              binding: {
                kind: exportedFunctionType ? "functionType" : "field",
                clrName: resolved.value.clrName,
                declaringClrType: toClrTypeName(
                  declarationModule.namespace,
                  declarationModule.className
                ),
                declaringAssemblyName: assemblyName,
                semanticType: exportedFunctionType
                  ? undefined
                  : rewriteBindingSemanticType(
                      declarator?.type,
                      registeredLocalTypeRefs.value
                    ),
                semanticSignature: exportedFunctionType
                  ? buildSemanticSignatureFromFunctionType(
                      exportedFunctionType,
                      registeredLocalTypeRefs.value
                    )
                  : undefined,
              },
              facade: {
                kind: "variable",
                localTypeNameRemaps: registeredLocalTypeRefs.value,
                sourceType: declarationSourceIndex?.exportedValueTypesByName.get(
                  resolved.value.clrName
                ),
                sourceSignatures:
                  declarationSourceIndex?.exportedFunctionSignaturesByName.get(
                    resolved.value.clrName
                  ) ?? [],
                declarator:
                  declarator && declarator.name.kind === "identifierPattern"
                    ? {
                        kind: declarator.kind,
                        name: declarator.name,
                        type: declarator.type,
                        initializer: declarator.initializer,
                      }
                    : undefined,
              },
            },
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
          if (declarationModule.namespace !== namespace) {
            registerCrossNamespaceTypeDeclaration({
              namespace,
              crossNamespaceTypeDeclarations,
              seenCrossNamespaceTypeDeclarationKeys,
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
          const declarationModuleKey = normalizeModuleFileKey(
            declarationModule.filePath
          );
          const declarationSourceIndex =
            sourceIndexByFileKey.get(declarationModuleKey);
          if (declarationSourceIndex) {
            const registered = registerSourceTypeImportCandidates({
              namespace,
              sourceIndex: declarationSourceIndex,
              moduleKey: declarationModuleKey,
              moduleFilePath: declarationModule.filePath,
              modulesByFileKey,
              internalTypeImportByAlias,
              facadeTypeImportByAlias,
            });
            if (!registered.ok) return registered;
          }
          if (
            exportKind.value === "typeAlias" &&
            declaration.kind === "typeAliasDeclaration" &&
            declaration.type.kind !== "objectType"
          ) {
            continue;
          }
          const typeKey = `${declarationModule.namespace}|${declarationModule.className}|${resolved.value.clrName}|${exportKind.value}`;
          if (seenTypeDeclarationKeys.has(typeKey)) continue;
          seenTypeDeclarationKeys.add(typeKey);
          typeDeclarations.push({
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

      const moduleExports = collectModuleExports(module, modulesByFileKey);
      if (!moduleExports.ok) return moduleExports;
      const containerMethods: ModuleContainerEntry["methods"] = [];
      const containerVariables: ModuleContainerEntry["variables"] = [];

      if (module.filePath.startsWith("__tsonic/")) {
        for (const statement of module.body) {
          if (statement.kind !== "classDeclaration") continue;
          if (!statement.name.startsWith("__Anon_")) continue;
          const key = `${statement.name}|class`;
          if (seenTypeDeclarationKeys.has(key)) continue;
          seenTypeDeclarationKeys.add(key);
          typeDeclarations.push({
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
          if (symbol.declaringNamespace !== namespace) {
            registerCrossNamespaceReexport({
              namespace,
              crossNamespaceReexportsGrouped,
              declaringNamespace: symbol.declaringNamespace,
              exportName: symbol.exportName,
              localName: symbol.localName,
              kind:
                symbol.kind === "interface" || symbol.kind === "typeAlias"
                  ? "type"
                  : "value",
            });
            registerCrossNamespaceTypeDeclaration({
              namespace,
              crossNamespaceTypeDeclarations,
              seenCrossNamespaceTypeDeclarationKeys,
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
          if (!seenTypeDeclarationKeys.has(key)) {
            seenTypeDeclarationKeys.add(key);
            typeDeclarations.push(symbol);
          }
        }

        if (symbol.kind === "function") {
          if (symbol.declaringNamespace !== namespace) {
            registerCrossNamespaceReexport({
              namespace,
              crossNamespaceReexportsGrouped,
              declaringNamespace: symbol.declaringNamespace,
              exportName: symbol.exportName,
              localName: symbol.localName,
              kind: "value",
            });
          }
          const functionDeclaration =
            symbol.declaration.kind === "functionDeclaration"
              ? symbol.declaration
              : undefined;
          if (!functionDeclaration) continue;
          const symbolModuleKey = normalizeModuleFileKey(
            symbol.declaringFilePath
          );
          const symbolSourceIndex = sourceIndexByFileKey.get(symbolModuleKey);
          const symbolDeclarationModule = modulesByFileKey.get(symbolModuleKey);
          if (!symbolDeclarationModule) {
            return {
              ok: false,
              error:
                `Unable to resolve declaring module for '${symbol.exportName}' while generating ${symbol.declaringFilePath}.\n` +
                "First-party bindings generation requires a stable source module for each exported value.",
            };
          }
          if (symbolSourceIndex) {
            const registered = registerSourceTypeImportCandidates({
              namespace,
              sourceIndex: symbolSourceIndex,
              moduleKey: symbolModuleKey,
              moduleFilePath: symbol.declaringFilePath,
              modulesByFileKey,
              internalTypeImportByAlias,
              facadeTypeImportByAlias,
            });
            if (!registered.ok) return registered;
          }
          const registeredLocalTypeRefs =
            registerFacadeLocalTypeReferenceImports({
              namespace,
              declarationModule: symbolDeclarationModule,
              declarationNamespace: symbol.declaringNamespace,
              declarationFilePath: symbol.declaringFilePath,
              sourceIndex: symbolSourceIndex,
              typeParameters: functionDeclaration.typeParameters,
              parameterTypes: functionDeclaration.parameters.map(
                (parameter) => parameter.type
              ),
              returnType: functionDeclaration.returnType,
              sourceIndexByFileKey,
              modulesByFileKey,
              facadeTypeImportByAlias,
              internalHelperTypeRemapsByModuleKey,
              internalHelperTypeDeclarationsByKey,
            });
          if (!registeredLocalTypeRefs.ok) return registeredLocalTypeRefs;
          const isLocalContainerMember =
            symbol.declaringNamespace === module.namespace &&
            symbol.declaringClassName === module.className;
          if (isLocalContainerMember) {
            containerMethods.push({
              exportName: symbol.exportName,
              localName: symbol.localName,
              declaration: functionDeclaration,
              localTypeNameRemaps: registeredLocalTypeRefs.value,
              sourceSignatures:
                sourceIndexByFileKey
                  .get(normalizeModuleFileKey(symbol.declaringFilePath))
                  ?.exportedFunctionSignaturesByName.get(symbol.localName) ??
                [],
            });
          }
          const registered = registerValueExport({
            namespace,
            valueExportsMap,
            valueExport: {
              exportName: symbol.exportName,
              binding: {
                kind: "method",
                clrName: symbol.localName,
                declaringClrType: toClrTypeName(
                  symbol.declaringNamespace,
                  symbol.declaringClassName
                ),
                declaringAssemblyName: assemblyName,
              },
              facade: {
                kind: "function",
                declaration: functionDeclaration,
                localTypeNameRemaps: registeredLocalTypeRefs.value,
                sourceSignatures:
                  sourceIndexByFileKey
                    .get(normalizeModuleFileKey(symbol.declaringFilePath))
                    ?.exportedFunctionSignaturesByName.get(symbol.localName) ??
                  [],
              },
            },
          });
          if (!registered.ok) return registered;
          continue;
        }

        if (symbol.kind === "variable") {
          if (symbol.declaringNamespace !== namespace) {
            registerCrossNamespaceReexport({
              namespace,
              crossNamespaceReexportsGrouped,
              declaringNamespace: symbol.declaringNamespace,
              exportName: symbol.exportName,
              localName: symbol.localName,
              kind: "value",
            });
          }
          const declaration =
            symbol.declaration.kind === "variableDeclaration"
              ? symbol.declaration
              : undefined;
          if (!declaration) continue;
          const symbolModuleKey = normalizeModuleFileKey(
            symbol.declaringFilePath
          );
          const symbolSourceIndex = sourceIndexByFileKey.get(symbolModuleKey);
          const symbolDeclarationModule = modulesByFileKey.get(symbolModuleKey);
          if (!symbolDeclarationModule) {
            return {
              ok: false,
              error:
                `Unable to resolve declaring module for '${symbol.exportName}' while generating ${symbol.declaringFilePath}.\n` +
                "First-party bindings generation requires a stable source module for each exported value.",
            };
          }
          if (symbolSourceIndex) {
            const registered = registerSourceTypeImportCandidates({
              namespace,
              sourceIndex: symbolSourceIndex,
              moduleKey: symbolModuleKey,
              moduleFilePath: symbol.declaringFilePath,
              modulesByFileKey,
              internalTypeImportByAlias,
              facadeTypeImportByAlias,
            });
            if (!registered.ok) return registered;
          }
          const declarator = declaration.declarations.find(
            (candidate) =>
              candidate.name.kind === "identifierPattern" &&
              candidate.name.name === symbol.localName
          );
          const exportDeclarator =
            declarator && declarator.name.kind === "identifierPattern"
              ? {
                  kind: declarator.kind,
                  name: declarator.name,
                  type: declarator.type,
                  initializer: declarator.initializer,
                }
              : undefined;
          const exportedFunctionType =
            resolveFunctionTypeFromValueDeclarator(exportDeclarator);
          const registeredLocalTypeRefs =
            registerFacadeLocalTypeReferenceImports({
              namespace,
              declarationModule: symbolDeclarationModule,
              declarationNamespace: symbol.declaringNamespace,
              declarationFilePath: symbol.declaringFilePath,
              sourceIndex: symbolSourceIndex,
              typeParameters: undefined,
              parameterTypes: exportedFunctionType
                ? [exportedFunctionType]
                : declarator?.type
                  ? [declarator.type]
                  : [],
              returnType: undefined,
              sourceIndexByFileKey,
              modulesByFileKey,
              facadeTypeImportByAlias,
              internalHelperTypeRemapsByModuleKey,
              internalHelperTypeDeclarationsByKey,
            });
          if (!registeredLocalTypeRefs.ok) return registeredLocalTypeRefs;
          const isLocalContainerMember =
            symbol.declaringNamespace === module.namespace &&
            symbol.declaringClassName === module.className;
          if (isLocalContainerMember) {
            containerVariables.push({
              exportName: symbol.exportName,
              localName: symbol.localName,
              declaration,
              declarator: exportDeclarator,
              localTypeNameRemaps: registeredLocalTypeRefs.value,
              sourceType: sourceIndexByFileKey
                .get(normalizeModuleFileKey(symbol.declaringFilePath))
                ?.exportedValueTypesByName.get(symbol.localName),
              sourceSignatures:
                sourceIndexByFileKey
                  .get(normalizeModuleFileKey(symbol.declaringFilePath))
                  ?.exportedFunctionSignaturesByName.get(symbol.localName) ??
                [],
            });
          }
          const registered = registerValueExport({
            namespace,
            valueExportsMap,
            valueExport: {
              exportName: symbol.exportName,
              binding: {
                kind: exportedFunctionType ? "functionType" : "field",
                clrName: symbol.localName,
                declaringClrType: toClrTypeName(
                  symbol.declaringNamespace,
                  symbol.declaringClassName
                ),
                declaringAssemblyName: assemblyName,
                semanticType: exportedFunctionType
                  ? undefined
                  : rewriteBindingSemanticType(
                      exportDeclarator?.type,
                      registeredLocalTypeRefs.value
                    ),
                semanticSignature: exportedFunctionType
                  ? buildSemanticSignatureFromFunctionType(
                      exportedFunctionType,
                      registeredLocalTypeRefs.value
                    )
                  : undefined,
              },
              facade: {
                kind: "variable",
                localTypeNameRemaps: registeredLocalTypeRefs.value,
                sourceType: symbolSourceIndex?.exportedValueTypesByName.get(
                  symbol.localName
                ),
                sourceSignatures:
                  symbolSourceIndex?.exportedFunctionSignaturesByName.get(
                    symbol.localName
                  ) ?? [],
                declarator: exportDeclarator,
              },
            },
          });
          if (!registered.ok) return registered;
        }
      }

      if (containerMethods.length > 0 || containerVariables.length > 0) {
        moduleContainers.push({
          module,
          methods: containerMethods,
          variables: containerVariables,
        });
      }
    }

    const anonymousHelperClassNamesByShape =
      collectAnonymousHelperClassNamesByShape({
        typeDeclarations,
        internalHelperTypeDeclarationsByKey,
      });
    const anonymousMemberOverrides = collectAnonymousMemberOverrides({
      anonymousHelperClassNamesByShape,
      sourceIndexByFileKey,
      modulesByFileKey,
      wrapperImportByAlias,
    });
    if (!anonymousMemberOverrides.ok) return anonymousMemberOverrides;
    memberOverrides.push(...anonymousMemberOverrides.value);

    plans.push({
      namespace,
      typeDeclarations: typeDeclarations.sort((left, right) =>
        left.exportName.localeCompare(right.exportName)
      ),
      internalHelperTypeDeclarations: Array.from(
        internalHelperTypeDeclarationsByKey.values()
      ).sort((left, right) => left.key.localeCompare(right.key)),
      moduleContainers: moduleContainers.sort((left, right) =>
        left.module.className.localeCompare(right.module.className)
      ),
      crossNamespaceReexports: finalizeCrossNamespaceReexports(
        crossNamespaceReexportsGrouped
      ),
      crossNamespaceTypeDeclarations: crossNamespaceTypeDeclarations.sort(
        (left, right) => {
          const leftKey = `${left.exportName}|${left.declaringNamespace}|${left.localName}|${left.kind}`;
          const rightKey = `${right.exportName}|${right.declaringNamespace}|${right.localName}|${right.kind}`;
          return leftKey.localeCompare(rightKey);
        }
      ),
      sourceAliases: sourceAliasPlans.sort((left, right) =>
        left.declaration.name.localeCompare(right.declaration.name)
      ),
      memberOverrides: memberOverrides.sort((left, right) => {
        const classCmp = left.className.localeCompare(right.className);
        if (classCmp !== 0) return classCmp;
        return left.memberName.localeCompare(right.memberName);
      }),
      internalTypeImports: Array.from(internalTypeImportByAlias.values()).sort(
        (left, right) => left.localName.localeCompare(right.localName)
      ),
      facadeTypeImports: Array.from(facadeTypeImportByAlias.values()).sort(
        (left, right) => left.localName.localeCompare(right.localName)
      ),
      wrapperImports: Array.from(wrapperImportByAlias.values()).sort(
        (left, right) => left.aliasName.localeCompare(right.aliasName)
      ),
      valueExports: Array.from(valueExportsMap.values()).sort((left, right) =>
        left.exportName.localeCompare(right.exportName)
      ),
    });
  }

  return {
    ok: true,
    value: plans.sort((left, right) =>
      left.namespace.localeCompare(right.namespace)
    ),
  };
};
