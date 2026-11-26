import assert from "node:assert/strict";
import { publicationFixture } from "./program-publication.mjs";
import { verifyRelationalArena } from "../../../packages/host/dist/ir-facts/verify-relations.js";
import { verifyFacts, printFacts, parseFacts } from "../../../packages/host/dist/ir-facts/index.js";
import { instantiate } from "../../../packages/host/dist/ir-program/index.js";
import { ProgramWork } from "../../../packages/host/dist/ir-program/work.js";
import { accountFailure, refuseAccount } from "../../../packages/host/dist/dataflow/index.js";
import { verificationAccount, verificationStops } from "./facts-verification.mjs";

function fixture(role = "binding") {
  const input = publicationFixture();
  const facts = input.selected.facts[0];
  const source = input.tirInput.source.bodies[0];
  const local = { body: input.bodyId, local: 0 };
  source.locals = [{ id: 0, declaration: { kind: "body", value: { body: input.bodyId, node: 0 } }, name: "slot", role,
    checkerSlot: { kind: "notProvided" }, capturedFrom: null, mutable: true }];
  facts.arena.producers.push({ id: 0, kind: "local", local, path: null });
  facts.arena.boundProducers.push({ id: 0, producer: 0, bindings: input.selected.tir.lexicalBindings, context: 0 });
  facts.arena.contexts.push({ id: 0, receiver: null, arguments: [], captures: [{ index: 0, location: 0, cell: 0 }] });
  facts.arena.cells.push({ id: 0, role: { kind: "local", local: 0 }, occurrence: { kind: "statement",
    execution: facts.execution, point: { block: 0, statement: 0 } }, lifetimes: [{ kind: "live", execution: facts.execution,
    point: { block: 0, statement: 0 }, local: 0 }] });
  const block = input.selected.mir.blocks[0];
  input.selected.mir.locals.push({ id: 0, storage: 0, source: local, role: { kind: "user" }, origin: block.origin });
  block.statements.push({ kind: "storage-live", local: 0, origin: block.origin, tir: block.tir });
  const context = { ...input.context.facts, localExists: reference => reference.body === source.body
    && source.locals[reference.local]?.id === reference.local };
  const owner = { kind: "body", execution: facts.execution };
  return { ...input, facts, source, local, owner, context, programContext: input.context };
}

const checked = (input, account = verificationAccount()) =>
  verifyRelationalArena(input.facts.arena, input.owner, input.context, account);

