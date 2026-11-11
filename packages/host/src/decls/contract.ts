import type { Computed, Result } from "../diag/contract.js";
import type { BodyId, DefId, DefinitionPath, ModuleId, SourceNodeRef, TyId } from "../ids/contract.js";
import type {
  ArtifactBindings, BodyInstance, ConstantContext, ConstValue, MemberTable, Signature,
  TypeEvidence, TypeExpansionLimits, TypeInterner, TypeParameter, TypeProductionRequest,
} from "../ir-types/contract.js";
import type { CheckedPhase, Declaration, DeclarationKind, HirAttribute, HirBody, HirCallableEndpoint, HirModule, TypeNode } from "../ir-hir/contract.js";
import type { InferredSignaturePart } from "../ir-infer/contract.js";
import type { BoundLibraries } from "../libraries/contract.js";

export interface DefinitionExport {
  readonly module: ModuleId;
  readonly name: string;
}

export interface Definition {
  readonly definition: DefId;
  readonly path: DefinitionPath;
  readonly kind: DeclarationKind;
  readonly visibility: "public" | "protected" | "private";
  readonly exports: readonly DefinitionExport[];
  readonly parent: DefId | null;
  readonly bodies: readonly BodyId[];
}

export interface DefinitionTable {
  readonly module: ModuleId;
  readonly definitions: readonly Definition[];
}

export interface DeclarationRequest {
  readonly definition: DefId;
  readonly bindings: ArtifactBindings;
}

export interface SignatureRequest {
  readonly definition: DefId;
  readonly endpoint: "advertised" | "api-signature" | "api-body";
  // Position among endpoints of this role, in declaration endpoint-vector order.
  readonly ordinal: number;
  readonly bindings: ArtifactBindings;
}

export interface InferredDeclarationRequest {
  readonly signature: InferredSignaturePart;
  readonly bindings: ArtifactBindings;
}

export interface HeritageEdge {
  readonly role: "extends" | "implements";
  readonly type: TyId;
}

export interface Heritage {
  readonly definition: DefId;
  readonly bindings: ArtifactBindings;
  readonly edges: readonly HeritageEdge[];
}

export interface Generics {
  readonly definition: DefId;
  readonly classParameters: readonly TypeParameter[];
  readonly methodParameters: readonly TypeParameter[];
  readonly capturedParameters: readonly TypeParameter[];
}

export interface DeclarationAttributes {
  readonly definition: DefId;
  readonly bindings: ArtifactBindings;
  readonly attributes: readonly HirAttribute[];
}

export interface EnumMember {
  readonly declaration: DefId;
  readonly initializer: BodyId | null;
  readonly value: ConstValue;
}

export interface EnumDeclaration {
  readonly definition: DefId;
  readonly members: readonly EnumMember[];
  readonly integerWidth: 32 | 64;
}

export interface DeclsDeps {
  readonly libraries: BoundLibraries;
  readonly itemOf: (definition: DefId) => Declaration<CheckedPhase>;
  readonly bodyOf: (body: BodyId) => HirBody;
  readonly declarationOf: (source: SourceNodeRef) => DefId;
  readonly syntaxOf: (source: SourceNodeRef) => TypeNode<CheckedPhase>;
  readonly inferredTypeOf: (request: InferredDeclarationRequest) => TyId;
  readonly memberInventoryOf: (type: TyId) => MemberTable;
  readonly constValue: (initializer: BodyInstance, context: ConstantContext) => ConstValue;
  readonly types: TypeInterner;
  readonly typeExpansion: TypeExpansionLimits;
}

export type Defs = (deps: DeclsDeps, module: HirModule) => Computed<DefinitionTable>;
export type ProduceType = (deps: DeclsDeps, request: TypeProductionRequest) => Result<TypeEvidence>;
export type SignatureOfDeclaration = (deps: DeclsDeps, request: SignatureRequest) => Result<Signature>;
export type EndpointsOf = (deps: DeclsDeps, definition: DefId) => Computed<readonly HirCallableEndpoint[]>;
export type MembersOf = (deps: DeclsDeps, type: TyId) => Result<MemberTable>;
export type HeritageOf = (deps: DeclsDeps, request: DeclarationRequest) => Result<Heritage>;
export type GenericsOf = (deps: DeclsDeps, definition: DefId) => Computed<Generics>;
export type AttributesOf = (deps: DeclsDeps, request: DeclarationRequest) => Result<DeclarationAttributes>;
export type EnumOf = (deps: DeclsDeps, definition: DefId) => Result<EnumDeclaration>;
export type SourceErrorDeclarations = (deps: DeclsDeps) => Computed<readonly DefId[]>;
export type SourceStorageFields = (deps: DeclsDeps) => Computed<readonly DefId[]>;
