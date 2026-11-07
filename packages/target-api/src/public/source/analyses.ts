// SourceAnalysisFacts: every Host analysis a target needs, as typed members of SourceProgramFacts (supervisor ruling,
// nextgen 2026-11-07). Each member is computed by the Host once per program view, lazily, and returns frozen records.
// Invariant I1: no checker Type / Signature / Symbol / Resolved*Info in any record or callback reachable from here.
// Node and SourceFile are site keys only. A target never reaches the Host program (`@tsonic/target-api/host`).
import type { Node, SourceFile } from "@tsonic/tsts";
import type { SourceNumericLiteralToken } from "../../source-semantics/literal-values-model.js";
import type { SourceTypeDescriptor, SourceTypeFlowPathPart } from "../../source-semantics/descriptor-model.js";
import type {
  SourceEnumAdmissionIssue, SourceEnumConstantSelection, SourceEnumIntegerWidthSelection,
} from "../../source-semantics/enum-model.js";
import type { SourceNativeValueGuard } from "../../source-semantics/native-value-guards.js";
import type { SourceCallSignatureParameter } from "./selections.js";
import type { SourceIntegerRange } from "../../source-navigation/integer-ranges/domain.js";
import type { SourceClosedCallableArgument } from "../../source-navigation/callable-arguments.js";
import type { SourceLexicalCapture, SourceLexicalCaptureSelection } from "../../source-navigation/lexical-captures.js";
import type { SourceArtifactFile, SourceArtifactIssue } from "../../target-analysis/artifacts/source-files.js";
import type { SourceBinaryEntryIssue } from "../../target-analysis/entry-validation.js";
import type {
  SourceControlFlowSelection, SourceDeclarationControlFlowOptions, SourceDeclarationFlowExecutionRegion, SourceFlowLimits,
} from "../../target-analysis/flow/model.js";
import type {
  SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipPremises, SourceDeclarationOwnershipUnresolved,
} from "../../target-analysis/ownership/model.js";
import type { SourceDeclarationOwnershipQueries } from "../../target-analysis/ownership/query.js";
import type { SourceGenericAdoptionIssue } from "../../target-analysis/ownership/generic-adoption.js";
import type { SourceStorageLimits, SourceStorageQueries } from "../../target-analysis/source-storage/model/types.js";
import type { SourceHeritageEdge } from "./objects.js";
import type {
  SourceNativeIntegerBits, SourceNativeIntegerPremise, SourceNativeIntegerWidthRefusalCode, SourcePlatformFacts,
} from "../../source-semantics/platform-model.js";

export type {
  SourceNativeIntegerBits, SourceNativeIntegerPremise, SourceNativeIntegerWidthRefusalCode, SourcePlatformFacts,
};

/**
 * The published platform facts: the composition root's premise (its kind, width and basis, unchanged) and the one Host
 * native-integer fit rule over it (Q90 (b); local-type-flow/operator-decisions.ts sourcePrimitiveLiteralFit).
 */
export type SourcePublishedPlatformFacts = SourcePlatformFacts & {
  /**
   * Whether an integer value fits a native-int / native-uint: under a known width, its bounds; under a missing or
   * conflicting premise, the answer both widths share, else "refused" (the TSONIC_NATIVE_INTEGER_WIDTH_* cell, N5/E24).
   */
  nativeIntegerFit(value: bigint, primitive: "native-int" | "native-uint"): "fits" | "does-not-fit" | "refused";
};
export type {
  SourceArtifactFile, SourceArtifactIssue, SourceBinaryEntryIssue, SourceClosedCallableArgument,
  SourceControlFlowSelection, SourceDeclarationControlFlowOptions, SourceDeclarationFlowExecutionRegion,
  SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipPremises, SourceDeclarationOwnershipQueries,
  SourceDeclarationOwnershipUnresolved, SourceEnumAdmissionIssue, SourceEnumConstantSelection,
  SourceEnumIntegerWidthSelection, SourceFlowLimits, SourceGenericAdoptionIssue, SourceIntegerRange, SourceLexicalCapture, SourceLexicalCaptureSelection,
  SourceNativeValueGuard, SourceStorageLimits, SourceStorageQueries,
};

/** One type-flow obligation the Host recorded (interface, read-only, constraint, literal admission, write fit). */
export interface SourceObligation {
  readonly kind: "interface" | "read-only" | "constraint" | "literal-admission" | "write-fit";
  readonly site: Node;
  readonly type: SourceTypeDescriptor;
  readonly required: Node;
  readonly requiredType?: SourceTypeDescriptor;
  readonly value?: Node;
  readonly valueType?: SourceTypeDescriptor;
  /** literal-admission only. */
  readonly authority?: "inferred" | "declared";
  /** The call whose argument binding produced the obligation, with its parameter declaration and argument expression. */
  readonly call?: Node;
  readonly parameter?: Node;
  readonly argument?: Node;
  /** The written value's flow position (its node plus the destructuring path into it), when the obligation has one. */
  readonly valueVariable?: { readonly node: Node; readonly path: readonly SourceObligationPathPart[] };
}

