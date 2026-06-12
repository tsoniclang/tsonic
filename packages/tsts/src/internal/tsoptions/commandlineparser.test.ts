import { test } from "node:test";
import assert from "node:assert/strict";
import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr } from "../../go/compat.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import type { OrderedMap } from "../collections/ordered_map.js";
import {
  NewOrderedMapWithSizeHint,
  OrderedMap_Get,
  OrderedMap_Set,
} from "../collections/ordered_map.js";
import { TSFalse, TSUnknown, Tristate_IsTrue } from "../core/tristate.js";
import type { FS } from "../vfs/vfs.js";
import { FromMap } from "../vfs/vfstest/vfstest.js";
import { ParseBuildCommandLine, ParseCommandLine } from "./commandlineparser.js";
import type { ParseConfigHost } from "./tsconfigparsing.js";
import { GetParsedCommandLineOfConfigFile } from "./tsconfigparsing.js";

function parseHost(files: ReadonlyMap<string, string>, currentDirectory: string, useCaseSensitiveFileNames = true): ParseConfigHost {
  const fs = FromMap(new Map(files), useCaseSensitiveFileNames as bool);
  return {
    FS: (): FS => fs,
    GetCurrentDirectory: (): string => currentDirectory,
  };
}

function assertNoDiagnostics(errors: readonly GoPtr<Diagnostic>[] | undefined): void {
  assert.deepEqual(errors ?? [], []);
}

test("ParseCommandLine preserves explicit null command-line overrides through config parsing", () => {
  const host = parseHost(new Map<string, string>([
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

  const [rawCustomConditions, rawCustomConditionsExists] =
    OrderedMap_Get(commandLine.Raw as OrderedMap<string, unknown>, "customConditions");
  assert.equal(rawCustomConditionsExists, true);
  assert.equal(rawCustomConditions, undefined);

  const wrappedRaw = NewOrderedMapWithSizeHint<string, unknown>(1 as int);
  OrderedMap_Set(wrappedRaw, "compilerOptions", commandLine.Raw);
  const [parsed, errors] = GetParsedCommandLineOfConfigFile(
    "/project/tsconfig.json",
    commandLine.ParsedConfig!.CompilerOptions,
    wrappedRaw as OrderedMap,
    host,
    undefined,
  );

  assertNoDiagnostics(errors);
  assert.ok(parsed !== undefined);
  assertNoDiagnostics(parsed.Errors);
  assert.equal(parsed.ParsedConfig!.CompilerOptions!.CustomConditions, undefined);
});

test("ParseCommandLine mirrors boolean false and null option values", () => {
  const host = parseHost(new Map<string, string>(), "/project");

  const falseValue = ParseCommandLine(["--composite", "false", "0.ts"], host);
  assert.ok(falseValue !== undefined);
  assertNoDiagnostics(falseValue.Errors);
  assert.deepEqual(falseValue.ParsedConfig!.FileNames, ["0.ts"]);
  assert.equal(falseValue.ParsedConfig!.CompilerOptions!.Composite, TSFalse);

  const nullValue = ParseCommandLine(["--composite", "null", "0.ts"], host);
  assert.ok(nullValue !== undefined);
  assertNoDiagnostics(nullValue.Errors);
  assert.deepEqual(nullValue.ParsedConfig!.FileNames, ["0.ts"]);
  assert.equal(nullValue.ParsedConfig!.CompilerOptions!.Composite, TSUnknown);
});

test("ParseBuildCommandLine mirrors default project and project ordering", () => {
  const host = parseHost(new Map<string, string>(), "/repo");

  const defaultBuild = ParseBuildCommandLine([], host);
  assert.ok(defaultBuild !== undefined);
  assert.deepEqual(defaultBuild.Projects, ["."]);
  assertNoDiagnostics(defaultBuild.Errors);

  const orderedBuild = ParseBuildCommandLine(["--force", "src", "tests", "--verbose"], host);
  assert.ok(orderedBuild !== undefined);
  assert.deepEqual(orderedBuild.Projects, ["src", "tests"]);
  assert.equal(Tristate_IsTrue(orderedBuild.BuildOptions!.Force), true);
  assert.equal(Tristate_IsTrue(orderedBuild.BuildOptions!.Verbose), true);
  assertNoDiagnostics(orderedBuild.Errors);
});

test("ParseBuildCommandLine reports nonsensical build option combinations", () => {
  const host = parseHost(new Map<string, string>(), "/repo");
  const cases: readonly [readonly string[], readonly string[]][] = [
    [["--clean", "--force"], ["clean", "force"]],
    [["--clean", "--verbose"], ["clean", "verbose"]],
    [["--clean", "--watch"], ["clean", "watch"]],
    [["--watch", "--dry"], ["watch", "dry"]],
  ];

  for (const [args, expectedArgs] of cases) {
    const parsed = ParseBuildCommandLine([...args], host);
    assert.ok(parsed !== undefined);
    assert.equal(parsed.Errors.length, 1, args.join(" "));
    assert.deepEqual(parsed.Errors[0]!.messageArgs, expectedArgs);
  }
});
