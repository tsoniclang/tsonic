import { test } from "node:test";
import assert from "node:assert/strict";
import { NewOrderedMapWithSizeHint, OrderedMap_Get, OrderedMap_Set, } from "../collections/ordered_map.js";
import { TSFalse, TSUnknown, Tristate_IsTrue } from "../core/tristate.js";
import { FromMap } from "../vfs/vfstest/vfstest.js";
import { ParseBuildCommandLine, ParseCommandLine } from "./commandlineparser.js";
import { GetParsedCommandLineOfConfigFile } from "./tsconfigparsing.js";
function parseHost(files, currentDirectory, useCaseSensitiveFileNames = true) {
    const fs = FromMap(new Map(files), useCaseSensitiveFileNames);
    return {
        FS: () => fs,
        GetCurrentDirectory: () => currentDirectory,
    };
}
function assertNoDiagnostics(errors) {
    assert.deepEqual(errors ?? [], []);
}
test("ParseCommandLine preserves explicit null command-line overrides through config parsing", () => {
    const host = parseHost(new Map([
        ["/project/tsconfig.json", `{
  "compilerOptions": {
    "customConditions": ["condition1", "condition2"]
  }
}`],
        ["/project/index.ts", ""],
    ]), "/project");
    const commandLine = ParseCommandLine(["--project", "/project", "--customConditions", "null"], host);
    assert.ok(commandLine !== undefined);
    assertNoDiagnostics(commandLine.Errors);
    const [rawCustomConditions, rawCustomConditionsExists] = OrderedMap_Get(commandLine.Raw, "customConditions");
    assert.equal(rawCustomConditionsExists, true);
    assert.equal(rawCustomConditions, undefined);
    const wrappedRaw = NewOrderedMapWithSizeHint(1);
    OrderedMap_Set(wrappedRaw, "compilerOptions", commandLine.Raw);
    const [parsed, errors] = GetParsedCommandLineOfConfigFile("/project/tsconfig.json", commandLine.ParsedConfig.CompilerOptions, wrappedRaw, host, undefined);
    assertNoDiagnostics(errors);
    assert.ok(parsed !== undefined);
    assertNoDiagnostics(parsed.Errors);
    assert.equal(parsed.ParsedConfig.CompilerOptions.CustomConditions, undefined);
});
test("ParseCommandLine mirrors boolean false and null option values", () => {
    const host = parseHost(new Map(), "/project");
    const falseValue = ParseCommandLine(["--composite", "false", "0.ts"], host);
    assert.ok(falseValue !== undefined);
    assertNoDiagnostics(falseValue.Errors);
    assert.deepEqual(falseValue.ParsedConfig.FileNames, ["0.ts"]);
    assert.equal(falseValue.ParsedConfig.CompilerOptions.Composite, TSFalse);
    const nullValue = ParseCommandLine(["--composite", "null", "0.ts"], host);
    assert.ok(nullValue !== undefined);
    assertNoDiagnostics(nullValue.Errors);
    assert.deepEqual(nullValue.ParsedConfig.FileNames, ["0.ts"]);
    assert.equal(nullValue.ParsedConfig.CompilerOptions.Composite, TSUnknown);
});
test("ParseBuildCommandLine mirrors default project and project ordering", () => {
    const host = parseHost(new Map(), "/repo");
    const defaultBuild = ParseBuildCommandLine([], host);
    assert.ok(defaultBuild !== undefined);
    assert.deepEqual(defaultBuild.Projects, ["."]);
    assertNoDiagnostics(defaultBuild.Errors);
    const orderedBuild = ParseBuildCommandLine(["--force", "src", "tests", "--verbose"], host);
    assert.ok(orderedBuild !== undefined);
    assert.deepEqual(orderedBuild.Projects, ["src", "tests"]);
    assert.equal(Tristate_IsTrue(orderedBuild.BuildOptions.Force), true);
    assert.equal(Tristate_IsTrue(orderedBuild.BuildOptions.Verbose), true);
    assertNoDiagnostics(orderedBuild.Errors);
});
test("ParseBuildCommandLine reports nonsensical build option combinations", () => {
    const host = parseHost(new Map(), "/repo");
    const cases = [
        [["--clean", "--force"], ["clean", "force"]],
        [["--clean", "--verbose"], ["clean", "verbose"]],
        [["--clean", "--watch"], ["clean", "watch"]],
        [["--watch", "--dry"], ["watch", "dry"]],
    ];
    for (const [args, expectedArgs] of cases) {
        const parsed = ParseBuildCommandLine([...args], host);
        assert.ok(parsed !== undefined);
        assert.equal(parsed.Errors.length, 1, args.join(" "));
        assert.deepEqual(parsed.Errors[0].messageArgs, expectedArgs);
    }
});
//# sourceMappingURL=commandlineparser.test.js.map