import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import * as program from "../../../packages/host/dist/ir-program/index.js";
import * as facts from "../../../packages/host/dist/ir-facts/index.js";
import { artifactBindingsKey, declaredExecutionKey, executionKey } from "../../../packages/host/dist/ir-types/index.js";
import { encodeContextKey, moduleFixture } from "../ir-program-fixtures.mjs";

const complete = result => {
  assert.equal(result.kind, "complete", "the actual verification invocation completed");
  return result.violations;
};
const rules = result => complete(result).map(row => row.rule);

export async function executionCases(suite) {
await suite.test("actual required execution inventory rejects duplicate and reversed keys without adding unselected entries", () => {
  for (const change of ["duplicate", "reverse"]) {
    const fixture = moduleFixture();
    const other = { instance: fixture.instance, provided: 1 };
    fixture.index.executions = change === "duplicate" ? [fixture.index.executions[0], fixture.index.executions[0]]
      : [other, fixture.index.executions[0]];
    const actual = program.verifyProgramIndex(fixture.index, fixture.context).map(row => row.rule);
    assert.deepEqual(actual, change === "duplicate" ? ["executions-order", "execution-key-unique"] : ["executions-order"]);
  }
});

await suite.test("Facts artifact selection refuses duplicate executions and never reads another body as its template", () => {
  const fixture = moduleFixture();
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const selected = { kind: "facts", body: fixture.bodyId, provided: 0 };
  fixture.module.bodies[0].facts.push(structuredClone(fixture.module.bodies[0].facts[0]));
  assert.throws(() => program.instantiate(fixture.index, fixture.module, selected, bindings, fixture.context.resources.limits),
    error => error instanceof TypeError && error.message === "Duplicate execution facts artifact");
  const other = moduleFixture("other.ts");
  assert.equal(program.instantiate(fixture.index, fixture.module, { ...selected, body: other.bodyId }, bindings,
    fixture.context.resources.limits).kind, "missing-binding-artifact");
});

await suite.test("declared summary publication rewrites complete binding values without changing endpoint or entry", () => {
  const fixture = moduleFixture();
  fixture.index.types.terms.push({ kind: "string" });
  const parameter = { owner: fixture.definition, index: 0 };
  const bindings = { kind: "instantiated", bindings: { classBindings: [{ kind: "bound", parameter, type: 1 }],
    methodBindings: [], capturedBindings: [], selfBindings: [] } };
  const key = { kind: "declared", execution: { request: { definition: fixture.definition, endpoint: "api-signature", ordinal: 2, bindings }, provided: 1 } };
  const summary = { key, signature: 0, arena: { projections: [], producers: [], contexts: [], boundProducers: [],
    origins: [{ id: 0, kind: "complete", producers: [], includesAbsence: false }], boundaries: [] },
    parameters: [], captures: [], result: 0, thrown: 0, writes: [], retention: [], callbacks: [], invocationOnlyParameters: [],
    suspends: false, bindingDependent: false };
  fixture.index.summaries = [summary];
  const publication = { table: { terms: [{ kind: "string" }, { kind: "intrinsic", intrinsic: "void" }],
    signatures: [{ ...fixture.index.types.signatures[0], result: 1 }] }, types: [1, 0], signatures: [0] };
  const result = program.canonicalizeProgram({ index: fixture.index, modules: [fixture.module] }, publication);
  const expected = { kind: "declared", execution: { request: { ...key.execution.request,
    bindings: { ...bindings, bindings: { ...bindings.bindings, classBindings: [{ kind: "bound", parameter, type: 0 }] } } }, provided: 1 } };
  assert.equal(isDeepStrictEqual(result.index.summaries[0].key, expected), true, "structural publication retains the actual complete key");
});

await suite.test("execution-keyed publication keeps one TIR/MIR and its actual selected zero entry", () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = moduleFixture();
  assert.deepEqual(program.verifyProgramIndex(fixture.index, fixture.context), []);
  assert.deepEqual(complete(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context)), []);
  assert.deepEqual(fixture.index.executions, [{ instance: fixture.instance, provided: 0 }]);
  assert.equal(fixture.module.bodies.length, 1);
  assert.equal(fixture.module.bodies[0].facts.length, 1);
  const text = program.printModuleBodies(fixture.index, fixture.module);
  assert.equal(isDeepStrictEqual(program.parseModuleBodies(fixture.index, text), { kind: "parsed", value: fixture.module }), true, "whole current module document");
  const index = program.printProgramIndex(fixture.index);
  assert.equal(isDeepStrictEqual(program.parseProgramIndex(index), { kind: "parsed", value: fixture.index }), true, "whole current index document");
});

