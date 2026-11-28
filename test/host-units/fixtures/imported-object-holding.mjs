import assert from "node:assert/strict";
import { checkReachedProofCuts } from "./dataflow-cuts.mjs";

export async function checkImportedObjectHolding() {
  const { loadFrontFixture } = await import("./front/checked-module.mjs");
  const { analysisInput } = await import("./front/analysis-input.mjs");
  const { captureSourceBarrier } = await import("../../../packages/host/dist/pipeline/source-barrier.js");
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { checkedSourceBindingFieldOf } = await import("../../../packages/host/dist/ir-hir/index.js");
  const { readType } = await import("../../../packages/host/dist/ir-types/index.js");
  const { accountFailure, chargeWork, chargeResultEntries, createAccount } = await import("../../../packages/host/dist/dataflow/index.js");
  const { InvocationAccount } = await import("../../../packages/host/dist/dataflow/account.js");
  const fixture = await loadFrontFixture();
  const main = `
    import type { Alias } from "./bridge.js";
    export function read(input: Alias): boolean {
      const { flag: selected } = input;
      return !selected;
    }
  `;
  for (const [kind, bridge] of [
    ["named", 'import type { Shape } from "./base.js"; export type Alias = Shape;'],
    ["re-export", 'export type { Shape as Alias } from "./base.js";'],
    ["star", 'export type * from "./source.js";'],
  ]) {
    const input = analysisInput(fixture, "sdk-minimal", main);
    input.snapshot = fixture.projectSnapshot({ sourceFiles: {
      "main.ts": main, "bridge.ts": bridge, "source.ts": 'export type { Shape as Alias } from "./base.js";',
      "base.ts": "export type Shape = { flag: boolean; other: boolean }; export type Decoy = { flag: boolean; other: boolean };",
    }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
    const result = captureSourceBarrier(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { checked, modules, types, bindingOf } = result.value;
    const root = modules.find(row => row.module.module === input.snapshot.entryPoint).module;
    const callable = root.tree.statements.nodes.find(row => row.kind === "FunctionDeclaration");
    const [storage, decoy] = modules.flatMap(row => row.module.tree.statements.nodes)
      .filter(row => row.kind === "TypeAliasDeclaration" && ["Shape", "Decoy"].includes(row.name.text));
    const field = storage.type.members.nodes[0].name.tsonic.declaration.definition;
    const body = checked.bodies.get(callable.tsonic.body);
    const element = body.root.statements.nodes[0].declarationList.declarations.nodes[0].name.elements.nodes[0];
    const annotation = callable.parameters.nodes[0].type;
    assert.deepEqual(annotation.tsonic.referencedDefinitions, []);
    const original = annotation.typeName.tsonic.resolution.occurrence;
    const prove = (account, observe = () => {}, crossed = false) => {
      const proof = checkedSourceBindingFieldOf(body, element, element.propertyName.tsonic.key.value, field, {
        bodyOf: id => checked.bodies.get(id) ?? null, nodeOf: checked.nodeOf,
        itemOf: definition => {
          const occurrence = checked.declarationSourceOf(definition);
          return occurrence === null ? null : checked.nodeOf(occurrence);
        },
        bindingOf: occurrence => {
          const state = InvocationAccount.stateOf(account);
          observe({ occurrence, work: state.work, entries: state.entries });
          const row = bindingOf(occurrence);
          if (!crossed || row?.target.kind !== "available" || row.target.value.kind !== "declarations"
            || row.target.value.definitions[0] !== storage.tsonic.definition) return row;
          return { ...row, target: { kind: "available", value: { kind: "declarations", definitions: [decoy.tsonic.definition] } } };
        },
        typeOf: id => readType(types, id),
        admit: (work, records) => (chargeWork(account, work) ?? chargeResultEntries(account, records)) === null,
      });
      return accountFailure(account) ?? { kind: "complete", value: proof === null ? null : [proof.declaration, proof.field] };
    };
    const expected = [storage.tsonic.definition, field];
    checkReachedProofCuts(InvocationAccount.stateOf, prove, expected, `${kind} object alias proof`);
    const visits = [];
    assert.deepEqual(prove(createAccount(input.limits.dataflow), row => visits.push(row)), { kind: "complete", value: expected });
    assert.equal(visits.length, 2);
    assert.deepEqual(visits[0].occurrence, original);
    assert.notDeepEqual(visits[0].occurrence, visits[1].occurrence);
    for (const [limit, count] of [["maximumWork", "work"], ["maximumResultEntries", "entries"]]) {
      const stop = createAccount({ ...input.limits.dataflow, [limit]: visits[1][count] - 1 });
      const reached = [];
      assert.equal(prove(stop, row => reached.push(row)) === accountFailure(stop), true);
      assert.ok(accountFailure(stop));
      assert.deepEqual(reached, visits.slice(0, 1), `${kind}: no next qualified read at ${limit}`);
    }
    assert.deepEqual(prove(createAccount(input.limits.dataflow), () => {}, true), { kind: "complete", value: null });
    const published = analyzeHostProgram(input);
    assert.equal(published.kind, "ok", JSON.stringify(published.diagnostics));
    const ready = published.value.modules.find(row => row.module === root.module).bodies
      .find(row => row.kind === "selected" && row.instance.body === body.body);
    const places = ready.mir.places.filter(row => row.base.kind === "place" && row.base.projection.kind === "field");
    assert.deepEqual(places.map(row => [row.base.tir.node, row.base.projection.member.decision.primary]), [[element.id, field]]);
  }
}
