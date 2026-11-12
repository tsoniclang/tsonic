import type {
  DecodeBodyId, DecodeComponentId, DecodeDefId, DecodeGroupId, DecodeModuleId,
  DecodePackageId, EncodeBodyId, EncodeComponentId, EncodeDefId, EncodeGroupId,
  EncodeKey, EncodeModuleId, EncodePackageId,
} from "./contract.js";
import {
  decodeBodyIdentity, decodeComponentIdentity, decodeDefinitionIdentity,
  decodeGroupIdentity, decodeModuleIdentity, decodePackageIdentity,
  encodeBodyIdentity, encodeComponentIdentity, encodeDefinitionIdentity,
  encodeGroupIdentity, encodeModuleIdentity, encodePackageId as encodePackageIdentity,
} from "./identity.js";
import { encodeCanonicalKey } from "./key.js";
import type {
  NodeId, NodeIdConstructor,
  LocalId, LocalIdConstructor,
  BlockId, BlockIdConstructor,
  PlaceId, PlaceIdConstructor,
  TyId, TyIdConstructor,
  SigId, SigIdConstructor,
  ConstId, ConstIdConstructor,
  CandidateListId, CandidateListIdConstructor,
  ProducerId, ProducerIdConstructor,
  BoundProducerId, BoundProducerIdConstructor,
  ValueContextId, ValueContextIdConstructor,
  OriginsId, OriginsIdConstructor,
  ProjectionPathId, ProjectionPathIdConstructor,
  OpenBoundaryId, OpenBoundaryIdConstructor,
  LayoutId, LayoutIdConstructor,
  MemoryFieldId, MemoryFieldIdConstructor,
  LibraryTypeId, LibraryTypeIdConstructor,
  ExpansionId, ExpansionIdConstructor,
} from "./contract.js";

export const encodeKey: EncodeKey = encodeCanonicalKey;
export const encodePackageId: EncodePackageId = encodePackageIdentity;
export const decodePackageId: DecodePackageId = decodePackageIdentity;
export const encodeModuleId: EncodeModuleId = encodeModuleIdentity;
export const decodeModuleId: DecodeModuleId = decodeModuleIdentity;
export const encodeDefId: EncodeDefId = encodeDefinitionIdentity;
export const decodeDefId: DecodeDefId = decodeDefinitionIdentity;
export const encodeBodyId: EncodeBodyId = encodeBodyIdentity;
export const decodeBodyId: DecodeBodyId = decodeBodyIdentity;
export const encodeGroupId: EncodeGroupId = encodeGroupIdentity;
export const decodeGroupId: DecodeGroupId = decodeGroupIdentity;
export const encodeComponentId: EncodeComponentId = encodeComponentIdentity;
export const decodeComponentId: DecodeComponentId = decodeComponentIdentity;

export const nodeId: NodeIdConstructor = value => value as NodeId;
export const localId: LocalIdConstructor = value => value as LocalId;
export const blockId: BlockIdConstructor = value => value as BlockId;
export const placeId: PlaceIdConstructor = value => value as PlaceId;
export const tyId: TyIdConstructor = value => value as TyId;
export const sigId: SigIdConstructor = value => value as SigId;
export const constId: ConstIdConstructor = value => value as ConstId;
export const candidateListId: CandidateListIdConstructor = value => value as CandidateListId;
export const producerId: ProducerIdConstructor = value => value as ProducerId;
export const boundProducerId: BoundProducerIdConstructor = value => value as BoundProducerId;
export const valueContextId: ValueContextIdConstructor = value => value as ValueContextId;
export const originsId: OriginsIdConstructor = value => value as OriginsId;
export const projectionPathId: ProjectionPathIdConstructor = value => value as ProjectionPathId;
export const openBoundaryId: OpenBoundaryIdConstructor = value => value as OpenBoundaryId;
export const layoutId: LayoutIdConstructor = value => value as LayoutId;
export const memoryFieldId: MemoryFieldIdConstructor = value => value as MemoryFieldId;
export const libraryTypeId: LibraryTypeIdConstructor = value => value as LibraryTypeId;
export const expansionId: ExpansionIdConstructor = value => value as ExpansionId;
