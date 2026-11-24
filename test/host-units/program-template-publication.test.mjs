import assert from "node:assert/strict";
import { test } from "node:test";
import { publicationFixture } from "./fixtures/program-publication.mjs";
import { encodeContextKey } from "./ir-program-fixtures.mjs";
import { canonicalizeProgram, createProgramVerificationWork, parseModuleBodies, parseProgramIndex, printModuleBodies, printProgramIndex,
  instantiate, verifyModuleBodies, verifyProgramIndex } from "../../packages/host/dist/ir-program/index.js";
import { ProgramWork } from "../../packages/host/dist/ir-program/work.js";
import { syntaxTransportModule } from "./ir-program-transport-fixtures.mjs";
import { accountFailure, createAccount, remainingWork } from "../../packages/host/dist/dataflow/index.js";
import { compareIndexSignatures } from "../../packages/host/dist/ir-types/index.js";
import { programForEvidence, projectFixtureProgram } from "./fixtures/program-executions.mjs";

test("canonical Program publishes authentic templates without executable artifacts beside selected instances", () => {
  const fixture = publicationFixture();
  assert.deepEqual(verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [] });
  assert.deepEqual(verifyModuleBodies(fixture.index, fixture.module, fixture.context), { kind: "complete", violations: [] });
  assert.equal(fixture.module.tree.kind, "ready-root");
  assert.equal(fixture.template.tir.root, fixture.module.tree.root);
  for (const field of ["mir", "facts", "observations"]) assert.equal(Object.hasOwn(fixture.template, field), false);
  for (const field of ["mirLocalCount", "mirConstantCount", "mirPlaceCount", "mirBlockCount"])
    assert.equal(Object.hasOwn(fixture.index.bodies[0], field), false);
  const text = printModuleBodies(fixture.index, fixture.module);
  const parsed = parseModuleBodies(fixture.index, text);
  assert.equal(parsed.kind, "parsed");
  assert.equal(parsed.value.tree.kind, "ready-root");
  assert.equal(parsed.value.bodies[0].tir.root, parsed.value.tree.root);
  assert.deepEqual(parsed.value, fixture.module);
  const indexText = printProgramIndex(fixture.index);
  assert.deepEqual(parseProgramIndex(indexText), { kind: "parsed", value: fixture.index });
  const rewritten = projectFixtureProgram({ index: fixture.index, modules: [fixture.module] }, {
    table: fixture.index.types, types: [0], signatures: [0],
  });
  assert.deepEqual(rewritten, { index: fixture.index, modules: [fixture.module] });
  assert.equal(rewritten.modules[0].bodies[0].tir.root, rewritten.modules[0].tree.root);
});

test("a template-only module verifies without requesting observations, MIR or execution Facts", () => {
  const fixture = publicationFixture();
  fixture.module.bodies = [fixture.template];
  fixture.index.bodies = [fixture.index.bodies[0]];
  fixture.index.dependencyInventory = { operations: [], dependencies: [], components: [] };
  fixture.index.summaries = [];
  fixture.index.initialization = { ...fixture.index.initialization, modules: [], entries: [] };
  fixture.context.initialization = fixture.index.initialization;
  fixture.tirInput.module.bodies = [fixture.template.tir];
  const facts = { ...fixture.context.facts,
    arenaOf: () => assert.fail("No flow arena for a template."),
  };
  assert.deepEqual(verifyProgramIndex(fixture.index, { ...fixture.context, facts }), { kind: "complete", violations: [] });
  assert.deepEqual(verifyModuleBodies(fixture.index, fixture.module, { ...fixture.context, facts }), { kind: "complete", violations: [] });
});

