import type { BodyId, DefId, GroupId, LocalRef, NodeRef, SigId, SourceNodeRef, TyId } from "../ids/contract.js";
import type { TextParseResult, Violation } from "../diag/contract.js";

export type NativePrimitive =
  | "bool" | "char"
  | "int8" | "uint8" | "int16" | "uint16" | "int32" | "uint32"
  | "int64" | "uint64" | "int128" | "uint128"
  | "native-int" | "native-uint"
  | "float16" | "float32" | "float64" | "decimal";

export type Intrinsic = "any" | "unknown" | "object" | "void" | "never" | "absence" | "bigint" | "symbol";

export interface TypeParameterIdentity {
  readonly owner: DefId;
  readonly index: number;
}

export interface TypeParameter {
  readonly identity: TypeParameterIdentity;
  readonly declaration: DefId;
  readonly constraint: TyId | null;
  readonly default: TyId | null;
}

export type TypeBinding =
  | { readonly kind: "bound"; readonly parameter: TypeParameterIdentity; readonly type: TyId }
  | { readonly kind: "rigid"; readonly parameter: TypeParameterIdentity };

export type SelfBinding =
  | { readonly kind: "bound"; readonly owner: DefId; readonly type: TyId }
  | { readonly kind: "rigid"; readonly owner: DefId };

export interface BindingVector {
  readonly classBindings: readonly TypeBinding[];
  readonly methodBindings: readonly TypeBinding[];
  readonly capturedBindings: readonly TypeBinding[];
  readonly selfBindings: readonly SelfBinding[];
}

export type ArtifactBindings =
  | { readonly kind: "parametric" }
  | { readonly kind: "instantiated"; readonly bindings: BindingVector };

export interface BodyInstance {
  readonly body: BodyId;
  readonly bindings: ArtifactBindings;
}

export interface ConstantReference {
  readonly initializer: BodyInstance;
}

export type ConstantContext = "enum-member" | "fixed-array-extent" | "compile-time";

export interface ExactRational {
  readonly numerator: bigint;
  readonly denominator: bigint;
  readonly negativeZero: boolean;
}

export type ConstValue = { readonly type: TyId } & (
  | { readonly kind: "number"; readonly value: ExactRational }
  | { readonly kind: "bigint"; readonly value: bigint }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "absence" }
  | { readonly kind: "unique-symbol"; readonly declaration: DefId }
  | { readonly kind: "error" }
);

export type NonNumericLiteralValue =
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "absence" }
  | { readonly kind: "unique-symbol"; readonly declaration: DefId };

export type LiteralValue =
  | { readonly kind: "number"; readonly token: string; readonly value: ExactRational }
  | { readonly kind: "bigint"; readonly token: string; readonly value: bigint }
  | NonNumericLiteralValue;

export type LiteralTypeValue =
  | { readonly kind: "number"; readonly value: ExactRational }
  | { readonly kind: "bigint"; readonly value: bigint }
  | NonNumericLiteralValue;

export type MemberKey =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "number"; readonly value: ExactRational }
  | { readonly kind: "symbol"; readonly declaration: DefId };

export type MemberOrigin =
  | { readonly kind: "declared"; readonly declaration: DefId }
  | { readonly kind: "class-prototype"; readonly owner: DefId }
  | { readonly kind: "mapped"; readonly owner: SourceNodeRef; readonly key: MemberKey };

export interface Member {
  readonly key: MemberKey;
  readonly origins: readonly MemberOrigin[];
  readonly readOrigins: readonly MemberOrigin[];
  readonly writeOrigins: readonly MemberOrigin[];
  readonly kind: "property" | "method" | "accessor";
  readonly read: TyId | null;
  readonly write: TyId | null;
  readonly optional: boolean;
  readonly readonly: boolean;
}

export interface IndexSignature {
  readonly declaration: DefId;
  readonly key: TyId;
  readonly read: TyId;
  readonly write: TyId | null;
  readonly readonly: boolean;
}

export type PassingMode = "by-value" | "byref-readonly" | "byref-readwrite"
  | "byref-writeonly-must-init" | "borrow-shared" | "borrow-mut" | "move";

export type PlacePassingMode = "byref-readonly" | "byref-readwrite"
  | "byref-writeonly-must-init" | "borrow-shared" | "borrow-mut";

export interface SignatureParameter {
  readonly declaration: DefId;
  readonly kind: "required" | "optional" | "default" | "rest";
  readonly type: TyId;
  readonly passing: PassingMode;
  readonly initializer: BodyId | null;
}

