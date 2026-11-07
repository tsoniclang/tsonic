// Test fixture: the Host program owner for source-core tests, with the core analyses registered and no JS API profile
// (source-core does not depend on js-source-profile; profile facts are proven in js-source-profile).
import type { CheckedSourceProgram } from "@tsonic/tsts";
import { createHostSourceProgram } from "@tsonic/target-api/host";
import { tsonicCoreSourceAnalyses } from "./analysis/host-analyses.js";

const options = Object.freeze({
  profile: () => Object.freeze({
    identity: () => undefined, collection: () => undefined, member: () => undefined, callRefusal: () => undefined,
    callStorage: () => undefined, callbackEffects: () => undefined, invocationOnlyParameters: () => Object.freeze([]),
    nativeConstructorStorage: () => undefined, keyCategories: () => undefined,
  }),
  analyses: Object.freeze([tsonicCoreSourceAnalyses]),
  // E24 (N5): the known 64-bit native integer premise of source-core tests.
  platform: Object.freeze({ kind: "known" as const, nativeIntegerBits: 64 as const, basis: "source-core test fixture" }),
});

export function createHostSourceProgramFixture(source: CheckedSourceProgram) {
  return createHostSourceProgram(source, options);
}
