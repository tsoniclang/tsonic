import type {
  IrFunctionDeclaration,
  IrModule,
  IrVariableDeclaration,
} from "@tsonic/frontend";
import type { Result } from "../../../types.js";
import {
  buildSemanticSignatureFromFunctionType,
  resolveFunctionTypeFromValueDeclarator,
  rewriteBindingSemanticType,
  toClrTypeName,
} from "../binding-semantics.js";
import { normalizeModuleFileKey } from "../module-paths.js";
import {
  registerFacadeLocalTypeReferenceImports,
  registerSourceTypeImportCandidates,
  registerValueExport,
} from "../namespace-planning-helpers.js";
import type { ExportedSymbol, ModuleContainerEntry } from "../types.js";
import type { NamespacePlanBuilder } from "./state.js";

export const registerFunctionExport = (opts: {
  readonly builder: NamespacePlanBuilder;
  readonly declarationModule: IrModule;
  readonly declaringNamespace: string;
  readonly declaringFilePath: string;
  readonly localName: string;
  readonly exportName: string;
  readonly functionDeclaration: IrFunctionDeclaration;
  readonly containerMethods?: ModuleContainerEntry["methods"];
  readonly containerModule?: IrModule;
}): Result<void, string> => {
  const declarationModuleKey = normalizeModuleFileKey(opts.declaringFilePath);
  const declarationSourceIndex =
    opts.builder.sourceIndexByFileKey.get(declarationModuleKey);
  if (declarationSourceIndex) {
    const registered = registerSourceTypeImportCandidates({
      namespace: opts.builder.namespace,
      sourceIndex: declarationSourceIndex,
      moduleKey: declarationModuleKey,
      moduleFilePath: opts.declaringFilePath,
      modulesByFileKey: opts.builder.modulesByFileKey,
      internalTypeImportByAlias: opts.builder.internalTypeImportByAlias,
      facadeTypeImportByAlias: opts.builder.facadeTypeImportByAlias,
    });
    if (!registered.ok) return registered;
  }
  const registeredLocalTypeRefs = registerFacadeLocalTypeReferenceImports({
    namespace: opts.builder.namespace,
    declarationModule: opts.declarationModule,
    declarationNamespace: opts.declaringNamespace,
    declarationFilePath: opts.declaringFilePath,
    sourceIndex: declarationSourceIndex,
    typeParameters: opts.functionDeclaration.typeParameters,
    parameterTypes: opts.functionDeclaration.parameters.map(
      (parameter) => parameter.type
    ),
    returnType: opts.functionDeclaration.returnType,
    sourceIndexByFileKey: opts.builder.sourceIndexByFileKey,
    modulesByFileKey: opts.builder.modulesByFileKey,
    facadeTypeImportByAlias: opts.builder.facadeTypeImportByAlias,
    internalHelperTypeRemapsByModuleKey:
      opts.builder.internalHelperTypeRemapsByModuleKey,
    internalHelperTypeDeclarationsByKey:
      opts.builder.internalHelperTypeDeclarationsByKey,
  });
  if (!registeredLocalTypeRefs.ok) return registeredLocalTypeRefs;

  const isLocalContainerMember =
    opts.containerMethods &&
    opts.containerModule &&
    opts.declaringNamespace === opts.containerModule.namespace &&
    opts.declarationModule.className === opts.containerModule.className;
  if (isLocalContainerMember) {
    opts.containerMethods.push({
      exportName: opts.exportName,
      localName: opts.localName,
      declaration: opts.functionDeclaration,
      localTypeNameRemaps: registeredLocalTypeRefs.value,
      sourceSignatures:
        opts.builder.sourceIndexByFileKey
          .get(normalizeModuleFileKey(opts.declaringFilePath))
          ?.exportedFunctionSignaturesByName.get(opts.localName) ?? [],
    });
  }

  return registerValueExport({
    namespace: opts.builder.namespace,
    valueExportsMap: opts.builder.valueExportsMap,
    valueExport: {
      exportName: opts.exportName,
      binding: {
        kind: "method",
        clrName: opts.localName,
        declaringClrType: toClrTypeName(
          opts.declaringNamespace,
          opts.declarationModule.className
        ),
        declaringAssemblyName: opts.builder.assemblyName,
      },
      facade: {
        kind: "function",
        declaration: opts.functionDeclaration,
        localTypeNameRemaps: registeredLocalTypeRefs.value,
        sourceSignatures:
          opts.builder.sourceIndexByFileKey
            .get(normalizeModuleFileKey(opts.declaringFilePath))
            ?.exportedFunctionSignaturesByName.get(opts.localName) ?? [],
      },
    },
  });
};

