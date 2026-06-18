// Mirror of internal/symlinks/knownsymlinks_test.go. TestKnownSymlinksThreadSafety
// exercises 10 goroutines; the TSTS runtime is single-threaded, so the mirror
// performs the same 10 set/read rounds sequentially (the stored-state assertions
// are preserved; the concurrency aspect has no mirror).
// knownsymlinks_bench_test.go is a Go benchmark and has no mirror.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SyncSet_Has, SyncSet_Size } from "../collections/syncset.js";
import { SyncMap_Load, SyncMap_Size } from "../collections/syncmap.js";
import { ResolutionModeNone } from "../core/compileroptions.js";
import { Path_EnsureTrailingDirectorySeparator, ToPath } from "../tspath/path.js";
import { KnownSymlinks_Directories, KnownSymlinks_DirectoriesByRealpath, KnownSymlinks_Files, KnownSymlinks_ProcessResolution, KnownSymlinks_SetDirectory, KnownSymlinks_SetFile, KnownSymlinks_SetSymlinksFromResolutions, KnownSymlinks_guessDirectorySymlink, KnownSymlinks_isNodeModulesOrScopedPackageDirectory, NewKnownSymlink, } from "./knownsymlinks.js";
// Go: module.ResolvedModule{OriginalPath: ..., ResolvedFileName: ...} — zero
// values for the remaining fields.
const zeroPackageId = () => ({ Name: "", SubModuleName: "", Version: "", PeerDependencies: "" });
const resolvedModule = (originalPath, resolvedFileName) => ({
    ResolutionDiagnostics: [],
    ResolvedFileName: resolvedFileName,
    OriginalPath: originalPath,
    Extension: "",
    ResolvedUsingTsExtension: false,
    PackageId: zeroPackageId(),
    IsExternalLibraryImport: false,
    AlternateResult: "",
});
test("NewKnownSymlink", () => {
    const cache = NewKnownSymlink("/test/dir", true);
    assert.ok(cache !== undefined, "Expected non-nil cache");
    assert.equal(cache.cwd, "/test/dir");
    assert.equal(cache.useCaseSensitiveFileNames, true);
});
test("SetDirectory", () => {
    const cache = NewKnownSymlink("/test/dir", true);
    const symlinkPath = Path_EnsureTrailingDirectorySeparator(ToPath("/test/symlink", "/test/dir", true));
    const realDirectory = {
        Real: "/real/path/",
        RealPath: Path_EnsureTrailingDirectorySeparator(ToPath("/real/path", "/test/dir", true)),
    };
    KnownSymlinks_SetDirectory(cache, "/test/symlink", symlinkPath, realDirectory);
    // Check that directory was stored
    const [stored, ok] = SyncMap_Load(KnownSymlinks_Directories(cache), symlinkPath);
    assert.ok(ok, "Expected directory to be stored");
    assert.equal(stored.Real, realDirectory.Real);
    assert.equal(stored.RealPath, realDirectory.RealPath);
    // Check that realpath mapping was created
    const [set, ok2] = SyncMap_Load(KnownSymlinks_DirectoriesByRealpath(cache), realDirectory.RealPath);
    assert.ok(ok2 && SyncSet_Size(set) !== 0, "Expected realpath mapping to be created");
    assert.ok(SyncSet_Has(set, "/test/symlink"), "Expected symlink '/test/symlink' to be in set");
});
test("SetFile", () => {
    const cache = NewKnownSymlink("/test/dir", true);
    const symlink = "/test/symlink/file.ts";
    const symlinkPath = ToPath(symlink, "/test/dir", true);
    const realpath = "/real/path/file.ts";
    KnownSymlinks_SetFile(cache, symlink, symlinkPath, realpath);
    const [stored, ok] = SyncMap_Load(KnownSymlinks_Files(cache), symlinkPath);
    assert.ok(ok, "Expected file to be stored");
    assert.equal(stored, realpath);
});
test("ProcessResolution", () => {
    const cache = NewKnownSymlink("/test/dir", true);
    // Test with empty paths
    KnownSymlinks_ProcessResolution(cache, "", "");
    KnownSymlinks_ProcessResolution(cache, "original", "");
    KnownSymlinks_ProcessResolution(cache, "", "resolved");
    // Test with valid paths
    const originalPath = "/test/original/file.ts";
    const resolvedPath = "/test/resolved/file.ts";
    KnownSymlinks_ProcessResolution(cache, originalPath, resolvedPath);
    // Check that file was stored
    const symlinkPath = ToPath(originalPath, "/test/dir", true);
    const [stored, ok] = SyncMap_Load(KnownSymlinks_Files(cache), symlinkPath);
    assert.ok(ok, "Expected file to be stored");
    assert.equal(stored, resolvedPath);
});
test("GuessDirectorySymlink", () => {
    const cache = NewKnownSymlink("/test/dir", true);
    const tests = [
        { name: "identical paths", a: "/test/path/file.ts", b: "/test/path/file.ts", cwd: "/test/dir", expected: ["/", "/"] },
        { name: "different files same directory", a: "/test/path/file1.ts", b: "/test/path/file2.ts", cwd: "/test/dir", expected: ["", ""] },
        { name: "different directories", a: "/test/path1/file.ts", b: "/test/path2/file.ts", cwd: "/test/dir", expected: ["/test/path1", "/test/path2"] },
        { name: "node_modules paths", a: "/test/node_modules/pkg/file.ts", b: "/test/node_modules/pkg/file.ts", cwd: "/test/dir", expected: ["/test/node_modules/pkg", "/test/node_modules/pkg"] },
        { name: "scoped package paths", a: "/test/node_modules/@scope/pkg/file.ts", b: "/test/node_modules/@scope/pkg/file.ts", cwd: "/test/dir", expected: ["/test/node_modules/@scope/pkg", "/test/node_modules/@scope/pkg"] },
    ];
    for (const tt of tests) {
        const [commonResolved, commonOriginal] = KnownSymlinks_guessDirectorySymlink(cache, tt.a, tt.b, tt.cwd);
        assert.equal(commonResolved, tt.expected[0], `${tt.name}: commonResolved`);
        assert.equal(commonOriginal, tt.expected[1], `${tt.name}: commonOriginal`);
    }
});
test("IsNodeModulesOrScopedPackageDirectory", () => {
    const cache = NewKnownSymlink("/test/dir", true);
    const tests = [
        { name: "node_modules", dir: "node_modules", expected: true },
        { name: "scoped package", dir: "@scope", expected: true },
        { name: "regular directory", dir: "src", expected: false },
        { name: "empty string", dir: "", expected: false },
        { name: "case insensitive node_modules", dir: "NODE_MODULES", expected: false }, // The function is case sensitive
        { name: "case insensitive scoped", dir: "@SCOPE", expected: true },
    ];
    for (const tt of tests) {
        assert.equal(KnownSymlinks_isNodeModulesOrScopedPackageDirectory(cache, tt.dir), tt.expected, `${tt.name} ('${tt.dir}')`);
    }
});
test("SetSymlinksFromResolutions", () => {
    const cache = NewKnownSymlink("/test/dir", true);
    // Mock resolution data
    const resolvedModules = [
        {
            originalPath: "/test/original/file1.ts",
            resolvedPath: "/test/resolved/file1.ts",
            moduleName: "module1",
            mode: ResolutionModeNone,
            filePath: ToPath("/test/source.ts", "/test/dir", true),
        },
        {
            originalPath: "/test/original/file2.ts",
            resolvedPath: "/test/resolved/file2.ts",
            moduleName: "module2",
            mode: ResolutionModeNone,
            filePath: ToPath("/test/source.ts", "/test/dir", true),
        },
    ];
    // Mock callbacks
    const forEachResolvedModule = (callback, _file) => {
        for (const res of resolvedModules) {
            callback(resolvedModule(res.originalPath, res.resolvedPath), res.moduleName, res.mode, res.filePath);
        }
    };
    const forEachResolvedTypeReferenceDirective = (_callback, _file) => {
        // No type reference directives for this test
    };
    KnownSymlinks_SetSymlinksFromResolutions(cache, forEachResolvedModule, forEachResolvedTypeReferenceDirective);
    // Check that files were stored
    for (const res of resolvedModules) {
        const symlinkPath = ToPath(res.originalPath, "/test/dir", true);
        const [stored, ok] = SyncMap_Load(KnownSymlinks_Files(cache), symlinkPath);
        assert.ok(ok, `Expected file '${res.originalPath}' to be stored`);
        assert.equal(stored, res.resolvedPath);
    }
});
test("KnownSymlinksThreadSafety", () => {
    const cache = NewKnownSymlink("/test/dir", true);
    // Go runs these 10 rounds in goroutines; sequential here (single-threaded
    // runtime), preserving the same stored-state assertions. Note Go's
    // string(rune(id)) yields the raw code point for id 0..9.
    for (let id = 0; id < 10; id++) {
        const suffix = globalThis.String.fromCharCode(id);
        const symlinkPath = Path_EnsureTrailingDirectorySeparator(ToPath("/test/symlink" + suffix, "/test/dir", true));
        const realDirectory = {
            Real: "/real/path" + suffix + "/",
            RealPath: Path_EnsureTrailingDirectorySeparator(ToPath("/real/path" + suffix, "/test/dir", true)),
        };
        KnownSymlinks_SetDirectory(cache, "/test/symlink" + suffix, symlinkPath, realDirectory);
        // Read back
        const [stored, ok] = SyncMap_Load(KnownSymlinks_Directories(cache), symlinkPath);
        assert.ok(ok, `Round ${id}: Expected directory to be stored`);
        assert.equal(stored.Real, realDirectory.Real, `Round ${id}: Real`);
    }
    // Verify all directories were stored
    assert.equal(SyncMap_Size(KnownSymlinks_Directories(cache)), 10);
});
//# sourceMappingURL=knownsymlinks.test.js.map