import { ProgramWork } from "../../../packages/host/dist/ir-program/work.js";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import * as program from "../../../packages/host/dist/ir-program/index.js";
import * as facts from "../../../packages/host/dist/ir-facts/index.js";
import { artifactBindingsKey, declaredExecutionKey, executionKey } from "../../../packages/host/dist/ir-types/index.js";
import { nativeFactsKey } from "../../../packages/host/dist/ir-types/index.js";
import { encodeContextKey, moduleFixture } from "../ir-program-fixtures.mjs";

const complete = result => {
  assert.equal(result.kind, "complete", "the actual verification invocation completed");
  return result.violations;
};
const rules = result => complete(result).map(row => row.rule);

export async function executionCases(suite) {
await suite.test("the Program retains the exact selected native record identity once without owning a second record", () => {
  const fixture = moduleFixture();
  assert.deepEqual(program.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [] });
  fixture.index.nativeFactsKey += "different-session-facts";
  assert.deepEqual(program.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [
    { rule: "native-facts-identity", site: { kind: "index" }, detail: [] },
  ] });
  for (const value of [undefined, ""]) {
    fixture.index.nativeFactsKey = value;
    assert.deepEqual(program.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [
      { rule: "native-facts-identity", site: { kind: "index" }, detail: [] },
    ] });
    assert.throws(() => program.verifyProgramIndex(fixture.index, { ...fixture.context, nativeFactsKey: value }),
      error => error instanceof TypeError && error.message === "Program verification requires the selected native facts identity");
  }
  for (const selectedNativeFacts of [undefined, null, { ...fixture.context.selectedNativeFacts, floatingFormats: undefined },
    { ...fixture.context.selectedNativeFacts, absentAccessFailure: "abort" }]) {
    assert.throws(() => program.verifyProgramIndex(fixture.index, { ...fixture.context, selectedNativeFacts }),
      error => error instanceof TypeError && error.message === "Program verification requires the matching selected native facts record");
  }
});

await suite.test("selected floating constants retain exact bits through publication and current codecs", () => {
  const fixture = moduleFixture();
  fixture.index.types.terms.push({ kind: "primitive", primitive: "float64" });
  const reference = { initializer: fixture.instance, context: "compile-time" };
  const bitsValues = [0n, 0x8000000000000000n, 0x3ff0000000000000n, 0x7ff0000000000000n,
    0xfff0000000000000n, 0x7ff8000000000001n, 0xfff8000000000002n, 0x7ff0000000000001n, 0xffffffffffffffffn];
  for (const bits of bitsValues) {
    fixture.index.constants = [{ reference, value: { kind: "floating", type: 1, bits } }];
    assert.deepEqual(program.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [] });
    const text = program.printProgramIndex(fixture.index);
    assert.equal(text.includes(`floating(type=t:1, bits=${bits}n)`), true);
    const parsed = program.parseProgramIndex(text);
    assert.equal(isDeepStrictEqual(parsed, { kind: "parsed", value: fixture.index }), true, "exact floating encoding round trip");
    const publication = { table: { terms: [fixture.index.types.terms[1], fixture.index.types.terms[0]],
      signatures: [{ ...fixture.index.types.signatures[0], result: 1 }] }, types: [1, 0], signatures: [0] };
    const published = program.canonicalizeProgram({ index: fixture.index, modules: [] }, publication);
    assert.deepEqual(published.index.constants[0].value, { kind: "floating", type: 0, bits });
    const old = text.replace(`bits=${bits}n`, `value=${bits}n`);
    assert.equal(program.parseProgramIndex(old).kind, "invalid-text");
    for (const malformed of [text.replace("floating(type=t:1", "floating(type=x:1"),
      text.replace(`bits=${bits}n)`, `bits=${bits}n;)`)]) {
      const result = program.parseProgramIndex(malformed);
      assert.equal(result.kind, "invalid-text");
      const offset = malformed.indexOf("floating(type=x:") !== -1 ? malformed.indexOf("type=x:", malformed.indexOf("floating(")) + 5
        : malformed.indexOf(";)", malformed.indexOf("floating("));
      assert.deepEqual(result, { kind: "invalid-text", offset, line: 1, column: offset + 1,
        expected: malformed[offset] === "x" ? ["t:"] : [")"], found: malformed[offset] });
    }
  }
});

