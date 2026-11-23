import { createAccount, remainingWork, accountFailure, refuseAccount, chargeWork } from "../../../packages/host/dist/dataflow/index.js";
import { programTypeWork, verificationTypes } from "../../../packages/host/dist/ir-program/verification-work.js";
import { createInstantiationMeter, ProgramWork } from "../../../packages/host/dist/ir-program/work.js";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import * as program from "../../../packages/host/dist/ir-program/index.js";
import * as facts from "../../../packages/host/dist/ir-facts/index.js";
import { admitTypeTable, artifactBindingsKey, declaredExecutionKey, executionKey, viewTypes } from "../../../packages/host/dist/ir-types/index.js";
import { nativeFactsKey } from "../../../packages/host/dist/ir-types/index.js";
import { pairedModuleFixture, encodeContextKey, moduleFixture } from "../ir-program-fixtures.mjs";
import { loadFrontFixture } from "./front/checked-module.mjs";

import { publicationFixture } from "./program-publication.mjs";
import { typeParameterDeclaration } from "./type-parameter-declarations.mjs";

const complete = result => {
  assert.equal(result.kind, "complete", "the actual verification invocation completed");
  return result.violations;
};
const rules = result => complete(result).map(row => row.rule);

export function projectFixtureProgram(source, publication) {
  const resources = program.createProgramVerificationWork({
    maximumCreatedRecords: 1000000, maximumBindingVectorsPerArtifact: 64,
    typeExpansion: { maximumDepth: 40, maximumVisits: 1000000, maximumUnionMembers: 1000000, maximumIntersectionMembers: 1000000 },
  }, createAccount({ maximumWork: 1000000, maximumResultEntries: 1000000 }));
  const result = program.canonicalizeProgram(source, publication, resources, { kind: "data-only" });
  assert.equal(result.kind, "complete");
  return result.value;
}
const voidSeedWork = 5 + (2 + 3 + 11) + (3 + 10) + (44 + 2 + 4 * 3 + 3 * 10) + (2 + 3 + 10);
const voidSeedRecords = 5 + 3 + (44 + 10) + 3;

export async function executionCases(suite) {
await suite.test("Program borrows the enclosing account and preserves its original refusal across all verification entries", () => {
  const fixture = publicationFixture();
  const account = createAccount({ maximumWork: 7, maximumResultEntries: 10 });
  fixture.context.resources = program.createProgramVerificationWork(ProgramWork.state(fixture.context.resources).limits, account);
  assert.equal(chargeWork(account, 7), null);
  const original = chargeWork(account, 1);
  assert.equal(accountFailure(account), original);
  assert.equal(program.verifyProgramIndex(fixture.index, fixture.context), original);
  assert.equal(program.verifyModuleBodies(fixture.index, null, fixture.context), original);
  assert.throws(() => program.verifyProgramIndex({ ...fixture.index, types: structuredClone(fixture.index.types) }, fixture.context), /another published type table/u);
  const next = publicationFixture();
  const second = ProgramWork.state(next.context.resources).account;
  const refusal = { kind: "refused", diagnostics: [] };
  refuseAccount(second, refusal);
  assert.equal(program.verifyModuleBodies(next.index, null, next.context), refusal);
  assert.equal(program.verifyProgramIndex(next.index, next.context), refusal);
});

await suite.test("Program index distinguishes failed initialization effects from the first limit stop", async () => {
  const { InvocationAccount } = await import("../../../packages/host/dist/dataflow/account.js");
  const { programLookup } = await import("../../../packages/host/dist/ir-program/program-values.js");
  const { verifyInitializationEffects } = await import("../../../packages/host/dist/ir-program/verify-initialization.js");
  const fixture = publicationFixture();
  const limits = ProgramWork.state(fixture.context.resources).limits;
  const allowance = { maximumWork: 100000, maximumResultEntries: 100000 };
  const lookup = programLookup(fixture.index);
  const plan = fixture.index.initialization;
  const proof = account => verifyInitializationEffects(plan, lookup, { account, eventCount: 0,
    maximumConditionAlternatives: fixture.context.facts.limits.maximumConditionAlternatives, refusal: fixture.context.conditionRefusal });
  const measuredProof = createAccount(allowance);
  assert.deepEqual(proof(measuredProof), { kind: "complete", value: null });
  const measure = (bounds, index = fixture.index) => {
    const account = createAccount(bounds);
    const resources = program.createProgramVerificationWork(limits, account);
    const context = { ...fixture.context, resources };
    return { account, context, result: program.verifyProgramIndex(index, context) };
  };
  const full = measure(allowance);
  const verdict = { kind: "complete", violations: [] };
  assert.deepEqual(full.result, verdict);
  const required = InvocationAccount.stateOf(full.account);
  const effects = InvocationAccount.stateOf(measuredProof);
  for (const [field, dimension, total, withinProof] of [
    ["maximumWork", "work", required.work, effects.work],
    ["maximumResultEntries", "result-entries", required.entries, effects.entries],
  ]) {
    const prefix = total - withinProof;
    assert.equal(prefix > 0 && prefix < total, true);
    for (let maximum = prefix; maximum < total; maximum += 1) {
      const { account, context, result } = measure({ ...allowance, [field]: maximum });
      assert.deepEqual(result, { kind: "resource-limit", dimension, maximum });
      assert.equal(result === accountFailure(account), true);
      assert.equal(program.verifyProgramIndex(fixture.index, context) === result, true);
      assert.equal(program.verifyModuleBodies(fixture.index, fixture.module, context) === result, true);
    }
    assert.deepEqual(measure({ ...allowance, [field]: total }).result, verdict);
  }
  const scheduled = facts.summaryKey({ kind: "body", execution: plan.modules[0] });
  const summaries = fixture.index.summaries.filter(summary => facts.summaryKey(summary.key) !== scheduled);
  assert.equal(summaries.length, fixture.index.summaries.length - 1);
  assert.deepEqual(measure(allowance, { ...fixture.index, summaries }).result, { kind: "complete", violations: [
    { rule: "plan-initialized", site: { kind: "index" }, detail: [{ kind: "number", value: 0 }] },
  ] });
});

await suite.test("Program distinguishes actual template availability from the indexed execution record", () => {
  for (const change of ["selected-parametric", "template-instantiated", "index-availability", "missing-template"]) {
    const fixture = publicationFixture();
    if (change === "selected-parametric") fixture.selected.instance = fixture.template.instance;
    if (change === "template-instantiated") fixture.template.instance = fixture.selected.instance;
    if (change === "index-availability") fixture.index.bodies[0] = { ...fixture.index.bodies[0], kind: "selected",
      mirLocalCount: 0, mirConstantCount: 0, mirPlaceCount: 0, mirBlockCount: 1 };
    if (change === "missing-template") fixture.module.bodies.shift();
    const violations = complete(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context));
    if (change === "missing-template") {
      assert.equal(violations.some(row => row.rule === "tir-valid" && row.detail[0]?.value === "template-shared-once"), true);
    } else if (change === "index-availability") {
      const site = { kind: "body", instance: fixture.template.instance };
      assert.equal(violations.some(row => isDeepStrictEqual(row, { rule: "body-levels-total", site,
        detail: [{ kind: "text", value: "selected" }, { kind: "text", value: "template" }] })), true);
      const indexed = complete(program.verifyProgramIndex(fixture.index, fixture.context));
      assert.equal(indexed.some(row => isDeepStrictEqual(row, { rule: "body-instance-exact", site,
        detail: [{ kind: "text", value: "selected" }] })), true);
    } else {
      assert.equal(violations.some(row => row.rule === "body-instance-exact"), true, change);
    }
  }
});

