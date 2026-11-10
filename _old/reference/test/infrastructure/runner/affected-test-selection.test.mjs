import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { selectAffectedTestTasks } from "../../scripts/node-test-files.mjs";

test("affected selection takes the closest declared folder owner, helper/text readers and data smoke only", () => {
  const parent = resolve(".temp/affected-tests");
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(resolve(parent, "case-"));
  for (const folder of ["src/owner", "test/owner", "test/readers", "test/other", "test/helpers"]) mkdirSync(resolve(root, folder), { recursive: true });
  const changed = resolve(root, "src/owner/value.mjs");
  writeFileSync(changed, "export const value = 1;");
  writeFileSync(resolve(root, "test/helpers/reader.mjs"), 'import "../../src/owner/value.mjs";');
  const entries = [
    ["owner", "test/owner/one.test.mjs", "export {};"],
    ["text", "test/readers/text.test.mjs", 'readFileSync("src/owner/value.mjs");'],
    ["helper", "test/other/helper.test.mjs", 'import "../helpers/reader.mjs";'],
    ["smoke", "test/other/smoke.test.mjs", "export {};"],
    ["unrelated", "test/other/no.test.mjs", "export {};"],
  ];
  const tasks = entries.map(([id, path, text]) => { const file = resolve(root, path); writeFileSync(file, text); return { id, scope: "example", file }; });
  const data = { schemaVersion: 1, owners: [{ scope: "example", source: "src", tests: ["test"], mirror: true }],
    smoke: [{ scope: "example", file: "test/other/smoke.test.mjs" }] };
  assert.deepEqual(selectAffectedTestTasks(tasks, [changed], { example: root }, data).map(task => task.id),
    ["owner", "text", "helper", "smoke"]);
  assert.deepEqual(selectAffectedTestTasks(tasks, [changed], { example: root }, data, false).map(task => task.id),
    ["owner", "text", "helper"]);
  assert.throws(() => selectAffectedTestTasks(tasks, [resolve(root, "unowned/value.mjs")], { example: root }, data), /no declared/u);
  assert.throws(() => selectAffectedTestTasks(tasks, [changed], { example: root }, { ...data, smoke: [{ scope: "example", file: "missing" }] }), /not represented/u);
});
