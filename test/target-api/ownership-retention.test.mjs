import assert from "node:assert/strict";
import test from "node:test";
import { createSourceDeclarationRetentionQuery, createSourceStorageQuery, defaultSourceStorageLimits }
  from "../../packages/target-api/dist/public/analysis.js";
import { ownershipFixture } from "./ownership-fixture.mjs";

const fixture = ownershipFixture();
const query = premises => createSourceDeclarationRetentionQuery({ ...fixture, premises });
const referenceFor = name => fixture.source.ast.arguments(fixture.readCall(fixture.declaration(name)))[0];
const valueFor = node => {
  const value = fixture.values.forNode(node);
  assert.equal("kind" in value, false, "the original checked local value is required");
  return value;
};

test("retention follows actual generic substitutions and keeps native lease ownership exact", () => {
  const reader = query(fixture.native);
  for (const name of ["awaited", "discarded", "stored", "returned"]) {
    const reference = referenceFor(name);
    const selected = reader.forReference(reference);
    assert.equal(selected.kind, "resolved", name);
    assert.equal(selected.premises.length, 1, "one actual native view");
    const premise = selected.premises[0];
    const owner = fixture.declaration(name);
    const originalView = fixture.source.ast.as.AsVariableDeclaration(fixture.named(owner, "view")).Initializer;
    assert.equal(premise.value.node === reference && premise.value.node !== fixture.source.ast.parameters(fixture.declaration("read"))[0],
      true, "the exact caller read, not a substituted generic parameter");
    assert.equal(premise.kind === "scoped-borrowed" && premise.mode === "shared", true);
    assert.equal(premise.owner.node === fixture.source.ast.as.AsVariableDeclaration(fixture.named(owner, "owner")).Initializer, true);
    assert.equal(premise.region === fixture.source.ast.body(owner), true);
    assert.equal(premise.value.region.owner === owner && premise.value.region.root === premise.region &&
      premise.value.region.role === "body", true, "the required checked declaration region");
    assert.equal(fixture.source.semantics.forNode(originalView).types.isIdentical(
      premise.contract.component.selectedType, fixture.typeFor(premise.value)), true, "instantiated actual native type");
    assert.equal(reader.forReference(reference) === selected, true, "one completed selection per original read");
    assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.premises) && Object.isFrozen(premise), true);
  }
});

test("a conditional actual requires every checked native origin, not a preferred candidate", () => {
  const reference = referenceFor("alternatives");
  const selected = query(fixture.native).forReference(reference);
  assert.equal(selected.kind === "resolved" && selected.premises.length === 2, true);
  assert.equal(selected.premises[0].owner === selected.premises[1].owner, false, "two independent native owner correspondences");
  const partial = query({ retentionFor(request) {
    const evidence = fixture.native.retentionFor(request);
    return { ...evidence, premises: evidence.premises.map((premise, index) =>
      index === 0 ? premise : { ...premise, owner: { ...premise.owner } }) };
  } }).forReference(reference);
  assert.equal(partial.kind, "unresolved", "one invalid native owner cannot become a partial borrowed dependency set");
  assert.match(partial.reason, /owner|checked local value/u);
});

test("missing and empty retention evidence remain unresolved", () => {
  for (const retentionFor of [() => undefined, () => ({ kind: "resolved", premises: [] })]) {
    const selected = query({ retentionFor }).forReference(referenceFor("awaited"));
    assert.equal(selected.kind, "unresolved");
    assert.match(selected.reason, /contract|nonempty native proof/iu);
    assert.equal(selected.cause.kind, "required-fact");
  }
});

test("a generic formal or copied subject cannot substitute for the actual native view", () => {
  const formal = fixture.subject(fixture.source.ast.parameters(fixture.declaration("read"))[0]);
  for (const replace of [value => formal, value => ({ ...value })]) {
    const selected = query({ retentionFor(request) {
      const evidence = fixture.native.retentionFor(request);
      return { kind: "resolved", premises: evidence.premises.map(premise => ({ ...premise, value: replace(request.value) })) };
    } }).forReference(referenceFor("awaited"));
    assert.equal(selected.kind, "unresolved");
    assert.match(selected.reason, /exact checked local value/u);
  }
});