await suite.test("the binding bound counts distinct vectors once and reports the first extra vector for each artifact", async () => {
  const { verifyBindingBounds } = await import("../../../packages/host/dist/ir-program/verify-structure.js");
  const fixture = publicationFixture();
  const maximumBindingVectorsPerArtifact = 1;
  const limits = { ...ProgramWork.state(fixture.context.resources).limits, maximumBindingVectorsPerArtifact };
  const context = { ...fixture.context, resources: program.createProgramVerificationWork(limits,
    createAccount({ maximumWork: 100000, maximumResultEntries: 100000 })) };
  const parameter = typeParameterDeclaration(fixture.definition, 0);
  const source = fixture.index.bodies[1];
  const instanceOf = type => ({ body: fixture.bodyId, bindings: { kind: "instantiated", bindings: {
    ...fixture.instance.bindings.bindings, methodBindings: [{ kind: "bound", parameter, type }],
  } } });
  const first = instanceOf(fixture.index.types.terms.length);
  const extra = instanceOf(fixture.index.types.terms.length + 1);
  const later = instanceOf(fixture.index.types.terms.length + 2);
  fixture.index.types.terms.push({ kind: "primitive", primitive: "bool" }, { kind: "string" }, { kind: "primitive", primitive: "int32" });
  const initial = { ...source, instance: first };
  const duplicate = { ...source, instance: structuredClone(first) };
  const seed = fixture.index.summaries.find(summary => summary.key.kind === "body" && summary.key.execution.instance === fixture.instance);
  assert.ok(seed);
  const summaryOf = (instance, provided) => ({ ...seed, key: { kind: "body", execution: { instance, provided } } });
  const matching = { ...fixture.index, bodies: [fixture.index.bodies[0], initial, duplicate],
    summaries: [summaryOf(first, 0), summaryOf(extra, 1)] };
  assert.deepEqual(verifyBindingBounds(matching, context), { kind: "complete", value: [] });
  const index = { ...matching, bodies: [...matching.bodies, { ...source, instance: extra }, { ...source, instance: later }],
    summaries: [...matching.summaries, summaryOf(extra, 0), summaryOf(later, 0)] };
  const detail = [{ kind: "number", value: 1 }, { kind: "number", value: 2 }];
  assert.deepEqual(verifyBindingBounds(index, context), { kind: "complete", value: [
    { rule: "binding-vectors-bounded", site: { kind: "body", instance: extra }, detail },
    { rule: "binding-vectors-bounded", site: { kind: "artifact", artifact: { kind: "summary", target: "body",
      body: fixture.bodyId, provided: 0 }, bindings: extra.bindings }, detail },
  ] });
});

await suite.test("binding cap findings pay the exact remaining account before publication", async () => {
  const { InvocationAccount } = await import("../../../packages/host/dist/dataflow/account.js");
  const fixture = publicationFixture();
  const limits = ProgramWork.state(fixture.context.resources).limits;
  const ample = { maximumWork: 100000, maximumResultEntries: 100000 };
  const verify = (maximumBindingVectorsPerArtifact, bounds) => {
    const account = createAccount(bounds);
    const resources = program.createProgramVerificationWork({ ...limits, maximumBindingVectorsPerArtifact }, account);
    const context = { ...fixture.context, resources };
    return { account, context, result: program.verifyProgramIndex(fixture.index, context) };
  };
  const baseline = verify(1, ample);
  assert.deepEqual(baseline.result, { kind: "complete", violations: [] });
  const { work, entries } = InvocationAccount.stateOf(baseline.account);
  const site = { kind: "body", instance: fixture.instance };
  const findings = [
    { rule: "binding-vectors-bounded", site, detail: [{ kind: "number", value: 0 }, { kind: "number", value: 1 }] },
    { rule: "binding-vectors-bounded", site: { kind: "artifact", artifact: { kind: "summary", target: "body",
      body: fixture.bodyId, provided: 0 }, bindings: fixture.instance.bindings },
    detail: [{ kind: "number", value: 0 }, { kind: "number", value: 1 }] },
  ];
  for (const [field, dimension, prefix, required] of [
    ["maximumWork", "work", work, work + 2],
    ["maximumResultEntries", "result-entries", entries, entries + 10],
  ]) {
    for (let maximum = prefix; maximum < required; maximum += 1) {
      const { account, result, context } = verify(0, { ...ample, [field]: maximum });
      assert.deepEqual(result, { kind: "resource-limit", dimension, maximum });
      assert.equal(result === accountFailure(account), true);
      assert.equal(program.verifyProgramIndex(fixture.index, context) === result, true);
      assert.equal(program.verifyModuleBodies(fixture.index, fixture.module, context) === result, true);
    }
    assert.deepEqual(verify(0, { ...ample, [field]: required }).result, { kind: "complete", violations: findings });
  }
});

await suite.test("the indexed metadata cap pays for its own newly retained artifact reference", async () => {
  const { verifyBindingBounds } = await import("../../../packages/host/dist/ir-program/verify-structure.js");
  const { metadataOperationFixture } = await import("./program-metadata.mjs");
  const { first, metadata } = metadataOperationFixture("size", "present", "layout");
  const index = { ...first.index, bodies: [], summaries: [] };
  const limits = { ...ProgramWork.state(first.context.resources).limits, maximumBindingVectorsPerArtifact: 0 };
  const verify = (maximumWork, maximumResultEntries) => {
    const account = createAccount({ maximumWork, maximumResultEntries });
    const resources = program.createProgramVerificationWork(limits, account);
    return { account, result: verifyBindingBounds(index, { ...first.context, resources }) };
  };
  const reference = { kind: "metadata", definition: metadata.key.definition };
  const expected = { rule: "binding-vectors-bounded", site: { kind: "artifact", artifact: reference, bindings: metadata.key.bindings },
    detail: [{ kind: "number", value: 0 }, { kind: "number", value: 1 }] };
  assert.deepEqual(verify(1, 6).result, { kind: "complete", value: [expected] });
  for (const [work, entries, dimension, maximum] of [[0, 6, "work", 0],
    ...Array.from({ length: 6 }, (_entry, count) => [1, count, "result-entries", count])]) {
    const { result, account } = verify(work, entries);
    assert.deepEqual(result, { kind: "resource-limit", dimension, maximum });
    assert.equal(result === accountFailure(account), true);
  }
});

await suite.test("the Program retains the exact selected native record identity once without owning a second record", () => {
  const fixture = publicationFixture();
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
  const fixture = publicationFixture();
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
    const published = projectFixtureProgram({ index: fixture.index, modules: [] }, publication);
    assert.deepEqual(published.index.constants[0].value, { kind: "floating", type: 0, bits });
    const old = text.replace(`bits=${bits}n`, `value=${bits}n`);
    assert.equal(program.parseProgramIndex(old).kind, "invalid-text");
    for (const malformed of [text.replace("floating(type=t:1", "floating(type=x:1"),
      text.replace(`bits=${bits}n)`, `bits=${bits}n;)`)]) {
      const result = program.parseProgramIndex(malformed);
      assert.equal(result.kind, "invalid-text");
      const offset = malformed.indexOf("floating(type=x:") !== -1 ? malformed.indexOf("type=x:", malformed.indexOf("floating(")) + 5
        : malformed.indexOf(";)", malformed.indexOf("floating("));
      const lines = malformed.slice(0, offset).split("\n");
      assert.deepEqual(result, { kind: "invalid-text", offset, line: lines.length, column: lines[lines.length - 1].length + 1,
        expected: malformed[offset] === "x" ? ["t:"] : [")"], found: malformed[offset] });
    }
  }
});