export interface Signature {
  readonly id: SigId;
  readonly declaration: DefId | null;
  readonly owner: SourceNodeRef | null;
  readonly composition: { readonly kind: "union" | "intersection"; readonly signatures: readonly SigId[] } | null;
  readonly kind: "call" | "construct";
  readonly typeParameters: readonly TypeParameter[];
  readonly receiver: TyId | null;
  readonly parameters: readonly SignatureParameter[];
  readonly result: TyId;
}

export interface SignatureInput {
  readonly declaration: DefId | null;
  readonly owner: SourceNodeRef | null;
  readonly composition: { readonly kind: "union" | "intersection"; readonly signatures: readonly SigId[] } | null;
  readonly kind: "call" | "construct";
  readonly typeParameters: readonly TypeParameter[];
  readonly receiver: TyId | null;
  readonly parameters: readonly SignatureParameter[];
  readonly result: TyId;
}

export interface TupleElement {
  readonly kind: "required" | "optional" | "rest";
  readonly type: TyId;
  readonly declaration: DefId | null;
}

export interface ConstructionDefinition {
  readonly occurrence: NodeRef;
  readonly captures: readonly LocalRef[];
}

export interface SumFamily {
  readonly origin: "authored" | "inferred";
  readonly component: TypeComponent;
  readonly parameters: readonly TypeParameterIdentity[];
  readonly roles: readonly SumArmRole[];
}

export type ComponentSelector =
  | { readonly kind: "class-value" }
  | { readonly kind: "construction-argument"; readonly definition: ConstructionDefinition; readonly index: number }
  | { readonly kind: "optional-value" }
  | { readonly kind: "array-element" }
  | { readonly kind: "tuple-element"; readonly index: number }
  | { readonly kind: "union-member" | "argument-place" | "parameter-place"; readonly index: number }
  | { readonly kind: "intersection-member"; readonly index: number }
  | { readonly kind: "intersection-result" }
  | { readonly kind: "argument-tail" | "parameter-tail"; readonly start: number }
  | { readonly kind: "member"; readonly origin: MemberOrigin }
  | { readonly kind: "index-key" | "index-value"; readonly declaration: DefId }
  | { readonly kind: "projection-source" }
  | { readonly kind: "parameter"; readonly signature: SigId; readonly index: number }
  | { readonly kind: "receiver"; readonly signature: SigId }
  | { readonly kind: "signature-tail"; readonly signature: SigId; readonly start: number; readonly readonly: boolean }
  | { readonly kind: "tuple-slice"; readonly start: number; readonly endCount: number; readonly readonly: boolean }
  | { readonly kind: "result"; readonly signature: SigId }
  | { readonly kind: "type-argument"; readonly declaration: DefId; readonly index: number }
  | { readonly kind: "sum-arm"; readonly family: SumFamily; readonly index: number }
  | { readonly kind: "awaited" };

export interface TypeComponent {
  readonly root: SourceNodeRef;
  readonly path: readonly ComponentSelector[];
}

export interface TypeProductionRequest {
  readonly component: TypeComponent;
  readonly bindings: BindingVector;
}

export type TypeProjection =
  | { readonly kind: "awaited" }
  | { readonly kind: "component"; readonly component: TypeComponent };

export interface FixedExtent {
  readonly length: bigint;
  readonly runtimeBase: "number" | "bigint";
}

export type TypeTerm =
  | { readonly kind: "primitive"; readonly primitive: NativePrimitive }
  | { readonly kind: "string" }
  | { readonly kind: "intrinsic"; readonly intrinsic: Intrinsic }
  | { readonly kind: "literal"; readonly value: LiteralTypeValue; readonly base: TyId }
  | { readonly kind: "union"; readonly members: readonly TyId[] }
  | { readonly kind: "intersection"; readonly members: readonly TyId[] }
  | { readonly kind: "optional"; readonly value: TyId }
  | { readonly kind: "array"; readonly element: TyId; readonly readonly: boolean }
  | { readonly kind: "tuple"; readonly elements: readonly TupleElement[]; readonly readonly: boolean }
  | { readonly kind: "fixed-array"; readonly element: TyId; readonly extent: FixedExtent }
  | { readonly kind: "shape"; readonly members: readonly Member[]; readonly indexes: readonly IndexSignature[];
      readonly calls: readonly SigId[]; readonly constructs: readonly SigId[] }
  | { readonly kind: "callable"; readonly calls: readonly SigId[]; readonly constructs: readonly SigId[] }
  | { readonly kind: "declared"; readonly definition: DefId; readonly arguments: readonly TyId[];
      readonly facet: "instance" | "value"; readonly extent: FixedExtent | null }
  | { readonly kind: "construction-reference"; readonly definition: ConstructionDefinition; readonly arguments: readonly TyId[] }
  | { readonly kind: "enum"; readonly definition: DefId }
  | { readonly kind: "param"; readonly parameter: TypeParameterIdentity }
  | { readonly kind: "self"; readonly owner: DefId }
  | { readonly kind: "projection"; readonly source: TyId; readonly projection: TypeProjection }
  | { readonly kind: "open"; readonly group: GroupId; readonly variable: number }
  | { readonly kind: "error" };

