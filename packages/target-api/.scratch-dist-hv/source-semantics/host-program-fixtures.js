import { buildHostSourceProgram, createTargetSourceProgram } from "./target-source-program.js";
export const emptySourceJsApiFacts = Object.freeze({
    identity: () => undefined,
    collection: () => undefined,
    member: () => undefined,
    callRefusal: () => undefined,
    keyCategories: () => undefined,
    callStorage: () => undefined,
    callbackEffects: () => undefined,
    invocationOnlyParameters: () => Object.freeze([]),
    nativeConstructorStorage: () => undefined,
});
/** The known 64-bit native integer premise of Host tests (E24); the 32-bit / missing / conflicting controls are unit tests. */
export const hostProgramFixturePlatform = Object.freeze({
    kind: "known", nativeIntegerBits: 64, basis: "Host program test fixture",
});
export const hostProgramFixtureOptions = Object.freeze({ profile: () => emptySourceJsApiFacts, platform: hostProgramFixturePlatform });
export function createHostSourceProgramFixture(source) {
    const built = buildHostSourceProgram(source, hostProgramFixtureOptions);
    return Object.freeze(Object.assign(Object.create(null), built.program, { semantics: built.semantics, input: built.input }));
}
export function createTargetSourceProgramFixture(source) {
    return createTargetSourceProgram(source, hostProgramFixtureOptions);
}
//# sourceMappingURL=host-program-fixtures.js.map