await suite.test("floating publication distinguishes invalid encodings from missing genuine carrier evidence", () => {
  const fixture = publicationFixture();
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

await suite.test("Program validates the native payload of an evaluated optional Float64 constant", async () => {
  const { analysisInput } = await import("./front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../../packages/host/dist/evaluate/index.js");
  const front = await loadFrontFixture();
  const input = analysisInput(front, "sdk-minimal",
    "export function present(value: number): number | undefined { return value; }");
  const checked = analyzeHostProgram(input);
  assert.equal(checked.kind, "ok", JSON.stringify(checked.diagnostics));
  const table = checked.value.index.types;
  const body = checked.value.modules.find(module => module.module === input.snapshot.entryPoint).bodies
    .find(body => body.kind === "selected" && body.tir.params.length === 1);
  const bits = 0x8000000000000000n;
  const result = evaluate({ types: table, typeOf: type => table.terms[type], signatureOf: signature => table.signatures[signature],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation }, body.instance, body.mir,
  [{ kind: "floating", type: body.tir.params[0].type.tsonic.type, bits }], "compile-time",
  { query: "constValue", key: [body.instance, "compile-time"] });
  assert.equal(result.kind, "done");
  assert.equal(result.value.kind, "ok");
  assert.deepEqual(result.value.value, { kind: "value", value: { kind: "floating", type: body.mir.result, bits } });
  const value = result.value.value.value;
  const optional = table.terms[value.type];
  assert.deepEqual(optional, { kind: "optional", value: body.tir.params[0].type.tsonic.type });
  const payload = table.terms[optional.value];
  assert.deepEqual(payload, { kind: "primitive", primitive: "float64" });

  const fixture = publicationFixture();
  const payloadType = fixture.index.types.terms.length;
  const optionalType = payloadType + 1;
  fixture.index.types.terms.push(payload, { ...optional, value: payloadType });
  const reference = { initializer: fixture.instance, context: "compile-time" };
  const constant = { reference, value: { ...value, type: optionalType } };
  fixture.index.constants = [constant];
  const expected = { kind: "complete", violations: [] };
  assert.deepEqual(program.verifyProgramIndex(fixture.index, fixture.context), expected);
  assert.deepEqual(program.parseProgramIndex(program.printProgramIndex(fixture.index)), { kind: "parsed", value: fixture.index });
  const limits = ProgramWork.state(fixture.context.resources).limits;
  const run = (constants, maximumWork) => {
    const account = createAccount({ maximumWork, maximumResultEntries: 1000000 });
    const resources = program.createProgramVerificationWork(limits, account);
    const index = { ...fixture.index, constants };
    const context = { ...fixture.context, resources };
    const checked = program.verifyProgramIndex(index, context);
    if (checked.kind !== "complete") {
      assert.equal(checked === accountFailure(account), true);
      assert.equal(program.verifyProgramIndex(index, context) === checked, true);
    }
    return { checked, work: maximumWork - remainingWork(account) };
  };
  const baseline = run([], 1000000);
  assert.deepEqual(baseline.checked, expected);
  const exact = baseline.work + 3;
  assert.deepEqual(run([constant], exact), { checked: expected, work: exact });
  for (let maximum = baseline.work; maximum < exact; maximum += 1) {
    assert.deepEqual(run([constant], maximum).checked, { kind: "resource-limit", dimension: "work", maximum });
  }
  const prefix = createAccount({ maximumWork: 1000000, maximumResultEntries: 1000000 });
  const prefixResources = program.createProgramVerificationWork(limits, prefix);
  assert.equal(verificationTypes(fixture.index, prefixResources).kind, "complete");
  assert.deepEqual(facts.verifyDependencyInventory(fixture.index.dependencyInventory, fixture.context.facts, prefix), expected);
  for (const summary of fixture.index.summaries)
    assert.deepEqual(facts.verifySummary(summary, fixture.context.facts, { account: prefix,
      conditionRefusal: fixture.context.conditionRefusal }), expected);
  const beforePayload = 1000000 - remainingWork(prefix) + 1;
  assert.deepEqual(run([constant], beforePayload).checked, { kind: "resource-limit", dimension: "work", maximum: beforePayload });
  assert.deepEqual(run([{ reference, value: { kind: "absence", type: optionalType } }], baseline.work),
    { checked: expected, work: baseline.work });
  const issue = { rule: "constant-floating-value", site: { kind: "body", instance: fixture.instance }, detail: [] };
  for (const value of [{ kind: "floating", type: optionalType, bits: 1n << 64n }, { kind: "number", type: optionalType,
    value: { numerator: 0n, denominator: 1n, negativeZero: true } }]) {
    fixture.index.constants = [{ reference, value }];
    assert.deepEqual(program.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [issue] });
  }
  const bool = fixture.index.types.terms.length;
  fixture.index.types.terms.push({ kind: "primitive", primitive: "bool" }, { kind: "optional", value: bool });
  const longer = run([], 1000000);
  assert.deepEqual(longer.checked, expected);
  assert.deepEqual(run([constant], longer.work + 2).checked,
    { kind: "resource-limit", dimension: "work", maximum: longer.work + 2 });
  assert.deepEqual(run([constant], longer.work + 3).checked, expected);
  assert.throws(() => run([{ ...constant, value: { ...constant.value, type: bool + 1 } }], 1000000),
    /Program floating constants require their actual selected native carrier/u);
  const malformed = { ...fixture.index, types: { ...fixture.index.types,
    terms: [...fixture.index.types.terms, { kind: "optional", value: 999 }] },
    constants: [{ ...constant, value: { ...constant.value, type: bool + 2 } }] };
  const unadmitted = { ...fixture.context, tirOf: () => assert.fail("unadmitted Types precede constant or TIR evidence"),
    resources: program.createProgramVerificationWork(limits, createAccount({ maximumWork: 1000000, maximumResultEntries: 1000000 })) };
  assert.deepEqual(program.verifyProgramIndex(malformed, unadmitted), { kind: "complete", violations: [{
    rule: "types-valid", site: { kind: "index" }, detail: [{ kind: "text", value: "type-reference" },
      { kind: "text", value: "type" }, { kind: "number", value: bool + 2 }, { kind: "text", value: "reference" },
      { kind: "number", value: 999 }],
  }] });
});

await suite.test("Program codec rejects the former complete index that omitted selected native identity", () => {
  const fixture = publicationFixture();
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
    for (const constantWork of [0, 2, 3, 4, 5]) {
      const fixture = publicationFixture();
      fixture.index.types.terms.push({ kind: "primitive", primitive }, literal(1), literal(2));
      const selectedNativeFacts = { ...fixture.context.selectedNativeFacts, floatingFormats: [{ carrier: primitive, interchange,
        nanSignObservable: true, nanPayloadObservable: true, signalingNaNObservable: true }] };
      const prefix = createAccount({ maximumWork: 1000000, maximumResultEntries: 1000000000 });
      assert.deepEqual(facts.verifyDependencyInventory(fixture.index.dependencyInventory, fixture.context.facts, prefix),
        { kind: "complete", violations: [] });
      for (const summary of fixture.index.summaries) {
        assert.deepEqual(facts.verifySummary(summary, fixture.context.facts, { account: prefix, conditionRefusal: fixture.context.conditionRefusal }),
          { kind: "complete", violations: [] });
      }
      const prefixWork = 1000000 - remainingWork(prefix);
      const planWork = 2 + 2 * (4 + fixture.instance.body.length) + (7 + fixture.instance.body.length);
      const extraTypeFields = 3 + 2 * 10;
      const typeAdmissionWork = voidSeedWork + 2 * (3 + extraTypeFields) + extraTypeFields + (41 + 3 + 4 * 3 + 8 * 10);
      assert.equal(fixture.index.signatures.length, 0);
      const sourceWork = fixture.index.bodies.reduce((total, { instance }) => {
        const { body, bindings } = instance;
        if (bindings.kind === "instantiated")
          assert.equal(Object.values(bindings.bindings).every(rows => rows.length === 0), true);
        return total + 1 + body.length + 1 + (bindings.kind === "instantiated" ? 1 : 0);
      }, 0);
      const maximumWork = typeAdmissionWork + prefixWork + sourceWork + constantWork + (constantWork >= 4 ? planWork : 0);
      fixture.context = { ...fixture.context, selectedNativeFacts, nativeFactsKey: nativeFactsKey(selectedNativeFacts),
        resources: program.createProgramVerificationWork(ProgramWork.state(fixture.context.resources).limits,
          createAccount({ maximumWork, maximumResultEntries: 1000000000 })) };
      fixture.index.nativeFactsKey = fixture.context.nativeFactsKey;
      fixture.index.constants = [{ reference: { initializer: fixture.instance, context: "compile-time" },
        value: { kind: "floating", type: 3, bits } }];
      const result = program.verifyProgramIndex(fixture.index, fixture.context);
      assert.equal(Array.isArray(result), false, "the removed index array result is never returned");
      if (constantWork >= 4) {
        assert.deepEqual(result, { kind: "complete", violations: [] });
        assert.equal((maximumWork - remainingWork(ProgramWork.state(fixture.context.resources).account)), typeAdmissionWork + prefixWork + sourceWork + 4 + planWork,
          "the paid type seed, inventories and summaries, two literal-base rows, one primitive row and one format row, then the exact plan");
      } else {
        assert.deepEqual(result, { kind: "resource-limit", dimension: "work", maximum: maximumWork });
        assert.equal((maximumWork - remainingWork(ProgramWork.state(fixture.context.resources).account)), maximumWork);
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
  const carrier = base => {
    const fixture = publicationFixture();
    fixture.index.types.terms.push(literal(base));
    fixture.index.constants = [{ reference: { initializer: fixture.instance, context: "compile-time" }, value: { kind: "floating", type: 1, bits: 0n } }];
    return fixture;
  };
  const cyclic = carrier(1);
  assert.throws(() => program.verifyProgramIndex(cyclic.index, cyclic.context), /literal-base relation must be acyclic/u);
  const unresolved = carrier(2);
  assert.deepEqual(complete(program.verifyProgramIndex(unresolved.index, unresolved.context)), [{
    rule: "types-valid", site: { kind: "index" }, detail: [{ kind: "text", value: "type-reference" },
      { kind: "text", value: "type" }, { kind: "number", value: 1 }, { kind: "text", value: "reference" }, { kind: "number", value: 2 }],
  }]);
  const sparse = carrier(2);
  sparse.index.types.terms.length += 1;
  assert.deepEqual(complete(program.verifyProgramIndex(sparse.index, sparse.context)), [{
    rule: "types-valid", site: { kind: "index" }, detail: [{ kind: "text", value: "type-reference" },
      { kind: "text", value: "type" }, { kind: "number", value: 2 }, { kind: "text", value: "terms" }],
  }]);
  const missing = publicationFixture();
  missing.index.types.terms.length += 1;
  missing.index.constants = [{ reference: { initializer: missing.instance, context: "compile-time" }, value: { kind: "absence", type: 1 } }];
  assert.deepEqual(program.verifyProgramIndex(missing.index, missing.context), { kind: "complete", violations: [{
    rule: "types-valid", site: { kind: "index" },
    detail: [{ kind: "text", value: "type-reference" }, { kind: "text", value: "type" },
      { kind: "number", value: 1 }, { kind: "text", value: "terms" }],
  }] });
  const unknown = publicationFixture();
  unknown.index.types.terms.push({ kind: "unregistered-type-kind" });
  assert.equal(unknown.index.types, unknown.context.facts.types);
  assert.deepEqual(complete(program.verifyProgramIndex(unknown.index, unknown.context)), [{
    rule: "types-valid", site: { kind: "index" }, detail: [{ kind: "text", value: "type-reference" },
      { kind: "text", value: "type" }, { kind: "number", value: 1 }, { kind: "text", value: "kind" }],
  }]);
  const selected = publicationFixture();
  selected.index.types.terms.push({ kind: "string" }, literal(1));
  selected.index.constants = [{ reference: { initializer: selected.instance, context: "compile-time" }, value: { kind: "floating", type: 2, bits: 0n } }];
  assert.throws(() => program.verifyProgramIndex(selected.index, selected.context), /actual selected native carrier/u);
});

await suite.test("the required operation inventory rejects duplicate full keys without imposing a second execution order", () => {
  const duplicate = publicationFixture();
  duplicate.index.dependencyInventory.operations.push(duplicate.index.dependencyInventory.operations[0]);
  const result = program.verifyProgramIndex(duplicate.index, duplicate.context);
  assert.equal(result.kind, "complete");
  assert.equal(result.violations.some(row => row.rule === "dependency-inventory-valid" && row.detail[0]?.value === "operation-unique"), true);
  const pair = pairedModuleFixture();
  const fixture = publicationFixture(pair.first);
  const second = publicationFixture({ ...pair.second, index: fixture.index });
  for (const [key, value] of second.answers) fixture.answers.set(key, value);
  fixture.index.dependencyInventory.operations.reverse();
  assert.deepEqual(program.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [] });
});

await suite.test("Facts artifact selection refuses duplicate executions and never reads another body as its template", () => {
  const fixture = publicationFixture();
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const selected = { kind: "facts", body: fixture.bodyId, provided: 0 };
  fixture.selected.facts.push(structuredClone(fixture.selected.facts[0]));
  assert.throws(() => program.instantiate(fixture.index, fixture.module, selected, bindings, { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 10000 }),
    error => error instanceof TypeError && error.message === "Duplicate execution facts artifact");
  const other = publicationFixture(moduleFixture("other.ts"));
  assert.equal(program.instantiate(fixture.index, fixture.module, { ...selected, body: other.bodyId }, bindings,
    { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 10000 }).kind, "missing-binding-artifact");
});

await suite.test("artifact borrowing keeps the qualified body and complete bindings of its actual payload", async () => {
  const { analysisInput } = await import("./front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const front = await loadFrontFixture();
  const input = analysisInput(front, "sdk-minimal", "export function first(value: boolean): boolean { return value; }\n"
    + "export function second(value: boolean): boolean { return !value; }");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [first, other] = module.bodies.filter(body => body.kind === "selected" && body.tir.params.length === 1);
  assert.notEqual(first.instance.body, other.instance.body);
  const { bindings } = first.instance.bindings;
  const different = { ...bindings, selfBindings: [{ kind: "bound", owner: other.tir.owner, type: first.tir.completion }] };
  const unrefused = [];
  for (const kind of ["tir", "mir", "facts"]) {
    const payload = body => kind === "facts" ? body.facts[0] : body[kind];
    const reference = { kind, body: first.instance.body, ...(kind === "facts" ? { provided: first.facts[0].execution.provided } : {}) };
    const chunk = value => ({ ...module, bodies: [{ ...first, [kind]: kind === "facts" ? [value] : value }] });
    const inEnvironment = (value, environment) => kind === "facts"
      ? { ...value, execution: { ...value.execution, instance: { ...value.execution.instance, bindings: environment } } }
      : { ...value, bindings: environment };
    const decodedEquivalent = inEnvironment(payload(first), { kind: "instantiated", bindings: structuredClone(bindings) });
    const found = program.instantiate(index, chunk(decodedEquivalent), reference, bindings, input.limits.instantiation);
    assert.equal(found.kind, "instantiated", kind);
    assert.equal((kind === "facts" ? found.artifact.facts : found.artifact.body) === decodedEquivalent, true);
    assert.equal(found.types === index.types || found.types.terms === index.types.terms
      || found.types.signatures === index.types.signatures, false);
    assert.deepEqual(found.types, index.types);
    const crossed = inEnvironment(payload(first), { kind: "instantiated", bindings: different });
    for (const [label, bad, requested] of [["body", payload(other), bindings],
      ["wrapper binding", crossed, bindings], ["payload binding", crossed, different],
      ["parametric payload", inEnvironment(payload(first), { kind: "parametric" }), bindings]]) {
      const result = program.instantiate(index, chunk(bad), reference, requested, input.limits.instantiation);
      if (!isDeepStrictEqual(result, { kind: "missing-binding-artifact", artifact: reference, bindings: requested }))
        unrefused.push([kind, label, result.kind]);
    }
  }
  assert.deepEqual(unrefused, []);
  const template = module.bodies.find(body => body.kind === "template" && body.instance.body === first.instance.body);
  assert.ok(template);
  const reference = { kind: "tir", body: first.instance.body };
  const compound = { ...module, bodies: [{ ...template, tir: first.tir }] };
  const selected = program.instantiate(index, compound, reference, bindings, input.limits.instantiation);
  assert.equal(isDeepStrictEqual(selected, { kind: "missing-binding-artifact", artifact: reference, bindings }), true,
    "a template cannot carry the selected body of another binding kind");
});

await suite.test("declared summary publication rewrites complete binding values without changing endpoint or entry", () => {
  const fixture = publicationFixture();
  fixture.index.types.terms.push({ kind: "string" });
  const parameter = { owner: fixture.definition, index: 0 };
  const bindings = { kind: "instantiated", bindings: { classBindings: [{ kind: "bound", parameter, type: 1 }],
    methodBindings: [], capturedBindings: [], selfBindings: [] } };
  const key = { kind: "declared", execution: { request: { definition: fixture.definition, endpoint: "api-signature", ordinal: 2, bindings }, provided: 1 } };
  const summary = { key, signature: 0, arena: { cells: [], projections: [], producers: [], contexts: [], boundProducers: [],
    origins: [{ id: 0, kind: "complete", producers: [], includesAbsence: false }], boundaries: [] },
    parameters: [], captures: [], result: 0, thrown: 0, writes: [], retention: [], callbacks: [], concurrentWrites: [], contentsOnReturn: [], contentsOnUnwind: [], returns: true, unwinds: false, initialization: { cells: [], events: [], conditions: [{ alternatives: [] }, { alternatives: [[]] }], points: [{ kind: "return" }], rows: [{ point: 0, cell: null, condition: 0 }] }, resultCells: [], backing: [],
    suspends: false, bindingDependent: false };
  fixture.index.summaries = [summary];
  const publication = { table: { terms: [{ kind: "string" }, { kind: "intrinsic", intrinsic: "void" }],
    signatures: [{ ...fixture.index.types.signatures[0], result: 1 }] }, types: [1, 0], signatures: [0] };
  const result = projectFixtureProgram({ index: fixture.index, modules: [fixture.module] }, publication);
  const expected = { kind: "declared", execution: { request: { ...key.execution.request,
    bindings: { ...bindings, bindings: { ...bindings.bindings, classBindings: [{ kind: "bound", parameter, type: 0 }] } } }, provided: 1 } };
  assert.equal(isDeepStrictEqual(result.index.summaries[0].key, expected), true, "structural publication retains the actual complete key");
});

await suite.test("execution-keyed publication keeps one TIR/MIR and its actual selected zero entry", () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = publicationFixture();
  assert.deepEqual(program.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [] });
  assert.deepEqual(complete(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context)), []);
  assert.deepEqual(fixture.index.dependencyInventory.operations, [{ kind: "body", execution: { instance: fixture.instance, provided: 0 } }]);
  assert.equal(fixture.module.bodies.length, 2);
  assert.equal(fixture.selected.facts.length, 1);
  const text = program.printModuleBodies(fixture.index, fixture.module);
  assert.equal(isDeepStrictEqual(program.parseModuleBodies(fixture.index, text), { kind: "parsed", value: fixture.module }), true, "whole current module document");
  const index = program.printProgramIndex(fixture.index);
  assert.equal(isDeepStrictEqual(program.parseProgramIndex(index), { kind: "parsed", value: fixture.index }), true, "whole current index document");
});