test("native evidence must use the selected declaration and exact instantiated type", () => {
  const formal = fixture.subject(fixture.source.ast.parameters(fixture.declaration("read"))[0]);
  for (const amend of [
    contract => ({ kind: "declaration", declaration: fixture.declaration("identity"), component: contract.component }),
    contract => ({ ...contract, component: { selectedType: fixture.typeFor(formal) } }),
  ]) {
    const selected = query({ retentionFor(request) {
      const evidence = fixture.native.retentionFor(request);
      return { ...evidence, premises: evidence.premises.map(premise => ({ ...premise, contract: amend(premise.contract) })) };
    } }).forReference(referenceFor("awaited"));
    assert.equal(selected.kind, "unresolved");
    assert.match(selected.reason, /selected declaration|checked component/u);
  }
});

test("copied binding contexts and foreign owner identities fail at the canonical storage boundary", () => {
  const reference = referenceFor("awaited");
  const copied = query(fixture.native).forValue({ ...valueFor(reference) });
  assert.equal(copied.kind, "unresolved");
  assert.match(copied.reason, /original immutable local descriptor/u);
  const otherStorage = createSourceStorageQuery(fixture.source, fixture.source.navigation.sourceFiles, defaultSourceStorageLimits);
  const actualOwner = fixture.source.ast.as.AsVariableDeclaration(fixture.named(fixture.declaration("awaited"), "owner")).Initializer;
  const foreign = otherStorage.subjectFor(actualOwner);
  assert.equal(foreign.kind, "resolved");
  const selected = query({ retentionFor(request) {
    const evidence = fixture.native.retentionFor(request);
    return { ...evidence, premises: evidence.premises.map(premise => ({ ...premise, owner: foreign.subject })) };
  } }).forReference(reference);
  assert.equal(selected.kind, "unresolved");
  assert.match(selected.reason, /distinct checked local value/u);
});

test("retained, transferred and program-duration ownership remain independent of wrapper spellings", () => {
  for (const kind of ["retained", "transferred"]) {
    for (const reason of kind === "transferred" ? [undefined] : ["owned-value", "retained-owner"]) {
      const selected = query({ retentionFor(request) {
        const original = fixture.native.retentionFor(request).premises[0];
        return { kind: "resolved", premises: [{ kind, value: request.value, ...(reason === undefined ? {} : { reason }),
          ...(reason === "retained-owner" ? { owner: original.owner } : {}),
          ...(kind === "transferred" ? { operation: request.value.node } : {}),
          contract: original.contract }] };
      } }).forReference(referenceFor("stored"));
      assert.equal(selected.kind === "resolved" && selected.premises[0].kind === kind, true, `${kind}/${reason}`);
    }
  }
  const selected = query(fixture.native).forReference(referenceFor("moduleStored"));
  assert.equal(selected.kind === "resolved" && selected.premises[0].kind === "retained" &&
    selected.premises[0].reason === "module-owner", true, "a declared native program-duration owner is not a source-scoped lease");
});

test("a source-file lifetime cannot be mislabeled as a source-scoped lease", () => {
  const selected = query({ retentionFor(request) {
    const evidence = fixture.native.retentionFor(request);
    return { ...evidence, premises: evidence.premises.map(premise => ({ ...premise,
      region: fixture.source.ast.getSourceFile(request.value.node) })) };
  } }).forReference(referenceFor("awaited"));
  assert.equal(selected.kind, "unresolved");
  assert.match(selected.reason, /checked non-module lifetime region/u);
});

test("a throwing premise producer publishes no partial retained selection", () => {
  let reject = true;
  const reader = query({ retentionFor(request) {
    if (reject) throw new Error("fixture native proof failed");
    return fixture.native.retentionFor(request);
  } });
  const reference = referenceFor("awaited");
  assert.throws(() => reader.forReference(reference), /fixture native proof failed/u);
  reject = false;
  const selected = reader.forReference(reference);
  assert.equal(selected.kind === "resolved" && selected.premises.length === 1, true, "failed proofs leave no completed cache entry");
});

