import assert from "node:assert/strict";
import { checkReachedProofCuts } from "./dataflow-cuts.mjs";

export async function checkNamedBindingSelectors() {
  const { loadFrontFixture } = await import("./front/checked-module.mjs");
  const { analysisInput } = await import("./front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../../packages/host/dist/pipeline/source-barrier.js");
  const { checkedBindingKeyOf, checkedSourceBindingFieldOf } = await import("../../../packages/host/dist/ir-hir/index.js");
  const { parseModuleBodies, printModuleBodies } = await import("../../../packages/host/dist/ir-program/index.js");
  const { accountFailure, chargeResultEntries, chargeWork, createAccount } = await import("../../../packages/host/dist/dataflow/index.js");
  const { InvocationAccount } = await import("../../../packages/host/dist/dataflow/account.js");
  const { readType } = await import("../../../packages/host/dist/ir-types/index.js");
  const input = analysisInput(await loadFrontFixture(), "sdk-minimal", `
    export function read(input: { value: boolean; "literal-field": boolean; selected: boolean }): boolean {
      const { value: named, "value": quoted, "literal\\u002dfield": selected } = input;
      return (named && quoted) || selected;
    }
  `);
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok", JSON.stringify(captured.diagnostics));
  const { checked, modules, types } = captured.value;
  const source = modules.find(row => row.module.module === input.snapshot.entryPoint).module;
  const [callable] = source.tree.statements.nodes;
  const checkedBody = checked.bodies.get(callable.tsonic.body);
  const pattern = checkedBody.root.statements.nodes[0].declarationList.declarations.nodes[0].name;
  const [named, quoted, escaped] = pattern.elements.nodes;
  assert.deepEqual(pattern.elements.nodes.map(checkedBindingKeyOf),
    ["value", "value", "literal-field"].map(value => ({ kind: "text", value })));
  assert.equal(checkedBindingKeyOf({ ...escaped, propertyName: { ...escaped.propertyName,
    tsonic: { ...escaped.propertyName.tsonic, key: named.propertyName.tsonic.key } } }), null);
  const [valueField, literalField, sibling] = callable.parameters.nodes[0].type.members.nodes;
  const literalDefinition = literalField.name.tsonic.declaration.definition;
  const siblingDefinition = sibling.name.tsonic.declaration.definition;
  const prove = (account, element, definition) => {
    const proof = checkedSourceBindingFieldOf(checkedBody, element, escaped.propertyName.tsonic.key.value, definition, {
      bodyOf: id => checked.bodies.get(id) ?? null, nodeOf: checked.nodeOf, bindingOf: captured.value.bindingOf,
      itemOf: id => {
        const occurrence = checked.declarationSourceOf(id);
        return occurrence === null ? null : checked.nodeOf(occurrence);
      },
      typeOf: id => readType(types, id),
      admit: (work, entries) => (chargeWork(account, work) ?? chargeResultEntries(account, entries)) === null,
    });
    return accountFailure(account) ?? { kind: "complete", value: proof?.field ?? null };
  };
  checkReachedProofCuts(InvocationAccount.stateOf, account => prove(account, escaped, literalDefinition), literalDefinition, "literal binding key");
  assert.deepEqual(prove(createAccount(input.limits.dataflow), escaped, siblingDefinition), { kind: "complete", value: null });
  assert.deepEqual(prove(createAccount(input.limits.dataflow), { ...escaped }, literalDefinition), { kind: "complete", value: null });

  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const body = chapter.bodies.find(row => row.kind === "selected" && row.instance.body === checkedBody.body);
  const elements = body.tir.root.statements.nodes[0].declarationList.declarations.nodes[0].name.elements.nodes;
  const expectedKeys = ["value", "value", "literal-field"];
  const expectedFields = [valueField.name.tsonic.declaration.definition, valueField.name.tsonic.declaration.definition, literalDefinition];
  assert.deepEqual(elements.map(row => [row.propertyName.kind, row.propertyName.text, row.name.text]),
    [["Identifier", "value", "named"], ["StringLiteral", "value", "quoted"], ["StringLiteral", "literal-field", "selected"]]);
  assert.deepEqual(elements.map(row => row.propertyName.tsonic.key.value), expectedKeys);
  assert.deepEqual(elements.map(row => row.tsonic.field.decision.primary), expectedFields);
  assert.deepEqual(elements.map(row => row.propertyName.id), [named.propertyName.id, quoted.propertyName.id, escaped.propertyName.id]);
  const reads = body.mir.places.filter(place => place.base.kind === "place" && place.base.projection.kind === "field");
  assert.deepEqual(reads.map(row => [row.base.tir.node, row.base.projection.member.decision.primary]),
    elements.map((row, index) => [row.id, expectedFields[index]]));
  const printed = printModuleBodies(result.value.index, chapter);
  const parsed = parseModuleBodies(result.value.index, printed);
  assert.equal(parsed.kind, "parsed");
  assert.equal(printModuleBodies(result.value.index, parsed.value) === printed, true);
}