await suite.test("module verification borrows only the lookup of its exact successfully verified index", () => {
  const fixture = publicationFixture();
  const state = ProgramWork.state(fixture.context.resources);
  assert.equal(state.verifiedIndex, null);
  assert.deepEqual(complete(program.verifyProgramIndex(fixture.index, fixture.context)), []);
  const verified = state.verifiedIndex;
  assert.equal(verified.index, fixture.index);
  assert.deepEqual(verified.lookup.bodiesByModule.get(fixture.module.module), fixture.index.bodies);
  assert.deepEqual(complete(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context)), []);

  const other = { ...fixture.index, bodies: fixture.index.bodies.filter(body => body.kind === "template") };
  const finding = { rule: "body-levels-total", site: { kind: "body", instance: fixture.instance },
    detail: [{ kind: "text", value: fixture.module.module }] };
  assert.deepEqual(complete(program.verifyModuleBodies(other, fixture.module, fixture.context)), [finding]);
  assert.equal(state.verifiedIndex, verified);
  assert.equal(rules(program.verifyProgramIndex(other, fixture.context)).includes("execution-body-resolves"), true);
  assert.equal(state.verifiedIndex, null);
  assert.deepEqual(complete(program.verifyModuleBodies(other, fixture.module, fixture.context)), [finding]);
  assert.deepEqual(complete(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context)), []);
});

