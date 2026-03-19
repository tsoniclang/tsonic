import type {
  IrClassDeclaration,
  IrEnumDeclaration,
  IrInterfaceDeclaration,
  IrModule,
  IrStatement,
  IrType,
  IrTypeParameter,
  IrTypeAliasDeclaration,
} from "@tsonic/frontend";
import {
  renderSourceFunctionParametersText,
  type SourceFunctionSignatureSurface as SourceFunctionSignatureDef,
} from "../../../aikya/source-function-surfaces.js";
import type { Result } from "../../../types.js";
import {
  collectReferencedPortableTypeNames,
  collectReferencedPortableTypeNamesFromDeclaration,
} from "../anonymous-structural.js";
import {
  areBindingSemanticsEqual,
  buildSemanticSignatureFromFunctionType,
  resolveFunctionTypeFromValueDeclarator,
  stableSerializeBindingSemanticValue,
} from "../binding-semantics.js";
import {
  classifyLocalTypeDeclarationKind,
  resolveModuleLocalDeclaration,
} from "../export-resolution.js";
import { moduleNamespacePath } from "../module-paths.js";
import {
  printTypeParameters,
  renderPortableType,
  renderUnknownParameters,
  sanitizeForBrand,
} from "../portable-types.js";
import {
  registerSourceTypeImportBinding,
  resolveSourceTypeImportBinding,
} from "../source-imports.js";
import type {
  ExportedSymbol,
  FirstPartyBindingsExport,
  FirstPartyValueDeclarator,
  FirstPartyValueExportFacade,
  InternalHelperTypeDeclaration,
  ModuleSourceIndex,
  SourceTypeImportBinding,
  WrapperImport,
} from "../types.js";

