import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { testWorkspaceRoot, tsonicRoot } from "../scripts/workspace-layout.mjs";

function dependencyOrderErrors(sequence) {
  const manifests = sequence.map((directory) => JSON.parse(
    readFileSync(resolve(tsonicRoot, directory, "package.json"), "utf8"),
  ));
  const selected = new Set(manifests.map((manifest) => manifest.name));
  const built = new Set();
  const errors = [];
  for (const manifest of manifests) {
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      if (selected.has(dependency) && !built.has(dependency)) {
        errors.push(`${manifest.name} precedes ${dependency}`);
      }
    }
    built.add(manifest.name);
  }
  return errors;
}

for (const repository of ["tsonic-csharp", "csharp-nodejs"]) {
  test(`${repository} builds shared dependencies in manifest order`, () => {
    const source = readFileSync(resolve(testWorkspaceRoot, repository, "scripts/build.sh"), "utf8");
    const declaration = /for package_dir in ([^;]+); do/u.exec(source);
    assert.ok(declaration, "the shared dependency build sequence must be explicit");
    const sequence = declaration[1].trim().split(/\s+/u);
    assert.deepEqual(dependencyOrderErrors(sequence), []);
    assert.deepEqual(dependencyOrderErrors([...sequence].reverse()), [
      "@tsonic/source-core precedes @tsonic/target-api",
    ]);
  });
}