await suite.test("required execution inventory does not permit missing, duplicate or unselected facts", () => {
  for (const change of ["missing", "duplicate", "unselected"]) {
    const fixture = publicationFixture();
    const published = fixture.selected;
    if (change === "missing") published.facts = [];
    else if (change === "duplicate") published.facts.push(structuredClone(published.facts[0]));
    else fixture.index.dependencyInventory = { operations: [], dependencies: [], components: [] };
    assert.equal(rules(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context)).includes("facts-execution-total"), true, change);
  }
});

await suite.test("a mismatched Facts root is rejected without requesting an unprovided foreign typed artifact", () => {
  const fixture = publicationFixture();
  fixture.selected.facts[0].execution = { instance: fixture.template.instance, provided: 0 };
  assert.equal(rules(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context)).includes("facts-execution-total"), true);
});

await suite.test("execution inventory count domains are total at malformed numeric opposites", () => {
  for (const provided of [-1, -0, 0.5, NaN, Infinity, -Infinity]) {
    const fixture = publicationFixture();
    fixture.index.dependencyInventory.operations[0].execution.provided = provided;
    const actual = program.verifyProgramIndex(fixture.index, fixture.context);
    assert.equal(actual.kind, "complete");
    assert.equal(actual.violations.some(row => row.rule === "execution-entry-resolves"), true, String(provided));
  }
});

await suite.test("selected count is an actual MIR entry, never an ordinal or omitted zero", () => {
  const fixture = publicationFixture();
  fixture.index.dependencyInventory.operations[0].execution.provided = 1;
  fixture.selected.facts[0].execution.provided = 1;
  fixture.answers.set(encodeContextKey(["arenaOf", { kind: "body", execution: { instance: fixture.instance, provided: 1 } }]), fixture.selected.facts[0].arena);
  const actual = rules(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context));
  assert.equal(actual.includes("execution-entry-resolves"), true);
  assert.equal(actual.includes("facts-valid"), true);
});

await suite.test("complete execution keys distinguish provided counts, endpoints, ordinals and binding artifact kinds", () => {
  const fixture = publicationFixture();
  assert.notEqual(executionKey({ instance: fixture.instance, provided: 0 }), executionKey({ instance: fixture.instance, provided: 1 }));
  const request = { definition: fixture.definition, endpoint: "api-signature", ordinal: 0, bindings: { kind: "parametric" } };
  const selected = { request, provided: 0 };
  const variants = [{ request, provided: 1 }, { request: { ...request, endpoint: "advertised" }, provided: 0 },
    { request: { ...request, ordinal: 1 }, provided: 0 }, { request: { ...request,
      bindings: { kind: "instantiated", bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } } }, provided: 0 }];
  for (const opposite of variants) assert.notEqual(declaredExecutionKey(selected), declaredExecutionKey(opposite));
});

await suite.test("static observations have one separate instance document without a flow context or BodyFacts member", () => {
  const fixture = publicationFixture();
  const published = fixture.selected;
  const text = facts.printObservations(published.observations);
  assert.deepEqual(facts.parseObservations(text), { kind: "parsed", value: published.observations });
  assert.equal("observations" in published.facts[0], false);
  const bodyText = facts.printFacts(published.facts[0]);
  assert.equal(facts.parseFacts(bodyText.replace("rawLocations=[]", "observations=[], rawLocations=[]")).kind, "invalid-text");
});

await suite.test("type seed work refusal is sticky and rooted at the actual index without constructing an interner", () => {
  for (const [field, dimension] of [["maximumWork", "work"], ["maximumCreatedRecords", "created-records"]]) {
    const fixture = publicationFixture();
    fixture.context.resources = program.createProgramVerificationWork({ ...ProgramWork.state(fixture.context.resources).limits, ...(field === "maximumCreatedRecords" ? { maximumCreatedRecords: 0 } : {}) }, createAccount({ maximumWork: field === "maximumWork" ? 0 : 10000, maximumResultEntries: 10000 }));
    const first = program.verifyModuleBodies(fixture.index, fixture.module, fixture.context);
    assert.deepEqual(first, dimension === "work" ? { kind: "resource-limit", dimension, maximum: 0 } : { kind: "resource-limit", site: { kind: "index" }, dimension, maximum: 0 });
    assert.equal(ProgramWork.state(fixture.context.resources).seed.kind, "refused");
    const counters = [(10000 - remainingWork(ProgramWork.state(fixture.context.resources).account)), ProgramWork.state(fixture.context.resources).created];
    const second = program.verifyModuleBodies(fixture.index, { ...fixture.module, bodies: [] }, fixture.context);
    assert.equal(first === second, true, "same invocation retains its actual first refusal");
    assert.deepEqual([(10000 - remainingWork(ProgramWork.state(fixture.context.resources).account)), ProgramWork.state(fixture.context.resources).created], counters);
  }
});

await suite.test("successful same-invocation verification reuses its exact seed; independent invocations own fresh work", () => {
  const fixture = publicationFixture();
  assert.deepEqual(complete(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context)), []);
  const original = ProgramWork.state(fixture.context.resources).seed;
  const work = (10000 - remainingWork(ProgramWork.state(fixture.context.resources).account));
  const created = ProgramWork.state(fixture.context.resources).created;
  assert.deepEqual(complete(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context)), []);
  assert.equal(ProgramWork.state(fixture.context.resources).seed === original, true);
  assert.equal((10000 - remainingWork(ProgramWork.state(fixture.context.resources).account)) > work, true, "reverification charges its actual traversal while reusing the seed");
  assert.equal(ProgramWork.state(fixture.context.resources).created, created);
  const other = publicationFixture();
  assert.deepEqual(complete(program.verifyModuleBodies(other.index, other.module, other.context)), []);
  assert.equal(ProgramWork.state(other.context.resources).seed !== original, true);
});