export const registerInternalHelperTypeClosure = (opts: {
  readonly declarationModule: IrModule;
  readonly sourceIndex: ModuleSourceIndex | undefined;
  readonly referencedNames: ReadonlySet<string>;
  readonly modulesByFileKey: ReadonlyMap<string, IrModule>;
  readonly internalHelperTypeRemapsByModuleKey: Map<
    string,
    Map<string, string>
  >;
  readonly internalHelperTypeDeclarationsByKey: Map<
    string,
    InternalHelperTypeDeclaration
  >;
}): Result<ReadonlyMap<string, string>, string> => {
  if (!opts.sourceIndex) return { ok: true, value: new Map() };

  const moduleFileKey = opts.sourceIndex.fileKey;
  const remaps =
    opts.internalHelperTypeRemapsByModuleKey.get(moduleFileKey) ?? new Map();
  if (!opts.internalHelperTypeRemapsByModuleKey.has(moduleFileKey)) {
    opts.internalHelperTypeRemapsByModuleKey.set(moduleFileKey, remaps);
  }
  const visiting = new Set<string>();

  const getInternalHelperTypeName = (
    currentModuleFileKey: string,
    localName: string
  ): string => {
    return `__Local_${sanitizeForBrand(currentModuleFileKey)}_${sanitizeForBrand(localName)}`;
  };

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
    if (opts.internalHelperTypeDeclarationsByKey.has(key)) {
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

    opts.internalHelperTypeDeclarationsByKey.set(key, {
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

export const registerValueExport = (opts: {
  readonly namespace: string;
  readonly valueExportsMap: Map<
    string,
    {
      readonly exportName: string;
      readonly binding: FirstPartyBindingsExport;
      readonly facade: FirstPartyValueExportFacade;
    }
  >;
  readonly valueExport: {
    readonly exportName: string;
    readonly binding: FirstPartyBindingsExport;
    readonly facade: FirstPartyValueExportFacade;
  };
}): Result<void, string> => {
  const existing = opts.valueExportsMap.get(opts.valueExport.exportName);
  if (!existing) {
    opts.valueExportsMap.set(opts.valueExport.exportName, opts.valueExport);
    return { ok: true, value: undefined };
  }
  const sameBinding = areBindingSemanticsEqual(
    existing.binding,
    opts.valueExport.binding
  );
  const normalizeFunctionFacade = (facade: {
    readonly declaration: Extract<IrStatement, { kind: "functionDeclaration" }>;
    readonly sourceSignatures?: readonly SourceFunctionSignatureDef[];
    readonly localTypeNameRemaps: ReadonlyMap<string, string>;
  }): string => {
    const declaration = facade.declaration;
    const typeParametersText = printTypeParameters(declaration.typeParameters);
    const typeParameterNames =
      declaration.typeParameters?.map((typeParameter) => typeParameter.name) ??
      [];
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
    if (existing.facade.kind !== opts.valueExport.facade.kind) return false;
    if (
      existing.facade.kind === "function" &&
      opts.valueExport.facade.kind === "function"
    ) {
      return (
        normalizeFunctionFacade(existing.facade) ===
        normalizeFunctionFacade(opts.valueExport.facade)
      );
    }
    if (
      existing.facade.kind === "variable" &&
      opts.valueExport.facade.kind === "variable"
    ) {
      return (
        normalizeVariableFacade(
          existing.facade.declarator,
          existing.facade.localTypeNameRemaps
        ) ===
        normalizeVariableFacade(
          opts.valueExport.facade.declarator,
          opts.valueExport.facade.localTypeNameRemaps
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
      `Conflicting value export '${opts.valueExport.exportName}' in namespace ${opts.namespace}.\n` +
      "First-party bindings generation requires each exported value name to map deterministically to exactly one CLR member.",
  };
};

export const registerWrapperImports = (
  wrapperImportByAlias: Map<string, WrapperImport>,
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

export const registerCrossNamespaceReexport = (opts: {
  readonly namespace: string;
  readonly crossNamespaceReexportsGrouped: Map<string, string[]>;
  readonly declaringNamespace: string;
  readonly exportName: string;
  readonly localName: string;
  readonly kind: "type" | "value";
}): void => {
  if (opts.declaringNamespace === opts.namespace) return;
  const moduleSpecifier = `./${moduleNamespacePath(opts.declaringNamespace)}.js`;
  const key = `${moduleSpecifier}|${opts.kind}`;
  const specifier =
    opts.exportName === opts.localName
      ? opts.exportName
      : `${opts.localName} as ${opts.exportName}`;
  const existing = opts.crossNamespaceReexportsGrouped.get(key) ?? [];
  existing.push(specifier);
  opts.crossNamespaceReexportsGrouped.set(key, existing);
};

export const registerCrossNamespaceTypeDeclaration = (opts: {
  readonly namespace: string;
  readonly crossNamespaceTypeDeclarations: ExportedSymbol[];
  readonly seenCrossNamespaceTypeDeclarationKeys: Set<string>;
  readonly symbol: ExportedSymbol;
}): void => {
  if (opts.symbol.declaringNamespace === opts.namespace) return;
  const key = `${opts.symbol.declaringNamespace}|${opts.symbol.declaringClassName}|${opts.symbol.localName}|${opts.symbol.kind}`;
  if (opts.seenCrossNamespaceTypeDeclarationKeys.has(key)) return;
  opts.seenCrossNamespaceTypeDeclarationKeys.add(key);
  opts.crossNamespaceTypeDeclarations.push(opts.symbol);
};

export const registerSourceTypeImportCandidates = (opts: {
  readonly namespace: string;
  readonly sourceIndex: ModuleSourceIndex;
  readonly moduleKey: string;
  readonly moduleFilePath: string;
  readonly modulesByFileKey: ReadonlyMap<string, IrModule>;
  readonly internalTypeImportByAlias: Map<string, SourceTypeImportBinding>;
  readonly facadeTypeImportByAlias: Map<string, SourceTypeImportBinding>;
}): Result<void, string> => {
  for (const [localName, imported] of opts.sourceIndex.typeImportsByLocalName) {
    if (opts.sourceIndex.wrapperImportsByLocalName.has(localName)) continue;

    const internalImport = resolveSourceTypeImportBinding({
      context: "internal",
      currentNamespace: opts.namespace,
      currentModuleKey: opts.moduleKey,
      localName,
      imported,
      modulesByFileKey: opts.modulesByFileKey,
    });
    if (!internalImport.ok) return internalImport;
    if (internalImport.value) {
      const registered = registerSourceTypeImportBinding(
        opts.internalTypeImportByAlias,
        internalImport.value,
        opts.namespace,
        opts.moduleFilePath
      );
      if (!registered.ok) return registered;
    }

    const facadeImport = resolveSourceTypeImportBinding({
      context: "facade",
      currentNamespace: opts.namespace,
      currentModuleKey: opts.moduleKey,
      localName,
      imported,
      modulesByFileKey: opts.modulesByFileKey,
    });
    if (!facadeImport.ok) return facadeImport;
    if (facadeImport.value) {
      const registered = registerSourceTypeImportBinding(
        opts.facadeTypeImportByAlias,
        facadeImport.value,
        opts.namespace,
        opts.moduleFilePath
      );
      if (!registered.ok) return registered;
    }
  }

  return { ok: true, value: undefined };
};

export const registerFacadeLocalTypeReferenceImports = (opts: {
  readonly namespace: string;
  readonly declarationModule: IrModule;
  readonly declarationNamespace: string;
  readonly declarationFilePath: string;
  readonly sourceIndex: ModuleSourceIndex | undefined;
  readonly typeParameters: readonly IrTypeParameter[] | undefined;
  readonly parameterTypes: readonly (IrType | undefined)[];
  readonly returnType: IrType | undefined;
  readonly sourceIndexByFileKey: ReadonlyMap<string, ModuleSourceIndex>;
  readonly modulesByFileKey: ReadonlyMap<string, IrModule>;
  readonly facadeTypeImportByAlias: Map<string, SourceTypeImportBinding>;
  readonly internalHelperTypeRemapsByModuleKey: Map<
    string,
    Map<string, string>
  >;
  readonly internalHelperTypeDeclarationsByKey: Map<
    string,
    InternalHelperTypeDeclaration
  >;
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
    modulesByFileKey: opts.modulesByFileKey,
    internalHelperTypeRemapsByModuleKey:
      opts.internalHelperTypeRemapsByModuleKey,
    internalHelperTypeDeclarationsByKey:
      opts.internalHelperTypeDeclarationsByKey,
  });
  if (!helperTypeRemaps.ok) return helperTypeRemaps;
  if (!opts.sourceIndex) return helperTypeRemaps;

  if (opts.declarationNamespace === opts.namespace) {
    return helperTypeRemaps;
  }

  const moduleSpecifier = `./${moduleNamespacePath(opts.declarationNamespace)}.js`;
  for (const referencedName of referencedNames) {
    if (!opts.sourceIndex.exportedTypeDeclarationNames.has(referencedName)) {
      continue;
    }
    const registered = registerSourceTypeImportBinding(
      opts.facadeTypeImportByAlias,
      {
        importedName: referencedName,
        localName: referencedName,
        source: moduleSpecifier,
      },
      opts.namespace,
      opts.declarationFilePath
    );
    if (!registered.ok) return registered;
  }

  return helperTypeRemaps;
};