await suite.test("floating publication distinguishes invalid encodings from missing genuine carrier evidence", () => {
  const fixture = moduleFixture();
  fixture.index.types.terms.push({ kind: "primitive", primitive: "float64" }, { kind: "primitive", primitive: "bool" });
  const reference = { initializer: fixture.instance, context: "compile-time" };
  const issue = { rule: "constant-floating-value", site: { kind: "body", instance: fixture.instance }, detail: [] };
  for (const bits of [-1n, 1n << 64n, undefined, 0]) {
    fixture.index.constants = [{ reference, value: { kind: "floating", type: 1, bits } }];
    assert.deepEqual(program.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [issue] });
  }
  fixture.index.constants = [{ reference, value: { kind: "floating", type: 2, bits: 0n } }];
  assert.deepEqual(program.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [issue] });
  fixture.index.constants = [{ reference, value: { kind: "floating", type: 0, bits: 0n } }];
  assert.throws(() => program.verifyProgramIndex(fixture.index, fixture.context),
    error => error instanceof TypeError && error.message === "Program floating constants require their actual selected native carrier");
  fixture.index.constants = [{ reference, value: { kind: "number", type: 1,
    value: { numerator: 1n, denominator: 1n, negativeZero: false } } }];
  assert.deepEqual(program.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [issue] });
  fixture.index.constants = [{ reference, value: { kind: "floating", type: 999, bits: 0n } }];
  assert.deepEqual(program.verifyProgramIndex(fixture.index, fixture.context),
    { kind: "complete", violations: [{ rule: "constant-type-resolves", site: { kind: "body", instance: fixture.instance }, detail: [{ kind: "number", value: 999 }] }] });
  const selectedNativeFacts = { ...fixture.context.selectedNativeFacts, floatingFormats: [] };
  const context = { ...fixture.context, selectedNativeFacts, nativeFactsKey: nativeFactsKey(selectedNativeFacts) };
  fixture.index.nativeFactsKey = context.nativeFactsKey;
  fixture.index.constants = [{ reference, value: { kind: "floating", type: 1, bits: 0n } }];
  assert.throws(() => program.verifyProgramIndex(fixture.index, context),
    error => error instanceof TypeError && error.message === "Program floating constants require the selected carrier format");
  const supplied = { ...selectedNativeFacts, floatingFormats: [{ carrier: "float64", interchange: "ieee754-binary16",
    nanSignObservable: false, nanPayloadObservable: false, signalingNaNObservable: false }] };
  const suppliedContext = { ...context, selectedNativeFacts: supplied, nativeFactsKey: nativeFactsKey(supplied) };
  fixture.index.nativeFactsKey = suppliedContext.nativeFactsKey;
  fixture.index.constants[0].value.bits = 0xffffn;
  assert.deepEqual(program.verifyProgramIndex(fixture.index, suppliedContext), { kind: "complete", violations: [] });
  fixture.index.constants[0].value.bits = 0x10000n;
  assert.deepEqual(program.verifyProgramIndex(fixture.index, suppliedContext), { kind: "complete", violations: [issue] });
});

await suite.test("Program codec rejects the former complete index that omitted selected native identity", () => {
  const fixture = moduleFixture();
  const current = program.printProgramIndex(fixture.index);
  const removed = current.slice(0, current.lastIndexOf(", nativeFactsKey=")) + ")\n";
  const result = program.parseProgramIndex(removed);
  assert.equal(result.kind, "invalid-text");
  assert.deepEqual(result.expected, [","]);
});