test("current publication codecs reject retired mandatory-MIR form and executable fields on templates", () => {
  const fixture = publicationFixture();
  const moduleText = printModuleBodies(fixture.index, fixture.module);
  assert.equal(parseModuleBodies(fixture.index, moduleText.replace('kind="template", ', "")).kind, "invalid-text");
  assert.equal(parseModuleBodies(fixture.index, moduleText.replace('kind="selected", ', 'kind="template", ')).kind, "invalid-text");
  assert.equal(parseModuleBodies(fixture.index, moduleText.replace('kind="template", ', 'kind="selected", ')).kind, "invalid-text");
  const indexText = printProgramIndex(fixture.index);
  assert.equal(parseProgramIndex(indexText.replace('kind="template", ', "")).kind, "invalid-text");
  assert.equal(parseProgramIndex(indexText.replace('kind="selected", ', 'kind="template", ')).kind, "invalid-text");
  assert.equal(parseProgramIndex(indexText.replace('kind="template", ', 'kind="selected", ')).kind, "invalid-text");
});

test("artifact selection never fabricates MIR or execution Facts from a typed template", () => {
  const fixture = publicationFixture();
  const bindings = fixture.selected.instance.bindings.bindings;
  const limits = { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 100000 };
  for (const artifact of [{ kind: "mir", body: fixture.bodyId }, { kind: "facts", body: fixture.bodyId, provided: 0 }]) {
    const selected = instantiate(fixture.index, fixture.module, artifact, bindings, limits);
    assert.equal(selected.kind, "instantiated");
    assert.equal(selected.types === fixture.index.types, false);
    assert.deepEqual(selected.types, fixture.index.types);
    assert.equal(artifact.kind === "mir" ? selected.artifact.body === fixture.selected.mir
      : selected.artifact.facts === fixture.selected.facts[0], true);
    const templateOnly = { ...fixture.module, bodies: [fixture.template] };
    assert.equal(instantiate(fixture.index, templateOnly, artifact, bindings, limits).kind, "missing-binding-artifact");
    const record = { ...fixture.selected, mir: { ...fixture.selected.mir, bindings: fixture.template.instance.bindings },
      facts: fixture.selected.facts.map(facts => ({ ...facts, execution: { ...facts.execution, instance: fixture.template.instance } })) };
    for (const instance of [fixture.template.instance, fixture.selected.instance]) {
      const forged = { ...fixture.module, bodies: [{ ...record, instance }] };
      assert.deepEqual(instantiate(fixture.index, forged, artifact, bindings, limits), { kind: "missing-binding-artifact", artifact, bindings });
    }
  }
});

test("deleting the entire publication cannot bypass authentic checked-source template coverage", () => {
  const fixture = publicationFixture();
  fixture.module.bodies = [];
  fixture.index.bodies = [];
  fixture.index.dependencyInventory = { operations: [], dependencies: [], components: [] };
  fixture.answers.set(encodeContextKey(["tirBindingScopesOf", { kind: "module", module: fixture.module.module }]), [fixture.scope]);
  const result = verifyModuleBodies(fixture.index, fixture.module, fixture.context);
  assert.equal(result.kind, "complete");
  assert.equal(result.violations.some(row => row.rule === "tir-valid" && row.detail[0]?.value === "template-shared-once"), true);
});

