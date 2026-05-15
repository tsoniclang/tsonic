import type {
  BackendCapability,
  BackendCapabilityManifest,
} from "@tsonic/frontend";

const unsupported = (
  name: string,
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

const supported = (name: string): BackendCapability => ({
  name,
  status: "supported",
});

export const NATIVE_AOT_CAPABILITIES: BackendCapabilityManifest = new Map([
  [
    "intersection-as-storage",
    unsupported(
      "intersection-as-storage",
      "TSN7414",
      "Intersection types cannot be emitted as NativeAOT runtime storage.",
      "Use a named interface/class for runtime storage, or keep the intersection only as a generic constraint."
    ),
  ],
  [
    "broad-json-parse-target",
    unsupported(
      "broad-json-parse-target",
      "TSN5001",
      "JSON.parse cannot target a broad compile-time type for NativeAOT-safe code.",
      "Use untyped JSON.parse for the JsValue dynamic carrier, or provide a closed target type so generated serializers can be emitted."
    ),
  ],
  [
    "function-length",
    unsupported(
      "function-length",
      "TSN5001",
      "JavaScript function.length is not supported in emitted Tsonic code.",
      "Model arity explicitly in source or use a typed overload surface."
    ),
  ],
  [
    "array-isarray-broad",
    unsupported(
      "array-isarray-broad",
      "TSN5001",
      "Array.isArray cannot narrow a broad runtime value without a closed carrier.",
      "Use Array.isArray only on values whose possible runtime carriers are known at compile time."
    ),
  ],
  ["dynamic-json-parse-jsvalue", supported("dynamic-json-parse-jsvalue")],
  ["closed-json-parse-typed", supported("closed-json-parse-typed")],
  ["array-isarray-closed", supported("array-isarray-closed")],
]);
