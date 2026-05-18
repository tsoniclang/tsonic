import {
  FEATURE_KEYS,
  type BackendCapabilityManifest,
} from "../capabilities/backend-capabilities.js";

export const ALL_SUPPORTED_TEST_BACKEND_CAPABILITIES: BackendCapabilityManifest =
  new Map(FEATURE_KEYS.map((name) => [name, { name, status: "supported" }]));
