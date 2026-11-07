// Test fixture: the Host program owner for source-core tests, with the core analyses registered and no JS API profile
// (source-core does not depend on js-source-profile; profile facts are proven in js-source-profile).
import type { CheckedSourceProgram } from "@tsonic/tsts";
import { createHostSourceProgram } from "@tsonic/target-api/host";
import { tsonicCoreSourceAnalyses } from "./analysis/host-analyses.js";

const options = Object.freeze({
  profile: () => Object.freeze({ collection: () => undefined, member: () => undefined }),
  analyses: Object.freeze([tsonicCoreSourceAnalyses]),
});

export function createHostSourceProgramFixture(source: CheckedSourceProgram) {
  return createHostSourceProgram(source, options);
}
