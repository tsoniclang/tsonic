import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { bindPackedWorkspaceDependencies, verifyPackedWorkspaceDependencies } from "../../scripts/packed-workspace.mjs";
import { tsonicRoot } from "../../scripts/workspace-layout.mjs";

function fixture() {
  const scratch = resolve(tsonicRoot, ".temp/packed-workspace-tests");
  mkdirSync(scratch, { recursive: true });
  const root = mkdtempSync(resolve(scratch, "case-"));
  const workspace = resolve(root, "workspace");
  mkdirSync(resolve(workspace, "packages/app"), { recursive: true });
  const artifact = { name: "@example/compiler", version: "2.0.0", path: resolve(root, "compiler 2.tgz") };
  writeFileSync(artifact.path, "artifact-fixture");
  const manifestPath = resolve(workspace, "packages/app/package.json");
  const manifest = { name: "example-app", devDependencies: { "@example/compiler": "1.0.0" }, dependencies: { "@example/domain": "*", unrelated: "3.0.0" } };
  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
  return { root, workspace, artifact, manifestPath, manifest };
}

test("staged dependency binding selects exact tarballs without changing unrelated dependencies", () => {
  const value = fixture();
  const bindings = bindPackedWorkspaceDependencies(value.workspace, [value.manifestPath], [value.artifact]);
  const actual = JSON.parse(readFileSync(value.manifestPath, "utf8"));
  assert.deepEqual(actual, { ...value.manifest, devDependencies: { "@example/compiler": pathToFileURL(value.artifact.path).href } });
  assert.deepEqual(bindings, [{ manifestPath: value.manifestPath, name: value.artifact.name, version: "2.0.0" }]);
});

test("all dependency sections bind by exact package identity, not spelling prefixes", () => {
  const value = fixture();
  const sections = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
  const manifest = Object.fromEntries(sections.map((section) => [section, { "@example/compiler": "1.0.0", "@example/compiler-extra": "1.0.0" }]));
  writeFileSync(value.manifestPath, JSON.stringify(manifest));
  const bindings = bindPackedWorkspaceDependencies(value.workspace, [value.manifestPath], [value.artifact]);
  const actual = JSON.parse(readFileSync(value.manifestPath, "utf8"));
  assert.equal(bindings.length, 4);
  for (const section of sections) assert.deepEqual(actual[section], {
    "@example/compiler": pathToFileURL(value.artifact.path).href, "@example/compiler-extra": "1.0.0",
  });
});

test("invalid artifact inventories and escaped manifests reject before changing stage files", () => {
  const value = fixture();
  const original = readFileSync(value.manifestPath, "utf8");
  assert.throws(() => bindPackedWorkspaceDependencies(value.workspace, [value.manifestPath], [value.artifact, value.artifact]), /Duplicate/u);
  assert.throws(() => bindPackedWorkspaceDependencies(value.workspace, [value.manifestPath], [{ ...value.artifact, path: resolve(value.root, "absent.tgz") }]), /Missing/u);
  assert.throws(() => bindPackedWorkspaceDependencies(value.workspace, [value.manifestPath, resolve(value.root, "package.json")], [value.artifact]), /escapes/u);
  assert.equal(readFileSync(value.manifestPath, "utf8"), original);
});

test("installed proof dependencies must resolve to the selected root artifact and version", () => {
  const value = fixture();
  const bindings = bindPackedWorkspaceDependencies(value.workspace, [value.manifestPath], [value.artifact]);
  assert.throws(() => verifyPackedWorkspaceDependencies(value.workspace, bindings), /Missing/u);
  const installedRoot = resolve(value.workspace, "node_modules/@example/compiler");
  mkdirSync(installedRoot, { recursive: true });
  writeFileSync(resolve(installedRoot, "package.json"), JSON.stringify({ name: value.artifact.name, version: "2.0.0" }));
  verifyPackedWorkspaceDependencies(value.workspace, bindings);
  writeFileSync(resolve(installedRoot, "package.json"), JSON.stringify({ name: value.artifact.name, version: "1.0.0" }));
  assert.throws(() => verifyPackedWorkspaceDependencies(value.workspace, bindings), /different.*version/u);
  const nested = resolve(value.workspace, "packages/app/node_modules/@example/compiler");
  mkdirSync(nested, { recursive: true });
  writeFileSync(resolve(nested, "package.json"), JSON.stringify({ name: value.artifact.name, version: "2.0.0" }));
  assert.throws(() => verifyPackedWorkspaceDependencies(value.workspace, bindings), /different.*installation/u);
});
