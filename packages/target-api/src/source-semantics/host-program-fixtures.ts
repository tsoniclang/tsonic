// Test fixture: the Host program owner without a JS API profile (target-api does not depend on js-source-profile).
// Host tests prove facts on HostSourceProgram / SourceProgramFacts; profile facts are proven in js-source-profile.
// host-input tests also read the program's own checker views and host-input adapter (`semantics`, `input`): the same
// instances the Host program was built from (R4), exposed by the fixture only.
import type { CheckedSourceProgram } from "@tsonic/tsts";
import type { SourceJsApiFacts } from "../public/source/objects.js";
import type { SourceProgramSemantics } from "../host-input/semantics-types.js";
import type { SourceHostInput } from "../host-input/index.js";
import { buildHostSourceProgram, createTargetSourceProgram } from "./target-source-program.js";
import type { HostSourceProgram } from "./types.js";

export const emptySourceJsApiFacts: SourceJsApiFacts = Object.freeze({
  collection: () => undefined,
  member: () => undefined,
});

export const hostProgramFixtureOptions = Object.freeze({ profile: () => emptySourceJsApiFacts });

/** A Host program for tests, with its checker views (`semantics`) and host-input adapter (`input`). */
export type HostSourceProgramFixture = HostSourceProgram & {
  readonly semantics: SourceProgramSemantics;
  readonly input: SourceHostInput;
};

export function createHostSourceProgramFixture(source: CheckedSourceProgram): HostSourceProgramFixture {
  const built = buildHostSourceProgram(source, hostProgramFixtureOptions);
  return Object.freeze(Object.assign(Object.create(null) as object, built.program,
    { semantics: built.semantics, input: built.input })) as HostSourceProgramFixture;
}

export function createTargetSourceProgramFixture(source: CheckedSourceProgram) {
  return createTargetSourceProgram(source, hostProgramFixtureOptions);
}
