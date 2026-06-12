// Mirror of internal/modulespecifiers/specifiers_test.go (TestGetEachFileNameOfModule,
// TestGetEachFileNameOfModuleWithSymlinks, TestContainsNodeModules,
// TestContainsIgnoredPath, TestTryGetRealFileNameForNonJSDeclarationFileName,
// TestTryGetModuleNameFromExportsOrImports), with the Go
// mockModuleSpecifierGenerationHost reproduced as a plain object.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { bool } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import type { HasFileName, StringLiteralLike } from "../ast/ast.js";
import type { CompilerOptions, ResolutionMode } from "../core/compileroptions.js";
import { ResolutionModeNone } from "../core/compileroptions.js";
import type { ResolvedModule } from "../module/types.js";
import type { ExportsOrImports } from "../packagejson/exportsorimports.js";
import { objectKindUnknown } from "../packagejson/exportsorimports.js";
import type { InfoCacheEntry } from "../packagejson/cache.js";
import { JSONValueTypeString } from "../packagejson/jsonvalue.js";
import type { KnownSymlinks, KnownDirectoryLink } from "../symlinks/knownsymlinks.js";
import { KnownSymlinks_SetDirectory, NewKnownSymlink } from "../symlinks/knownsymlinks.js";
import type { SourceOutputAndProjectReference } from "../tsoptions/parsedcommandline.js";
import type { Path } from "../tspath/path.js";
import { Path_EnsureTrailingDirectorySeparator, ToPath } from "../tspath/path.js";
import type { ModuleSpecifierGenerationHost } from "./types.js";
import { MatchingModePattern } from "./types.js";
import { ContainsNodeModules, GetEachFileNameOfModule, containsIgnoredPath, tryGetModuleNameFromExportsOrImports } from "./specifiers.js";
import { TryGetRealFileNameForNonJSDeclarationFileName } from "./util.js";

// Go: mockModuleSpecifierGenerationHost
function mockHost(currentDir: string, useCaseSensitiveFileNames: bool, symlinkCache: GoPtr<KnownSymlinks>): ModuleSpecifierGenerationHost {
  return {
    GetCurrentDirectory: (): string => currentDir,
    UseCaseSensitiveFileNames: (): bool => useCaseSensitiveFileNames,
    GetSymlinkCache: (): GoPtr<KnownSymlinks> => symlinkCache,
    ResolveModuleName: (_moduleName: string, _containingFile: string, _resolutionMode: ResolutionMode): GoPtr<ResolvedModule> => undefined,
    GetGlobalTypingsCacheLocation: (): string => "",
    CommonSourceDirectory: (): string => currentDir,
    GetProjectReferenceFromSource: (_path: Path): GoPtr<SourceOutputAndProjectReference> => undefined,
    GetRedirectTargets: (_path: Path): GoSlice<string> => [],
    GetSourceOfProjectReferenceIfOutputIncluded: (file: HasFileName): string => file.FileName(),
    FileExists: (_path: string): bool => true, // Mock implementation
    GetNearestAncestorDirectoryWithPackageJson: (_dirname: string): string => "",
    GetPackageJsonInfo: (_pkgJsonPath: string): GoPtr<InfoCacheEntry> => undefined,
    GetDefaultResolutionModeForFile: (_file: HasFileName): ResolutionMode => ResolutionModeNone,
    GetResolvedModuleFromModuleSpecifier: (_file: HasFileName, _moduleSpecifier: GoPtr<StringLiteralLike>): GoPtr<ResolvedModule> => undefined,
    GetModeForUsageLocation: (_file: HasFileName, _moduleSpecifier: GoPtr<StringLiteralLike>): ResolutionMode => ResolutionModeNone,
  } as ModuleSpecifierGenerationHost;
}

test("GetEachFileNameOfModule", () => {
  const tests: Array<{ name: string; importingFile: string; importedFile: string; preferSymlinks: bool; expectedCount: number; expectedPaths?: string[] }> = [
    {
      name: "basic file path",
      importingFile: "/project/src/main.ts",
      importedFile: "/project/lib/utils.ts",
      preferSymlinks: false,
      expectedCount: 1,
      expectedPaths: ["/project/lib/utils.ts"],
    },
    {
      name: "symlink preference false",
      importingFile: "/project/src/main.ts",
      importedFile: "/project/lib/utils.ts",
      preferSymlinks: false,
      expectedCount: 1,
    },
    {
      name: "symlink preference true",
      importingFile: "/project/src/main.ts",
      importedFile: "/project/lib/utils.ts",
      preferSymlinks: true,
      expectedCount: 1,
    },
    {
      name: "ignored path with no alternatives",
      importingFile: "/project/src/main.ts",
      importedFile: "/project/node_modules/.pnpm/file.ts",
      preferSymlinks: false,
      expectedCount: 1, // Should return 1 because there's no better option (all paths are ignored)
    },
  ];

  for (const tt of tests) {
    const host = mockHost("/project", true as bool, NewKnownSymlink("/project", true as bool));
    const result = GetEachFileNameOfModule(tt.importingFile, tt.importedFile, host, tt.preferSymlinks);

    assert.equal(result.length, tt.expectedCount, `${tt.name}: count`);

    if (tt.expectedPaths !== undefined) {
      for (let i = 0; i < tt.expectedPaths.length; i++) {
        assert.ok(i < result.length, `${tt.name}: expected path ${i}: ${tt.expectedPaths[i]}, but result has only ${result.length} paths`);
        assert.equal(result[i]!.FileName, tt.expectedPaths[i], `${tt.name}: path ${i}`);
      }
    }

    for (let i = 0; i < result.length; i++) {
      assert.notEqual(result[i]!.FileName, "", `${tt.name}: path ${i} has empty FileName`);
    }
  }
});

