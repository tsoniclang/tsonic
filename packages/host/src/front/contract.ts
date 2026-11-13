import type { Diagnostic, Result } from "../diag/contract.js";
import type { DefId, LibraryExportIdentity, LibraryModuleIdentity, ModuleId, NodeId, Origin, TyId } from "../ids/contract.js";
import type { LiteralValue, NativePrimitive, PassingMode, TypeEvidence, TypeExpansionLimits, TypeInterner } from "../ir-types/contract.js";
import type { HirModule, SourceFile, SyntaxPhase } from "../ir-hir/contract.js";
import type { LibraryCatalogue, WellKnownSymbol } from "../libraries/contract.js";
import type { ExtensionReferenceEntry, ImportPreparation, LibraryRoleEntry, PackageSnapshot, ProjectSnapshot, SourceDeclarationPolicy } from "../snapshot/contract.js";
import type { ExtensionReference } from "../snapshot/contract.js";
import type { CompilerExtension, SourceDeclarationProvider, SourceSemanticsModule } from "@tsonic/tsts";

export type CheckerExtensions = object & { readonly identityKind: "checker-extensions" };
export type CheckedProgram = object & { readonly identityKind: "checked-program" };

export type CheckerExtensionValue =
  | { readonly kind: "compiler-extension"; readonly value: CompilerExtension }
  | { readonly kind: "declaration-provider"; readonly value: SourceDeclarationProvider;
      readonly roles: readonly LibraryRoleEntry[] }
  | { readonly kind: "semantics-module"; readonly value: SourceSemanticsModule };

export type ExtensionOf = (table: CheckerExtensions, reference: ExtensionReference) => CheckerExtensionValue;
export type ExtensionReferencesOf = (table: CheckerExtensions) => readonly ExtensionReferenceEntry[];

export interface NavigationCaptureLimits {
  readonly maximumCallableExpressionDepth: number;
  readonly maximumCallableSelectionDepth: number;
  readonly maximumCallableAliasDeclarations: number;
  readonly maximumCallableReceiverDeclarations: number;
  readonly maximumCallableReceiverSteps: number;
  readonly maximumCallableMemberReferences: number;
  readonly maximumLexicalEnvironmentSteps: number;
  readonly maximumLexicalEvaluationSteps: number;
  readonly maximumSyntaxDepth: number;
  readonly maximumCapturedNodesPerModule: number;
  readonly maximumCapturedFactsPerModule: number;
  readonly maximumCapturedEdgesPerModule: number;
}

export interface LiteralCaptureLimits {
  readonly maximumIntermediateBits: number;
  readonly maximumResultBits: number;
  readonly maximumArithmeticWork: number;
}

export interface PreparationDeps {
  readonly currentDirectory: string;
  readonly caseSensitive: boolean;
  readonly navigationCapture: NavigationCaptureLimits;
}

export interface CaptureDeps {
  readonly extensions: CheckerExtensions;
  readonly navigationCapture: NavigationCaptureLimits;
}

export interface LowerDeps {
  readonly definitionOf: (reference: RawNodeRef) => DefId;
  readonly definitionOfExport: (identity: LibraryExportIdentity) => DefId;
  readonly sourceTextOf: (module: ModuleId) => string;
  readonly libraries: LibraryCatalogue;
  readonly types: TypeInterner;
  readonly typeExpansion: TypeExpansionLimits;
  readonly literalCapture: LiteralCaptureLimits;
}

type RawIdentity<Kind extends string> = number & { readonly rawIdentityKind: Kind };

export type RawTypeId = RawIdentity<"type">;
export type RawSymbolId = RawIdentity<"symbol">;
export type RawSignatureId = RawIdentity<"signature">;
export type RawComponentId = RawIdentity<"component">;
export type RawMemberTableId = RawIdentity<"member-table">;
export type RawCandidateListId = RawIdentity<"candidate-list">;
export type RawDataLayoutId = RawIdentity<"data-layout">;
export type RawMemoryLayoutId = RawIdentity<"memory-layout">;
export type RawMemoryFieldId = RawIdentity<"memory-field">;

export interface RawNodeRef {
  readonly module: ModuleId;
  readonly node: NodeId;
}

export interface RawDiagnosticReference {
  readonly module: ModuleId;
  readonly index: number;
}

export type RawFact<Value> =
  | { readonly kind: "available"; readonly value: Value }
  | { readonly kind: "unavailable";
      readonly reason: "checker-error" | "parameter-dependent" | "not-provided"
        | "missing-original-component" | "incomplete-association" | "unsupported-checked-structure";
      readonly diagnostics: readonly RawDiagnosticReference[] };

export interface RawNumericLiteral {
  readonly token: string;
  readonly origin: Origin;
}

export type RawNumericValue =
  | { readonly kind: "authored"; readonly literal: RawNumericLiteral }
  | { readonly kind: "checker-value"; readonly value: number };

export type RawBigintValue =
  | { readonly kind: "authored"; readonly literal: RawNumericLiteral }
  | { readonly kind: "checker-value"; readonly value: bigint };

