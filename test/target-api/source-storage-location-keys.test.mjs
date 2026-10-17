import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { createSourceStorageScopedKeys } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/scoped-keys.js";
import { createSourceStorageContextFootprints } from "../../packages/target-api/dist/target-analysis/source-storage/graph/context-footprints.js";
import { sourceStorageActivationOwner } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/activation-keys.js";

function fixture(count = 4, limits = {}) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
  const owner = {};
  const body = { parent: owner };
  owner.body = body;
  const subject = (region = body, kind = "value") => ({ kind, node: { region }, projection: [] });
  const root = subject();
  const locations = new Set(Array.from({ length: count }, () => subject()));
  const inputs = new Map([[root, locations]]);
  const empty = { key: "module", owners: new Map() };
  const first = { key: "first", owners: new Map() };
  const second = { key: "second", owners: new Map() };
  const identities = new Map();
  let locationReads = 0;
  let unavailable = false;
  const failure = new Error("exact owner unavailable");
  const source = { ast: { is: { IsVariableDeclaration: () => false },
    parent: node => node.parent, body: node => node.body } };
  const transport = {
    bindingInputFor: () => assert.fail("This physical-location fixture has no binding alias inputs."),
    incomingFor: () => new Set(), contextualInputs: current => inputs.get(current) ?? new Set(),
    contextLocation: current => locations.has(current) ? "allocation" : undefined,
    regions: { enclosing: node => {
      locationReads += 1;
      if (unavailable && locationReads % 2 === 0) throw failure;
      return node.region;
    } },
  };
  const scopes = { empty, owningScope: (scope, selected) => scope.owners.get(selected),
    activation: scope => ({ key: scope.key, variable: scope.variable }), lookup: () => undefined,
    identity: value => {
      if (!identities.has(value)) identities.set(value, identities.size);
      return identities.get(value);
    } };
  const creation = { footprints: createSourceStorageContextFootprints(budget, transport.contextualInputs, transport.contextLocation),
    ownerFor: origin => sourceStorageActivationOwner(source, transport.regions.enclosing, origin) };
  const keys = createSourceStorageScopedKeys(source, budget, transport, scopes, creation);
  const reference = (scope, selected = root) => ({ kind: "reference", subject: selected, scope });
  return { budget, owner, subject, root, locations, inputs, empty, first, second, keys, reference, failure,
    locationReads: () => locationReads, unavailable: value => { unavailable = value; } };
}

test("many physical sites in one activation retain one exact context key within a finite linear work bound", () => {
  const current = fixture(256, { maximumSteps: 2048 });
  const original = current.keys.encode(current.reference(current.first));
  assert.equal(typeof original === "string", true);
  for (let repeat = 0; repeat < 63; repeat += 1)
    assert.equal(current.keys.encode(current.reference(current.first)) === original, true, "same complete context");
  assert.equal(current.locationReads(), 256, "static owners are selected once, not once per key");
  assert.equal(current.budget.failure() === undefined, true, "repeated site count does not multiply repeated context encodes");
});

test("context owner sharing preserves caller identity and distinct physical allocation sites", () => {
  const current = fixture();
  assert.equal(current.keys.encode(current.reference(current.first)) === current.keys.encode(current.reference(current.second)), false,
    "same source locations created by different callers remain different contexts");
  const [left, right] = current.locations;
  const leaf = selected => ({ kind: "leaf", subject: selected, scope: current.first });
  assert.equal(current.keys.encode(leaf(left)) === current.keys.encode(leaf(right)), false, "different sites are never one allocation");
  assert.equal(current.keys.birthKey(left, current.first) === current.keys.birthKey(right, current.first), false);
  assert.equal(current.keys.birthKey(left, current.first) === current.keys.birthKey(left, current.second), false);
});

test("each independent lexical owner retains its own selected captured activation", () => {
  const current = fixture();
  const capturedOwner = {};
  const capturedBody = { parent: capturedOwner };
  capturedOwner.body = capturedBody;
  const capture = current.subject(capturedBody);
  current.locations.add(capture);
  const common = { key: "common", owners: new Map() };
  current.first.owners.set(current.owner, common);
  current.second.owners.set(current.owner, common);
  current.first.owners.set(capturedOwner, current.first);
  current.second.owners.set(capturedOwner, current.second);
  assert.equal(current.keys.encode(current.reference(current.first)) === current.keys.encode(current.reference(current.second)), false,
    "equal caller-side owner does not collapse different captures");
  const duplicate = { key: "irrelevant", owners: new Map(current.first.owners) };
  assert.equal(current.keys.encode(current.reference(current.first)) === current.keys.encode(current.reference(duplicate)), true,
    "equal exact demanded owner activations share a context independently of an irrelevant frame");
});

