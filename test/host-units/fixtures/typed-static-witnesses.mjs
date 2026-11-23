import assert from "node:assert/strict";
import { readyModuleRoot, readyModuleStatements } from "./chapter-syntax.mjs";
import { createAccount } from "../../../packages/host/dist/dataflow/index.js";
import { loadFrontFixture } from "./front/checked-module.mjs";
import { analysisInput } from "./front/analysis-input.mjs";
import { checkTirBodyAdmissionCuts, tirFixtureAdmission, tirFixtureBodyVerifier } from "./typed-occurrence-witnesses.mjs";

export async function checkCompoundStaticAssignment() {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../../packages/host/dist/pipeline/typed-barrier.js");
  const { verifyMir } = await import("../../../packages/host/dist/ir-mir/index.js");
  const { verifyTir: verifyTirOperation } = await import("../../../packages/host/dist/ir-tir/index.js");
  const verifyTir = await tirFixtureBodyVerifier(verifyTirOperation);
  const { verifyOccurrenceOperation } = await import("../../../packages/host/dist/ir-tir/verify-occurrences.js");
  const { instanceKey } = await import("../../../packages/host/dist/ir-types/index.js");
  for (const [operator, overflow] of [["^", []], ["+", [{ carrier: "int64", operation: "add", result: "int64", law: "abort" }]]]) {
    const input = analysisInput(fixture, "sdk-minimal", `export let state = 1; export function combine(next = 1) { return state ${operator}= (state = next); }`);
    const nativeFacts = { ...input.snapshot.nativeFacts, integerOverflow: overflow };
    const active = { ...input, snapshot: { ...input.snapshot, nativeFacts } };
    const result = analyzeHostProgram(active);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { index, modules } = result.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    const body = module.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "Block");
    const expression = body.tir.root.statements.nodes[0].expression;
    assert.equal(expression.left.tsonic.resolution.kind, "static");
    const type = expression.left.tsonic.access.storage;
    assert.deepEqual(index.types.terms[type], { kind: "primitive", primitive: "int64" });
    assert.deepEqual(expression.left.tsonic.access, { kind: "read-write", storage: type, read: type, narrowing: null, evidenceIndex: null });
    const place = body.mir.places.find(row => row.base.kind === "static" && row.base.definition === expression.left.tsonic.resolution.declaration.owner);
    assert.ok(place);
    const entry = body.mir.blocks[body.mir.entries.find(row => row.provided === 1).block];
    const readAt = entry.statements.findIndex(row => row.kind === "assign" && row.tir.node === expression.left.id);
    const overwriteAt = entry.statements.findIndex(row => row.kind === "assign" && row.place === place.id && row.tir.node === expression.right.expression.id);
    assert.ok(readAt >= 0 && overwriteAt > readAt);
    const read = entry.statements[readAt];
    assert.deepEqual(read.value, { kind: "use", operand: { kind: "place", place: place.id } });
    assert.notEqual(read.place, place.id);
    let final = entry;
    let calculated;
    if (operator === "^") {
      const calculationAt = entry.statements.findIndex(row => row.kind === "assign" && row.tir.node === expression.id && row.value.kind === "binary");
      assert.ok(calculationAt > overwriteAt);
      const calculation = entry.statements[calculationAt];
      assert.deepEqual(calculation.value.left, { kind: "place", place: read.place });
      assert.equal(calculation.value.operation.decision.operation.operator, operator);
      calculated = calculation.place;
    } else {
      assert.equal(entry.terminator.kind, "invoke");
      assert.deepEqual(entry.terminator.operands[0], { kind: "place", place: read.place });
      assert.deepEqual(entry.terminator.unwind, { kind: "abort" });
      assert.equal(entry.terminator.operation.decision.operation.operator, operator);
      calculated = entry.terminator.destination;
      final = body.mir.blocks[entry.terminator.next];
      assert.equal(entry.statements.some(row => row.kind === "assign" && row.tir.node === expression.id && row.place === place.id), false);
    }
    const store = final.statements.find(row => row.kind === "assign" && row.tir.node === expression.id && row.place === place.id);
    assert.deepEqual(store?.value, { kind: "use", operand: { kind: "place", place: calculated } });
    assert.equal(final.terminator.kind, "return");
    assert.deepEqual(final.terminator.value, { kind: "place", place: calculated });

    const source = captureSourceBarrier(active);
    assert.equal(source.kind, "ok");
    const typed = typeSourceBarrier(active, source.value, createAccount(active.limits.dataflow));
    assert.equal(typed.kind, "ok");
    const exact = typed.value.bodies.get(instanceKey(body.instance));
    const [returned] = exact.root.statements.nodes;
    const operation = returned.expression.tsonic.calculation;
    for (const [calculation, detail] of [
      [null, "compound assignment requires its checked read-write access and calculation"],
      [{ ...operation, decision: { ...operation.decision, decision: { ...operation.decision.decision,
        operation: { kind: "boolean-operator", operator: "&&" } } } },
      "compound assignment calculation differs from its authored operator, operands or storage"],
    ]) {
      const findings = [];
      verifyOccurrenceOperation({ ...returned.expression, tsonic: { ...returned.expression.tsonic, calculation } }, index.types,
        (rule, node, message) => findings.push([rule, node.id, message]));
      assert.deepEqual(findings, [["operation-type", returned.expression.id, detail]]);
    }
    const decision = { ...operation.decision.decision, operation: { ...operation.decision.decision.operation, operator: "-" } };
    const changedExpression = { ...returned.expression, tsonic: { ...returned.expression.tsonic,
      calculation: { ...operation, decision: { ...operation.decision, decision } } } };
    const changedTir = { ...exact, root: { ...exact.root, statements: { ...exact.root.statements,
      nodes: [{ ...returned, expression: changedExpression }] } } };
    assert.equal(verifyTir(typed.value.verifierOf(module.module), changedTir).some(issue => issue.rule === "operation-type"), true);
    const context = { selectedNativeFacts: nativeFacts, source: body.tir, requiredEntries: typed.value.required.provided.get(instanceKey(body.instance)), types: index.types, limits: input.limits.mirVerification,
      declarationOf: typed.value.declarationOf, bodyOwner: identity => fixture.ids.decodeBodyId(identity).value.owner,
      bodyOf: instance => typed.value.bodies.get(instanceKey(instance)) ?? null };
    for (const [original, crossed, rule] of [
      [read, { ...read, value: { kind: "use", operand: { kind: "place", place: calculated } } }, "static-read-exact"],
      [store, { ...store, place: calculated }, "static-write-exact"],
    ]) {
      const changed = { ...body.mir, blocks: body.mir.blocks.map(block => ({ ...block,
        statements: block.statements.map(row => row === original ? crossed : row) })) };
      const verified = verifyMir(changed, context);
      assert.equal(verified.kind, "complete");
      assert.equal(verified.violations.some(issue => issue.rule === rule), true);
    }
  }
}

