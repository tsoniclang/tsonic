import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyReleaseState,
  compareSemver,
  formatReleaseChecklist,
  incrementPatch,
} from "../../scripts/release/release-state.mjs";
import {
  assertNoLocalDependencySpecifiers,
  assertPublicInstallLock,
} from "../../scripts/release/verify-public-install.mjs";
import {
  inspectRegistry,
  packageChangedSinceVersion,
} from "../../scripts/release/release-inspection.mjs";

const version = "1.2.3";

test("release state distinguishes current, initial, and resumable waves", () => {
  const current = classifyReleaseState(version, [entry("one", "equal", "sha512-one")]);
  assert.deepEqual(current, { kind: "current", version });

  const initial = classifyReleaseState(version, [
    entry("one", "missing"),
    entry("two", "missing"),
  ]);
  assert.equal(initial.kind, "publish");
  assert.deepEqual(initial.pending.map(({ name }) => name), ["one", "two"]);
  assert.deepEqual(initial.awaitingPromotion.map(({ name }) => name), ["one", "two"]);

  const resumable = classifyReleaseState(version, [
    entry("one", "missing", "sha512-one"),
    entry("two", "behind"),
    entry("three", "equal", "sha512-three"),
  ]);
  assert.equal(resumable.kind, "publish");
  assert.deepEqual(resumable.pending.map(({ name }) => name), ["two"]);
  assert.deepEqual(
    resumable.awaitingPromotion.map(({ name }) => name),
    ["one", "two"],
  );
});

test("published content drift and newer registry versions require a patch", () => {
  const drift = classifyReleaseState(version, [
    entry("changed", "equal", "sha512-old", true),
  ]);
  assert.equal(drift.kind, "prepare-patch");
  assert.deepEqual(drift.reasons.map(({ name }) => name), ["changed"]);

  const ahead = classifyReleaseState(version, [
    entry("ahead", "ahead", "sha512-current"),
  ]);
  assert.equal(ahead.kind, "prepare-patch");
  assert.deepEqual(ahead.reasons.map(({ name }) => name), ["ahead"]);
});