export async function localProducerCases(suite) {
  await suite.test("actual qualified local locations retain capture cells and all genuine source-local roles", () => {
    for (const role of ["binding", "parameter", "capture", "catch"]) {
      const input = fixture(role);
      assert.deepEqual(checked(input), { kind: "complete", violations: [] });
      assert.deepEqual(verifyFacts(input.facts, input.selected.mir, input.context, verificationAccount()), { kind: "complete", violations: [] });
      assert.equal(input.facts.arena.origins.length, 0, "a scalar local location creates no reference value origins");
      const text = printFacts(input.facts);
      assert.deepEqual(parseFacts(text), { kind: "parsed", value: input.facts });
      assert.equal(parseFacts(text.replace("local=LocalRef(", "slot=LocalRef(")).kind, "invalid-text");
      input.owner = { kind: "summary", key: { kind: "body", execution: input.facts.execution } };
      input.context.arenaOf = () => input.facts.arena;
      assert.deepEqual(checked(input), { kind: "complete", violations: [] }, "a body Summary retains the actual same selected source-local authority");
    }
  });

  await suite.test("local locations reject foreign, missing and bodyless qualified sources without a role fallback", () => {
    for (const change of ["foreign", "missing", "negative-zero", "bodyless"]) {
      const input = fixture();
      if (change === "foreign") input.facts.arena.producers[0].local = { body: publicationFixture().bodyId + "foreign", local: 0 };
      if (change === "missing") input.facts.arena.producers[0].local.local = 9;
      if (change === "negative-zero") input.facts.arena.producers[0].local.local = -0;
      if (change === "bodyless") input.owner = { kind: "summary", key: { kind: "declared", execution: {
        request: { definition: input.definition, endpoint: "api-signature", ordinal: 0, bindings: input.instance.bindings }, provided: 0 } } };
      if (change === "bodyless") input.context.arenaOf = () => input.facts.arena;
      input.context.localExists = () => { assert.fail("An invalid or foreign local never acquires ready-local credit."); };
      if (change === "missing") input.context.localExists = () => false;
      const result = checked(input);
      assert.equal(result.kind, "complete");
      assert.equal(result.violations.some(row => row.rule === "producer-resolves"), true, change);
      verificationStops(account => checked(input, account));
    }
  });

  await suite.test("local subjects follow inherited projection laws but are never value origins through any bound path", () => {
    for (const projected of [false, true]) {
      const input = fixture();
      if (projected) {
        input.facts.arena.projections.push({ id: 0, parent: null, projection: { kind: "element" } });
        input.facts.arena.producers[0].path = 0;
      }
      assert.deepEqual(checked(input), { kind: "complete", violations: [] });
      input.facts.arena.origins.push({ id: 0, kind: "complete", producers: [0], includesAbsence: false });
      const result = checked(input);
      assert.equal(result.kind, "complete");
      assert.equal(result.violations.filter(row => row.rule === "local-producer-location-only").length, 1);
      verificationStops(account => checked(input, account));
      const original = structuredClone(input.facts);
      const other = structuredClone(input.facts.arena.producers[0]);
      other.id = 1;
      input.facts.arena.producers.push(other);
      assert.equal(checked(input).violations.some(row => row.rule === "producer-unique"), true);
      assert.deepEqual(parseFacts(printFacts(original)), { kind: "parsed", value: original });
    }
  });

  await suite.test("local ready lookup and every verification bound preserve the original sticky stop before further reads", () => {
    const input = fixture();
    verificationStops(account => checked(input, account));
    const account = verificationAccount();
    const refusal = { kind: "refused", diagnostics: [] };
    input.context.localExists = () => { refuseAccount(account, refusal); return true; };
    input.context.arenaOf = () => { assert.fail("No canonical arena lookup follows the local reader's refusal."); };
    assert.equal(checked(input, account), refusal);
    const unread = new Proxy({}, { get() { assert.fail("No input read follows the original local refusal."); } });
    assert.equal(verifyRelationalArena(unread, unread, unread, account), refusal);
  });

  await suite.test("Program borrows immutable qualified local subjects without creating another producer", () => {
    const input = fixture();
    const result = projectFixtureProgram({ index: input.index, modules: [input.module] }, {
      table: input.index.types, types: [0], signatures: [0],
    });
    const facts = result.modules[0].bodies.find(row => row.kind === "selected").facts[0];
    assert.equal(facts.arena.producers === input.facts.arena.producers, true);
    assert.equal(facts.arena.producers[0].local === input.local, true);
    assert.equal(facts.arena.contexts[0].captures[0].cell, 0, "cell binding remains separately supplied, never inferred from the location");
    const seedWork = 121;
    const seedRecords = 61;
    const limits = { ...ProgramWork.state(input.programContext.resources).limits, maximumCreatedRecords: seedRecords };
    const reference = { kind: "facts", body: input.bodyId, provided: 0 };
    const bindings = input.instance.bindings.bindings;
    const select = maximumWork => instantiate(input.index, input.module, reference, bindings, { ...limits, maximumWork });
    const exact = seedWork + 4;
    for (let maximum = 0; maximum < exact; maximum += 1) {
      const stopped = select(maximum);
      assert.equal(stopped.kind, "resource-limit", `work cap ${maximum}`);
      assert.deepEqual(stopped, { kind: "resource-limit", dimension: "work", maximum });
    }
    const selected = select(exact);
    assert.equal(selected.kind, "instantiated");
    assert.equal(selected.artifact.facts === input.facts, true);
    assert.equal(selected.artifact.facts.arena.producers === input.facts.arena.producers, true);
    assert.equal(selected.types === input.index.types, false);
    assert.deepEqual(selected.types, input.index.types);
    const stopped = instantiate(input.index, input.module, reference, bindings,
      { ...limits, maximumWork: exact, maximumCreatedRecords: seedRecords - 1 });
    assert.equal(stopped.kind, "resource-limit");
    assert.deepEqual(stopped, { kind: "resource-limit", dimension: "created-records", maximum: seedRecords - 1 });
  });
}
import { projectFixtureProgram } from "./program-executions.mjs";