await suite.test("required execution inventory does not permit missing, duplicate or unselected facts", () => {
  for (const change of ["missing", "duplicate", "unselected"]) {
    const fixture = moduleFixture();
    const published = fixture.module.bodies[0];
    if (change === "missing") published.facts = [];
    else if (change === "duplicate") published.facts.push(structuredClone(published.facts[0]));
    else fixture.index.executions = [];
    assert.equal(rules(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context)).includes("facts-execution-total"), true, change);
  }
});

await suite.test("a mismatched Facts root is rejected without requesting an unprovided foreign typed artifact", () => {
  const fixture = moduleFixture();
  fixture.module.bodies[0].facts[0].execution = { instance: { body: fixture.bodyId, bindings: { kind: "instantiated", bindings: {
    classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [],
  } } }, provided: 0 };
  assert.equal(rules(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context)).includes("facts-execution-total"), true);
});

await suite.test("execution inventory count domains are total at malformed numeric opposites", () => {
  for (const provided of [-1, -0, 0.5, NaN, Infinity, -Infinity]) {
    const fixture = moduleFixture();
    fixture.index.executions[0].provided = provided;
    const actual = program.verifyProgramIndex(fixture.index, fixture.context);
    assert.equal(actual.some(row => row.rule === "execution-entry-resolves"), true, String(provided));
  }
});

await suite.test("selected count is an actual MIR entry, never an ordinal or omitted zero", () => {
  const fixture = moduleFixture();
  fixture.index.executions[0].provided = 1;
  fixture.module.bodies[0].facts[0].execution.provided = 1;
  fixture.answers.set(encodeContextKey(["arenaOf", { kind: "body", execution: { instance: fixture.instance, provided: 1 } }]), fixture.module.bodies[0].facts[0].arena);
  const actual = rules(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context));
  assert.equal(actual.includes("execution-entry-resolves"), true);
  assert.equal(actual.includes("facts-valid"), true);
});

await suite.test("complete execution keys distinguish provided counts, endpoints, ordinals and binding artifact kinds", () => {
  const fixture = moduleFixture();
  assert.notEqual(executionKey({ instance: fixture.instance, provided: 0 }), executionKey({ instance: fixture.instance, provided: 1 }));
  const request = { definition: fixture.definition, endpoint: "api-signature", ordinal: 0, bindings: { kind: "parametric" } };
  const selected = { request, provided: 0 };
  const variants = [{ request, provided: 1 }, { request: { ...request, endpoint: "advertised" }, provided: 0 },
    { request: { ...request, ordinal: 1 }, provided: 0 }, { request: { ...request,
      bindings: { kind: "instantiated", bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } } }, provided: 0 }];
  for (const opposite of variants) assert.notEqual(declaredExecutionKey(selected), declaredExecutionKey(opposite));
});

await suite.test("static observations have one separate instance document without a flow context or BodyFacts member", () => {
  const fixture = moduleFixture();
  const published = fixture.module.bodies[0];
  const text = facts.printObservations(published.observations);
  assert.deepEqual(facts.parseObservations(text), { kind: "parsed", value: published.observations });
  assert.equal("observations" in published.facts[0], false);
  const bodyText = facts.printFacts(published.facts[0]);
  assert.equal(facts.parseFacts(bodyText.replace("rawLocations=[]", "observations=[], rawLocations=[]")).kind, "invalid-text");
});

await suite.test("type seed work refusal is sticky and rooted at the actual index without constructing an interner", () => {
  for (const [field, dimension] of [["maximumWork", "work"], ["maximumCreatedRecords", "created-records"]]) {
    const fixture = moduleFixture();
    fixture.context.resources.limits = { ...fixture.context.resources.limits, [field]: 0 };
    const first = program.verifyModuleBodies(fixture.index, fixture.module, fixture.context);
    assert.deepEqual(first, { kind: "resource-limit", site: { kind: "index" }, dimension, maximum: 0 });
    assert.equal(fixture.context.resources.seed.kind, "refused");
    const counters = [fixture.context.resources.work, fixture.context.resources.created];
    const second = program.verifyModuleBodies(fixture.index, { ...fixture.module, bodies: [] }, fixture.context);
    assert.equal(first === second, true, "same invocation retains its actual first refusal");
    assert.deepEqual([fixture.context.resources.work, fixture.context.resources.created], counters);
  }
});