test("Program index-origin transport preserves actual source occurrences and remaps each selected key", () => {
  const fixture = publicationFixture();
  const origin = { kind: "item", value: { owner: fixture.definition, node: 0 } };
  const component = { root: origin, path: [
    { kind: "index-key", origin, key: 1 }, { kind: "index-value", origin, key: 2 },
  ] };
  const types = { ...fixture.index.types, terms: [...fixture.index.types.terms,
    { kind: "string" }, { kind: "intrinsic", intrinsic: "symbol" },
    { kind: "shape", members: [], indexes: [1, 2].map(key => ({ origin, key, read: 1, write: null, readonly: true })),
      calls: [], constructs: [] }] };
  fixture.index.types = types;
  const root = fixture.module.tree.root;
  const literal = { id: 2, parent: null, origin: root.origin, loc: root.loc, flags: [],
    kind: "StringLiteral", text: "index", tokenFlags: [], tsonic: { role: "value", value: "index", type: 1,
      convertedType: 1, conversion: { kind: "identity" }, evidenceIndex: null, demand: { kind: "always" },
      narrowing: { kind: "narrowed", source: 1, result: 1, failure: "unwind",
        proof: { steps: [{ from: component, to: component, rule: "identity", premises: [] }], conclusion: 0 } } } };
  const module = syntaxTransportModule({ module: fixture.module }, literal, "Expression");
  const text = printModuleBodies(fixture.index, module);
  assert.deepEqual(parseModuleBodies(fixture.index, text), { kind: "parsed", value: module });
  const indexText = printProgramIndex(fixture.index);
  assert.deepEqual(parseProgramIndex(indexText), { kind: "parsed", value: fixture.index });
  const publication = { table: { ...types, terms: [types.terms[0], types.terms[2], types.terms[1],
    { ...types.terms[3], indexes: [{ ...types.terms[3].indexes[1], key: 1, read: 2 },
      { ...types.terms[3].indexes[0], key: 2, read: 2 }] }] }, types: [0, 2, 1, 3], signatures: [0] };
  const rewritten = projectFixtureProgram({ index: fixture.index, modules: [module] }, publication);
  const statement = rewritten.modules[0].tree.root.statements.nodes[0];
  assert.equal(statement.kind, "ready-statement");
  const selected = statement.node.expression.tsonic.narrowing.proof.steps[0];
  assert.deepEqual(selected.from.path, [{ kind: "index-key", origin, key: 2 }, { kind: "index-value", origin, key: 1 }]);
  assert.deepEqual(selected.to, selected.from);
  assert.deepEqual(rewritten.index.types.terms[3].indexes.map(row => [row.origin, row.key]), [[origin, 1], [origin, 2]]);
  const templates = { ...module, bodies: [module.bodies[0]] };
  const bindings = fixture.selected.instance.bindings.bindings;
  const limits = { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 100000, maximumCreatedRecords: 100000 };
  const result = instantiate(fixture.index, templates, { kind: "tir", body: fixture.bodyId }, bindings, limits);
  assert.equal(result.kind, "instantiated");
  const instantiatedStatement = result.artifact.body.root.statements.nodes[0];
  assert.equal(instantiatedStatement.kind, "ready-statement");
  assert.deepEqual(instantiatedStatement.node.expression.tsonic.narrowing.proof.steps[0].from.path, component.path);
  for (const field of ["maximumWork", "maximumCreatedRecords"]) for (const maximum of [0, 1, 2]) {
    const stopped = instantiate(fixture.index, templates, { kind: "tir", body: fixture.bodyId }, bindings,
      { ...limits, [field]: maximum });
    assert.equal(stopped.kind, "resource-limit");
    assert.equal(stopped.dimension, field === "maximumWork" ? "work" : "created-records");
    assert.equal(stopped.maximum, maximum);
    assert.equal("artifact" in stopped, false);
  }
});