test("GetEachFileNameOfModuleWithSymlinks", () => {
  const symlinkCache = NewKnownSymlink("/project", true as bool);
  const host = mockHost("/project", true as bool, symlinkCache);

  const symlinkPath = Path_EnsureTrailingDirectorySeparator(ToPath("/project/symlink", "/project", true as bool)) as Path;
  const realDirectory: KnownDirectoryLink = {
    Real: "/real/path/",
    RealPath: Path_EnsureTrailingDirectorySeparator(ToPath("/real/path", "/project", true as bool)) as Path,
  };
  KnownSymlinks_SetDirectory(symlinkCache, "/project/symlink", symlinkPath, realDirectory);

  const result = GetEachFileNameOfModule("/project/src/main.ts", "/real/path/file.ts", host, true as bool);

  // Should find the symlink path
  const found = result.some((path) => path!.FileName === "/project/symlink/file.ts");
  assert.ok(found, "Expected to find symlink path /project/symlink/file.ts");
});

test("ContainsNodeModules", () => {
  const tests: Array<{ name: string; path: string; expected: bool }> = [
    { name: "contains node_modules", path: "/project/node_modules/lodash/index.js", expected: true },
    { name: "does not contain node_modules", path: "/project/src/utils.ts", expected: false },
    { name: "node_modules in middle", path: "/project/packages/node_modules/pkg/file.js", expected: true },
    { name: "empty path", path: "", expected: false },
  ];

  for (const tt of tests) {
    assert.equal(ContainsNodeModules(tt.path), tt.expected, `ContainsNodeModules(${JSON.stringify(tt.path)})`);
  }
});

test("ContainsIgnoredPath", () => {
  const tests: Array<{ name: string; path: string; expected: bool }> = [
    { name: "ignored path", path: "/project/node_modules/.pnpm/file.ts", expected: true },
    { name: "not ignored path", path: "/project/src/file.ts", expected: false },
  ];

  for (const tt of tests) {
    assert.equal(containsIgnoredPath(tt.path), tt.expected, `containsIgnoredPath(${JSON.stringify(tt.path)})`);
  }
});

test("TryGetRealFileNameForNonJSDeclarationFileName", () => {
  const tests: Array<{ name: string; fileName: string; expected: string }> = [
    { name: "json declaration file", fileName: "/project/foo.d.json.ts", expected: "/project/foo.json" },
    { name: "multi-dot source extension declaration file", fileName: "/project/foo.module.d.css.ts", expected: "/project/foo.module.css" },
    { name: "plain dts file ignored", fileName: "/project/foo.d.ts", expected: "" },
  ];

  for (const tt of tests) {
    assert.equal(TryGetRealFileNameForNonJSDeclarationFileName(tt.fileName), tt.expected, tt.name);
  }
});

test("TryGetModuleNameFromExportsOrImports / with exports pattern", () => {
  const tests: Array<{ name: string; targetFilePath: string; expected: string }> = [
    { name: "match", targetFilePath: "/pkg/src/things/thing1/index.ts", expected: "./src/things/thing1" },
    { name: "mismatch with matching leading and trailing strings", targetFilePath: "/pkg/src/things/index.ts", expected: "" },
  ];

  for (const tt of tests) {
    const exports: ExportsOrImports = {
      __tsgoEmbedded0: {
        Type: JSONValueTypeString,
        Value: "./src/things/*/index.js",
      },
      objectKind: objectKindUnknown,
    };
    const result = tryGetModuleNameFromExportsOrImports(
      {} as CompilerOptions,
      mockHost("", false as bool, undefined),
      tt.targetFilePath,
      "/pkg",
      "./src/things/*",
      exports,
      [],
      MatchingModePattern,
      false as bool,
      false as bool,
    );
    assert.equal(result, tt.expected, `tryGetModuleNameFromExportsOrImports(targetFilePath = ${JSON.stringify(tt.targetFilePath)})`);
  }
});
