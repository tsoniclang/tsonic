import type { KeyData, ModuleId, NodeId, Origin, SourceNodeRef } from "../ids/contract.js";

export type HostDiagnosticCode = string & {
  readonly diagnosticKind: "host";
};

export type HostDiagnosticCodeConstructor = (name: string) => HostDiagnosticCode;

export type DiagnosticCode =
  | { readonly kind: "host"; readonly name: HostDiagnosticCode; readonly rendered: string }
  | { readonly kind: "checker"; readonly number: number; readonly rendered: string }
  | { readonly kind: "extension"; readonly number: number; readonly extensionCode: string; readonly rendered: string };

export type Severity = "error" | "warning" | "suggestion";

export type DiagnosticSite =
  | { readonly kind: "source"; readonly origin: Origin }
  | { readonly kind: "file"; readonly path: string }
  | { readonly kind: "none" };

export type MessageArgument =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "integer"; readonly value: bigint }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "origin"; readonly value: Origin };

export interface RelatedDiagnostic {
  readonly site: DiagnosticSite;
  readonly code: DiagnosticCode;
  readonly message: string;
}

export interface TextEdit {
  readonly origin: Origin;
  readonly replacement: string;
}

export interface DiagnosticFix {
  readonly description: string;
  readonly edits: readonly TextEdit[];
}

export interface Diagnostic {
  readonly code: DiagnosticCode;
  readonly severity: Severity;
  readonly site: DiagnosticSite;
  readonly source: string | null;
  readonly evidence: readonly string[];
  readonly message: string;
  readonly arguments: readonly MessageArgument[];
  readonly related: readonly RelatedDiagnostic[];
  readonly fix: DiagnosticFix | null;
}

export interface CheckerDiagnosticRef {
  readonly module: ModuleId;
  readonly index: number;
}

export interface UnitRequest {
  readonly query: string;
  readonly key: KeyData;
}

/**
 * `component` is a position inside a type that the request produced. Its path is key data produced only by the one
 * function of `ir-types` that encodes a selector path; no producer encodes a path of its own, so that one component
 * has one position.
 */
export type UnitPosition =
  | { readonly kind: "result" }
  | { readonly kind: "module-node"; readonly module: ModuleId; readonly node: NodeId }
  | { readonly kind: "source-node"; readonly node: SourceNodeRef }
  | { readonly kind: "component"; readonly path: readonly KeyData[] };

export interface UnitRef {
  readonly request: UnitRequest;
  readonly position: UnitPosition;
}

export type DiagnosticIdentity =
  | { readonly kind: "checker"; readonly diagnostic: CheckerDiagnosticRef }
  | { readonly kind: "host"; readonly unit: UnitRef; readonly code: HostDiagnosticCode };

/** Equal keys are the same identity; the canonical order of identities is the UTF-16 code unit order of their keys. */
export type DiagnosticIdentityKey = (identity: DiagnosticIdentity) => string;

/**
 * A `unit` cause names a unit whose result was complete before the result that cites it, so every chain of unit
 * causes ends in a `diagnostic` cause. A result that absorbs an error cites the unit it took the error from and does
 * not copy that unit's causes. For captured associations the grounding is checked by the checked-module verifier.
 */
export type Cause =
  | { readonly kind: "diagnostic"; readonly diagnostic: DiagnosticIdentity }
  | { readonly kind: "unit"; readonly unit: UnitRef };

export interface ErrorValue {
  readonly kind: "error";
  readonly causes: readonly [Cause, ...Cause[]];
}

export interface ResourceLimitReport {
  readonly owner: InvariantOwner;
  readonly limit: string;
  readonly maximum: number;
  readonly site: DiagnosticSite;
  readonly unit: UnitRef;
}

export type ResourceLimitDiagnostic = (report: ResourceLimitReport) => Diagnostic;

export type DiagnosticStage =
  | "front"
  | "forms"
  | "inference"
  | "safety"
  | "constant"
  | "analysis"
  | "driver";

export interface DiagnosticDefinition {
  readonly code: HostDiagnosticCode;
  readonly severity: Severity;
  readonly stage: DiagnosticStage;
  readonly template: string;
}

export interface DiagnosticRegistry {
  readonly definitions: readonly DiagnosticDefinition[];
}

export interface Computed<Value> {
  readonly value: Value;
  readonly diagnostics: readonly Diagnostic[];
}

export type Result<Value> =
  | { readonly kind: "ok"; readonly value: Value; readonly diagnostics: readonly Diagnostic[] }
  | { readonly kind: "refused"; readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]] };

export type InvariantOwner =
  | "diag"
  | "ir-types"
  | "ir-hir"
  | "ir-infer"
  | "ir-tir"
  | "ir-mir"
  | "ir-facts"
  | "ir-program"
  | "dataflow"
  | "query"
  | "libraries"
  | "snapshot"
  | "step"
  | "front"
  | "decls"
  | "rules"
  | "infer"
  | "elaborate"
  | "validate"
  | "lower-mir"
  | "evaluate"
  | "metadata"
  | "analyses/liveness"
  | "analyses/initialization"
  | "analyses/refinements"
  | "analyses/origins"
  | "analyses/suspension"
  | "analyses/errorStorage"
  | "analyses/pointerBacking"
  | "summaries"
  | "pipeline"
  | "project"
  | "packages"
  | "plugins"
  | "artifacts"
  | "orchestration"
  | "cli"
  | "create-tsonic";

export interface InvariantFailure {
  readonly owner: InvariantOwner;
  readonly query: { readonly name: string; readonly encodedKey: string } | null;
  readonly origin: Origin | null;
  readonly message: string;
}

export type ThrowInvariant = (failure: InvariantFailure) => never;
export type RequirePresent = <Value>(value: Value | undefined, failure: InvariantFailure) => Value;
export type OrderDiagnostics = (diagnostics: readonly Diagnostic[]) => readonly Diagnostic[];
export type LookupDiagnostic = (registry: DiagnosticRegistry, code: HostDiagnosticCode) => DiagnosticDefinition | null;

export interface Violation<Rule extends string, Site> {
  readonly rule: Rule;
  readonly site: Site;
  readonly detail: readonly MessageArgument[];
}

export type TextParseResult<Value> =
  | { readonly kind: "parsed"; readonly value: Value }
  | { readonly kind: "invalid-text"; readonly offset: number; readonly line: number;
      readonly column: number; readonly expected: readonly string[]; readonly found: string | null };