test("Program final member projection uses inventory-only indexes in final identity order", () => {
  const fixture = publicationFixture();
  const origin = { kind: "item", value: { owner: fixture.definition, node: 0 } };
  const types = { ...fixture.index.types, terms: [...fixture.index.types.terms, { kind: "string" }, { kind: "intrinsic", intrinsic: "symbol" }] };
  const publication = { table: { ...types, terms: [...types.terms].reverse() }, types: [2, 1, 0], signatures: [0] };
  const indexes = [0, 1, 2].map(key => ({ origin, key, readonly: true, get read() { assert.fail("Inventory has no typed read"); },
    get write() { assert.fail("Inventory has no typed write"); } }));
  const member = { instance: fixture.instance, occurrence: { kind: "selection", ordinal: 0, node: 0 },
    inventory: { receiver: 0, members: [], indexes, calls: [0], constructs: [], accessors: [], constructors: [], completeness: { kind: "complete" } } };
  const run = (maximumWork = 100000, maximumCreatedRecords = 100000, input = { checked: [], members: [member], signatures: [], storage: [], layoutOperands: null }) => {
    const account = createAccount({ maximumWork, maximumResultEntries: 100000 });
    const resources = createProgramVerificationWork({ ...ProgramWork.state(fixture.context.resources).limits, maximumCreatedRecords }, account);
    const result = canonicalizeProgram(programForEvidence(fixture.index), publication, resources,
      { kind: "with-evidence", read: actual => {
        assert.equal(actual === account, true);
        return { kind: "complete", value: input };
      } });
    return { result, account, state: ProgramWork.state(resources) };
  };
  const full = run();
  assert.equal(full.result.kind, "complete");
  const mapped = full.result.evidence.members[0].inventory;
  assert.equal(mapped.receiver, 2);
  assert.deepEqual(mapped.indexes, [0, 1, 2].map(key => ({ origin, key, readonly: true })));
  assert.equal(compareIndexSignatures(mapped.indexes[0], mapped.indexes[1]), -1);
  assert.equal(compareIndexSignatures(indexes[0], indexes[1]), -1);
  assert.equal(indexes[0].key, 0);
  const work = 100000 - remainingWork(full.account);
  const records = full.state.created;
  assert.equal(run(work, records).result.kind, "complete");
  for (const [dimension, bound] of [["work", work], ["created-records", records]]) {
    for (let maximum = 0; maximum < bound; maximum += 1) {
      const { result, account, state } = run(dimension === "work" ? maximum : work, dimension === "created-records" ? maximum : records);
      assert.equal(result.kind, "resource-limit");
      assert.equal(result.dimension, dimension);
      assert.equal(result, state.failure ?? accountFailure(account));
      assert.equal("value" in result, false);
    }
  }
});

test("Program seed admission pays nested index source records and actual selector keys once", async () => {
  const { admitTypeTable, viewTypes } = await import("../../packages/host/dist/ir-types/index.js");
  const { programTypeWork } = await import("../../packages/host/dist/ir-program/verification-work.js");
  const { createInstantiationMeter } = await import("../../packages/host/dist/ir-program/work.js");
  const fixture = publicationFixture();
  const origin = { kind: "item", value: { owner: fixture.definition, node: 0 } };
  const table = { terms: [{ kind: "string" }, { kind: "shape", members: [], indexes: [
    { origin, key: 0, read: 0, write: null, readonly: true }], calls: [], constructs: [] },
  { kind: "projection", source: 1, projection: { kind: "component", component: { root: origin,
    path: ["index-key", "index-value"].map(kind => ({ kind, origin, key: 0 })) } } }], signatures: [] };
  const limits = { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 10000, maximumCreatedRecords: 1000 };
  const full = createInstantiationMeter(limits);
  const complete = admitTypeTable(table, programTypeWork(full));
  assert.equal(complete.kind, "complete");
  assert.deepEqual(viewTypes(complete.types), table);
  assert.equal(viewTypes(complete.types).terms[1].indexes[0].origin === origin, false);
  const work = limits.maximumWork - remainingWork(full.account);
  const records = full.created;
  const exact = createInstantiationMeter({ ...limits, maximumWork: work, maximumCreatedRecords: records });
  assert.equal(admitTypeTable(table, programTypeWork(exact)).kind, "complete");
  for (const [field, needed] of [["maximumWork", work], ["maximumCreatedRecords", records]]) for (let maximum = 0; maximum < needed; maximum += 1) {
    const meter = createInstantiationMeter({ ...limits, maximumWork: work, maximumCreatedRecords: records, [field]: maximum });
    const result = admitTypeTable(table, programTypeWork(meter));
    assert.equal(result.kind, "resource-limit");
    assert.equal(result.dimension, field === "maximumWork" ? "work" : "created-records");
    assert.equal(result.maximum, maximum);
    assert.equal(result, meter.failure ?? accountFailure(meter.account));
  }
  const malformed = { ...table, terms: [table.terms[0], { ...table.terms[1], indexes: new Array(1) }, table.terms[2]] };
  const rejected = admitTypeTable(malformed, programTypeWork(createInstantiationMeter(limits)));
  assert.equal(rejected.kind, "invalid");
  assert.equal(rejected.violations.some(row => row.site.kind === "type" && row.site.type === 1), true);
});