await suite.test("successful same-invocation verification reuses its exact seed; independent invocations own fresh work", () => {
  const fixture = moduleFixture();
  assert.deepEqual(complete(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context)), []);
  const original = fixture.context.resources.seed;
  const work = fixture.context.resources.work;
  const created = fixture.context.resources.created;
  assert.deepEqual(complete(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context)), []);
  assert.equal(fixture.context.resources.seed === original, true);
  assert.equal(fixture.context.resources.work, work, "empty observations and no metadata do not reseed");
  assert.equal(fixture.context.resources.created, created);
  const other = moduleFixture();
  assert.deepEqual(complete(program.verifyModuleBodies(other.index, other.module, other.context)), []);
  assert.equal(other.context.resources.seed !== original, true);
});

await suite.test("seed admission has exact shared work/record boundaries before any interner is constructed", () => {
  const work = 3 + 1 + 9 + 1;
  const created = 1 + 1 + 1;
  const exact = moduleFixture();
  exact.context.resources.limits = { ...exact.context.resources.limits, maximumWork: work, maximumCreatedRecords: created };
  assert.deepEqual(complete(program.verifyModuleBodies(exact.index, exact.module, exact.context)), []);
  assert.deepEqual([exact.context.resources.work, exact.context.resources.created], [work, created], "one intrinsic row+two fields, one signature row+nine fields, one result-reference record");
  assert.equal(exact.context.resources.seed.kind, "seeded");
  for (const [field, value, dimension] of [["maximumWork", work - 1, "work"], ["maximumCreatedRecords", created - 1, "created-records"]]) {
    const fixture = moduleFixture();
    fixture.context.resources.limits = { ...fixture.context.resources.limits, [field]: value };
    assert.deepEqual(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context), {
      kind: "resource-limit", site: { kind: "index" }, dimension, maximum: value,
    });
    assert.equal(fixture.context.resources.seed.kind, "refused");
    assert.equal("types" in fixture.context.resources.seed, false, "a refused admission cannot contain even a partial seeded interner");
  }
});

await suite.test("a seed cannot be reused for another published table even when its rows compare equal", () => {
  const fixture = moduleFixture();
  complete(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context));
  const other = { ...fixture.index, types: structuredClone(fixture.index.types) };
  assert.throws(() => program.verifyModuleBodies(other, fixture.module, fixture.context), /another published type table/u);
});

await suite.test("the same invocation preserves its original refused stop at the owning handoff", async () => {
  const { refuseVerification } = await import("../../../packages/host/dist/ir-program/verification-work.js");
  const fixture = moduleFixture();
  fixture.context.resources.limits.maximumWork = 0;
  const original = program.verifyModuleBodies(fixture.index, fixture.module, fixture.context);
  assert.equal(original.kind, "resource-limit");
  assert.equal(refuseVerification(fixture.index, fixture.context.resources, {
    kind: "resource-limit", site: { kind: "index" }, dimension: "created-records", maximum: 0,
  }) === original, true, "the first actual failure wins over a later handoff");
  assert.throws(() => refuseVerification({ ...fixture.index, types: structuredClone(fixture.index.types) },
    fixture.context.resources, original), /another published type table/u);
});

await suite.test("a required execution never invents the first MIR entry when the entry inventory is empty", () => {
  const fixture = moduleFixture();
  fixture.module.bodies[0].mir.entries = [];
  assert.equal(rules(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context)).includes("execution-entry-resolves"), true);
});

await suite.test("verification validates actual initial counter and expansion bounds before any seed", () => {
  for (const field of ["work", "created"]) for (const invalid of [-1, -0, 0.5, NaN, Infinity]) {
    const fixture = moduleFixture();
    fixture.context.resources[field] = invalid;
    assert.throws(() => program.verifyModuleBodies(fixture.index, fixture.module, fixture.context), /resource counters/u);
    assert.equal(fixture.context.resources.seed.kind, "unseeded");
  }
  for (const field of ["maximumDepth", "maximumVisits", "maximumUnionMembers", "maximumIntersectionMembers"]) {
    const fixture = moduleFixture();
    fixture.context.resources.limits.typeExpansion = { ...fixture.context.resources.limits.typeExpansion, [field]: NaN };
    assert.throws(() => program.verifyModuleBodies(fixture.index, fixture.module, fixture.context), /Invalid InstantiationLimits/u);
  }
});