export type RawLiteral =
  | { readonly kind: "number"; readonly value: RawNumericValue }
  | { readonly kind: "bigint"; readonly value: RawBigintValue }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "absence"; readonly spelling: "null" | "undefined" }
  | { readonly kind: "symbol"; readonly declaration: RawNodeRef };

export type RawMemberKey =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "numeric"; readonly value: RawNumericValue }
  | { readonly kind: "symbol"; readonly declaration: RawNodeRef; readonly wellKnown: WellKnownSymbol | null };

export type RawComponentStep =
  | { readonly kind: "class-value" | "element" | "optional-value" }
  | { readonly kind: "member"; readonly declaration: RawNodeRef; readonly access: "read" | "write" }
  | { readonly kind: "class-prototype"; readonly declaration: RawNodeRef }
  | { readonly kind: "mapped-member"; readonly declaration: RawNodeRef; readonly source: RawComponentId;
      readonly key: RawMemberKey; readonly access: "read" | "write" }
  | { readonly kind: "parameter"; readonly signature: RawSignatureId; readonly index: number }
  | { readonly kind: "receiver" | "result"; readonly signature: RawSignatureId }
  | { readonly kind: "type-argument"; readonly declaration: RawNodeRef; readonly index: number }
  | { readonly kind: "union-member" | "intersection-member" | "tuple-element" | "argument-place" | "parameter-place"; readonly index: number }
  | { readonly kind: "index-key" | "index-value"; readonly declaration: RawNodeRef }
  | { readonly kind: "argument-tail" | "parameter-tail"; readonly start: number }
  | { readonly kind: "tuple-slice"; readonly start: number; readonly endCount: number; readonly readonly: boolean }
  | { readonly kind: "signature-tail"; readonly signature: RawSignatureId; readonly start: number; readonly readonly: boolean };

export interface RawComponent {
  readonly id: RawComponentId;
  readonly root: RawNodeRef;
  readonly path: readonly RawComponentStep[];
}

export interface RawSymbol {
  readonly id: RawSymbolId;
  readonly name: string;
  readonly declarations: readonly RawNodeRef[];
  readonly aliasTarget: RawFact<RawSymbolId | null>;
  readonly exports: RawFact<readonly RawSymbolExport[]>;
}

export interface RawSymbolExport {
  readonly name: string;
  readonly symbol: RawSymbolId;
}

export interface RawParameter {
  readonly declaration: RawNodeRef | null;
  readonly symbol: RawSymbolId | null;
  readonly kind: "required" | "optional" | "rest" | "variadic";
  readonly component: RawComponentId;
  readonly type: RawTypeId;
  readonly acceptsOmission: boolean;
  readonly initializer: RawNodeRef | null;
  readonly passing: RawFact<PassingMode>;
}

export interface RawSignature {
  readonly id: RawSignatureId;
  readonly target: RawSignatureId | null;
  readonly owner: RawNodeRef | null;
  readonly declaration: RawNodeRef | null;
  readonly kind: "call" | "construct";
  readonly typeParameters: RawFact<readonly RawNodeRef[]>;
  readonly receiver: RawFact<RawParameter | null>;
  readonly parameters: readonly RawParameter[];
  readonly result: RawFact<RawTypeId>;
  readonly composition: { readonly kind: "union" | "intersection"; readonly signatures: readonly RawSignatureId[] } | null;
}

export type RawMemberOrigin =
  | { readonly kind: "declaration"; readonly declaration: RawNodeRef; readonly access: "read" | "write" }
  | { readonly kind: "class-prototype"; readonly declaration: RawNodeRef; readonly facet: "value" }
  | { readonly kind: "mapped"; readonly declaration: RawNodeRef; readonly source: RawComponentId;
      readonly key: RawMemberKey; readonly access: "read" | "write" };

export interface RawMember {
  readonly key: RawMemberKey;
  readonly name: string;
  readonly origins: readonly RawMemberOrigin[];
  readonly declarations: readonly RawNodeRef[];
  readonly getters: readonly RawNodeRef[];
  readonly setters: readonly RawNodeRef[];
  readonly optional: boolean;
  readonly readonly: boolean;
  readonly read: RawFact<RawTypeId | null>;
  readonly write: RawFact<RawTypeId | null>;
  readonly readKind: "property" | "accessor" | "method" | "class-prototype" | "mapped" | "unavailable";
}

export interface RawIndexSignature {
  readonly declaration: RawNodeRef;
  readonly key: RawTypeId;
  readonly value: RawTypeId;
  readonly readonly: boolean;
}

export interface RawMemberTable {
  readonly id: RawMemberTableId;
  readonly component: RawComponentId;
  readonly members: readonly RawMember[];
  readonly indexes: readonly RawIndexSignature[];
  readonly elementBinders: RawFact<readonly RawNodeRef[]>;
  readonly calls: readonly RawSignatureId[];
  readonly constructs: readonly RawSignatureId[];
}

export interface RawTypeArgument {
  readonly parameter: RawNodeRef;
  readonly declaration: RawNodeRef | null;
  readonly argument: RawFact<RawTypeId>;
  readonly explicitTypeNode: RawNodeRef | null;
  readonly defaultTypeNode: RawNodeRef | null;
  readonly scope: "outer" | "local";
}

