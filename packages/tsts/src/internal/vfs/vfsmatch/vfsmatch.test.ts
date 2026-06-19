import { test } from "node:test";
import assert from "node:assert/strict";
import type { bool, int } from "../../../go/scalars.js";
import type { FS } from "../vfs.js";
import { FromMap } from "../vfstest/vfstest.js";
import {
  compileGlobPattern,
  globPattern_matches,
  IsImplicitGlob,
  NewSpecMatcher,
  ReadDirectory,
  SpecMatcher_MatchIndex,
  SpecMatcher_MatchString,
  UnlimitedDepth,
  UsageExclude,
  UsageFiles,
} from "./vfsmatch.js";

function caseInsensitiveHost(): FS {
  return FromMap(new Map<string, string>([
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
  ]), false as bool);
}

function caseSensitiveHost(): FS {
  return FromMap(new Map<string, string>([
    ["/dev/a.ts", ""],
    ["/dev/a.d.ts", ""],
    ["/dev/a.js", ""],
    ["/dev/b.ts", ""],
    ["/dev/b.js", ""],
    ["/dev/A.ts", ""],
    ["/dev/B.ts", ""],
    ["/dev/c.d.ts", ""],
    ["/dev/z/a.ts", ""],
    ["/dev/x/a.ts", ""],
    ["/dev/x/b.ts", ""],
    ["/dev/x/y/a.ts", ""],
    ["/dev/x/y/b.ts", ""],
    ["/dev/q/a/c/b/d.ts", ""],
    ["/dev/js/a.js", ""],
    ["/dev/js/b.js", ""],
    ["/dev/js/d.MIN.js", ""],
  ]), true as bool);
}

function commonFoldersHost(): FS {
  return FromMap(new Map<string, string>([
    ["/dev/a.ts", ""],
    ["/dev/a.d.ts", ""],
    ["/dev/a.js", ""],
    ["/dev/b.ts", ""],
    ["/dev/x/a.ts", ""],
    ["/dev/node_modules/a.ts", ""],
    ["/dev/bower_components/a.ts", ""],
    ["/dev/jspm_packages/a.ts", ""],
  ]), false as bool);
}

function dottedFoldersHost(): FS {
  return FromMap(new Map<string, string>([
    ["/dev/x/d.ts", ""],
    ["/dev/x/y/d.ts", ""],
    ["/dev/x/y/.e.ts", ""],
    ["/dev/x/.y/a.ts", ""],
    ["/dev/.z/.b.ts", ""],
    ["/dev/.z/c.ts", ""],
    ["/dev/w/.u/e.ts", ""],
  ]), false as bool);
}

function mixedExtensionHost(): FS {
  return FromMap(new Map<string, string>([
    ["/dev/a.ts", ""],
    ["/dev/a.d.ts", ""],
    ["/dev/a.js", ""],
    ["/dev/b.tsx", ""],
    ["/dev/b.d.ts", ""],
    ["/dev/b.jsx", ""],
    ["/dev/c.tsx", ""],
    ["/dev/c.js", ""],
    ["/dev/d.js", ""],
    ["/dev/e.jsx", ""],
    ["/dev/f.other", ""],
  ]), false as bool);
}

type ReadDirCase = {
  readonly name: string;
  readonly host: () => FS;
  readonly path?: string;
  readonly extensions?: string[];
  readonly excludes?: string[];
  readonly includes?: string[];
  readonly depth?: int;
  readonly expect: (got: string[]) => void;
};

function runReadDirectoryCase(testCase: ReadDirCase): void {
  const host = testCase.host();
  const got = ReadDirectory(
    host,
    "/",
    testCase.path ?? "/dev",
    testCase.extensions ?? [],
    testCase.excludes ?? [],
    testCase.includes ?? [],
    testCase.depth ?? UnlimitedDepth,
  );
  testCase.expect(got);
}

