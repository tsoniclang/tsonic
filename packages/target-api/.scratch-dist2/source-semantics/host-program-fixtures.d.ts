import type { CheckedSourceProgram } from "@tsonic/tsts";
import type { SourceJsApiFacts } from "../public/source/objects.js";
import type { SourceProgramSemantics } from "../host-input/semantics-types.js";
import type { SourceHostInput } from "../host-input/index.js";
import type { HostSourceProgram } from "./types.js";
import type { SourcePlatformFacts } from "./platform-model.js";
export declare const emptySourceJsApiFacts: SourceJsApiFacts;
/** The known 64-bit native integer premise of Host tests (E24); the 32-bit / missing / conflicting controls are unit tests. */
export declare const hostProgramFixturePlatform: SourcePlatformFacts;
export declare const hostProgramFixtureOptions: Readonly<{
    profile: () => SourceJsApiFacts;
    platform: {
        readonly kind: "known";
    } & import("./platform-model.js").SourceNativeIntegerPremise;
}>;
/** A Host program for tests, with its checker views (`semantics`) and host-input adapter (`input`). */
export type HostSourceProgramFixture = HostSourceProgram & {
    readonly semantics: SourceProgramSemantics;
    readonly input: SourceHostInput;
};
export declare function createHostSourceProgramFixture(source: CheckedSourceProgram): HostSourceProgramFixture;
export declare function createTargetSourceProgramFixture(source: CheckedSourceProgram): import("../public/source.js").TargetSourceProgramFacts;
//# sourceMappingURL=host-program-fixtures.d.ts.map