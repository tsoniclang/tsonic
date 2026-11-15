import assert from "node:assert/strict";
import { test } from "node:test";
import { publicationFixture } from "./fixtures/program-publication.mjs";
import { encodeContextKey } from "./ir-program-fixtures.mjs";
import { canonicalizeProgram, parseModuleBodies, parseProgramIndex, printModuleBodies, printProgramIndex,
  instantiate, verifyModuleBodies, verifyProgramIndex } from "../../packages/host/dist/ir-program/index.js";
import { ProgramWork } from "../../packages/host/dist/ir-program/work.js";
import { syntaxTransportModule } from "./ir-program-transport-fixtures.mjs";
import { accountFailure, refuseAccount, remainingWork } from "../../packages/host/dist/dataflow/index.js";
import { conditionRefusal } from "./fixtures/facts-verification.mjs";

test("canonical Program publishes authentic templates without executable artifacts beside selected instances", () => {
  const fixture = publicationFixture();
  assert.deepEqual(verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [] });
  assert.deepEqual(verifyModuleBodies(fixture.index, fixture.module, fixture.context), { kind: "complete", violations: [] });
  assert.equal(fixture.template.tir.root, fixture.module.tree);
  for (const field of ["mir", "facts", "observations"]) assert.equal(Object.hasOwn(fixture.template, field), false);
  for (const field of ["mirLocalCount", "mirConstantCount", "mirPlaceCount", "mirBlockCount"])
    assert.equal(Object.hasOwn(fixture.index.bodies[0], field), false);
  const text = printModuleBodies(fixture.index, fixture.module);
  const parsed = parseModuleBodies(fixture.index, text);
  assert.equal(parsed.kind, "parsed");
  assert.equal(parsed.value.bodies[0].tir.root, parsed.value.tree);
  assert.deepEqual(parsed.value, fixture.module);
  const indexText = printProgramIndex(fixture.index);
  assert.deepEqual(parseProgramIndex(indexText), { kind: "parsed", value: fixture.index });
  const rewritten = canonicalizeProgram({ index: fixture.index, modules: [fixture.module] }, {
    table: fixture.index.types, types: [0], signatures: [0],
  });
  assert.deepEqual(rewritten, { index: fixture.index, modules: [fixture.module] });
  assert.equal(rewritten.modules[0].bodies[0].tir.root, rewritten.modules[0].tree);
});

test("a template-only module verifies without requesting observations, MIR or execution Facts", () => {
  const fixture = publicationFixture();
  fixture.module.bodies = [fixture.template];
  fixture.index.bodies = [fixture.index.bodies[0]];
  fixture.index.dependencyInventory = { operations: [], dependencies: [], components: [] };
  fixture.tirInput.module.bodies = [fixture.template.tir];
  const facts = { ...fixture.context.facts,
    arenaOf: () => assert.fail("No flow arena for a template."),
  };
  assert.deepEqual(verifyProgramIndex(fixture.index, { ...fixture.context, facts }), { kind: "complete", violations: [] });
  assert.deepEqual(verifyModuleBodies(fixture.index, fixture.module, { ...fixture.context, facts }), { kind: "complete", violations: [] });
});