await suite.test("seed admission has exact shared work/record boundaries before an interner is published", () => {
  const work = voidSeedWork;
  const created = voidSeedRecords;
  const exact = publicationFixture();
  exact.context.resources = program.createProgramVerificationWork({ ...ProgramWork.state(exact.context.resources).limits, maximumCreatedRecords: created }, createAccount({ maximumWork: work, maximumResultEntries: 10000 }));
  assert.equal(verificationTypes(exact.index, exact.context.resources).kind, "complete");
  assert.deepEqual([work - remainingWork(ProgramWork.state(exact.context.resources).account), ProgramWork.state(exact.context.resources).created], [work, created],
    "actual foreign intrinsic and signature, owned validation, closed graph and final ordinal checks");
  assert.equal(ProgramWork.state(exact.context.resources).seed.kind, "seeded");
  for (const [field, value, dimension] of [["maximumWork", work - 1, "work"], ["maximumCreatedRecords", created - 1, "created-records"]]) {
    const fixture = publicationFixture();
    fixture.context.resources = program.createProgramVerificationWork({ ...ProgramWork.state(fixture.context.resources).limits, ...(field === "maximumCreatedRecords" ? { maximumCreatedRecords: value } : {}) }, createAccount({ maximumWork: field === "maximumWork" ? value : 10000, maximumResultEntries: 10000 }));
    assert.deepEqual(verificationTypes(fixture.index, fixture.context.resources), dimension === "work"
      ? { kind: "resource-limit", dimension, maximum: value }
      : { kind: "resource-limit", site: { kind: "index" }, dimension, maximum: value });
    assert.equal(ProgramWork.state(fixture.context.resources).seed.kind, "refused");
    assert.equal("types" in ProgramWork.state(fixture.context.resources).seed, false, "a refused admission cannot contain even a partial seeded interner");
  }
  const unread = publicationFixture();
  Object.defineProperty(unread.index.types.terms, 0, { get: () => assert.fail("unpaid first type row") });
  unread.context.resources = program.createProgramVerificationWork(ProgramWork.state(unread.context.resources).limits,
    createAccount({ maximumWork: 5, maximumResultEntries: 10000 }));
  const stopped = verificationTypes(unread.index, unread.context.resources);
  assert.deepEqual(stopped, { kind: "resource-limit", dimension: "work", maximum: 5 });
  assert.equal(verificationTypes(unread.index, unread.context.resources) === stopped, true);
});

await suite.test("signature omission survives one paid seed admission and exact TIR borrowing", () => {
  const fixture = publicationFixture();
  const limits = ProgramWork.state(fixture.context.resources).limits;
  const seedWork = voidSeedWork + 6 * (6 + 1);
  const seedRecords = voidSeedRecords + 5;
  for (const acceptsOmission of [false, true]) {
    const parameter = { declaration: null, kind: "required", type: 0, passing: "by-value", initializer: null, acceptsOmission };
    const table = { terms: fixture.index.types.terms,
      signatures: [{ ...fixture.index.types.signatures[0], parameters: [parameter] }] };
    for (const maximumWork of [0, seedWork - 1, seedWork, seedWork + 1]) {
      const meter = createInstantiationMeter({ ...limits, maximumWork, maximumCreatedRecords: seedRecords });
      const result = admitTypeTable(table, programTypeWork(meter));
      if (maximumWork < seedWork) {
        assert.deepEqual(result, { kind: "resource-limit", dimension: "work", maximum: maximumWork });
        assert.equal(result === accountFailure(meter.account), true);
      } else {
        assert.equal(result.kind, "complete");
        assert.deepEqual(viewTypes(result.types), table);
        assert.equal(viewTypes(result.types).signatures[0].parameters[0] === parameter, false);
        assert.deepEqual([maximumWork - remainingWork(meter.account), meter.created], [seedWork, seedRecords]);
      }
    }
    const records = createInstantiationMeter({ ...limits, maximumWork: seedWork, maximumCreatedRecords: seedRecords - 1 });
    const stopped = admitTypeTable(table, programTypeWork(records));
    assert.deepEqual(stopped, { kind: "resource-limit", dimension: "created-records", maximum: seedRecords - 1 });
    assert.equal(admitTypeTable(table, programTypeWork(records)) === stopped, true);

    const unread = { ...table, signatures: [{ ...table.signatures[0], parameters: [{ ...parameter,
      get type() { return assert.fail("no parameter reference before the actual admission charge"); },
    }] }] };
    const beforeParameterReference = 5 + (1 + 3) + (1 + 11) + 6;
    const meter = createInstantiationMeter({ ...limits, maximumWork: beforeParameterReference, maximumCreatedRecords: seedRecords });
    assert.deepEqual(admitTypeTable(unread, programTypeWork(meter)),
      { kind: "resource-limit", dimension: "work", maximum: beforeParameterReference });

    const index = { ...fixture.index, types: table };
    const module = { ...fixture.module, bodies: [fixture.selected] };
    const artifact = { kind: "tir", body: fixture.instance.body };
    const { bindings } = fixture.instance.bindings;
    for (const maximumWork of [seedWork, seedWork + 1, seedWork + 2]) {
      const result = program.instantiate(index, module, artifact, bindings, { ...limits, maximumWork, maximumCreatedRecords: seedRecords });
      if (maximumWork < seedWork + 2) assert.deepEqual(result, { kind: "resource-limit", dimension: "work", maximum: maximumWork });
      else {
        assert.equal(result.kind, "instantiated");
        assert.equal(result.artifact.body === fixture.selected.tir, true);
        assert.deepEqual(result.types, table);
        assert.equal(result.types.signatures[0].parameters[0].acceptsOmission, acceptsOmission);
      }
    }
  }
});

await suite.test("stage admission restores the actual same-origin mapped index order without changing old IDs", async () => {
  const { substitute } = await import("../../../packages/host/dist/ir-types/index.js");
  const front = await loadFrontFixture();
  const snapshot = front.projectSnapshot({
    sourceFiles: { "main.ts": "export type Indexes = { [Key in string | number]: boolean };" },
    libraries: [{ name: "lib.es5.d.ts", text: front.sdk.barebonesLibContent }],
  });
  const { captured } = front.captureModulesOf(snapshot);
  const entry = captured.find(row => row.module === snapshot.entryPoint);
  assert.ok(entry);
  assert.deepEqual(entry.raw.checkerDiagnostics, []);
  const mapped = entry.raw.tree.statements.nodes[0].type;
  assert.equal(mapped.kind, "MappedType");
  const native = entry.raw.types.members.find(table => table.indexes.length === 2
    && table.indexes.every(index => index.origin.module === entry.module && index.origin.node === mapped.id));
  assert.ok(native);
  const origin = entry.definitions.sourceOccurrences.find(row => row.node === mapped.id)?.occurrence;
  assert.ok(origin);
  const scalar = identity => entry.raw.types.types[identity].form.value.scalar;
  assert.deepEqual(native.indexes.map(index => scalar(index.key)).sort(), ["number", "string"]);
  assert.equal(native.indexes.every(index => scalar(index.value) === "boolean" && !index.readonly), true);
  const fixture = publicationFixture();
  const limits = { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 10000, maximumCreatedRecords: 10000 };
  const parameter = typeParameterDeclaration(fixture.definition, 0);
  const numberKey = { kind: "primitive", primitive: "float64" };
  const stringKey = { kind: "string" };
  for (const keys of [[stringKey, numberKey], [numberKey, stringKey]]) {
    const row = key => ({ origin, key, read: 2, write: 2, readonly: false });
    const shape = { kind: "shape", members: [], indexes: [row(1), row(3)], calls: [], constructs: [] };
    const seed = { terms: [...keys, { kind: "primitive", primitive: "bool" }, { kind: "param", parameter }, shape], signatures: [] };
    const expected = { terms: [...seed.terms, { ...shape, indexes: [row(0), row(1)] }], signatures: [] };
    const bindings = { classBindings: [{ kind: "bound", parameter, type: 0 }], methodBindings: [], capturedBindings: [], selfBindings: [] };
    const attempt = (maximumWork, maximumCreatedRecords, complete) => {
      const original = admitTypeTable(seed, programTypeWork(createInstantiationMeter(limits)));
      assert.equal(original.kind, "complete");
      const held = viewTypes(original.types);
      const instructions = [...held.terms];
      const meter = createInstantiationMeter({ ...limits, maximumWork, maximumCreatedRecords });
      const account = programTypeWork(meter);
      const invoke = () => substitute(original.types, [4], bindings, limits.typeExpansion, account);
      const result = invoke();
      if (complete) {
        assert.deepEqual(result, { kind: "complete", value: [5] });
        assert.deepEqual(held, expected);
        assert.deepEqual(held.terms[5].indexes.map(index => index.key), [0, 1]);
      } else {
        const work = maximumWork < limits.maximumWork && maximumCreatedRecords === limits.maximumCreatedRecords;
        assert.deepEqual(result, { kind: "resource-limit", dimension: work ? "work" : "created-records",
          maximum: work ? maximumWork : maximumCreatedRecords });
        assert.equal(invoke() === result, true);
        assert.deepEqual(held, seed);
      }
      assert.equal(instructions.every((term, position) => term === held.terms[position]), true);
      return { work: maximumWork - remainingWork(meter.account), records: meter.created };
    };
    const exact = attempt(limits.maximumWork, limits.maximumCreatedRecords, true);
    assert.deepEqual(attempt(exact.work, exact.records, true), exact);
    for (let work = 0; work < exact.work; work++) attempt(work, limits.maximumCreatedRecords, false);
    for (let records = 0; records < exact.records; records++) attempt(limits.maximumWork, records, false);
  }
});