await suite.test("index and module verification share original carrier-read refusal and exact literal-base counts", () => {
  const literal = base => ({ kind: "literal", value: { kind: "number", value: { numerator: 1n, denominator: 1n, negativeZero: false } }, base });
  for (const [primitive, interchange, bits] of [["float16", "ieee754-binary16", 0xffffn],
    ["float32", "ieee754-binary32", 0xffffffffn], ["float64", "ieee754-binary64", 0xffffffffffffffffn]]) {
    for (const maximumWork of [0, 2, 3, 4]) {
      const fixture = moduleFixture();
      fixture.index.types.terms.push({ kind: "primitive", primitive }, literal(1), literal(2));
      const selectedNativeFacts = { ...fixture.context.selectedNativeFacts, floatingFormats: [{ carrier: primitive, interchange,
        nanSignObservable: true, nanPayloadObservable: true, signalingNaNObservable: true }] };
      fixture.context = { ...fixture.context, selectedNativeFacts, nativeFactsKey: nativeFactsKey(selectedNativeFacts),
        resources: program.createProgramVerificationWork({ ...ProgramWork.state(fixture.context.resources).limits, maximumWork }) };
      fixture.index.nativeFactsKey = fixture.context.nativeFactsKey;
      fixture.index.constants = [{ reference: { initializer: fixture.instance, context: "compile-time" },
        value: { kind: "floating", type: 3, bits } }];
      const result = program.verifyProgramIndex(fixture.index, fixture.context);
      assert.equal(Array.isArray(result), false, "the removed index array result is never returned");
      if (maximumWork >= 3) {
        assert.deepEqual(result, { kind: "complete", violations: [] });
        assert.equal(ProgramWork.state(fixture.context.resources).work, 3, "two literal-base rows and one primitive row");
      } else {
        assert.deepEqual(result, { kind: "resource-limit", site: { kind: "index" }, dimension: "work", maximum: maximumWork });
        assert.equal(ProgramWork.state(fixture.context.resources).work, maximumWork);
        assert.equal("violations" in result, false, "refusal publishes no partial earlier findings");
        const repeated = program.verifyProgramIndex(fixture.index, { ...fixture.context, selectedNativeFacts: undefined,
          tirOf: () => { throw new Error("No dependent reader after the original refusal"); } });
        assert.equal(repeated === result, true, "index entry retains the same first original stop before later readers");
        assert.equal(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context) === result, true);
        const another = { ...fixture.index, types: structuredClone(fixture.index.types) };
        assert.throws(() => program.verifyProgramIndex(another, fixture.context), /another published type table/u);
      }
    }
  }
  const invalid = moduleFixture();
  invalid.index.types.terms.push(literal(1));
  invalid.index.constants = [{ reference: { initializer: invalid.instance, context: "compile-time" }, value: { kind: "floating", type: 1, bits: 0n } }];
  assert.throws(() => program.verifyProgramIndex(invalid.index, invalid.context), /literal-base relation must be acyclic/u);
  invalid.index.types.terms[1].base = 2;
  assert.throws(() => program.verifyProgramIndex(invalid.index, invalid.context), /actual ready type domain/u);
  invalid.index.types.terms.length += 1;
  assert.throws(() => program.verifyProgramIndex(invalid.index, invalid.context), /IR text arrays must be dense/u);
  const missing = moduleFixture();
  missing.index.types.terms.length += 1;
  missing.index.constants = [{ reference: { initializer: missing.instance, context: "compile-time" }, value: { kind: "absence", type: 1 } }];
  assert.throws(() => program.verifyProgramIndex(missing.index, missing.context), /IR text arrays must be dense/u);
  const selected = moduleFixture();
  selected.index.types.terms.push({ kind: "string" }, literal(1));
  selected.index.constants = [{ reference: { initializer: selected.instance, context: "compile-time" }, value: { kind: "floating", type: 2, bits: 0n } }];
  assert.throws(() => program.verifyProgramIndex(selected.index, selected.context), /actual selected native carrier/u);
});

await suite.test("actual required execution inventory rejects duplicate and reversed keys without adding unselected entries", () => {
  for (const change of ["duplicate", "reverse"]) {
    const fixture = moduleFixture();
    const other = { instance: fixture.instance, provided: 1 };
    fixture.index.executions = change === "duplicate" ? [fixture.index.executions[0], fixture.index.executions[0]]
      : [other, fixture.index.executions[0]];
    const result = program.verifyProgramIndex(fixture.index, fixture.context);
    assert.equal(result.kind, "complete");
    const actual = result.violations.map(row => row.rule);
    assert.deepEqual(actual, change === "duplicate" ? ["executions-order", "execution-key-unique"] : ["executions-order"]);
  }
});

