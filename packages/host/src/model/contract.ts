export interface ProgramIdentity {
  readonly kind: "program";
}

export interface Identity {
  readonly programIdentity: ProgramIdentity;
  readonly owner: string;
}

export interface Original extends Identity {
  readonly kind: "original";
}

export interface SourceSite {
  readonly original: Original;
  readonly document: string;
  readonly start: number;
  readonly length: number;
}

export type Presence<Value> =
  | { readonly kind: "none" }
  | { readonly kind: "present"; readonly value: Value };

export interface DiagnosticEvidence {
  readonly name: string;
  readonly value: string | number | bigint | boolean;
}

export interface Diagnostic {
  readonly category: "error" | "warning" | "message";
  readonly code: string;
  readonly source: string;
  readonly owner: string;
  readonly message: string;
  readonly site: Presence<SourceSite>;
  readonly related: readonly SourceSite[];
  readonly evidence: readonly DiagnosticEvidence[];
}

export interface ResourceLimit {
  readonly dimension: string;
  readonly limit: bigint;
}

export interface ResourceDomain {
  readonly name: string;
  readonly limits: readonly ResourceLimit[];
  readonly admission: "operation" | "cohort";
  readonly keyDimension: string;
}

export interface ResourceUsage {
  readonly domain: string;
  readonly owner: Identity;
  readonly dimension: string;
  readonly charged: bigint;
  readonly temporary: bigint;
  readonly retained: bigint;
  readonly peak: bigint;
}

export interface CompilerResourceLimitFailure extends Error {
  readonly kind: "compiler-resource-limit";
  readonly dimension: string;
  readonly limit: bigint;
  readonly diagnostic: Diagnostic;
}

export type ContextInvariantCode =
  | "INVALID_CONTEXT_INPUT" | "CONTEXT_CLOSED"
  | "DUPLICATE_QUESTION" | "MISSING_PROVIDER" | "DUPLICATE_PROVIDER"
  | "REGISTRATION_SEALED" | "REGISTRATION_UNSEALED" | "FOREIGN_QUESTION"
  | "INVALID_QUESTION_KEY" | "INVALID_RESOURCE_SCOPE" | "QUESTION_CYCLE"
  | "AUTHENTICATION_REENTRANCY";

export interface QueryChainEntry {
  readonly owner: string;
  readonly question: string;
  readonly site: Presence<SourceSite>;
}

export interface ContextInvariantFailure extends Error {
  readonly code: ContextInvariantCode;
  readonly owner: string;
  readonly question: string;
  readonly chain: readonly QueryChainEntry[];
}
