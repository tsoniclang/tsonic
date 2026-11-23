import type { TyId, SigId, DefId, KeyData, SourceNodeRef, LocalRef, Origin } from "../ids/contract.js";
import type { Result, TextParseResult, UnitRequest, Violation } from "../diag/contract.js";
import type { ArtifactBindings, BodyInstance, CategoryEvidence, ConstantReference, ExactRational, Execution, IndexInventoryEntry, LiteralTypeValue, MemberKey, MemberStorageSelection, NativeBinaryFloatPrimitive, NativeIntegerPrimitive, NativeSignedIntegerPrimitive, NativePrimitive, ComponentSelector, TypeTerm, Signature, SignatureInput, TypeTable, BindingVector, TypeEvidence, TypeProductionRequest } from "./data.js";
import type { TypeArena } from "./arena.js";
import type { LimitStop, PublicationAccount, TypePublicationLimits, TypePublicationStop } from "./work.js";
export type { TypePublicationLimits, TypePublicationStop } from "./work.js";
import type { NativeFactsRule, NativeFactsSite, NativeFloatingFormat, PlatformDeclaration, SelectedNativeFacts } from "./native-facts-data.js";
export type * from "./data.js";
export type * from "./native-facts-data.js";

export type TypeInterner = TypeArena;
export type TypePublicationWork = PublicationAccount;
export type CompareIndexSignatures = (left: IndexInventoryEntry, right: IndexInventoryEntry) => number;
export type CompareMemberKeys = (left: MemberKey, right: MemberKey) => number;
export type NativeFactsKey = (facts: SelectedNativeFacts) => string;
export type IsNativeIntegerPrimitive = (primitive: NativePrimitive) => primitive is NativeIntegerPrimitive;
export type IsNativeSignedIntegerPrimitive = (primitive: NativePrimitive) => primitive is NativeSignedIntegerPrimitive;
export type IsNativeBinaryFloatPrimitive = (primitive: NativePrimitive | "bigint") => primitive is NativeBinaryFloatPrimitive;
export type FloatingBitsFit = (bits: bigint, format: NativeFloatingFormat) => boolean;
export type ExactFloat64LiteralFit = (value: ExactRational, format: NativeFloatingFormat) => boolean;
export type FloatingFormatWidth = (format: NativeFloatingFormat) => 16 | 32 | 64 | null;
export type NativeCarrierResult =
  | { readonly kind: "primitive"; readonly type: TyId; readonly primitive: NativePrimitive }
  | { readonly kind: "needs-selected-association"; readonly type: TyId }
  | { readonly kind: "resource-stop" };
export type NativeCarrierOf = (table: TypeTable, type: TyId,
  typeOf: (type: TyId) => TypeTerm | null | undefined) => NativeCarrierResult;
export type OptionalValueDomain =
  | { readonly kind: "optional-value"; readonly payload: "boolean" | "float64" | "string"; readonly present: TyId; readonly category: CategoryEvidence }
  | { readonly kind: "not-optional-value" }
  | { readonly kind: "resource-stop" };
export type OptionalValueDomainOf = (term: TypeTerm, typeOf: (type: TyId) => TypeTerm | null) => OptionalValueDomain;
export interface LiteralCompatibilityReader {
  readonly numericRepresentation: "literal-operand" | "preserve-payload";
  readonly typeOf: (type: TyId) => TypeTerm | null | undefined;
  readonly admit: (work: number, entries: number) => boolean;
}
export type LiteralCompatibilityResult =
  | { readonly kind: "compatible" | "incompatible" }
  | { readonly kind: "malformed-type"; readonly type: TyId }
  | { readonly kind: "resource-stop" }
  | { readonly kind: "needs-selected-evidence"; readonly type: TyId; readonly primitive: NativePrimitive | null;
      readonly requirement: "representation" | "literal-conversion" | "checked-association" };
export type LiteralCompatibilityOf = (table: TypeTable, type: TyId, value: LiteralTypeValue,
  facts: SelectedNativeFacts, reader: LiteralCompatibilityReader) => LiteralCompatibilityResult;
export type LiteralTypeValuesEqual = (left: LiteralTypeValue, right: LiteralTypeValue) => boolean;
export type NativeIntegerGeometryResult =
  | { readonly kind: "integer"; readonly bits: number; readonly signed: boolean; readonly minimum: bigint; readonly maximum: bigint }
  | { readonly kind: "not-integer" }
  | { readonly kind: "missing-native-width"; readonly carrier: "native-int" | "native-uint" }
  | { readonly kind: "resource-stop" };
