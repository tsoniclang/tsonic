import { createJsSourceApiFacts } from "../../../../packages/js-source-profile/dist/index.js";
import assert from "node:assert/strict";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { buildHostSourceProgram } from "../../../../packages/target-api/dist/source-semantics/target-source-program.js";
// A Host program with its checker views and host-input adapter (the HostSourceProgramFixture shape), JS profile on.
function hostProgramFixture(checked) {
    const built = buildHostSourceProgram(checked, { profile: createJsSourceApiFacts, platform: { kind: "known", nativeIntegerBits: 64, basis: "test" } });
    return Object.freeze(Object.assign(Object.create(null), built.program, { semantics: built.semantics, input: built.input }));
}

function checked(sourceText, files = {}) {
    const source = createCompilerSessionFromFiles({
        currentDirectory: "/src",
        files: { "/src/index.ts": sourceText, ...files },
        compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
    }).checkSource();
    assert.equal(source.diagnostics.length, 0, formatDiagnostics(source.diagnostics.filter(diagnostic => diagnostic !== undefined)));
    return hostProgramFixture(source);
}
export { checked };