test("ReadDirectory mirrors upstream literal, wildcard, package-folder, dotted-folder, and extension policies", () => {
  const cases: ReadDirCase[] = [
    {
      name: "literal includes without exclusions",
      host: caseInsensitiveHost,
      extensions: [".ts", ".tsx", ".d.ts"],
      includes: ["a.ts", "b.ts"],
      expect: (got) => assert.deepEqual(got, ["/dev/a.ts", "/dev/b.ts"]),
    },
    {
      name: "literal includes with wildcard excludes",
      host: caseInsensitiveHost,
      extensions: [".ts", ".tsx", ".d.ts"],
      excludes: ["*.ts", "z/??z.ts", "*/b.ts"],
      includes: ["a.ts", "b.ts", "z/a.ts", "z/abz.ts", "z/aba.ts", "x/b.ts"],
      expect: (got) => assert.deepEqual(got, ["/dev/z/a.ts", "/dev/z/aba.ts"]),
    },
    {
      name: "literal includes with recursive excludes",
      host: caseInsensitiveHost,
      extensions: [".ts", ".tsx", ".d.ts"],
      excludes: ["**/b.ts"],
      includes: ["a.ts", "b.ts", "x/a.ts", "x/b.ts", "x/y/a.ts", "x/y/b.ts"],
      expect: (got) => assert.deepEqual(got, ["/dev/a.ts", "/dev/x/a.ts", "/dev/x/y/a.ts"]),
    },
    {
      name: "case sensitive exclude is respected",
      host: caseSensitiveHost,
      extensions: [".ts", ".tsx", ".d.ts"],
      excludes: ["**/b.ts"],
      includes: ["B.ts"],
      expect: (got) => assert.deepEqual(got, ["/dev/B.ts"]),
    },
    {
      name: "wildcard include sorted order",
      host: caseInsensitiveHost,
      extensions: [".ts", ".tsx", ".d.ts"],
      includes: ["z/*.ts", "x/*.ts"],
      expect: (got) => assert.deepEqual(got, [
        "/dev/z/a.ts",
        "/dev/z/aba.ts",
        "/dev/z/abz.ts",
        "/dev/z/b.ts",
        "/dev/z/bba.ts",
        "/dev/z/bbz.ts",
        "/dev/x/a.ts",
        "/dev/x/aa.ts",
        "/dev/x/b.ts",
      ]),
    },
    {
      name: "double asterisk matches zero-or-more directories",
      host: caseInsensitiveHost,
      extensions: [".ts", ".tsx", ".d.ts"],
      includes: ["x/**/a.ts"],
      expect: (got) => assert.deepEqual(got.sort(), ["/dev/x/a.ts", "/dev/x/y/a.ts"]),
    },
    {
      name: "common package folders implicitly excluded",
      host: commonFoldersHost,
      extensions: [".ts", ".tsx", ".d.ts"],
      includes: ["**/a.ts"],
      expect: (got) => {
        assert.ok(got.includes("/dev/a.ts"));
        assert.ok(got.includes("/dev/x/a.ts"));
        assert.equal(got.includes("/dev/node_modules/a.ts"), false);
        assert.equal(got.includes("/dev/bower_components/a.ts"), false);
        assert.equal(got.includes("/dev/jspm_packages/a.ts"), false);
      },
    },
    {
      name: "explicit package folder include is preserved",
      host: commonFoldersHost,
      extensions: [".ts", ".tsx", ".d.ts"],
      includes: ["*/a.ts", "node_modules/a.ts"],
      expect: (got) => {
        assert.ok(got.includes("/dev/x/a.ts"));
        assert.ok(got.includes("/dev/node_modules/a.ts"));
      },
    },
    {
      name: "dotted folders not implicitly included",
      host: dottedFoldersHost,
      extensions: [".ts", ".tsx", ".d.ts"],
      includes: ["x/**/*", "w/*/*"],
      expect: (got) => {
        assert.ok(got.includes("/dev/x/d.ts"));
        assert.ok(got.includes("/dev/x/y/d.ts"));
        assert.equal(got.includes("/dev/x/.y/a.ts"), false);
        assert.equal(got.includes("/dev/x/y/.e.ts"), false);
        assert.equal(got.includes("/dev/w/.u/e.ts"), false);
      },
    },
    {
      name: "dotted folders explicitly included",
      host: dottedFoldersHost,
      extensions: [".ts", ".tsx", ".d.ts"],
      includes: ["x/.y/a.ts", "/dev/.z/.b.ts"],
      expect: (got) => {
        assert.ok(got.includes("/dev/x/.y/a.ts"));
        assert.ok(got.includes("/dev/.z/.b.ts"));
      },
    },
    {
      name: "mixed extensions js and jsx",
      host: mixedExtensionHost,
      extensions: [".js", ".jsx"],
      expect: (got) => {
        assert.ok(got.length > 0);
        assert.equal(got.every((file) => file.endsWith(".js") || file.endsWith(".jsx")), true);
      },
    },
    {
      name: "min js files excluded by wildcard",
      host: caseInsensitiveHost,
      extensions: [".js"],
      includes: ["js/*"],
      expect: (got) => {
        assert.ok(got.includes("/dev/js/a.js"));
        assert.ok(got.includes("/dev/js/b.js"));
        assert.equal(got.includes("/dev/js/d.min.js"), false);
        assert.equal(got.includes("/dev/js/ab.min.js"), false);
      },
    },
    {
      name: "min js files included when pattern mentions .min.",
      host: caseInsensitiveHost,
      extensions: [".js"],
      includes: ["js/*.min.*"],
      expect: (got) => assert.deepEqual(got.sort(), ["/dev/js/ab.min.js", "/dev/js/d.min.js"]),
    },
  ];

  for (const testCase of cases) {
    runReadDirectoryCase(testCase);
  }
});

