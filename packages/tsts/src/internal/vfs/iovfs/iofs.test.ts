import { test } from "node:test";
import assert from "node:assert/strict";
import type { bool } from "../../../go/scalars.js";
import { MapFS_as_FS } from "../../../go/testing/fstest.js";
import type { MapFS } from "../../../go/testing/fstest.js";
import { SkipDir } from "../vfs.js";
import type { DirEntry, WalkDirFunc } from "../vfs.js";
import { From } from "./iofs.js";

function createTestFS(): MapFS {
  return new Map([
    ["foo.ts", { Data: "hello, world" }],
    ["dir1/file1.ts", { Data: "export const foo = 42;" }],
    ["dir1/file2.ts", { Data: "export const foo = 42;" }],
    ["dir2/file1.ts", { Data: "export const foo = 42;" }],
  ]);
}

test("IOFS mirrors TS-Go ReadFile, existence, directory entries, walking, and realpath", () => {
  const fs = From(MapFS_as_FS(createTestFS()), true as bool);

  assert.deepEqual(fs.ReadFile("/foo.ts"), ["hello, world", true]);
  assert.deepEqual(fs.ReadFile("/does/not/exist.ts"), ["", false]);
  assert.throws(() => fs.ReadFile("bar"), /vfs: path "bar" is not absolute/);

  assert.equal(fs.FileExists("/foo.ts"), true);
  assert.equal(fs.FileExists("/bar"), false);

  assert.equal(fs.DirectoryExists("/"), true);
  assert.equal(fs.DirectoryExists("/dir1"), true);
  assert.equal(fs.DirectoryExists("/dir1/"), true);
  assert.equal(fs.DirectoryExists("/dir1/./"), true);
  assert.equal(fs.DirectoryExists("/bar"), false);

  assert.deepEqual(fs.GetAccessibleEntries("/").Directories, ["dir1", "dir2"]);
  assert.deepEqual(fs.GetAccessibleEntries("/").Files, ["foo.ts"]);

  const files: string[] = [];
  const walkFn: WalkDirFunc = (path: string, d: DirEntry, err) => {
    if (err !== undefined) {
      return err;
    }
    if (!d.IsDir()) {
      files.push(path);
    }
    return undefined;
  };
  assert.equal(fs.WalkDir("/", walkFn), undefined);
  assert.deepEqual(files.sort(), ["/dir1/file1.ts", "/dir1/file2.ts", "/dir2/file1.ts", "/foo.ts"]);

  const skippedFiles: string[] = [];
  const skipWalkFn: WalkDirFunc = (path: string, d: DirEntry, err) => {
    if (err !== undefined) {
      return err;
    }
    if (!d.IsDir()) {
      skippedFiles.push(path);
    }
    return path === "/" ? undefined : SkipDir;
  };
  assert.equal(fs.WalkDir("/", skipWalkFn), undefined);
  assert.deepEqual(skippedFiles.sort(), ["/foo.ts"]);

  assert.equal(fs.Realpath("/foo.ts"), "/foo.ts");
  assert.equal(fs.UseCaseSensitiveFileNames(), true);
});