/** One step of a value's flow path: array element, optional value, member, tuple element or generic binder. */
export type SourceObligationPathPart = SourceTypeFlowPathPart;

/** A callable binding that is only ever called (never read as a value), and the callee it aliases. */
export interface SourceCallOnlyAliasRecord {
  readonly expression: Node;
  readonly selectedDeclaration: Node;
  /** The member access use when the alias is `receiver.member`; read its selection with `selections.memberAccess`. */
  readonly member?: Node;
  readonly receiverDeclaration?: Node;
  readonly declarations: readonly Node[];
  readonly calls: readonly Node[];
}

/** The static name of a property name node (identifier, literal, computed key) or why it has none. */
export type SourcePropertyName =
  | { readonly kind: "resolved"; readonly name: string; readonly constant: SourcePropertyNameConstant }
  | { readonly kind: "well-known-symbol"; readonly symbol: string }        // "Symbol.iterator", "Symbol.asyncIterator", ...
  | { readonly kind: "unique-symbol"; readonly declaration: Node }         // the `unique symbol` declaration
  | { readonly kind: "rejected"; readonly reason: string; readonly failure: "source" | "resource" };

export type SourcePropertyNameConstant =
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "numeric"; readonly token: SourceNumericLiteralToken }
  | { readonly kind: "enum-member"; readonly declaration: Node; readonly value: bigint | string };

export interface SourcePropertyNameIssue {
  /**
   * Host refusal code: TSONIC_COMPUTED_PROPERTY_NAME_NOT_PROVEN for an unproven Source name (was the C#-originated
   * CSHARP_COMPUTED_FIELD_NAME_NOT_PROVEN), TSONIC_COMPILER_RESOURCE_LIMIT when the name evaluation hit its budget.
   */
  readonly code: "TSONIC_COMPUTED_PROPERTY_NAME_NOT_PROVEN" | "TSONIC_COMPILER_RESOURCE_LIMIT";
  readonly node: Node;
  readonly reason: string;
  readonly failure: "source" | "resource";
}

declare const sourceAnalysisKeyBrand: unique symbol;
/** Typed key of an extension analysis contributed by a Host extension package (source-core). */
export interface SourceAnalysisKey<T> {
  readonly id: string;
  readonly [sourceAnalysisKeyBrand]?: T;
}

declare const sourceAnalysisHostBrand: unique symbol;
/** Opaque Host program handle given to extension analysis factories; only Host packages can open it. */
export interface SourceAnalysisHost {
  readonly [sourceAnalysisHostBrand]: true;
}

/** An extension analysis registration, supplied by the composition root (host) like the JS profile. */
export interface SourceAnalysisExtension<T> {
  readonly key: SourceAnalysisKey<T>;
  create(host: SourceAnalysisHost): T;
}

export interface SourceStorageAnalysisInput {
  readonly sourceFiles: readonly SourceFile[];
  readonly limits?: SourceStorageLimits;
  /**
   * The target ABI premises the analysis needs (required, no default; Q100). The JS API call and callback effects are
   * always Host facts (facts.profile). A caller with no target premise passes `{}`.
   */
  readonly premises: SourceStorageTargetPremises;
}

/**
 * The target premises of the storage analysis. These are target ABI facts, not Source meaning: the Host composes every
 * JS API storage and callback effect itself from facts.profile (D18).
 */
export interface SourceStorageTargetPremises {
  /**
   * The constructors of an ambient provider class (a non-project class declaration) that the target binds to a plain
   * native constructor; undefined when the target binds none of them so.
   */
  readonly nativeClassConstructors?: (binding: Node) => readonly Node[] | undefined;
}

export interface SourceDeclarationOwnershipInput {
  readonly sourceNodes: readonly Node[];
  readonly nodes: readonly Node[];
  readonly premises: SourceDeclarationOwnershipPremises;
  readonly budget: SourceDeclarationOwnershipBudget;
  readonly flowLimits?: Partial<SourceFlowLimits>;
}

export interface SourceGenericAdoptionInput {
  readonly projectRoot: string;
  readonly nodes: readonly Node[];
  readonly premises: Pick<SourceDeclarationOwnershipPremises, "completionFor">;
  readonly budget: SourceDeclarationOwnershipBudget;
  readonly exemptTypeParameter?: (parameter: Node) => boolean;
}

export type SourceGenericAdoptionSelection =
  | { readonly kind: "resolved"; readonly issues: readonly SourceGenericAdoptionIssue[] }
  | SourceDeclarationOwnershipUnresolved;

export interface SourceAnalysisFacts {
  // ---- platform -------------------------------------------------------------------------------------------------
  /**
   * The active target/toolchain ABI premise for native-int / native-uint (E24, N5), exactly as the composition root
   * passed it (TargetSourceProgramOptions.platform). Every Host native-int / native-uint width decision used it; a target
   * representation that needs the width reads this fact, never a constant of its own.
   */
  readonly platform: SourcePublishedPlatformFacts;

