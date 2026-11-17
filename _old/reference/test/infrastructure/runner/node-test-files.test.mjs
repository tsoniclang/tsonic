import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { discoverTestFiles } from "../../scripts/node-test-files.mjs";

test("shared test discovery preserves nested domains, stable order and file identity", () => {
  const scratch = resolve(".temp/test-discovery");
  mkdirSync(scratch, { recursive: true });
  const root = mkdtempSync(`${scratch}/run-`);
  mkdirSync(resolve(root, "providers/nested"), { recursive: true });
  for (const path of ["root.test.mjs", "providers/a.test.mjs", "providers/nested/b.test.mjs", "providers/support.mjs"]) {
    writeFileSync(resolve(root, path), "export {};\n");
  }
  assert.deepEqual(discoverTestFiles(root), ["providers/a.test.mjs", "providers/nested/b.test.mjs", "root.test.mjs"].map(path => resolve(root, path)));
  assert.deepEqual(discoverTestFiles(root, ".test.mjs", 0), [resolve(root, "root.test.mjs")]);
  assert.deepEqual(discoverTestFiles(root, ".test.mjs", 1), [resolve(root, "providers/a.test.mjs"), resolve(root, "root.test.mjs")]);
  assert.deepEqual(discoverTestFiles(resolve(root, "missing")), []);
});
