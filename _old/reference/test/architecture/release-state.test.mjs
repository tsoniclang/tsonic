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
  publicPackageSelection,
  readPublicInstallOptions,
} from "../../scripts/release/verify-public-install.mjs";
import {
  inspectRegistry,
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
  assert.match(publish, /before promotion/u);

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

test("public install selects exact staged versions and latest explicitly", () => {
  for (const selection of ["exact", "latest"]) {
    assert.deepEqual(readPublicInstallOptions([
      "--version", version, "--selection", selection,
    ]), { version, selection });
    assert.equal(publicPackageSelection(version, selection), selection === "exact" ? version : "latest");
  }
  for (const args of [
    ["--version", version],
    ["--version", "latest", "--selection", "exact"],
    ["--version", version, "--selection", "unknown"],
    ["--version", version, "--selection", "exact", "--skip"],
  ]) {
    assert.throws(() => readPublicInstallOptions(args), /Usage:|Unsupported public install selection/u);
  }
});

test("registry inspection uses the exact published source provenance", () => {
  const calls = [];
  const [state] = inspectRegistry([{
    name: "package",
    manifest: { version },
  }], {
    npmView(name, field, selectedVersion) {
      calls.push([name, field, selectedVersion]);
      return field === "dist-tags.latest" ? version : "sha512-exact";
    },
    npmViewJson(name, field, selectedVersion) {
      calls.push([name, field, selectedVersion]);
      return { sourceDigest: "selected" };
    },
    inspectPublishedSource(entryValue, provenance) {
      calls.push([entryValue.name, "source", provenance]);
      return { kind: "changed" };
    },
    write() {},
  });
  assert.equal(state.relation, "equal");
  assert.equal(state.source.kind, "changed");
  assert.deepEqual(calls, [
    ["package", "dist-tags.latest", undefined],
    ["package", "dist.integrity", version],
    ["package", "tsonicRelease", version],
    ["package", "source", { sourceDigest: "selected" }],
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
    npmViewJson() {
      return {};
    },
    inspectPublishedSource() {
      return { kind: "current" };
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

test("unverifiable publication requires a new version, not a guessed baseline", () => {
  const [state] = inspectRegistry([{ name: "package", manifest: { version } }], {
    npmView: (name, field) => field === "dist-tags.latest" ? version : "sha512-existing",
    npmViewJson: () => undefined,
    write() {},
  });
  assert.equal(state.source.kind, "unverified");
  assert.equal(classifyReleaseState(version, [state]).kind, "prepare-patch");
  assert.match(formatReleaseChecklist(classifyReleaseState(version, [state]), 1), /provenance is missing or invalid/u);
});

test("unpublished versions do not ask for invented source provenance", () => {
  const [state] = inspectRegistry([{ name: "package", manifest: { version } }], {
    npmView: () => undefined,
    npmViewJson() { assert.fail("unpublished metadata query"); },
    write() {},
  });
  assert.equal(state.source.kind, "unpublished");
  assert.equal(classifyReleaseState(version, [state]).kind, "publish");
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
  return Object.freeze({ name, relation, versionIntegrity,
    source: { kind: drift ? "changed" : versionIntegrity === undefined ? "unpublished" : "current" },
  });
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
