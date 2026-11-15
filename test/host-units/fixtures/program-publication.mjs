import { moduleFixture, encodeContextKey } from "../ir-program-fixtures.mjs";
import { sameInstance } from "../../../packages/host/dist/ir-types/index.js";

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
  fixture.tirInput.module.bodies = [template.tir, selected.tir];
  for (const [reader, key, value] of [
    ["bodyOf", instance, tir], ["tirBody", instance, tir], ["mirBody", instance, mir],
    ["tirBindingScopesOf", { kind: "body", instance }, [fixture.scope, fixture.scope, fixture.scope]],
    ["bindingScopesOf", { kind: "body", instance }, [fixture.scope]],
    ["bindingScopesOf", { kind: "observations", instance }, [fixture.scope]],
    ["arenaOf", { kind: "body", execution: facts.execution }, facts.arena],
  ]) fixture.answers.set(encodeContextKey([reader, key]), value);
  return { ...fixture, instance, template, selected };
}
