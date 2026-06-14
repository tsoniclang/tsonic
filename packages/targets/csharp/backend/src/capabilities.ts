import {
  FEATURE_KEYS,
  type BackendCapability,
  type BackendCapabilityManifest,
  type FeatureKey,
} from "@tsonic/frontend";

export const CSHARP_BACKEND_TARGET_ID = "csharp" as const;

const unsupported = (
  name: FeatureKey,
  diagnosticCode: NonNullable<BackendCapability["diagnosticCode"]>,
  diagnosticMessage: string,
  remediation: string
): BackendCapability => ({
  name,
  status: "unsupported",
  diagnosticCode,
  diagnosticMessage,
  remediation,
});

const supported = (name: FeatureKey): BackendCapability => ({
  name,
  status: "supported",
});

const capabilityEntries = [
  [
    "intersection-value-storage",
    unsupported(
      "intersection-value-storage",
      "TSN7414",
      "Intersection types cannot be emitted as deterministic runtime storage.",
      "Use a named interface/class for runtime storage, or keep the intersection only as a generic constraint."
    ),
  ],
  [
    "broad-json-targets",
    unsupported(
      "broad-json-targets",
      "TSN5001",
      "JSON.parse cannot target a broad compile-time type for deterministic native-safe code.",
      "Use untyped JSON.parse for the JsValue dynamic carrier, or provide a closed target type so generated serializers can be emitted."
    ),
  ],
  [
    "broad-json-stringify-source",
    unsupported(
      "broad-json-stringify-source",
      "TSN5001",
      "JSON.stringify requires a closed compile-time source type for deterministic native-safe code.",
      "Pass a concrete DTO, primitive, array of concrete values, or object literal with fully known property types."
    ),
  ],
  [
    "dynamic-function-arity-introspection",
    unsupported(
      "dynamic-function-arity-introspection",
      "TSN5001",
      "JavaScript function.length requires a statically proven function carrier.",
      "Use function.length only on identifiers or this-bound functions whose callable type is known at compile time."
    ),
  ],
  ["broad-array-narrowing", supported("broad-array-narrowing")],
  ["dynamic-json-parsing", supported("dynamic-json-parsing")],
  ["typed-json-parsing", supported("typed-json-parsing")],
  ["closed-array-narrowing", supported("closed-array-narrowing")],
  ["class-decorators", supported("class-decorators")],
  ["method-decorators", supported("method-decorators")],
  ["parameter-decorators", supported("parameter-decorators")],
  ["out-parameters", supported("out-parameters")],
  ["ref-parameters", supported("ref-parameters")],
  ["in-parameters", supported("in-parameters")],
  ["generators", supported("generators")],
  ["async-iteration", supported("async-iteration")],
  ["bigint", supported("bigint")],
] satisfies readonly (readonly [FeatureKey, BackendCapability])[];

export const NATIVE_AOT_CAPABILITIES: BackendCapabilityManifest = new Map(
  capabilityEntries
);

const missingCapabilityKeys = FEATURE_KEYS.filter(
  (key) => !NATIVE_AOT_CAPABILITIES.has(key)
);

if (missingCapabilityKeys.length > 0) {
  throw new Error(
    `Backend capability manifest is missing feature keys: ${missingCapabilityKeys.join(", ")}`
  );
}