await suite.test("Facts artifact selection refuses duplicate executions and never reads another body as its template", () => {
  const fixture = moduleFixture();
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const selected = { kind: "facts", body: fixture.bodyId, provided: 0 };
  fixture.module.bodies[0].facts.push(structuredClone(fixture.module.bodies[0].facts[0]));
  assert.throws(() => program.instantiate(fixture.index, fixture.module, selected, bindings, ProgramWork.state(fixture.context.resources).limits),
    error => error instanceof TypeError && error.message === "Duplicate execution facts artifact");
  const other = moduleFixture("other.ts");
  assert.equal(program.instantiate(fixture.index, fixture.module, { ...selected, body: other.bodyId }, bindings,
    ProgramWork.state(fixture.context.resources).limits).kind, "missing-binding-artifact");
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
  assert.deepEqual(program.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [] });
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
    assert.equal(actual.kind, "complete");
    assert.equal(actual.violations.some(row => row.rule === "execution-entry-resolves"), true, String(provided));
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
    Object.assign(ProgramWork.state(fixture.context.resources).limits, { ...ProgramWork.state(fixture.context.resources).limits, [field]: 0 });
    const first = program.verifyModuleBodies(fixture.index, fixture.module, fixture.context);
    assert.deepEqual(first, { kind: "resource-limit", site: { kind: "index" }, dimension, maximum: 0 });
    assert.equal(ProgramWork.state(fixture.context.resources).seed.kind, "refused");
    const counters = [ProgramWork.state(fixture.context.resources).work, ProgramWork.state(fixture.context.resources).created];
    const second = program.verifyModuleBodies(fixture.index, { ...fixture.module, bodies: [] }, fixture.context);
    assert.equal(first === second, true, "same invocation retains its actual first refusal");
    assert.deepEqual([ProgramWork.state(fixture.context.resources).work, ProgramWork.state(fixture.context.resources).created], counters);
  }
});

await suite.test("successful same-invocation verification reuses its exact seed; independent invocations own fresh work", () => {
  const fixture = moduleFixture();
  assert.deepEqual(complete(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context)), []);
  const original = ProgramWork.state(fixture.context.resources).seed;
  const work = ProgramWork.state(fixture.context.resources).work;
  const created = ProgramWork.state(fixture.context.resources).created;
  assert.deepEqual(complete(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context)), []);
  assert.equal(ProgramWork.state(fixture.context.resources).seed === original, true);
  assert.equal(ProgramWork.state(fixture.context.resources).work, work, "empty observations and no metadata do not reseed");
  assert.equal(ProgramWork.state(fixture.context.resources).created, created);
  const other = moduleFixture();
  assert.deepEqual(complete(program.verifyModuleBodies(other.index, other.module, other.context)), []);
  assert.equal(ProgramWork.state(other.context.resources).seed !== original, true);
});

