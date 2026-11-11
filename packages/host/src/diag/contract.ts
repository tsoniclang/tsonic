import type { Origin, PassName } from "../ids/contract.js";

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

export interface InvariantFailure {
  readonly pass: PassName;
  readonly query: { readonly name: string; readonly encodedKey: string } | null;
  readonly origin: Origin | null;
  readonly message: string;
}

export type ThrowInvariant = (failure: InvariantFailure) => never;
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
