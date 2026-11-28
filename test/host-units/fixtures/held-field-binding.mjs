import assert from "node:assert/strict";
import { checkReachedProofCuts } from "./dataflow-cuts.mjs";

export async function checkHeldFieldBinding() {
  const { loadFrontFixture } = await import("./front/checked-module.mjs");
  const { analysisInput } = await import("./front/analysis-input.mjs");
  const { captureSourceBarrier } = await import("../../../packages/host/dist/pipeline/source-barrier.js");
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { checkedSourceBindingFieldOf } = await import("../../../packages/host/dist/ir-hir/index.js");
  const { readType } = await import("../../../packages/host/dist/ir-types/index.js");
  const { accountFailure, chargeWork, chargeResultEntries, createAccount } = await import("../../../packages/host/dist/dataflow/index.js");
  const { InvocationAccount } = await import("../../../packages/host/dist/dataflow/account.js");
  const input = analysisInput(await loadFrontFixture(), "sdk-minimal", `
    type Child = { flag: boolean; other: boolean };
    type Decoy = { flag: boolean; other: boolean };
    export function required(input: { child: Child }): boolean {
      const { flag: selected } = input.child;
      return !selected;
    }
    export function guarded(input: { child: Child | null }): boolean {
      if (input.child !== null) {
        const { flag: selected } = input.child;
        return !selected;
      }
      return false;
    }
  `, ["required", "guarded"]);
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok", JSON.stringify(captured.diagnostics));
  const { types, checked, modules } = captured.value;
  const [child, decoy, required, guarded] = modules.find(row => row.module.module === input.snapshot.entryPoint).module.tree.statements.nodes;
  const fieldOf = (declaration, position) => declaration.type.members.nodes[position].name.tsonic.declaration.definition;
  const actualField = fieldOf(child, 0);
  const oppositeField = fieldOf(decoy, 0);
  assert.notEqual(actualField, oppositeField);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
  for (const [callable, guardedCase] of [[required, false], [guarded, true]]) {
    const body = checked.bodies.get(callable.tsonic.body);
    const statements = guardedCase ? body.root.statements.nodes[0].thenStatement.statements.nodes : body.root.statements.nodes;
    const declaration = statements[0].declarationList.declarations.nodes[0];
    const receiver = declaration.initializer;
    const element = declaration.name.elements.nodes[0];
    const sourceField = callable.parameters.nodes[0].type.members.nodes[0].name.tsonic.declaration.definition;
    const prove = (account, field = actualField) => {
      const proof = checkedSourceBindingFieldOf(body, element, element.propertyName.tsonic.key.value, field, {
        bodyOf: id => checked.bodies.get(id) ?? null, nodeOf: checked.nodeOf, bindingOf: captured.value.bindingOf,
        itemOf: id => {
          const occurrence = checked.declarationSourceOf(id);
          return occurrence === null ? null : checked.nodeOf(occurrence);
        },
        typeOf: id => readType(types, id),
        admit: (work, entries) => (chargeWork(account, work) ?? chargeResultEntries(account, entries)) === null,
      });
      return accountFailure(account) ?? { kind: "complete", value: proof === null ? null
        : [proof.occurrence.node, proof.field, proof.declaration, proof.parent?.occurrence.node, proof.parent?.field] };
    };
    checkReachedProofCuts(InvocationAccount.stateOf, prove, [element.id, actualField, sourceField, receiver.id, sourceField],
      guardedCase ? "guarded held field binding" : "required held field binding");
    for (const crossed of [oppositeField, fieldOf(child, 1)]) {
      assert.deepEqual(prove(createAccount(input.limits.dataflow), crossed), { kind: "complete", value: null });
    }
    const selected = chapter.bodies.find(row => row.kind === "selected" && row.instance.body === body.body);
    const places = selected.mir.places.filter(row => row.base.kind === "place" && row.base.projection.kind === "field");
    assert.deepEqual(places.filter(row => row.base.tir.node === receiver.id).map(row => row.base.projection.member.decision.primary), [sourceField]);
    assert.deepEqual(places.filter(row => row.base.tir.node === element.id).map(row => row.base.projection.member.decision.primary), [actualField]);
    assert.equal(selected.facts[0].refinements.refinements.some(row => row.kind === "proven"), guardedCase);
    const summary = result.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === body.body);
    const projected = summary.parameters[0].reads.paths.map(path => summary.arena.projections[path]);
    const leaf = projected.find(row => row.projection.member.decision.primary === actualField);
    assert.ok(leaf, "the actual input owns the selected nested read");
    assert.equal(summary.arena.projections[leaf.parent].projection.member.decision.primary, sourceField);
  }
}
