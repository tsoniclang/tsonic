import type { TyId, SigId, DefId, KeyData, SourceNodeRef, LocalRef } from "../ids/contract.js";
import type { TextParseResult, Violation } from "../diag/contract.js";
import type { ArtifactBindings, BodyInstance, Execution, TypeTerm, Signature, SignatureInput, TypeTable, BindingVector, TypeParameterIdentity, TypeEvidence } from "./data.js";
import type { TypeArena } from "./arena.js";
export type * from "./data.js";

export type TypeInterner = TypeArena;

export interface TypeExpansionLimits {
  readonly maximumDepth: number;
  /** One shared allowance for environment/binding-value slots, root positions, binding-value records, new graph plans and normalization stages. */
  readonly maximumVisits: number;
  readonly maximumUnionMembers: number;
  readonly maximumIntersectionMembers: number;
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

/**
 * One execution of a bodyless declaration (COMMON-DATA section 1 line 21; K-3367 D): the complete signature request and
 * the number of arguments provided. Declared here beside SignatureRequest rather than in data.ts beside Execution,
 * because data.ts does not import this file (this file re-exports data.ts; the module's import graph is acyclic).
 */
export interface DeclaredExecution {
  readonly request: SignatureRequest;
  readonly provided: number;
}

export type BindingVectorData = (vector: BindingVector) => KeyData;
export type ArtifactBindingsData = (bindings: ArtifactBindings) => KeyData;
export type SignatureRequestData = (request: SignatureRequest) => KeyData;
export type SignatureRequestKey = (request: SignatureRequest) => string;
export type BindingVectorKey = (vector: BindingVector) => string;
/** The canonical key text of artifact bindings: parametric, or instantiated with its binding vector's projection. */
export type ArtifactBindingsKey = (bindings: ArtifactBindings) => string;
/** The canonical key text of a body instance: the body and its complete bindings, a binding-vector hole as null at its position. */
export type InstanceKey = (instance: BodyInstance) => string;
/** Whether two body instances are the same instance: equal instance keys. The one public instance comparison. */
export type SameInstance = (left: BodyInstance, right: BodyInstance) => boolean;
/** The canonical key text of an execution: its instance key and its provided count. */
export type ExecutionKey = (execution: Execution) => string;
/** The canonical key text of a declared execution: the complete signature request and the provided count. */
export type DeclaredExecutionKey = (execution: DeclaredExecution) => string;

export type TypeTransform<Value> =
  | { readonly kind: "complete"; readonly value: Value }
  | { readonly kind: "resource-limit"; readonly dimension: "depth" | "visits" | "union-members" | "intersection-members";
      readonly maximum: number };

export type CreateTypeInterner = () => TypeInterner;
export type SeedTypeInterner = (table: TypeTable) => TypeInterner;
export type InternType = (interner: TypeInterner, term: TypeTerm) => TyId;
export type InternSignature = (interner: TypeInterner, signature: SignatureInput) => SigId;
export type ReadType = (interner: TypeInterner, type: TyId) => TypeTerm;
export type ReadSignature = (interner: TypeInterner, signature: SigId) => Signature;
export type TypeOf = (type: TyId) => TypeTerm;
export type SignatureOf = (signature: SigId) => Signature;
export interface TypePublication {
  readonly table: TypeTable;
  readonly types: readonly TyId[];
  readonly signatures: readonly SigId[];
}
export interface TypePublicationLimits {
  readonly maximumWork: number;
  readonly maximumCreatedRecords: number;
}
export type TypePublicationResult =
  | { readonly kind: "complete"; readonly value: TypePublication; readonly work: number; readonly createdRecords: number }
  | { readonly kind: "resource-limit"; readonly dimension: "work" | "created-records"; readonly maximum: number };
export type ExportTypes = (interner: TypeInterner, limits: TypePublicationLimits) => TypePublicationResult;
export type Substitute = (interner: TypeInterner, types: readonly TyId[], bindings: BindingVector, limits: TypeExpansionLimits) => TypeTransform<readonly TyId[]>;
export interface BindingValues {
  readonly types: readonly TyId[];
  readonly bindings: readonly BindingVector[];
}
export type SubstituteBindingValues = (interner: TypeInterner, values: BindingValues,
  bindings: BindingVector, limits: TypeExpansionLimits) => TypeTransform<BindingValues>;
export type SubstituteSignature = (
  interner: TypeInterner,
  signatures: readonly SigId[],
  bindings: BindingVector,
  limits: TypeExpansionLimits,
) => TypeTransform<readonly SigId[]>;
export type PrintTypes = (table: TypeTable) => string;
export type ParseTypes = (text: string) => TextParseResult<TypeTable>;

export type TypeRule = "type-reference" | "signature-reference" | "nominal-definition" | "union-order"
  | "intersection-order" | "member-order" | "member-origins" | "index-order" | "signature-order"
  | "parameter-order" | "parameter-identity" | "binding-vector-complete" | "tuple-rest-order"
  | "rational-normalized" | "literal-value-exact" | "extent-exact" | "construction-captures-qualified"
  | "self-owner" | "self-binding-order"
  | "projection-owner" | "sum-arm-order" | "evidence-type" | "cross-owner-qualified";
export type TypeSite =
  | { readonly kind: "type"; readonly type: TyId }
  | { readonly kind: "signature"; readonly signature: SigId }
  | { readonly kind: "source"; readonly source: SourceNodeRef }
  | { readonly kind: "binding"; readonly vector: number;
      readonly family: "classBindings" | "methodBindings" | "capturedBindings" | "selfBindings" | null;
      readonly position: number | null }
  | { readonly kind: "evidence"; readonly position: number; readonly source: SourceNodeRef | null };

export interface BindingScope {
  readonly classParameters: readonly TypeParameterIdentity[];
  readonly methodParameters: readonly TypeParameterIdentity[];
  readonly capturedParameters: readonly TypeParameterIdentity[];
  readonly selfOwners: readonly DefId[];
}

export type RigidBindings = (scope: BindingScope) => BindingVector;

export interface BindingVerificationInput {
  readonly vector: BindingVector;
  readonly scope: BindingScope;
}

export interface NominalDefinition {
  readonly kind: "declared" | "enum";
  readonly facets: readonly ("instance" | "value")[];
}

export interface TypeVerificationInput {
  readonly table: TypeTable;
  readonly bindings: readonly BindingVerificationInput[];
  readonly evidence: readonly TypeEvidence[];
  readonly nominalOf: (definition: DefId) => NominalDefinition | null;
  readonly nodeExists: (node: SourceNodeRef) => boolean;
  readonly localExists: (local: LocalRef) => boolean;
}

export type VerifyTypes = (input: TypeVerificationInput) => readonly Violation<TypeRule, TypeSite>[];
