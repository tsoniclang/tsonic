import type { IrModule } from "@tsonic/frontend";
import type {
  ExportedSymbol,
  FirstPartyBindingsExport,
  FirstPartyValueExportFacade,
  InternalHelperTypeDeclaration,
  MemberOverride,
  ModuleContainerEntry,
  ModuleSourceIndex,
  SourceAliasPlan,
  SourceTypeImportBinding,
  WrapperImport,
} from "../types.js";

export interface NamespaceValueExportEntry {
  readonly exportName: string;
  readonly binding: FirstPartyBindingsExport;
  readonly facade: FirstPartyValueExportFacade;
}

export interface NamespacePlanBuilder {
  readonly namespace: string;
  readonly assemblyName: string;
  readonly sourceIndexByFileKey: ReadonlyMap<string, ModuleSourceIndex>;
  readonly modulesByFileKey: ReadonlyMap<string, IrModule>;
  readonly typeDeclarations: ExportedSymbol[];
  readonly moduleContainers: ModuleContainerEntry[];
  readonly crossNamespaceReexportsGrouped: Map<string, string[]>;
  readonly crossNamespaceTypeDeclarations: ExportedSymbol[];
  readonly seenCrossNamespaceTypeDeclarationKeys: Set<string>;
  readonly valueExportsMap: Map<string, NamespaceValueExportEntry>;
  readonly seenTypeDeclarationKeys: Set<string>;
  readonly sourceAliasPlans: SourceAliasPlan[];
  readonly memberOverrides: MemberOverride[];
  readonly internalTypeImportByAlias: Map<string, SourceTypeImportBinding>;
  readonly facadeTypeImportByAlias: Map<string, SourceTypeImportBinding>;
  readonly wrapperImportByAlias: Map<string, WrapperImport>;
  readonly internalHelperTypeDeclarationsByKey: Map<
    string,
    InternalHelperTypeDeclaration
  >;
  readonly internalHelperTypeRemapsByModuleKey: Map<string, Map<string, string>>;
}

export const createNamespacePlanBuilder = (opts: {
  readonly namespace: string;
  readonly assemblyName: string;
  readonly sourceIndexByFileKey: ReadonlyMap<string, ModuleSourceIndex>;
  readonly modulesByFileKey: ReadonlyMap<string, IrModule>;
}): NamespacePlanBuilder => ({
  namespace: opts.namespace,
  assemblyName: opts.assemblyName,
  sourceIndexByFileKey: opts.sourceIndexByFileKey,
  modulesByFileKey: opts.modulesByFileKey,
  typeDeclarations: [],
  moduleContainers: [],
  crossNamespaceReexportsGrouped: new Map(),
  crossNamespaceTypeDeclarations: [],
  seenCrossNamespaceTypeDeclarationKeys: new Set(),
  valueExportsMap: new Map(),
  seenTypeDeclarationKeys: new Set(),
  sourceAliasPlans: [],
  memberOverrides: [],
  internalTypeImportByAlias: new Map(),
  facadeTypeImportByAlias: new Map(),
  wrapperImportByAlias: new Map(),
  internalHelperTypeDeclarationsByKey: new Map(),
  internalHelperTypeRemapsByModuleKey: new Map(),
});
