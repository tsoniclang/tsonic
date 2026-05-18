import {
  FEATURE_KEYS,
  type BackendCapability,
  type BackendCapabilityManifest,
  type FeatureKey,
} from "@tsonic/frontend";

const unsupported = (name: FeatureKey): BackendCapability => ({
  name,
  status: "unsupported",
});

const supported = (name: FeatureKey): BackendCapability => ({
  name,
  status: "supported",
});

const unsupportedCapabilities = new Set<FeatureKey>([
  "intersection-value-storage",
  "broad-json-targets",
  "broad-json-stringify-source",
  "dynamic-function-arity-introspection",
  "broad-array-narrowing",
]);

export const CSHARP_TEST_CAPABILITIES: BackendCapabilityManifest = new Map(
  FEATURE_KEYS.map((name) => [
    name,
    unsupportedCapabilities.has(name) ? unsupported(name) : supported(name),
  ])
);
