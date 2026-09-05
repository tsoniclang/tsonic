import assert from "node:assert/strict";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export function bindPackedWorkspaceDependencies(workspaceRoot, manifestPaths, artifacts) {
  const selected = new Map();
  for (const artifact of artifacts) {
    assert.ok(!selected.has(artifact.name), `Duplicate packed dependency '${artifact.name}'.`);
    assert.ok(isAbsolute(artifact.path) && existsSync(artifact.path), `Missing packed artifact '${artifact.path}'.`);
    selected.set(artifact.name, artifact);
  }
  const bindings = [];
  const updates = manifestPaths.map((manifestPath) => {
    const localPath = relative(workspaceRoot, manifestPath);
    assert.ok(!isAbsolute(localPath) && localPath !== ".." && !localPath.startsWith(`..${sep}`),
      `Proof manifest escapes its staged workspace: ${manifestPath}`);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    let changed = false;
    for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      for (const name of Object.keys(manifest[section] ?? {})) {
        const artifact = selected.get(name);
        if (artifact === undefined) continue;
        manifest[section][name] = pathToFileURL(artifact.path).href;
        bindings.push({ manifestPath, name, version: artifact.version });
        changed = true;
      }
    }
    return { manifestPath, manifest, changed };
  });
  for (const update of updates) {
    if (update.changed) writeFileSync(update.manifestPath, `${JSON.stringify(update.manifest, null, 2)}\n`);
  }
  return bindings;
}

export function verifyPackedWorkspaceDependencies(workspaceRoot, bindings) {
  for (const binding of bindings) {
    const expectedPath = resolve(workspaceRoot, "node_modules", ...binding.name.split("/"));
    assert.ok(existsSync(expectedPath), `Missing installed packed dependency '${binding.name}'.`);
    const expected = realpathSync(expectedPath);
    let directory = dirname(binding.manifestPath);
    while (true) {
      const candidate = resolve(directory, "node_modules", ...binding.name.split("/"));
      if (existsSync(candidate)) {
        assert.equal(realpathSync(candidate), expected,
          `Proof package '${binding.manifestPath}' resolves a different '${binding.name}' installation.`);
        const manifest = JSON.parse(readFileSync(resolve(candidate, "package.json"), "utf8"));
        assert.equal(manifest.name, binding.name);
        assert.equal(manifest.version, binding.version,
          `Proof package '${binding.manifestPath}' resolves a different '${binding.name}' version.`);
        break;
      }
      assert.notEqual(directory, workspaceRoot, `Packed dependency '${binding.name}' is unresolved.`);
      directory = dirname(directory);
    }
  }
}
