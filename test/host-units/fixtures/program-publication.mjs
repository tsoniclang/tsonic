import { moduleFixture, encodeContextKey } from "../ir-program-fixtures.mjs";
import { sameInstance } from "../../../packages/host/dist/ir-types/index.js";
import { summaryKey } from "../../../packages/host/dist/ir-facts/index.js";

export function publicationFixture(fixture = moduleFixture()) {
  const original = fixture.module.bodies[0];
  const record = fixture.index.bodies.find(row => sameInstance(row.instance, original.instance));
  const template = { kind: "template", instance: original.instance, tir: original.tir };
  const instance = { body: fixture.bodyId, bindings: { kind: "instantiated", bindings: original.tir.lexicalBindings } };
  const tir = { ...original.tir, bindings: instance.bindings };
  const mir = { ...original.mir, bindings: instance.bindings };
  const facts = { ...original.facts[0], execution: { instance, provided: 0 } };
  const selected = { kind: "selected", instance, tir, mir, facts: [facts], observations: { instance, rows: [] } };
  fixture.module.bodies = [template, selected];
  fixture.index.bodies = fixture.index.bodies.flatMap(row => sameInstance(row.instance, original.instance) ? [
    { kind: "template", instance: template.instance, module: record.module, owner: record.owner, root: record.root },
    { ...record, kind: "selected", instance },
  ] : [row]);
  fixture.index.dependencyInventory.operations = fixture.index.dependencyInventory.operations.map(row =>
    row.kind === "body" && sameInstance(row.execution.instance, original.instance)
      ? { kind: "body", execution: { ...row.execution, instance } } : row);
  const selectExecution = execution => sameInstance(execution.instance, original.instance) ? { ...execution, instance } : execution;
  fixture.index.initialization = { ...fixture.index.initialization,
    modules: fixture.index.initialization.modules.map(selectExecution), entries: fixture.index.initialization.entries.map(selectExecution) };
  fixture.context.initialization = structuredClone(fixture.index.initialization);
  fixture.tirInput.module.bodies = [template.tir, selected.tir];
  const summary = { kind: "body", execution: facts.execution };
  const summaryArena = { ...facts.arena, origins: [{ id: 0, kind: "complete", producers: [], includesAbsence: false }] };
  fixture.index.summaries.push({ key: summary, signature: tir.signature, arena: summaryArena, parameters: [], captures: [],
    result: 0, thrown: 0, writes: [], retention: [], callbacks: [], suspends: false, bindingDependent: false,
    concurrentWrites: [], contentsOnReturn: [], contentsOnUnwind: [], returns: true, unwinds: false,
    initialization: { cells: [], events: [], conditions: [{ alternatives: [] }, { alternatives: [[]] }],
      points: [{ kind: "return" }], rows: [{ point: 0, cell: null, condition: 0 }] }, resultCells: [], backing: [] });
  fixture.index.summaries.sort((left, right) => summaryKey(left.key) < summaryKey(right.key) ? -1 : 1);
  for (const [reader, key, value] of [
    ["bodyOf", instance, tir], ["tirBody", instance, tir], ["mirBody", instance, mir],
    ["tirBindingScopesOf", { kind: "body", instance }, [fixture.scope, fixture.scope, fixture.scope]],
    ["sourceBindingScopesOf", { kind: "body", execution: { instance, provided: 0 } }, [fixture.scope]],
    ["sourceBindingScopesOf", { kind: "observations", instance }, [fixture.scope]],
    ["arenaOf", { kind: "body", execution: facts.execution }, facts.arena],
    ["arenaOf", { kind: "summary", key: summary }, summaryArena],
    ["captureCount", summary, tir.captures.length],
    ["sourceBindingScopesOf", { kind: "summary", summary }, []],
  ]) fixture.answers.set(encodeContextKey([reader, key]), value);
  return { ...fixture, instance, template, selected };
}
