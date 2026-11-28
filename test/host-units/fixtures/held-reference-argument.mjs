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
  for (const mode of ["required", "guarded", "parenthesized", "saved", "saved-chain", "saved-rebound", "saved-guarded"]) {
    const saved = mode.startsWith("saved");
    const guardedSave = mode === "saved-guarded";
    const chain = mode === "saved-chain";
    const rebound = mode === "saved-rebound";
    const argument = mode === "parenthesized" ? "(input.part)" : "input.part";
    const storage = `{ part: Actual${mode === "guarded" || guardedSave ? " | null" : ""}; sibling: Actual }`;
    const input = analysisInput(fixture, "sdk-minimal", `
      type Actual = { flag: boolean; other: boolean };
      type Formal = { other: boolean; flag: boolean };
      function choose(input: Formal): boolean { return input.flag; }
      ${rebound ? `type Container = ${storage};` : ""}
      export function read(input: ${chain ? `{ layer: ${storage} }` : rebound ? "Container, other: Container" : storage}): boolean {
        ${mode === "guarded" ? "if (input.part !== null) { return choose(input.part); } return false;"
          : guardedSave ? "if (input.part !== null) { const saved = input.part; return choose(saved); } return false;"
          : chain ? "const layer = input.layer; const saved = layer.part; return choose(saved);"
          : saved ? `const saved = input.part; ${rebound ? "input = other;" : ""} return choose(saved);`
          : `return choose(${argument});`}
      }
    `, ["read"]);
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok", JSON.stringify(captured.diagnostics));
    const { checked, modules, types, bindingOf } = captured.value;
    const module = modules.find(row => row.module.module === input.snapshot.entryPoint).module;
    const [actual, formal, choose] = module.tree.statements.nodes;
    const read = module.tree.statements.nodes.at(-1);
    const body = checked.bodies.get(read.tsonic.body);
    const head = body.root.statements.nodes[0];
    const selectedStatements = head.kind === "IfStatement" ? head.thenStatement.statements.nodes : body.root.statements.nodes;
    const call = selectedStatements.at(-1).expression;
    const authored = call.arguments.nodes[0];
    const projected = authored.kind === "ParenthesizedExpression" ? authored.expression : authored;
    const direct = property => property.tsonic.declaration.definition;
    const container = rebound ? module.tree.statements.nodes[3].type : read.parameters.nodes[0].type;
    const outer = chain ? container.members.nodes[0] : null;
    const [part, sibling] = (outer?.type ?? container).members.nodes.map(direct);
    const savedDecl = saved ? selectedStatements[chain ? 1 : 0].declarationList.declarations.nodes[0] : null;
    const placed = savedDecl === null ? null : checked.bodies.get(savedDecl.tsonic.initializer);
    const crossedPlaced = placed === null ? null : { ...placed, root: { ...placed.root } };
    const field = (alias, name) => direct(alias.type.members.nodes.find(row => row.name.text === name));
    const expected = ["flag", "other"].map(key => [field(actual, key), field(formal, key)]);
    assert.ok(expected.every(([caller, callee]) => caller !== callee));
    const endpoint = choose.tsonic.signatures.find(row => row.role === "api-body");
    const site = { body, argument: { body: body.body, node: authored.id }, caller: projected.tsonic.value.views.read.value,
      endpoint, ordinal: 0, formal: readSignature(types, endpoint.signature).parameters[0] };
    const views = (account, crossed = null) => {
      const proof = checkedReferenceArgumentViewOf(site, {
        bodyOf: id => crossed === "initializer" && id === placed?.body ? crossedPlaced : checked.bodies.get(id) ?? null,
        nodeOf: checked.nodeOf, bindingOf,
        itemOf: definition => {
          const source = checked.declarationSourceOf(crossed === "field" && definition === part ? sibling : definition);
          return source === null ? null : checked.nodeOf(source);
        },
        typeOf: type => readType(types, type),
        admit: (work, records) => (chargeWork(account, work) ?? chargeResultEntries(account, records)) === null,
      });
      return accountFailure(account) ?? { kind: "complete", value: proof?.fields.map(row => [row.caller, row.formal]) ?? null };
    };
    checkReachedProofCuts(InvocationAccount.stateOf, views, expected, `${mode} reference view`);
    assert.deepEqual(views(createAccount(input.limits.dataflow), "field"), { kind: "complete", value: null });
    if (saved) assert.deepEqual(views(createAccount(input.limits.dataflow), "initializer"), { kind: "complete", value: null });

    const compiled = analyzeHostProgram(input);
    assert.equal(compiled.kind, "ok", JSON.stringify(compiled.diagnostics));
    const chapter = compiled.value.modules.find(row => row.module === module.module);
    const selected = chapter.bodies.find(row => row.kind === "selected" && row.instance.body === body.body);
    const invocation = selected.mir.blocks.find(row => row.terminator.kind === "call" && row.terminator.callee.kind === "direct").terminator;
    const [mapping] = invocation.callee.resolution.decision.parameters;
    assert.equal(mapping.kind, "reference-argument");
    assert.equal(mapping.passing, "by-value");
    assert.deepEqual(mapping.view.fields.map(row => [row.caller, row.formal]), expected);
    assert.equal(invocation.arguments[0].operand.kind, "place");
    const load = placed === null ? selected : chapter.bodies.find(row => row.kind === "selected" && row.instance.body === placed.body);
    const loadNode = placed?.root ?? projected;
    const places = load.mir.places.filter(row => row.base.kind === "place" && row.base.projection.kind === "field" && row.base.tir.node === loadNode.id);
    assert.deepEqual(places.map(row => row.base.projection.member.decision.primary), [part]);
    if (saved) {
      const slot = selected.mir.places[invocation.arguments[0].operand.place].base;
      assert.equal(slot.kind, "local");
      assert.deepEqual(selected.mir.locals[slot.local].source, savedDecl.tsonic.declaration.local);
      assert.equal(selected.mir.places.filter(row => row.base.kind === "place" && row.base.projection.kind === "field").length, guardedSave ? 1 : 0);
      if (guardedSave) {
        assert.equal(load.mir.blocks.filter(row => row.terminator.kind === "check").length, 1);
        assert.deepEqual(load.facts[0].refinements.refinements.map(row => row.kind), ["unproven"]);
      }
    }
    assert.equal(selected.facts[0].refinements.refinements.some(row => row.kind === "proven"), mode === "guarded");
    const summary = compiled.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === body.body);
    const readPaths = summary.parameters[0].reads.paths.map(path => summary.arena.projections[path]);
    const nested = readPaths.find(row => row.projection.member.decision.primary === field(actual, "flag"));
    assert.ok(nested, "the caller owns the actual reached child field read");
    const parent = summary.arena.projections[nested.parent];
    assert.equal(parent.projection.member.decision.primary, part);
    if (chain) assert.equal(summary.arena.projections[parent.parent].projection.member.decision.primary, direct(outer));
    if (rebound) assert.deepEqual(summary.parameters[1].reads.paths, []);
    assert.equal(readPaths.some(row => row.projection.member.decision.primary === sibling), false);

    if (chain) {
      const { applyValueOrigins } = await import("../../../packages/host/dist/ir-facts/apply-values.js");
      const facts = selected.facts[0];
      const source = compiled.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === placed.body);
      const callBlock = selected.mir.blocks.find(row => row.terminator.kind === "call" && row.terminator.callee.kind === "body"
        && row.terminator.callee.instance.body === placed.body);
      const context = facts.arena.contexts.find(row => row.captures.length === 1 && "origins" in row.captures[0]);
      const forwarded = facts.arena.contexts.find(row => row.id > context.id && row.arguments.length === 1).arguments[0].origins;
      const captured = context.captures[0].origins;
      assert.notEqual(captured, forwarded);
      const entries = source.arena.boundProducers.map(row => ({
        formal: row.id, actual: source.arena.producers[row.producer].path === null ? captured : forwarded,
      }));
      const application = { summary: source, callee: source.key, at: { execution: facts.execution, point: { block: callBlock.id, statement: null } },
        context: context.id, caller: facts.arena, entries };
      const limits = () => ({ account: createAccount(input.limits.dataflow), maximumOriginAlternatives: input.limits.analyses.maximumOriginAlternatives,
        refusal: { kind: "refused", diagnostics: [] } });
      assert.equal(applyValueOrigins(application, limits()).kind, "complete");
      const crossed = entries.map(row => row.actual === captured ? { ...row, actual: forwarded } : row);
      assert.throws(() => applyValueOrigins({ ...application, entries: crossed }, limits()),
        /A copied capture binds its actual caller value, not a storage location/u);
    }
  }
}