  // ---- integers -------------------------------------------------------------------------------------------------
  /** Proven integer interval of a number-typed expression (number = Host descriptor primitive "number"). */
  integerRange(expression: Node): SourceIntegerRange | undefined;
  /** `%` expressions whose operands are proven exact int32 values. */
  exactInt32Remainders(): readonly Node[];
  integerIsNonnegative(expression: Node): boolean;

  // ---- bindings and callables -----------------------------------------------------------------------------------
  callOnlyAlias(declaration: Node): SourceCallOnlyAliasRecord | undefined;
  /** A deferred callable captures the binding before its declaration initializes it. */
  capturedBeforeInitialization(declaration: Node): boolean;
  /** A deferred callable captures the binding before its first write. */
  capturedBeforeFirstWrite(declaration: Node): boolean;
  /** The callable definition's value is discarded at its creation site. */
  callableDefinitionDiscarded(declaration: Node): boolean;
  /** Parameter declarations of a callable value (function, arrow, method), declaration order. */
  callableValueParameters(declaration: Node): readonly Node[] | undefined;
  /**
   * The value-parameter slots (a leading `this` parameter excluded) of a function, method, constructor, accessor, arrow
   * or function expression declaration, or of a call, construct or method signature, in declaration order (FX-CC #13).
   * Kind: `rest` for `...p`, `optional` when the parameter accepts omission, else `required`. Equal to
   * `SourceCallSelection.signatureParameters` of every call that selects the signature. undefined for any other node.
   */
  signatureParameters(signature: Node): readonly SourceCallSignatureParameter[] | undefined;
  /**
   * The full lexical capture selection of an owner, computed over the whole owner (roots `[owner]`): every captured
   * outer binding (declaration Node, authored first-reference order) with all its references, the owner's self
   * references, and the captured outer receivers (`this` / `super` owners) with their references.
   * `navigation.scopes.captures` projects the same selection to (binding, written flag). Owners: a project
   * function declaration, function expression, arrow, method, constructor or accessor with a body, or a project class
   * declaration or expression; any other node is an invariant failure (throws).
   */
  lexicalCaptures(owner: Node): SourceLexicalCaptureSelection;
  /** The call and argument position an expression is passed as (through parentheses / satisfies). */
  callArgument(expression: Node): SourceClosedCallableArgument | undefined;
  /** The authored annotation text that names an expression's destination binding. Naming only. */
  annotationHint(expression: Node, annotationType?: string): string | undefined;
  /** typeof / absence / literal / nominal guard an expression tests. */
  nativeValueGuard(expression: Node): SourceNativeValueGuard | undefined;
  /** The single `extends` edge an empty interface re-expresses, when its type is identical to that base. */
  interfaceRepresentationBase(declaration: Node): SourceHeritageEdge | undefined;

  // ---- enums and property names ---------------------------------------------------------------------------------
  enumConstant(member: Node): SourceEnumConstantSelection | undefined;
  enumIntegerWidth(declaration: Node): SourceEnumIntegerWidthSelection | undefined;
  propertyName(name: Node): SourcePropertyName | undefined;
  /**
   * The Host refusal of a property name node in a project file whose static name the Host could not prove (its
   * `propertyName` is "rejected"); undefined for every other node. A per-node query, not part of facts.refusals() (Q93):
   * a target forwards it unchanged (code, message = reason, site = node) only where it needs a static named field.
   */
  propertyNameIssue(name: Node): SourcePropertyNameIssue | undefined;

  // ---- program analyses -----------------------------------------------------------------------------------------
  artifactFiles(constructions: readonly { readonly sourceFile: SourceFile; readonly targetSourceFile: SourceFile }[]):
    { readonly files: readonly SourceArtifactFile[]; readonly issues: readonly SourceArtifactIssue[] };
  /**
   * Host refusals TSONIC_UNCALLED_BINARY_ENTRY_MAIN of an executable's entry file (code, message, site Host-originated).
   * A target that builds an executable (a target output setting) forwards them unchanged before its analysis; it never
   * originates the code. Every other Source refusal (enum issues included) is in facts.refusals(), except the per-node
   * property-name issues (`propertyNameIssue`, Q93).
   */
  binaryEntryIssues(entry: SourceFile): readonly SourceBinaryEntryIssue[];
  controlFlow(declaration: Node, options: SourceDeclarationControlFlowOptions):
    SourceControlFlowSelection<SourceDeclarationFlowExecutionRegion>;
  /** The switch statement's case labels cover every arm of its discriminant. */
  switchCoverage(switchStatement: Node): boolean;
  storage(input: SourceStorageAnalysisInput): SourceStorageQueries;
  declarationOwnership(input: SourceDeclarationOwnershipInput): SourceDeclarationOwnershipQueries;
  genericAdoption(input: SourceGenericAdoptionInput): SourceGenericAdoptionSelection;

  // ---- Host extension analyses (source-core) --------------------------------------------------------------------
  /** The extension analysis registered under `key`; an unregistered key is an invariant failure (throws). */
  extension<T>(key: SourceAnalysisKey<T>): T;
}