test("publication availability and actual binding kind must agree in index and module", () => {
  for (const change of ["selected-parametric", "template-instantiated", "index-availability", "missing-template"]) {
    const fixture = publicationFixture();
    if (change === "selected-parametric") fixture.selected.instance = fixture.template.instance;
    if (change === "template-instantiated") fixture.template.instance = fixture.selected.instance;
    if (change === "index-availability") fixture.index.bodies[0] = { ...fixture.index.bodies[0], kind: "selected",
      mirLocalCount: 0, mirConstantCount: 0, mirPlaceCount: 0, mirBlockCount: 1 };
    if (change === "missing-template") fixture.module.bodies.shift();
    const result = verifyModuleBodies(fixture.index, fixture.module, fixture.context);
    assert.equal(result.kind, "complete");
    assert.equal(result.violations.length > 0, true, change);
    if (change === "missing-template") assert.equal(result.violations.some(row =>
      row.rule === "tir-valid" && row.detail[0]?.value === "template-shared-once"), true);
    if (change === "index-availability") {
      const checked = verifyProgramIndex(fixture.index, fixture.context);
      assert.equal(checked.kind, "complete");
      assert.equal(checked.violations.some(row => row.rule === "body-instance-exact"), true);
    }
  }
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
    assert.equal(instantiate(fixture.index, fixture.module, artifact, bindings, limits).kind, "instantiated");
    const templateOnly = { ...fixture.module, bodies: [fixture.template] };
    assert.equal(instantiate(fixture.index, templateOnly, artifact, bindings, limits).kind, "missing-binding-artifact");
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
  const root = fixture.module.tree;
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
  const rewritten = canonicalizeProgram({ index: fixture.index, modules: [module] }, publication);
  const selected = rewritten.modules[0].tree.statements.nodes[0].expression.tsonic.narrowing.proof.steps[0];
  assert.deepEqual(selected.from.path, [{ kind: "index-key", origin, key: 2 }, { kind: "index-value", origin, key: 1 }]);
  assert.deepEqual(selected.to, selected.from);
  assert.deepEqual(rewritten.index.types.terms[3].indexes.map(row => [row.origin, row.key]), [[origin, 1], [origin, 2]]);
  const templates = { ...module, bodies: [module.bodies[0]] };
  const bindings = fixture.selected.instance.bindings.bindings;
  const limits = { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 100000, maximumCreatedRecords: 100000 };
  const result = instantiate(fixture.index, templates, { kind: "tir", body: fixture.bodyId }, bindings, limits);
  assert.equal(result.kind, "instantiated");
  assert.deepEqual(result.artifact.body.root.statements.nodes[0].expression.tsonic.narrowing.proof.steps[0].from.path, component.path);
  for (const field of ["maximumWork", "maximumCreatedRecords"]) for (const maximum of [0, 1, 2]) {
    const stopped = instantiate(fixture.index, templates, { kind: "tir", body: fixture.bodyId }, bindings,
      { ...limits, [field]: maximum });
    assert.equal(stopped.kind, "resource-limit");
    assert.equal(stopped.dimension, field === "maximumWork" ? "work" : "created-records");
    assert.equal(stopped.maximum, maximum);
    assert.equal("artifact" in stopped, false);
  }
});