export type SourceCategory =
  | "number" | "bigint" | "boolean" | "string" | "symbol" | "absence" | "object" | "callable";

export type CategoryEvidence =
  | { readonly kind: "known"; readonly category: SourceCategory }
  | { readonly kind: "parameter"; readonly declaration: DefId }
  | { readonly kind: "choice"; readonly alternatives: readonly CategoryEvidence[] }
  | { readonly kind: "dynamic" };

export interface NumericEvidence {
  readonly producer: NodeRef;
  readonly kind: "literal" | "declared" | "operation" | "application";
  readonly category: CategoryEvidence;
  readonly authored: LiteralValue | null;
}

export interface SumArmRole {
  readonly authoredIndex: number;
  readonly component: SourceNodeRef;
  readonly member: TyId;
}

export interface SumEvidence {
  readonly kind: "authored" | "inferred";
  readonly component: SourceNodeRef;
  readonly bindings: BindingVector;
  readonly arms: readonly SumArmRole[];
}

export type PointerEvidence =
  | { readonly kind: "raw-address" }
  | { readonly kind: "typed-location"; readonly pointee: TyId; readonly mutability: "readonly" | "readwrite" | "unspecified" }
  | { readonly kind: "native-pointer"; readonly declaration: DefId }
  | { readonly kind: "function-pointer"; readonly declaration: DefId;
      readonly parameters: readonly TyId[]; readonly result: TyId; readonly abi: readonly string[] };

export interface TypeEvidence {
  readonly type: TyId;
  readonly component: SourceNodeRef;
  readonly category: CategoryEvidence;
  readonly numeric: NumericEvidence | null;
  readonly sum: SumEvidence | null;
  readonly nominal: DefId | null;
  readonly pointer: PointerEvidence | null;
}

export interface TypeTable {
  readonly terms: readonly TypeTerm[];
  readonly signatures: readonly Signature[];
}

export interface AccessorCorrespondence {
  readonly origin: MemberOrigin;
  readonly getter: DefId | null;
  readonly setter: DefId | null;
}

export interface ConstructorCorrespondence {
  readonly signature: SigId;
  readonly declaration: DefId | null;
  readonly body: BodyId | null;
}

export interface MemberTable {
  readonly receiver: TyId;
  readonly members: readonly Member[];
  readonly indexes: readonly IndexSignature[];
  readonly calls: readonly SigId[];
  readonly constructs: readonly SigId[];
  readonly accessors: readonly AccessorCorrespondence[];
  readonly constructors: readonly ConstructorCorrespondence[];
  readonly completeness:
    | { readonly kind: "complete" }
    | { readonly kind: "open"; readonly reasons: readonly [MemberUnavailableReason, ...MemberUnavailableReason[]] };
}

export type MemberUnavailableReason =
  | { readonly kind: "parameter"; readonly parameter: TypeParameterIdentity }
  | { readonly kind: "dynamic" }
  | { readonly kind: "missing-checker-inventory"; readonly owner: SourceNodeRef };

export type MemberLookup =
  | { readonly kind: "member"; readonly member: Member }
  | { readonly kind: "absent" }
  | { readonly kind: "unavailable"; readonly receiver: TyId;
      readonly reasons: readonly [MemberUnavailableReason, ...MemberUnavailableReason[]] };

export type TypeInterner = object & { readonly identityKind: "type-interner" };

export interface TypeExpansionLimits {
  readonly maximumDepth: number;
  readonly maximumVisits: number;
  readonly maximumUnionMembers: number;
  readonly maximumIntersectionMembers: number;
}

export type TypeTransform<Value> =
  | { readonly kind: "complete"; readonly value: Value }
  | { readonly kind: "resource-limit"; readonly dimension: "depth" | "visits" | "union-members" | "intersection-members";
      readonly maximum: number };

export type CreateTypeInterner = () => TypeInterner;
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
export type ExportTypes = (interner: TypeInterner) => TypePublication;
export type Substitute = (interner: TypeInterner, type: TyId, bindings: BindingVector, limits: TypeExpansionLimits) => TypeTransform<TyId>;
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
