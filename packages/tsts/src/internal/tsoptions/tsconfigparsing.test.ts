// Mirror of internal/tsoptions/tsconfigparsing_test.go
// TestExtendedConfigErrorsAppearOnCacheHit (with the test-local memoCache
// reproduced). The remaining tests in that file are baseline-driven
// (testutil/baseline + tsoptionstest + TypeScript-submodule fixtures) and
// belong to the suite-side baseline gating; BenchmarkParseSrcCompiler is a Go
// benchmark with no mirror.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { bool } from "../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import type { SourceFileParseOptions } from "../ast/parseoptions.js";
import { ScriptKindJSON } from "../core/scriptkind.js";
import { ParseSourceFile } from "../parser/parser/statements-declarations.js";
import type { FS } from "../vfs/vfs.js";
import { FromMap } from "../vfs/vfstest/vfstest.js";
import type { Path } from "../tspath/path.js";
import { ToPath } from "../tspath/path.js";
import type { ExtendedConfigCache, ExtendedConfigCacheEntry, ParseConfigHost, TsConfigSourceFile } from "./tsconfigparsing.js";
import { ParseExtendedConfig, ParseJsonSourceFileConfigFileContent } from "./tsconfigparsing.js";

// tsoptionstest.NewVFSParseConfigHost
function vfsParseConfigHost(files: ReadonlyMap<string, string>, currentDirectory: string, useCaseSensitiveFileNames: bool): ParseConfigHost {
  const fs = FromMap(new Map(files), useCaseSensitiveFileNames);
  return {
    FS: (): FS => fs,
    GetCurrentDirectory: (): string => currentDirectory,
  };
}

// memoCache is a minimal memoizing ExtendedConfigCache used by tests to simulate
// cache hits across multiple parses of configs that extend a common base.
class memoCache implements ExtendedConfigCache {
  private m: Map<Path, GoPtr<ExtendedConfigCacheEntry>> | undefined;

  GetExtendedConfig(fileName: string, path: Path, resolutionStack: GoSlice<string>, host: ParseConfigHost): GoPtr<ExtendedConfigCacheEntry> {
    if (this.m === undefined) {
      this.m = new Map();
    }
    const existing = this.m.get(path);
    if (existing !== undefined) {
      return existing;
    }
    const e = ParseExtendedConfig(fileName, path, resolutionStack, host, this);
    this.m.set(path, e);
    return e;
  }
}

function makeParseConfig(host: ParseConfigHost): (configFileName: string, cache: ExtendedConfigCache) => GoPtr<import("./parsedcommandline.js").ParsedCommandLine> {
  return (configFileName, cache) => {
    const cfgPath = ToPath(configFileName, host.GetCurrentDirectory(), host.FS().UseCaseSensitiveFileNames());
    const [jsonText, ok] = host.FS().ReadFile(configFileName);
    assert.ok(ok, `missing ${configFileName} in test fs`);
    const tsConfigSourceFile: TsConfigSourceFile = {
      ExtendedSourceFiles: [],
      configFileSpecs: undefined,
      SourceFile: ParseSourceFile({ FileName: configFileName, Path: cfgPath } as SourceFileParseOptions, jsonText, ScriptKindJSON),
    };
    return ParseJsonSourceFileConfigFileContent(
      tsConfigSourceFile,
      host,
      host.GetCurrentDirectory(),
      undefined,
      undefined,
      configFileName,
      [],
      [],
      cache,
    );
  };
}

// TestExtendedConfigErrorsAppearOnCacheHit verifies that diagnostics produced while parsing an
// extended config are still reported when the extended config comes from the cache.
test("ExtendedConfigErrorsAppearOnCacheHit / single config parsed twice", () => {
  const files = new Map<string, string>([
    ["/tsconfig.json", `{
  "extends": "./base.json"
}`],
    // 'excludes' instead of 'exclude' triggers diagnostic
    ["/base.json", `{
  "excludes": ["**/*.ts"]
}`],
    ["/app.ts", "export {}"],
  ]);

  const host = vfsParseConfigHost(files, "/", true as bool /*useCaseSensitiveFileNames*/);
  const parseConfig = makeParseConfig(host);

  const cache = new memoCache();
  const first = parseConfig("/tsconfig.json", cache);
  assert.ok((first!.Errors ?? []).length > 0, "expected diagnostics on first parse, got 0");
  const second = parseConfig("/tsconfig.json", cache);
  assert.ok((second!.Errors ?? []).length > 0, "expected diagnostics on second parse (cache hit), got 0");
});

test("ExtendedConfigErrorsAppearOnCacheHit / two configs share same base", () => {
  const files = new Map<string, string>([
    ["/base.json", `{
  "excludes": ["**/*.ts"]
}`],
    ["/projA/tsconfig.json", `{
  "extends": "../base.json"
}`],
    ["/projB/tsconfig.json", `{
  "extends": "../base.json"
}`],
    ["/projA/app.ts", "export {}"],
    ["/projB/app.ts", "export {}"],
  ]);

  const host = vfsParseConfigHost(files, "/", true as bool /*useCaseSensitiveFileNames*/);
  const parseConfig = makeParseConfig(host);

  const cache = new memoCache();
  const first = parseConfig("/projA/tsconfig.json", cache);
  assert.ok((first!.Errors ?? []).length > 0, "expected diagnostics for projA parse, got 0");
  const second = parseConfig("/projB/tsconfig.json", cache);
  assert.ok((second!.Errors ?? []).length > 0, "expected diagnostics for projB parse (cache hit on base), got 0");
});