await suite.test("Facts artifact selection keeps actual provided count independent from the single requested binding environment", () => {
  const fixture = moduleFixture();
  const published = fixture.module.bodies[0];
  const zero = published.facts[0];
  const two = structuredClone(zero);
  two.execution.provided = 2;
  published.facts = [two, zero];
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  for (const provided of [0, 2]) {
    const result = program.instantiate(fixture.index, fixture.module, { kind: "facts", body: fixture.bodyId, provided }, bindings, fixture.context.resources.limits);
    assert.equal(result.kind, "instantiated", "constructed artifact selector found its exact execution");
    assert.equal(result.artifact.kind, "facts");
    assert.equal(result.artifact.facts.execution.provided, provided);
    assert.equal(artifactBindingsKey(result.artifact.facts.execution.instance.bindings), artifactBindingsKey({ kind: "instantiated", bindings }));
  }
  assert.equal(program.instantiate(fixture.index, fixture.module, { kind: "facts", body: fixture.bodyId, provided: 1 }, bindings,
    fixture.context.resources.limits).kind, "missing-binding-artifact", "no first-vector or default-zero selection");
});

await suite.test("Summary artifact selectors retain target, endpoint, ordinal and provided count with only one binding authority", () => {
  const fixture = moduleFixture();
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const arena = { projections: [], producers: [], contexts: [], boundProducers: [], origins: [{ id: 0, kind: "complete", producers: [], includesAbsence: false }], boundaries: [] };
  const common = { signature: 0, arena, parameters: [], captures: [], result: 0, thrown: 0, writes: [], retention: [], callbacks: [],
    invocationOnlyParameters: [], suspends: false, bindingDependent: false };
  const selected = { kind: "declared", execution: { request: { definition: fixture.definition, endpoint: "api-signature", ordinal: 2,
    bindings: { kind: "parametric" } }, provided: 1 } };
  fixture.index.summaries = [{ ...common, key: { kind: "body", execution: { instance: fixture.instance, provided: 0 } } }, { ...common, key: selected }];
  const reference = { kind: "summary", target: "declared", definition: fixture.definition, endpoint: "api-signature", ordinal: 2, provided: 1 };
  const result = program.instantiate(fixture.index, fixture.module, reference, bindings, fixture.context.resources.limits);
  assert.equal(result.kind, "instantiated");
  assert.equal(isDeepStrictEqual(result.artifact.summary.key, { kind: "declared", execution: { request: { ...selected.execution.request,
    bindings: { kind: "instantiated", bindings } }, provided: 1 } }), true, "one complete selected endpoint plus the one supplied environment");
  for (const opposite of [{ ...reference, endpoint: "advertised" }, { ...reference, ordinal: 0 }, { ...reference, provided: 0 }]) {
    assert.equal(program.instantiate(fixture.index, fixture.module, opposite, bindings, fixture.context.resources.limits).kind, "missing-binding-artifact");
  }
  const body = program.instantiate(fixture.index, fixture.module, { kind: "summary", target: "body", body: fixture.bodyId, provided: 0 }, bindings, fixture.context.resources.limits);
  assert.equal(body.kind, "instantiated");
  assert.equal(body.artifact.summary.key.kind, "body");
  assert.equal(body.artifact.summary.key.execution.provided, 0);
  assert.equal(facts.parseSummary(facts.printSummary(result.artifact.summary)).kind, "parsed");
  assert.equal(facts.parseSummary('Summary(key=SummaryKey(definition=def:"removed", bindings=parametric()))').kind, "invalid-text", "obsolete declaration-only keys are rejected");
  fixture.index.summaries[1].bindingDependent = true;
  assert.equal(program.instantiate(fixture.index, fixture.module, reference, bindings, fixture.context.resources.limits).kind,
    "missing-binding-artifact", "a binding-dependent template cannot substitute for the actual required computed summary");
});

}