test("IsImplicitGlob mirrors upstream wildcard and extension decisions", () => {
  const cases: Array<[string, boolean]> = [
    ["foo", true],
    ["src", true],
    ["foo.ts", false],
    ["foo.", false],
    ["*", false],
    ["?", false],
    ["foo*", false],
    ["foo?", false],
    ["foo.bar", false],
    ["", true],
  ];
  for (const [input, expected] of cases) {
    assert.equal(IsImplicitGlob(input), expected, input);
  }
});

test("SpecMatcher mirrors upstream match and index behavior", () => {
  const matcher = NewSpecMatcher(["*.ts", "*.tsx"], "/project", UsageFiles, true as bool);
  assert.notEqual(matcher, undefined);
  assert.equal(SpecMatcher_MatchString(matcher, "/project/a.ts"), true);
  assert.equal(SpecMatcher_MatchString(matcher, "/project/b.tsx"), true);
  assert.equal(SpecMatcher_MatchString(matcher, "/project/a.js"), false);
  assert.equal(SpecMatcher_MatchIndex(matcher, "/project/a.ts"), 0);
  assert.equal(SpecMatcher_MatchIndex(matcher, "/project/a.tsx"), 1);
  assert.equal(SpecMatcher_MatchIndex(matcher, "/project/a.js"), -1);

  const recursive = NewSpecMatcher(["**/*.ts"], "/project", UsageFiles, true as bool);
  assert.notEqual(recursive, undefined);
  assert.equal(SpecMatcher_MatchString(recursive, "/project/a.ts"), true);
  assert.equal(SpecMatcher_MatchString(recursive, "/project/sub/a.ts"), true);
  assert.equal(SpecMatcher_MatchString(recursive, "/project/a.js"), false);

  const exclude = NewSpecMatcher(["node_modules"], "/project", UsageExclude, true as bool);
  assert.notEqual(exclude, undefined);
  assert.equal(SpecMatcher_MatchString(exclude, "/project/node_modules"), false);
  assert.equal(SpecMatcher_MatchString(exclude, "/project/node_modules/foo"), true);
  assert.equal(SpecMatcher_MatchIndex(exclude, "/project/node_modules/foo"), 0);
  assert.equal(SpecMatcher_MatchIndex(exclude, "/project/src"), -1);

  assert.equal(NewSpecMatcher([], "/project", UsageFiles, true as bool), undefined);
  assert.equal(NewSpecMatcher(["**"], "/project", UsageFiles, true as bool), undefined);
});

test("compileGlobPattern mirrors upstream segment backtracking behavior", () => {
  const [question, questionOk] = compileGlobPattern("a?b", "/", UsageFiles, true as bool);
  assert.equal(questionOk, true);
  assert.equal(globPattern_matches(question, "/aXb"), true);
  assert.equal(globPattern_matches(question, "/ab"), false);
  assert.equal(globPattern_matches(question, "/aXYb"), false);

  const [star, starOk] = compileGlobPattern("*a*b*c", "/", UsageFiles, true as bool);
  assert.equal(starOk, true);
  assert.equal(globPattern_matches(star, "/abc"), true);
  assert.equal(globPattern_matches(star, "/XaYbZc"), true);
  assert.equal(globPattern_matches(star, "/ab"), false);
  assert.equal(globPattern_matches(star, "/cba"), false);
  assert.equal(globPattern_matches(star, "/abcX"), false);
});