export type NativeIntegerGeometryOf = (primitive: NativePrimitive, facts: SelectedNativeFacts,
  admit: (work: number, bits: number) => boolean) => NativeIntegerGeometryResult;
export type PlatformDeclarationKey = (declaration: PlatformDeclaration) => string;
export type MemberStorageData = (selection: MemberStorageSelection) => KeyData;
export type VerifyNativeFacts = (facts: SelectedNativeFacts) => readonly Violation<NativeFactsRule, NativeFactsSite>[];

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

export type SignatureEndpoint = "advertised" | "api-signature" | "api-body";

export interface SignatureRequest {
  readonly definition: DefId;
  readonly endpoint: SignatureEndpoint;
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
export type TypeProductionRequestData = (request: TypeProductionRequest) => KeyData;
export type SignatureRequestKey = (request: SignatureRequest) => string;
export type BindingVectorKey = (vector: BindingVector) => string;
export type ReadBindingVectorKey = <Stop extends TypeTableAdmissionStop>(vector: BindingVector, admitRow: () => Stop | null) =>
  { readonly kind: "complete"; readonly key: string } | Stop;
/** The canonical key text of artifact bindings: parametric, or instantiated with its binding vector's projection. */
export type ArtifactBindingsKey = (bindings: ArtifactBindings) => string;
/** The canonical key text of a body instance: the body and its complete bindings, a binding-vector hole as null at its position. */
export type InstanceKey = (instance: BodyInstance) => string;
export type ConstantReferenceKey = (reference: ConstantReference) => string;
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
export type TypeTableAdmissionStop = LimitStop;
export type TypeTableAdmissionSite = TypeSite | { readonly kind: "table" };
export interface TypeTableAdmissionWork<Stop extends TypeTableAdmissionStop> {
  readonly work: (count: number) => Stop | null;
  readonly retain: (count: number) => Stop | null;
}
export type AdmitTypeTable = <Stop extends TypeTableAdmissionStop>(
  table: TypeTable, admission: TypeTableAdmissionWork<Stop>,
) => { readonly kind: "complete"; readonly types: TypeInterner }
  | { readonly kind: "invalid"; readonly violations: readonly Violation<TypeRule, TypeTableAdmissionSite>[] }
  | Stop;
export type FixedTypeTerm = Extract<TypeTerm, { readonly kind:
  "primitive" | "string" | "intrinsic" | "enum" | "param" | "self" | "open" | "error" }>;
export type InternType = (interner: TypeInterner, term: FixedTypeTerm) => TyId;
export type ReadType = (interner: TypeInterner, type: TyId) => TypeTerm;
export type ReadSignature = (interner: TypeInterner, signature: SigId) => Signature;
export type ViewTypes = (interner: TypeInterner) => TypeTable;
export type TypeOf = (type: TyId) => TypeTerm;
export type SignatureOf = (signature: SigId) => Signature;
export interface TypePublication {
  readonly table: TypeTable;
  readonly types: readonly TyId[];
  readonly signatures: readonly SigId[];
}
export type CreateTypePublicationWork = (limits: TypePublicationLimits) => TypePublicationWork;
export type AdmitTypePublicationStep = (work: TypePublicationWork, count?: number) => TypePublicationStop | null;
export type RefuseTypeConstruction = (work: TypePublicationWork, stop: TypePublicationStop, origin: Origin, request: UnitRequest) =>
  Extract<Result<never>, { readonly kind: "refused" }>;
export type TypePublicationRefusalOf = (work: TypePublicationWork) =>
  Extract<Result<never>, { readonly kind: "refused" }> | TypePublicationStop | null;
export interface TypeGraphInput {
  readonly typeBase: number;
  readonly signatureBase: number;
  readonly terms: readonly TypeTerm[];
  readonly signatures: readonly SignatureInput[];
}
export interface TypeGraphMapping {
  readonly types: readonly TyId[];
  readonly signatures: readonly SigId[];
}
export interface TypeGraphDeps {
  readonly types: TypeInterner;
  readonly work: TypePublicationWork;
}
export type TypeGraphResult = { readonly kind: "complete"; readonly value: TypeGraphMapping } | TypePublicationStop;
export type InternTypeGraph = (deps: TypeGraphDeps, input: TypeGraphInput) => TypeGraphResult;
export type SourceChoice = { readonly type: TyId; readonly category: CategoryEvidence };
export type JoinSourceChoice = (deps: TypeGraphDeps, selected: readonly TyId[], limits: TypeExpansionLimits) =>
  TypeTransform<SourceChoice> | TypePublicationStop | { readonly kind: "unavailable"; readonly reason: "non-scalar" | "numeric-inclusion" };
export type TypePublicationResult =
  | { readonly kind: "complete"; readonly value: TypePublication; readonly work: number; readonly createdRecords: number }
  | TypePublicationStop;
export type ExportTypes = (interner: TypeInterner, limits: TypePublicationLimits) => TypePublicationResult;
export type Substitute = <Stop extends TypeTableAdmissionStop = never>(
  interner: TypeInterner, types: readonly TyId[], bindings: BindingVector, limits: TypeExpansionLimits,
  commitment: TypePublicationWork | TypeTableAdmissionWork<Stop>,
) => TypeTransform<readonly TyId[]> | TypePublicationStop | NoInfer<Stop>;
export interface BindingValues {
  readonly types: readonly TyId[];
  readonly bindings: readonly BindingVector[];
}
export interface ProjectedBindingValues {
  readonly types: readonly (TyId | null)[];
  readonly bindings: readonly (BindingVector | null)[];
}
export type ProjectBindingValues = <Stop extends TypeTableAdmissionStop>(interner: TypeInterner, values: BindingValues,
  bindings: BindingVector, limits: TypeExpansionLimits, account: TypeTableAdmissionWork<Stop>) =>
  TypeTransform<ProjectedBindingValues> | Stop;
export type SignatureSubstitution = "lexical" | "selected";
export type SubstituteSignature = <Stop extends TypeTableAdmissionStop = never>(
  interner: TypeInterner,
  signatures: readonly SigId[],
  bindings: BindingVector,
  limits: TypeExpansionLimits,
  mode: SignatureSubstitution,
  commitment: TypePublicationWork | TypeTableAdmissionWork<Stop>,
) => TypeTransform<readonly SigId[]> | TypePublicationStop | NoInfer<Stop>;
export type PrintTypes = (table: TypeTable) => string;
export type ParseTypes = (text: string) => TextParseResult<TypeTable>;

export type TypeRule = "type-reference" | "signature-reference" | "nominal-definition" | "union-order"
  | "intersection-order" | "member-order" | "member-origins" | "index-order" | "signature-order"
  | "parameter-order" | "parameter-identity" | "binding-vector-complete" | "tuple-rest-order"
  | "rational-normalized" | "literal-value-exact" | "extent-exact" | "construction-captures-qualified"
  | "self-owner" | "self-binding-order"
  | "projection-owner" | "sum-arm-order" | "evidence-type" | "cross-owner-qualified"
  | "canonical-representative";
export type TypeSite =
  | { readonly kind: "type"; readonly type: TyId }
  | { readonly kind: "signature"; readonly signature: SigId }
  | { readonly kind: "source"; readonly source: SourceNodeRef }
  | { readonly kind: "binding"; readonly vector: number;
      readonly family: "classBindings" | "methodBindings" | "capturedBindings" | "selfBindings" | null;
      readonly position: number | null }
  | { readonly kind: "evidence"; readonly position: number; readonly source: SourceNodeRef | null };

export interface BindingScope {
  readonly classParameters: readonly DefId[];
  readonly methodParameters: readonly DefId[];
  readonly capturedParameters: readonly DefId[];
  readonly selfOwners: readonly DefId[];
}

export type HasLexicalTypeDependency = (interner: TypeInterner, roots: readonly TyId[], scope: BindingScope,
  work: TypePublicationWork) => { readonly kind: "complete"; readonly value: boolean } | TypePublicationStop;
export type ReadLexicalTypeSupport = <Stop extends TypeTableAdmissionStop>(table: TypeTable, roots: readonly TyId[],
  scope: BindingScope, admission: TypeTableAdmissionWork<Stop>) =>
  { readonly kind: "complete"; readonly value: "independent" | "dependent" | "foreign" | "invalid" } | Stop;

export type RigidBindings = (scope: BindingScope) => BindingVector;

export interface BindingVerificationInput {
  readonly vector: BindingVector;
  readonly scope: BindingScope;
}

export type VerifyBindings = <Stop extends object>(bindings: readonly BindingVerificationInput[], typeCount: number,
  admit: (work: number, entries: number) => Stop | null) =>
  | { readonly kind: "complete"; readonly violations: readonly Violation<TypeRule, TypeSite>[] }
  | { readonly kind: "resource-stop"; readonly stop: Stop };
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

/**
 * The one encoding of a selector path as key data: the only producer of the path of a "component" unit position
 * (diag). Equal paths give equal key data; different paths give different key data.
 */
export type EncodeSelectorPath = (path: readonly ComponentSelector[]) => readonly KeyData[];
