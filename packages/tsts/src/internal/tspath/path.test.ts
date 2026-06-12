import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CombinePaths,
  GetCommonParents,
  GetDirectoryPath,
  GetEncodedRootLength,
  GetNormalizedAbsolutePath,
  GetNormalizedAbsolutePathWithoutRoot,
  GetPathComponents,
  GetPathFromPathComponents,
  GetRelativePathToDirectoryOrUrl,
  GetRootLength,
  IsRootedDiskPath,
  IsUrl,
  NormalizeSlashes,
  PathIsAbsolute,
  PathIsRelative,
  ResolvePath,
  ToFileNameLowerCase,
  ToPath,
  hasRelativePathSegment,
  reducePathComponents,
} from "./path.js";
import type { ComparePathsOptions } from "./path.js";

test("NormalizeSlashes mirrors upstream cases", () => {
  assert.equal(NormalizeSlashes("a"), "a");
  assert.equal(NormalizeSlashes("a/b"), "a/b");
  assert.equal(NormalizeSlashes("a\\b"), "a/b");
  assert.equal(NormalizeSlashes("\\\\server\\path"), "//server/path");
});

test("GetRootLength mirrors upstream rooted path and URL cases", () => {
  const cases = [
    ["a", 0],
    ["/", 1],
    ["/path", 1],
    ["c:", 2],
    ["c:d", 0],
    ["c:/", 3],
    ["c:\\", 3],
    ["//server", 8],
    ["//server/share", 9],
    ["\\\\server", 8],
    ["\\\\server\\share", 9],
    ["file:///", 8],
    ["file:///path", 8],
    ["file:///c:", 10],
    ["file:///c:d", 8],
    ["file:///c:/path", 11],
    ["file:///c%3a", 12],
    ["file:///c%3ad", 8],
    ["file:///c%3a/path", 13],
    ["file:///c%3A", 12],
    ["file:///c%3Ad", 8],
    ["file:///c%3A/path", 13],
    ["file://localhost", 16],
    ["file://localhost/", 17],
    ["file://localhost/path", 17],
    ["file://localhost/c:", 19],
    ["file://localhost/c:d", 17],
    ["file://localhost/c:/path", 20],
    ["file://localhost/c%3a", 21],
    ["file://localhost/c%3ad", 17],
    ["file://localhost/c%3a/path", 22],
    ["file://localhost/c%3A", 21],
    ["file://localhost/c%3Ad", 17],
    ["file://localhost/c%3A/path", 22],
    ["file://server", 13],
    ["file://server/", 14],
    ["file://server/path", 14],
    ["file://server/c:", 14],
    ["file://server/c:d", 14],
    ["file://server/c:/d", 14],
    ["file://server/c%3a", 14],
    ["file://server/c%3ad", 14],
    ["file://server/c%3a/d", 14],
    ["file://server/c%3A", 14],
    ["file://server/c%3Ad", 14],
    ["file://server/c%3A/d", 14],
    ["http://server", 13],
    ["http://server/path", 14],
  ] as const;

  for (const [pathText, expected] of cases) {
    assert.equal(GetRootLength(pathText), expected, pathText);
  }
});

test("absolute/rooted/url classifiers mirror upstream cases", () => {
  assert.equal(PathIsAbsolute("/path/to/file.ext"), true);
  assert.equal(PathIsAbsolute("c:/path/to/file.ext"), true);
  assert.equal(PathIsAbsolute("file:///path/to/file.ext"), true);
  assert.equal(PathIsAbsolute("path/to/file.ext"), false);
  assert.equal(PathIsAbsolute("./path/to/file.ext"), false);

  for (const pathText of ["a", "/", "c:", "c:d", "c:/", "c:\\", "//server", "//server/share", "\\\\server", "\\\\server\\share"]) {
    assert.equal(IsUrl(pathText), false, pathText);
  }
  for (const pathText of ["file:///path", "file:///c:", "file:///c:d", "file:///c:/path", "file://server", "file://server/path", "http://server", "http://server/path"]) {
    assert.equal(IsUrl(pathText), true, pathText);
  }

  for (const pathText of ["/", "c:", "c:/", "c:\\", "//server", "//server/share", "\\\\server", "\\\\server\\share"]) {
    assert.equal(IsRootedDiskPath(pathText), true, pathText);
  }
  for (const pathText of ["a", "c:d", "file:///path", "file:///c:", "file:///c:d", "file:///c:/path", "file://server", "file://server/path", "http://server", "http://server/path"]) {
    assert.equal(IsRootedDiskPath(pathText), false, pathText);
  }
});

