import assert from "node:assert/strict";
import { checkReachedProofCuts } from "./dataflow-cuts.mjs";

export async function checkObjectAliasHolding() {
  const { loadFrontFixture } = await import("./front/checked-module.mjs");
  const { analysisInput } = await import("./front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../../packages/host/dist/pipeline/source-barrier.js");
  const { checkedSourceBindingFieldOf } = await import("../../../packages/host/dist/ir-hir/index.js");
  const { readType } = await import("../../../packages/host/dist/ir-types/index.js");
  const { accountFailure, chargeResultEntries, chargeWork, createAccount } = await import("../../../packages/host/dist/dataflow/index.js");
  const { InvocationAccount } = await import("../../../packages/host/dist/dataflow/account.js");
  const input = analysisInput(await loadFrontFixture(), "sdk-minimal", `
    type TargetStorage = { field: boolean; sibling: boolean };
    type TargetStep = TargetStorage;
    type Target = TargetStep;
    type ActualStorage = { sibling: boolean; field: boolean };
    type Actual = ActualStorage;
    type EqualDecoy = TargetStorage;
    function choose(input: Target): boolean {
      const { field: selected } = input;
      return !selected;
    }
    export function invoke(input: Actual): boolean { return choose(input); }
    export function replace(initial: Target, replacement: Target): boolean {
      let saved = initial;
      saved = replacement;
      const { field: selected } = saved;
      return !selected;
    }
    export function guarded(input: { child: Target | null }): boolean {
      if (input.child !== null) return input.child.field;
      return false;
    }
  `);
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok", JSON.stringify(captured.diagnostics));
  const { modules, checked, types } = captured.value;
  const [storage, intermediate, target, callerStorage, , decoy, choose, invoke, replace, guarded] =
    modules.find(row => row.module.module === input.snapshot.entryPoint).module.tree.statements.nodes;
  assert.equal(decoy.tsonic.type.value, target.tsonic.type.value);
  assert.notEqual(decoy.tsonic.definition, target.tsonic.definition);
  const targetField = storage.type.members.nodes[0].name.tsonic.declaration.definition;
  const callerField = callerStorage.type.members.nodes[1].name.tsonic.declaration.definition;
  assert.notEqual(targetField, callerField);
  const body = checked.bodies.get(choose.tsonic.body);
  const element = body.root.statements.nodes[0].declarationList.declarations.nodes[0].name.elements.nodes[0];
  const prove = (account, observe = () => {}, crossed = false) => {
    const proof = checkedSourceBindingFieldOf(body, element, element.propertyName.tsonic.key.value, targetField, {
      bodyOf: id => checked.bodies.get(id) ?? null, nodeOf: checked.nodeOf,
      itemOf: definition => {
        observe(definition, InvocationAccount.stateOf(account).work);
        const source = checked.declarationSourceOf(crossed && definition === target.tsonic.definition ? decoy.tsonic.definition : definition);
        return source === null ? null : checked.nodeOf(source);
      },
      typeOf: id => readType(types, id),
      admit: (work, entries) => (chargeWork(account, work) ?? chargeResultEntries(account, entries)) === null,
    });
    return accountFailure(account) ?? { kind: "complete", value: proof === null ? null : [proof.declaration, proof.field] };
  };
  const expected = [storage.tsonic.definition, targetField];
  checkReachedProofCuts(InvocationAccount.stateOf, prove, expected, "checked object type alias chain");
  const visits = [];
  assert.deepEqual(prove(createAccount(input.limits.dataflow), (...row) => visits.push(row)), { kind: "complete", value: expected });
  const chain = [target, intermediate, storage].map(row => row.tsonic.definition);
  assert.deepEqual(visits.map(([definition]) => definition), [...chain, targetField]);
  const cut = createAccount({ ...input.limits.dataflow, maximumWork: visits[2][1] - 1 });
  const prefix = [];
  assert.equal(prove(cut, definition => prefix.push(definition)) === accountFailure(cut), true);
  assert.ok(accountFailure(cut));
  assert.deepEqual(prefix, chain.slice(0, 2));
  assert.deepEqual(prove(createAccount(input.limits.dataflow), () => {}, true), { kind: "complete", value: null });

  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const published = callable => chapter.bodies.find(row => row.kind === "selected" && row.instance.body === callable.tsonic.body);
  const fields = callable => published(callable).mir.places.filter(row => row.base.kind === "place" && row.base.projection.kind === "field")
    .map(row => row.base.projection.member.decision.primary);
  assert.deepEqual(fields(choose), [targetField]);
  assert.deepEqual(fields(replace), [targetField]);
  assert.equal(fields(guarded).at(-1), targetField);
  assert.equal(published(guarded).facts[0].refinements.refinements.some(row => row.kind === "proven"), true);
  const call = published(invoke).mir.blocks.find(row => row.terminator.kind === "call").terminator;
  const [argument] = call.callee.resolution.decision.parameters;
  assert.equal(argument.kind, "reference-argument");
  assert.equal(argument.passing, "by-value");
  assert.equal(argument.view.fields.find(row => row.formal === targetField)?.caller, callerField);
}
