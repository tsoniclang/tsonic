import type {
  MemberSymbolId,
  ModuleSymbolId,
  TypeSymbolId,
} from "./symbol-ids.js";
import type { BackendTargetId } from "../ir/types/phases.js";

export type TargetSymbolOrigin =
  | "source"
  | "externalSurface"
  | "compilerIntrinsic";

export type TargetImportResolution =
  | { readonly kind: "notTargetSurface" }
  | {
      readonly kind: "targetSurface";
      readonly moduleSymbolId: ModuleSymbolId;
      readonly exports: ReadonlyMap<string, TargetExportSymbol>;
    };

export type TargetExportSymbol =
  | { readonly kind: "type"; readonly typeSymbolId: TypeSymbolId }
  | { readonly kind: "member"; readonly memberSymbolId: MemberSymbolId }
  | { readonly kind: "module"; readonly moduleSymbolId: ModuleSymbolId };

export type TargetSurfaceProvider = {
  readonly targetId: BackendTargetId;
  resolveImport(
    specifier: string,
    containingFile: string
  ): TargetImportResolution;
  getArtifacts(): TargetSurfaceArtifacts;
};

export type TypeSymbol = {
  readonly symbolId: TypeSymbolId;
  readonly stableId: string;
  readonly sourceName: string;
  readonly ownerIdentity: string;
  readonly origin: TargetSymbolOrigin;
};

export type MemberSymbol = {
  readonly symbolId: MemberSymbolId;
  readonly ownerTypeSymbolId?: TypeSymbolId;
  readonly stableId: string;
  readonly sourceName: string;
  readonly ownerIdentity: string;
  readonly origin: TargetSymbolOrigin;
};

export type ModuleSymbol = {
  readonly symbolId: ModuleSymbolId;
  readonly stableId: string;
  readonly sourceName: string;
  readonly ownerIdentity: string;
  readonly origin: TargetSymbolOrigin;
};

export type TargetSurfaceSnapshot = {
  readonly types: ReadonlyMap<TypeSymbolId, TypeSymbol>;
  readonly members: ReadonlyMap<MemberSymbolId, MemberSymbol>;
  readonly modules: ReadonlyMap<ModuleSymbolId, ModuleSymbol>;
};

export type TargetTypeRenderInfo = {
  readonly symbolId: TypeSymbolId;
  readonly qualifiedName: string;
  readonly ownerIdentity: string;
};

export type TargetMemberRenderInfo = {
  readonly symbolId: MemberSymbolId;
  readonly ownerTypeSymbolId?: TypeSymbolId;
  readonly ownerQualifiedName: string;
  readonly memberName: string;
  readonly ownerIdentity: string;
};

export type TargetModuleRenderInfo = {
  readonly symbolId: ModuleSymbolId;
  readonly qualifiedName: string;
  readonly ownerIdentity: string;
};

export type TargetRenderTable = {
  readonly types: ReadonlyMap<TypeSymbolId, TargetTypeRenderInfo>;
  readonly members: ReadonlyMap<MemberSymbolId, TargetMemberRenderInfo>;
  readonly modules: ReadonlyMap<ModuleSymbolId, TargetModuleRenderInfo>;
};

export type TargetSurfaceArtifacts = {
  readonly surface: TargetSurfaceSnapshot;
  readonly renderTable: TargetRenderTable;
};

export const emptyTargetSurfaceArtifacts = (): TargetSurfaceArtifacts => ({
  surface: {
    types: new Map(),
    members: new Map(),
    modules: new Map(),
  },
  renderTable: {
    types: new Map(),
    members: new Map(),
    modules: new Map(),
  },
});
