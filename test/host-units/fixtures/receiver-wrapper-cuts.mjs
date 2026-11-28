import assert from "node:assert/strict";
import { checkReachedProofCuts } from "./dataflow-cuts.mjs";

export async function checkReceiverWrapperCuts() {
  const { loadFrontFixture } = await import("./front/checked-module.mjs");
  const { analysisInput } = await import("./front/analysis-input.mjs");
  const { captureSourceBarrier } = await import("../../../packages/host/dist/pipeline/source-barrier.js");
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { checkedSourceBindingFieldOf } = await import("../../../packages/host/dist/ir-hir/index.js");
  const { readType } = await import("../../../packages/host/dist/ir-types/index.js");
  const { accountFailure, chargeWork, chargeResultEntries, createAccount } = await import("../../../packages/host/dist/dataflow/index.js");
  const { InvocationAccount } = await import("../../../packages/host/dist/dataflow/account.js");
  const fixture = await loadFrontFixture();
  let unwrapped = null;
  for (const depth of [0, 3]) {
    const wrap = name => "(".repeat(depth) + name + ")".repeat(depth);
    const input = analysisInput(fixture, "sdk-minimal", `
      type Box = { flag: boolean };
      export function read(input: Box): boolean {
        const alias = ${wrap("input")};
        const { flag: selected } = ${wrap("alias")};
        return !selected;
      }
    `);
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok", JSON.stringify(captured.diagnostics));
    const { checked, modules, types, bindingOf } = captured.value;
    const module = modules.find(row => row.module.module === input.snapshot.entryPoint).module;
    const [box, callable] = module.tree.statements.nodes;
    const body = checked.bodies.get(callable.tsonic.body);
    const [alias, binding] = body.root.statements.nodes.slice(0, 2).map(row => row.declarationList.declarations.nodes[0]);
    const element = binding.name.elements.nodes[0];
    const field = box.type.members.nodes[0].tsonic.declaration.definition;
    let observe = () => {};
    for (const [role, source] of [["binding", binding.initializer], ["alias", alias.initializer]]) {
      let node = source;
      for (let level = 0; node.kind === "ParenthesizedExpression"; level += 1) {
        const child = node.expression;
        Object.defineProperty(node, "expression", { get() { observe(role, level); return child; } });
        node = child;
      }
    }
    const prove = (account, reads = []) => {
      const state = InvocationAccount.stateOf(account);
      observe = (role, level) => reads.push([role, level, state.work]);
      const proof = checkedSourceBindingFieldOf(body, element, element.propertyName.tsonic.key.value, field, {
        bodyOf: id => checked.bodies.get(id) ?? null, nodeOf: checked.nodeOf, bindingOf,
        itemOf: id => checked.nodeOf(checked.declarationSourceOf(id)), typeOf: id => readType(types, id),
        admit: (work, records) => (chargeWork(account, work) ?? chargeResultEntries(account, records)) === null,
      });
      return accountFailure(account) ?? { kind: "complete", value: proof?.field ?? null };
    };
    checkReachedProofCuts(InvocationAccount.stateOf, prove, field, "paid receiver wrapper proof");
    const account = createAccount(input.limits.dataflow);
    const reads = [];
    assert.deepEqual(prove(account, reads), { kind: "complete", value: field });
    const { work, entries } = InvocationAccount.stateOf(account);
    if (depth === 0) {
      assert.deepEqual(reads, []);
      unwrapped = { work, entries };
    } else {
      assert.deepEqual({ work, entries }, { work: unwrapped.work + 2 * depth, entries: unwrapped.entries });
      assert.deepEqual(reads.map(([role, level]) => [role, level]), [
        ["binding", 0], ["binding", 1], ["binding", 2], ["alias", 0], ["alias", 1], ["alias", 2],
      ]);
      for (const [index, [, , reached]] of reads.entries()) {
        const cut = createAccount({ ...input.limits.dataflow, maximumWork: reached - 1 });
        const prefix = [];
        assert.equal(prove(cut, prefix) === accountFailure(cut), true);
        assert.ok(accountFailure(cut));
        assert.deepEqual(prefix, reads.slice(0, index), "no expression getter at the unadmitted wrapper");
      }
    }
    const published = analyzeHostProgram(input);
    assert.equal(published.kind, "ok", JSON.stringify(published.diagnostics));
    const ready = published.value.modules.find(row => row.module === module.module).bodies
      .find(row => row.kind === "selected" && row.instance.body === body.body);
    const fields = ready.mir.places.filter(row => row.base.kind === "place" && row.base.projection.kind === "field");
    assert.deepEqual(fields.map(row => row.base.projection.member.decision.primary), [field]);
  }
}
