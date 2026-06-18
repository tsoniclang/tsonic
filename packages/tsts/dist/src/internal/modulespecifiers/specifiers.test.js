// Mirror of internal/modulespecifiers/specifiers_test.go (TestGetEachFileNameOfModule,
// TestGetEachFileNameOfModuleWithSymlinks, TestContainsNodeModules,
// TestContainsIgnoredPath, TestTryGetRealFileNameForNonJSDeclarationFileName,
// TestTryGetModuleNameFromExportsOrImports), with the Go
// mockModuleSpecifierGenerationHost reproduced as a plain object.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ResolutionModeNone } from "../core/compileroptions.js";
import { objectKindUnknown } from "../packagejson/exportsorimports.js";
import { JSONValueTypeString } from "../packagejson/jsonvalue.js";
import { KnownSymlinks_SetDirectory, NewKnownSymlink } from "../symlinks/knownsymlinks.js";
import { Path_EnsureTrailingDirectorySeparator, ToPath } from "../tspath/path.js";
import { MatchingModePattern } from "./types.js";
import { ContainsNodeModules, GetEachFileNameOfModule, containsIgnoredPath, tryGetModuleNameFromExportsOrImports } from "./specifiers.js";
import { TryGetRealFileNameForNonJSDeclarationFileName } from "./util.js";
// Go: mockModuleSpecifierGenerationHost
function mockHost(currentDir, useCaseSensitiveFileNames, symlinkCache) {
    return {
        GetCurrentDirectory: () => currentDir,
        UseCaseSensitiveFileNames: () => useCaseSensitiveFileNames,
        GetSymlinkCache: () => symlinkCache,
        ResolveModuleName: (_moduleName, _containingFile, _resolutionMode) => undefined,
        GetGlobalTypingsCacheLocation: () => "",
        CommonSourceDirectory: () => currentDir,
        GetProjectReferenceFromSource: (_path) => undefined,
        GetRedirectTargets: (_path) => [],
        GetSourceOfProjectReferenceIfOutputIncluded: (file) => file.FileName(),
        FileExists: (_path) => true, // Mock implementation
        GetNearestAncestorDirectoryWithPackageJson: (_dirname) => "",
        GetPackageJsonInfo: (_pkgJsonPath) => undefined,
        GetDefaultResolutionModeForFile: (_file) => ResolutionModeNone,
        GetResolvedModuleFromModuleSpecifier: (_file, _moduleSpecifier) => undefined,
        GetModeForUsageLocation: (_file, _moduleSpecifier) => ResolutionModeNone,
    };
}
test("GetEachFileNameOfModule", () => {
    const tests = [
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
        const host = mockHost("/project", true, NewKnownSymlink("/project", true));
        const result = GetEachFileNameOfModule(tt.importingFile, tt.importedFile, host, tt.preferSymlinks);
        assert.equal(result.length, tt.expectedCount, `${tt.name}: count`);
        if (tt.expectedPaths !== undefined) {
            for (let i = 0; i < tt.expectedPaths.length; i++) {
                assert.ok(i < result.length, `${tt.name}: expected path ${i}: ${tt.expectedPaths[i]}, but result has only ${result.length} paths`);
                assert.equal(result[i].FileName, tt.expectedPaths[i], `${tt.name}: path ${i}`);
            }
        }
        for (let i = 0; i < result.length; i++) {
            assert.notEqual(result[i].FileName, "", `${tt.name}: path ${i} has empty FileName`);
        }
    }
});
test("GetEachFileNameOfModuleWithSymlinks", () => {
    const symlinkCache = NewKnownSymlink("/project", true);
    const host = mockHost("/project", true, symlinkCache);
    const symlinkPath = Path_EnsureTrailingDirectorySeparator(ToPath("/project/symlink", "/project", true));
    const realDirectory = {
        Real: "/real/path/",
        RealPath: Path_EnsureTrailingDirectorySeparator(ToPath("/real/path", "/project", true)),
    };
    KnownSymlinks_SetDirectory(symlinkCache, "/project/symlink", symlinkPath, realDirectory);
    const result = GetEachFileNameOfModule("/project/src/main.ts", "/real/path/file.ts", host, true);
    // Should find the symlink path
    const found = result.some((path) => path.FileName === "/project/symlink/file.ts");
    assert.ok(found, "Expected to find symlink path /project/symlink/file.ts");
});
test("ContainsNodeModules", () => {
    const tests = [
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
    const tests = [
        { name: "ignored path", path: "/project/node_modules/.pnpm/file.ts", expected: true },
        { name: "not ignored path", path: "/project/src/file.ts", expected: false },
    ];
    for (const tt of tests) {
        assert.equal(containsIgnoredPath(tt.path), tt.expected, `containsIgnoredPath(${JSON.stringify(tt.path)})`);
    }
});
test("TryGetRealFileNameForNonJSDeclarationFileName", () => {
    const tests = [
        { name: "json declaration file", fileName: "/project/foo.d.json.ts", expected: "/project/foo.json" },
        { name: "multi-dot source extension declaration file", fileName: "/project/foo.module.d.css.ts", expected: "/project/foo.module.css" },
        { name: "plain dts file ignored", fileName: "/project/foo.d.ts", expected: "" },
    ];
    for (const tt of tests) {
        assert.equal(TryGetRealFileNameForNonJSDeclarationFileName(tt.fileName), tt.expected, tt.name);
    }
});
test("TryGetModuleNameFromExportsOrImports / with exports pattern", () => {
    const tests = [
        { name: "match", targetFilePath: "/pkg/src/things/thing1/index.ts", expected: "./src/things/thing1" },
        { name: "mismatch with matching leading and trailing strings", targetFilePath: "/pkg/src/things/index.ts", expected: "" },
    ];
    for (const tt of tests) {
        const exports = {
            __tsgoEmbedded0: {
                Type: JSONValueTypeString,
                Value: "./src/things/*/index.js",
            },
            objectKind: objectKindUnknown,
        };
        const result = tryGetModuleNameFromExportsOrImports({}, mockHost("", false, undefined), tt.targetFilePath, "/pkg", "./src/things/*", exports, [], MatchingModePattern, false, false);
        assert.equal(result, tt.expected, `tryGetModuleNameFromExportsOrImports(targetFilePath = ${JSON.stringify(tt.targetFilePath)})`);
    }
});
//# sourceMappingURL=specifiers.test.js.map