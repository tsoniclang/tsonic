import assert from "node:assert/strict";
import test from "node:test";
import { publishStagedWave } from "../../scripts/release/npm-publication.mjs";

test("all staged artifacts and exact public execution precede every latest promotion", () => {
  const fixture = createFixture();
  assert.deepEqual(fixture.execute(), { published: 2, promoted: 2 });
  assert.deepEqual(fixture.events.filter(([kind]) => ["publish", "public", "promote"].includes(kind)), [
    ["publish", "runtime", "staged-1.2.3"],
    ["publish", "cli", "staged-1.2.3"],
    ["public", "exact"],
    ["promote", "runtime"],
    ["promote", "cli"],
    ["public", "latest"],
  ]);
  assert.deepEqual([...fixture.latest.values()], ["1.2.3", "1.2.3"]);
});

test("interrupted publication resumes without republishing or repeating completed promotions", () => {
  const fixture = createFixture({ existing: ["runtime"], promoted: ["runtime"] });
  assert.deepEqual(fixture.execute(), { published: 1, promoted: 1 });
  assert.deepEqual(fixture.events.filter(([kind]) => kind === "publish"), [["publish", "cli", "staged-1.2.3"]]);
  assert.deepEqual(fixture.events.filter(([kind]) => kind === "promote"), [["promote", "cli"]]);
  assert.deepEqual(fixture.events.filter(([kind]) => kind === "public"), [["public", "exact"], ["public", "latest"]]);
});

test("staging failure leaves latest untouched and performs no public proof or promotion", () => {
  const fixture = createFixture();
  const publish = fixture.operations.publish;
  fixture.operations.publish = (artifact, tag) => {
    if (artifact.name === "cli") throw new Error("upload failed");
    publish(artifact, tag);
  };
  assert.throws(fixture.execute, /upload failed/u);
  assert.deepEqual([...fixture.latest.values()], ["1.2.2", "1.2.2"]);
  assert.equal(fixture.events.some(([kind]) => kind === "public" || kind === "promote"), false);
});

test("failed exact public execution prevents all latest changes", () => {
  const fixture = createFixture();
  fixture.operations.verifyPublicInstall = () => { throw new Error("execution failed"); };
  assert.throws(fixture.execute, /execution failed/u);
  assert.deepEqual([...fixture.latest.values()], ["1.2.2", "1.2.2"]);
  assert.equal(fixture.events.some(([kind]) => kind === "promote"), false);
});

test("published and local artifact mutations fail before uploading", () => {
  const published = createFixture({ existing: ["cli"] });
  published.input.registryState[1].versionIntegrity = "different";
  assert.throws(published.execute, /differs from its certified artifact/u);
  assert.equal(published.events.length, 0);

  const local = createFixture();
  local.operations.verifyLocalArtifact = () => { throw new Error("local tarball changed"); };
  assert.throws(local.execute, /local tarball changed/u);
  assert.equal(local.events.length, 0);
});

test("complete artifact closure is mandatory before publication", () => {
  for (const mutation of ["missing", "duplicate", "wrong-version", "unknown"]) {
    const fixture = createFixture();
    const artifacts = fixture.input.packed.packages;
    if (mutation === "missing") artifacts.pop();
    if (mutation === "duplicate") artifacts[1] = { ...artifacts[0] };
    if (mutation === "wrong-version") artifacts[1].version = "1.2.2";
    if (mutation === "unknown") artifacts[1].name = "unlisted";
    assert.throws(fixture.execute, /complete release wave|missing or invalid/u);
    assert.equal(fixture.events.length, 0);
  }
});

test("a missing latest baseline cannot become an implicit first-release exception", () => {
  const fixture = createFixture();
  fixture.input.registryState[0].publishedVersion = undefined;
  assert.throws(fixture.execute, /no existing latest baseline/u);
  assert.equal(fixture.events.length, 0);
});

test("a corrupted staged artifact blocks exact proof and promotion", () => {
  const fixture = createFixture();
  const publish = fixture.operations.publish;
  fixture.operations.publish = (artifact, tag) => {
    publish(artifact, tag);
    fixture.integrities.set(artifact.name, "corrupt");
  };
  assert.throws(fixture.execute, /integrity mismatch/u);
  assert.equal(fixture.events.some(([kind]) => kind === "public" || kind === "promote"), false);
});

test("concurrent latest changes before or during exact proof are never overwritten", () => {
  for (const moment of ["before", "during"]) {
    const fixture = createFixture();
    if (moment === "before") fixture.latest.set("cli", "2.0.0");
    else fixture.operations.verifyPublicInstall = () => fixture.latest.set("cli", "2.0.0");
    assert.throws(fixture.execute, /changed latest before promotion/u);
    assert.equal(fixture.latest.get("cli"), "2.0.0");
    assert.equal(fixture.events.some(([kind]) => kind === "promote"), false);
  }
});

test("promotion interruption and a failing latest proof cannot report completion", () => {
  const promotion = createFixture();
  const promote = promotion.operations.promote;
  promotion.operations.promote = (name, version) => {
    if (name === "cli") throw new Error("promotion interrupted");
    promote(name, version);
  };
  assert.throws(promotion.execute, /promotion interrupted/u);
  assert.deepEqual([...promotion.latest.values()], ["1.2.3", "1.2.2"]);

  const latest = createFixture();
  const verify = latest.operations.verifyPublicInstall;
  latest.operations.verifyPublicInstall = (selection) => {
    verify(selection);
    if (selection === "latest") throw new Error("latest proof failed");
  };
  assert.throws(latest.execute, /latest proof failed/u);
});

function createFixture({ existing = [], promoted = [] } = {}) {
  const version = "1.2.3";
  const names = ["runtime", "cli"];
  const latest = new Map(names.map((name) => [name, promoted.includes(name) ? version : "1.2.2"]));
  const integrities = new Map(existing.map((name) => [name, `sha512-${name}`]));
  const events = [];
  const input = {
    version,
    packages: names.map((name) => ({ name })),
    registryState: names.map((name) => ({ name, publishedVersion: latest.get(name), versionIntegrity: integrities.get(name) })),
    packed: { packages: names.map((name) => ({ name, version, tarballPath: `/packed/${name}.tgz`, integrity: `sha512-${name}` })) },
  };
  const operations = {
    verifyLocalArtifact: (artifact) => events.push(["local", artifact.name]),
    readLatest: (name) => latest.get(name),
    publish(artifact, tag) {
      events.push(["publish", artifact.name, tag]);
      integrities.set(artifact.name, artifact.integrity);
    },
    verifyIntegrity(name, selectedVersion, integrity) {
      assert.equal(selectedVersion, version);
      assert.equal(integrities.get(name), integrity, "integrity mismatch");
      events.push(["integrity", name]);
    },
    verifyPublicInstall(selection) {
      assert.deepEqual([...integrities.keys()].sort(), [...names].sort());
      if (selection === "latest") assert.deepEqual([...latest.values()], [version, version]);
      events.push(["public", selection]);
    },
    promote(name, selectedVersion) {
      assert.ok(events.some(([kind, selection]) => kind === "public" && selection === "exact"));
      events.push(["promote", name]);
      latest.set(name, selectedVersion);
    },
    verifyLatest: (name, selectedVersion) => assert.equal(latest.get(name), selectedVersion),
  };
  return { input, operations, events, latest, integrities, execute: () => publishStagedWave(input, operations) };
}
