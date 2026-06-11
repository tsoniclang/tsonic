import { test } from "node:test";
import assert from "node:assert/strict";
import { ContainsIgnoredPath } from "./ignoredpaths.js";

test("ContainsIgnoredPath mirrors upstream ignored-path cases", () => {
  const cases = [
    { name: "node_modules dot path", path: "/project/node_modules/.pnpm/file.ts", expected: true },
    { name: "git directory", path: "/project/.git/hooks/pre-commit", expected: true },
    { name: "emacs lock file", path: "/project/src/file.ts.#", expected: true },
    { name: "regular file path", path: "/project/src/file.ts", expected: false },
    { name: "node_modules without dot", path: "/project/node_modules/lodash/index.js", expected: false },
    { name: "empty path", path: "", expected: false },
    { name: "path with multiple ignored patterns", path: "/project/node_modules/.pnpm/.git/.#file.ts", expected: true },
    { name: "case sensitive test", path: "/project/NODE_MODULES/.PNPM/file.ts", expected: false },
    { name: "path with ignored pattern in middle", path: "/project/src/node_modules/.pnpm/dist/file.js", expected: true },
    { name: "path with ignored pattern at end", path: "/project/src/file.ts.#", expected: true },
  ];

  for (const testCase of cases) {
    assert.equal(ContainsIgnoredPath(testCase.path), testCase.expected, testCase.name);
  }
});

test("ContainsIgnoredPath recognizes every upstream ignored pattern", () => {
  for (const pattern of ["/node_modules/.", "/.git", ".#"]) {
    assert.equal(ContainsIgnoredPath(`/test${pattern}/file.ts`), true, pattern);
  }
});

test("ContainsIgnoredPath mirrors upstream edge cases", () => {
  const cases = [
    { name: "pattern at start", path: "/node_modules./file.ts", expected: false },
    { name: "pattern at end", path: "/project/file.ts.#", expected: true },
    { name: "multiple occurrences", path: "/project/.git/node_modules./.git/file.ts", expected: true },
    { name: "no slashes", path: "node_modules.file.ts", expected: false },
    { name: "single slash", path: "/file.ts", expected: false },
  ];

  for (const testCase of cases) {
    assert.equal(ContainsIgnoredPath(testCase.path), testCase.expected, testCase.name);
  }
});
