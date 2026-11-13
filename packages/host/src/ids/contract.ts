type NumericIdentity<KindName extends string> = number & {
  readonly identityKind: KindName;
};

type TextIdentity<KindName extends string> = string & {
  readonly identityKind: KindName;
};

export type PackageId = TextIdentity<"package">;
export type ModuleId = TextIdentity<"module">;
export type DefId = TextIdentity<"definition">;
export type BodyId = TextIdentity<"body">;
export type GroupId = TextIdentity<"inference-group">;
export type ComponentId = TextIdentity<"call-component">;
export type ExpansionId = TextIdentity<"expansion">;
export type NodeId = NumericIdentity<"node">;
export type LocalId = NumericIdentity<"local">;
export type BlockId = NumericIdentity<"block">;
export type PlaceId = NumericIdentity<"place">;
export type TyId = NumericIdentity<"type">;
export type SigId = NumericIdentity<"signature">;
export type ConstId = NumericIdentity<"constant">;
export type CandidateListId = NumericIdentity<"candidate-list">;
export type ProducerId = NumericIdentity<"producer">;
export type BoundProducerId = NumericIdentity<"bound-producer">;
export type ValueContextId = NumericIdentity<"value-context">;
export type OriginsId = NumericIdentity<"origins">;
export type ProjectionPathId = NumericIdentity<"projection-path">;
export type OpenBoundaryId = NumericIdentity<"open-boundary">;
export type LayoutId = NumericIdentity<"layout">;
export type MemoryFieldId = NumericIdentity<"memory-field">;
export type LibraryTypeId = NumericIdentity<"library-type">;
/** Positions in the tables of one raw module capture (Front's capture of a checked module). */
export type RawTypeId = NumericIdentity<"raw-type">;
export type RawSymbolId = NumericIdentity<"raw-symbol">;
export type RawSignatureId = NumericIdentity<"raw-signature">;
export type RawComponentId = NumericIdentity<"raw-component">;
export type RawMemberTableId = NumericIdentity<"raw-member-table">;
export type RawCandidateListId = NumericIdentity<"raw-candidate-list">;
export type RawDataLayoutId = NumericIdentity<"raw-data-layout">;
export type RawMemoryLayoutId = NumericIdentity<"raw-memory-layout">;
export type RawMemoryFieldId = NumericIdentity<"raw-memory-field">;

export type RawTypeIdConstructor = (value: number) => RawTypeId;
export type RawSymbolIdConstructor = (value: number) => RawSymbolId;
export type RawSignatureIdConstructor = (value: number) => RawSignatureId;
export type RawComponentIdConstructor = (value: number) => RawComponentId;
export type RawMemberTableIdConstructor = (value: number) => RawMemberTableId;
export type RawCandidateListIdConstructor = (value: number) => RawCandidateListId;
export type RawDataLayoutIdConstructor = (value: number) => RawDataLayoutId;
export type RawMemoryLayoutIdConstructor = (value: number) => RawMemoryLayoutId;
export type RawMemoryFieldIdConstructor = (value: number) => RawMemoryFieldId;
export type NodeIdConstructor = (value: number) => NodeId;
export type LocalIdConstructor = (value: number) => LocalId;
export type BlockIdConstructor = (value: number) => BlockId;
export type PlaceIdConstructor = (value: number) => PlaceId;
export type TyIdConstructor = (value: number) => TyId;
export type SigIdConstructor = (value: number) => SigId;
export type ConstIdConstructor = (value: number) => ConstId;
export type CandidateListIdConstructor = (value: number) => CandidateListId;
export type ProducerIdConstructor = (value: number) => ProducerId;
export type BoundProducerIdConstructor = (value: number) => BoundProducerId;
export type ValueContextIdConstructor = (value: number) => ValueContextId;
export type OriginsIdConstructor = (value: number) => OriginsId;
export type ProjectionPathIdConstructor = (value: number) => ProjectionPathId;
export type OpenBoundaryIdConstructor = (value: number) => OpenBoundaryId;
export type LayoutIdConstructor = (value: number) => LayoutId;
export type MemoryFieldIdConstructor = (value: number) => MemoryFieldId;
export type LibraryTypeIdConstructor = (value: number) => LibraryTypeId;
export type ExpansionIdConstructor = (value: string) => ExpansionId;

