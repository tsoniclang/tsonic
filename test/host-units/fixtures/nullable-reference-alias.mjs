import assert from "node:assert/strict";
import { analysisInput } from "./front/analysis-input.mjs";
import { loadFrontFixture } from "./front/checked-module.mjs";
import { checkReachedProofCuts } from "./dataflow-cuts.mjs";

export async function checkNullableReferenceAliases() {
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const fixture = await loadFrontFixture();
  const cases = [
    ["alias through a selected field", "type Box = { flag: boolean }; type Maybe = Box | null;",
      "input: { part: Maybe }, flag: boolean", "const saved = input.part; if (saved !== null) return saved.flag; return flag;", ["part", "part.flag"]],
    ["mutable aliased storage", "type Box = { flag: boolean }; type Maybe = Box | null;",
      "input: { part: Box | null }, flag: boolean",
      "let saved: Maybe = input.part; if (flag) saved = null; if (saved !== null) return saved.flag; return flag;", ["part", "part.flag"]],
    ["actual grouped alias chain", "type Box = ({ flag: boolean }); type Earlier = ((Box) | null); type Maybe = (Earlier);",
      "input: Maybe, flag: boolean", "if (input !== null) return input.flag; return flag;", ["flag"]],
    ["actual inline literal with unified absence", "type Maybe = (({ flag: boolean }) | undefined | (null));",
      "input: Maybe, flag: boolean", "if (input != null) return input.flag; return flag;", ["flag"]],
    ["imported alias", 'import type { Maybe } from "./model.js";',
      "input: { part: Maybe }, flag: boolean",
      "let saved: Maybe = input.part; if (flag) saved = null; if (saved != null) return saved.flag; return flag;", ["part", "part.flag"], true],
    ["authored import-type annotation", "", 'input: import("./model.js").Maybe, flag: boolean',
      "if (input != null) return input.flag; return flag;", ["flag"], true],
  ];
  for (const [label, header, formals, statements, paths, imported = false] of cases) {
    const text = `${header} export function read(${formals}): boolean { ${statements} }`;
    const ordinary = analysisInput(fixture, "sdk-minimal", text);
    const snapshot = imported
      ? fixture.projectSnapshot({ sourceFiles: { "main.ts": text, "model.ts": "export type Maybe = ({ flag: boolean } | null | undefined);" },
        libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] })
      : ordinary.snapshot;
    const result = analyzeHostProgram({ ...ordinary, snapshot });
    assert.equal(result.kind, "ok", label);
    assert.deepEqual(result.diagnostics, [], label);
    const chapter = result.value.modules.find(row => row.module === snapshot.entryPoint);
    const selected = chapter.bodies.find(row => row.kind === "selected" && row.instance.body.includes(";read];function;0]"));
    const checks = selected.mir.blocks.filter(row => row.terminator.kind === "check");
    assert.equal(checks.length, 1, label);
    const proof = selected.facts[0].refinements.refinements;
    assert.equal(proof.length, 1, label);
    assert.equal(proof[0].kind, "proven", label);
    assert.equal(proof[0].node, checks[0].terminator.tir.node, label);
    const summary = result.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === selected.instance.body);
    const names = path => {
      const keys = [];
      while (path !== null) {
        const row = summary.arena.projections[path];
        assert.equal(row.projection.kind, "field", label);
        keys.unshift(row.projection.member.decision.key.value);
        path = row.parent;
      }
      return keys.join(".");
    };
    assert.deepEqual(summary.parameters[0].reads.paths.map(names).sort(), paths, label);
  }
}

export async function checkNullableReferenceAliasQualification() {
  const { captureSourceBarrier } = await import("../../../packages/host/dist/pipeline/source-barrier.js");
  const { checkedSourceObjectFieldsOf } = await import("../../../packages/host/dist/ir-hir/index.js");
  const { readType } = await import("../../../packages/host/dist/ir-types/index.js");
  const { accountFailure, chargeWork, chargeResultEntries, createAccount } = await import("../../../packages/host/dist/dataflow/index.js");
  const { InvocationAccount } = await import("../../../packages/host/dist/dataflow/account.js");
  const input = analysisInput(await loadFrontFixture(), "sdk-minimal", `
    type Box = { flag: boolean };
    type Selected = ((Box | null));
    type Other = Box | null;
    export function read(input: Selected): boolean {
      if (input !== null) return input.flag;
      return false;
    }
  `);
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const source = captured.value;
  const { checked } = source;
  const root = source.modules.find(row => row.module.module === input.snapshot.entryPoint).module.tree;
  const [box, selected, other] = root.statements.nodes;
  assert.equal(selected.tsonic.type.value, other.tsonic.type.value);
  const body = [...checked.bodies.values()].find(row => row.body.includes(";read];function;0]"));
  const operand = body.root.statements.nodes[0].expression.left;
  const read = (account, crossed = false) => {
    const setup = chargeWork(account, 1) ?? chargeResultEntries(account, 3);
    if (setup !== null) return setup;
    const fields = checkedSourceObjectFieldsOf(body, {
      bodyOf: id => checked.bodies.get(id) ?? null,
      nodeOf: checked.nodeOf,
      itemOf: definition => {
        if (crossed && definition === selected.tsonic.definition) return other;
        const reference = checked.declarationSourceOf(definition);
        return reference === null ? null : checked.nodeOf(reference);
      },
      bindingOf: source.bindingOf,
      typeOf: id => readType(source.types, id),
      admit: (work, records) => (chargeWork(account, work) ?? chargeResultEntries(account, records)) === null,
    });
    const value = fields.presence(operand, "read");
    return accountFailure(account) ?? { kind: "complete", value };
  };
  checkReachedProofCuts(InvocationAccount.stateOf, read, { storage: selected.tsonic.type.value, present: box.tsonic.type.value },
    "actual alias and grouped storage annotation");
  const group = selected.type;
  assert.equal(group.kind, "ParenthesizedType");
  const inner = Object.getOwnPropertyDescriptor(group, "type");
  let active = createAccount(input.limits.dataflow);
  let reads = 0;
  let openedAt = 0;
  Object.defineProperty(group, "type", { configurable: true, enumerable: inner.enumerable, get() {
    reads += 1;
    openedAt = InvocationAccount.stateOf(active).work;
    return inner.value;
  } });
  try {
    assert.equal(read(active).kind, "complete");
    assert.equal(reads, 1);
    active = createAccount({ ...input.limits.dataflow, maximumWork: openedAt - 1 });
    const stop = read(active);
    assert.notEqual(stop, null);
    assert.equal(stop, accountFailure(active));
    assert.equal(read(active), stop);
    assert.equal(reads, 1);
  } finally {
    Object.defineProperty(group, "type", inner);
  }
  const payload = Object.getOwnPropertyDescriptor(other, "type");
  Object.defineProperty(other, "type", { configurable: true, enumerable: payload.enumerable,
    get: () => assert.fail("A same-type alias with a different definition cannot offer its annotation.") });
  try {
    assert.deepEqual(read(createAccount(input.limits.dataflow), true), { kind: "complete", value: null });
  } finally {
    Object.defineProperty(other, "type", payload);
  }
}