export type RawTypeForm =
  | { readonly kind: "scalar"; readonly scalar: "number" | "bigint" | "boolean" | "string" | "symbol"
      | "null" | "undefined" | "void" | "any" | "unknown" | "object" | "never" }
  | { readonly kind: "parameter"; readonly parameter: RawNodeRef; readonly owner: RawNodeRef; readonly index: number;
      readonly captures: RawFact<readonly RawNodeRef[]>; readonly constraint: RawTypeId | null; readonly default: RawTypeId | null }
  | { readonly kind: "self"; readonly owner: RawNodeRef }
  | { readonly kind: "enum"; readonly declaration: RawNodeRef }
  | { readonly kind: "declared"; readonly declaration: RawNodeRef; readonly facet: "instance" | "value";
      readonly parameters: readonly RawNodeRef[]; readonly arguments: readonly RawTypeArgument[];
      readonly definition: RawTypeId | null;
      readonly extent: RawFact<{ readonly length: bigint; readonly runtimeBase: "number" | "bigint" } | null> }
  | { readonly kind: "union" | "intersection"; readonly members: readonly RawTypeId[] }
  | { readonly kind: "array"; readonly readonly: boolean; readonly element: RawTypeId }
  | { readonly kind: "tuple"; readonly readonly: boolean; readonly elements: readonly RawParameter[] }
  | { readonly kind: "structure"; readonly inventory: RawMemberTableId }
  | { readonly kind: "indexed-access"; readonly object: RawTypeId; readonly index: RawTypeId;
      readonly selection: RawFact<RawTypeId> }
  | { readonly kind: "substitution"; readonly base: RawTypeId };

export interface RawCheckedType {
  readonly id: RawTypeId;
  readonly component: RawComponentId;
  readonly authoredTypeNode: RawNodeRef | null;
  readonly declaration: RawNodeRef | null;
  readonly definitionOwner: RawNodeRef | null;
  readonly definitionFacet: "instance" | "value" | null;
  readonly definitionParameters: RawFact<readonly RawNodeRef[]>;
  readonly alias: RawFact<{ readonly declaration: RawNodeRef; readonly arguments: readonly RawTypeArgument[] } | null>;
  readonly instantiatedBases: RawFact<readonly RawTypeId[]>;
  readonly literal: RawFact<RawLiteral | null>;
  readonly primitive: RawFact<{ readonly primitive: NativePrimitive;
    readonly runtimeBase: "number" | "bigint" | "boolean" | "string" | "object" } | null>;
  readonly form: RawFact<RawTypeForm>;
}

export interface RawTypeTable {
  readonly types: readonly RawCheckedType[];
  readonly components: readonly RawComponent[];
  readonly signatures: readonly RawSignature[];
  readonly members: readonly RawMemberTable[];
  readonly symbols: readonly RawSymbol[];
  readonly candidates: readonly RawCandidateList[];
  readonly dataLayouts: readonly RawDataLayout[];
  readonly memoryLayouts: readonly RawMemoryLayout[];
  readonly memoryFields: readonly RawMemoryField[];
}

export interface RawCheckerViews {
  readonly node: RawNodeRef;
  readonly read: RawFact<RawTypeId>;
  readonly declared: RawFact<RawTypeId | null>;
  readonly contextual: RawFact<RawTypeId | null>;
  readonly symbol: RawFact<RawSymbolId | null>;
}

export interface RawAuthoredArgument {
  readonly occurrence: RawNodeRef;
  readonly expression: RawNodeRef;
  readonly kind: "value" | "spread";
  readonly component: RawFact<RawComponentId>;
}

export interface RawArgumentBinding {
  readonly sourceArgument: RawNodeRef;
  readonly sourceArgumentIndex: number;
  readonly effectiveArgument: RawNodeRef;
  readonly effectiveArgumentIndex: number;
  readonly sourceForm: "value" | "spread-element" | "spread-sequence";
  readonly spreadElementIndex: number | null;
  readonly parameterIndex: number;
  readonly parameterForm: "parameter" | "rest-element" | "rest-sequence";
  readonly source: RawFact<RawComponentId>;
  readonly destination: RawFact<RawComponentId>;
}

export interface RawInferenceContribution {
  readonly declaration: RawNodeRef | null;
  readonly origin:
    | { readonly kind: "argument" | "argument-tail"; readonly subject: RawNodeRef;
        readonly effectiveArgumentIndex: number; readonly parameterIndex: number }
    | { readonly kind: "receiver" | "contextual-result"; readonly subject: RawNodeRef };
  readonly source: RawComponentId;
  readonly formal: RawComponentId;
}

export interface RawApplication {
  readonly invocation: RawNodeRef;
  readonly kind: "call" | "construct";
  readonly signature: RawSignatureId;
  readonly callee: RawNodeRef;
  readonly receiver: RawNodeRef | null;
  readonly classArguments: readonly RawTypeArgument[];
  readonly signatureArguments: readonly RawTypeArgument[];
}

