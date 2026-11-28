import assert from "node:assert/strict";
import { checkReachedProofCuts } from "./dataflow-cuts.mjs";

export async function checkHeldReferenceArgument() {
  const { loadFrontFixture } = await import("./front/checked-module.mjs");
  const { analysisInput } = await import("./front/analysis-input.mjs");
  const { captureSourceBarrier } = await import("../../../packages/host/dist/pipeline/source-barrier.js");
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { checkedReferenceArgumentViewOf } = await import("../../../packages/host/dist/ir-hir/index.js");
  const { readSignature, readType } = await import("../../../packages/host/dist/ir-types/index.js");
  const { accountFailure, chargeWork, chargeResultEntries, createAccount } = await import("../../../packages/host/dist/dataflow/index.js");
  const { InvocationAccount } = await import("../../../packages/host/dist/dataflow/account.js");
  const fixture = await loadFrontFixture();
  for (const mode of ["required", "guarded", "parenthesized"]) {
    const argument = mode === "parenthesized" ? "(input.part)" : "input.part";
    const input = analysisInput(fixture, "sdk-minimal", `
      type Actual = { flag: boolean; other: boolean };
      type Formal = { other: boolean; flag: boolean };
      function choose(input: Formal): boolean { return input.flag; }
      export function read(input: { part: Actual${mode === "guarded" ? " | null" : ""}; sibling: Actual }): boolean {
        ${mode === "guarded" ? "if (input.part !== null) { return choose(input.part); } return false;" : `return choose(${argument});`}
      }
    `);
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok", JSON.stringify(captured.diagnostics));
    const { checked, modules, types, bindingOf } = captured.value;
    const module = modules.find(row => row.module.module === input.snapshot.entryPoint).module;
    const [actual, formal, choose, read] = module.tree.statements.nodes;
    const body = checked.bodies.get(read.tsonic.body);
    const head = body.root.statements.nodes[0];
    const call = (head.kind === "IfStatement" ? head.thenStatement.statements.nodes[0] : head).expression;
    const authored = call.arguments.nodes[0];
    const projected = authored.kind === "ParenthesizedExpression" ? authored.expression : authored;
    const direct = property => property.tsonic.declaration.definition;
    const [part, sibling] = read.parameters.nodes[0].type.members.nodes.map(direct);
    const field = (alias, name) => direct(alias.type.members.nodes.find(row => row.name.text === name));
    const expected = ["flag", "other"].map(key => [field(actual, key), field(formal, key)]);
    assert.ok(expected.every(([caller, callee]) => caller !== callee));
    const endpoint = choose.tsonic.signatures.find(row => row.role === "api-body");
    const site = { body, argument: { body: body.body, node: authored.id }, caller: projected.tsonic.value.views.read.value,
      endpoint, ordinal: 0, formal: readSignature(types, endpoint.signature).parameters[0] };
    const views = (account, crossed = false) => {
      const proof = checkedReferenceArgumentViewOf(site, {
        bodyOf: id => checked.bodies.get(id) ?? null, nodeOf: checked.nodeOf, bindingOf,
        itemOf: definition => {
          const source = checked.declarationSourceOf(crossed && definition === part ? sibling : definition);
          return source === null ? null : checked.nodeOf(source);
        },
        typeOf: type => readType(types, type),
        admit: (work, records) => (chargeWork(account, work) ?? chargeResultEntries(account, records)) === null,
      });
      return accountFailure(account) ?? { kind: "complete", value: proof?.fields.map(row => [row.caller, row.formal]) ?? null };
    };
    checkReachedProofCuts(InvocationAccount.stateOf, views, expected, `${mode} reference view`);
    assert.deepEqual(views(createAccount(input.limits.dataflow), true), { kind: "complete", value: null });

    const compiled = analyzeHostProgram(input);
    assert.equal(compiled.kind, "ok", JSON.stringify(compiled.diagnostics));
    const chapter = compiled.value.modules.find(row => row.module === module.module);
    const selected = chapter.bodies.find(row => row.kind === "selected" && row.instance.body === body.body);
    const invocation = selected.mir.blocks.find(row => row.terminator.kind === "call").terminator;
    const [mapping] = invocation.callee.resolution.decision.parameters;
    assert.equal(mapping.kind, "reference-argument");
    assert.equal(mapping.passing, "by-value");
    assert.deepEqual(mapping.view.fields.map(row => [row.caller, row.formal]), expected);
    const places = selected.mir.places.filter(row => row.base.kind === "place" && row.base.projection.kind === "field" && row.base.tir.node === projected.id);
    assert.deepEqual(places.map(row => row.base.projection.member.decision.primary), [part]);
    assert.equal(invocation.arguments[0].operand.kind, "place");
    assert.equal(selected.facts[0].refinements.refinements.some(row => row.kind === "proven"), mode === "guarded");
    const summary = compiled.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === body.body);
    const readPaths = summary.parameters[0].reads.paths.map(path => summary.arena.projections[path]);
    const nested = readPaths.find(row => row.projection.member.decision.primary === field(actual, "flag"));
    assert.ok(nested, "the caller owns the actual reached child field read");
    assert.equal(summary.arena.projections[nested.parent].projection.member.decision.primary, part);
    assert.equal(readPaths.some(row => row.projection.member.decision.primary === sibling), false);
  }
}