await suite.test("a seed cannot be reused for another published table even when its rows compare equal", () => {
  const fixture = publicationFixture();
  complete(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context));
  const other = { ...fixture.index, types: structuredClone(fixture.index.types) };
  assert.throws(() => program.verifyModuleBodies(other, fixture.module, fixture.context), /another published type table/u);
});

await suite.test("the same invocation preserves its original refused stop at the owning handoff", async () => {
  const { refuseVerification } = await import("../../../packages/host/dist/ir-program/verification-work.js");
  const fixture = publicationFixture();
  fixture.context.resources = program.createProgramVerificationWork(ProgramWork.state(fixture.context.resources).limits, createAccount({ maximumWork: 0, maximumResultEntries: 10000 }));
  const original = program.verifyModuleBodies(fixture.index, fixture.module, fixture.context);
  assert.equal(original.kind, "resource-limit");
  assert.equal(refuseVerification(fixture.index, fixture.context.resources, {
    kind: "resource-limit", site: { kind: "index" }, dimension: "created-records", maximum: 0,
  }) === original, true, "the first actual failure wins over a later handoff");
  assert.throws(() => refuseVerification({ ...fixture.index, types: structuredClone(fixture.index.types) },
    fixture.context.resources, original), /another published type table/u);
});

await suite.test("a required execution never invents the first MIR entry when the entry inventory is empty", () => {
  const fixture = publicationFixture();
  fixture.selected.mir.entries = [];
  assert.equal(rules(program.verifyModuleBodies(fixture.index, fixture.module, fixture.context)).includes("execution-entry-resolves"), true);
});