test("distinct source aliases reuse one checked retention decision for the same actual origin", () => {
  const reference = fixture.readReference();
  const parameter = fixture.source.ast.parameters(fixture.declaration("read"))[0];
  let calls = 0;
  const reader = query({ retentionFor(request) {
    calls += 1;
    return fixture.native.retentionFor(request);
  } });
  const first = reader.forReference(reference);
  const second = reader.forReference(parameter);
  assert.equal(first.kind === "resolved" && second.kind === "resolved", true);
  assert.equal(calls, 2, "each original checked read requires its native contract, not an origin alias lookup");
  assert.equal(first.premises[0].executionOwner === second.premises[0].executionOwner &&
    first.premises[0].region.parameter === second.premises[0].region.parameter, true, "the exact native formal owner remains shared");
  assert.equal(reader.forReference(reference) === first && calls === 2, true, "completed read identities are reused");
});

test("a qualified native read proves only its exact reference, value and binding context", () => {
  const reference = fixture.readReference();
  const value = valueFor(reference);
  let calls = 0;
  const reader = query({ retentionFor(request) {
    assert.equal(request.kind, "read-value", "independent read does not request its receiver's origin");
    assert.equal(request.reference === request.value.node, true, "actual checked read identity");
    calls += 1;
    return { kind: "resolved", premises: [{ kind: "retained", reason: "owned-value", value: request.value,
      contract: { kind: "expression", expression: request.reference, component: request.value.component } }] };
  } });
  const selected = reader.forReference(reference);
  assert.equal(selected.kind === "resolved" && selected.premises.length === 1 &&
    selected.premises[0].value === value, true, "selected native read is independently owned");
  assert.equal(reader.forReference(reference) === selected, true, "same exact read decision is reused");
  const otherReference = referenceFor("discarded");
  const other = reader.forReference(otherReference);
  assert.equal(other.kind === "resolved" && other.reference === otherReference, true, "another checked read requires its own proof");
  assert.equal(calls, 2, "different original read identities never share a read proof");
});

test("a native read proof cannot substitute an origin, owner lease or copied checked identity", () => {
  const reference = fixture.readReference();
  const value = valueFor(reference);
  const owner = fixture.subject(fixture.declaration("awaited"));
  const contract = { kind: "expression", expression: reference, component: value.component };
  const base = { kind: "retained", reason: "owned-value", value, contract };
  for (const replacement of [
    { kind: "retained", reason: "retained-owner", owner },
    { kind: "retained", reason: "module-owner" },
    { kind: "transferred", operation: fixture.readCall(fixture.declaration("discarded")) },
    { kind: "scoped-borrowed", owner, region: fixture.source.ast.body(fixture.declaration("awaited")), mode: "shared" },
    { value: { ...value } },
    { contract: { kind: "declaration", declaration: fixture.declaration("identity"), component: value.component } },
  ]) {
    const reader = query({ retentionFor(request) {
      assert.equal(request.kind, "read-value", "invalid read proof never reverts to an origin proof");
      return { kind: "resolved", premises: [{ ...base, ...replacement }] };
    } });
    const selected = reader.forReference(reference);
    assert.equal(selected.kind, "unresolved", `invalid independent read ${replacement.kind ?? "identity"}`);
  }
});

test("unresolved and empty native reads are not discarded in favour of an owning origin", () => {
  const reference = fixture.readReference();
  for (const selection of [{ kind: "resolved", premises: [] },
    { kind: "unresolved", at: reference, reason: "actual native read lease remains unresolved", cause: { kind: "required-fact" } }]) {
    const reader = query({ retentionFor(request) {
      assert.equal(request.kind, "read-value", "a reported native read failure cannot trigger a second decision");
      return selection;
    } });
    const selected = reader.forReference(reference);
    assert.equal(selected.kind, "unresolved");
    assert.match(selected.reason, /nonempty native proof|actual native read lease/u);
  }
});

test("copied read binding tokens are rejected before a native ownership premise is requested", () => {
  const reader = query({ retentionFor() { assert.fail("a copied local descriptor is not an actual native read"); } });
  const selected = reader.forValue({ ...valueFor(referenceFor("awaited")) });
  assert.equal(selected.kind, "unresolved");
  assert.match(selected.reason, /original immutable local descriptor/u);
});
