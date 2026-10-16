import assert from "node:assert/strict";
import test from "node:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { guardSourceFiles, snapshotTestGuard } from "../../scripts/guard-snapshot.mjs";

mkdirSync(".temp/guard-snapshot-tests", { recursive: true });

function sourceFixture() {
  const root = mkdtempSync(resolve(".temp/guard-snapshot-tests/source-"));
  const source = resolve(root, "source");
  const destination = resolve(root, "snapshots");
  mkdirSync(source);
  for (const name of guardSourceFiles) writeFileSync(resolve(source, name), `first:${name}\n`);
  return { source, destination };
}

test("an in-flight guard retains every original helper when canonical sources change", () => {
  const { source, destination } = sourceFixture();
  const first = snapshotTestGuard(source, destination);
  assert.equal(snapshotTestGuard(source, destination), first);
  for (const name of guardSourceFiles) writeFileSync(resolve(source, name), `second:${name}\n`);
  const second = snapshotTestGuard(source, destination);
  assert.notEqual(second, first);
  for (const name of guardSourceFiles) {
    assert.equal(readFileSync(resolve(first, name), "utf8"), `first:${name}\n`);
    assert.equal(readFileSync(resolve(second, name), "utf8"), `second:${name}\n`);
  }
});

test("a modified execution snapshot is refused, never repaired or reused silently", () => {
  const { source, destination } = sourceFixture();
  const first = snapshotTestGuard(source, destination);
  const path = resolve(first, guardSourceFiles[0]);
  chmodSync(path, 0o644);
  writeFileSync(path, "modified\n");
  assert.throws(() => snapshotTestGuard(source, destination), /immutable.*modified/u);
});
