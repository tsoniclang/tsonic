import { test } from "node:test";
import assert from "node:assert/strict";
import type { bool } from "@tsonic/core/types.js";
import type { FS } from "../vfs/vfs.js";
import { FromMap } from "../vfs/vfstest/vfstest.js";
import type { ParseConfigHost } from "./tsconfigparsing.js";
import { GetParsedCommandLineOfConfigFile } from "./tsconfigparsing.js";
import type { ParsedCommandLine } from "./parsedcommandline.js";
import {
  ParsedCommandLine_FileNames,
  ParsedCommandLine_LiteralFileNames,
  ParsedCommandLine_PossiblyMatchesFileName,
  ParsedCommandLine_ReloadFileNamesOfParsedCommandLine,
} from "./parsedcommandline.js";

const sourceFiles = new Map<string, string>([
  ["/dev/a.ts", ""],
  ["/dev/a.d.ts", ""],
  ["/dev/a.js", ""],
  ["/dev/b.ts", ""],
  ["/dev/b.js", ""],
  ["/dev/c.d.ts", ""],
  ["/dev/z/a.ts", ""],
  ["/dev/z/abz.ts", ""],
  ["/dev/z/aba.ts", ""],
  ["/dev/z/b.ts", ""],
  ["/dev/z/bbz.ts", ""],
  ["/dev/z/bba.ts", ""],
  ["/dev/x/a.ts", ""],
  ["/dev/x/aa.ts", ""],
  ["/dev/x/b.ts", ""],
  ["/dev/x/y/a.ts", ""],
  ["/dev/x/y/b.ts", ""],
  ["/dev/js/a.js", ""],
  ["/dev/js/b.js", ""],
  ["/dev/js/d.min.js", ""],
  ["/dev/js/ab.min.js", ""],
  ["/ext/ext.ts", ""],
  ["/ext/b/a..b.ts", ""],
]);

function parseConfig(jsonText: string, files: ReadonlyMap<string, string> = sourceFiles): ParsedCommandLine {
  const fs = FromMap(new Map<string, string>([
    ...files,
    ["/dev/tsconfig.json", jsonText],
  ]), true as bool);
  const host: ParseConfigHost = {
    FS: (): FS => fs,
    GetCurrentDirectory: (): string => "/dev",
  };
  const [parsed, errors] = GetParsedCommandLineOfConfigFile("/dev/tsconfig.json", undefined, undefined, host, undefined);
  assert.deepEqual(errors ?? [], []);
  assert.deepEqual(parsed?.Errors ?? [], []);
  assert.ok(parsed !== undefined);
  return parsed;
}

function assertMatches(parsedCommandLine: ParsedCommandLine, files: ReadonlyMap<string, string>, matches: readonly string[]): void {
  const expectedMatches = new Set(matches);
  for (const fileName of files.keys()) {
    assert.equal(
      ParsedCommandLine_PossiblyMatchesFileName(parsedCommandLine, fileName),
      expectedMatches.has(fileName),
      `fileName: ${fileName}`,
    );
  }
  for (const fileName of matches) {
    if (!files.has(fileName)) {
      assert.equal(
        ParsedCommandLine_PossiblyMatchesFileName(parsedCommandLine, fileName),
        true,
        `fileName: ${fileName}`,
      );
    }
  }
}

test("ParsedCommandLine.PossiblyMatchesFileName mirrors TS-Go literal files and include lists", () => {
  const noFilesFS = FromMap(new Map<string, string>(), true as bool);

  const literalFiles = parseConfig(`{
    "files": [
      "a.ts",
      "b.ts"
    ]
  }`);
  assertMatches(literalFiles, sourceFiles, [
    "/dev/a.ts",
    "/dev/b.ts",
  ]);

  const literalFilesWithExclude = parseConfig(`{
    "files": [
      "a.ts",
      "b.ts"
    ],
    "exclude": [
      "b.ts"
    ]
  }`);
  assertMatches(literalFilesWithExclude, sourceFiles, [
    "/dev/a.ts",
    "/dev/b.ts",
  ]);

  const reloadedLiteralFiles = ParsedCommandLine_ReloadFileNamesOfParsedCommandLine(literalFilesWithExclude, noFilesFS);
  assert.ok(reloadedLiteralFiles !== undefined);
  assertMatches(reloadedLiteralFiles, new Map(), [
    "/dev/a.ts",
    "/dev/b.ts",
  ]);

  const duplicateFiles = parseConfig(`{
    "files": [
      "a.ts",
      "a.ts",
      "b.ts"
    ]
  }`);
  assert.deepEqual(ParsedCommandLine_LiteralFileNames(duplicateFiles), [
    "/dev/a.ts",
    "/dev/b.ts",
  ]);

  const literalIncludes = parseConfig(`{
    "include": [
      "a.ts",
      "b.ts"
    ]
  }`);
  assertMatches(literalIncludes, sourceFiles, [
    "/dev/a.ts",
    "/dev/b.ts",
  ]);

  const reloadedLiteralIncludes = ParsedCommandLine_ReloadFileNamesOfParsedCommandLine(literalIncludes, noFilesFS);
  assert.ok(reloadedLiteralIncludes !== undefined);
  assertMatches(reloadedLiteralIncludes, new Map(), [
    "/dev/a.ts",
    "/dev/b.ts",
  ]);
});

test("ParsedCommandLine file name list mirrors TS-Go duplicate handling", () => {
  const parsed = parseConfig(`{
    "files": [
      "a.ts",
      "a.ts",
      "b.ts"
    ]
  }`);

  assert.deepEqual(ParsedCommandLine_FileNames(parsed), [
    "/dev/a.ts",
    "/dev/b.ts",
  ]);
});
