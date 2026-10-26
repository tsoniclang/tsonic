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
    activation: scope => ({ key: scope.key, variable: scope.variable, closed: scope.variable === undefined }), lookup: () => undefined,
    identity: value => {
      if (!identities.has(value)) identities.set(value, identities.size);
      return identities.get(value);
    } };
  const creation = { footprints: createSourceStorageContextFootprints(budget, transport.contextualInputs, transport.contextLocation),
    ownerFor: origin => sourceStorageActivationOwner(source, transport.regions.enclosing, origin) };
  const keys = createSourceStorageScopedKeys(source, budget, transport, scopes, creation);
  const reference = (scope, selected = root) => ({ kind: "reference", subject: selected, scope });
  return { budget, owner, source, transport, scopes, subject, root, locations, inputs, empty, first, second, keys, reference, failure,
    locationReads: () => locationReads, unavailable: value => { unavailable = value; } };
}

function applicationFixture() {
  const current = fixture(0);
  current.source.semantics = { forNode: () => ({ operations: {
    call: () => ({ sourceArguments: [] }), propertyAccess: () => undefined,
  } }) };
  current.transport.subject = node => node?.subject;
  current.transport.subjectFor = () => undefined;
  const application = (scope = current.first) => {
    const invocation = Object.freeze({ subject: current.subject() });
    return Object.freeze({ kind: "application", mode: "value", invocation,
      callee: Object.freeze({ kind: "leaf", subject: current.root, scope: current.empty }),
      scope, projection: Object.freeze([]), activation: Object.freeze({ kind: "invoke" }) });
  };
  return { ...current, application };
}

test("completed compound encodings are reused and released with their exact query cohort", () => {
  const current = fixture(0);
  const term = Object.freeze({ kind: "empty", absence: undefined });
  const encoded = current.keys.encode(term);
  assert.equal(typeof encoded, "string", "the complete original term has a canonical key");
  const retained = current.budget.usage().rows;
  const before = current.budget.usage().steps;
  for (let repeat = 0; repeat < 100; repeat++)
    assert.equal(current.keys.encode(term), encoded, "the same immutable term does not re-enter its encoder");
  assert.equal(current.budget.usage().steps - before, 100, "each completed memo lookup charges exactly one real lookup step");
  assert.equal(current.budget.usage().rows, retained, "repeated complete keys retain one exact term entry");
  current.keys.releaseReferenceMemo();
  assert.equal(current.budget.usage().rows, retained - 1, "the completed term's own retained row is released at the existing boundary");
  assert.equal(current.keys.encode(term), encoded, "a fresh cohort preserves canonical structural identity");
  assert.equal(current.budget.usage().rows, retained, "the fresh cohort reserves its own completed row before publication");
});

test("an application keeps distinct ordinary and physical-root invocation encodings", () => {
  const current = applicationFixture();
  const term = current.application();
  const ordinary = current.keys.encode(term);
  const invocation = current.keys.invocation(term);
  assert.equal(typeof ordinary === "string" && typeof invocation === "string", true, "both original modes are fully encoded");
  assert.equal(ordinary === invocation, false, "physical invocation identity is not a normal value key");
  assert.equal(current.keys.encode(term), ordinary, "the physical-root lookup does not overwrite the ordinary memo");
  assert.equal(current.keys.invocation(term), invocation, "each actual mode retains its own exact key");
  const inner = current.application();
  assert.equal(typeof current.keys.invocation(inner), "string", "the child's physical mode is already cached");
  const outer = Object.freeze({ ...current.application(), activation: Object.freeze({ kind: "provided", argument: inner }) });
  const copied = Object.freeze({ ...outer, activation: Object.freeze({ kind: "provided", argument: Object.freeze({ ...inner }) }) });
  assert.equal(current.keys.invocation(outer), current.keys.invocation(copied),
    "a nested application remains ordinary beneath a physical invocation root, regardless of its cached physical key");
  assert.equal(current.budget.failure(), undefined, "mode separation does not invent a new source guard");
});

test("completed compound memo hits retain independently open physical evidence", () => {
  const current = fixture(0);
  const symbolic = { key: "symbolic", owners: new Map(), variable: {} };
  const leaf = Object.freeze({ kind: "leaf", subject: current.root, scope: symbolic });
  const term = Object.freeze({ kind: "store", destination: leaf, receiver: leaf, value: leaf });
  assert.equal(current.keys.closed(term), false, "the original compound physically retains an open activation");
  const steps = current.budget.usage().steps;
  assert.equal(current.keys.closed(term), false, "memoization merges the cached open flag, not only the key");
  assert.equal(current.budget.usage().steps - steps, 1, "the open result is a completed lookup, not re-analysis");
  current.keys.releaseReferenceMemo();
  assert.equal(current.keys.closed(term), false, "query-cohort release never makes an open physical state closed");
});

test("a throwing compound key publishes no partial completed child", () => {
  const current = fixture(4);
  const activation = current.scopes.activation;
  let activations = 0;
  current.scopes.activation = scope => { activations++; return activation(scope); };
  const child = Object.freeze({ kind: "effect", scope: current.first, store: Object.freeze({ reference: {} }) });
  const term = Object.freeze({ kind: "store", destination: child, receiver: current.reference(current.first), value: child });
  current.unavailable(true);
  assert.throws(() => current.keys.encode(term), error => error === current.failure,
    "the original exact owner lookup failure is not replaced by a memo answer");
  const before = activations;
  current.unavailable(false);
  assert.equal(typeof current.keys.encode(child), "string", "a later query can encode the completed child normally");
  assert.equal(activations - before, 1, "the failed outer request did not publish its completed child into the cohort memo");
  assert.equal(current.budget.failure(), undefined, "temporary work and failed memo additions are fully released");
});

test("compound memoization preserves active-cycle and sticky finite-budget refusal", () => {
  const current = fixture(0);
  const empty = Object.freeze({ kind: "empty", absence: undefined });
  const cycle = { kind: "store", destination: empty, receiver: undefined, value: empty };
  cycle.receiver = cycle;
  Object.freeze(cycle);
  assert.equal(current.keys.encode(cycle), undefined, "an in-progress marker is never a completed cached answer");
  assert.equal(current.budget.failure(), "Source storage key terms require an acyclic exact value.");
  assert.equal(current.keys.encode(empty), undefined, "an earlier complete child cannot bypass a sticky owner failure");
  const limited = fixture(0, { maximumTransportRows: 1 });
  assert.equal(limited.keys.encode(empty), undefined, "retention cannot publish beyond the actual row limit");
  assert.equal(limited.budget.failure() !== undefined, true, "the unchanged row guard remains authoritative");
  limited.keys.releaseReferenceMemo();
  assert.equal(limited.keys.encode(empty), undefined, "releasing memo rows does not erase a finite-budget failure");
});

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
  assert.equal(current.keys.birth(left, current.first).key === current.keys.birth(right, current.first).key, false);
  assert.equal(current.keys.birth(left, current.first).key === current.keys.birth(left, current.second).key, false);
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
