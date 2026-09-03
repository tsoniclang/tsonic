import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  hostRoot,
  validateWaveManifests,
} from "../../scripts/release/npm-wave.mjs";

test("npm release wave is public, exact, and dependency ordered", () => {
  const wave = validateWaveManifests();

  assert.equal(wave.version, "0.1.0");
  assert.equal(wave.packages.length, 15);
  assert.equal(new Set(wave.packages.map(({ name }) => name)).size, 15);
  assert.equal(wave.packages.at(-1)?.name, "create-tsonic");
  assert.equal(
    wave.packages.find(({ name }) => name === "@tsonic/tsts")?.manifest.private,
    undefined,
  );
  assert.deepEqual(
    wave.packages.find(({ name }) => name === "@tsonic/cli")?.manifest.files,
    ["dist", "!dist/**/*.tsbuildinfo", "README.md"],
  );
  assert.deepEqual(
    wave.packages.find(({ name }) => name === "create-tsonic")?.manifest.bin,
    { "create-tsonic": "./dist/src/index.js" },
  );
  assert.deepEqual(
    wave.packages.find(({ name }) => name === "@tsonic/target-rust")
      ?.manifest.dependencies,
    {
      "@tsonic/js-source-profile": "0.1.0",
      "@tsonic/rust-runtime": "0.1.0",
      "@tsonic/rust-js": "0.1.0",
    },
  );
});

test("the required publisher validates without publishing from a feature branch", () => {
  const script = resolve(hostRoot, "scripts/publish-npm.sh");
  assert.equal(statSync(script).mode & 0o111, 0o111);
  const result = spawnSync(script, ["--verify-only"], {
    cwd: hostRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Verified 15 release packages at 0\.1\.0/u);
  assert.doesNotMatch(
    readFileSync(resolve(hostRoot, "scripts/release/publish-npm.mjs"), "utf8"),
    /--dangerously|--skip-tests|npm publish.*packageRoot/u,
  );
});
