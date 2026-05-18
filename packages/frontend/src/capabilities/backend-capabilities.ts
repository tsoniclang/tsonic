export type BackendCapabilityStatus = "supported" | "partial" | "unsupported";

export type FeatureKey =
  | "function-length"
  | "dynamic-json-parse-jsvalue"
  | "closed-json-parse-typed"
  | "array-isarray-closed"
  | "array-isarray-broad"
  | "broad-json-parse-target"
  | "intersection-runtime-storage"
  | "class-decorators"
  | "method-decorators"
  | "parameter-decorators"
  | "out-parameters"
  | "ref-parameters"
  | "in-parameters"
  | "generators"
  | "async-iteration"
  | "bigint";

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
import type { DiagnosticCode } from "../types/diagnostic.js";
