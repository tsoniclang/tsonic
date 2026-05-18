import type { DiagnosticCode } from "../types/diagnostic.js";

export type BackendCapabilityStatus = "supported" | "partial" | "unsupported";

export const FEATURE_KEYS = [
  "dynamic-function-arity-introspection",
  "dynamic-json-parsing",
  "typed-json-parsing",
  "closed-array-narrowing",
  "broad-array-narrowing",
  "broad-json-targets",
  "broad-json-stringify-source",
  "intersection-value-storage",
  "class-decorators",
  "method-decorators",
  "parameter-decorators",
  "out-parameters",
  "ref-parameters",
  "in-parameters",
  "generators",
  "async-iteration",
  "bigint",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type BackendCapability = {
  readonly name: FeatureKey;
  readonly status: BackendCapabilityStatus;
  readonly diagnosticCode?: DiagnosticCode;
  readonly diagnosticMessage?: string;
  readonly remediation?: string;
};

export type BackendCapabilityManifest = ReadonlyMap<
  FeatureKey,
  BackendCapability
>;

export const capability = (
  manifest: BackendCapabilityManifest | undefined,
  name: FeatureKey
): BackendCapability | undefined => manifest?.get(name);

export const isCapabilitySupported = (
  manifest: BackendCapabilityManifest | undefined,
  name: FeatureKey
): boolean => capability(manifest, name)?.status === "supported";

export const isCapabilityUnavailable = (
  manifest: BackendCapabilityManifest | undefined,
  name: FeatureKey
): boolean => !isCapabilitySupported(manifest, name);
