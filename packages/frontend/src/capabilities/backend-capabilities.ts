export type BackendCapabilityStatus = "supported" | "partial" | "unsupported";

export type BackendCapability = {
  readonly name: string;
  readonly status: BackendCapabilityStatus;
  readonly diagnosticCode?: DiagnosticCode;
  readonly diagnosticMessage?: string;
  readonly remediation?: string;
};

export type BackendCapabilityManifest = ReadonlyMap<string, BackendCapability>;

export const capability = (
  manifest: BackendCapabilityManifest | undefined,
  name: string
): BackendCapability | undefined => manifest?.get(name);

export const isCapabilitySupported = (
  manifest: BackendCapabilityManifest | undefined,
  name: string
): boolean => capability(manifest, name)?.status === "supported";
import type { DiagnosticCode } from "../types/diagnostic.js";