test("GetDirectoryPath mirrors upstream cases", () => {
  const cases = [
    ["", ""],
    ["a", ""],
    ["a/b", "a"],
    ["/", "/"],
    ["/a", "/"],
    ["/a/", "/"],
    ["/a/b", "/a"],
    ["/a/b/", "/a"],
    ["c:", "c:"],
    ["c:d", ""],
    ["c:/", "c:/"],
    ["c:/path", "c:/"],
    ["c:/path/", "c:/"],
    ["//server", "//server"],
    ["//server/", "//server/"],
    ["//server/share", "//server/"],
    ["//server/share/", "//server/"],
    ["\\\\server", "//server"],
    ["\\\\server\\", "//server/"],
    ["\\\\server\\share", "//server/"],
    ["\\\\server\\share\\", "//server/"],
    ["file:///", "file:///"],
    ["file:///path", "file:///"],
    ["file:///path/", "file:///"],
    ["file:///c:", "file:///c:"],
    ["file:///c:d", "file:///"],
    ["file:///c:/", "file:///c:/"],
    ["file:///c:/path", "file:///c:/"],
    ["file:///c:/path/", "file:///c:/"],
    ["file://server", "file://server"],
    ["file://server/", "file://server/"],
    ["file://server/path", "file://server/"],
    ["file://server/path/", "file://server/"],
    ["http://server", "http://server"],
    ["http://server/", "http://server/"],
    ["http://server/path", "http://server/"],
    ["http://server/path/", "http://server/"],
  ] as const;

  for (const [pathText, expected] of cases) {
    assert.equal(GetDirectoryPath(pathText), expected, pathText);
  }
});

test("GetPathComponents and reducePathComponents mirror upstream cases", () => {
  const componentCases = [
    ["", [""]],
    ["a", ["", "a"]],
    ["./a", ["", ".", "a"]],
    ["/", ["/"]],
    ["/a", ["/", "a"]],
    ["/a/", ["/", "a"]],
    ["c:", ["c:"]],
    ["c:d", ["", "c:d"]],
    ["c:/", ["c:/"]],
    ["c:/path", ["c:/", "path"]],
    ["//server", ["//server"]],
    ["//server/", ["//server/"]],
    ["//server/share", ["//server/", "share"]],
    ["file:///", ["file:///"]],
    ["file:///path", ["file:///", "path"]],
    ["file:///c:", ["file:///c:"]],
    ["file:///c:d", ["file:///", "c:d"]],
    ["file:///c:/", ["file:///c:/"]],
    ["file:///c:/path", ["file:///c:/", "path"]],
    ["file://server", ["file://server"]],
    ["file://server/", ["file://server/"]],
    ["file://server/path", ["file://server/", "path"]],
    ["http://server", ["http://server"]],
    ["http://server/", ["http://server/"]],
    ["http://server/path", ["http://server/", "path"]],
  ] as const;

  for (const [pathText, expected] of componentCases) {
    assert.deepEqual(GetPathComponents(pathText, ""), expected, pathText);
  }

  const reduceCases = [
    [[""], [""]],
    [["", "."], [""]],
    [["", ".", "a"], ["", "a"]],
    [["", "a", "."], ["", "a"]],
    [["", ".."], ["", ".."]],
    [["", "..", ".."], ["", "..", ".."]],
    [["", "..", ".", ".."], ["", "..", ".."]],
    [["", "a", ".."], [""]],
    [["", "..", "a"], ["", "..", "a"]],
    [["/"], ["/"]],
    [["/", "."], ["/"]],
    [["/", ".."], ["/"]],
    [["/", "a", ".."], ["/"]],
  ] as const;

  for (const [components, expected] of reduceCases) {
    assert.deepEqual(reducePathComponents([...components]), expected, components.join("/"));
  }
});

