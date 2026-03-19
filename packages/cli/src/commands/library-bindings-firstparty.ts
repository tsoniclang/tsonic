import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
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
  collectReferencedPortableTypeNames,
  collectReferencedPortableTypeNamesFromDeclaration,
} from "./library-bindings-firstparty/anonymous-structural.js";
import {
  areBindingSemanticsEqual,
  buildSemanticSignatureFromFunctionType,
  resolveFunctionTypeFromValueDeclarator,
  rewriteBindingSemanticType,
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
  printTypeNodeText,
  printTypeParameters,
  renderPortableType,
  renderUnknownParameters,
  sanitizeForBrand,
} from "./library-bindings-firstparty/portable-types.js";
import {
  registerSourceTypeImportBinding,
  resolveSourceTypeImportBinding,
} from "./library-bindings-firstparty/source-imports.js";
import { writeNamespaceArtifacts } from "./library-bindings-firstparty/namespace-artifacts.js";
import type {
  ExportedSymbol,
  FirstPartyBindingsExport,
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
