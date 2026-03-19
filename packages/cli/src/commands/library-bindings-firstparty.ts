import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
  CompilerOptions,
  IrClassDeclaration,
  IrEnumDeclaration,
  IrInterfaceMember,
  IrInterfaceDeclaration,
  IrModule,
  IrStatement,
  IrType,
  IrTypeAliasDeclaration,
  IrTypeParameter,
} from "@tsonic/frontend";
import { buildModuleDependencyGraph } from "@tsonic/frontend";
import * as ts from "typescript";
import { resolveSurfaceCapabilities } from "../surface/profiles.js";
import type { ResolvedConfig, Result } from "../types.js";
import { overlayDependencyBindings } from "./library-bindings-augment.js";
import {
  renderSourceFunctionParametersText,
  type SourceFunctionSignatureSurface as SourceFunctionSignatureDef,
} from "../aikya/source-function-surfaces.js";
import {
  buildAnonymousStructuralAliasMap,
  collectReferencedPortableTypeNames,
  collectReferencedPortableTypeNamesFromDeclaration,
} from "./library-bindings-firstparty/anonymous-structural.js";
import {
  areBindingSemanticsEqual,
  buildSemanticSignatureFromFunctionType,
  moduleNamespaceToInternalSpecifier,
  reattachBindingClrIdentities,
  resolveFunctionTypeFromValueDeclarator,
  rewriteBindingSemanticType,
  serializeBindingsJsonSafe,
  stableSerializeBindingSemanticValue,
  toClrTypeName,
} from "./library-bindings-firstparty/binding-semantics.js";
import {
  buildModuleSourceIndex,
  classifyDeclarationKind,
  classifyLocalTypeDeclarationKind,
  collectExtensionWrapperImportsFromSourceType,
  collectModuleExports,
  finalizeCrossNamespaceReexports,
  resolveExportedDeclaration,
  resolveModuleLocalDeclaration,
  typeNodeUsesImportedTypeNames,
  unwrapParens,
} from "./library-bindings-firstparty/export-resolution.js";
import {
  moduleNamespacePath,
  normalizeModuleFileKey,
} from "./library-bindings-firstparty/module-paths.js";
import {
  getPropertyNameText,
  isPortableMarkerMemberName,
  normalizeTypeReferenceName,
  primitiveImportLine,
  printTypeNodeText,
  printTypeParameters,
  renderPortableType,
  renderUnknownParameters,
  sanitizeForBrand,
  selectSourceTypeImportsForRenderedText,
} from "./library-bindings-firstparty/portable-types.js";
import {
  buildTypeBindingFromClass,
  buildTypeBindingFromContainer,
  buildTypeBindingFromEnum,
  buildTypeBindingFromInterface,
  buildTypeBindingFromStructuralAlias,
  renderClassInternal,
  renderContainerInternal,
  renderEnumInternal,
  renderInterfaceInternal,
  renderSourceAliasPlan,
  renderStructuralAliasInternal,
  renderTypeAliasInternal,
} from "./library-bindings-firstparty/rendering.js";
import {
  registerSourceTypeImportBinding,
  resolveSourceTypeImportBinding,
} from "./library-bindings-firstparty/source-imports.js";
import {
  renderSourceFunctionSignature,
  renderSourceFunctionType,
  renderSourceValueType,
} from "./library-bindings-firstparty/source-type-text.js";
import type {
  ExportedSymbol,
  FirstPartyBindingsExport,
  FirstPartyBindingsFile,
  FirstPartyBindingsType,
  FirstPartyValueDeclarator,
  FirstPartyValueExportFacade,
  InternalHelperTypeDeclaration,
  MemberOverride,
  ModuleContainerEntry,
  ModuleSourceIndex,
  NamespacePlan,
  SourceAliasPlan,
  SourceTypeImportBinding,
  WrapperImport,
} from "./library-bindings-firstparty/types.js";