export async function checkStaticUpdates() {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../../packages/host/dist/pipeline/typed-barrier.js");
  const { verifyMir } = await import("../../../packages/host/dist/ir-mir/index.js");
  const { verifyTir: verifyTirOperation } = await import("../../../packages/host/dist/ir-tir/index.js");
  const verifyTir = await tirFixtureBodyVerifier(verifyTirOperation);
  const { instanceKey } = await import("../../../packages/host/dist/ir-types/index.js");
  const source = `export let state = 1;
    export function preUp() { return ++state; }
    export function postUp() { return state++; }
    export function preDown() { return --state; }
    export function postDown() { return state--; }`;
  const input = analysisInput(fixture, "sdk-minimal", source);
  for (const law of ["wrap", "abort"]) {
    const nativeFacts = { ...input.snapshot.nativeFacts, integerOverflow: ["decrement", "increment"]
      .map(operation => ({ carrier: "int64", operation, result: "int64", law })) };
    const active = { ...input, snapshot: { ...input.snapshot, nativeFacts } };
    const result = analyzeHostProgram(active);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { index, modules } = result.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    const captured = captureSourceBarrier(active);
    assert.equal(captured.kind, "ok");
    const typed = typeSourceBarrier(active, captured.value, createAccount(active.limits.dataflow));
    assert.equal(typed.kind, "ok");
    for (const [position, operator, postfix] of [[1, "++", false], [2, "++", true], [3, "--", false], [4, "--", true]]) {
      const label = `${law} ${postfix ? "postfix" : "prefix"} ${operator}`;
      const declaration = readyModuleStatements(readyModuleRoot(module.tree))[position];
      const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
      const returned = body.tir.root.statements.nodes[0];
      const update = returned.expression;
      assert.equal(update.kind, postfix ? "PostfixUnaryExpression" : "PrefixUnaryExpression", label);
      const { resolution, access } = update.operand.tsonic;
      assert.equal(resolution.kind, "static", label);
      const type = body.tir.completion;
      assert.deepEqual(index.types.terms[type], { kind: "primitive", primitive: "int64" }, label);
      assert.deepEqual(access, { kind: "read-write", storage: type, read: type, narrowing: null, evidenceIndex: null }, label);
      const decision = update.tsonic.operation.decision.decision;
      assert.deepEqual(decision, {
        kind: "selected", operation: { kind: "native-operator", operator, carrier: "int64" }, operands: [type], result: type,
        execution: law === "wrap" ? { kind: "pure" } : { kind: "invocation", writesStorage: false, failure: "abort" },
      }, label);
      const [storage] = body.mir.places.filter(row => row.base.kind === "static" && row.base.definition === resolution.declaration.owner);
      assert.ok(storage, label);
      const [entry] = body.mir.entries;
      const start = body.mir.blocks[entry.block];
      const reads = start.statements.filter(row => row.kind === "assign" && row.tir.node === update.operand.id);
      assert.equal(reads.length, 1, label);
      const [read] = reads;
      assert.deepEqual(read.value, { kind: "use", operand: { kind: "place", place: storage.id } }, label);
      const old = { kind: "place", place: read.place };
      let final = start;
      let calculated;
      if (law === "wrap") {
        const computation = start.statements.find(row => row.kind === "assign" && row.tir.node === update.id && row.value.kind === "unary");
        assert.ok(start.statements.indexOf(computation) > start.statements.indexOf(read), label);
        assert.deepEqual(computation.value.operand, old, label);
        calculated = computation.place;
      } else {
        const invocation = start.terminator;
        assert.equal(invocation.kind, "invoke", label);
        assert.deepEqual(invocation.operands, [old], label);
        assert.deepEqual(invocation.unwind, { kind: "abort" }, label);
        assert.equal(start.statements.some(row => row.kind === "assign" && row.place === storage.id), false, label);
        final = body.mir.blocks[invocation.next];
        calculated = invocation.destination;
      }
      const writes = body.mir.blocks.flatMap(block => block.statements.filter(row => row.kind === "assign" && row.place === storage.id));
      assert.equal(writes.length, 1, label);
      const [write] = writes;
      assert.equal(final.statements.includes(write), true, label);
      assert.equal(write.tir.node, update.id, label);
      const next = { kind: "place", place: calculated };
      assert.deepEqual(write.value, { kind: "use", operand: next }, label);
      assert.equal(final.terminator.kind, "return", label);
      assert.deepEqual(final.terminator.value, postfix ? old : next, label);
      const summary = index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === body.instance.body);
      assert.deepEqual(summary.contentsOnReturn.map(row => summary.arena.cells[row.target].role.declaration.definition),
        [resolution.declaration.owner], label);
      if (position !== 1) continue;

      const exact = typed.value.bodies.get(instanceKey(body.instance));
      const [original] = exact.root.statements.nodes;
      const operation = original.expression.tsonic.operation;
      const crossedDecision = { ...decision, operation: { ...decision.operation, operator: "--" } };
      const crossedExpression = { ...original.expression, tsonic: { ...original.expression.tsonic,
        operation: { ...operation, decision: { ...operation.decision, decision: crossedDecision } } } };
      const wrongTir = { ...exact, root: { ...exact.root, statements: { ...exact.root.statements,
        nodes: [{ ...original, expression: crossedExpression }] } } };
      assert.equal(verifyTir(typed.value.verifierOf(module.module), wrongTir).some(issue => issue.rule === "operation-type"), true, label);
      const context = { selectedNativeFacts: nativeFacts, source: body.tir, requiredEntries: typed.value.required.provided.get(instanceKey(body.instance)), types: index.types,
        limits: active.limits.mirVerification, declarationOf: typed.value.declarationOf,
        bodyOwner: owner => fixture.ids.decodeBodyId(owner).value.owner,
        bodyOf: instance => typed.value.bodies.get(instanceKey(instance)) ?? null };
      for (const [originalRow, replacement, rule] of [
        [read, { ...read, value: { kind: "use", operand: next } }, "static-read-exact"],
        [write, { ...write, place: calculated }, "static-write-exact"],
      ]) {
        const wrongMir = { ...body.mir, blocks: body.mir.blocks.map(block => ({ ...block,
          statements: block.statements.map(row => row === originalRow ? replacement : row) })) };
        const verified = verifyMir(wrongMir, context);
        assert.equal(verified.kind, "complete", label);
        assert.equal(verified.violations.some(issue => issue.rule === rule), true, `${label} ${rule}`);
      }
      if (law === "abort") {
        const wrongMir = { ...body.mir, blocks: body.mir.blocks.map(block => block === start
          ? { ...block, terminator: { ...start.terminator, destination: storage.id } } : block) };
        const verified = verifyMir(wrongMir, context);
        assert.equal(verified.kind, "complete", label);
        assert.equal(verified.violations.some(issue => issue.rule === "static-write-exact"), true, label);
      }
    }
    const early = analysisInput(fixture, "sdk-minimal", `preUp(); ${source}`);
    const refused = analyzeHostProgram({ ...early, snapshot: { ...early.snapshot, nativeFacts } });
    assert.equal(refused.kind, "refused", law);
    const diagnostic = refused.diagnostics.find(row => row.code.name === "TSONIC_STATIC_READ_BEFORE_INITIALIZATION");
    assert.equal(diagnostic?.site.kind, "source", law);
    assert.equal(diagnostic.site.origin.start, "preUp(); ".length + source.indexOf("++state") + 2, law);
  }
}