export interface RawCallCandidate {
  readonly ordinal: number;
  readonly application: RawApplication;
  readonly sourceArguments: readonly RawAuthoredArgument[];
  readonly arguments: RawFact<readonly RawArgumentBinding[]>;
  readonly inferenceContributions: RawFact<readonly RawInferenceContribution[]>;
  readonly constraints: readonly RawConstraint[];
  readonly diagnostics: readonly RawDiagnosticReference[];
  readonly diagnosticCoverage: readonly RawDiagnosticCoverage[];
}

export interface RawCandidateList {
  readonly id: RawCandidateListId;
  readonly candidates: readonly RawCallCandidate[];
}

export type RawCallSelection =
  | { readonly kind: "applicable"; readonly invocation: RawNodeRef;
      readonly declarationOrder: RawFact<readonly RawSignatureId[]>; readonly candidates: RawCandidateListId;
      readonly selectedOrdinal: number; readonly result: RawTypeId; readonly parameters: readonly RawParameter[] }
  | { readonly kind: "conditional-candidates"; readonly invocation: RawNodeRef;
      readonly declarationOrder: RawFact<readonly RawSignatureId[]>; readonly candidates: RawCandidateListId;
      readonly diagnostics: readonly RawDiagnosticReference[] }
  | { readonly kind: "untyped"; readonly invocation: RawNodeRef;
      readonly declarationOrder: RawFact<readonly RawSignatureId[]>; readonly diagnostics: readonly RawDiagnosticReference[] };

export type RawDiagnosticCoverage =
  | { readonly kind: "unavailable"; readonly root: RawDiagnosticReference }
  | { readonly kind: "complete"; readonly root: RawDiagnosticReference;
      readonly obligations: readonly RawConstraint[];
      readonly purpose:
        | { readonly kind: "alternative-applicability"; readonly invocation: RawNodeRef; readonly notes: readonly RawDiagnosticReference[] }
        | { readonly kind: "other" } };

export type RawConstraint =
  | { readonly kind: "operator"; readonly site: RawNodeRef; readonly diagnostic: RawDiagnosticReference;
      readonly root: RawDiagnosticReference; readonly application: RawNodeRef | null;
      readonly operation: RawNodeRef; readonly left: RawComponentId; readonly right: RawComponentId }
  | { readonly kind: "index"; readonly site: RawNodeRef; readonly diagnostic: RawDiagnosticReference;
      readonly root: RawDiagnosticReference; readonly application: RawNodeRef | null;
      readonly access: RawNodeRef; readonly receiver: RawComponentId; readonly index: RawComponentId }
  | { readonly kind: "write-fit"; readonly site: RawNodeRef; readonly diagnostic: RawDiagnosticReference;
      readonly root: RawDiagnosticReference; readonly application: RawNodeRef | null;
      readonly source: RawComponentId; readonly destination: RawComponentId };

export interface RawCallableAssociation {
  readonly declaration: RawNodeRef;
  readonly advertised: readonly RawSignatureId[];
  readonly body: RawFact<RawNodeRef>;
  readonly classParameters: RawFact<readonly RawNodeRef[]>;
  readonly advertisedParameters: readonly RawAdvertisedParameters[];
  readonly bodyParameters: RawFact<readonly RawNodeRef[]>;
  readonly captures: RawFact<readonly RawNodeRef[]>;
}

export interface RawAdvertisedParameters {
  readonly signature: RawSignatureId;
  readonly parameters: RawFact<readonly RawNodeRef[]>;
}

export interface RawProviderDeclaration {
  readonly node: RawNodeRef;
  readonly identity: LibraryExportIdentity;
  readonly wellKnownDeclaration: RawNodeRef | null;
}

export interface RawReference {
  readonly occurrence: RawNodeRef;
  readonly meaning: "value" | "type" | "namespace";
  readonly declaration: RawNodeRef;
  readonly module: ModuleId;
  readonly project: boolean;
}

export interface RawModuleLink {
  readonly declaration: RawNodeRef;
  readonly specifier: RawNodeRef;
  readonly kind: "import" | "export";
  readonly resolution:
    | { readonly kind: "project"; readonly module: ModuleId }
    | { readonly kind: "non-project"; readonly module: LibraryModuleIdentity }
    | { readonly kind: "unresolved" };
}

export interface RawModuleExport {
  readonly name: string;
  readonly declaration: RawNodeRef;
  readonly module: ModuleId;
}

export interface RawImplementation {
  readonly declaration: RawNodeRef;
  readonly selection:
    | { readonly kind: "selected"; readonly contract: RawNodeRef; readonly implementation: RawReference }
    | { readonly kind: "unrelated" };
}

export interface RawHeritageEdge {
  readonly kind: "extends" | "implements";
  readonly declaration: RawNodeRef;
  readonly heritage: RawNodeRef;
  readonly target: RawReference;
  readonly typeArguments: readonly RawNodeRef[];
  readonly selected: RawNodeRef;
  readonly arguments: readonly RawTypeId[];
}