export interface LibraryModuleIdentity {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly packageName: string | null;
  readonly moduleSpecifier: string;
  readonly providerModuleId: string;
}

export interface LibraryExportIdentity {
  readonly module: LibraryModuleIdentity;
  readonly exportId: string;
  readonly memberId: string | null;
  readonly signatureId: string | null;
}

export interface ModulePath {
  readonly package: PackageId;
  readonly path: string;
}

export interface DefinitionSegment {
  readonly name: string;
  readonly ordinal: number;
}

export interface DefinitionPath {
  readonly module: ModuleId;
  readonly segments: readonly DefinitionSegment[];
}

export type BodyRole =
  | "function"
  | "initializer"
  | "module"
  | "default-argument"
  | "field-initializer"
  | "enum-member-initializer"
  | "class-static-initializer";

export interface BodyPath {
  readonly owner: DefId;
  readonly role: BodyRole;
  readonly ordinal: number;
}

export interface NodeRef {
  readonly body: BodyId;
  readonly node: NodeId;
}

export interface ItemNodeRef {
  readonly owner: DefId;
  readonly node: NodeId;
}

export type SourceNodeRef =
  | { readonly kind: "body"; readonly value: NodeRef }
  | { readonly kind: "item"; readonly value: ItemNodeRef };

export interface LocalRef {
  readonly body: BodyId;
  readonly local: LocalId;
}

export interface BlockRef {
  readonly body: BodyId;
  readonly block: BlockId;
}

export interface PlaceRef {
  readonly body: BodyId;
  readonly place: PlaceId;
}

export type PassName =
  | "front"
  | "decls"
  | "infer"
  | "elaborate"
  | "validate"
  | "lower-mir"
  | "evaluate"
  | "metadata"
  | "liveness"
  | "initialization"
  | "refinements"
  | "origins"
  | "suspension"
  | "errorStorage"
  | "pointerBacking"
  | "summaries"
  | "pipeline";

export type Derivation =
  | { readonly kind: "lowering"; readonly pass: PassName }
  | { readonly kind: "expansion"; readonly expansion: ExpansionId };

export interface Origin {
  readonly module: ModuleId;
  readonly start: number;
  readonly length: number;
  readonly derived: readonly Derivation[];
}

export type KeyData =
  | string | number | bigint | boolean | null
  | readonly KeyData[]
  | KeyRecord;

export interface KeyRecord {
  readonly kind: "record";
  readonly fields: readonly (readonly [string, KeyData])[];
}

export type EncodeKey = (key: KeyData) => string;

export type DecodedIdentity<Value> =
  | { readonly kind: "decoded"; readonly value: Value }
  | { readonly kind: "invalid"; readonly text: string; readonly offset: number;
      readonly reason: "syntax" | "noncanonical" | "wrong-kind" };

export type EncodePackageId = (rootIdentity: string) => PackageId;
export type DecodePackageId = (text: string) => DecodedIdentity<string>;
export type EncodeModuleId = (path: ModulePath) => ModuleId;
export type DecodeModuleId = (text: string) => DecodedIdentity<ModulePath>;
export type EncodeDefId = (path: DefinitionPath) => DefId;
export type DecodeDefId = (text: string) => DecodedIdentity<DefinitionPath>;
export type EncodeBodyId = (path: BodyPath) => BodyId;
export type DecodeBodyId = (text: string) => DecodedIdentity<BodyPath>;
export type EncodeGroupId = (members: readonly [BodyId, ...BodyId[]]) => GroupId;
export type DecodeGroupId = (text: string) => DecodedIdentity<BodyId>;
export type EncodeComponentId = (members: readonly [DefId, ...DefId[]]) => ComponentId;
export type DecodeComponentId = (text: string) => DecodedIdentity<readonly [DefId, ...DefId[]]>;