export async function checkQualifiedStaticRead() {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { parseModuleBodies, printModuleBodies } = await import("../../../packages/host/dist/ir-program/index.js");
  const { parseTir, printTir, verifyTir: verifyTirOperation } = await import("../../../packages/host/dist/ir-tir/index.js");
  const verifyTir = await tirFixtureBodyVerifier(verifyTirOperation);
  const freshAdmission = await tirFixtureAdmission();
  const { captureSourceBarrier } = await import("../../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../../packages/host/dist/pipeline/typed-barrier.js");
  const { verifyMir } = await import("../../../packages/host/dist/ir-mir/index.js");
  const { instanceKey } = await import("../../../packages/host/dist/ir-types/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  const moduleOf = name => fixture.moduleOf(fixture.packageOf("/project"), `src/${name}.ts`);
  const local = "export function read(): boolean { return state; }";
  const imported = "import { state as renamed } from './provider.js'; export function read(): boolean { return renamed; }";
  const snapshot = (fromImport, declaration) => fixture.projectSnapshot({
    sourceFiles: fromImport ? { "main.ts": imported, "provider.ts": declaration } : { "main.ts": `${declaration}\n${local}` },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
    externalEntries: [{ module: moduleOf("main"), name: "read" }],
  });
  for (const fromImport of [false, true]) {
    const provider = moduleOf(fromImport ? "provider" : "main");
    const selected = { ...input, snapshot: snapshot(fromImport, "export const state: boolean = true;") };
    const result = analyzeHostProgram(selected);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { index, modules } = result.value;
    const { entries, external } = index.initialization;
    assert.equal(entries.length, 1);
    assert.deepEqual(external[0].storage, []);
    const module = modules.find(current => current.module === moduleOf("main"));
    const reader = module.bodies.find(row => row.kind === "selected" && row.instance.body === entries[0].instance.body);
    const read = reader.tir.root.statements.nodes[0].expression;
    assert.equal(read.tsonic.resolution.kind, "static");
    assert.equal(read.tsonic.resolution.aliases.length > 0, fromImport);
    const declaration = read.tsonic.resolution.declaration;
    assert.equal(fixture.ids.decodeDefId(declaration.owner).value.module, provider);
    const places = reader.mir.places.filter(place => place.base.kind === "static");
    assert.equal(places.length, 1);
    assert.equal(places[0].base.definition, declaration.owner);
    const load = reader.mir.blocks.flatMap(block => block.statements).find(statement => statement.tir.node === read.id
      && statement.kind === "assign" && statement.value.kind === "use");
    assert.deepEqual(load.value.operand, { kind: "place", place: places[0].id });
    const [facts] = reader.facts;
    assert.ok(facts.origins.reads.some(fact => fact.node === read.id && fact.place === places[0].id));
    const summary = index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === reader.instance.body);
    const [need] = summary.initialization.points.filter(point => point.kind === "need");
    assert.deepEqual(need.witness, { read: { kind: "body", value: { body: reader.instance.body, node: read.id } }, via: [] });
    assert.deepEqual(summary.arena.cells[need.cell].occurrence, { kind: "declared", at: { kind: "node", node: { kind: "item", value: declaration } } });
    const typedText = printTir(reader.tir);
    const parsedTir = parseTir(typedText);
    assert.equal(parsedTir.kind, "parsed");
    assert.equal(printTir(parsedTir.value), typedText);
    const text = printModuleBodies(index, module);
    const parsed = parseModuleBodies(index, text);
    assert.equal(parsed.kind, "parsed");
    assert.equal(printModuleBodies(index, parsed.value), text);
    if (fromImport) {
      const captured = captureSourceBarrier(selected);
      assert.equal(captured.kind, "ok");
      const typed = typeSourceBarrier(selected, captured.value, createAccount(selected.limits.dataflow));
      assert.equal(typed.kind, "ok");
      const context = typed.value.verifierOf(moduleOf("main"));
      assert.equal(checkTirBodyAdmissionCuts(freshAdmission, verifyTirOperation, context, reader.tir).includes("staticStorageOf"), true);
      const wrongRead = { ...read, tsonic: { ...read.tsonic, resolution: { ...read.tsonic.resolution, aliases: [] } } };
      const [original] = reader.tir.root.statements.nodes;
      const wrongTir = { ...reader.tir, root: { ...reader.tir.root, statements: { ...reader.tir.root.statements,
        nodes: [{ ...original, expression: wrongRead }] } } };
      assert.equal(verifyTir(context, wrongTir).some(issue => issue.rule === "static-reference-exact"), true);
      const reference = read.tsonic.resolution.aliases[0];
      assert.ok(context.bindingOf(reference));
      const sameOccurrence = pair => pair.kind === reference.kind && pair.value.node === reference.value.node
        && (pair.kind === "item" ? pair.value.owner === reference.value.owner : pair.value.body === reference.value.body);
      for (const crossedContext of [
        { ...context, bindingOf: occurrence => {
          const ready = context.bindingOf(occurrence);
          return ready === null || !sameOccurrence(occurrence) ? ready
            : { ...ready, target: { kind: "unavailable", reason: "incomplete-association", causes: [] } };
        } },
        { ...context, nodeOf: occurrence => occurrence.kind === "item" && occurrence.value.owner === declaration.owner
          && occurrence.value.node === declaration.node ? null : context.nodeOf(occurrence) },
      ]) {
        const findings = verifyTir(crossedContext, reader.tir);
        assert.equal(findings.some(issue => issue.rule === "static-reference-exact" && issue.site.node === read.id), true);
      }
      const actualDeclaration = context.nodeOf({ kind: "item", value: declaration });
      assert.equal(actualDeclaration.kind, "VariableDeclaration");
      const constant = actualDeclaration.initializer;
      assert.equal(constant.kind, "TrueKeyword");
      const crossedSource = structuredClone(context.source);
      const checkedBody = crossedSource.bodies.find(row => row.body === reader.instance.body);
      const [checkedReturn] = checkedBody.root.statements.nodes;
      const { id, parent, origin, loc, flags } = checkedReturn.expression;
      checkedReturn.expression = { ...constant, id, parent, origin, loc, flags };
      const findings = verifyTir({ ...context, source: crossedSource }, reader.tir);
      assert.equal(findings.some(issue => issue.rule === "static-reference-exact" && issue.site.node === read.id), true);
      const wrongLoad = { ...load, value: { kind: "use", operand: { kind: "place", place: load.place } } };
      const wrongMir = { ...reader.mir, blocks: reader.mir.blocks.map(block => ({ ...block,
        statements: block.statements.map(statement => statement === load ? wrongLoad : statement) })) };
      const verified = verifyMir(wrongMir, { selectedNativeFacts: selected.snapshot.nativeFacts, source: reader.tir, requiredEntries: typed.value.required.provided.get(instanceKey(reader.instance)),
        types: index.types, limits: selected.limits.mirVerification, declarationOf: typed.value.declarationOf,
        bodyOwner: body => fixture.ids.decodeBodyId(body).value.owner,
        bodyOf: instance => typed.value.bodies.get(instanceKey(instance)) ?? null });
      assert.equal(verified.kind, "complete");
      assert.equal(verified.violations.some(issue => issue.rule === "static-read-exact"), true);
    }

    const unwritten = "export let state: boolean;";
    const refused = analyzeHostProgram({ ...input, snapshot: snapshot(fromImport, unwritten) });
    assert.equal(refused.kind, "refused");
    const diagnostic = refused.diagnostics.find(row => row.code.kind === "host" && row.code.name === "TSONIC_STATIC_READ_BEFORE_INITIALIZATION");
    assert.equal(diagnostic?.site.kind, "source");
    assert.equal(diagnostic.site.origin.module, moduleOf("main"));
    assert.equal(diagnostic.site.origin.start, fromImport ? imported.lastIndexOf("renamed") : unwritten.length + 1 + local.lastIndexOf("state"));
    assert.equal(diagnostic.related.length, 1);
    assert.equal(diagnostic.related[0].site.origin.module, provider);
  }
}
