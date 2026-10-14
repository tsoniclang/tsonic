import assert from "node:assert/strict";
import test from "node:test";
import { createSourceRetentionQuery, createSourceStorageQuery, defaultSourceStorageLimits }
  from "../../packages/target-api/dist/public/analysis.js";
import { ownershipFixture } from "./ownership-fixture.mjs";

const fixture = ownershipFixture();
const query = premises => createSourceRetentionQuery({ ...fixture, premises });
const binding = name => fixture.invocationBindings(fixture.readCall(fixture.declaration(name)));

test("retention follows actual generic substitutions and keeps native lease ownership exact", () => {
  const reader = query(fixture.native);
  for (const name of ["awaited", "discarded", "stored", "returned"]) {
    const bindings = binding(name);
    const selected = reader.forReference(fixture.readReference(), bindings);
    assert.equal(selected.kind, "resolved", name);
    assert.equal(selected.premises.length, 1, "one actual bound native view");
    const premise = selected.premises[0];
    const owner = fixture.declaration(name);
    const originalView = fixture.source.ast.as.AsVariableDeclaration(fixture.named(owner, "view")).Initializer;
    assert.equal(premise.value.node === originalView, true, "not a generic parameter declaration");
    assert.equal(premise.kind === "scoped-borrowed" && premise.mode === "shared", true);
    assert.equal(premise.owner.node === fixture.source.ast.as.AsVariableDeclaration(fixture.named(owner, "owner")).Initializer, true);
    assert.equal(premise.region === fixture.source.ast.body(owner), true);
    assert.equal(fixture.source.semantics.forNode(originalView).types.isIdentical(
      premise.checkedType, fixture.typeFor(premise.value)), true, "instantiated actual native type");
    assert.equal(reader.forReference(fixture.readReference(), bindings) === selected, true, "one completed selection per actual context");
    assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.premises) && Object.isFrozen(premise), true);
  }
});

test("a conditional actual requires every checked native origin, not a preferred candidate", () => {
  const bindings = binding("alternatives");
  const selected = query(fixture.native).forReference(fixture.readReference(), bindings);
  assert.equal(selected.kind === "resolved" && selected.premises.length === 2, true);
  assert.equal(selected.premises[0].owner === selected.premises[1].owner, false, "two independent owner correspondences");
  let first;
  const partial = query({ retentionFor(subject, context) {
    first ??= subject;
    return subject === first ? fixture.native.retentionFor(subject, context) : undefined;
  } }).forReference(fixture.readReference(), bindings);
  assert.equal(partial.kind, "unresolved", "one missing origin cannot become an empty borrowed dependency set");
  assert.match(partial.reason, /bound origin/u);
});

test("missing and empty retention evidence remain unresolved", () => {
  for (const retentionFor of [() => undefined, () => ({ kind: "resolved", premises: [] })]) {
    const selected = query({ retentionFor }).forReference(fixture.readReference(), binding("awaited"));
    assert.equal(selected.kind, "unresolved");
    assert.match(selected.reason, /premise|empty retention/iu);
  }
});

test("a generic formal or copied subject cannot substitute for the actual native view", () => {
  const formal = fixture.subject(fixture.source.ast.parameters(fixture.declaration("read"))[0]);
  for (const replace of [value => formal, value => ({ ...value })]) {
    const selected = query({ retentionFor(value, bindings) {
      const evidence = fixture.native.retentionFor(value, bindings);
      return { kind: "resolved", premises: evidence.premises.map(premise => ({ ...premise, value: replace(value) })) };
    } }).forReference(fixture.readReference(), binding("awaited"));
    assert.equal(selected.kind, "unresolved");
    assert.match(selected.reason, /actual bound origin/u);
  }
});

test("native evidence must use the selected declaration and exact instantiated type", () => {
  const formal = fixture.subject(fixture.source.ast.parameters(fixture.declaration("read"))[0]);
  for (const replacement of [{ contractDeclaration: fixture.declaration("identity") },
    { checkedType: fixture.typeFor(formal) }]) {
    const selected = query({ retentionFor(value, bindings) {
      const evidence = fixture.native.retentionFor(value, bindings);
      return { kind: "resolved", premises: evidence.premises.map(premise => ({ ...premise, ...replacement })) };
    } }).forReference(fixture.readReference(), binding("awaited"));
    assert.equal(selected.kind, "unresolved");
    assert.match(selected.reason, /selected declaration|instantiated source type/u);
  }
});

