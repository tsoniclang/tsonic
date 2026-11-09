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

export interface IntegerFormat {
  readonly signedness: "signed" | "unsigned";
  readonly bits: 8 | 16 | 32 | 64 | 128;
}

export interface IntegerRange {
  readonly minimum: bigint;
  readonly maximum: bigint;
}

export type DataResult<Value> =
  | { readonly kind: "valid"; readonly value: Value }
  | { readonly kind: "invalid"; readonly code: "INVALID_INTEGER_FORMAT"
      | "INVALID_INTEGER_VALUE" | "INVALID_KEY_DOMAIN";
      readonly message: string };

export type AlgebraKey<SymbolIdentity> =
  | { readonly kind: "name"; readonly name: string }
  | { readonly kind: "symbol"; readonly identity: SymbolIdentity };

export type KeyDomain<SymbolIdentity> =
  | { readonly kind: "empty" }
  | { readonly kind: "finite"; readonly keys: readonly AlgebraKey<SymbolIdentity>[] }
  | { readonly kind: "names" }
  | { readonly kind: "symbols" }
  | { readonly kind: "all" };

export interface AlgebraWork {
  charge(amount: bigint): void;
}

export interface ModelAlgebra {
  readonly integerBounds: (format: IntegerFormat) => DataResult<IntegerRange>;
  readonly integerInFormat: (value: bigint, format: IntegerFormat,
    work: AlgebraWork) => DataResult<boolean>;
  readonly keyEqual: <SymbolIdentity>(left: AlgebraKey<SymbolIdentity>,
    right: AlgebraKey<SymbolIdentity>, work: AlgebraWork) => DataResult<boolean>;
  readonly keyIncluded: <SymbolIdentity>(domain: KeyDomain<SymbolIdentity>,
    key: AlgebraKey<SymbolIdentity>, work: AlgebraWork) => DataResult<boolean>;
  readonly keyDomainContains: <SymbolIdentity>(container: KeyDomain<SymbolIdentity>,
    contained: KeyDomain<SymbolIdentity>, work: AlgebraWork) => DataResult<boolean>;
}
