export type CaseLevel = "function" | "pass" | "verifier" | "pipeline" | "corpus";
export type CaseFormat = "json" | "ts" | "hir" | "tir" | "mir" | "facts" | "program";
export type CaseValue = string | number | bigint | boolean | null | readonly CaseValue[] | { readonly [key: string]: CaseValue };

export interface CaseDescriptor {
  readonly name: string;
  readonly level: CaseLevel;
  readonly rule: string;
  readonly input: string;
  readonly expected: string;
}

export interface CaseDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly site: CaseValue;
  readonly [field: string]: CaseValue;
}

export type CaseOutcome =
  | { readonly kind: "accepted"; readonly value: CaseValue; readonly diagnostics: readonly CaseDiagnostic[] }
  | { readonly kind: "refused"; readonly diagnostics: readonly [CaseDiagnostic, ...CaseDiagnostic[]] };

export interface CaseInput {
  readonly module: string;
  readonly name: string;
  readonly rule: string;
  readonly format: CaseFormat;
  readonly text: string;
}

export type CaseAdapter = (input: CaseInput) => CaseOutcome | Promise<CaseOutcome>;

export interface CaseDeps {
  readonly evidenceDirectory: string;
  readonly modules: readonly string[];
  readonly adapters: Readonly<Partial<Record<CaseLevel, CaseAdapter>>>;
  readonly readText: (path: string) => string | Promise<string>;
  readonly canonical: (path: string) => string | null | Promise<string | null>;
  readonly list: (directory: string) => readonly string[] | Promise<readonly string[]>;
  readonly decode: (text: string, format: CaseFormat) => CaseOutcome | Promise<CaseOutcome>;
}

export type CaseFailureCode = "descriptor" | "location" | "inventory" | "input" | "expected" | "adapter" | "outcome" | "mismatch";

export type CaseResult =
  | { readonly status: "passed"; readonly path: string; readonly outcome: CaseOutcome }
  | { readonly status: "failed"; readonly path: string; readonly code: CaseFailureCode; readonly detail: string };

export type RunCase = (deps: CaseDeps, descriptorPath: string) => Promise<CaseResult>;
export declare function runCase(deps: CaseDeps, descriptorPath: string): Promise<CaseResult>;
export declare function compareCaseValues(actual: CaseValue, expected: CaseValue): boolean;

export interface CaseEvidence {
  readonly actual: string;
  readonly expected: string;
}

export declare function writeCaseEvidence(directory: string, actual: CaseValue, expected: CaseValue): CaseEvidence;