export const registerVariableExport = (opts: {
  readonly builder: NamespacePlanBuilder;
  readonly symbol: Pick<
    ExportedSymbol,
    | "exportName"
    | "localName"
    | "declaringNamespace"
    | "declaringClassName"
    | "declaringFilePath"
  >;
  readonly declarationModule: IrModule;
  readonly declaration: IrVariableDeclaration;
  readonly containerVariables?: ModuleContainerEntry["variables"];
  readonly containerModule?: IrModule;
}): Result<void, string> => {
  const declarationModuleKey = normalizeModuleFileKey(
    opts.symbol.declaringFilePath
  );
  const declarationSourceIndex =
    opts.builder.sourceIndexByFileKey.get(declarationModuleKey);
  if (declarationSourceIndex) {
    const registered = registerSourceTypeImportCandidates({
      namespace: opts.builder.namespace,
      sourceIndex: declarationSourceIndex,
      moduleKey: declarationModuleKey,
      moduleFilePath: opts.symbol.declaringFilePath,
      modulesByFileKey: opts.builder.modulesByFileKey,
      internalTypeImportByAlias: opts.builder.internalTypeImportByAlias,
      facadeTypeImportByAlias: opts.builder.facadeTypeImportByAlias,
    });
    if (!registered.ok) return registered;
  }
  const declarator = opts.declaration.declarations.find(
    (candidate) =>
      candidate.name.kind === "identifierPattern" &&
      candidate.name.name === opts.symbol.localName
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
  const registeredLocalTypeRefs = registerFacadeLocalTypeReferenceImports({
    namespace: opts.builder.namespace,
    declarationModule: opts.declarationModule,
    declarationNamespace: opts.symbol.declaringNamespace,
    declarationFilePath: opts.symbol.declaringFilePath,
    sourceIndex: declarationSourceIndex,
    typeParameters: undefined,
    parameterTypes: exportedFunctionType
      ? [exportedFunctionType]
      : declarator?.type
        ? [declarator.type]
        : [],
    returnType: undefined,
    sourceIndexByFileKey: opts.builder.sourceIndexByFileKey,
    modulesByFileKey: opts.builder.modulesByFileKey,
    facadeTypeImportByAlias: opts.builder.facadeTypeImportByAlias,
    internalHelperTypeRemapsByModuleKey:
      opts.builder.internalHelperTypeRemapsByModuleKey,
    internalHelperTypeDeclarationsByKey:
      opts.builder.internalHelperTypeDeclarationsByKey,
  });
  if (!registeredLocalTypeRefs.ok) return registeredLocalTypeRefs;

  const isLocalContainerMember =
    opts.containerVariables &&
    opts.containerModule &&
    opts.symbol.declaringNamespace === opts.containerModule.namespace &&
    opts.symbol.declaringClassName === opts.containerModule.className;
  if (isLocalContainerMember) {
    opts.containerVariables.push({
      exportName: opts.symbol.exportName,
      localName: opts.symbol.localName,
      declaration: opts.declaration,
      declarator: exportDeclarator,
      localTypeNameRemaps: registeredLocalTypeRefs.value,
      sourceType: opts.builder.sourceIndexByFileKey
        .get(normalizeModuleFileKey(opts.symbol.declaringFilePath))
        ?.exportedValueTypesByName.get(opts.symbol.localName),
      sourceSignatures:
        opts.builder.sourceIndexByFileKey
          .get(normalizeModuleFileKey(opts.symbol.declaringFilePath))
          ?.exportedFunctionSignaturesByName.get(opts.symbol.localName) ?? [],
    });
  }

  return registerValueExport({
    namespace: opts.builder.namespace,
    valueExportsMap: opts.builder.valueExportsMap,
    valueExport: {
      exportName: opts.symbol.exportName,
      binding: {
        kind: exportedFunctionType ? "functionType" : "field",
        clrName: opts.symbol.localName,
        declaringClrType: toClrTypeName(
          opts.symbol.declaringNamespace,
          opts.symbol.declaringClassName
        ),
        declaringAssemblyName: opts.builder.assemblyName,
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
        sourceType: declarationSourceIndex?.exportedValueTypesByName.get(
          opts.symbol.localName
        ),
        sourceSignatures:
          declarationSourceIndex?.exportedFunctionSignaturesByName.get(
            opts.symbol.localName
          ) ?? [],
        declarator: exportDeclarator,
      },
    },
  });
};