test("release checklist identifies the exact maintainer action", () => {
  const publish = formatReleaseChecklist(
    classifyReleaseState(version, [entry("one", "missing")]),
    15,
  );
  assert.match(publish, /current wave requires publication or promotion/u);
  assert.match(publish, /short-lived read\/write granular token/u);
  assert.match(publish, /identity only/u);
  assert.match(publish, /exact public-registry C#, Rust, and Node execution/u);

  const patch = formatReleaseChecklist(
    classifyReleaseState(version, [entry("one", "equal", "old", true)]),
    15,
  );
  assert.match(patch, /All 15 packages must receive the same next patch version/u);

  const current = formatReleaseChecklist(
    classifyReleaseState(version, [entry("one", "equal", "current")]),
    15,
  );
  assert.match(current, /Status: current/u);
});

test("release semantic versions compare and advance deterministically", () => {
  assert.equal(compareSemver("1.2.3", "1.2.3"), 0);
  assert.equal(compareSemver("1.2.3", "1.2.4"), -1);
  assert.equal(compareSemver("2.0.0", "1.99.99"), 1);
  assert.equal(incrementPatch("1.2.9"), "1.2.10");
  assert.throws(() => compareSemver("1.2", "1.2.0"), /Unsupported release version/u);
});

test("registry inspection uses one shared content-drift decision", () => {
  const calls = [];
  const [state] = inspectRegistry([{
    name: "package",
    manifest: { version },
  }], {
    npmView(name, field, selectedVersion) {
      calls.push([name, field, selectedVersion]);
      return field === "dist-tags.latest" ? version : "sha512-exact";
    },
    packageChangedSinceVersion(entryValue, selectedVersion) {
      calls.push([entryValue.name, "content", selectedVersion]);
      return true;
    },
    write() {},
  });
  assert.equal(state.relation, "equal");
  assert.equal(state.drift, true);
  assert.deepEqual(calls, [
    ["package", "dist-tags.latest", undefined],
    ["package", "dist.integrity", version],
    ["package", "content", version],
  ]);
});

test("registry inspection accepts delayed metadata only through bounded convergence", () => {
  const waits = [];
  const [state] = inspectRegistry([{
    name: "package",
    manifest: { version },
  }], {
    npmView(name, field) {
      return field === "dist-tags.latest" ? version : undefined;
    },
    waitForNpmViewPresence(name, field, selectedVersion, options) {
      waits.push([name, field, selectedVersion, options.npmView("package", field)]);
      return "sha512-converged";
    },
    packageChangedSinceVersion() {
      return false;
    },
    write() {},
  });
  assert.equal(state.versionIntegrity, "sha512-converged");
  assert.deepEqual(waits, [[
    "package",
    "dist.integrity",
    version,
    undefined,
  ]]);
});

test("root package drift uses a valid repository pathspec", () => {
  const calls = [];
  const changed = packageChangedSinceVersion({
    name: "root-package",
    repositoryRoot: "/workspace/package",
    packageRoot: "/workspace/package",
    path: "/workspace/package/package.json",
  }, version, {
    run(command, args) {
      calls.push([command, args]);
      return "version-commit\n";
    },
    spawnSync(command, args, options) {
      calls.push([command, args, options]);
      return { status: 0 };
    },
  });
  assert.equal(changed, false);
  assert.deepEqual(calls[1][1].slice(-2), ["--", "."]);
});

test("public install lock accepts exact public artifacts", () => {
  const lock = publicLock();
  assert.deepEqual(
    assertPublicInstallLock(
      lock,
      version,
      ["@tsonic/cli", "@tsonic/target-rust"],
    ),
    [
      "node_modules/@tsonic/cli",
      "node_modules/@tsonic/target-rust",
    ],
  );
  assert.doesNotThrow(() => assertNoLocalDependencySpecifiers(lock));
});

test("public install lock rejects local, linked, and mismatched artifacts", () => {
  const local = publicLock();
  local.packages["node_modules/@tsonic/cli"].resolved =
    "file:../../packages/cli";
  assert.throws(
    () => assertPublicInstallLock(
      local,
      version,
      ["@tsonic/cli", "@tsonic/target-rust"],
    ),
    /outside https:\/\/registry\.npmjs\.org\//u,
  );
  assert.throws(
    () => assertNoLocalDependencySpecifiers(local),
    /local dependency specifier/u,
  );

  const linked = publicLock();
  linked.packages["node_modules/@tsonic/cli"].link = true;
  assert.throws(
    () => assertPublicInstallLock(
      linked,
      version,
      ["@tsonic/cli", "@tsonic/target-rust"],
    ),
    /linked first-party package/u,
  );

  const mismatched = publicLock();
  mismatched.packages["node_modules/@tsonic/target-rust"].version = "1.2.2";
  assert.throws(
    () => assertPublicInstallLock(
      mismatched,
      version,
      ["@tsonic/cli", "@tsonic/target-rust"],
    ),
    /expected '1\.2\.3'/u,
  );
});

function entry(name, relation, versionIntegrity, drift = false) {
  return Object.freeze({ name, relation, versionIntegrity, drift });
}

function publicLock() {
  return {
    name: "example",
    lockfileVersion: 3,
    packages: {
      "": {
        devDependencies: {
          "@tsonic/cli": version,
          "@tsonic/target-rust": version,
        },
      },
      "node_modules/@tsonic/cli": {
        version,
        resolved: `https://registry.npmjs.org/@tsonic/cli/-/cli-${version}.tgz`,
      },
      "node_modules/@tsonic/target-rust": {
        version,
        resolved: `https://registry.npmjs.org/@tsonic/target-rust/-/target-rust-${version}.tgz`,
      },
    },
  };
}
