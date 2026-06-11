import { test } from "node:test";
import assert from "node:assert/strict";
import * as nodeFs from "node:fs";
import * as nodePath from "node:path";
import { LibNames } from "./libs_generated.js";
import { LibPath, TestingLibPath, WrapFS } from "./bundled.js";
import { GetBaseFileName } from "../tspath/path.js";
import { FS as OSFS } from "../vfs/osvfs/os.js";

test("TestingLibPath mirrors upstream test lib directory contract", () => {
  const libPath = TestingLibPath();
  assert.equal(nodeFs.statSync(libPath).isDirectory(), true);
  assert.equal(nodeFs.statSync(nodePath.join(libPath, "lib.d.ts")).isFile(), true);
});

test("embedded bundled filesystem mirrors upstream lib names", () => {
  const fs = WrapFS(OSFS());
  const files: string[] = [];
  const err = fs.WalkDir(LibPath(), (path, dirEntry, walkErr) => {
    if (walkErr !== undefined) {
      return walkErr;
    }
    if (!dirEntry.IsDir()) {
      files.push(GetBaseFileName(path));
    }
    return undefined;
  });

  assert.equal(err, undefined);
  assert.deepEqual(files, LibNames);
});
