import { test } from "node:test";
import assert from "node:assert/strict";
import * as filepath from "./filepath.js";

test("Ext returns the final-element extension", () => {
  assert.equal(filepath.Ext("index.ts"), ".ts");
  assert.equal(filepath.Ext("index.coffee.md"), ".md");
  assert.equal(filepath.Ext("a.b/c"), "");
  assert.equal(filepath.Ext("/a/b/c"), "");
  assert.equal(filepath.Ext("noext"), "");
  assert.equal(filepath.Ext(".bashrc"), ".bashrc");
  assert.equal(filepath.Ext("foo.d.ts"), ".ts");
  assert.equal(filepath.Ext(""), "");
});

test("Base returns the last element", () => {
  assert.equal(filepath.Base("/foo/bar/baz.js"), "baz.js");
  assert.equal(filepath.Base("/foo/bar/baz"), "baz");
  assert.equal(filepath.Base("/foo/bar/baz/"), "baz");
  assert.equal(filepath.Base(""), ".");
  assert.equal(filepath.Base("/"), "/");
  assert.equal(filepath.Base("///"), "/");
  assert.equal(filepath.Base("dev"), "dev");
  assert.equal(filepath.Base("a/b/c"), "c");
});

test("Dir returns all but the last element", () => {
  assert.equal(filepath.Dir("/foo/bar/baz.js"), "/foo/bar");
  assert.equal(filepath.Dir("/foo/bar/baz"), "/foo/bar");
  assert.equal(filepath.Dir("/foo/bar/baz/"), "/foo/bar/baz");
  assert.equal(filepath.Dir(""), ".");
  assert.equal(filepath.Dir("/"), "/");
  assert.equal(filepath.Dir("dev"), ".");
  assert.equal(filepath.Dir("a/b/c"), "a/b");
  assert.equal(filepath.Dir("a"), ".");
});

test("Join concatenates and cleans elements", () => {
  assert.equal(filepath.Join("a", "b", "c"), "a/b/c");
  assert.equal(filepath.Join("a", "b/c"), "a/b/c");
  assert.equal(filepath.Join("a/b", "../../../xyz"), "../xyz");
  assert.equal(filepath.Join("", ""), "");
  assert.equal(filepath.Join("/", "a"), "/a");
  assert.equal(filepath.Join("a", "", "b"), "a/b");
  assert.equal(filepath.Join(), "");
});

test("IsAbs reports leading-slash paths", () => {
  assert.equal(filepath.IsAbs("/"), true);
  assert.equal(filepath.IsAbs("/foo"), true);
  assert.equal(filepath.IsAbs("foo"), false);
  assert.equal(filepath.IsAbs(""), false);
  assert.equal(filepath.IsAbs("./foo"), false);
  assert.equal(filepath.IsAbs("../foo"), false);
});

test("Clean normalizes lexically", () => {
  assert.equal(filepath.Clean("a/c"), "a/c");
  assert.equal(filepath.Clean("a//c"), "a/c");
  assert.equal(filepath.Clean("a/c/."), "a/c");
  assert.equal(filepath.Clean("a/c/b/.."), "a/c");
  assert.equal(filepath.Clean("/../a/c"), "/a/c");
  assert.equal(filepath.Clean("/../a/b/../././/c"), "/a/c");
  assert.equal(filepath.Clean(""), ".");
  assert.equal(filepath.Clean("abc/../../././../def"), "../../def");
  assert.equal(filepath.Clean("../../abc/def"), "../../abc/def");
  assert.equal(filepath.Clean("/a/b/../../c"), "/c");
});

test("Rel computes lexical relative paths", () => {
  assert.deepEqual(filepath.Rel("/a/b", "/a/b/c/d"), ["c/d", undefined]);
  assert.deepEqual(filepath.Rel("/a/b", "/a/c"), ["../c", undefined]);
  assert.deepEqual(filepath.Rel("a/b", "a/b"), [".", undefined]);
  assert.deepEqual(filepath.Rel("/a", "/b/c"), ["../b/c", undefined]);
});