test("copied binding contexts and foreign owner identities fail at the canonical storage boundary", () => {
  const copied = query(fixture.native).forReference(fixture.readReference(), { ...binding("awaited") });
  assert.equal(copied.kind, "unresolved");
  assert.match(copied.reason, /different source storage query/u);
  const otherStorage = createSourceStorageQuery(fixture.source, fixture.source.navigation.sourceFiles, defaultSourceStorageLimits);
  const actualOwner = fixture.source.ast.as.AsVariableDeclaration(fixture.named(fixture.declaration("awaited"), "owner")).Initializer;
  const foreign = otherStorage.subjectFor(actualOwner);
  assert.equal(foreign.kind, "resolved");
  const selected = query({ retentionFor(value, bindings) {
    const evidence = fixture.native.retentionFor(value, bindings);
    return { kind: "resolved", premises: evidence.premises.map(premise => ({ ...premise, owner: foreign.subject })) };
  } }).forReference(fixture.readReference(), binding("awaited"));
  assert.equal(selected.kind, "unresolved");
  assert.match(selected.reason, /different transport graph/u);
});

test("retained, transferred and program-duration ownership remain independent of wrapper spellings", () => {
  for (const kind of ["retained", "transferred"]) {
    for (const reason of kind === "transferred" ? [undefined] : ["owned-value", "retained-owner"]) {
      const selected = query({ retentionFor(value) {
        const original = fixture.native.retentionFor(value).premises[0];
        return { kind: "resolved", premises: [{ kind, value, ...(reason === undefined ? {} : { reason }),
          ...(reason === "retained-owner" ? { owner: original.owner } : {}),
          ...(kind === "transferred" ? { operation: value.node } : {}),
          checkedType: fixture.typeFor(value), contractDeclaration: fixture.declaration("borrow") }] };
      } }).forReference(fixture.readReference(), binding("stored"));
      assert.equal(selected.kind === "resolved" && selected.premises[0].kind === kind, true, `${kind}/${reason}`);
    }
  }
  const selected = query(fixture.native).forReference(fixture.readReference(), binding("moduleStored"));
  assert.equal(selected.kind === "resolved" && selected.premises[0].kind === "retained" &&
    selected.premises[0].reason === "module-owner", true, "a declared native program-duration owner is not a source-scoped lease");
});

test("a source-file lifetime cannot be mislabeled as a source-scoped lease", () => {
  const selected = query({ retentionFor(value, bindings) {
    const evidence = fixture.native.retentionFor(value, bindings);
    return { kind: "resolved", premises: evidence.premises.map(premise => ({ ...premise,
      region: fixture.source.ast.getSourceFile(value.node) })) };
  } }).forReference(fixture.readReference(), binding("awaited"));
  assert.equal(selected.kind, "unresolved");
  assert.match(selected.reason, /program-duration owner/u);
});

test("a throwing premise producer publishes no partial retained selection", () => {
  let reject = true;
  const reader = query({ retentionFor(value, bindings) {
    if (reject) throw new Error("fixture native proof failed");
    return fixture.native.retentionFor(value, bindings);
  } });
  const bindings = binding("awaited");
  assert.throws(() => reader.forReference(fixture.readReference(), bindings), /fixture native proof failed/u);
  reject = false;
  const selected = reader.forReference(fixture.readReference(), bindings);
  assert.equal(selected.kind === "resolved" && selected.premises.length === 1, true, "failed proofs leave no completed cache entry");
});

test("distinct source aliases reuse one checked retention decision for the same actual origin", () => {
  const bindings = binding("awaited");
  const reference = fixture.readReference();
  const parameter = fixture.source.ast.parameters(fixture.declaration("read"))[0];
  let calls = 0;
  const reader = query({ retentionFor(value, selectedBindings) {
    calls += 1;
    return fixture.native.retentionFor(value, selectedBindings);
  } });
  const first = reader.forReference(reference, bindings);
  const second = reader.forReference(parameter, bindings);
  assert.equal(first.kind === "resolved" && second.kind === "resolved", true);
  assert.equal(calls, 1, "the native value/owner relation is checked once, not once per source reference");
  assert.equal(first.premises[0] === second.premises[0], true);
});