await suite.test("Program inventories only the two actual fields of a resolved native callee", async () => {
  const { analysisInput } = await import("./front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { createInstantiationMeter } = await import("../../../packages/host/dist/ir-program/work.js");
  const { createProjectionInventory, drainProjectionInventory, prepareInstance } = await import("../../../packages/host/dist/ir-program/program-values.js");
  const { prepareApplication, prepareCallee } = await import("../../../packages/host/dist/ir-program/instantiate-phase.js");
  const front = await loadFrontFixture();
  const input = analysisInput(front, "sdk-minimal", "export function leaf(value: boolean): boolean { return value; } "
    + "export function caller(value: boolean): boolean { return leaf(value); }");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const module = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const terminator = module.bodies.filter(body => body.kind === "selected")
    .flatMap(body => body.mir.blocks.map(block => block.terminator))
    .find(terminator => terminator.kind === "call" && terminator.callee.kind === "direct");
  assert.ok(terminator);
  const callee = terminator.callee.resolution;
  assert.notEqual(callee.activation, null);
  assert.equal(callee.activation.bindings.bindings === callee.decision.implementationBindings, true);
  assert.equal(module.bodies.some(body => body.kind === "selected" && isDeepStrictEqual(body.instance, callee.activation)), true);
  const identity = value => value;
  const lookup = { parameterBinding: identity, selfBinding: identity };
  const run = (visit, limits = input.limits.instantiation) => {
    const meter = createInstantiationMeter(limits);
    const scan = createProjectionInventory(meter, lookup, path => assert.fail(path));
    const stop = visit(scan) ?? drainProjectionInventory(scan);
    return { stop, work: limits.maximumWork - remainingWork(meter.account), created: meter.created };
  };
  const decision = run(scan => {
    const result = prepareApplication(scan, callee.decision);
    return result.kind === "refused" ? result.stop : null;
  });
  const independent = { ...callee, activation: structuredClone(callee.activation) };
  const different = run(scan => {
    const result = prepareInstance(scan, independent.activation, null);
    return result.kind === "refused" ? result.stop : null;
  });
  assert.equal(decision.stop, null);
  assert.equal(different.stop, null);
  const prepared = createProjectionInventory(createInstantiationMeter(input.limits.instantiation), lookup, path => assert.fail(path));
  const calleePlan = prepareCallee(prepared, callee, "transport");
  assert.equal(calleePlan.kind, "copied");
  assert.equal(drainProjectionInventory(prepared), null);
  const actual = calleePlan.value({ type: identity, signature: identity });
  assert.equal(isDeepStrictEqual(actual, callee), true);
  assert.equal(actual.activation.bindings.bindings === actual.decision.implementationBindings, true);
  const visit = source => scan => {
    const result = prepareCallee(scan, source, "transport");
    return result.kind === "refused" ? result.stop : null;
  };
  const work = decision.work + 3 + 3 + 3;
  const created = decision.created + 1 + 1 + 1;
  assert.deepEqual(run(visit(callee), { ...input.limits.instantiation, maximumWork: work, maximumCreatedRecords: created }),
    { stop: null, work, created });
  assert.deepEqual(run(visit(independent)), { stop: null, work: decision.work + different.work + 3,
    created: decision.created + different.created + 1 });
  const other = createProjectionInventory(createInstantiationMeter(input.limits.instantiation), lookup, path => assert.fail(path));
  const independentPlan = prepareCallee(other, independent, "transport");
  assert.equal(independentPlan.kind, "copied");
  assert.equal(drainProjectionInventory(other), null);
  const separate = independentPlan.value({ type: identity, signature: identity });
  assert.equal(isDeepStrictEqual(separate, actual), true);
  assert.equal(separate.activation.bindings.bindings === separate.decision.implementationBindings, false);
  for (const [field, dimension, required] of [["maximumWork", "work", work], ["maximumCreatedRecords", "created-records", created]]) {
    for (let maximum = 0; maximum < required; maximum += 1)
      assert.deepEqual(run(visit(callee), { ...input.limits.instantiation, [field]: maximum }).stop, { kind: "resource-limit", dimension, maximum });
  }
});

await suite.test("the opaque verification account starts at zero and validates expansion bounds before any seed", () => {
  const fresh = publicationFixture();
  assert.deepEqual([(10000 - remainingWork(ProgramWork.state(fresh.context.resources).account)), ProgramWork.state(fresh.context.resources).created], [0, 0]);
  assert.equal(ProgramWork.state(fresh.context.resources).seed.kind, "unseeded");
  assert.throws(() => program.verifyModuleBodies(fresh.index, fresh.module, {
    ...fresh.context, resources: { limits: ProgramWork.state(fresh.context.resources).limits, work: 0, created: 0, seed: { kind: "unseeded" } },
  }), TypeError, "the removed public counter record is not an account");
  for (const field of ["maximumDepth", "maximumVisits", "maximumUnionMembers", "maximumIntersectionMembers"]) {
    const fixture = publicationFixture();
    ProgramWork.state(fixture.context.resources).limits.typeExpansion = { ...ProgramWork.state(fixture.context.resources).limits.typeExpansion, [field]: NaN };
    assert.throws(() => program.verifyModuleBodies(fixture.index, fixture.module, fixture.context), /Invalid InstantiationLimits/u);
  }
});

await suite.test("Facts artifact selection keeps actual provided count independent from the single requested binding environment", () => {
  const fixture = publicationFixture();
  const published = fixture.selected;
  const zero = published.facts[0];
  const two = structuredClone(zero);
  two.execution.provided = 2;
  published.facts = [two, zero];
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  for (const provided of [0, 2]) {
    const result = program.instantiate(fixture.index, fixture.module, { kind: "facts", body: fixture.bodyId, provided }, bindings, { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 10000 });
    assert.equal(result.kind, "instantiated", "constructed artifact selector found its exact execution");
    assert.equal(result.artifact.kind, "facts");
    assert.equal(result.artifact.facts.execution.provided, provided);
    assert.equal(artifactBindingsKey(result.artifact.facts.execution.instance.bindings), artifactBindingsKey({ kind: "instantiated", bindings }));
  }
  assert.equal(program.instantiate(fixture.index, fixture.module, { kind: "facts", body: fixture.bodyId, provided: 1 }, bindings,
    { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 10000 }).kind, "missing-binding-artifact", "no first-vector or default-zero selection");
});

await suite.test("standalone Program instantiation does not replay a complete deferred return at its owner boundary", async () => {
  const { wt5 } = await import("./lower-mir/programs/more.mjs");
  const { PARAMETRIC, T, TABLE } = await import("./lower-mir/typed.mjs");
  const { deferred } = wt5();
  const fixture = publicationFixture();
  const tir = { ...deferred.tir, bindings: PARAMETRIC };
  const instance = { body: tir.body, bindings: tir.bindings };
  const rawModule = { ...fixture.module, module: tir.root.origin.module, bodies: [{ kind: "template", instance, tir }] };
  const inner = TABLE.terms[T.inner];
  assert.equal(inner.kind, "shape");
  assert.equal(inner.members[0].origins.length > 0, true);
  const terms = TABLE.terms.map((term, position) => position === T.inner
    ? { ...inner, members: [{ ...inner.members[0], origins: [], readOrigins: [], writeOrigins: [] }, ...inner.members.slice(1)] }
    : term);
  const foreign = { ...fixture.index, types: { terms, signatures: TABLE.signatures } };
  const reference = { kind: "tir", body: instance.body };
  const bindings = tir.lexicalBindings;
  const limits = { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 100000, maximumCreatedRecords: 100000 };
  const rejected = program.instantiate(foreign, rawModule, reference, bindings, limits);
  assert.equal(rejected.kind, "refused");
  assert.deepEqual(rejected.diagnostics.map(row => [row.code.rendered, row.arguments]), [["TSONIC_PROGRAM_TYPE_TABLE_INVALID", [
    { kind: "text", value: "member-origins" }, { kind: "text", value: "type" }, { kind: "number", value: T.inner },
    { kind: "text", value: "members.origins" }, { kind: "number", value: 0 },
  ]]]);

  const types = [];
  const signatures = [];
  types[0] = 0;
  types[T.int32] = 1;
  types[T.unknown] = 2;
  signatures[0] = 0;
  signatures[tir.signature] = 1;
  const sourceSignature = TABLE.signatures[tir.signature];
  assert.equal(sourceSignature.result === T.int32 && sourceSignature.parameters[0].type === T.unknown, true);
  const table = { terms: [fixture.index.types.terms[0], TABLE.terms[T.int32], TABLE.terms[T.unknown]],
    signatures: [fixture.index.types.signatures[0], { ...sourceSignature, id: 1, result: 1,
      parameters: [{ ...sourceSignature.parameters[0], type: 2 }] }] };
  const authored = structuredClone(rawModule);
  const expression = authored.bodies[0].tir.root.statements.nodes[0].expression;
  const saved = expression.tsonic.conversion.deferred;
  assert.equal(saved.invocation.input, null);
  const occurrence = { body: tir.body, node: expression.id };
  const component = { kind: "body", value: occurrence };
  const dynamic = { kind: "dynamic" };
  const number = { kind: "known", category: "number" };
  const evidence = (type, category, numeric) => ({ type, component, category, numeric, sum: null, nominal: null, pointer: null });
  assert.equal(expression.tsonic.type, T.unknown);
  assert.equal(tir.completion, saved.result);
  saved.invocation.input = { context: { occurrence, origin: expression.origin, bindings }, role: "return",
    from: evidence(expression.tsonic.type, dynamic, null), to: evidence(tir.completion, number,
      { producer: occurrence, kind: "declared", category: number, authored: null }) };
  const remapped = projectFixtureProgram({ index: fixture.index, modules: [authored] }, { types, signatures, table });
  const [module] = remapped.modules;
  const mapped = module.bodies[0].tir;
  assert.equal(mapped.body, tir.body);
  assert.equal(mapped.signature, 1);
  assert.equal(mapped.dependence, "binding-dependent");
  assert.deepEqual(mapped.lexicalBindings, bindings);
  const before = expression.tsonic.conversion;
  const after = mapped.root.statements.nodes[0].expression.tsonic.conversion;
  assert.equal(before.kind, "deferred");
  assert.deepEqual(after, { kind: "deferred", deferred: { result: 1, invocation: { rule: "embed", input: {
    ...saved.invocation.input, from: { ...saved.invocation.input.from, type: 2 }, to: { ...saved.invocation.input.to, type: 1 },
  } } } });

  const meter = createInstantiationMeter(limits);
  assert.equal(admitTypeTable(table, programTypeWork(meter)).kind, "complete");
  const work = limits.maximumWork - remainingWork(meter.account);
  const invoke = maximumWork => program.instantiate(remapped.index, module, reference, bindings,
    { ...limits, maximumWork, maximumCreatedRecords: meter.created });
  const stopped = invoke(0);
  assert.deepEqual(stopped, { kind: "resource-limit", dimension: "work", maximum: 0 });
  assert.deepEqual(invoke(work), { kind: "resource-limit", dimension: "work", maximum: work });
  assert.deepEqual(invoke(work + 1), { kind: "missing-binding-artifact", artifact: reference, bindings });
});

await suite.test("Summary artifact selectors retain target, endpoint, ordinal and provided count with only one binding authority", () => {
  const fixture = publicationFixture();
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const arena = { cells: [], projections: [], producers: [], contexts: [], boundProducers: [], origins: [{ id: 0, kind: "complete", producers: [], includesAbsence: false }], boundaries: [] };
  const common = { signature: 0, arena, parameters: [], captures: [], result: 0, thrown: 0, writes: [], retention: [], callbacks: [],
    concurrentWrites: [], contentsOnReturn: [], contentsOnUnwind: [], returns: true, unwinds: false, initialization: { cells: [], events: [], conditions: [{ alternatives: [] }, { alternatives: [[]] }], points: [{ kind: "return" }], rows: [{ point: 0, cell: null, condition: 0 }] }, resultCells: [], backing: [], suspends: false, bindingDependent: false };
  const selected = { kind: "declared", execution: { request: { definition: fixture.definition, endpoint: "api-signature", ordinal: 2,
    bindings: { kind: "parametric" } }, provided: 1 } };
  fixture.index.summaries = [{ ...common, key: { kind: "body", execution: { instance: fixture.instance, provided: 0 } } }, { ...common, key: selected }];
  const reference = { kind: "summary", target: "declared", definition: fixture.definition, endpoint: "api-signature", ordinal: 2, provided: 1 };
  const result = program.instantiate(fixture.index, fixture.module, reference, bindings, { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 10000 });
  assert.equal(result.kind, "instantiated");
  assert.equal(isDeepStrictEqual(result.artifact.summary.key, { kind: "declared", execution: { request: { ...selected.execution.request,
    bindings: { kind: "instantiated", bindings } }, provided: 1 } }), true, "one complete selected endpoint plus the one supplied environment");
  for (const opposite of [{ ...reference, endpoint: "advertised" }, { ...reference, ordinal: 0 }, { ...reference, provided: 0 }]) {
    assert.equal(program.instantiate(fixture.index, fixture.module, opposite, bindings, { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 10000 }).kind, "missing-binding-artifact");
  }
  const body = program.instantiate(fixture.index, fixture.module, { kind: "summary", target: "body", body: fixture.bodyId, provided: 0 }, bindings, { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 10000 });
  assert.equal(body.kind, "instantiated");
  assert.equal(body.artifact.summary.key.kind, "body");
  assert.equal(body.artifact.summary.key.execution.provided, 0);
  assert.equal(facts.parseSummary(facts.printSummary(result.artifact.summary)).kind, "parsed");
  assert.equal(facts.parseSummary('Summary(key=SummaryKey(definition=def:"removed", bindings=parametric()))').kind, "invalid-text", "obsolete declaration-only keys are rejected");
  fixture.index.summaries[1].bindingDependent = true;
  assert.equal(program.instantiate(fixture.index, fixture.module, reference, bindings, { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 10000 }).kind,
    "missing-binding-artifact", "a binding-dependent template cannot substitute for the actual required computed summary");
});

}
export function programForEvidence(index) {
  return { index: { ...index, signatures: [], bodies: [], constants: [], metadata: [], summaries: [],
    dependencyInventory: { operations: [], dependencies: [], components: [] },
    initialization: { ...index.initialization, external: [], modules: [], entries: [] },
  }, modules: [] };
}