test("CombinePaths and ResolvePath mirror upstream cases", () => {
  assert.equal(CombinePaths("path", "to", "file.ext"), "path/to/file.ext");
  assert.equal(CombinePaths("path", "dir", "..", "to", "file.ext"), "path/dir/../to/file.ext");
  assert.equal(CombinePaths("/path", "to", "file.ext"), "/path/to/file.ext");
  assert.equal(CombinePaths("/path", "/to", "file.ext"), "/to/file.ext");
  assert.equal(CombinePaths("c:/path", "to", "file.ext"), "c:/path/to/file.ext");
  assert.equal(CombinePaths("c:/path", "c:/to", "file.ext"), "c:/to/file.ext");
  assert.equal(CombinePaths("file:///path", "to", "file.ext"), "file:///path/to/file.ext");
  assert.equal(CombinePaths("file:///path", "file:///to", "file.ext"), "file:///to/file.ext");
  assert.equal(CombinePaths("/", "/node_modules/@types"), "/node_modules/@types");
  assert.equal(CombinePaths("/a/..", ""), "/a/..");
  assert.equal(CombinePaths("/a/..", "b"), "/a/../b");
  assert.equal(CombinePaths("/a/..", "b/"), "/a/../b/");
  assert.equal(CombinePaths("/a/..", "/"), "/");
  assert.equal(CombinePaths("/a/..", "/b"), "/b");

  const resolveCases = [
    ["", [], ""],
    [".", [], ""],
    ["./", [], ""],
    ["..", [], ".."],
    ["../", [], "../"],
    ["/", [], "/"],
    ["/.", [], "/"],
    ["/./", [], "/"],
    ["/../", [], "/"],
    ["/a", [], "/a"],
    ["/a/", [], "/a/"],
    ["/a/.", [], "/a"],
    ["/a/./", [], "/a/"],
    ["/a/./b", [], "/a/b"],
    ["/a/./b/", [], "/a/b/"],
    ["/a/..", [], "/"],
    ["/a/../", [], "/"],
    ["/a/../b", [], "/b"],
    ["/a/../b/", [], "/b/"],
    ["/a/..", ["b"], "/b"],
    ["/a/..", ["/"], "/"],
    ["/a/..", ["b/"], "/b/"],
    ["/a/..", ["/b"], "/b"],
    ["/a/.", ["b"], "/a/b"],
    ["/a/.", ["."], "/a"],
    ["a", ["b", "c"], "a/b/c"],
    ["a", ["b", "/c"], "/c"],
    ["a", ["b", "../c"], "a/c"],
  ] as const;

  for (const [firstPath, restPaths, expected] of resolveCases) {
    assert.equal(ResolvePath(firstPath, ...restPaths), expected, `${firstPath} ${restPaths.join(" ")}`);
  }
});

test("GetNormalizedAbsolutePath mirrors upstream normalization cases", () => {
  const cases = [
    ["/", "", "/"],
    ["/.", "", "/"],
    ["/./", "", "/"],
    ["/../", "", "/"],
    ["/a", "", "/a"],
    ["/a/", "", "/a"],
    ["/a/.", "", "/a"],
    ["/a/foo.", "", "/a/foo."],
    ["/a/./", "", "/a"],
    ["/a/./b", "", "/a/b"],
    ["/a/./b/", "", "/a/b"],
    ["/a/..", "", "/"],
    ["/a/../", "", "/"],
    ["/a/../b", "", "/b"],
    ["/a/../b/", "", "/b"],
    ["\\", "", "/"],
    ["\\.", "", "/"],
    ["\\.\\", "", "/"],
    ["\\..\\", "", "/"],
    ["\\a\\.\\", "", "/a"],
    ["\\a\\.\\b", "", "/a/b"],
    ["\\a\\.\\b\\", "", "/a/b"],
    ["\\a\\..", "", "/"],
    ["\\a\\..\\", "", "/"],
    ["\\a\\..\\b", "", "/b"],
    ["\\a\\..\\b\\", "", "/b"],
    ["", "", ""],
    [".", "", ""],
    ["./", "", ""],
    ["..", "", ".."],
    ["../", "", ".."],
    ["", "/home", "/home"],
    [".", "/home", "/home"],
    ["./", "/home", "/home"],
    ["..", "/home", "/"],
    ["../", "/home", "/"],
    ["a", "b", "b/a"],
    ["a", "b/c", "b/c/a"],
    [".a", "", ".a"],
    ["..a", "", "..a"],
    ["a.", "", "a."],
    ["a..", "", "a.."],
    ["/base/./.a", "", "/base/.a"],
    ["/base/../.a", "", "/.a"],
    ["/base/./..a", "", "/base/..a"],
    ["/base/../..a", "", "/..a"],
    ["/base/./..a/b", "", "/base/..a/b"],
    ["/base/../..a/b", "", "/..a/b"],
    ["/base/./a.", "", "/base/a."],
    ["/base/../a.", "", "/a."],
    ["/base/./a..", "", "/base/a.."],
    ["/base/../a..", "", "/a.."],
    ["/base/./a../b", "", "/base/a../b"],
    ["/base/../a../b", "", "/a../b"],
    ["a/..", "", ""],
    ["/a//", "", "/a"],
    ["//a", "a", "//a/"],
    ["/\\", "", "//"],
    ["a///", "a", "a/a"],
    ["/.//", "", "/"],
    ["//\\\\", "", "///"],
    [".//a", ".", "a"],
    ["a/../..", "", ".."],
    ["../..", "\\a", "/"],
    ["a:", "b", "a:/"],
    ["a/../..", "..", "../.."],
    ["a/../..", "b", ""],
    ["a//../..", "..", "../.."],
    ["a//b", "", "a/b"],
    ["a///b", "", "a/b"],
    ["a/b//c", "", "a/b/c"],
    ["/a/b//c", "", "/a/b/c"],
    ["//a/b//c", "", "//a/b/c"],
    ["a\\\\b", "", "a/b"],
    ["a\\\\\\b", "", "a/b"],
    ["a\\b\\\\c", "", "a/b/c"],
    ["\\a\\b\\\\c", "", "/a/b/c"],
    ["\\\\a\\b\\\\c", "", "//a/b/c"],
    ["a/\\b", "", "a/b"],
    ["a\\/b", "", "a/b"],
    ["a\\/\\b", "", "a/b"],
    ["a\\b//c", "", "a/b/c"],
  ] as const;

  for (const [fileName, currentDirectory, expected] of cases) {
    assert.equal(GetNormalizedAbsolutePath(fileName, currentDirectory), expected, `${fileName} @ ${currentDirectory}`);
  }
});

