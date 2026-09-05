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
  waitForNpmViewPresence,
  waitForNpmViewValue,
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
  assert.doesNotMatch(publisherSource, /tsonic-wave/u);
  assert.match(publisherSource, /"--tag",\s*"latest"/u);
  assert.match(
    publisherSource,
    /"dist-tag",\s*"add",\s*`\$\{entry\.name\}@\$\{wave\.version\}`,\s*"latest"/u,
  );
  assert.match(publisherSource, /"--registry",\s*npmRegistry/u);
  assert.match(publisherSource, /scripts\/check-branch-hygiene\.sh/u);
  assert.match(publisherSource, /waitForNpmViewPresence/u);
  const publicInstallIndex = publisherSource.lastIndexOf(
    '"scripts/release/verify-public-install.mjs", "--version", wave.version',
  );
  const publicationIndex = publisherSource.indexOf('"publish",');
  assert.notEqual(publicInstallIndex, -1);
  assert.notEqual(publicationIndex, -1);
  assert.ok(
    publicationIndex < publicInstallIndex,
    "the public install must exercise already-published registry artifacts",
  );

  const publicInstallSource = readFileSync(
    resolve(hostRoot, "scripts/release/verify-public-install.mjs"),
    "utf8",
  );
  assert.match(publicInstallSource, /npm_config_registry: npmRegistry/u);
  assert.match(publicInstallSource, /"tsonic@latest"/u);
  assert.match(publicInstallSource, /`\$\{options\.capabilityPackage\}@latest`/u);
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

test("npm registry convergence waits for delayed metadata and tags", () => {
  const integrityValues = [undefined, undefined, "sha512-exact"];
  const integrityPauses = [];
  assert.equal(
    waitForNpmViewPresence("package", "dist.integrity", "1.2.3", {
      attempts: 3,
      delayMilliseconds: 7,
      npmView: () => integrityValues.shift(),
      pause: (milliseconds) => integrityPauses.push(milliseconds),
    }),
    "sha512-exact",
  );
  assert.deepEqual(integrityPauses, [7, 7]);

  const tagValues = ["1.2.2", undefined, "1.2.3"];
  assert.equal(
    waitForNpmViewValue("package", "dist-tags.latest", "1.2.3", {
      attempts: 3,
      delayMilliseconds: 1,
      npmView: () => tagValues.shift(),
      pause() {},
    }),
    "1.2.3",
  );
});

test("npm registry convergence fails closed after its deadline", () => {
  assert.throws(
    () => waitForNpmViewPresence("package", "dist.integrity", "1.2.3", {
      attempts: 2,
      delayMilliseconds: 1,
      npmView: () => undefined,
      pause() {},
    }),
    /did not expose 'dist\.integrity'/u,
  );
  assert.throws(
    () => waitForNpmViewValue("package", "dist-tags.latest", "1.2.3", {
      attempts: 2,
      delayMilliseconds: 1,
      npmView: () => "1.2.2",
      pause() {},
    }),
    /observed '1\.2\.2'/u,
  );
});