export interface RawConstructorParameter {
  readonly index: number;
  readonly name: string;
  readonly declaration: RawNodeRef | null;
  readonly authoredTypeNode: RawNodeRef | null;
  readonly component: RawComponentId;
  readonly acceptsOmission: boolean;
  readonly rest: boolean;
}

export interface RawConstructorSignature {
  readonly signature: RawSignatureId;
  readonly base: { readonly declaration: RawNodeRef; readonly signature: RawSignatureId } | null;
  readonly parameters: readonly RawConstructorParameter[];
}

export interface RawConstructor {
  readonly declaration: RawNodeRef;
  readonly witness: "implicit" | "declared";
  readonly signatures: readonly RawConstructorSignature[];
}

export type RawEnumConstant =
  | { readonly kind: "number"; readonly checkerValue: number; readonly authored: RawNumericLiteral | null }
  | { readonly kind: "string"; readonly value: string };

export interface RawEnumMember {
  readonly declaration: RawNodeRef;
  readonly constant: RawFact<RawEnumConstant>;
}

export interface RawEnum {
  readonly declaration: RawNodeRef;
  readonly declarations: readonly RawNodeRef[];
  readonly members: readonly RawEnumMember[];
}

export interface RawPropertyName {
  readonly node: RawNodeRef;
  readonly selected: RawFact<RawMemberKey | null>;
  readonly numericIndex: boolean;
}

export interface RawMemberReference {
  readonly table: RawMemberTableId;
  readonly index: number;
}

export type RawIndexSelection =
  | { readonly kind: "array-element" | "index-signature"; readonly declarations: readonly RawNodeRef[] }
  | { readonly kind: "tuple-element"; readonly index: number; readonly declarations: readonly RawNodeRef[] }
  | { readonly kind: "string-character"; readonly receiver: RawComponentId; readonly read: RawComponentId };

export type RawMemberArm =
  | { readonly kind: "member"; readonly receiver: RawComponentId; readonly member: RawMemberReference;
      readonly readDeclarations: readonly RawNodeRef[]; readonly writeDeclarations: readonly RawNodeRef[] }
  | { readonly kind: "index"; readonly receiver: RawComponentId; readonly selection: RawIndexSelection;
      readonly key: RawComponentId; readonly read: RawComponentId | null;
      readonly write: RawComponentId | null; readonly readonly: boolean };

export interface RawMemberUse {
  readonly occurrence: RawNodeRef;
  readonly receiver: RawNodeRef;
  readonly receiverComponent: RawComponentId;
  readonly key: RawNodeRef | null;
  readonly access: "read" | "write" | "read-write" | "delete";
  readonly callCallee: boolean;
  readonly optionalChain: boolean;
  readonly chainContinuation: boolean;
  readonly selectedDeclaration: RawNodeRef | null;
  readonly selectedDeclarations: readonly RawNodeRef[];
  readonly readDeclarations: readonly RawNodeRef[];
  readonly writeDeclarations: readonly RawNodeRef[];
  readonly read: RawComponentId | null;
  readonly write: RawComponentId | null;
  readonly arms: readonly RawMemberArm[];
}

export interface RawIteratorWitness {
  readonly declarations: readonly RawNodeRef[];
  readonly receiver: RawComponentId;
  readonly member: RawMemberReference;
  readonly signatures: readonly RawSignatureId[];
}

export type RawAtomicIteration = { readonly source: RawComponentId } & (
  | { readonly kind: "synchronous-iterator-protocol" | "asynchronous-iterator-protocol"
      | "synchronous-iterator-adapted-to-async"; readonly witness: RawIteratorWitness }
  | { readonly kind: "array-like-index" | "array-like-index-adapted-to-async";
      readonly declarations: readonly RawNodeRef[] }
  | { readonly kind: "string-code-unit-index" | "string-code-unit-index-adapted-to-async" | "untyped-dynamic-iteration" }
);

export type RawIterationMechanism =
  | RawAtomicIteration
  | { readonly kind: "union"; readonly alternatives: readonly RawAtomicIteration[] }
  | { readonly kind: "property-key-enumeration" };

export interface RawDisposalAlternative {
  readonly kind: "sync" | "async";
  readonly declarations: readonly RawNodeRef[];
  readonly signatures: readonly RawSignatureId[];
}

export interface RawFlowCondition {
  readonly expression: RawNodeRef;
  readonly assumed: boolean;
  readonly assignments: readonly RawNodeRef[];
}