test("other path normalization helpers mirror upstream cases", () => {
  assert.equal(GetNormalizedAbsolutePathWithoutRoot("/a/b/c.txt", "/a/b"), "a/b/c.txt");
  assert.equal(GetNormalizedAbsolutePathWithoutRoot("c:/work/hello.txt", "c:/work"), "work/hello.txt");
  assert.equal(GetNormalizedAbsolutePathWithoutRoot("c:/work/hello.txt", "d:/worspaces"), "work/hello.txt");

  assert.equal(ToFileNameLowerCase("/user/UserName/projects/Project/file.ts"), "/user/username/projects/project/file.ts");
  assert.equal(ToFileNameLowerCase("/user/UserName/projects/projectß/file.ts"), "/user/username/projects/projectß/file.ts");
  assert.equal(ToFileNameLowerCase("/user/UserName/projects/İproject/file.ts"), "/user/username/projects/İproject/file.ts");
  assert.equal(ToFileNameLowerCase("/user/UserName/projects/ı/file.ts"), "/user/username/projects/ı/file.ts");

  assert.equal(ToPath("file.ext", "path/to", false), "path/to/file.ext");
  assert.equal(ToPath("file.ext", "/path/to", true), "/path/to/file.ext");
  assert.equal(ToPath("/path/to/../file.ext", "path/to", true), "/path/file.ext");
});

test("PathIsRelative mirrors upstream slash and backslash cases", () => {
  const baseCases = [
    [".", true],
    ["..", true],
    ["./", true],
    ["../", true],
    ["./foo/bar", true],
    ["../foo/bar", true],
    ["../" + "foo/".repeat(100), true],
    ["", false],
    ["foo", false],
    ["foo/bar", false],
    ["/foo/bar", false],
    ["c:/foo/bar", false],
  ] as const;

  for (const [pathText, expected] of baseCases) {
    assert.equal(PathIsRelative(pathText), expected, pathText);
    assert.equal(PathIsRelative(pathText.replaceAll("/", "\\")), expected, pathText);
  }
});

test("hasRelativePathSegment mirrors upstream seed cases", () => {
  const cases = [
    ["//", true],
    ["foo/bar/baz", false],
    ["foo/./baz", true],
    ["foo/../baz", true],
    ["foo/bar/baz/.", true],
    ["./some/path", true],
    ["/foo//bar/", true],
    ["/foo/./bar/../../.", true],
    ["foo/".repeat(100) + "..", true],
  ] as const;

  for (const [pathText, expected] of cases) {
    assert.equal(hasRelativePathSegment(pathText), expected, pathText);
  }
});

