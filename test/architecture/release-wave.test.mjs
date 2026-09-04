import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  hostRoot,
  validateWaveManifests,
} from "../../scripts/release/npm-wave.mjs";
import {
  npmRegistry,
  npmView,
  requireNpmAuthentication,
} from "../../scripts/release/npm-registry.mjs";

test("npm release wave is public, exact, and dependency ordered", () => {
  const wave = validateWaveManifests();

  assert.match(wave.version, /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u);
  assert.equal(wave.packages.length, 15);
  assert.equal(new Set(wave.packages.map(({ name }) => name)).size, 15);
  assert.equal(wave.layout.workspaceRoot, resolve(hostRoot, ".."));
  assert.equal(
    wave.layout.repositoryRoots.get("tsonic-csharp"),
    resolve(hostRoot, "../tsonic-csharp"),
  );
  assert.equal(wave.packages.at(-1)?.name, "create-tsonic");
  assert.deepEqual(
    wave.certification.map(({ repository }) => repository),
    ["tsonic", "tsonic-rust", "rust-runtime", "rust-js", "rust-nodejs"],
  );
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
      "@tsonic/js-source-profile": wave.version,
      "@tsonic/rust-runtime": wave.version,
      "@tsonic/rust-js": wave.version,
    },
  );
});

test("the required publisher validates without publishing from a feature branch", () => {
  const script = resolve(hostRoot, "scripts/publish-npm.sh");
  const statusScript = resolve(hostRoot, "scripts/release-status.sh");
  assert.equal(statSync(script).mode & 0o111, 0o111);
  assert.equal(statSync(statusScript).mode & 0o111, 0o111);
  const result = spawnSync(script, ["--verify-only"], {
    cwd: hostRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Verified 15 release packages at [0-9]+\.[0-9]+\.[0-9]+/u);
  const publisherSource = readFileSync(
    resolve(hostRoot, "scripts/release/publish-npm.mjs"),
    "utf8",
  );
  assert.doesNotMatch(
    publisherSource,
    /--dangerously|--skip-tests|npm publish.*packageRoot/u,
  );
  const authenticationIndex = publisherSource.indexOf(
    "const npmUsername = requireNpmAuthentication();",
  );
  const certificationIndex = publisherSource.indexOf("certifyWave(wave)");
  assert.notEqual(authenticationIndex, -1);
  assert.notEqual(certificationIndex, -1);
  assert.ok(
    authenticationIndex < certificationIndex,
    "npm authentication must be checked before expensive certification",
  );
  assert.match(publisherSource, /const stagingTag = "tsonic-wave"/u);
  assert.match(publisherSource, /"--tag",\s*stagingTag/u);
  assert.match(
    publisherSource,
    /"dist-tag",\s*"add",\s*`\$\{entry\.name\}@\$\{wave\.version\}`,\s*"latest"/u,
  );
  assert.match(publisherSource, /"--registry",\s*npmRegistry/u);
  assert.match(publisherSource, /scripts\/check-branch-hygiene\.sh/u);
  assert.ok(
    publisherSource.indexOf("verifyPublishedIntegrity(entry.name") <
      publisherSource.indexOf('"dist-tag",'),
    "every exact artifact must be verified before the latest-tag promotion",
  );
  const publicInstallIndex = publisherSource.indexOf(
    '"scripts/release/verify-public-install.mjs", "--version", wave.version',
  );
  const promotionIndex = publisherSource.indexOf(
    "for (const entry of awaitingPromotion)",
  );
  assert.notEqual(publicInstallIndex, -1);
  assert.notEqual(promotionIndex, -1);
  assert.ok(
    publicInstallIndex < promotionIndex,
    "the exact public install must pass before the latest-tag promotion",
  );

  const publicInstallSource = readFileSync(
    resolve(hostRoot, "scripts/release/verify-public-install.mjs"),
    "utf8",
  );
  assert.match(publicInstallSource, /npm_config_registry: npmRegistry/u);
  assert.match(publicInstallSource, /name: "tsonic-public-install-root"/u);
  assert.match(publicInstallSource, /delete environment\[name\]/u);
  assert.match(publicInstallSource, /"TSONICLANG_WORKSPACE_ROOT"/u);
  assert.match(publicInstallSource, /"TSONIC_ROOT"/u);
  assert.match(publicInstallSource, /\["ls", "--all"\]/u);
  assert.match(publicInstallSource, /lstatSync\(installedPath\)\.isSymbolicLink/u);
  assert.doesNotMatch(publicInstallSource, /npm link|workspace:\*|file:\.\./u);

  const packedInstallSource = readFileSync(
    resolve(hostRoot, "scripts/release/verify-packed-install.mjs"),
    "utf8",
  );
  assert.match(packedInstallSource, /const totalFileCount = packed\.reduce/u);
  assert.match(publisherSource, /packed\.totalFileCount/u);
});

test("npm release access is explicit and fails before unauthenticated publication", () => {
  const calls = [];
  const username = requireNpmAuthentication((args) => {
    calls.push(args);
    return { status: 0, stdout: "release-owner\n", stderr: "" };
  });
  assert.equal(username, "release-owner");
  assert.deepEqual(calls, [["whoami", "--registry", npmRegistry]]);

  assert.throws(
    () => requireNpmAuthentication(() => ({
      status: 1,
      stdout: "",
      stderr: "npm error code E401",
    })),
    /npm authentication is required before release certification/u,
  );
});

test("npm registry reads use the canonical public registry", () => {
  const calls = [];
  const value = npmView("@tsonic/cli", "version", undefined, (args) => {
    calls.push(args);
    return { status: 0, stdout: '"0.1.0"\n', stderr: "" };
  });
  assert.equal(value, "0.1.0");
  assert.deepEqual(calls, [[
    "view",
    "@tsonic/cli",
    "version",
    "--json",
    "--registry",
    npmRegistry,
  ]]);
});