export type RawProtocol =
  | { readonly kind: "iteration"; readonly occurrence: RawNodeRef; readonly operand: RawNodeRef;
      readonly form: "for-in" | "for-of" | "for-await-of" | "spread";
      readonly mechanism: RawFact<RawIterationMechanism | null> }
  | { readonly kind: "generator"; readonly declaration: RawNodeRef; readonly form: "sync" | "async";
      readonly signature: RawSignatureId; readonly resultDeclaration: RawNodeRef | null;
      readonly returnTypeBinding: RawNodeRef | null }
  | { readonly kind: "yield"; readonly occurrence: RawNodeRef; readonly generator: RawNodeRef;
      readonly form: "value" | "delegate"; readonly operand: RawNodeRef | null;
      readonly mechanism: RawFact<RawIterationMechanism | null> }
  | { readonly kind: "await"; readonly occurrence: RawNodeRef; readonly operand: RawNodeRef;
      readonly completion: RawFact<RawTypeId> }
  | { readonly kind: "resource-management"; readonly declaration: RawNodeRef; readonly form: "using" | "await using";
      readonly acquisition:
        | { readonly kind: "initializer"; readonly expression: RawNodeRef }
        | { readonly kind: "iteration"; readonly statement: RawNodeRef };
      readonly disposal: RawFact<readonly RawDisposalAlternative[]> }
  | { readonly kind: "callable-completion"; readonly declaration: RawNodeRef; readonly canFallThrough: boolean }
  | { readonly kind: "flow-conditions"; readonly reference: RawNodeRef; readonly conditions: readonly RawFlowCondition[] };

export interface RawProtocolCapture {
  readonly node: RawNodeRef;
  readonly fact: RawFact<RawProtocol | null>;
}

export interface RawStoragePlace {
  readonly expression: RawNodeRef;
  readonly storageExpression: RawNodeRef;
  readonly type: RawTypeId;
  readonly symbol: RawSymbolId | null;
  readonly declaration: RawNodeRef | null;
  readonly writable: boolean;
}

export interface RawStorageCapture {
  readonly node: RawNodeRef;
  readonly fact: RawFact<RawStoragePlace | null>;
}

export interface RawFieldMarker {
  readonly name: string;
  readonly typeNode: RawNodeRef;
  readonly readonly: boolean;
}

export interface RawMarkers {
  readonly struct: { readonly valueType: boolean; readonly fields: RawFact<readonly RawFieldMarker[]> } | null;
  readonly field: RawFieldMarker | null;
  readonly defaultValue: { readonly typeNode: RawNodeRef } | null;
  readonly jsString: boolean;
}

export type RawPointerType =
  | { readonly kind: "raw-address" }
  | { readonly kind: "typed-location"; readonly pointee: RawComponentId; readonly mutability: "readonly" | "readwrite" | "unspecified" }
  | { readonly kind: "native-pointer"; readonly declaration: RawNodeRef }
  | { readonly kind: "function-pointer"; readonly declaration: RawNodeRef;
      readonly parameters: readonly RawComponentId[]; readonly result: RawComponentId; readonly abi: readonly string[] };

export interface RawIntegerOperand {
  readonly runtimeBase: "number" | "bigint";
  readonly signedness: "signed" | "unsigned";
  readonly width: 8 | 16 | 32 | 64 | 128;
}

export type RawAddressInteger =
  | { readonly width: 32; readonly runtimeBase: "number"; readonly signedness: "unsigned" }
  | { readonly width: 64; readonly runtimeBase: "bigint"; readonly signedness: "unsigned" };

export type RawPointerOperation =
  | { readonly family: "typed-location"; readonly operation: "address-of" | "allocate" | "load" | "store"
      | "equal-pointer" | "hash-pointer" | "bind-pointer" | "project-pointer";
      readonly exportName: string; readonly arguments: readonly RawNodeRef[]; readonly typeArguments: readonly RawNodeRef[];
      readonly selection: "applicable" | "conditional-candidates" | "untyped" | "unvisited";
      readonly pointee: "available" | "unvisited" | "not-applicable" | "missing" }
  | { readonly family: "typed-location"; readonly operation: "view"; readonly pointer: RawNodeRef;
      readonly read: RawNodeRef; readonly write: RawNodeRef; readonly optional: boolean }
  | { readonly family: "native-pointer"; readonly operation: "load"; readonly pointer: RawNodeRef }
  | { readonly family: "native-pointer"; readonly operation: "store"; readonly pointer: RawNodeRef; readonly value: RawNodeRef }
  | { readonly family: "native-pointer"; readonly operation: "offset"; readonly pointer: RawNodeRef; readonly offset: RawNodeRef }
  | { readonly family: "raw-address"; readonly operation: "bind-raw-pointer"; readonly identity: RawNodeRef }
  | { readonly family: "raw-address"; readonly operation: "equal-raw-pointer"; readonly left: RawNodeRef; readonly right: RawNodeRef }
  | { readonly family: "raw-address"; readonly operation: "hash-raw-pointer"; readonly pointer: RawNodeRef }
  | { readonly family: "raw-memory"; readonly operation: "to-raw"; readonly pointer: RawNodeRef; readonly layout: RawNodeRef }
  | { readonly family: "raw-memory"; readonly operation: "reinterpret"; readonly raw: RawNodeRef; readonly layout: RawNodeRef }
  | { readonly family: "raw-memory"; readonly operation: "byte-offset"; readonly raw: RawNodeRef; readonly offset: RawNodeRef;
      readonly integer: RawIntegerOperand; readonly dataLayout: RawNodeRef }
  | { readonly family: "raw-memory"; readonly operation: "raw-to-address-integer"; readonly raw: RawNodeRef;
      readonly integer: RawAddressInteger; readonly dataLayout: RawNodeRef }
  | { readonly family: "raw-memory"; readonly operation: "address-integer-to-raw"; readonly address: RawNodeRef;
      readonly integer: RawAddressInteger; readonly dataLayout: RawNodeRef }
  | { readonly family: "keep-alive"; readonly operation: "keep-alive"; readonly value: RawNodeRef };

