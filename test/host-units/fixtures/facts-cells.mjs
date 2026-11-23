import { verificationAccount, completeVerification, verificationStops } from "./facts-verification.mjs";
import assert from "node:assert/strict";

export async function cellCases(suite) {
  const { verifyCells: actualVerifyCells } = await import("../../../packages/host/dist/ir-facts/verify-cells.js");
  const verifyCells = (arena, owner, context, account) => {
    verificationStops(actual => actualVerifyCells(arena, owner, context, actual));
    return actualVerifyCells(arena, owner, context, account);
  };
  const facts = await import("../../../packages/host/dist/ir-facts/index.js");
  const { relationalUsage } = await import("../../../packages/host/dist/ir-facts/verify-relations.js");
  const { summaryBindingInputs } = await import("../../../packages/host/dist/ir-facts/binding-inputs.js");
  const { chargeWork } = await import("../../../packages/host/dist/dataflow/index.js");
  const ids = await import("../../../packages/host/dist/ids/index.js");
  const module = ids.encodeModuleId({ package: ids.encodePackageId("cells"), path: "main.ts" });
  const definition = ids.encodeDefId({ module, segments: [{ name: "run", ordinal: 0 }] });
  const body = ids.encodeBodyId({ owner: definition, role: "function", ordinal: 0 });
  const execution = { instance: { body, bindings: { kind: "parametric" } }, provided: 0 };
  const owner = { kind: "body", execution };
  const source = { kind: "body", value: { body, node: 7 } };
  const binding = () => ({ classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] });
  const statement = index => ({ kind: "statement", execution, point: { block: 0, statement: index } });
  const row = (id, role, occurrence = statement(1)) => ({ id, role, occurrence, lifetimes: [] });
  const arena = cells => ({ cells, projections: [{ id: 0, parent: null, projection: { kind: "deref" } }],
    producers: [], contexts: [], boundProducers: [], origins: [{ id: 0, kind: "complete", producers: [], includesAbsence: false }], boundaries: [] });
  const signature = { id: 0, declaration: definition, owner: source, composition: null, kind: "call",
    typeParameters: [], receiver: { declaration: null, type: 0, passing: "by-value" },
    parameters: [{ declaration: null, kind: "required", type: 0, passing: "by-value", initializer: null, acceptsOmission: true }], result: 0 };
  const point = index => ({ block: 0, statement: index });
  const mir = { body, bindings: execution.instance.bindings, entries: [{ provided: 0, block: 0 }],
    locals: [{ id: 0, role: { kind: "receiver" } }, { id: 1, role: { kind: "parameter", index: 0 } },
      { id: 2, role: { kind: "capture", index: 0 } }, { id: 3, role: { kind: "user" } }],
    blocks: [{ id: 0, statements: [{ kind: "storage-live", local: 3 }, { kind: "assign", place: 0 },
      { kind: "storage-dead", local: 3 }, { kind: "assign", place: 0 }] }] };
  const identity = { module: { providerId: "native", providerVersion: "1", packageName: null,
    moduleSpecifier: "cells", providerModuleId: "cells" }, exportId: "run", memberId: null, signatureId: "native-signature" };
  const context = () => ({ mirBody: () => mir, bodyOwner: () => definition,
    tirBody: () => ({ owner: definition, signature: 0, captures: [{ local: { body, local: 2 } }] }),
    types: { terms: [{ kind: "intrinsic", intrinsic: "void" }], signatures: [signature] },
    signatureIdOf: () => 0, captureCount: () => 1, nodeExists: at => at.kind === "body" && at.value.body === body && at.value.node === 7,
    declarationSourceOf: () => source, declaredSiteCount: () => 1, libraryExportExists: () => true,
    definitionExists: value => value === definition, localExists: value => value.body === body && value.local === 3 });
  const member = { key: { kind: "text", value: "value" }, origins: [{ kind: "declared", declaration: definition }],
    selectedDeclarations: [definition], primary: definition, bindings: binding() };
  const roles = [
    { kind: "local", local: 3 }, { kind: "parameter", index: 0 }, { kind: "capture", index: 0 },
    { kind: "static", declaration: { definition, bindings: execution.instance.bindings } }, { kind: "detached" },
    ...[{ kind: "receiver" }, { kind: "result" }, { kind: "local", local: 3 }, { kind: "parameter", index: 0 },
      { kind: "capture", index: 0 }, { kind: "static", declaration: { definition, bindings: execution.instance.bindings } }]
      .map(anchor => ({ kind: "created", anchor, slot: { kind: "entity" } })),
    { kind: "created", anchor: { kind: "result" }, slot: { kind: "local", local: { body, local: 3 } } },
    { kind: "created", anchor: { kind: "result" }, slot: { kind: "capture", path: 0, index: 0 } },
    { kind: "created", anchor: { kind: "result" }, slot: { kind: "field", member } },
  ];
  const summary = cells => ({ key: { kind: "body", execution }, signature: 0, arena: arena(cells),
    parameters: [], captures: [], result: 0, thrown: 0, writes: [], retention: [], callbacks: [],
    suspends: false, bindingDependent: false, concurrentWrites: [], contentsOnReturn: [], contentsOnUnwind: [], returns: false, unwinds: false,
    initialization: { cells: [], events: [], conditions: [{ alternatives: [] }, { alternatives: [[]] }], points: [], rows: [] }, resultCells: [], backing: [] });

  await suite.test("logical cells preserve one dense owner-qualified domain and equal symbolic rows without alias credit", () => {
    const first = row(0, { kind: "detached" });
    const second = { ...structuredClone(first), id: 1 };
    const value = arena([first, second]);
    assert.deepEqual(completeVerification(verifyCells(value, owner, context(), verificationAccount())), []);
    const published = summary(value.cells);
    assert.deepEqual(facts.parseSummary(facts.printSummary(published)), { kind: "parsed", value: published });
    assert.equal(published.arena.cells[0].role.kind, published.arena.cells[1].role.kind);
    assert.notEqual(published.arena.cells[0].id, published.arena.cells[1].id);
    for (const index of [0, 1]) assert.equal(published.arena.cells[index].id, index);
    for (const id of [-1, -0, 0.5, NaN, 9]) {
      const changed = arena([row(id, { kind: "detached" })]);
      assert.equal(completeVerification(verifyCells(changed, owner, context(), verificationAccount())).some(value => value.rule === "cell-id-dense"), true);
    }
    const sparse = arena(new Array(1));
    assert.equal(completeVerification(verifyCells(sparse, owner, context(), verificationAccount())).some(value => value.rule === "cell-id-dense"), true);
    const text = facts.printSummary(published);
    assert.equal(facts.parseSummary(text.replace("cells=", "oldCells=")).kind, "invalid-text");
    assert.equal(facts.parseSummary(text.replace("cell:1", "producer:1")).kind, "invalid-text");
  });

  await suite.test("logical cell role and occurrence codecs retain all qualified payloads without late access decisions", () => {
    const rows = roles.map((role, id) => row(id, role));
    rows[0].lifetimes = [{ kind: "live", execution, point: point(0), local: 3 },
      { kind: "dead", execution, point: point(2), local: 3 }];
    rows[1].occurrence = { kind: "entry", execution, local: 1 };
    rows[2].occurrence = { kind: "entry", execution, local: 2 };
    rows[3].occurrence = { kind: "declared", at: { kind: "node", node: source } };
    rows[4].occurrence = { kind: "declared", at: { kind: "declared", identity, site: 0 } };
    const value = summary(rows);
    assert.deepEqual(completeVerification(verifyCells(value.arena, owner, context(), verificationAccount())), []);
    assert.deepEqual(facts.parseSummary(facts.printSummary(value)), { kind: "parsed", value });
    const repeated = arena([row(0, { kind: "detached" }, statement(1)), row(1, { kind: "detached" }, statement(3))]);
    assert.deepEqual(completeVerification(verifyCells(repeated, owner, context(), verificationAccount())), []);
    assert.notEqual(repeated.cells[0].occurrence.point.statement, repeated.cells[1].occurrence.point.statement,
      "the same source node at two statements retains two actual statement witnesses");
  });

  await suite.test("logical cells validate actual selected entry, statement, lifetime and declaration evidence", () => {
    const invalid = value => assert.equal(completeVerification(verifyCells(arena([value]), owner, context(), verificationAccount())).length > 0, true);
    for (const selected of [
      { kind: "entry", execution, local: 3 },
      { kind: "entry", execution, local: 9 },
      { kind: "entry", execution: { ...execution, provided: 1 }, local: 1 },
      { kind: "statement", execution, point: point(null) },
      { kind: "statement", execution, point: point(2) },
      { kind: "statement", execution, point: { block: 9, statement: 1 } },
      { kind: "declared", at: { kind: "node", node: { ...source, value: { ...source.value, node: 9 } } } },
      { kind: "declared", at: { kind: "declared", identity, site: 1 } },
    ]) invalid(row(0, { kind: "detached" }, selected));
    for (const marker of [
      { kind: "live", execution, point: point(2), local: 3 },
      { kind: "dead", execution, point: point(2), local: 1 },
      { kind: "live", execution, point: point(null), local: 3 },
    ]) invalid({ ...row(0, { kind: "detached" }), lifetimes: [marker] });
    for (const changed of [
      { ...context(), mirBody: () => null },
      { ...context(), mirBody: () => ({ ...mir, bindings: { kind: "instantiated", bindings: binding() } }) },
      { ...context(), mirBody: () => ({ ...mir, entries: [] }) },
      { ...context(), mirBody: () => ({ ...mir, blocks: [] }) },
    ]) assert.equal(completeVerification(verifyCells(arena([row(0, { kind: "detached" })]), owner, changed, verificationAccount())).length > 0, true);
    const declared = { kind: "summary", key: { kind: "declared", execution: {
      request: { definition, endpoint: "api-signature", ordinal: 1, bindings: execution.instance.bindings }, provided: 0 } } };
    assert.deepEqual(completeVerification(verifyCells(arena([row(0, { kind: "parameter", index: 0 }, { kind: "declared", at: { kind: "node", node: source } })]), declared, context(), verificationAccount())), []);
    assert.equal(completeVerification(verifyCells(arena([row(0, { kind: "detached" })]), declared, context(), verificationAccount())).length > 0, true);
  });

  await suite.test("a source static keeps its own declaration occurrence across executions", () => {
    const dependency = ids.encodeModuleId({ package: ids.encodePackageId("cells"), path: "dependency.ts" });
    const staticDefinition = ids.encodeDefId({ module: dependency, segments: [{ name: "stored", ordinal: 0 }] });
    const declaration = { kind: "item", value: { owner: staticDefinition, node: 7 } };
    const ready = { ...context(),
      definitionExists: selected => selected === definition || selected === staticDefinition,
      nodeExists: at => at.value.node === 7 && (at.kind === "item" ? at.value.owner === staticDefinition : at.value.body === body),
      declarationSourceOf: selected => selected === staticDefinition ? declaration : null,
    };
    const role = { kind: "static", declaration: { definition: staticDefinition, bindings: execution.instance.bindings } };
    const occurrence = node => ({ kind: "declared", at: { kind: "node", node } });
    for (const selected of [owner, { kind: "summary", key: { kind: "body", execution } }]) {
      const verify = at => completeVerification(verifyCells(arena([row(0, role, at)]), selected, ready, verificationAccount()))
        .map(finding => finding.rule);
      assert.deepEqual(verify(occurrence(structuredClone(declaration))), []);
      assert.deepEqual(verify(occurrence(source)), ["cell-occurrence-resolves"]);
      assert.deepEqual(verify(statement(1)), ["cell-occurrence-resolves"]);
    }
    const current = arena([row(0, role, occurrence(declaration))]);
    for (const boundary of ["declaration", "node"]) {
      const account = verificationAccount();
      let original;
      const stop = () => { original = chargeWork(account, 1000000000); };
      const stopped = { ...ready, declarationSourceOf: () => {
        if (boundary === "declaration") stop();
        return declaration;
      }, nodeExists: () => {
        assert.equal(boundary, "node", "the source-node reader stays unread after the original stop");
        stop();
        return true;
      }, definitionExists: () => assert.fail("the role reader stays unread after the original stop") };
      assert.equal(actualVerifyCells(current, owner, stopped, account), original);
      assert.equal(original.kind, "resource-limit");
    }
  });

  await suite.test("logical cell lifetime references preserve canonical zero without accepting negative zero", () => {
    const zeroMir = { ...mir, locals: [{ id: 0, role: { kind: "user" } }],
      blocks: [{ id: 0, statements: [{ kind: "storage-live", local: 0 }] }] };
    const value = row(0, { kind: "detached" }, statement(0));
    value.lifetimes = [{ kind: "live", execution, point: point(0), local: 0 }];
    const ready = { ...context(), mirBody: () => zeroMir };
    assert.deepEqual(completeVerification(verifyCells(arena([value]), owner, ready, verificationAccount())), []);
    value.lifetimes[0].local = -0;
    assert.deepEqual(completeVerification(verifyCells(arena([value]), owner, ready, verificationAccount())).map(finding => finding.rule), ["cell-occurrence-resolves"]);
  });

  await suite.test("logical cell roles reject missing qualified storage inventories rather than borrowing a producer identity", () => {
    for (const role of [
      { kind: "local", local: 9 }, { kind: "parameter", index: 1 }, { kind: "capture", index: 1 },
      { kind: "static", declaration: { definition: "missing", bindings: execution.instance.bindings } },
      { kind: "created", anchor: { kind: "result" }, slot: { kind: "local", local: { body, local: 9 } } },
      { kind: "created", anchor: { kind: "result" }, slot: { kind: "capture", path: 9, index: 0 } },
      { kind: "created", anchor: { kind: "result" }, slot: { kind: "capture", path: 0, index: -0 } },
    ]) assert.equal(completeVerification(verifyCells(arena([row(0, role)]), owner, context(), verificationAccount())).length > 0, true);
    for (const changed of [
      { ...context(), types: { terms: [], signatures: [] } },
      { ...context(), types: { terms: [], signatures: [{ ...signature, receiver: null }] } },
    ]) assert.equal(completeVerification(verifyCells(arena([row(0, { kind: "created", anchor: { kind: "receiver" }, slot: { kind: "entity" } })]), owner, changed, verificationAccount())).length > 0, true);
    const summaryOwner = { kind: "summary", key: { kind: "body", execution } };
    assert.deepEqual(completeVerification(verifyCells(arena([row(0, { kind: "capture", index: 0 })]), summaryOwner, context(), verificationAccount())), []);
    assert.equal(completeVerification(verifyCells(arena([row(0, { kind: "capture", index: 0 })]), summaryOwner,
      { ...context(), captureCount: () => null }, verificationAccount())).length > 0, true);
    const declared = { kind: "summary", key: { kind: "declared", execution: {
      request: { definition, endpoint: "api-signature", ordinal: 0, bindings: execution.instance.bindings }, provided: 0 } } };
    assert.equal(completeVerification(verifyCells(arena([row(0, { kind: "local", local: 0 }, { kind: "declared", at: { kind: "node", node: source } })]),
      declared, context(), verificationAccount())).length > 0, true);
    const sparseMir = { ...mir, blocks: [{ id: 0, statements: new Array(1) }] };
    assert.equal(completeVerification(verifyCells(arena([row(0, { kind: "detached" }, statement(0))]), owner,
      { ...context(), mirBody: () => sparseMir }, verificationAccount())).length > 0, true);
  });

  await suite.test("one cell inventory contributes its actual instance, static and physical binding occurrences", () => {
    const vector = binding();
    const instantiated = { kind: "instantiated", bindings: vector };
    const selected = { ...execution, instance: { ...execution.instance, bindings: instantiated } };
    const rows = [
      row(0, { kind: "static", declaration: { definition, bindings: instantiated } }),
      row(1, { kind: "created", anchor: { kind: "static", declaration: { definition, bindings: instantiated } }, slot: { kind: "entity" } }),
      row(2, { kind: "created", anchor: { kind: "result" }, slot: { kind: "field", member } },
        { kind: "statement", execution: selected, point: point(1) }),
    ];
    rows[2].lifetimes = [{ kind: "live", execution: selected, point: point(0), local: 3 }];
    const value = summary(rows);
    value.arena.projections = [];
    const inputs = [...summaryBindingInputs(value, context())].filter(value => value !== null);
    assert.deepEqual(inputs.map(value => value.site.cell), [0, 1, 2, 2, 2]);
    assert.deepEqual(inputs.map(value => value.definition), [definition, definition, definition, definition, definition]);
    assert.deepEqual(inputs.map(value => value.vector), [vector, vector, member.bindings, vector, vector]);
    assert.deepEqual(relationalUsage(value.arena, verificationAccount()).value, { records: 5, references: 5, depth: 0, alternatives: 0 });
    const sparse = summary(new Array(1));
    sparse.arena.projections = [];
    assert.deepEqual([...summaryBindingInputs(sparse, context())].filter(value => value !== null), []);
    assert.deepEqual(relationalUsage(sparse.arena, verificationAccount()).value, { records: 2, references: 0, depth: 0, alternatives: 0 });
  });
}
