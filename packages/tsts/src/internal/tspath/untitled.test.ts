import { test } from "node:test";
import assert from "node:assert/strict";
import { GetEncodedRootLength, GetNormalizedAbsolutePath, IsRootedDiskPath, ToPath } from "./path.js";

test("untitled paths stay rooted and do not resolve against the current directory", () => {
  const untitledPath = "^/untitled/ts-nul-authority/Untitled-2";

  assert.equal(GetEncodedRootLength(untitledPath), 2);
  assert.equal(IsRootedDiskPath(untitledPath), true);
  assert.equal(ToPath(untitledPath, "/home/user/project", true), untitledPath);
  assert.equal(GetNormalizedAbsolutePath(untitledPath, "/home/user/project"), untitledPath);
});

test("untitled path edge cases mirror upstream", () => {
  const cases = [
    { path: "^/", expectedRootLength: 2, expectedRooted: true },
    { path: "^/untitled/ts-nul-authority/test", expectedRootLength: 2, expectedRooted: true },
    { path: "^", expectedRootLength: 0, expectedRooted: false },
    { path: "^x", expectedRootLength: 0, expectedRooted: false },
    { path: "^^/", expectedRootLength: 0, expectedRooted: false },
    { path: "x^/", expectedRootLength: 0, expectedRooted: false },
    { path: "^/untitled/ts-nul-authority/path/with/deeper/structure", expectedRootLength: 2, expectedRooted: true },
  ];

  for (const testCase of cases) {
    assert.equal(GetEncodedRootLength(testCase.path), testCase.expectedRootLength, testCase.path);
    assert.equal(IsRootedDiskPath(testCase.path), testCase.expectedRooted, testCase.path);
  }
});