export type RawAttribute = {
  readonly occurrence: RawNodeRef;
  readonly applicationTarget: RawNodeRef;
  readonly selectedMember: { readonly selectedDeclaration: RawNodeRef | null; readonly declarations: readonly RawNodeRef[] } | null;
  readonly applicationMemberKind: "property" | "method" | null;
  readonly applicationPlacement: "declaration" | "constructor" | null;
  readonly applicationParameterName: string | null;
  readonly applicationTargetSpecifier: string | null;
} & (
  | { readonly kind: "builder-state" }
  | { readonly kind: "application"; readonly invocation: RawNodeRef }
);

export type RawSafetySelection =
  | { readonly kind: "selected"; readonly expression: RawNodeRef;
      readonly declaration: RawNodeRef | null; readonly declarations: readonly RawNodeRef[] }
  | { readonly kind: "unavailable"; readonly reason: "function-shape" | "receiver" | "member-evidence" };

export type RawSafety = {
  readonly occurrence: RawNodeRef;
  readonly provider: LibraryExportIdentity;
} & (
  | { readonly family: "unsafe-context"; readonly operation: "expression"; readonly expression: RawNodeRef }
  | { readonly family: "unsafe-context"; readonly operation: "remaining-block"; readonly firstDirectStatement: boolean }
  | { readonly family: "safety"; readonly operation: "root"; readonly form: "type" | "value"; readonly target: RawNodeRef | null }
  | { readonly family: "safety"; readonly operation: "select-member"; readonly predecessor: RawNodeRef | null;
      readonly memberKind: "indexer" | "method" | "property"; readonly selection: RawSafetySelection }
  | { readonly family: "safety"; readonly operation: "placement"; readonly predecessor: RawNodeRef | null;
      readonly placement: "declaration" | "constructor" | "getter" | "setter" }
  | { readonly family: "safety"; readonly operation: "apply"; readonly predecessor: RawNodeRef | null;
      readonly contract: "requires-unsafe" | "safe" }
);

export interface RawDataLayout {
  readonly id: RawDataLayoutId;
  readonly identity: LibraryExportIdentity;
  readonly fingerprint: string;
  readonly byteOrder: "little" | "big";
  readonly addressWidth: 32 | 64;
}

export type RawMemorySource =
  | { readonly kind: "binding"; readonly application: RawNodeRef;
      readonly declaration: RawNodeRef; readonly component: RawComponentId }
  | { readonly kind: "result"; readonly application: RawNodeRef;
      readonly path: readonly RawComponentStep[]; readonly component: RawComponentId };

export type RawMemoryLayout = {
  readonly id: RawMemoryLayoutId;
  readonly occurrence: RawNodeRef;
  readonly source: RawMemorySource;
  readonly dataLayout: RawDataLayoutId;
  readonly byteSize: bigint;
  readonly byteAlignment: bigint;
  readonly stride: bigint;
} & (
  | { readonly kind: "value"; readonly fields: readonly RawMemoryFieldId[] }
  | { readonly kind: "array"; readonly extent: { readonly length: bigint; readonly runtimeBase: "number" | "bigint" };
      readonly element: RawMemoryLayoutId }
);

export interface RawMemoryField {
  readonly id: RawMemoryFieldId;
  readonly occurrence: RawNodeRef;
  readonly owner: RawMemorySource;
  readonly value: RawMemorySource;
  readonly selector: RawNodeRef;
  readonly selection: RawNodeRef;
  readonly primary: RawNodeRef | null;
  readonly selectedDeclarations: readonly RawNodeRef[];
  readonly layout: RawMemoryLayoutId;
  readonly byteOffset: bigint;
  readonly byteAlignment: bigint;
}

export type RawMemoryMetadata =
  | { readonly kind: "data-layout"; readonly occurrence: RawNodeRef; readonly dataLayout: RawDataLayoutId }
  | { readonly kind: "memory-layout"; readonly layout: RawMemoryLayoutId }
  | { readonly kind: "memory-field"; readonly field: RawMemoryFieldId };

export interface RawFieldBinding {
  readonly occurrence: RawNodeRef;
  readonly application: RawNodeRef;
  readonly owner: RawMemorySource;
  readonly pointee: RawMemorySource;
  readonly fieldExpression: RawNodeRef;
  readonly field: RawMemoryFieldId;
  readonly pointerExpression: RawNodeRef;
}

export interface RawRecordFieldBinding {
  readonly expression: RawNodeRef;
  readonly binding: RawNodeRef;
}

export interface RawRecordBinding {
  readonly occurrence: RawNodeRef;
  readonly application: RawNodeRef;
  readonly source: RawMemorySource;
  readonly layoutExpression: RawNodeRef;
  readonly layout: RawMemoryLayoutId;
  readonly fields: readonly RawRecordFieldBinding[];
}