test("module locations do not acquire caller ownership and return locations retain their declaration owner", () => {
  const current = fixture(0);
  const moduleLocation = current.subject(null);
  moduleLocation.node.region = undefined;
  current.locations.add(moduleLocation);
  assert.equal(current.keys.encode(current.reference(current.first)) === current.keys.encode(current.reference(current.second)), true,
    "module storage has one native physical owner");
  const returns = fixture(0);
  const firstReturn = returns.subject(undefined, "return");
  const secondReturn = returns.subject(undefined, "return");
  returns.locations.add(firstReturn); returns.locations.add(secondReturn);
  const common = { key: "common", owners: new Map() };
  returns.first.owners.set(firstReturn.node, common); returns.second.owners.set(firstReturn.node, common);
  returns.first.owners.set(secondReturn.node, returns.first); returns.second.owners.set(secondReturn.node, returns.second);
  assert.equal(returns.keys.encode(returns.reference(returns.first)) === returns.keys.encode(returns.reference(returns.second)), false,
    "two return owners do not become the enclosing lexical body owner");
});

test("a symbolic physical activation remains open even when repeated locations share its owner", () => {
  const current = fixture();
  const symbolic = { key: "symbolic", owners: new Map(), variable: {} };
  const reference = current.reference(symbolic);
  assert.equal(current.keys.closed(reference), false);
  assert.equal(current.keys.closed(reference), false, "cached owner projection cannot manufacture a closed context");
  assert.equal(current.keys.closed(current.reference(current.first)), true);
  assert.equal(current.keys.encode(reference) === current.keys.encode(current.reference(current.first)), false);
});

test("same physical owner never merges distinct source subjects", () => {
  const current = fixture();
  const other = current.subject();
  current.inputs.set(other, current.locations);
  assert.equal(current.keys.encode(current.reference(current.first)) === current.keys.encode(current.reference(current.first, other)), false,
    "a context projection is not the identity of the relation that consumes it");
});

test("owner projections retain one bounded immutable selection rather than completed key history", () => {
  const remaining = repeats => {
    const current = fixture(4, { maximumTransportRows: 128 });
    for (let repeat = 0; repeat < repeats; repeat += 1)
      assert.equal(typeof current.keys.encode(current.reference(current.first)) === "string", true);
    assert.equal(current.budget.failure() === undefined, true);
    let available = 0;
    while (current.budget.row()) available += 1;
    return available;
  };
  assert.equal(remaining(100), remaining(1), "per-key encodings release their temporary state");
});

test("throwing owner projection releases temporary rows and never caches a partial selection", () => {
  const current = fixture(4, { maximumTransportRows: 64 });
  current.unavailable(true);
  const reference = current.reference(current.first);
  assert.throws(() => current.keys.encode(reference), error => error === current.failure);
  const reservation = current.budget.createRows();
  assert.equal(current.budget.usage().rows, 18, "only five subject indexes and thirteen completed location-footprint rows survive");
  assert.equal(reservation.add(46), true, "failed owner selection retains no key, projection or temporary rows");
  reservation.release();
  current.unavailable(false);
  assert.equal(typeof current.keys.encode(reference) === "string", true, "retry resolves every exact owner");
  assert.equal(current.locationReads(), 6, "four complete retry reads follow the two failed reads");
  assert.equal(current.budget.failure() === undefined, true);
});

for (const limits of [{ maximumSteps: 2 }, { maximumTransportRows: 9 }]) {
  test(`owner projection preserves independent finite guards ${JSON.stringify(limits)}`, () => {
    const current = fixture(4, limits);
    const reference = current.reference(current.first);
    assert.equal(current.keys.encode(reference) === undefined, true);
    assert.equal(current.budget.failure() !== undefined, true);
    assert.equal(current.keys.encode(reference) === undefined, true, "failure remains sticky after reservation release");
  });
}