test("Program stable type images restore canonical index order after the selected keys are remapped", async () => {
  const { stabilizePublication } = await import("../../packages/host/dist/ir-program/instantiate-types.js");
  const { createInstantiationMeter } = await import("../../packages/host/dist/ir-program/work.js");
  const fixture = publicationFixture();
  const origin = { kind: "item", value: { owner: fixture.definition, node: 0 } };
  const original = { ...fixture.index.types, terms: [fixture.index.types.terms[0], { kind: "string" },
    { kind: "intrinsic", intrinsic: "symbol" }] };
  const indexes = [0, 1].map(key => ({ origin, key, read: 2, write: null, readonly: true }));
  const publication = { table: { terms: [original.terms[2], original.terms[1], original.terms[0],
    { kind: "shape", members: [], indexes, calls: [], constructs: [] },
    { kind: "projection", source: 3, projection: { kind: "component", component: { root: origin, path: [
      { kind: "index-key", origin, key: 0 }, { kind: "index-value", origin, key: 1 },
    ] } } }], signatures: original.signatures.map(row => ({ ...row, result: 2 })) },
  types: [2, 1, 0, 3, 4], signatures: [0] };
  const limits = { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 100000, maximumCreatedRecords: 100000 };
  const result = stabilizePublication(createInstantiationMeter(limits), original, publication);
  assert.equal(result.kind, "complete");
  assert.deepEqual(result.types.terms.slice(0, 3), original.terms);
  assert.deepEqual(result.types.terms[3].indexes, [{ ...indexes[1], key: 1, read: 0 }, { ...indexes[0], key: 2, read: 0 }]);
  assert.deepEqual(result.types.terms[4].projection.component.path,
    [{ kind: "index-key", origin, key: 2 }, { kind: "index-value", origin, key: 1 }]);
  const exact = createInstantiationMeter({ ...limits, maximumWork: 60, maximumCreatedRecords: 10 });
  const exactResult = stabilizePublication(exact, original, publication);
  assert.equal(exactResult.kind, "complete");
  assert.deepEqual(exactResult.types, result.types);
  assert.deepEqual(publication.types.map(exactResult.rewrite.type), publication.types.map(result.rewrite.type));
  assert.equal(remainingWork(exact.account), 0, "10 anchor reads, 45 projection units, 2 scratch entries, 1 comparison and 2 moves");
  assert.equal(exact.created, 10, "8 transport records plus 2 merge-buffer references");
  const unread = new Proxy({}, { get() { assert.fail("No stable image is read after the original stop."); } });
  for (const [field, needed] of [["maximumWork", 60], ["maximumCreatedRecords", 10]]) {
    for (let maximum = 0; maximum < needed; maximum += 1) {
      const meter = createInstantiationMeter({ ...limits, maximumWork: 60, maximumCreatedRecords: 10, [field]: maximum });
      const stop = stabilizePublication(meter, original, publication);
      assert.equal(stop.kind, "resource-limit");
      assert.equal(stop.dimension, field === "maximumWork" ? "work" : "created-records");
      assert.equal(stop.maximum, maximum);
      assert.equal(stop, meter.failure ?? accountFailure(meter.account));
      assert.equal(stabilizePublication(meter, unread, unread), stop);
    }
  }
  const refused = createInstantiationMeter(limits);
  const originalStop = refuseAccount(refused.account, conditionRefusal);
  assert.equal(stabilizePublication(refused, unread, unread), originalStop);
  const sparse = { ...publication, table: { ...publication.table, terms: [...publication.table.terms.slice(0, 3),
    { ...publication.table.terms[3], indexes: new Array(1) }] } };
  assert.throws(() => stabilizePublication(createInstantiationMeter(limits), original, sparse), TypeError,
    "actual caller density is checked by transport admission, never by fabricating a derived-buffer fault");
  for (const keys of [[], [0], [2, 0, 1], [4, 2, 0, 3, 1]]) {
    const table = { ...publication.table, terms: [...publication.table.terms.slice(0, 3),
      { ...publication.table.terms[3], indexes: keys.map(key => ({ ...indexes[0], key: key < 3 ? key : 1, origin: {
        ...origin, value: { ...origin.value, node: key },
      } })) }] };
    const image = stabilizePublication(createInstantiationMeter(limits), original,
      { table, types: [2, 1, 0, 3], signatures: [0] });
    assert.equal(image.kind, "complete");
    assert.deepEqual(image.types.terms[3].indexes.map(row => row.origin.value.node), [...keys].sort((left, right) => left - right));
  }
});

test("Program seed admission includes each nested index source record and each actual selected key", async () => {
  const { admitTypeSeed } = await import("../../packages/host/dist/ir-program/instantiate-types.js");
  const { createInstantiationMeter } = await import("../../packages/host/dist/ir-program/work.js");
  const fixture = publicationFixture();
  const origin = { kind: "item", value: { owner: fixture.definition, node: 0 } };
  const table = { terms: [{ kind: "string" }, { kind: "shape", members: [], indexes: [
    { origin, key: 0, read: 0, write: null, readonly: true }], calls: [], constructs: [] },
  { kind: "projection", source: 1, projection: { kind: "component", component: { root: origin,
    path: ["index-key", "index-value"].map(kind => ({ kind, origin, key: 0 })) } } }], signatures: [] };
  const limits = { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 50, maximumCreatedRecords: 8 };
  const exact = createInstantiationMeter(limits);
  assert.equal(admitTypeSeed(exact, table), null);
  assert.equal(remainingWork(exact.account), 0, "2 string, 6 shape, 11 index, 7 projection, 6 component, 18 selector units");
  assert.equal(exact.created, 8);
  for (const [field, needed] of [["maximumWork", 50], ["maximumCreatedRecords", 8]]) for (let maximum = 0; maximum < needed; maximum += 1) {
    const meter = createInstantiationMeter({ ...limits, [field]: maximum });
    const result = admitTypeSeed(meter, table);
    assert.equal(result.kind, "resource-limit");
    assert.equal(result.dimension, field === "maximumWork" ? "work" : "created-records");
    assert.equal(result.maximum, maximum);
    assert.equal(result, meter.failure ?? accountFailure(meter.account));
  }
});