await suite.test("seed admission has exact shared work/record boundaries before any interner is constructed", () => {
  const work = 3 + 1 + 9 + 1;
  const created = 1 + 1 + 1;
  const exact = moduleFixture();
  Object.assign(ProgramWork.state(exact.context.resources).limits, { ...ProgramWork.state(exact.context.resources).limits, maximumWork: work, maximumCreatedRecords: created });
  assert.deepEqual(complete(program.verifyModuleBodies(exact.index, exact.module, exact.context)), []);
  assert.deepEqual([ProgramWork.state(exact.context.resources).work, ProgramWork.state(exact.context.resources).created], [work, created], "one intrinsic row+two fields, one signature row+nine fields, one result-reference record");
  assert.equal(ProgramWork.state(exact.context.resources).seed.kind, "seeded");
  for (const [field, value, dimension] of [["maximumWork", work - 1, "work"], ["maximumCreatedRecords", created - 1, "created-records"]]) {
    const fixture = moduleFixture();
    Object.assign(ProgramWork.state(fixture.context.resources).limits, { ...ProgramWork.state(fixture.context.resources).limits, [field]: value });
    assert.deepEqual(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context), {
      kind: "resource-limit", site: { kind: "index" }, dimension, maximum: value,
    });
    assert.equal(ProgramWork.state(fixture.context.resources).seed.kind, "refused");
    assert.equal("types" in ProgramWork.state(fixture.context.resources).seed, false, "a refused admission cannot contain even a partial seeded interner");
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
  ProgramWork.state(fixture.context.resources).limits.maximumWork = 0;
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

await suite.test("the opaque verification account starts at zero and validates expansion bounds before any seed", () => {
  const fresh = moduleFixture();
  assert.deepEqual([ProgramWork.state(fresh.context.resources).work, ProgramWork.state(fresh.context.resources).created], [0, 0]);
  assert.equal(ProgramWork.state(fresh.context.resources).seed.kind, "unseeded");
  assert.throws(() => program.verifyModuleBodies(fresh.index, fresh.module, {
    ...fresh.context, resources: { limits: ProgramWork.state(fresh.context.resources).limits, work: 0, created: 0, seed: { kind: "unseeded" } },
  }), TypeError, "the removed public counter record is not an account");
  for (const field of ["maximumDepth", "maximumVisits", "maximumUnionMembers", "maximumIntersectionMembers"]) {
    const fixture = moduleFixture();
    ProgramWork.state(fixture.context.resources).limits.typeExpansion = { ...ProgramWork.state(fixture.context.resources).limits.typeExpansion, [field]: NaN };
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
    const result = program.instantiate(fixture.index, fixture.module, { kind: "facts", body: fixture.bodyId, provided }, bindings, ProgramWork.state(fixture.context.resources).limits);
    assert.equal(result.kind, "instantiated", "constructed artifact selector found its exact execution");
    assert.equal(result.artifact.kind, "facts");
    assert.equal(result.artifact.facts.execution.provided, provided);
    assert.equal(artifactBindingsKey(result.artifact.facts.execution.instance.bindings), artifactBindingsKey({ kind: "instantiated", bindings }));
  }
  assert.equal(program.instantiate(fixture.index, fixture.module, { kind: "facts", body: fixture.bodyId, provided: 1 }, bindings,
    ProgramWork.state(fixture.context.resources).limits).kind, "missing-binding-artifact", "no first-vector or default-zero selection");
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
  const result = program.instantiate(fixture.index, fixture.module, reference, bindings, ProgramWork.state(fixture.context.resources).limits);
  assert.equal(result.kind, "instantiated");
  assert.equal(isDeepStrictEqual(result.artifact.summary.key, { kind: "declared", execution: { request: { ...selected.execution.request,
    bindings: { kind: "instantiated", bindings } }, provided: 1 } }), true, "one complete selected endpoint plus the one supplied environment");
  for (const opposite of [{ ...reference, endpoint: "advertised" }, { ...reference, ordinal: 0 }, { ...reference, provided: 0 }]) {
    assert.equal(program.instantiate(fixture.index, fixture.module, opposite, bindings, ProgramWork.state(fixture.context.resources).limits).kind, "missing-binding-artifact");
  }
  const body = program.instantiate(fixture.index, fixture.module, { kind: "summary", target: "body", body: fixture.bodyId, provided: 0 }, bindings, ProgramWork.state(fixture.context.resources).limits);
  assert.equal(body.kind, "instantiated");
  assert.equal(body.artifact.summary.key.kind, "body");
  assert.equal(body.artifact.summary.key.execution.provided, 0);
  assert.equal(facts.parseSummary(facts.printSummary(result.artifact.summary)).kind, "parsed");
  assert.equal(facts.parseSummary('Summary(key=SummaryKey(definition=def:"removed", bindings=parametric()))').kind, "invalid-text", "obsolete declaration-only keys are rejected");
  fixture.index.summaries[1].bindingDependent = true;
  assert.equal(program.instantiate(fixture.index, fixture.module, reference, bindings, ProgramWork.state(fixture.context.resources).limits).kind,
    "missing-binding-artifact", "a binding-dependent template cannot substitute for the actual required computed summary");
});

}