test("GetRelativePathToDirectoryOrUrl mirrors upstream cases", () => {
  const options: ComparePathsOptions = { UseCaseSensitiveFileNames: false, CurrentDirectory: "" };
  const cases = [
    ["/", "/", ""],
    ["/a", "/a", ""],
    ["/a/", "/a", ""],
    ["/a", "/", ".."],
    ["/a", "/b", "../b"],
    ["/a/b", "/b", "../../b"],
    ["/a/b/c", "/b", "../../../b"],
    ["/a/b/c", "/b/c", "../../../b/c"],
    ["/a/b/c", "/a/b", ".."],
    ["c:", "d:", "d:/"],
    ["file:///", "file:///", ""],
    ["file:///a", "file:///a", ""],
    ["file:///a/", "file:///a", ""],
    ["file:///a", "file:///", ".."],
    ["file:///a", "file:///b", "../b"],
    ["file:///a/b", "file:///b", "../../b"],
    ["file:///a/b/c", "file:///b", "../../../b"],
    ["file:///a/b/c", "file:///b/c", "../../../b/c"],
    ["file:///a/b/c", "file:///a/b", ".."],
    ["file:///c:", "file:///d:", "file:///d:/"],
  ] as const;

  for (const [directoryPathOrUrl, relativeOrAbsolutePath, expected] of cases) {
    assert.equal(GetRelativePathToDirectoryOrUrl(directoryPathOrUrl, relativeOrAbsolutePath, false, options), expected, `${directoryPathOrUrl} -> ${relativeOrAbsolutePath}`);
  }
});

test("GetCommonParents mirrors upstream cases", () => {
  const options: ComparePathsOptions = { UseCaseSensitiveFileNames: false, CurrentDirectory: "" };

  const [emptyParents, emptyIgnored] = GetCommonParents([], 1, GetPathComponents, options);
  assert.equal(emptyIgnored.size, 0);
  assert.deepEqual(emptyParents, []);

  const commonParentCases = [
    { name: "single path returns itself", paths: ["/a/b/c/d"], minComponents: 1, expectedParents: ["/a/b/c/d"], expectedIgnored: [] },
    { name: "paths shorter than minComponents are ignored", paths: ["/a/b/c/d", "/a/b/c/e", "/a/b/f/g", "/x/y"], minComponents: 4, expectedParents: ["/a/b/c", "/a/b/f/g"], expectedIgnored: ["/x/y"] },
    { name: "three paths share /a/b", paths: ["/a/b/c/d", "/a/b/c/e", "/a/b/f/g"], minComponents: 1, expectedParents: ["/a/b"], expectedIgnored: [] },
    { name: "mixed with short path collapses to root when minComponents=1", paths: ["/a/b/c/d", "/a/b/c/e", "/a/b/f/g", "/x/y/z"], minComponents: 1, expectedParents: ["/"], expectedIgnored: [] },
    { name: "mixed with short path preserves both when minComponents=3", paths: ["/a/b/c/d", "/a/b/c/e", "/a/b/f/g", "/x/y/z"], minComponents: 3, expectedParents: ["/a/b", "/x/y/z"], expectedIgnored: [] },
    { name: "different volumes are returned individually", paths: ["c:/a/b/c/d", "d:/a/b/c/d"], minComponents: 1, expectedParents: ["c:/a/b/c/d", "d:/a/b/c/d"], expectedIgnored: [] },
    { name: "duplicate paths deduplicate result", paths: ["/a/b/c/d", "/a/b/c/d"], minComponents: 1, expectedParents: ["/a/b/c/d"], expectedIgnored: [] },
    { name: "paths with few components are returned as-is when minComponents met", paths: ["/a/b/c/d", "/x/y"], minComponents: 2, expectedParents: ["/a/b/c/d", "/x/y"], expectedIgnored: [] },
    { name: "minComponents=2", paths: ["/a/b/c/d", "/a/z/c/e", "/a/aaa/f/g", "/x/y/z"], minComponents: 2, expectedParents: ["/a", "/x/y/z"], expectedIgnored: [] },
    { name: "trailing separators are handled", paths: ["/a/b/", "/a/b/c"], minComponents: 1, expectedParents: ["/a/b"], expectedIgnored: [] },
  ];

  for (const testCase of commonParentCases) {
    const [parents, ignored] = GetCommonParents(testCase.paths, testCase.minComponents, GetPathComponents, options);
    assert.deepEqual(parents, testCase.expectedParents, testCase.name);
    assert.deepEqual([...ignored.keys()].sort(), testCase.expectedIgnored, testCase.name);
  }
});

test("GetPathFromPathComponents round-trips representative upstream component shapes", () => {
  assert.equal(GetPathFromPathComponents([""]), "");
  assert.equal(GetPathFromPathComponents(["", "a"]), "a");
  assert.equal(GetPathFromPathComponents(["/", "a"]), "/a");
  assert.equal(GetPathFromPathComponents(["c:/", "path"]), "c:/path");
  assert.equal(GetPathFromPathComponents(["file:///", "path"]), "file:///path");
});
