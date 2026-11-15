import assert from "node:assert/strict";

export async function originsUniqueCases(suite) {
  const { publicationFixture } = await import("./program-publication.mjs");
  const { encodeContextKey } = await import("../ir-program-fixtures.mjs");
  const { verifyRelationalArena } = await import("../../../packages/host/dist/ir-facts/verify-relations.js");
  const { verifyFacts } = await import("../../../packages/host/dist/ir-facts/index.js");
  const { refuseAccount } = await import("../../../packages/host/dist/dataflow/index.js");
  const { verificationAccount, verificationStops } = await import("./facts-verification.mjs");
  const fixture = () => {
    const input = publicationFixture();
    const facts = input.selected.facts[0];
    const owner = { kind: "body", execution: facts.execution };
    return { input, facts, owner, context: input.context.facts };
  };
  const verify = (current, account = verificationAccount(), owner = current.owner) =>
    verifyRelationalArena(current.facts.arena, owner, current.context, account);

  await suite.test("distinct dense IDs cannot publish the same complete Origins payload", () => {
    const current = fixture();
    current.facts.arena.origins.push(...[0, 1].map(id => ({ id, kind: "complete", producers: [], includesAbsence: false })));
    const result = verify(current);
    assert.equal(result.kind, "complete");
    assert.equal(result.violations.filter(row => row.rule === "origins-unique").length, 1);
    assert.equal(result.violations.find(row => row.rule === "origins-unique").site.origins, 1);
    const published = verifyFacts(current.facts, current.input.selected.mir, current.context, verificationAccount());
    assert.equal(published.kind, "complete");
    assert.equal(published.violations.some(row => row.rule === "origins-unique"), true);
    const owner = { kind: "summary", key: { kind: "body", execution: current.facts.execution } };
    current.input.answers.set(encodeContextKey(["arenaOf", owner]), current.facts.arena);
    assert.equal(verify(current, verificationAccount(), owner).violations.some(row => row.rule === "origins-unique"), true);
    verificationStops(account => verify(current, account));
  });

  await suite.test("actual bound subjects, absence, kind and open boundaries remain different Origins payloads", () => {
    const current = fixture();
    const arena = current.facts.arena;
    arena.producers.push({ id: 0, path: null, kind: "shared", definition: current.input.definition });
    arena.contexts.push(...[0, 1].map(id => ({ id, receiver: id === 0 ? null : 0, arguments: [], captures: [] })));
    arena.boundProducers.push(...[0, 1].map(id => ({ id, producer: 0, bindings: current.input.selected.tir.lexicalBindings, context: id })));
    arena.boundaries.push(...[0, 1].map(id => ({ id, kind: "external-input",
      at: { kind: "node", node: { kind: "body", value: { body: current.input.bodyId, node: 0 } } }, subject: 0, owner: null,
      bindings: current.input.selected.tir.lexicalBindings, context: 0, detail: `input ${id}` })));
    arena.origins.push(
      { id: 0, kind: "complete", producers: [0], includesAbsence: false },
      { id: 1, kind: "complete", producers: [1], includesAbsence: false },
      { id: 2, kind: "complete", producers: [0], includesAbsence: true },
      { id: 3, kind: "open", producers: [0], includesAbsence: false, boundaries: [0] },
      { id: 4, kind: "open", producers: [0], includesAbsence: false, boundaries: [1] },
      { id: 5, kind: "complete", producers: [0, 1], includesAbsence: false });
    assert.deepEqual(verify(current), { kind: "complete", violations: [] });
    arena.origins.push({ ...arena.origins[3], id: arena.origins.length });
    const result = verify(current);
    assert.equal(result.kind, "complete");
    assert.equal(result.violations.filter(row => row.rule === "origins-unique").length, 1);
    verificationStops(account => verify(current, account));
  });

  await suite.test("open Origins retain one nonempty canonical boundary set before payload identity", () => {
    const current = fixture();
    const arena = current.facts.arena;
    arena.producers.push({ id: 0, path: null, kind: "shared", definition: current.input.definition });
    arena.contexts.push({ id: 0, receiver: null, arguments: [], captures: [] });
    arena.boundaries.push(...[0, 1].map(id => ({ id, kind: "external-input",
      at: { kind: "node", node: { kind: "body", value: { body: current.input.bodyId, node: 0 } } }, subject: 0, owner: null,
      bindings: current.input.selected.tir.lexicalBindings, context: 0, detail: `input ${id}` })));
    arena.origins.push({ id: 0, kind: "open", producers: [], includesAbsence: false, boundaries: [0, 1] });
    assert.deepEqual(verify(current), { kind: "complete", violations: [] });
    for (const boundaries of [[1, 0], [0, 0], []]) {
      arena.origins[0] = { ...arena.origins[0], boundaries };
      const result = verify(current);
      assert.equal(result.kind, "complete");
      assert.equal(result.violations.filter(row => row.rule === "origin-alternatives-order").length, 1);
      assert.equal(result.violations[0].site.origins, 0);
      const published = verifyFacts(current.facts, current.input.selected.mir, current.context, verificationAccount());
      assert.equal(published.kind === "complete" && published.violations.some(row => row.rule === "origin-alternatives-order"), true);
      verificationStops(account => verify(current, account));
    }
    arena.origins[0] = { ...arena.origins[0], boundaries: [0, 1] };
    arena.origins.push({ ...arena.origins[0], id: 1 });
    const repeated = verify(current);
    assert.equal(repeated.kind === "complete" && repeated.violations.filter(row => row.rule === "origins-unique").length === 1, true);
    verificationStops(account => verify(current, account));
  });

  await suite.test("the original refusal precedes every Origins-payload or owner read", () => {
    const account = verificationAccount();
    const refusal = { kind: "refused", diagnostics: [] };
    refuseAccount(account, refusal);
    const unread = new Proxy({}, { get() { assert.fail("No arena, owner or ready context is read after the original refusal."); } });
    assert.equal(verifyRelationalArena(unread, unread, unread, account), refusal);
  });
}