const collectNamespacePlans = (
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

    const getInternalHelperTypeName = (
      moduleFileKey: string,
      localName: string
    ): string => {
      return `__Local_${sanitizeForBrand(moduleFileKey)}_${sanitizeForBrand(localName)}`;
    };

    const registerInternalHelperTypeClosure = (opts: {
      readonly declarationModule: IrModule;
      readonly sourceIndex: ModuleSourceIndex | undefined;
      readonly referencedNames: ReadonlySet<string>;
    }): Result<ReadonlyMap<string, string>, string> => {
      if (!opts.sourceIndex) return { ok: true, value: new Map() };

      const moduleFileKey = normalizeModuleFileKey(
        opts.declarationModule.filePath
      );
      const remaps =
        internalHelperTypeRemapsByModuleKey.get(moduleFileKey) ?? new Map();
      if (!internalHelperTypeRemapsByModuleKey.has(moduleFileKey)) {
        internalHelperTypeRemapsByModuleKey.set(moduleFileKey, remaps);
      }
      const visiting = new Set<string>();

      const visitLocalType = (localName: string): Result<void, string> => {
        if (opts.sourceIndex?.exportedTypeDeclarationNames.has(localName)) {
          return { ok: true, value: undefined };
        }
        const declaration = resolveModuleLocalDeclaration(
          opts.declarationModule,
          localName
        );
        if (!declaration) return { ok: true, value: undefined };
        const kind = classifyLocalTypeDeclarationKind(declaration);
        if (!kind) return { ok: true, value: undefined };
        const localTypeDeclaration = declaration as
          | IrClassDeclaration
          | IrInterfaceDeclaration
          | IrEnumDeclaration
          | IrTypeAliasDeclaration;

        const key = `${moduleFileKey}::${localName}`;
        if (!remaps.has(localName)) {
          remaps.set(
            localName,
            getInternalHelperTypeName(moduleFileKey, localName)
          );
        }
        if (internalHelperTypeDeclarationsByKey.has(key)) {
          return { ok: true, value: undefined };
        }
        if (visiting.has(key)) return { ok: true, value: undefined };

        visiting.add(key);
        const nestedReferencedNames = new Set<string>();
        collectReferencedPortableTypeNamesFromDeclaration(
          localTypeDeclaration,
          nestedReferencedNames
        );
        for (const nestedName of nestedReferencedNames) {
          const visited = visitLocalType(nestedName);
          if (!visited.ok) return visited;
        }
        visiting.delete(key);
        const emittedName = remaps.get(localName);
        if (!emittedName) {
          return {
            ok: false,
            error: `Internal error: missing emitted name remap for local helper '${localName}'.`,
          };
        }

        internalHelperTypeDeclarationsByKey.set(key, {
          key,
          moduleFileKey,
          declaringNamespace: opts.declarationModule.namespace,
          emittedName,
          originalName: localName,
          kind,
          declaration: localTypeDeclaration,
        });
        return { ok: true, value: undefined };
      };

      for (const referencedName of opts.referencedNames) {
        const visited = visitLocalType(referencedName);
        if (!visited.ok) return visited;
      }

      return { ok: true, value: new Map(remaps) };
    };

    const registerValueExport = (valueExport: {
      readonly exportName: string;
      readonly binding: FirstPartyBindingsExport;
      readonly facade: FirstPartyValueExportFacade;
    }): Result<void, string> => {
      const existing = valueExportsMap.get(valueExport.exportName);
      if (!existing) {
        valueExportsMap.set(valueExport.exportName, valueExport);
        return { ok: true, value: undefined };
      }
      const sameBinding = areBindingSemanticsEqual(
        existing.binding,
        valueExport.binding
      );
      const normalizeFunctionFacade = (facade: {
        readonly declaration: Extract<
          IrStatement,
          { kind: "functionDeclaration" }
        >;
        readonly sourceSignatures?: readonly SourceFunctionSignatureDef[];
        readonly localTypeNameRemaps: ReadonlyMap<string, string>;
      }): string => {
        const declaration = facade.declaration;
        const typeParametersText = printTypeParameters(
          declaration.typeParameters
        );
        const typeParameterNames =
          declaration.typeParameters?.map(
            (typeParameter) => typeParameter.name
          ) ?? [];
        const parametersText = renderUnknownParameters(
          declaration.parameters,
          typeParameterNames,
          facade.localTypeNameRemaps
        );
        const returnTypeText = renderPortableType(
          declaration.returnType,
          typeParameterNames,
          facade.localTypeNameRemaps
        );
        const sourceSignatures = (facade.sourceSignatures ?? [])
          .map(
            (signature) =>
              `${signature.typeParametersText}(${renderSourceFunctionParametersText(signature)}):${signature.returnTypeText}`
          )
          .sort((left, right) => left.localeCompare(right))
          .join("||");
        return `${typeParametersText}(${parametersText}):${returnTypeText}|source=${sourceSignatures}`;
      };
      const normalizeVariableFacade = (
        declarator: FirstPartyValueDeclarator | undefined,
        localTypeNameRemaps: ReadonlyMap<string, string>
      ): string => {
        const functionType = resolveFunctionTypeFromValueDeclarator(declarator);
        if (functionType) {
          return stableSerializeBindingSemanticValue(
            buildSemanticSignatureFromFunctionType(
              functionType,
              localTypeNameRemaps
            )
          );
        }

        return renderPortableType(declarator?.type, [], localTypeNameRemaps);
      };
      const sameFacade = (() => {
        if (existing.facade.kind !== valueExport.facade.kind) return false;
        if (
          existing.facade.kind === "function" &&
          valueExport.facade.kind === "function"
        ) {
          return (
            normalizeFunctionFacade(existing.facade) ===
            normalizeFunctionFacade(valueExport.facade)
          );
        }
        if (
          existing.facade.kind === "variable" &&
          valueExport.facade.kind === "variable"
        ) {
          return (
            normalizeVariableFacade(
              existing.facade.declarator,
              existing.facade.localTypeNameRemaps
            ) ===
            normalizeVariableFacade(
              valueExport.facade.declarator,
              valueExport.facade.localTypeNameRemaps
            )
          );
        }
        return false;
      })();
      if (sameBinding && sameFacade) {
        return { ok: true, value: undefined };
      }
      return {
        ok: false,
        error:
          `Conflicting value export '${valueExport.exportName}' in namespace ${namespace}.\n` +
          "First-party bindings generation requires each exported value name to map deterministically to exactly one CLR member.",
      };
    };

    const registerWrapperImports = (
      wrappers: readonly WrapperImport[],
      moduleFilePath: string
    ): Result<void, string> => {
      for (const wrapper of wrappers) {
        const existing = wrapperImportByAlias.get(wrapper.aliasName);
        if (existing) {
          if (
            existing.source !== wrapper.source ||
            existing.importedName !== wrapper.importedName
          ) {
            return {
              ok: false,
              error:
                `Conflicting wrapper import alias '${wrapper.aliasName}' while generating ${moduleFilePath}.\n` +
                `- ${existing.importedName} from '${existing.source}'\n` +
                `- ${wrapper.importedName} from '${wrapper.source}'\n` +
                "Disambiguate ExtensionMethods aliases in source code.",
            };
          }
          continue;
        }
        wrapperImportByAlias.set(wrapper.aliasName, wrapper);
      }
      return { ok: true, value: undefined };
    };

    const registerCrossNamespaceReexport = (opts: {
      readonly declaringNamespace: string;
      readonly exportName: string;
      readonly localName: string;
      readonly kind: "type" | "value";
    }): void => {
      if (opts.declaringNamespace === namespace) return;
      const moduleSpecifier = `./${moduleNamespacePath(opts.declaringNamespace)}.js`;
      const key = `${moduleSpecifier}|${opts.kind}`;
      const specifier =
        opts.exportName === opts.localName
          ? opts.exportName
          : `${opts.localName} as ${opts.exportName}`;
      const existing = crossNamespaceReexportsGrouped.get(key) ?? [];
      existing.push(specifier);
      crossNamespaceReexportsGrouped.set(key, existing);
    };

    const registerCrossNamespaceTypeDeclaration = (
      symbol: ExportedSymbol
    ): void => {
      if (symbol.declaringNamespace === namespace) return;
      const key = `${symbol.declaringNamespace}|${symbol.declaringClassName}|${symbol.localName}|${symbol.kind}`;
      if (seenCrossNamespaceTypeDeclarationKeys.has(key)) return;
      seenCrossNamespaceTypeDeclarationKeys.add(key);
      crossNamespaceTypeDeclarations.push(symbol);
    };

    const registerSourceTypeImportCandidates = (
      sourceIndex: ModuleSourceIndex,
      moduleKey: string,
      moduleFilePath: string
    ): Result<void, string> => {
      for (const [localName, imported] of sourceIndex.typeImportsByLocalName) {
        if (sourceIndex.wrapperImportsByLocalName.has(localName)) continue;

        const internalImport = resolveSourceTypeImportBinding({
          context: "internal",
          currentNamespace: namespace,
          currentModuleKey: moduleKey,
          localName,
          imported,
          modulesByFileKey,
        });
        if (!internalImport.ok) return internalImport;
        if (internalImport.value) {
          const registered = registerSourceTypeImportBinding(
            internalTypeImportByAlias,
            internalImport.value,
            namespace,
            moduleFilePath
          );
          if (!registered.ok) return registered;
        }

        const facadeImport = resolveSourceTypeImportBinding({
          context: "facade",
          currentNamespace: namespace,
          currentModuleKey: moduleKey,
          localName,
          imported,
          modulesByFileKey,
        });
        if (!facadeImport.ok) return facadeImport;
        if (facadeImport.value) {
          const registered = registerSourceTypeImportBinding(
            facadeTypeImportByAlias,
            facadeImport.value,
            namespace,
            moduleFilePath
          );
          if (!registered.ok) return registered;
        }
      }

      return { ok: true, value: undefined };
    };

    const registerFacadeLocalTypeReferenceImports = (opts: {
      readonly declarationModule: IrModule;
      readonly declarationNamespace: string;
      readonly declarationFilePath: string;
      readonly sourceIndex: ModuleSourceIndex | undefined;
      readonly typeParameters: readonly IrTypeParameter[] | undefined;
      readonly parameterTypes: readonly (IrType | undefined)[];
      readonly returnType: IrType | undefined;
    }): Result<ReadonlyMap<string, string>, string> => {
      const typeParameterNames = new Set(
        (opts.typeParameters ?? []).map((typeParameter) => typeParameter.name)
      );
      const referencedNames = new Set<string>();
      for (const parameterType of opts.parameterTypes) {
        collectReferencedPortableTypeNames(
          parameterType,
          typeParameterNames,
          referencedNames
        );
      }
      collectReferencedPortableTypeNames(
        opts.returnType,
        typeParameterNames,
        referencedNames
      );

      const helperTypeRemaps = registerInternalHelperTypeClosure({
        declarationModule: opts.declarationModule,
        sourceIndex: opts.sourceIndex,
        referencedNames,
      });
      if (!helperTypeRemaps.ok) return helperTypeRemaps;
      if (!opts.sourceIndex) return helperTypeRemaps;

      if (opts.declarationNamespace === namespace) {
        return helperTypeRemaps;
      }

      const moduleSpecifier = `./${moduleNamespacePath(opts.declarationNamespace)}.js`;
      for (const referencedName of referencedNames) {
        if (
          !opts.sourceIndex.exportedTypeDeclarationNames.has(referencedName)
        ) {
          continue;
        }
        const registered = registerSourceTypeImportBinding(
          facadeTypeImportByAlias,
          {
            importedName: referencedName,
            localName: referencedName,
            source: moduleSpecifier,
          },
          namespace,
          opts.declarationFilePath
        );
        if (!registered.ok) return registered;
      }

      return helperTypeRemaps;
    };

    for (const module of moduleList.sort((left, right) =>
      left.filePath.localeCompare(right.filePath)
    )) {
      const moduleKey = normalizeModuleFileKey(module.filePath);
      const sourceIndex = sourceIndexByFileKey.get(moduleKey);

      if (sourceIndex) {
        const registered = registerSourceTypeImportCandidates(
          sourceIndex,
          moduleKey,
          module.filePath
        );
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
            const registered = registerSourceTypeImportCandidates(
              declarationSourceIndex,
              declarationModuleKey,
              declarationModule.filePath
            );
            if (!registered.ok) return registered;
          }
          const registeredLocalTypeRefs =
            registerFacadeLocalTypeReferenceImports({
              declarationModule,
              declarationNamespace: declarationModule.namespace,
              declarationFilePath: declarationModule.filePath,
              sourceIndex: declarationSourceIndex,
              typeParameters: functionDeclaration.typeParameters,
              parameterTypes: functionDeclaration.parameters.map(
                (parameter) => parameter.type
              ),
              returnType: functionDeclaration.returnType,
            });
          if (!registeredLocalTypeRefs.ok) return registeredLocalTypeRefs;
          const registered = registerValueExport({
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
            const registered = registerSourceTypeImportCandidates(
              declarationSourceIndex,
              declarationModuleKey,
              declarationModule.filePath
            );
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
            });
          if (!registeredLocalTypeRefs.ok) return registeredLocalTypeRefs;
          const registered = registerValueExport({
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
              exportName: exportItem.name,
              localName: resolved.value.clrName,
              kind: exportKind.value,
              declaration,
              declaringNamespace: declarationModule.namespace,
              declaringClassName: declarationModule.className,
              declaringFilePath: declarationModule.filePath,
            });
            continue;
          }
          const declarationModuleKey = normalizeModuleFileKey(
            declarationModule.filePath
          );
          const declarationSourceIndex =
            sourceIndexByFileKey.get(declarationModuleKey);
          if (declarationSourceIndex) {
            const registered = registerSourceTypeImportCandidates(
              declarationSourceIndex,
              declarationModuleKey,
              declarationModule.filePath
            );
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
              declaringNamespace: symbol.declaringNamespace,
              exportName: symbol.exportName,
              localName: symbol.localName,
              kind:
                symbol.kind === "interface" || symbol.kind === "typeAlias"
                  ? "type"
                  : "value",
            });
            registerCrossNamespaceTypeDeclaration(symbol);
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
            const registered = registerSourceTypeImportCandidates(
              symbolSourceIndex,
              symbolModuleKey,
              symbol.declaringFilePath
            );
            if (!registered.ok) return registered;
          }
          const registeredLocalTypeRefs =
            registerFacadeLocalTypeReferenceImports({
              declarationModule: symbolDeclarationModule,
              declarationNamespace: symbol.declaringNamespace,
              declarationFilePath: symbol.declaringFilePath,
              sourceIndex: symbolSourceIndex,
              typeParameters: functionDeclaration.typeParameters,
              parameterTypes: functionDeclaration.parameters.map(
                (parameter) => parameter.type
              ),
              returnType: functionDeclaration.returnType,
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
          });
          if (!registered.ok) return registered;
          continue;
        }

        if (symbol.kind === "variable") {
          if (symbol.declaringNamespace !== namespace) {
            registerCrossNamespaceReexport({
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
            const registered = registerSourceTypeImportCandidates(
              symbolSourceIndex,
              symbolModuleKey,
              symbol.declaringFilePath
            );
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

    const anonymousHelperClassNamesByShape = new Map<string, string>();
    const registerAnonymousHelperClass = (
      emittedName: string,
      declaration: IrClassDeclaration
    ): void => {
      if (
        !emittedName.startsWith("__Anon_") &&
        !declaration.name.startsWith("__Anon_")
      ) {
        return;
      }

      const members: IrInterfaceMember[] = [];
      for (const member of declaration.members) {
        if (member.kind === "propertyDeclaration") {
          if (isPortableMarkerMemberName(member.name)) continue;
          members.push({
            kind: "propertySignature",
            name: member.name,
            type: member.type ?? { kind: "unknownType" },
            isOptional: false,
            isReadonly: member.isReadonly,
          });
          continue;
        }
        if (member.kind === "methodDeclaration") {
          if (isPortableMarkerMemberName(member.name)) continue;
          members.push({
            kind: "methodSignature",
            name: member.name,
            parameters: member.parameters,
            returnType: member.returnType,
            typeParameters: member.typeParameters,
          });
        }
      }

      const shape = renderPortableType(
        { kind: "objectType", members },
        declaration.typeParameters?.map(
          (typeParameter) => typeParameter.name
        ) ?? [],
        new Map(),
        new Map()
      );
      anonymousHelperClassNamesByShape.set(shape, emittedName);
    };

    for (const symbol of typeDeclarations) {
      if (
        symbol.kind === "class" &&
        symbol.declaration.kind === "classDeclaration"
      ) {
        registerAnonymousHelperClass(symbol.localName, symbol.declaration);
      }
    }
    for (const helper of internalHelperTypeDeclarationsByKey.values()) {
      if (helper.kind === "class") {
        registerAnonymousHelperClass(
          helper.emittedName,
          helper.declaration as IrClassDeclaration
        );
      }
    }

    for (const [moduleKey, sourceIndex] of sourceIndexByFileKey) {
      const sourceModule = modulesByFileKey.get(moduleKey);
      if (!sourceModule) continue;
      for (const [
        shape,
        anonymousType,
      ] of sourceIndex.anonymousTypeLiteralsByShape) {
        const className = anonymousHelperClassNamesByShape.get(shape);
        if (!className) continue;
        for (const [memberName, sourceMember] of anonymousType.members) {
          const wrappersResult = collectExtensionWrapperImportsFromSourceType({
            startModuleKey: moduleKey,
            typeNode: sourceMember.typeNode,
            sourceIndexByFileKey,
            modulesByFileKey,
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
          const wrapperRegistered = registerWrapperImports(
            wrappers,
            sourceModule.filePath
          );
          if (!wrapperRegistered.ok) return wrapperRegistered;
          memberOverrides.push({
            className,
            memberName,
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
    }

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

const writeNamespaceArtifacts = (
  config: ResolvedConfig,
  outDir: string,
  plan: NamespacePlan
): Result<void, string> => {
  const namespacePath = moduleNamespacePath(plan.namespace);
  const namespaceDir = join(outDir, namespacePath);
  const internalDir = join(namespaceDir, "internal");
  mkdirSync(internalDir, { recursive: true });

  const internalIndexPath = join(internalDir, "index.d.ts");
  const facadeDtsPath = join(outDir, `${namespacePath}.d.ts`);
  const facadeJsPath = join(outDir, `${namespacePath}.js`);
  const bindingsPath = join(namespaceDir, "bindings.json");

  const anonymousStructuralAliases = buildAnonymousStructuralAliasMap(plan);
  const internalBodyLines: string[] = [];
  const memberOverridesByClass = new Map<string, Map<string, MemberOverride>>();
  for (const override of plan.memberOverrides) {
    const byMember =
      memberOverridesByClass.get(override.className) ??
      new Map<string, MemberOverride>();
    byMember.set(override.memberName, override);
    memberOverridesByClass.set(override.className, byMember);
  }

  const typeBindings: FirstPartyBindingsType[] = [];

  for (const symbol of plan.typeDeclarations) {
    if (
      symbol.kind === "class" &&
      symbol.declaration.kind === "classDeclaration"
    ) {
      internalBodyLines.push(
        ...renderClassInternal(
          symbol.declaration,
          plan.namespace,
          memberOverridesByClass.get(symbol.declaration.name) ?? new Map()
        )
      );
      typeBindings.push(
        buildTypeBindingFromClass(
          symbol.declaration,
          plan.namespace,
          config.outputName
        )
      );
      continue;
    }

    if (
      symbol.kind === "interface" &&
      symbol.declaration.kind === "interfaceDeclaration"
    ) {
      internalBodyLines.push(
        ...renderInterfaceInternal(
          symbol.declaration,
          plan.namespace,
          memberOverridesByClass.get(symbol.declaration.name) ?? new Map()
        )
      );
      typeBindings.push(
        buildTypeBindingFromInterface(
          symbol.declaration,
          plan.namespace,
          config.outputName
        )
      );
      continue;
    }

    if (
      symbol.kind === "enum" &&
      symbol.declaration.kind === "enumDeclaration"
    ) {
      internalBodyLines.push(...renderEnumInternal(symbol.declaration));
      typeBindings.push(
        buildTypeBindingFromEnum(
          symbol.declaration,
          plan.namespace,
          config.outputName
        )
      );
      continue;
    }

    if (
      symbol.kind === "typeAlias" &&
      symbol.declaration.kind === "typeAliasDeclaration"
    ) {
      internalBodyLines.push(
        ...renderStructuralAliasInternal(
          symbol.declaration,
          plan.namespace,
          memberOverridesByClass.get(
            `${symbol.declaration.name}__Alias${
              (symbol.declaration.typeParameters?.length ?? 0) > 0
                ? `_${symbol.declaration.typeParameters?.length ?? 0}`
                : ""
            }`
          ) ?? new Map()
        )
      );
      const binding = buildTypeBindingFromStructuralAlias(
        symbol.declaration,
        plan.namespace,
        config.outputName
      );
      if (binding) typeBindings.push(binding);
    }
  }

  const helperRemapsByModuleKey = new Map<
    string,
    ReadonlyMap<string, string>
  >();
  for (const helper of plan.internalHelperTypeDeclarations) {
    const current = new Map(
      helperRemapsByModuleKey.get(helper.moduleFileKey) ?? []
    );
    current.set(helper.originalName, helper.emittedName);
    helperRemapsByModuleKey.set(helper.moduleFileKey, current);
  }

  for (const helper of plan.internalHelperTypeDeclarations) {
    const localTypeNameRemaps =
      helperRemapsByModuleKey.get(helper.moduleFileKey) ?? new Map();
    switch (helper.kind) {
      case "class":
        internalBodyLines.push(
          ...renderClassInternal(
            helper.declaration as IrClassDeclaration,
            helper.declaringNamespace,
            memberOverridesByClass.get(helper.emittedName) ??
              memberOverridesByClass.get(
                (helper.declaration as IrClassDeclaration).name
              ) ??
              new Map(),
            helper.emittedName,
            localTypeNameRemaps,
            (helper.declaration as IrClassDeclaration).name,
            (helper.declaration as IrClassDeclaration).name
          )
        );
        typeBindings.push(
          buildTypeBindingFromClass(
            helper.declaration as IrClassDeclaration,
            helper.declaringNamespace,
            config.outputName,
            localTypeNameRemaps
          )
        );
        continue;
      case "interface":
        internalBodyLines.push(
          ...renderInterfaceInternal(
            helper.declaration as IrInterfaceDeclaration,
            helper.declaringNamespace,
            memberOverridesByClass.get(helper.emittedName) ??
              memberOverridesByClass.get(
                (helper.declaration as IrInterfaceDeclaration).name
              ) ??
              new Map(),
            helper.emittedName,
            localTypeNameRemaps,
            (helper.declaration as IrInterfaceDeclaration).name,
            (helper.declaration as IrInterfaceDeclaration).name
          )
        );
        typeBindings.push(
          buildTypeBindingFromInterface(
            helper.declaration as IrInterfaceDeclaration,
            helper.declaringNamespace,
            config.outputName,
            localTypeNameRemaps
          )
        );
        continue;
      case "enum":
        internalBodyLines.push(
          ...renderEnumInternal(
            helper.declaration as IrEnumDeclaration,
            helper.emittedName
          )
        );
        typeBindings.push(
          buildTypeBindingFromEnum(
            helper.declaration as IrEnumDeclaration,
            helper.declaringNamespace,
            config.outputName
          )
        );
        continue;
      case "typeAlias": {
        const structuralLines = renderStructuralAliasInternal(
          helper.declaration as IrTypeAliasDeclaration,
          helper.declaringNamespace,
          memberOverridesByClass.get(helper.emittedName) ??
            memberOverridesByClass.get(
              `${(helper.declaration as IrTypeAliasDeclaration).name}__Alias${
                ((helper.declaration as IrTypeAliasDeclaration).typeParameters
                  ?.length ?? 0) > 0
                  ? `_${
                      (helper.declaration as IrTypeAliasDeclaration)
                        .typeParameters?.length ?? 0
                    }`
                  : ""
              }`
            ) ??
            new Map(),
          helper.emittedName,
          localTypeNameRemaps,
          `${(helper.declaration as IrTypeAliasDeclaration).name}__Alias${
            ((helper.declaration as IrTypeAliasDeclaration).typeParameters
              ?.length ?? 0) > 0
              ? `_${
                  (helper.declaration as IrTypeAliasDeclaration).typeParameters
                    ?.length ?? 0
                }`
              : ""
          }`,
          `${(helper.declaration as IrTypeAliasDeclaration).name}__Alias${
            ((helper.declaration as IrTypeAliasDeclaration).typeParameters
              ?.length ?? 0) > 0
              ? `_${
                  (helper.declaration as IrTypeAliasDeclaration).typeParameters
                    ?.length ?? 0
                }`
              : ""
          }`
        );
        if (structuralLines.length > 0) {
          internalBodyLines.push(...structuralLines);
          const binding = buildTypeBindingFromStructuralAlias(
            helper.declaration as IrTypeAliasDeclaration,
            helper.declaringNamespace,
            config.outputName,
            localTypeNameRemaps
          );
          if (binding) typeBindings.push(binding);
          continue;
        }
        internalBodyLines.push(
          ...renderTypeAliasInternal(
            helper.declaration as IrTypeAliasDeclaration,
            helper.emittedName,
            localTypeNameRemaps,
            anonymousStructuralAliases
          )
        );
        continue;
      }
    }
  }

  const renderedSourceAliases = plan.sourceAliases.map((sourceAliasPlan) =>
    renderSourceAliasPlan(sourceAliasPlan, anonymousStructuralAliases)
  );
  const sourceAliasLines = renderedSourceAliases.map((entry) => entry.line);
  const sourceAliasInternalImports = renderedSourceAliases
    .map((entry) => entry.internalImport)
    .filter((entry): entry is string => entry !== undefined)
    .sort((left, right) => left.localeCompare(right));

  for (const container of plan.moduleContainers) {
    internalBodyLines.push(
      ...renderContainerInternal(container, anonymousStructuralAliases)
    );
    typeBindings.push(
      buildTypeBindingFromContainer(
        container,
        plan.namespace,
        config.outputName
      )
    );
  }

  for (const symbol of plan.crossNamespaceTypeDeclarations) {
    if (
      symbol.kind === "class" &&
      symbol.declaration.kind === "classDeclaration"
    ) {
      typeBindings.push(
        buildTypeBindingFromClass(
          symbol.declaration,
          symbol.declaringNamespace,
          config.outputName
        )
      );
      continue;
    }

    if (
      symbol.kind === "interface" &&
      symbol.declaration.kind === "interfaceDeclaration"
    ) {
      typeBindings.push(
        buildTypeBindingFromInterface(
          symbol.declaration,
          symbol.declaringNamespace,
          config.outputName
        )
      );
      continue;
    }

    if (
      symbol.kind === "enum" &&
      symbol.declaration.kind === "enumDeclaration"
    ) {
      typeBindings.push(
        buildTypeBindingFromEnum(
          symbol.declaration,
          symbol.declaringNamespace,
          config.outputName
        )
      );
      continue;
    }

    if (
      symbol.kind === "typeAlias" &&
      symbol.declaration.kind === "typeAliasDeclaration"
    ) {
      const binding = buildTypeBindingFromStructuralAlias(
        symbol.declaration,
        symbol.declaringNamespace,
        config.outputName
      );
      if (binding) typeBindings.push(binding);
    }
  }

  const internalSourceAliasLines =
    sourceAliasLines.length > 0
      ? [
          "",
          "// Tsonic source type aliases (generated)",
          ...sourceAliasLines,
          "// End Tsonic source type aliases",
        ]
      : [];
  const requiredInternalTypeImports = selectSourceTypeImportsForRenderedText(
    [...internalSourceAliasLines, ...internalBodyLines].join("\n"),
    plan.internalTypeImports
  );

  const internalLines: string[] = [];
  internalLines.push("// Generated by Tsonic - Source bindings");
  internalLines.push(`// Namespace: ${plan.namespace}`);
  internalLines.push(`// Assembly: ${config.outputName}`);
  internalLines.push("");
  internalLines.push(primitiveImportLine);
  if (requiredInternalTypeImports.length > 0) {
    internalLines.push("");
    internalLines.push("// Tsonic source type imports (generated)");
    for (const typeImport of requiredInternalTypeImports) {
      if (typeImport.importedName === typeImport.localName) {
        internalLines.push(
          `import type { ${typeImport.importedName} } from '${typeImport.source}';`
        );
        continue;
      }
      internalLines.push(
        `import type { ${typeImport.importedName} as ${typeImport.localName} } from '${typeImport.source}';`
      );
    }
    internalLines.push("// End Tsonic source type imports");
  }
  if (plan.wrapperImports.length > 0) {
    internalLines.push("");
    internalLines.push("// Tsonic source member type imports (generated)");
    for (const wrapperImport of plan.wrapperImports) {
      if (wrapperImport.importedName === wrapperImport.aliasName) {
        internalLines.push(
          `import type { ${wrapperImport.importedName} } from '${wrapperImport.source}';`
        );
        continue;
      }
      internalLines.push(
        `import type { ${wrapperImport.importedName} as ${wrapperImport.aliasName} } from '${wrapperImport.source}';`
      );
    }
    internalLines.push("// End Tsonic source member type imports");
  }
  internalLines.push("");
  if (internalSourceAliasLines.length > 0) {
    internalLines.push(...internalSourceAliasLines);
    internalLines.push("");
  }
  internalLines.push(...internalBodyLines);

  writeFileSync(
    internalIndexPath,
    internalLines.join("\n").trimEnd() + "\n",
    "utf-8"
  );

  const internalSpecifier = moduleNamespaceToInternalSpecifier(plan.namespace);

  const facadeLines: string[] = [];
  facadeLines.push(`// Namespace: ${plan.namespace}`);
  facadeLines.push("// Generated by Tsonic - Source bindings");
  facadeLines.push("");
  facadeLines.push(`import * as Internal from '${internalSpecifier}';`);
  facadeLines.push("");

  for (const symbol of plan.typeDeclarations) {
    if (symbol.kind === "typeAlias") {
      continue;
    }
    const isValueType = symbol.kind === "class" || symbol.kind === "enum";
    const isSyntheticAnonymousClass =
      symbol.kind === "class" && symbol.localName.startsWith("__Anon_");
    if (isValueType) {
      const specifier =
        symbol.exportName === symbol.localName
          ? symbol.exportName
          : `${symbol.localName} as ${symbol.exportName}`;
      if (!isSyntheticAnonymousClass) {
        facadeLines.push(
          `export { ${specifier} } from '${internalSpecifier}';`
        );
      }
      facadeLines.push(
        `export type { ${specifier} } from '${internalSpecifier}';`
      );
      if (symbol.kind === "class") {
        facadeLines.push(
          `export type { ${symbol.localName}$instance } from '${internalSpecifier}';`
        );
      }
      continue;
    }

    const specifier =
      symbol.exportName === symbol.localName
        ? symbol.exportName
        : `${symbol.localName} as ${symbol.exportName}`;
    facadeLines.push(
      `export type { ${specifier} } from '${internalSpecifier}';`
    );
    if (symbol.kind === "interface") {
      facadeLines.push(
        `export type { ${symbol.localName}$instance } from '${internalSpecifier}';`
      );
    }
  }

  for (const container of plan.moduleContainers) {
    facadeLines.push(
      `export { ${container.module.className}$instance as ${container.module.className} } from '${internalSpecifier}';`
    );
  }

  const valueBindings = new Map<string, FirstPartyBindingsExport>();

  const localTypeImports = new Set<string>();
  for (const symbol of plan.typeDeclarations) {
    if (symbol.kind === "typeAlias") continue;
    localTypeImports.add(symbol.localName);
    if (symbol.kind === "class" || symbol.kind === "interface") {
      localTypeImports.add(`${symbol.localName}$instance`);
    }
  }
  for (const internalImport of sourceAliasInternalImports) {
    localTypeImports.add(internalImport);
  }
  for (const helper of plan.internalHelperTypeDeclarations) {
    localTypeImports.add(helper.emittedName);
  }

  if (localTypeImports.size > 0) {
    facadeLines.push("");
    facadeLines.push("// Tsonic source alias imports (generated)");
    facadeLines.push(
      `import type { ${Array.from(localTypeImports.values())
        .sort((left, right) => left.localeCompare(right))
        .join(", ")} } from '${internalSpecifier}';`
    );
    facadeLines.push("// End Tsonic source alias imports");
  }

  if (sourceAliasLines.length > 0) {
    facadeLines.push("");
    facadeLines.push("// Tsonic source type aliases (generated)");
    facadeLines.push(...sourceAliasLines);
    facadeLines.push("// End Tsonic source type aliases");
  }

  if (plan.crossNamespaceReexports.dtsStatements.length > 0) {
    facadeLines.push("");
    facadeLines.push("// Tsonic cross-namespace re-exports (generated)");
    facadeLines.push(...plan.crossNamespaceReexports.dtsStatements);
    facadeLines.push("// End Tsonic cross-namespace re-exports");
  }

  for (const valueExport of plan.valueExports) {
    valueBindings.set(valueExport.exportName, valueExport.binding);
    if (
      plan.crossNamespaceReexports.valueExportNames.has(valueExport.exportName)
    ) {
      continue;
    }
    if (valueExport.facade.kind === "function") {
      const sourceSignature = renderSourceFunctionSignature({
        declaration: valueExport.facade.declaration,
        sourceSignatures: valueExport.facade.sourceSignatures ?? [],
        localTypeNameRemaps: valueExport.facade.localTypeNameRemaps,
        anonymousStructuralAliases,
      });
      facadeLines.push(
        sourceSignature
          ? `export declare function ${valueExport.exportName}${sourceSignature.typeParametersText}(${sourceSignature.parametersText}): ${sourceSignature.returnTypeText};`
          : `export declare function ${valueExport.exportName}${printTypeParameters(
              valueExport.facade.declaration.typeParameters
            )}(${renderUnknownParameters(
              valueExport.facade.declaration.parameters,
              valueExport.facade.declaration.typeParameters?.map(
                (typeParameter) => typeParameter.name
              ) ?? [],
              valueExport.facade.localTypeNameRemaps,
              anonymousStructuralAliases
            )}): ${renderPortableType(
              valueExport.facade.declaration.returnType,
              valueExport.facade.declaration.typeParameters?.map(
                (typeParameter) => typeParameter.name
              ) ?? [],
              valueExport.facade.localTypeNameRemaps,
              anonymousStructuralAliases
            )};`
      );
      continue;
    }

    const sourceFunctionTypeText = renderSourceFunctionType({
      sourceSignatures: valueExport.facade.sourceSignatures ?? [],
      localTypeNameRemaps: valueExport.facade.localTypeNameRemaps,
      anonymousStructuralAliases,
    });
    const sourceTypeText =
      sourceFunctionTypeText ??
      renderSourceValueType(
        valueExport.facade.sourceType,
        valueExport.facade.localTypeNameRemaps,
        anonymousStructuralAliases
      );
    facadeLines.push(
      `export declare const ${valueExport.exportName}: ${
        sourceTypeText ??
        renderPortableType(
          valueExport.facade.declarator?.type,
          [],
          valueExport.facade.localTypeNameRemaps,
          anonymousStructuralAliases
        )
      };`
    );
  }

  const requiredFacadeTypeImports = selectSourceTypeImportsForRenderedText(
    facadeLines.join("\n"),
    plan.facadeTypeImports
  );
  if (requiredFacadeTypeImports.length > 0) {
    facadeLines.splice(
      4,
      0,
      "",
      "// Tsonic source type imports (generated)",
      ...requiredFacadeTypeImports.map((typeImport) =>
        typeImport.importedName === typeImport.localName
          ? `import type { ${typeImport.importedName} } from '${typeImport.source}';`
          : `import type { ${typeImport.importedName} as ${typeImport.localName} } from '${typeImport.source}';`
      ),
      "// End Tsonic source type imports"
    );
  }

  if (
    plan.typeDeclarations.length === 0 &&
    plan.moduleContainers.length === 0 &&
    plan.valueExports.length === 0 &&
    sourceAliasLines.length === 0 &&
    plan.crossNamespaceReexports.dtsStatements.length === 0
  ) {
    facadeLines.push("export {};");
  }

  writeFileSync(
    facadeDtsPath,
    facadeLines.join("\n").trimEnd() + "\n",
    "utf-8"
  );

  writeFileSync(
    facadeJsPath,
    [
      `// Namespace: ${plan.namespace}`,
      "// Generated by Tsonic - Source bindings",
      "// Module Stub - Do Not Execute",
      "",
      ...(plan.crossNamespaceReexports.jsValueStatements.length > 0
        ? [
            "// Tsonic cross-namespace value re-exports (generated)",
            ...plan.crossNamespaceReexports.jsValueStatements,
            "// End Tsonic cross-namespace value re-exports",
            "",
          ]
        : []),
      "throw new Error(",
      `  'Cannot import CLR namespace ${plan.namespace} in JavaScript runtime. ' +`,
      "  'This module provides TypeScript type definitions only. ' +",
      "  'Actual implementation requires .NET runtime via Tsonic compiler.'",
      ");",
      "",
    ].join("\n"),
    "utf-8"
  );

  const clrNamesByAlias = new Map<string, string>();
  for (const typeBinding of typeBindings) {
    clrNamesByAlias.set(typeBinding.alias, typeBinding.clrName);
    clrNamesByAlias.set(
      normalizeTypeReferenceName(typeBinding.alias, typeBinding.arity),
      typeBinding.clrName
    );
  }

  const normalizedTypeBindings = typeBindings.map((typeBinding) => ({
    ...typeBinding,
    methods: typeBinding.methods.map((method) => ({
      ...method,
      semanticSignature: method.semanticSignature
        ? {
            ...method.semanticSignature,
            parameters: method.semanticSignature.parameters.map(
              (parameter) => ({
                ...parameter,
                type:
                  reattachBindingClrIdentities(
                    parameter.type,
                    clrNamesByAlias
                  ) ?? parameter.type,
              })
            ),
            returnType: reattachBindingClrIdentities(
              method.semanticSignature.returnType,
              clrNamesByAlias
            ),
          }
        : undefined,
    })),
    properties: typeBinding.properties.map((property) => ({
      ...property,
      semanticType: reattachBindingClrIdentities(
        property.semanticType,
        clrNamesByAlias
      ),
    })),
    fields: typeBinding.fields.map((field) => ({
      ...field,
      semanticType: reattachBindingClrIdentities(
        field.semanticType,
        clrNamesByAlias
      ),
    })),
  }));

  const normalizedValueBindings =
    valueBindings.size > 0
      ? new Map(
          Array.from(valueBindings.entries()).map(([exportName, binding]) => [
            exportName,
            {
              ...binding,
              semanticType: reattachBindingClrIdentities(
                binding.semanticType,
                clrNamesByAlias
              ),
              semanticSignature: binding.semanticSignature
                ? {
                    ...binding.semanticSignature,
                    parameters: binding.semanticSignature.parameters.map(
                      (parameter) => ({
                        ...parameter,
                        type:
                          reattachBindingClrIdentities(
                            parameter.type,
                            clrNamesByAlias
                          ) ?? parameter.type,
                      })
                    ),
                    returnType: reattachBindingClrIdentities(
                      binding.semanticSignature.returnType,
                      clrNamesByAlias
                    ),
                  }
                : undefined,
            } satisfies FirstPartyBindingsExport,
          ])
        )
      : undefined;

  const bindings: FirstPartyBindingsFile = {
    namespace: plan.namespace,
    contributingAssemblies: [config.outputName],
    types: normalizedTypeBindings.sort((left, right) =>
      left.clrName.localeCompare(right.clrName)
    ),
    exports:
      normalizedValueBindings && normalizedValueBindings.size > 0
        ? Object.fromEntries(
            Array.from(normalizedValueBindings.entries()).sort((left, right) =>
              left[0].localeCompare(right[0])
            )
          )
        : undefined,
    producer: {
      tool: "tsonic",
      mode: "aikya-firstparty",
    },
  };

  writeFileSync(
    bindingsPath,
    JSON.stringify(serializeBindingsJsonSafe(bindings), null, 2) + "\n",
    "utf-8"
  );
  return { ok: true, value: undefined };
};

export const generateFirstPartyLibraryBindings = (
  config: ResolvedConfig,
  bindingsOutDir: string
): Result<void, string> => {
  if (!config.entryPoint) {
    return {
      ok: false,
      error:
        "Library bindings generation requires an entryPoint in tsonic.json.",
    };
  }

  const absoluteEntryPoint = resolve(config.projectRoot, config.entryPoint);
  const absoluteSourceRoot = resolve(config.projectRoot, config.sourceRoot);
  const surfaceCapabilities = resolveSurfaceCapabilities(config.surface, {
    workspaceRoot: config.workspaceRoot,
  });

  const typeLibraries = config.libraries.filter(
    (library) => !library.endsWith(".dll")
  );
  const allTypeRoots = [...config.typeRoots, ...typeLibraries].map((typeRoot) =>
    resolve(config.workspaceRoot, typeRoot)
  );

  const compilerOptions: CompilerOptions = {
    projectRoot: config.projectRoot,
    sourceRoot: absoluteSourceRoot,
    rootNamespace: config.rootNamespace,
    typeRoots: allTypeRoots,
    surface: config.surface,
    useStandardLib: surfaceCapabilities.useStandardLib,
    verbose: false,
  };

  const graphResult = buildModuleDependencyGraph(
    absoluteEntryPoint,
    compilerOptions
  );
  if (!graphResult.ok) {
    const message = graphResult.error
      .map((diagnostic) =>
        diagnostic.location
          ? `${diagnostic.location.file}:${diagnostic.location.line}:${diagnostic.location.column} ${diagnostic.message}`
          : diagnostic.message
      )
      .join("\n");
    return {
      ok: false,
      error: `Failed to generate first-party bindings from source:\n${message}`,
    };
  }

  rmSync(bindingsOutDir, { recursive: true, force: true });
  mkdirSync(bindingsOutDir, { recursive: true });

  const sourceIndexByFileKey = new Map<string, ModuleSourceIndex>();
  for (const module of graphResult.value.modules) {
    if (module.filePath.startsWith("__tsonic/")) continue;
    const moduleKey = normalizeModuleFileKey(module.filePath);
    const absolutePath = resolve(absoluteSourceRoot, moduleKey);
    const indexed = buildModuleSourceIndex(absolutePath, moduleKey);
    if (!indexed.ok) return indexed;
    sourceIndexByFileKey.set(moduleKey, indexed.value);
  }

  const plansResult = collectNamespacePlans(
    graphResult.value.modules,
    config.outputName,
    config.rootNamespace,
    sourceIndexByFileKey
  );
  if (!plansResult.ok) return plansResult;

  for (const plan of plansResult.value) {
    const result = writeNamespaceArtifacts(config, bindingsOutDir, plan);
    if (!result.ok) return result;
  }

  const overlayResult = overlayDependencyBindings(config, bindingsOutDir);
  if (!overlayResult.ok) return overlayResult;

  return { ok: true, value: undefined };
};
