import assert from "node:assert/strict";
import { test } from "node:test";
import { publicationFixture } from "./fixtures/program-publication.mjs";
import { canonicalizeProgram, parseModuleBodies, parseProgramIndex, printModuleBodies, printProgramIndex,
  instantiate, verifyModuleBodies, verifyProgramIndex } from "../../packages/host/dist/ir-program/index.js";
import { ProgramWork } from "../../packages/host/dist/ir-program/work.js";

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