export type RawLayoutQuery = {
  readonly occurrence: RawNodeRef;
  readonly source: RawMemorySource;
  readonly layoutExpression: RawNodeRef;
  readonly layout: RawMemoryLayoutId;
} & (
  | { readonly operation: "size" | "alignment" | "stride" }
  | { readonly operation: "field-offset"; readonly selector: RawNodeRef;
      readonly selection: RawNodeRef; readonly primary: RawNodeRef | null;
      readonly selectedDeclarations: readonly RawNodeRef[] }
);

export interface RawCoreCapture {
  readonly node: RawNodeRef;
  readonly provider: RawFact<LibraryExportIdentity | null>;
  readonly markers: RawFact<RawMarkers>;
  readonly pointerType: RawFact<RawPointerType | null>;
  readonly pointerOperation: RawFact<RawPointerOperation | null>;
  readonly metadata: RawFact<RawMemoryMetadata | null>;
  readonly layout: RawFact<RawMemoryLayoutId | null>;
  readonly field: RawFact<RawMemoryFieldId | null>;
  readonly fieldBinding: RawFact<RawFieldBinding | null>;
  readonly recordBinding: RawFact<RawRecordBinding | null>;
  readonly layoutQuery: RawFact<RawLayoutQuery | null>;
  readonly attribute: RawFact<RawAttribute | null>;
  readonly safety: RawFact<RawSafety | null>;
  readonly argumentPassing: RawFact<
    | { readonly role: "declaration"; readonly mode: PassingMode }
    | { readonly role: "argument"; readonly mode: PassingMode; readonly storageExpression: RawNodeRef }
    | null>;
  readonly flowState: RawFact<"moved" | "borrowed-shared" | "borrowed-mut" | null>;
}

export interface RawModule {
  readonly module: ModuleId;
  readonly types: RawTypeTable;
  readonly tree: SourceFile<SyntaxPhase>;
  readonly checkerViews: readonly RawCheckerViews[];
  readonly calls: readonly RawCallSelection[];
  readonly callableAssociations: readonly RawCallableAssociation[];
  readonly providerDeclarations: readonly RawProviderDeclaration[];
  readonly references: readonly RawReference[];
  readonly links: readonly RawModuleLink[];
  readonly exports: readonly RawModuleExport[];
  readonly implementations: readonly RawImplementation[];
  readonly heritage: readonly RawHeritageEdge[];
  readonly constructors: readonly RawConstructor[];
  readonly enums: readonly RawEnum[];
  readonly propertyNames: readonly RawPropertyName[];
  readonly memberUses: readonly RawMemberUse[];
  readonly protocols: readonly RawProtocolCapture[];
  readonly storage: readonly RawStorageCapture[];
  readonly core: readonly RawCoreCapture[];
  readonly checkerDiagnostics: readonly Diagnostic[];
  readonly diagnosticCoverage: readonly RawDiagnosticCoverage[];
}

export interface ConvertedCheckedType {
  readonly type: TyId;
  readonly evidence: TypeEvidence;
}

/**
 * One row of the checker option set. A constant row has the same value in every session. Two rows are read from
 * the snapshot: the project root, and whether installed declaration packages are admitted.
 */
export type CheckerOptionValue =
  | { readonly kind: "constant"; readonly value: boolean | string }
  | { readonly kind: "project-root" }
  | { readonly kind: "installed-declarations" };

export interface CheckerOptionRow {
  readonly name: string;
  readonly value: CheckerOptionValue;
  readonly reason: string;
}

export interface CheckerOptionInput {
  readonly projectRoot: string;
  readonly installedDeclarations: SourceDeclarationPolicy["installedDeclarations"];
}

export type CheckerOptionSet = Readonly<Record<string, boolean | string | readonly string[]>>;

/** The options of the one compiler session of an analysis: exactly one entry per row of the table, and no other. */
export type CheckerOptions = (input: CheckerOptionInput) => CheckerOptionSet;

export type PrepareSourceImports = (
  deps: PreparationDeps,
  snapshot: PackageSnapshot,
) => Result<ImportPreparation>;

export type OpenCheckedProgram = (
  deps: CaptureDeps,
  snapshot: ProjectSnapshot,
  preparation: ImportPreparation,
) => Result<CheckedProgram>;

export type CaptureModule = (
  deps: CaptureDeps,
  program: CheckedProgram,
  module: ModuleId,
) => Result<RawModule>;

export type CaptureLibraryCatalogue = (
  deps: CaptureDeps,
  program: CheckedProgram,
  roles: readonly LibraryRoleEntry[],
) => Result<LibraryCatalogue>;

export type LowerModule = (
  deps: LowerDeps,
  module: RawModule,
) => Result<HirModule>;

export type ConvertCheckedType = (
  deps: LowerDeps,
  module: RawModule,
  type: RawTypeId,
) => Result<ConvertedCheckedType>;

export type CaptureNumericLiteral = (
  deps: LowerDeps,
  literal: RawNumericLiteral,
) => Result<LiteralValue>;

