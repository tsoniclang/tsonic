import assert from "node:assert/strict";
import { readyDefaultRoot, readyModuleRoot, readyModuleStatements } from "./fixtures/chapter-syntax.mjs";
import { createAccount as createDataflowAccount } from "../../packages/host/dist/dataflow/index.js";
import { test } from "node:test";
import { captureSingleModule, loadFrontFixture } from "./fixtures/front/checked-module.mjs";
import { analysisInput } from "./fixtures/front/analysis-input.mjs";
import { captureCheckedMarkers } from "./fixtures/front/checked-markers.mjs";
import { checkCompoundStaticAssignment, checkStaticUpdates, checkQualifiedStaticRead } from "./fixtures/typed-static-witnesses.mjs";
import { checkInterruptedModuleInitialization, checkSelectedStaticExposure } from "./fixtures/program-static-exposure.mjs";
import { checkCallShapedComputedDeclarationName, checkComputedDeclarationNames, checkNestedComputedDeclarationNames, checkParenthesizedComputedDeclarationNames } from "./fixtures/computed-declaration-name.mjs";
import { checkCommaSequence, checkCoalescingAssignment, checkOptionalEmbedding, checkLabelledTransfers, checkVoidOperand, tirFixtureBodyVerifier } from "./fixtures/typed-occurrence-witnesses.mjs";

const createTypedAccount = input => createDataflowAccount(input.limits.dataflow);

for (const library of ["es2024", "sdk-minimal"])
test(`public Host analysis source barrier captures the complete actual ${library} declaration input before an exported add`, async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const input = analysisInput(fixture, library);
  const result = captureSourceBarrier(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length, "the first production barrier cannot skip loaded declaration modules");
  assert.equal(result.value.modules.some(module => module.module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts")), true);
});

test("an explicitly selected inline tuple initializes the authored binding destinations through verified Program", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    function produce(pair: [boolean, boolean]): [boolean, boolean] { return pair; }
    export function start(pair: [boolean, boolean]): boolean {
      const [first, second] = produce(pair);
      return first;
    }
  `);
  const native = input.snapshot.nativeFacts;
  const withHolding = (holding, source = input) => ({ ...source, snapshot: { ...source.snapshot,
    nativeFacts: { ...native, carrierHolding: [...native.carrierHolding, { carrier: "tuple", holding }] } } });
  const completed = analyzeHostProgram(withHolding("in-place"));
  assert.equal(completed.kind, "ok", JSON.stringify(completed.diagnostics));
  const chapter = completed.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const body = chapter?.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "Block"
    && row.tir.root.statements.nodes[0]?.kind === "VariableStatement");
  assert.ok(body);
  const declaration = body.tir.root.statements.nodes[0].declarationList.declarations.nodes[0];
  const elements = declaration.name.elements.nodes;
  const producer = body.mir.blocks.filter(row => row.terminator.tir.node === declaration.initializer.id && row.terminator.kind === "call");
  assert.equal(producer.length, 1);
  const places = body.mir.places.filter(place => place.base.kind === "place" && place.base.projection.kind === "element");
  assert.deepEqual(places.map(place => [place.base.tir.node, place.base.place, place.base.projection.index]),
    elements.map((element, index) => [element.id, producer[0].terminator.destination, index]));
  const facts = body.facts.find(row => row.execution.provided === 1);
  assert.ok(facts);
  for (const [position, place] of places.entries()) {
    const read = facts.origins.reads.find(row => row.node === elements[position].id && row.place === place.id);
    assert.ok(read);
    const origins = facts.arena.origins[read.origins];
    assert.equal(origins.kind, "complete");
    assert.deepEqual(origins.producers, []);
    assert.equal(origins.includesAbsence, false);
  }
  assert.deepEqual(facts.arena.projections, [], "inline tuple reads do not create shared-reference paths");
  assert.throws(() => analyzeHostProgram(input), /actual Origins reference\/cell producer/);
  assert.throws(() => analyzeHostProgram(withHolding("by-reference")), /actual Origins reference\/cell producer/);
  const containsReference = analysisInput(fixture, "sdk-minimal",
    "export function start(pair: [boolean, string]): boolean { const [first, second] = pair; return first; }");
  assert.throws(() => analyzeHostProgram(withHolding("in-place", containsReference)), /actual Origins reference\/cell producer/);
});

test("nested tuple bindings retain exact slots without reading the hole or skipping its producer", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    function before(value: boolean): boolean { return !value; }
    function skipped(value: boolean): boolean { return !value; }
    function after(value: boolean): boolean { return !value; }
    function produce(first: boolean, ignored: boolean, last: boolean): [[boolean], boolean, [boolean]] {
      return [[before(first)], skipped(ignored), [after(last)]];
    }
    export function start(first: boolean, ignored: boolean, last: boolean): boolean {
      const [[left], , [right]] = produce(first, ignored, last);
      return right;
    }
    export function fromParameter(pair: [[boolean], boolean, [boolean]]): boolean {
      const [[left], , [right]] = pair;
      return right;
    }
    export function fromLiteral(first: boolean, ignored: boolean, last: boolean): boolean {
      return fromParameter([[before(first)], skipped(ignored), [after(last)]]);
    }
    export function fromGrouped(first: boolean, ignored: boolean, last: boolean): boolean {
      return fromParameter((([([before(first)]), skipped(ignored), [after(last)]])));
    }
  `);
  const native = input.snapshot.nativeFacts;
  const result = analyzeHostProgram({ ...input, snapshot: { ...input.snapshot, nativeFacts: {
    ...native, carrierHolding: [...native.carrierHolding, { carrier: "tuple", holding: "in-place" }],
  } } });
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const declarations = readyModuleStatements(readyModuleRoot(chapter.tree));
  const body = name => {
    const declaration = declarations.find(node => node.kind === "FunctionDeclaration" && node.name.text === name);
    const selected = chapter.bodies.find(row => row.kind === "selected" && row.tir.owner === declaration.tsonic.definition);
    assert.ok(selected, name);
    return selected;
  };
  const calls = ({ mir }) => mir.blocks.map(block => block.terminator).filter(term => term.kind === "call");
  const producer = body("produce");
  assert.deepEqual(calls(producer).map(call => call.callee.resolution.activation.body),
    ["before", "skipped", "after"].map(name => body(name).tir.body));
  const sourceCalls = calls(body("start"));
  assert.deepEqual(sourceCalls.map(call => call.callee.resolution.activation.body), [producer.tir.body]);
  assert.deepEqual(calls(body("fromParameter")), []);
  const literal = expression => {
    while (expression.kind === "ParenthesizedExpression") expression = expression.expression;
    assert.equal(expression.kind, "ArrayLiteralExpression");
    return expression;
  };
  for (const name of ["fromLiteral", "fromGrouped"]) {
    const direct = body(name);
    const directCalls = calls(direct);
    assert.deepEqual(directCalls.map(call => call.callee.resolution.activation.body),
      ["before", "skipped", "after", "fromParameter"].map(callee => body(callee).tir.body));
    const argument = direct.tir.root.statements.nodes[0].expression.arguments.nodes[0];
    assert.equal(argument.kind, name === "fromGrouped" ? "ParenthesizedExpression" : "ArrayLiteralExpression");
    const authored = literal(argument);
    const built = direct.mir.blocks.flatMap(block => block.statements).filter(statement =>
      statement.kind === "assign" && statement.value.kind === "aggregate" && statement.value.aggregate.kind === "tuple");
    assert.deepEqual(built.map(statement => statement.tir.node),
      [literal(authored.elements.nodes[0]).id, literal(authored.elements.nodes[2]).id, authored.id]);
    assert.deepEqual(directCalls.at(-1).arguments.map(argument => argument.operand.place), [built.at(-1).place]);
  }
  for (const [name, saved] of [["start", sourceCalls[0].destination], ["fromParameter", null]]) {
    const { mir, tir, facts } = body(name);
    const binding = tir.root.statements.nodes[0].declarationList.declarations.nodes[0].name;
    const [left, hole, right] = binding.elements.nodes;
    assert.equal(hole.tsonic.role, "hole");
    const [leftLeaf] = left.name.elements.nodes;
    const [rightLeaf] = right.name.elements.nodes;
    const [outerLeft, innerLeft, outerRight, innerRight, ...extra] = mir.places.filter(place =>
      place.base.kind === "place" && place.base.projection.kind === "element");
    assert.deepEqual(extra, []);
    const root = saved ?? outerLeft.base.place;
    if (saved === null) assert.deepEqual(mir.locals[mir.places[root].base.local].role, { kind: "parameter", index: 0 });
    assert.deepEqual([outerLeft, innerLeft, outerRight, innerRight].map(place =>
      [place.base.tir.node, place.base.place, place.base.projection.index]), [
      [left.id, root, 0], [leftLeaf.id, outerLeft.id, 0], [right.id, root, 2], [rightLeaf.id, outerRight.id, 0],
    ]);
    assert.equal(facts[0].origins.reads.some(row => row.node === hole.id), false);
  }
});

test("fixed and empty call spreads keep their authored component and later-value transport through Facts", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  for (const [tuple, formals, count] of [["[boolean, boolean]", "first: boolean, second: boolean, ", 2], ["[]", "", 0]]) {
    const input = analysisInput(fixture, "sdk-minimal", `
      function consume(${formals}tail: boolean): boolean { return tail; }
      function produce(pair: ${tuple}): ${tuple} { return pair; }
      function later(): boolean { return true; }
      export function start(pair: ${tuple}): boolean { return consume(...produce(pair), later()); }
    `);
    const native = input.snapshot.nativeFacts;
    const result = analyzeHostProgram({ ...input, snapshot: { ...input.snapshot,
      nativeFacts: { ...native, carrierHolding: [...native.carrierHolding, { carrier: "tuple", holding: "in-place" }] } } });
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
    const body = chapter?.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "Block"
      && row.tir.root.statements.nodes[0]?.expression?.arguments?.nodes?.[0]?.kind === "SpreadElement");
    assert.ok(body);
    const call = body.tir.root.statements.nodes[0].expression;
    const [spread, later] = call.arguments.nodes;
    const operations = body.mir.blocks.map(row => row.terminator).filter(terminator => terminator.kind === "call");
    assert.deepEqual(operations.map(row => row.tir.node), [spread.expression.id, later.id, call.id]);
    const facts = body.facts.find(row => row.execution.provided === 1);
    assert.ok(facts);
    const transport = facts.origins.invocations.find(row => row.node === call.id).alternatives[0].arguments;
    assert.deepEqual(transport.map(row => [row.parameterIndex, row.authoredIndex]), count === 0 ? [[0, 1]] : [[0, 0], [1, 0], [2, 1]]);
    assert.deepEqual(transport.map(row => row.projection === null ? null : facts.arena.projections[row.projection].projection),
      [...Array.from({ length: count }, (_, index) => ({ kind: "index", constant: BigInt(index) })), null]);
    assert.equal((operations[0].destination === null), count === 0, "an empty spread evaluates without reserving an unused tuple result");
  }
});

test("S-1 composes an actual field default with a once-evaluated tuple producer and ordered spread", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const original = analysisInput(fixture, "sdk-minimal", `
    function pair(value: boolean): [boolean, boolean] { return [value, true]; }
    function later(): boolean { return false; }
    function consume(left: boolean, right: boolean, tail: boolean): boolean { return right; }
    export function maybe(source: { seed: boolean; value?: boolean }): boolean {
      const { seed, value = !seed } = source;
      return consume(...pair(value), later());
    }
    export function present(source: { seed: boolean; value: boolean }): boolean {
      const { seed, value = !seed } = source;
      return consume(...pair(value), later());
    }
  `);
  const facts = original.snapshot.nativeFacts;
  const input = { ...original, snapshot: { ...original.snapshot, nativeFacts: { ...facts,
    carrierHolding: [...facts.carrierHolding, { carrier: "tuple", holding: "in-place" }],
  } } };
  const run = maximumWork => analyzeHostProgram({ ...input, limits: { ...input.limits,
    dataflow: { ...input.limits.dataflow, maximumWork },
  } });
  const exact = 129002;
  const result = run(exact);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const declarations = readyModuleStatements(readyModuleRoot(chapter.tree));
  for (const name of ["maybe", "present"]) {
    const declaration = declarations.find(node => node.kind === "FunctionDeclaration" && node.name.text === name);
    const body = chapter.bodies.find(row => row.kind === "selected" && row.tir.owner === declaration.tsonic.definition);
    const [binding, returned] = body.tir.root.statements.nodes;
    const slot = binding.declarationList.declarations.nodes[0].name.elements.nodes[1];
    const invocation = returned.expression;
    const [spread, subsequent] = invocation.arguments.nodes;
    const split = body.mir.blocks.find(row => row.terminator.tir.node === slot.id && row.terminator.kind === "switch");
    const calls = body.mir.blocks.map(row => row.terminator).filter(row => row.kind === "call");
    assert.equal(slot.tsonic.role, "field-binding");
    assert.notEqual(slot.tsonic.initializer, null, "both cases retain the authored default");
    if (name === "maybe") {
      assert.ok(split);
      const [absence] = split.terminator.targets;
      assert.deepEqual(body.mir.constants[absence.constant].value, { kind: "literal", value: { kind: "absence" } });
      const initializer = body.mir.blocks[absence.target].terminator;
      const present = body.mir.blocks[split.terminator.otherwise];
      assert.equal(initializer.kind, "call");
      assert.equal(initializer.callee.instance.body, slot.tsonic.initializer);
      assert.equal(present.terminator.kind, "goto");
      assert.equal(present.terminator.target, body.mir.blocks[initializer.next].terminator.target);
      assert.equal(calls.filter(call => call.tir.node === slot.id).length, 1);
    } else {
      assert.equal(split, undefined);
      assert.equal(calls.some(call => call.tir.node === slot.id), false);
    }
    const sequence = calls.filter(call => call.tir.node !== slot.id);
    assert.deepEqual(sequence.map(call => call.tir.node), [spread.expression.id, subsequent.id, invocation.id]);
    assert.equal(body.mir.blocks[sequence[0].next].terminator === sequence[1], true);
    assert.equal(body.mir.blocks[sequence[1].next].terminator === sequence[2], true);
    assert.notEqual(sequence[0].destination, null);
    const executionFacts = body.facts.find(row => row.execution.provided === 1);
    const transport = executionFacts.origins.invocations.find(row => row.node === invocation.id).alternatives[0].arguments;
    assert.deepEqual(transport.map(row => [row.parameterIndex, row.authoredIndex]), [[0, 0], [1, 0], [2, 1]]);
    assert.deepEqual(transport.map(row => row.projection === null ? null : executionFacts.arena.projections[row.projection].projection),
      [{ kind: "index", constant: 0n }, { kind: "index", constant: 1n }, null]);
  }
  const refused = run(exact - 1);
  assert.equal(refused.kind, "refused");
  assert.equal("value" in refused, false);
  assert.deepEqual(refused.diagnostics.map(row => [row.source, row.code.rendered, row.arguments]), [
    ["pipeline", "TSONIC_COMPILER_RESOURCE_LIMIT", [{ kind: "text", value: "work" }, { kind: "number", value: exact - 1 }]],
  ]);
});

test("a finite spread of a checked tuple literal constructs its one product before the next argument", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const source = `
    function keep(flag: boolean): boolean { return !flag; }
    function later(): boolean { return false; }
    function consume(first: boolean, second: boolean, tail: boolean): boolean { return tail; }
    export function bare(flag: boolean): boolean { return consume(...[keep(flag), true], later()); }
    export function grouped(flag: boolean): boolean { return consume(...(([keep(flag), true])), later()); }
    export function asserted(flag: boolean): boolean { return consume(...(([keep(flag), true] as [boolean, boolean])), later()); }
    export function bracketed(flag: boolean): boolean { return consume(...(<[boolean, boolean]>[keep(flag), true]), later()); }
  `;
  const input = analysisInput(fixture, "sdk-minimal", source);
  const nativeFacts = input.snapshot.nativeFacts;
  const configured = { ...input, snapshot: { ...input.snapshot, nativeFacts: {
    ...nativeFacts, carrierHolding: [...nativeFacts.carrierHolding, { carrier: "tuple", holding: "in-place" }],
  } } };
  const captured = captureSourceBarrier(configured);
  assert.equal(captured.kind, "ok", JSON.stringify(captured.diagnostics));
  const sourceModule = captured.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
  const result = analyzeHostProgram(configured);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const declarations = readyModuleStatements(readyModuleRoot(chapter.tree));
  const literalOf = expression => {
    while (expression.kind === "ParenthesizedExpression" || expression.kind === "AsExpression" || expression.kind === "TypeAssertionExpression")
      expression = expression.expression;
    assert.equal(expression.kind, "ArrayLiteralExpression");
    return expression;
  };
  for (const name of ["bare", "grouped", "asserted", "bracketed"]) {
    const original = sourceModule.tree.statements.nodes.find(row => row.kind === "FunctionDeclaration" && row.name.text === name);
    const operand = original.body.statements.nodes[0].expression.arguments.nodes[0].expression;
    const authored = literalOf(operand);
    let wrapper = operand;
    while (wrapper.kind === "ParenthesizedExpression") wrapper = wrapper.expression;
    const assertion = name === "asserted" || name === "bracketed";
    assert.equal(wrapper.kind, name === "asserted" ? "AsExpression" : name === "bracketed" ? "TypeAssertionExpression" : "ArrayLiteralExpression");
    assert.deepEqual(authored.tsonic.value.views.contextual, assertion ? wrapper.type.tsonic.type : { kind: "available", value: null });
    const declaration = declarations.find(row => row.kind === "FunctionDeclaration" && row.name.text === name);
    const body = chapter.bodies.find(row => row.kind === "selected" && row.tir.owner === declaration.tsonic.definition);
    const call = body.tir.root.statements.nodes[0].expression;
    const [spread, later] = call.arguments.nodes;
    assert.equal(spread.tsonic.role, "finite-call-argument");
    const literal = literalOf(spread.expression);
    const calls = body.mir.blocks.map(row => row.terminator).filter(row => row.kind === "call");
    const [keep, subsequent, consume] = calls;
    assert.deepEqual(calls.map(row => row.tir.node), [literal.elements.nodes[0].id, later.id, call.id]);
    const aggregates = body.mir.blocks.flatMap(row => row.statements).filter(row => row.kind === "assign" && row.value.kind === "aggregate");
    assert.equal(aggregates.length, 1);
    const [aggregate] = aggregates;
    assert.equal(body.mir.blocks[keep.next].statements.includes(aggregate), true);
    assert.equal(body.mir.blocks[keep.next].terminator === subsequent, true);
    assert.equal(body.mir.blocks[subsequent.next].terminator === consume, true);
    assert.equal(aggregate.tir.node, literal.id);
    assert.equal(aggregate.value.aggregate.kind, "tuple");
    assert.deepEqual(aggregate.value.aggregate.elements[0], { kind: "place", place: keep.destination });
    const projected = body.mir.blocks[keep.next].statements.filter(row =>
      row.kind === "assign" && row.tir.node === spread.id && row.value.kind === "use");
    assert.deepEqual(projected.map(row => {
      const { base } = body.mir.places[row.value.operand.place];
      return [base.place, base.projection.index];
    }), [[aggregate.place, 0], [aggregate.place, 1]]);
    assert.deepEqual(consume.arguments.slice(0, 2).map(argument => argument.operand),
      projected.map(row => ({ kind: "place", place: row.place })));
    assert.deepEqual(consume.arguments[2].operand, { kind: "place", place: subsequent.destination });
    const transport = body.facts[0].origins.invocations.find(row => row.node === call.id).alternatives[0].arguments;
    assert.deepEqual(transport.map(row => [row.parameterIndex, row.authoredIndex]), [[0, 0], [1, 0], [2, 1]]);
  }
});

test("a finite tuple spread uses the actual instantiated slots of a generic literal", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    function take<T>(value: T, flag: boolean): boolean { return flag; }
    export function start<T>(value: T): boolean { return take(...[value, true]); }
    export function caller(flag: boolean): boolean { return start(flag); }
  `);
  const native = input.snapshot.nativeFacts;
  const result = analyzeHostProgram({ ...input, snapshot: { ...input.snapshot, nativeFacts: {
    ...native, carrierHolding: [...native.carrierHolding, { carrier: "tuple", holding: "in-place" }],
  } } });
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const rows = chapter.bodies.filter(row => row.tir.root.kind === "Block"
    && row.tir.root.statements.nodes[0].expression?.arguments?.nodes[0]?.kind === "SpreadElement");
  assert.deepEqual(rows.map(row => row.kind), ["template", "selected"]);
  const [open, bound] = rows.map(({ tir }) => {
    const product = tir.root.statements.nodes[0].expression.arguments.nodes[0].expression;
    const { type, construction } = product.tsonic;
    const tuple = result.value.index.types.terms[type];
    assert.equal(tuple.kind, "tuple");
    const slot = tuple.elements[0].type;
    assert.equal(slot, tir.params[0].tsonic.storage);
    assert.equal(slot, construction.decision.decision.operands[0]);
    return [type, result.value.index.types.terms[slot]];
  });
  assert.notEqual(open[0], bound[0]);
  assert.equal(open[1].kind, "param");
  assert.deepEqual(bound[1], { kind: "primitive", primitive: "bool" });
});

test("authored tuple construction consumes ordered operands and emits one selected product", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { verifyTir } = await import("../../packages/host/dist/ir-tir/index.js");
  const { tirReadyReadAdmission } = await import("../../packages/host/dist/ir-program/index.js");
  const withInlineTuple = source => {
    const input = analysisInput(fixture, "sdk-minimal", source);
    const facts = input.snapshot.nativeFacts;
    return { ...input, snapshot: { ...input.snapshot,
      nativeFacts: { ...facts, carrierHolding: [...facts.carrierHolding, { carrier: "tuple", holding: "in-place" }] } } };
  };
  const source = `
    function keep(flag: boolean): boolean { return flag; }
    function flip(flag: boolean): boolean { return !flag; }
    function pair(flag: boolean): readonly [boolean, boolean] { return [keep(flag), flip(flag)]; }
    export function start(flag: boolean): boolean { const [left, right] = pair(flag); return left; }
  `;
  const input = withInlineTuple(source);
  const program = analyzeHostProgram(input);
  assert.equal(program.kind, "ok", JSON.stringify(program.diagnostics));
  const findTuple = body => body.root.kind === "Block" && body.root.statements.nodes[0]?.expression?.kind === "ArrayLiteralExpression";
  const selected = program.value.modules.find(row => row.module === input.snapshot.entryPoint).bodies
    .find(row => row.kind === "selected" && findTuple(row.tir));
  assert.ok(selected);
  const typedLiteral = selected.tir.root.statements.nodes[0].expression;
  const calls = selected.mir.blocks.map(block => block.terminator).filter(term => term.kind === "call");
  assert.deepEqual(calls.map(term => term.tir.node), typedLiteral.elements.nodes.map(element => element.id));
  const aggregates = selected.mir.blocks.flatMap(block => block.statements)
    .filter(statement => statement.kind === "assign" && statement.value.kind === "aggregate");
  assert.equal(aggregates.length, 1);
  assert.equal(aggregates[0].tir.node, typedLiteral.id);
  assert.deepEqual(aggregates[0].value.aggregate, { kind: "tuple",
    elements: calls.map(term => ({ kind: "place", place: term.destination })) });
  assert.equal(program.value.index.types.terms[aggregates[0].value.type].readonly, true);
  assert.equal(aggregates[0].value.type, selected.tir.completion);

  const checked = captureSourceBarrier(input);
  assert.equal(checked.kind, "ok");
  const typed = typeSourceBarrier(input, checked.value, createTypedAccount(input));
  assert.equal(typed.kind, "ok", JSON.stringify(typed.diagnostics));
  const candidate = [...typed.value.bodies.values()].find(body => body.bindings.kind === "instantiated" && findTuple(body));
  assert.ok(candidate);
  const forged = structuredClone(candidate);
  const literal = forged.root.statements.nodes[0].expression;
  const [first, second] = literal.tsonic.construction.decision.decision.operation.parts;
  first.destination = second.destination;
  const verifier = typed.value.verifierOf(input.snapshot.entryPoint);
  const rejected = verifyTir(verifier, tirReadyReadAdmission(createTypedAccount(input)))(forged);
  assert.equal(rejected.kind, "complete");
  assert.equal(rejected.violations.some(finding => finding.rule === "operation-type" && finding.detail.some(detail =>
    detail.kind === "text" && detail.value.startsWith("a fixed tuple slot retains"))), true);
  for (const [annotation, expression, size] of [["[number, number]", "[1, 2]", 2], ["[]", "[]", 0]]) {
    const opposite = withInlineTuple(`export function pair(): ${annotation} { return ${expression}; }`);
    const completed = analyzeHostProgram(opposite);
    assert.equal(completed.kind, "ok", JSON.stringify(completed.diagnostics));
    const body = completed.value.modules.find(row => row.module === opposite.snapshot.entryPoint).bodies
      .find(row => row.kind === "selected" && findTuple(row.tir));
    assert.ok(body);
    const built = body.mir.blocks.flatMap(block => block.statements)
      .filter(statement => statement.kind === "assign" && statement.value.kind === "aggregate");
    assert.equal(built.length, 1);
    assert.equal(built[0].value.aggregate.elements.length, size);
  }
});

test("an optional reference store retains the qualified field and the single native absence in Typed IR", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { parseTir, printTir, verifyTir } = await import("../../packages/host/dist/ir-tir/index.js");
  const { tirReadyReadAdmission } = await import("../../packages/host/dist/ir-program/index.js");
  const { chargeWork } = await import("../../packages/host/dist/dataflow/index.js");
  for (const absence of ["null", "undefined"]) {
    const input = analysisInput(fixture, "sdk-minimal", `
      export function clear(record: { field: { value: boolean } | ${absence} }): void {
        record.field = ${absence};
      }
    `);
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok");
    const selected = typeSourceBarrier(input, captured.value, createTypedAccount(input));
    assert.equal(selected.kind, "ok", JSON.stringify(selected.diagnostics));
    const candidate = [...selected.value.bodies.values()].find(body => body.bindings.kind === "instantiated" && body.root.kind === "Block");
    assert.ok(candidate);
    const proof = selected.value.verifierOf(input.snapshot.entryPoint);
    const verify = body => verifyTir(proof, tirReadyReadAdmission(createTypedAccount(input)))(body);
    assert.deepEqual(verify(candidate), { kind: "complete", violations: [] });
    const text = printTir(candidate);
    const decoded = parseTir(text);
    assert.equal(decoded.kind, "parsed");
    assert.equal(printTir(decoded.value), text);
    const assignment = candidate.root.statements.nodes[0].expression;
    const operation = assignment.right.tsonic.conversion.operation.decision.operation;
    assert.equal(operation.embedding.conversion, "absence");
    assert.deepEqual(proof.types.terms[operation.from], { kind: "intrinsic", intrinsic: "absence" });
    assert.equal(operation.to, assignment.tsonic.storage);
    const [step] = operation.embedding.proof.steps;
    assert.deepEqual(step.to.root, { kind: "body", value: { body: candidate.body, node: assignment.left.id } });

    const damaged = structuredClone(candidate);
    const crossed = damaged.root.statements.nodes[0].expression;
    crossed.right.tsonic.conversion.operation.decision.operation.embedding.proof.steps[0].to.root.value.node = crossed.left.expression.id;
    const rejected = verify(damaged);
    assert.equal(rejected.kind, "complete");
    assert.equal(rejected.violations.some(row => row.rule === "operation-type" && row.detail.some(detail => detail.kind === "text"
      && detail.value.startsWith("an absence write to an optional reference"))), true);

    const account = createTypedAccount(input);
    const admit = tirReadyReadAdmission(account);
    let cutoff = null;
    let refused = false;
    const stopped = verifyTir(proof, request => {
      assert.equal(refused, false, "no next admission after the first proof refusal");
      if (request.kind !== "source-field-proof") return admit(request);
      cutoff = chargeWork(account, input.limits.dataflow.maximumWork);
      refused = true;
      assert.notEqual(cutoff, null);
      return cutoff;
    })(candidate);
    assert.equal(stopped.kind, "resource-stop");
    assert.equal(stopped.stop === cutoff, true);
  }
});

test("a nested held field reaches Typed IR through both independently selected source declarations", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { indexSyntaxTree } = await import("../../packages/host/dist/ir-hir/index.js");
  const { verifyTir, parseTir, printTir } = await import("../../packages/host/dist/ir-tir/index.js");
  const { tirReadyReadAdmission } = await import("../../packages/host/dist/ir-program/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export function read(first: { child: { flag: boolean } }, other: { child: { flag: boolean } }): boolean {
      return (first.child).flag;
    }
  `);
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const typed = typeSourceBarrier(input, captured.value, createTypedAccount(input));
  assert.equal(typed.kind, "ok", JSON.stringify(typed.diagnostics));
  const proof = typed.value.verifierOf(input.snapshot.entryPoint);
  const body = proof.module.bodies.find(row => row.root.kind === "Block" && row.bindings.kind === "instantiated");
  assert.ok(body);
  const leaf = body.root.statements.nodes[0].expression;
  const child = leaf.expression.expression;
  const through = [child, leaf].map(access => access.tsonic.selection.decision.decision);
  assert.deepEqual(through.map(row => [row.key.value, row.location.receiver]),
    [["child", "by-reference"], ["flag", "by-reference"]]);
  assert.equal(through[0].read, leaf.expression.tsonic.convertedType);
  assert.deepEqual(verifyTir(proof, tirReadyReadAdmission(createTypedAccount(input)))(body), { kind: "complete", violations: [] });
  const text = printTir(body);
  const parsed = parseTir(text);
  assert.equal(parsed.kind, "parsed");
  assert.equal(printTir(parsed.value), text);

  const properties = Array.from(indexSyntaxTree(proof.source.tree)).filter(node => node.kind === "PropertySignature" && node.name.text === "flag");
  const sameName = properties.find(node => node.tsonic.declaration.definition !== through[1].primary);
  assert.ok(sameName);
  const crossed = { ...proof, declarationSourceOf: definition => definition === through[1].primary
    ? proof.declarationSourceOf(sameName.tsonic.declaration.definition) : proof.declarationSourceOf(definition) };
  const rejected = verifyTir(crossed, tirReadyReadAdmission(createTypedAccount(input)))(body);
  assert.equal(rejected.kind, "complete");
  assert.equal(rejected.violations.some(finding => finding.rule === "access-location" && finding.site.node === leaf.id), true);
});

test("a qualified optional reference comparison and its guarded nested read retain actual MIR presence operations", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { lowerMirDeps, mirVerificationContext } = await import("../../packages/host/dist/pipeline/lower-mir-step.js");
  const { lowerToMir } = await import("../../packages/host/dist/lower-mir/index.js");
  const { internType, instanceKey, viewTypes } = await import("../../packages/host/dist/ir-types/index.js");
  const { verifyMir } = await import("../../packages/host/dist/ir-mir/index.js");
  for (const [absence, comparison, operand] of [["null", "(holder.child) !== null", 0], ["undefined", "undefined !== holder.child", 1]]) {
    const input = analysisInput(fixture, "sdk-minimal", `
      export function read(holder: { child: { flag: boolean } | ${absence} }): boolean {
        if (${comparison}) return holder.child.flag;
        return false;
      }
    `);
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok");
    const typed = typeSourceBarrier(input, captured.value, createTypedAccount(input));
    assert.equal(typed.kind, "ok", JSON.stringify(typed.diagnostics));
    const proof = typed.value.verifierOf(input.snapshot.entryPoint);
    const body = proof.module.bodies.find(row => row.root.kind === "Block" && row.bindings.kind === "instantiated");
    assert.ok(body);
    const branch = body.root.statements.nodes[0];
    const condition = branch.expression;
    const guarded = branch.thenStatement.expression.expression;
    const tested = condition.tsonic.operation.decision.decision;
    assert.deepEqual(tested.operation, { kind: "absence-test", negated: true });
    const narrowing = guarded.tsonic.narrowing;
    assert.equal(narrowing.kind, "narrowed");
    assert.equal(narrowing.source, tested.operands[operand]);
    assert.equal(narrowing.result, guarded.tsonic.convertedType);
    assert.equal(narrowing.failure, input.snapshot.nativeFacts.absentAccessFailure);
    const interner = captured.value.types;
    const defs = { completionSelector: internType(interner, { kind: "primitive", primitive: "int32" }),
      exceptionStorage: internType(interner, { kind: "intrinsic", intrinsic: "unknown" }) };
    const run = { selectedNativeFacts: input.snapshot.nativeFacts, interner, table: viewTypes(interner), defs,
      lowering: input.limits.lowering, verification: input.limits.mirVerification, declarationOf: typed.value.declarationOf,
      bodyOwner: identity => captured.value.checked.bodies.get(identity)?.owner ?? null,
      bodyOf: instance => typed.value.bodies.get(instanceKey(instance)) ?? null };
    const requiredEntries = [1];
    const unit = { request: { query: "mirBody", key: instanceKey(body) }, position: { kind: "result" } };
    const lowered = lowerToMir(lowerMirDeps(run, unit), body, [], requiredEntries);
    assert.equal(lowered.kind, "ok", JSON.stringify(lowered.diagnostics));
    const context = mirVerificationContext(run, body, requiredEntries);
    assert.deepEqual(verifyMir(lowered.value, context).violations, []);
    const check = lowered.value.blocks.find(block => block.terminator.kind === "check" && block.terminator.tir.node === guarded.id);
    assert.ok(check);
    const checked = lowered.value.places[check.terminator.place];
    assert.equal(checked.base.projection.kind, "refined");
    assert.equal(checked.storage, narrowing.result);
    const damaged = structuredClone(lowered.value);
    const compare = damaged.blocks.flatMap(block => block.statements).find(row => row.kind === "assign" && row.tir.node === condition.id);
    assert.equal(compare.value.kind, "binary");
    compare.value.operation.decision.operation.negated = false;
    const rejected = verifyMir(damaged, context);
    assert.equal(rejected.violations.some(row => row.rule === "operation-selected"), true);
  }
});

test("projected reference reads retain their root and checked presence removes only absence", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  for (const [carrier, body, nullable, checked, nested] of [
    ["{ flag: boolean }", "return holder.child.flag;", false, false, true],
    ["{ flag: boolean } | null", "if (holder.child !== null) return holder.child.flag; return false;", true, true, true],
    ["{ flag: boolean } | undefined", "if (undefined !== holder.child) return holder.child.flag; return false;", true, true, true],
    ["{ flag: boolean } | null", "return holder.child !== null;", true, false, false],
  ]) {
    const input = analysisInput(fixture, "sdk-minimal",
      `export function read(holder: { child: ${carrier} }): boolean { ${body} }`);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
    const selected = chapter.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "Block");
    const facts = selected.facts.find(row => row.execution.provided === 1);
    assert.deepEqual(facts.arena.projections.map(row => [row.parent, row.projection.member.decision.key.value]),
      nested ? [[null, "child"], [0, "flag"]] : [[null, "child"]]);
    const bound = facts.arena.boundProducers.find(row => facts.arena.producers[row.producer].path === 0);
    assert.ok(bound);
    const root = facts.arena.boundProducers.find(row => facts.arena.producers[row.producer].path === null);
    assert.equal(facts.arena.producers[bound.producer].kind, "parameter");
    assert.equal(facts.arena.producers[bound.producer].index, facts.arena.producers[root.producer].index);
    assert.deepEqual(bound.bindings, root.bindings);
    assert.equal(bound.context, root.context);
    const ownRead = read => {
      const origins = facts.arena.origins[read.origins];
      assert.deepEqual(origins.producers, [bound.id]);
      return origins;
    };
    const direct = facts.origins.reads.filter(read => {
      const base = selected.mir.places[read.place].base;
      return base.kind === "place" && base.projection.kind === "field" && base.projection.member.decision.key.value === "child";
    });
    assert.equal(direct.length, checked ? 2 : 1);
    for (const read of direct) assert.equal(ownRead(read).includesAbsence, nullable);
    const present = facts.origins.reads.filter(read => selected.mir.places[read.place].base.kind === "checked");
    assert.equal(present.length, checked ? 1 : 0);
    for (const read of present) assert.equal(ownRead(read).includesAbsence, false);
    if (nested && checked) {
      const limited = analyzeHostProgram({ ...input, limits: { ...input.limits,
        analyses: { ...input.limits.analyses, maximumProjectionDepth: 1 } } });
      assert.equal(limited.kind, "refused");
      assert.equal(limited.diagnostics.length, 1);
      assert.match(JSON.stringify(limited.diagnostics), /analysis\.maximumProjectionDepth/);
    }
  }
});

test("projected formal Origins survive summary publication without caller-local cell subjects", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export function read(holder: { child: { flag: boolean } }, input: boolean): boolean {
      let previous: boolean = input;
      const guard: boolean = previous;
      if (guard) return holder.child.flag;
      return false;
    }
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const selected = chapter.bodies.find(row => row.kind === "selected" && row.tir.params.length === 2);
  const body = selected.facts.find(row => row.execution.provided === 2).arena;
  const summary = result.value.index.summaries.find(row => row.key.kind === "body"
    && row.key.execution.instance.body === selected.instance.body && row.key.execution.provided === 2).arena;
  assert.equal(body.producers.some(row => row.kind === "local"), true);
  assert.equal(summary.producers.some(row => row.kind === "local"), false);
  const projected = arena => arena.boundProducers.find(row => arena.producers[row.producer].path === 0);
  const bodyRef = projected(body);
  const summaryRef = projected(summary);
  assert.ok(summaryRef.id < bodyRef.id);
  assert.ok(summaryRef.producer < bodyRef.producer);
  assert.equal(summary.producers[summaryRef.producer].index, 0);
  const original = body.origins.find(row => row.producers.includes(bodyRef.id));
  assert.deepEqual(summary.origins[original.id].producers, [summaryRef.id]);
  assert.deepEqual(original.producers, [bodyRef.id]);
});

test("a pure call or a descendant write preserves the actual parent presence guard", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  for (const [intervention, count] of [["pure();", 1], ["holder.child.flag = true;", 2]]) {
    const input = analysisInput(fixture, "sdk-minimal", `
      function pure(): void {}
      export function read(holder: { child: { flag: boolean } | null }): boolean {
        if (holder.child !== null) {
          ${intervention}
          return holder.child.flag;
        }
        return false;
      }
    `);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
    const selected = chapter.bodies.find(row => row.kind === "selected" && row.tir.params.length === 1);
    const guard = selected.tir.root.statements.nodes[0].expression;
    const checks = selected.mir.blocks.map(row => row.terminator).filter(row => row.kind === "check");
    const facts = selected.facts.find(row => row.execution.provided === 1);
    assert.equal(checks.length, count);
    assert.deepEqual(facts.refinements.refinements.map(row => [row.kind, row.node, row.guards]),
      checks.map(row => ["proven", row.tir.node, [guard.id]]));
    if (count === 2) {
      const summary = result.value.index.summaries.find(row => row.key.kind === "body"
        && row.key.execution.instance.body === selected.instance.body);
      assert.deepEqual(summary.parameters[0].writes.paths, [1]);
      assert.equal(summary.arena.projections[1].parent, 0);
    } else assert.equal(selected.mir.blocks.some(row => row.terminator.kind === "call"), true);
  }
});

test("a selected by-value reference view keeps the original operand, formal and nested fields through publication", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { parseMir, printMir } = await import("../../packages/host/dist/ir-mir/index.js");
  const { parseTir, printTir, verifyTir } = await import("../../packages/host/dist/ir-tir/index.js");
  const { parseModuleBodies, printModuleBodies, tirReadyReadAdmission } = await import("../../packages/host/dist/ir-program/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    function pure(formal: { sibling: boolean; child: { flag: boolean } | null }): boolean { return true; }
    export function read(caller: { child: null | { flag: boolean }; sibling: boolean }): boolean {
      if (caller.child !== null) { pure(caller); return caller.child.flag; }
      return false;
    }
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const selected = chapter.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "Block"
    && row.tir.root.statements.nodes[0]?.kind === "IfStatement");
  assert.ok(selected);
  const guard = selected.tir.root.statements.nodes[0];
  const call = selected.mir.blocks.find(row => row.terminator.kind === "call").terminator;
  const actual = guard.thenStatement.statements.nodes[0].expression;
  const argument = actual.arguments.nodes[0];
  const [mapping] = call.callee.resolution.decision.parameters;
  assert.equal(mapping.kind, "reference-argument");
  assert.notEqual(mapping.view.caller, mapping.view.formal);
  assert.equal(mapping.view.caller, argument.tsonic.convertedType);
  assert.equal(mapping.view.formal, result.value.index.types.signatures[call.callee.resolution.decision.completion.signature].parameters[0].type);
  assert.deepEqual(mapping.view.fields.map(row => row.parent), [null, 0, null]);
  assert.ok(mapping.view.fields.every(row => row.caller !== row.formal));
  const [provided] = call.arguments;
  assert.equal(provided.kind, "value");
  assert.equal(provided.operand.kind, "place");
  assert.equal(selected.mir.places[provided.operand.place].storage, mapping.view.caller);
  const facts = selected.facts.find(row => row.execution.provided === 1);
  assert.deepEqual(facts.refinements.refinements.map(row => [row.kind, row.guards]), [["proven", [guard.expression.id]]]);
  const { index } = result.value;
  for (const [value, print, parse] of [[selected.tir, printTir, parseTir], [selected.mir, printMir, parseMir],
    [chapter, value => printModuleBodies(index, value), text => parseModuleBodies(index, text)]]) {
    const text = print(value);
    const decoded = parse(text);
    assert.equal(decoded.kind, "parsed", decoded.kind === "invalid-text" ? JSON.stringify(decoded) : undefined);
    assert.equal(print(decoded.value), text);
  }

  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const typed = typeSourceBarrier(input, captured.value, createTypedAccount(input));
  assert.equal(typed.kind, "ok", JSON.stringify(typed.diagnostics));
  const candidate = [...typed.value.bodies.values()].find(row => row.bindings.kind === "instantiated" && row.root.kind === "Block"
    && row.root.statements.nodes[0]?.kind === "IfStatement");
  const proof = typed.value.verifierOf(input.snapshot.entryPoint);
  const verify = body => verifyTir(proof, tirReadyReadAdmission(createTypedAccount(input)))(body);
  assert.deepEqual(verify(candidate), { kind: "complete", violations: [] });
  const copied = structuredClone(candidate);
  const decision = copied.root.statements.nodes[0].thenStatement.statements.nodes[0].expression.tsonic.application.decision.callee.decision;
  const [reference] = decision.parameters;
  assert.equal(reference.kind, "reference-argument");
  reference.view.fields[1].caller = reference.view.fields[1].formal;
  const wrongField = verify(copied);
  assert.equal(wrongField.kind, "complete");
  assert.ok(wrongField.violations.some(row => row.rule === "argument-passing"));
});

test("deferred selection acquires the same actual reference view after native binding", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    function echo<T>(formal: { sibling: boolean; child: { flag: boolean } | null }, value: T): T { return value; }
    function take<T>(caller: { child: null | { flag: boolean }; sibling: boolean }, value: T): T { return echo(caller, value); }
    export function start(caller: { child: null | { flag: boolean }; sibling: boolean }, value: boolean): boolean {
      return take(caller, value);
    }
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const chapter = modules.find(row => row.module === input.snapshot.entryPoint);
  const rows = chapter.bodies.filter(row => row.instance.body.includes(";take];function;0]"));
  const selected = rows.find(row => row.kind === "selected");
  const template = rows.find(row => row.kind === "template");
  const application = template.tir.root.statements.nodes[0].expression.tsonic.application;
  assert.equal(application.kind, "deferred");
  assert.equal(application.deferred.invocation.rule, "candidate");
  const call = selected.mir.blocks.find(block => block.terminator.kind === "call").terminator;
  const [view, scalar] = call.callee.resolution.decision.parameters;
  assert.equal(view.kind, "reference-argument");
  assert.equal(scalar.kind, "argument");
  assert.notEqual(view.view.caller, view.view.formal);
  assert.deepEqual(view.view.fields.map(row => row.parent), [null, 0, null]);
  const completion = index.types.signatures[call.callee.resolution.decision.completion.signature];
  assert.equal(completion.parameters[0].type, view.view.formal);
  assert.deepEqual(index.types.terms[completion.parameters[1].type], { kind: "primitive", primitive: "bool" });
});

test("selected reference-call writes distinguish the guarded cell from siblings and descendants", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  for (const [write, cleared, nested] of [
    ["formal.child = null;", true, false],
    ["formal.other = null;", false, false],
    ["if (formal.child !== null) formal.child.flag = false;", false, true],
  ]) {
    const input = analysisInput(fixture, "sdk-minimal", `
      function change(formal: { other: { flag: boolean } | null; child: { flag: boolean } | null }): void { ${write} }
      export function read(holder: { child: { flag: boolean } | null; other: { flag: boolean } | null }): boolean {
        if (holder.child !== null) {
          const alias = holder;
          change(alias);
          return holder.child.flag;
        }
        return false;
      }
    `);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", write);
    const { index, modules } = result.value;
    const chapter = modules.find(row => row.module === input.snapshot.entryPoint);
    const selected = chapter.bodies.find(row => row.kind === "selected" && row.instance.body.includes(";read];function;0]"));
    const guard = selected.tir.root.statements.nodes[0].expression;
    const call = selected.mir.blocks.find(row => row.terminator.kind === "call" && row.terminator.callee.kind === "direct").terminator;
    const [mapping] = call.callee.resolution.decision.parameters;
    assert.equal(mapping.kind, "reference-argument");
    const [child, flag, other] = mapping.view.fields;
    const checks = selected.mir.blocks.map(row => row.terminator).filter(row => row.kind === "check");
    assert.equal(checks.length, 1);
    const [check] = checks;
    const facts = selected.facts.find(row => row.execution.provided === 1);
    assert.deepEqual(facts.refinements.refinements, [cleared ? {
      kind: "unproven", node: check.tir.node, guards: [guard.id],
      reason: { kind: "invalidated", sites: [{ kind: "call", at: call.tir }] },
    } : { kind: "proven", node: check.tir.node, guards: [guard.id] }], write);
    const summary = index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === selected.instance.body);
    const [written] = summary.parameters[0].writes.paths;
    assert.equal(summary.parameters[0].writes.paths.length, 1, write);
    const projected = summary.arena.projections[written];
    assert.equal(projected.projection.member.decision.primary, nested ? flag.caller : cleared ? child.caller : other.caller, write);
    if (nested) assert.equal(summary.arena.projections[projected.parent].projection.member.decision.primary, child.caller);
    else assert.equal(projected.parent, null);
  }
});

test("selected reference-call writes invalidate nested guards and guards on possibly aliased formals", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const leaf = "{ child: { flag: boolean } | null }";
  const nested = `{ inner: ${leaf} | null }`;
  for (const [source, provided, answers] of [
    [`
      function clear(formal: ${nested}): void { formal.inner = null; }
      export function read(holder: ${nested}): boolean {
        if (holder.inner !== null) {
          if (holder.inner.child !== null) { clear(holder); return holder.inner.child.flag; }
        }
        return false;
      }`, 1, [[0, "proven"], [1, "unproven"], [0, "unproven"]]],
    [`
      function clear(formal: ${leaf}): void { formal.child = null; }
      export function read(holder: ${leaf}, second: ${leaf}): boolean {
        if (holder.child !== null) { clear(second); return holder.child.flag; }
        return false;
      }`, 2, [[0, "unproven"]]],
  ]) {
    const input = analysisInput(fixture, "sdk-minimal", source);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
    const selected = chapter.bodies.find(row => row.kind === "selected" && row.instance.body.includes(";read];function;0]"));
    const [outer] = selected.tir.root.statements.nodes;
    const guards = [outer.expression, outer.thenStatement.statements.nodes[0].expression];
    const terms = selected.mir.blocks.map(row => row.terminator);
    const call = terms.find(row => row.kind === "call" && row.callee.kind === "direct");
    const checks = terms.filter(row => row.kind === "check").map(row => row.tir.node).sort((left, right) => left - right);
    assert.equal(checks.length, answers.length);
    const facts = selected.facts.find(row => row.execution.provided === provided);
    assert.deepEqual(facts.refinements.refinements, answers.map(([guard, kind], index) => {
      const row = { kind, node: checks[index], guards: [guards[guard].id] };
      return kind === "proven" ? row : { ...row, reason: { kind: "invalidated", sites: [{ kind: "call", at: call.tir }] } };
    }));
  }
});

test("generic reference effects retain the caller field scope, not the selected callee binder", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const shape = "{ child: { flag: boolean } | null }";
  for (const [generic, alias] of [[false, false], [true, false], [true, true]]) for (const writes of [false, true]) {
    const holding = alias ? "Holder" : shape;
    const input = analysisInput(fixture, "sdk-minimal", `
      ${alias ? `type Holder = ${shape};` : ""}
      function effect<T>(token: T, formal: ${shape}): void { ${writes ? "formal.child = null;" : ""} }
      ${generic ? "function read<U>" : "export function read"}(holder: ${holding}, token: ${generic ? "U" : "boolean"}): boolean {
        if (holder.child !== null) { effect(token, holder); return holder.child.flag; }
        return false;
      }
      ${generic ? `export function entry(holder: ${holding}, token: boolean): boolean { return read(holder, token); }` : ""}
    `);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
    const caller = chapter.bodies.find(row => row.kind === "selected" && row.instance.body.includes(";read];function;0]"));
    const terms = caller.mir.blocks.map(row => row.terminator);
    const call = terms.find(term => term.kind === "call" && term.callee.kind === "direct");
    const { implementationBindings, parameters } = call.callee.resolution.decision;
    const [calleeBinder] = implementationBindings.methodBindings;
    assert.equal(calleeBinder.kind, "bound");
    assert.equal(parameters[1].kind, "reference-argument");
    const [child] = parameters[1].view.fields;
    const own = caller.tir.lexicalBindings;
    assert.equal(own.methodBindings.length, generic ? 1 : 0);
    assert.equal(own.methodBindings.some(binding => binding.parameter === calleeBinder.parameter), false);
    const facts = caller.facts.find(row => row.execution.provided === 2);
    const fields = facts.arena.projections.filter(row => row.projection.kind === "field" && row.projection.member.decision.primary === child.caller);
    assert.equal(fields.length, 1, "the read guard and the applied effect name the same physical field");
    assert.deepEqual(fields[0].projection.member.decision.bindings, alias ? { ...own, methodBindings: [] } : own);
    const check = terms.find(term => term.kind === "check");
    const guard = caller.tir.root.statements.nodes[0].expression;
    const expected = { node: check.tir.node, guards: [guard.id] };
    assert.deepEqual(facts.refinements.refinements, [writes ? { ...expected, kind: "unproven",
      reason: { kind: "invalidated", sites: [{ kind: "call", at: call.tir }] } } : { ...expected, kind: "proven" }]);
  }
});

test("the same generic field declaration invalidates the caller under a different specialization", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const shape = "{ child: { flag: boolean } | null }";
  for (const [binder, writes] of [["token", true], ["true", true], ["true", false]]) {
    const input = analysisInput(fixture, "sdk-minimal", `
      function consume<T>(record: ${shape}, token: T, recur: boolean): boolean {
        if (record.child !== null) {
          if (recur) { consume(record, ${binder}, false); return record.child.flag; }
          ${writes ? "record.child = null;" : ""}
        }
        return false;
      }
      export function entry(record: ${shape}, token: string): boolean { return consume(record, token, true); }
    `);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
    const caller = chapter.bodies.find(row => row.kind === "selected" && row.instance.body.includes(";consume];function;0]")
      && result.value.index.types.terms[row.tir.lexicalBindings.methodBindings[0].type].kind === "string");
    assert.ok(caller);
    const terms = caller.mir.blocks.map(row => row.terminator);
    const call = terms.find(term => term.kind === "call" && term.callee.kind === "direct");
    const { activation, decision } = call.callee.resolution;
    assert.equal(activation.body, caller.instance.body);
    const [own] = caller.tir.lexicalBindings.methodBindings;
    const [target] = decision.implementationBindings.methodBindings;
    assert.equal(own.parameter, target.parameter);
    assert.equal(own.type === target.type, binder === "token");
    const [field] = decision.parameters[0].view.fields;
    assert.equal(field.formal, field.caller);
    assert.equal(field.formalType, field.callerType);
    const facts = caller.facts.find(row => row.execution.provided === 3);
    const paths = facts.arena.projections.filter(row => row.projection.kind === "field" && row.projection.member.decision.primary === field.caller);
    assert.deepEqual(paths.map(row => row.projection.member.decision.bindings.methodBindings), [[own]]);
    const check = terms.find(term => term.kind === "check");
    const guard = caller.tir.root.statements.nodes[0].expression;
    const expected = { node: check.tir.node, guards: [guard.id] };
    assert.deepEqual(facts.refinements.refinements, [writes ? { ...expected, kind: "unproven",
      reason: { kind: "invalidated", sites: [{ kind: "call", at: call.tir }] } } : { ...expected, kind: "proven" }]);
  }
});

test("a write-only optional reference field records absence on the actual receiver without reading the field", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  for (const absence of ["null", "undefined"]) {
    const input = analysisInput(fixture, "sdk-minimal", `
      export function clear(record: { field: { value: boolean } | ${absence} }): void {
        record.field = ${absence};
      }
    `);
    const published = analyzeHostProgram(input);
    assert.equal(published.kind, "ok", JSON.stringify(published.diagnostics));
    const chapter = published.value.modules.find(row => row.module === input.snapshot.entryPoint);
    const body = chapter.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "Block");
    assert.ok(body);
    const { mir, tir } = body;
    const assignment = tir.root.statements.nodes[0].expression;
    const facts = body.facts.find(row => row.execution.provided === 1);
    assert.ok(facts);
    const writes = facts.origins.writes.filter(row => row.destination === "member");
    assert.equal(writes.length, 1);
    const [write] = writes;
    assert.equal(write.node, assignment.id);
    const statement = mir.blocks[write.point.block].statements[write.point.statement];
    assert.equal(statement.kind, "assign");
    assert.equal(statement.tir.node, assignment.id);
    const place = mir.places[statement.place];
    assert.equal(place.base.kind, "place");
    assert.equal(place.base.projection.kind, "field");
    assert.equal(place.base.projection.member.decision.key.value, "field");
    assert.equal(place.base.projection.member.decision.read, null);
    assert.equal(facts.origins.reads.some(row => row.place === place.id), false);
    assert.equal(write.targets.length, 1);
    const receiver = facts.arena.boundProducers[write.targets[0]];
    const producer = facts.arena.producers[receiver.producer];
    assert.deepEqual({ kind: producer.kind, index: producer.index, path: producer.path },
      { kind: "parameter", index: 0, path: null });
    const [stored] = write.values;
    assert.deepEqual(stored.source, { body: tir.body, node: assignment.right.id });
    assert.deepEqual(facts.arena.origins[stored.origins], { id: stored.origins, kind: "complete", producers: [], includesAbsence: true });
    assert.deepEqual(write.boundaries, []);
    const summary = published.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === tir.body);
    const parameter = summary.parameters[0];
    assert.deepEqual(parameter.reads.paths, []);
    assert.equal(parameter.writes.paths.length, 1);
    assert.equal(summary.arena.projections[parameter.writes.paths[0]].projection.member.decision.primary,
      place.base.projection.member.decision.primary);
  }
});

test("verified Typed object bindings retain a native absence split and their separately placed default", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { parseTir, printTir, verifyTir } = await import("../../packages/host/dist/ir-tir/index.js");
  const { parseModuleBodies, printModuleBodies, tirReadyReadAdmission } = await import("../../packages/host/dist/ir-program/index.js");
  const { verifyMir } = await import("../../packages/host/dist/ir-mir/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export function bind(source: { first: boolean; second?: boolean }): boolean {
      const { first: left, second = !left } = source;
      return second;
    }
  `);
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const result = typeSourceBarrier(input, captured.value, createTypedAccount(input));
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const bodies = [...result.value.bodies.values()];
  const enclosing = bodies.find(body => body.bindings.kind === "instantiated" && body.root.kind === "Block");
  assert.ok(enclosing);
  const slots = enclosing.root.statements.nodes[0].declarationList.declarations.nodes[0].name.elements.nodes;
  const [left, right] = slots;
  assert.equal(left.tsonic.role, "field-binding");
  assert.equal(left.tsonic.field.decision.key.value, "first");
  assert.equal(left.name.text, "left");
  assert.equal(left.tsonic.present, null);
  assert.equal(left.tsonic.initializer, null);
  assert.equal(right.tsonic.role, "field-binding");
  assert.equal(right.tsonic.field.decision.key.value, "second");
  assert.equal(right.tsonic.present, right.tsonic.storage);
  assert.notEqual(right.tsonic.field.decision.read, right.tsonic.present);
  const child = bodies.find(body => body.body === right.tsonic.initializer && body.bindings.kind === "instantiated");
  assert.equal(child.root === right.initializer, true);
  assert.equal(child.completion, right.tsonic.storage);
  assert.deepEqual(child.captures.map(row => row.local), [left.tsonic.declaration.local]);
  const text = printTir(enclosing);
  const parsed = parseTir(text);
  assert.equal(parsed.kind, "parsed");
  assert.equal(printTir(parsed.value), text);
  const damaged = structuredClone(enclosing);
  damaged.root.statements.nodes[0].declarationList.declarations.nodes[0].name.elements.nodes[1].tsonic.present = null;
  const proof = result.value.verifierOf(input.snapshot.entryPoint);
  const rejected = verifyTir(proof, tirReadyReadAdmission(createTypedAccount(input)))(damaged);
  assert.equal(rejected.kind, "complete");
  assert.equal(rejected.violations.some(row => row.rule === "binding-storage" && row.detail.some(detail => detail.kind === "text"
    && detail.value.startsWith("the field read and selected native present"))), true);

  const published = analyzeHostProgram(input);
  assert.equal(published.kind, "ok", JSON.stringify(published.diagnostics));
  const { index, modules } = published.value;
  const module = modules.find(module => module.module === input.snapshot.entryPoint);
  const selected = module.bodies.find(row => row.kind === "selected" && row.tir.body === enclosing.body);
  const { mir } = selected;
  const fields = mir.places.filter(row => row.base.kind === "place" && row.base.projection.kind === "field");
  assert.deepEqual(fields.map(row => row.base.tir.node), [left.id, right.id]);
  assert.equal(fields[0].base.place, fields[1].base.place);
  const holder = fields[0].base.place;
  const statements = mir.blocks.flatMap(block => block.statements);
  assert.equal(statements.filter(row => row.kind === "assign" && row.place === holder).length, 1);
  const split = mir.blocks.find(block => block.terminator.kind === "switch" && block.terminator.tir.node === right.id);
  const { targets: [only], otherwise, operand } = split.terminator;
  assert.deepEqual(mir.constants[only.constant].value, { kind: "literal", value: { kind: "absence" } });
  assert.equal(split.statements.at(-1).place, operand.place);
  assert.deepEqual(split.statements.at(-1).value.operand, { kind: "place", place: fields[1].id });
  const absent = mir.blocks[only.target].terminator;
  const present = mir.blocks[otherwise];
  assert.equal(absent.kind, "call");
  assert.equal(absent.callee.instance.body, child.body);
  assert.equal(present.statements[0].place, absent.destination);
  assert.equal(mir.places[present.statements[0].value.operand.place].base.place, operand.place);
  assert.equal(present.terminator.kind, "goto");
  assert.equal(mir.blocks[absent.next].terminator.target, present.terminator.target);
  assert.equal(mir.blocks.filter(block => block.terminator.kind === "call" && block.terminator.tir.node === right.id).length, 1);
  const summary = index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === enclosing.body);
  assert.deepEqual(summary.parameters[0].reads.paths.map(path => summary.arena.projections[path].projection.member.decision.key.value).sort(),
    ["first", "second"]);
  const programText = printModuleBodies(index, module);
  const programParsed = parseModuleBodies(index, programText);
  assert.equal(programParsed.kind, "parsed");
  assert.equal(printModuleBodies(index, programParsed.value), programText);

  const ready = { selectedNativeFacts: input.snapshot.nativeFacts, source: selected.tir, types: index.types,
    limits: input.limits.mirVerification, requiredEntries: mir.entries.map(entry => entry.provided), declarationOf: result.value.declarationOf,
    bodyOwner: identity => fixture.ids.decodeBodyId(identity).value.owner,
    bodyOf: instance => module.bodies.find(row => row.kind === "selected" && row.tir.body === instance.body)?.tir ?? null };
  assert.deepEqual(verifyMir(mir, ready).violations, []);
  const crossed = { ...mir, blocks: mir.blocks.map(block => block === split ? { ...split,
    terminator: { ...split.terminator, targets: [{ ...only, target: otherwise }], otherwise: only.target } } : block) };
  const rejectedSplit = verifyMir(crossed, ready);
  assert.equal(rejectedSplit.kind, "complete");
  assert.equal(rejectedSplit.violations.some(row => row.rule === "check-place-exact"), true);
  assert.equal(rejectedSplit.violations.some(row => row.rule === "checked-place-available"), true);
});

test("an always-present destructured field has no placed default execution edge", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  for (const optional of [false, true]) {
    const input = analysisInput(fixture, "sdk-minimal", `
      function fallback(): boolean { return false; }
      export function read(box: { flag${optional ? "?" : ""}: boolean }): boolean {
        const { flag = fallback() } = box;
        return flag;
      }
    `);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { index, modules } = result.value;
    const chapter = modules.find(row => row.module === input.snapshot.entryPoint);
    const enclosing = chapter.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "Block" && row.tir.params.length === 1);
    assert.ok(enclosing);
    const binding = enclosing.tir.root.statements.nodes[0].declarationList.declarations.nodes[0].name.elements.nodes[0];
    assert.equal(binding.tsonic.role, "field-binding");
    assert.equal(binding.tsonic.present !== null, optional);
    const edges = index.dependencyInventory.dependencies.filter(row => row.dependent.instance.body === enclosing.tir.body);
    const terminators = enclosing.mir.blocks.map(block => block.terminator).filter(row => row.kind === "switch" || row.kind === "call");
    if (!optional) {
      assert.deepEqual(edges, []);
      assert.deepEqual(terminators, []);
      continue;
    }
    const initializer = chapter.bodies.find(row => row.kind === "selected" && row.tir.body === binding.tsonic.initializer);
    assert.ok(initializer);
    assert.equal(initializer.tir.root.kind, "CallExpression");
    assert.deepEqual(edges.map(row => [row.at.node, row.reason, row.target]), [
      [binding.id, "initializer", { kind: "body", execution: { instance: initializer.instance, provided: 0 } }],
    ]);
    assert.deepEqual(terminators.map(row => [row.tir.node, row.kind]), [[binding.id, "switch"], [binding.id, "call"]]);
    assert.equal(terminators[1].callee.instance.body, initializer.tir.body);
  }
});

test("installed ES2024 publishes a qualified scalar indexed write and read within its original allowance", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeTypedSource } = await import("../../packages/host/dist/pipeline/analysis-barrier.js");
  const { publishHostProgram } = await import("../../packages/host/dist/pipeline/publication.js");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const source = "export function exchange(values: boolean[], flag: boolean): boolean { values[0] = flag; return values[1]; }";
  const input = analysisInput(fixture, "es2024", source);
  const publish = maximumWork => {
    const bounded = { ...input, limits: { ...input.limits, dataflow: { ...input.limits.dataflow, maximumWork } } };
    const checked = captureSourceBarrier(bounded);
    assert.equal(checked.kind, "ok");
    const account = createTypedAccount(bounded);
    const typed = typeSourceBarrier(bounded, checked.value, account);
    assert.equal(typed.kind, "ok");
    const analyzed = analyzeTypedSource(bounded, typed.value, account);
    assert.equal(analyzed.kind, "ok");
    const result = publishHostProgram(bounded, typed.value, analyzed.value, account);
    return { result, state: InvocationAccount.stateOf(account) };
  };
  const installed = publish(input.limits.dataflow.maximumWork);
  const smaller = { ...input, snapshot: fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: fixture.sdk.getBundledLibraryClosure(["lib.es5.d.ts"]) }) };
  const modulesOf = run => run.snapshot.source.input.packages.modules.map(row => row.id).sort();
  const evidence = (result, run) => {
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    assert.deepEqual(result.value.modules.map(chapter => chapter.module).sort(), modulesOf(run));
    const chapter = result.value.modules.find(row => row.module === run.snapshot.entryPoint);
    const selected = chapter.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "Block");
    const [write, read] = selected.tir.root.statements.nodes;
    const occurrences = [write.expression.left, read.expression];
    const decisions = occurrences.map(node => {
      const { carrier, holding, key, read, write, failure, writeCheck } = node.tsonic.index;
      const terms = result.value.index.types.terms;
      return { node: node.id, text: node.argumentExpression.text, carrier, holding, key: terms[key].primitive,
        read: read === null ? null : terms[read].primitive, write: write === null ? null : terms[write].primitive, failure, writeCheck };
    });
    const { body } = selected.instance;
    const checks = selected.mir.blocks.flatMap(({ terminator }) => terminator.kind === "check" ? [terminator] : []);
    assert.deepEqual(checks.map(check => check.tir), occurrences.map(node => ({ body, node: node.id })));
    assert.equal(selected.mir.blocks[checks[0].next].statements.some(row => row.kind === "assign" && row.place === checks[0].place), true);
    assert.deepEqual(selected.mir.blocks[checks[1].next].terminator.value, { kind: "place", place: checks[1].place });
    const [facts] = selected.facts;
    assert.equal(facts.execution.provided, 2);
    assert.deepEqual(facts.arena.projections.map(row => row.projection), [{ kind: "index", constant: 0n }, { kind: "index", constant: 1n }]);
    const summary = result.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === body);
    const [array] = summary.parameters;
    assert.deepEqual(array, { slot: { kind: "parameter", index: 0 }, reads: { kind: "complete", paths: [1] }, writes: { kind: "complete", paths: [0] } });
    return { body, decisions };
  };
  const actual = evidence(installed.result, input);
  assert.deepEqual(actual, evidence(analyzeHostProgram(smaller), smaller));
  assert.deepEqual(actual.decisions.map(({ node, ...decision }) => decision), [
    { text: "0", carrier: "array", holding: "by-reference", key: "int64", read: null, write: "bool", failure: "unwind", writeCheck: "before-value" },
    { text: "1", carrier: "array", holding: "by-reference", key: "int64", read: "bool", write: null, failure: "unwind", writeCheck: null },
  ]);
  const maximum = installed.state.work - 1;
  const stopped = publish(maximum);
  assert.deepEqual(stopped.state.failure, { kind: "resource-limit", dimension: "work", maximum });
  assert.equal(stopped.result.kind, "refused");
  assert.equal(Object.hasOwn(stopped.result, "value"), false);
  assert.equal(stopped.result.diagnostics.length, 1);
  assert.equal(stopped.result.diagnostics[0].code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
  assert.deepEqual(stopped.result.diagnostics[0].arguments, [{ kind: "text", value: "work" }, { kind: "number", value: maximum }]);
});

test("a written type literal with no members is a complete empty structural type", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const input = analysisInput(fixture, "sdk-minimal", "export type Empty = {};");
  const result = captureSourceBarrier(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const module = result.value.modules.find(row => row.module.module === input.snapshot.entryPoint);
  const [alias] = module.module.tree.statements.nodes;
  assert.equal(alias.type.kind, "TypeLiteral");
  assert.equal(alias.type.tsonic.type.kind, "available");
  const table = fixture.types.viewTypes(result.value.types);
  assert.deepEqual(table.terms[alias.type.tsonic.type.value], { kind: "shape", members: [], indexes: [], calls: [], constructs: [] });
});

test("a declared interface preserves its explicit readonly tuple before omitted native defaults", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    interface Container<Item, Output = number, Input = string> {}
    export type Ready = Container<readonly [boolean, string]>;
  `);
  const result = captureSourceBarrier(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const module = result.value.modules.find(row => row.module.module === input.snapshot.entryPoint);
  const [container, alias] = module.module.tree.statements.nodes;
  const table = fixture.types.viewTypes(result.value.types);
  const selected = table.terms[alias.type.tsonic.type.value];
  assert.equal(selected.kind, "declared");
  assert.equal(selected.definition, container.tsonic.definition);
  assert.equal(selected.arguments.length, 3);
  const [tuple, output, inputType] = selected.arguments.map(value => table.terms[value]);
  assert.equal(tuple.kind, "tuple");
  assert.equal(tuple.readonly, true);
  assert.deepEqual(tuple.elements.map(element => table.terms[element.type]), [
    { kind: "primitive", primitive: "bool" }, { kind: "string" },
  ]);
  assert.deepEqual(output, { kind: "primitive", primitive: "float64" });
  assert.deepEqual(inputType, { kind: "string" });
});

test("an original rest formal retains each authored tuple arm and its actual binder", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  for (const annotation of ["[] | [T]", "[T] | []"]) {
    const input = analysisInput(fixture, "sdk-minimal",
      `export interface Iterator<T> { next(...[value]: ${annotation}): T; }`);
    const result = captureSourceBarrier(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const module = result.value.modules.find(row => row.module.module === input.snapshot.entryPoint);
    const [declaration] = module.module.tree.statements.nodes;
    const [method] = declaration.members.nodes;
    const [formal] = method.parameters.nodes;
    assert.equal(method.tsonic.body, null);
    assert.equal(formal.name.kind, "ArrayBindingPattern");
    const [binding] = formal.name.elements.nodes;
    const description = result.value.descriptions.get(binding.tsonic.declaration.definition);
    assert.equal(description.parent, formal.tsonic.declaration.definition);
    assert.deepEqual(description.bodies, []);
    const binder = declaration.typeParameters.nodes[0].tsonic.parameter.declaration;
    const table = fixture.types.viewTypes(result.value.types);
    assert.equal(formal.type.tsonic.type.kind, "available");
    const union = table.terms[formal.type.tsonic.type.value];
    assert.equal(union.kind, "union");
    const tuples = union.members.map(type => table.terms[type]);
    assert.equal(tuples.every(tuple => tuple.kind === "tuple" && !tuple.readonly), true);
    assert.deepEqual(tuples.map(tuple => tuple.elements.length).sort(), [0, 1]);
    const [element] = tuples.find(tuple => tuple.elements.length === 1).elements;
    assert.equal(element.kind, "required");
    assert.deepEqual(table.terms[element.type], { kind: "param", parameter: binder });
  }
});

test("a non-formal written union retains distinct tuple occurrences, including a zero-slot arm", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const input = analysisInput(fixture, "sdk-minimal", "export type Slots = readonly [boolean] | [];");
  const result = captureSourceBarrier(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const module = result.value.modules.find(row => row.module.module === input.snapshot.entryPoint);
  const [alias] = module.module.tree.statements.nodes;
  const { terms } = fixture.types.viewTypes(result.value.types);
  const choice = terms[alias.type.tsonic.type.value];
  assert.equal(choice.kind, "union");
  const alternatives = choice.members.map(id => terms[id]).sort((left, right) => left.elements.length - right.elements.length);
  assert.deepEqual(alternatives[0], { kind: "tuple", readonly: false, elements: [] });
  assert.equal(alternatives[1].kind, "tuple");
  assert.equal(alternatives[1].readonly, true);
  assert.deepEqual(terms[alternatives[1].elements[0].type], { kind: "primitive", primitive: "bool" });
});

test("two concrete uses of an executable foreign generic retain their own selected signatures and bodies", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const root = "/project/node_modules/dependency";
  const module = fixture.moduleOf(fixture.packageOf(root), "index.ts");
  const callers = [
    "export function first(value:boolean):boolean { return echo(value); }",
    "export function second(value:string):string { return echo<string>(value); }",
  ];
  for (const order of [callers, [...callers].reverse()]) {
    const source = 'import { echo } from "dependency"; ' + order.join(" ");
    const input = analysisInput(fixture, "sdk-minimal", source);
    input.snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
      libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
      extraFiles: { [root + "/package.json"]: JSON.stringify({ name: "dependency", version: "1.0.0", types: "index.ts" }) },
      otherPackages: [{ root, name: "dependency", modules: { "index.ts": ["source",
        "export function echo<T>(value:T):T { const copy:T = value; return copy; }", false] } }] });
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { index, modules } = result.value;
    const chapter = modules.find(row => row.module === module);
    const main = modules.find(row => row.module === input.snapshot.entryPoint);
    const publishedCallers = main.bodies.filter(row => row.kind === "selected" && row.tir.root.kind === "Block");
    assert.equal(publishedCallers.length, 2);
    for (const row of publishedCallers) {
      const expression = row.tir.root.statements.nodes[0].expression;
      const callee = expression.tsonic.application.decision.callee;
      assert.equal(callee.activation.bindings.bindings === callee.decision.implementationBindings, true);
    }
    const template = chapter.bodies.find(row => row.kind === "template" && row.tir.params.length === 1);
    const generic = index.types.signatures[template.tir.signature];
    assert.equal(generic.typeParameters.length, 1);
    const [parameter] = generic.typeParameters;
    assert.deepEqual(template.tir.lexicalBindings.methodBindings, [{ kind: "rigid", parameter: parameter.declaration }]);
    const selected = chapter.bodies.filter(row => row.kind === "selected" && row.instance.body === template.instance.body);
    assert.equal(selected.length, 2);
    const carriers = [];
    for (const row of selected) {
      const [binding] = row.instance.bindings.bindings.methodBindings;
      assert.equal(binding.kind, "bound");
      assert.equal(binding.parameter, parameter.declaration);
      const signature = index.types.signatures[row.tir.signature];
      assert.equal(signature.typeParameters.length, 0);
      assert.equal(signature.parameters[0].type, binding.type);
      assert.equal(signature.result, row.tir.completion);
      assert.equal(signature.result, binding.type);
      assert.equal(row.tir.params[0].tsonic.storage, binding.type);
      assert.deepEqual(row.mir.entries.map(entry => entry.provided), [1]);
      assert.deepEqual(row.facts.map(facts => facts.execution), [{ instance: row.instance, provided: 1 }]);
      const initializer = chapter.bodies.find(candidate => candidate.kind === "selected"
        && candidate.instance.body !== row.instance.body && candidate.tir.root.kind === "Identifier"
        && candidate.tir.completion === binding.type);
      assert.notEqual(initializer, undefined);
      const placed = index.types.signatures[initializer.tir.signature];
      assert.equal(placed.declaration, null);
      assert.deepEqual(placed.owner, { kind: "body", value: { body: initializer.instance.body, node: initializer.tir.root.id } });
      assert.deepEqual(initializer.mir.entries.map(entry => entry.provided), [0]);
      const type = index.types.terms[binding.type];
      carriers.push(type.kind === "primitive" ? type.primitive : type.kind);
    }
    assert.deepEqual(carriers.sort(), ["bool", "string"]);
    assert.equal(new Set(selected.map(row => row.tir.signature)).size, 2);
  }
});

test("only the omitted generic binding owns its ready default and required entry", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { sameInstance } = await import("../../packages/host/dist/ir-types/index.js");
  const root = "/project/node_modules/dependency";
  const module = fixture.moduleOf(fixture.packageOf(root), "index.ts");
  const source = 'import { choose } from "dependency"; '
    + "export function omitted(value:boolean):boolean { return choose(value); } "
    + "export function supplied(value:string):string { return choose<string>(value, value); } "
    + "export function inferred(value:number):number { return choose(value, value); }";
  const input = analysisInput(fixture, "sdk-minimal", source);
  input.snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
    extraFiles: { [root + "/package.json"]: JSON.stringify({ name: "dependency", version: "1.0.0", types: "index.ts" }) },
    otherPackages: [{ root, name: "dependency", modules: { "index.ts": ["source",
      "export function choose<T>(value:T, other:T=value):T { return other; }", false] } }] });
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const chapter = modules.find(row => row.module === module);
  const template = chapter.bodies.find(row => row.kind === "template" && row.tir.params.length === 2);
  const choices = chapter.bodies.filter(row => row.kind === "selected" && row.instance.body === template.instance.body);
  assert.equal(choices.length, 3);
  const withDefault = choices.find(row => row.mir.entries[0].provided === 1);
  const full = choices.filter(row => row.mir.entries[0].provided === 2);
  assert.equal(full.length, 2);
  assert.deepEqual(withDefault.mir.entries.map(entry => entry.provided), [1]);
  const formal = withDefault.tir.params[1];
  assert.equal(formal.initializer.kind, "ready-default");
  for (const supplied of full) {
    assert.deepEqual(supplied.mir.entries.map(entry => entry.provided), [2]);
    assert.equal(supplied.tir.params[1].initializer.kind, "checked-default");
  }
  const initializer = chapter.bodies.filter(row => row.kind === "selected" && row.instance.body === formal.tsonic.initializer);
  assert.equal(initializer.length, 1);
  assert.equal(sameInstance(initializer[0].instance, { body: formal.tsonic.initializer, bindings: withDefault.instance.bindings }), true);
  assert.equal(initializer[0].tir.root === formal.initializer.root, true);
  assert.equal(index.types.signatures[initializer[0].tir.signature].result, formal.tsonic.storage);
  assert.deepEqual(initializer[0].mir.entries.map(entry => entry.provided), [0]);
  assert.equal(index.dependencyInventory.dependencies.some(edge => edge.reason === "initializer"
    && edge.target.kind === "body" && sameInstance(edge.target.execution.instance, initializer[0].instance)), true);
});

for (const recursive of [false, true])
test(`binding-dependent calls in a generic template acquire only their concretely selected activation (${recursive ? "recursive" : "wrapper"})`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { sameInstance } = await import("../../packages/host/dist/ir-types/index.js");
  const root = "/project/node_modules/dependency";
  const module = fixture.moduleOf(fixture.packageOf(root), "index.ts");
  for (const reverse of [false, true]) {
    const library = recursive ? "export function take<T>(value:T):T { return take(value); }"
      : "function echo<T>(value:T):T { return value; } export function take<T>(value:T):T { return echo(value); }";
    const callers = ["export function first(value:boolean):boolean { return take(value); }",
      "export function second(value:string):string { return take(value); }"];
    const source = 'import { take } from "dependency"; ' + (reverse ? callers.reverse() : callers).join(" ");
    const input = analysisInput(fixture, "sdk-minimal", source);
    input.snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
      libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
      extraFiles: { [root + "/package.json"]: JSON.stringify({ name: "dependency", version: "1.0.0", types: "index.ts" }) },
      otherPackages: [{ root, name: "dependency", modules: { "index.ts": ["source", library, false] } }] });
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { index, modules } = result.value;
    const chapter = modules.find(row => row.module === module);
    const applicationOf = row => row.tir.root.statements.nodes[0].expression.tsonic.application;
    const template = chapter.bodies.find(row => row.kind === "template" && row.tir.root.kind === "Block"
      && row.tir.root.statements.nodes[0].expression.kind === "CallExpression");
    assert.equal(applicationOf(template).kind, "deferred");
    const deferred = applicationOf(template).deferred;
    assert.equal(deferred.invocation.rule, "candidate");
    assert.deepEqual(deferred.invocation.input.context.occurrence, {
      body: template.instance.body, node: template.tir.root.statements.nodes[0].expression.id,
    });
    const selections = chapter.bodies.filter(row => row.kind === "selected" && row.instance.body === template.instance.body);
    assert.equal(selections.length, 2);
    const carriers = selections.map(row => {
      const application = applicationOf(row);
      assert.equal(application.kind, "decided");
      const callee = application.decision.callee;
      assert.equal(callee.activation.bindings.bindings === callee.decision.implementationBindings, true);
      const target = chapter.bodies.find(candidate => candidate.kind === "selected" && sameInstance(candidate.instance, callee.activation));
      assert.equal(target.instance.body === row.instance.body, recursive);
      assert.equal(target.tir.signature, callee.decision.completion.signature);
      assert.equal(target.tir.completion, row.tir.completion);
      assert.deepEqual(target.mir.entries.map(entry => entry.provided), [1]);
      const type = index.types.terms[target.tir.completion];
      return type.kind === "primitive" ? type.primitive : type.kind;
    });
    assert.deepEqual(carriers.sort(), ["bool", "string"]);
  }
});

for (const omitted of [false, true])
test(`an independently closed call stays decided inside a generic template (${omitted ? "omitted" : "supplied"})`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `function echo(value:boolean${omitted ? "=true" : ""}):boolean { return value; }
function take<T>(value:T):boolean { return echo(${omitted ? "" : "true"}); }
export function run(value:string):boolean { return take(value); }`);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const template = chapter.bodies.find(row => row.kind === "template" && row.tir.lexicalBindings.methodBindings.length === 1);
  const selected = chapter.bodies.find(row => row.kind === "selected" && row.instance.body === template.instance.body);
  for (const row of [template, selected]) {
    const application = row.tir.root.statements.nodes[0].expression.tsonic.application;
    assert.equal(application.kind, "decided");
    const activation = application.decision.callee.activation;
    assert.equal(activation.bindings.kind, row.tir.bindings.kind);
    if (row === selected) {
      assert.equal(activation.bindings.bindings === application.decision.callee.decision.implementationBindings, true);
      assert.equal(activation.bindings === row.instance.bindings, false);
    }
    if (omitted) assert.deepEqual(application.decision.arguments[0].value.instance.bindings, activation.bindings);
  }
  if (omitted) {
    const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
    const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok");
    const prepared = typeSourceBarrier(input, captured.value, createTypedAccount(input));
    assert.equal(prepared.kind, "ok");
    const ready = [...prepared.value.bodies.values()].find(row => row.body === selected.instance.body && row.bindings.kind === "instantiated");
    const application = ready.root.statements.nodes[0].expression.tsonic.application.decision;
    assert.equal(application.arguments[0].value.instance.bindings === application.callee.activation.bindings, true);
  }
});

test("checked Source verifies the actual foreign generic scope before declaration description", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const source = "import { keep } from './native.js'; import { keep as other } from './foreign.js';"
    + "export function run(): boolean { return keep<boolean>(true); }";
  const declarations = "export declare function keep<Value>(value: Value): Value;";
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source, "native.d.ts": declarations, "foreign.d.ts": declarations },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  for (const entry of snapshot.source.input.packages.modules) if (entry.path.endsWith(".d.ts")) entry.role = "declaration";
  const input = { ...analysisInput(fixture, "sdk-minimal"), snapshot };
  const native = snapshot.source.input.packages.modules.find(entry => entry.path === "/project/src/native.d.ts").id;
  const foreign = snapshot.source.input.packages.modules.find(entry => entry.path === "/project/src/foreign.d.ts").id;
  const lower = pipelineWiring.front.lowerModule;
  const describe = pipelineWiring.decls.describeDefinitions;
  const modules = new Map();
  let described = 0;
  let crossed = false;
  try {
    pipelineWiring.decls.describeDefinitions = (ready, scopes, names) => {
      described += 1;
      const result = describe(ready, scopes, names);
      assert.equal(result.definitions.every(row => row.generics === scopes.bindingScopeOf(row.definition)), true);
      return result;
    };
    assert.equal(captureSourceBarrier(input).kind, "ok");
    assert.equal(described, snapshot.source.input.packages.modules.length);
    described = 0;
    pipelineWiring.front.lowerModule = (deps, raw) => {
      const result = lower(deps, raw);
      if (result.kind !== "ok") return result;
      modules.set(raw.module, result.value.module);
      if (!crossed && modules.has(snapshot.entryPoint) && modules.has(native) && modules.has(foreign)) {
        const original = modules.get(native).tree.statements.nodes[0].typeParameters.nodes[0];
        const substitute = modules.get(foreign).tree.statements.nodes[0].typeParameters.nodes[0];
        assert.equal(original.id, substitute.id);
        assert.notEqual(original.tsonic.parameter.declaration, substitute.tsonic.parameter.declaration);
        const candidate = modules.get(snapshot.entryPoint).bodies.flatMap(body => body.candidateLists.flatMap(list => list.candidates))[0];
        const [binding] = candidate.bindings.value.methodBindings;
        assert.equal(binding.parameter, original.tsonic.parameter.declaration);
        candidate.bindings.value.methodBindings = [{ ...binding, parameter: substitute.tsonic.parameter.declaration }];
        crossed = true;
      }
      return result;
    };
    assert.throws(() => captureSourceBarrier(input), /owning HIR verification barrier: binding-vector-complete/u);
    assert.equal(crossed, true);
    assert.equal(described, 0, "no declaration description runs before the actual checked-source barrier completes");
  } finally {
    pipelineWiring.front.lowerModule = lower;
    pipelineWiring.decls.describeDefinitions = describe;
  }
});

test("checked Source completes before a package library document can require role binding", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const input = analysisInput(fixture, "sdk-minimal");
  const limited = { ...input, limits: { ...input.limits,
    instantiation: { ...input.limits.instantiation, maximumCreatedRecords: 0 },
  } };
  const sourceRefusal = captureSourceBarrier(limited);
  assert.equal(sourceRefusal.kind, "refused");
  assert.ok(sourceRefusal.diagnostics.length > 0);

  const packages = input.snapshot.source.input.packages;
  const path = "/project/library.json";
  const withLibrary = roles => ({ ...input.snapshot, source: fixture.preparedSource({ ...input.snapshot.source.input, packages: { ...packages,
    packages: packages.packages.map(owner => owner.id === packages.rootPackage ? { ...owner, libraryEntry: path } : owner),
    files: [...packages.files, { kind: "physical", path, realPath: path, text: "{}" }]
      .sort((left, right) => left.path < right.path ? -1 : 1),
    libraryData: [{ package: packages.rootPackage, path, roles, declaredSummaries: [] }],
  } }) });
  const empty = withLibrary([]);
  const unregistered = withLibrary([{ role: "default-value", identity: {
    module: { providerId: "missing-provider", providerVersion: "1", packageName: null, moduleSpecifier: "missing", providerModuleId: "missing" },
    exportId: "defaultValue", memberId: null, signatureId: null,
  } }]);
  for (const snapshot of [empty, unregistered]) {
    assert.deepEqual(fixture.snapshots.verifySnapshot(snapshot, fixture.front.extensionReferencesOf(input.extensions)), []);
    assert.deepEqual(captureSourceBarrier({ ...limited, snapshot }), sourceRefusal);
  }
  assert.equal(captureSourceBarrier({ ...input, snapshot: empty }).kind, "ok");
  const rejected = captureSourceBarrier({ ...input, snapshot: unregistered });
  assert.equal(rejected.kind, "refused");
  assert.deepEqual(rejected.diagnostics.map(row => row.message),
    ["A role must be assigned by the package that registered its actual provider module."]);
});

test("public Host analysis reports the actual original readonly assignment diagnostic at its consuming fact", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const source = "export function store():boolean{const a:boolean=true;a=false;return a;}";
  const input = analysisInput(fixture, "sdk-minimal", source);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "refused");
  assert.equal(result.diagnostics.length, 1);
  const diagnostic = result.diagnostics[0];
  assert.equal(diagnostic.code.kind, "checker");
  assert.equal(diagnostic.code.number, 2588);
  assert.equal(diagnostic.site.kind, "source");
  assert.equal(diagnostic.site.origin.start, source.indexOf("a=false"));
  assert.equal(diagnostic.site.origin.length, 1);
  const valid = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", source.replace("const a", "let a")));
  assert.equal(valid.kind, "ok");

  const imported = "import { mutable as selected } from './provider.js';"
    + "export function store():boolean{selected=false;return selected;}";
  const selected = { ...input, snapshot: fixture.projectSnapshot({
    sourceFiles: { "main.ts": imported, "provider.ts": "export let mutable: boolean = true;" },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
  }) };
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const captured = captureSourceBarrier(selected);
  assert.equal(captured.kind, "ok");
  const owner = captured.value.modules.find(row => row.module.module === selected.snapshot.entryPoint).module;
  const target = owner.tree.statements.nodes[1].body.statements.nodes[0].expression.left;
  assert.equal(target.tsonic.resolution.kind, "binding");
  const failed = target.tsonic.place;
  assert.equal(failed.kind, "unavailable");
  assert.equal(failed.reason, "checker-error");
  const [cause] = failed.causes;
  const original = owner.checkerDiagnostics[cause.diagnostic.diagnostic.index];
  assert.equal(original.code.number, 2632);
  assert.equal(original.site.origin.start, imported.indexOf("selected=false"));
  const typed = typeSourceBarrier(selected, captured.value, createTypedAccount(selected));
  assert.equal(typed.kind, "refused");
  assert.equal(typed.diagnostics.length, 1);
  assert.equal(typed.diagnostics[0], original);
  const rejected = analyzeHostProgram(selected);
  assert.equal(rejected.kind, "refused");
  assert.deepEqual(rejected.diagnostics, [original]);
});

test("nested parentheses preserve the original readonly assignment diagnostic on the exact identifier", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const cases = [
    { prefix: "export function store(right: boolean): boolean { const selected: boolean = true; ", code: 2588 },
    { prefix: "import { mutable as selected } from './provider.js'; export function store(right: boolean): boolean { ", code: 2632 },
  ];
  for (const { prefix, code } of cases) {
    const source = prefix + "((selected)) = right; return selected; }";
    const input = analysisInput(fixture, "sdk-minimal", source);
    const selected = code === 2588 ? input : { ...input, snapshot: fixture.projectSnapshot({
      sourceFiles: { "main.ts": source, "provider.ts": "export let mutable: boolean = true;" },
      libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
    }) };
    const captured = captureSourceBarrier(selected);
    assert.equal(captured.kind, "ok");
    const entry = captured.value.modules.find(row => row.module.module === selected.snapshot.entryPoint).module;
    const body = entry.tree.statements.nodes.find(node => node.kind === "FunctionDeclaration").body;
    const { left: outer, right, tsonic } = body.statements.nodes.find(node => node.kind === "ExpressionStatement").expression;
    const inner = outer.expression;
    const leaf = inner.expression;
    assert.deepEqual([outer.kind, inner.kind, leaf.kind], ["ParenthesizedExpression", "ParenthesizedExpression", "Identifier"]);
    const failure = leaf.tsonic.views.read;
    assert.equal(failure.kind, "unavailable");
    assert.equal(failure.reason, "checker-error");
    assert.equal(failure.causes.length, 1);
    assert.deepEqual(outer.tsonic.views.read, failure);
    assert.deepEqual(inner.tsonic.views.read, failure);
    assert.deepEqual(right.tsonic.value.views.contextual, failure);
    assert.equal(right.tsonic.value.views.read.kind, "available");
    assert.equal(tsonic.value.views.read.kind, "available");
    const [cause] = failure.causes;
    const original = entry.checkerDiagnostics[cause.diagnostic.diagnostic.index];
    assert.equal(original.code.number, code);
    assert.deepEqual(original.site.origin, { module: selected.snapshot.entryPoint, start: prefix.length + 2,
      length: "selected".length, derived: [] });
    const typed = typeSourceBarrier(selected, captured.value, createTypedAccount(selected));
    assert.equal(typed.kind, "refused");
    assert.equal(typed.diagnostics.length, 1);
    assert.equal(typed.diagnostics[0], original);
    const program = analyzeHostProgram(selected);
    assert.equal(program.kind, "refused");
    assert.deepEqual(program.diagnostics, [original]);
  }
});

test("independent typing roots retain both original diagnostics in source order", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const missing = "export function missing(): boolean { return notDeclared; }";
  const readonly = "export function store(): boolean { const held: boolean = true; held = false; return held; }";
  const healthy = "export function ready(flag: boolean): boolean { return !flag; }";
  for (const roots of [[missing, healthy, readonly], [readonly, healthy, missing]]) {
    const source = roots.join("\n");
    const input = analysisInput(fixture, "sdk-minimal", source);
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok");
    const module = captured.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
    const originals = [...module.checkerDiagnostics].sort((left, right) => left.site.origin.start - right.site.origin.start);
    const codes = roots[0] === missing ? [2304, 2588] : [2588, 2304];
    assert.deepEqual(originals.map(row => row.code.number), codes);
    const typed = typeSourceBarrier(input, captured.value, createTypedAccount(input));
    assert.equal(typed.kind, "refused");
    assert.equal(typed.diagnostics.length, originals.length);
    for (const [position, diagnostic] of originals.entries()) {
      assert.equal(typed.diagnostics[position] === diagnostic, true, `original diagnostic at ${diagnostic.site.origin.start}`);
    }
    const published = analyzeHostProgram(input);
    assert.equal(published.kind, "refused");
    assert.equal(Object.hasOwn(published, "value"), false);
    assert.deepEqual(published.diagnostics, originals);
  }
  const project = analysisInput(fixture, "sdk-minimal", healthy);
  const distributed = { ...project, snapshot: fixture.projectSnapshot({
    sourceFiles: { "main.ts": healthy, "first.ts": missing, "second.ts": missing },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
  }) };
  const captured = captureSourceBarrier(distributed);
  assert.equal(captured.kind, "ok");
  const modules = ["first.ts", "second.ts"].map(name => fixture.moduleOf(fixture.packageOf("/project"), `src/${name}`)).sort();
  const originals = modules.map(module => {
    const [diagnostic] = captured.value.modules.find(row => row.module.module === module).module.checkerDiagnostics;
    assert.deepEqual(diagnostic.site, { kind: "source", origin: { module, start: missing.indexOf("notDeclared"),
      length: "notDeclared".length, derived: [] } });
    return diagnostic;
  });
  const published = analyzeHostProgram(distributed);
  assert.equal(published.kind, "refused");
  assert.deepEqual(published.diagnostics, originals);
  const repaired = [readonly.replace("const held", "let held"), healthy, missing.replace("notDeclared", "true")].join("\n");
  const accepted = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", repaired));
  assert.equal(accepted.kind, "ok");
  assert.deepEqual(accepted.diagnostics, []);
});

for (const [label, main, other, codes, borrowedCause] of [
  ["separate module roots", "export type Broken = readonly number;", "export type Other = unique symbol;", [1354, 1335]],
  ["separate declarations in one module", "export type Broken = readonly number; export type Other = unique symbol;",
    "export const healthy: boolean = true;", [1354, 1335]],
  ["reverse declaration order", "export type Other = unique symbol; export type Broken = readonly number;",
    "export const healthy: boolean = true;", [1335, 1354]],
  ["forwarded cause and earlier independent error",
    "export type First = Later; export type Middle = unique symbol; export type Later = readonly number;",
    "export const healthy: boolean = true;", [1335, 1354], 1],
  ["refused inference and ready elaboration", "export function missing(): boolean { return notDeclared; }",
    "export type Other = unique symbol;", [2304, 1335]],
  ["refused child and unrelated module", "export function checked(flag: boolean): boolean { type Broken = readonly number; return flag; }",
    "export type Other = unique symbol;", [1354, 1335]],
  ["one origin reused by two modules", 'import type { Broken } from "./other.js"; export type Also = (Broken);',
    "export type Broken = readonly number;", [1354]],
]) test(`independent elaboration roots preserve original diagnostics: ${label}`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const project = analysisInput(fixture, "sdk-minimal", main);
  const snapshot = (entry, dependency) => fixture.projectSnapshot({
    sourceFiles: { "main.ts": entry, "other.ts": dependency },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
  });
  const input = { ...project, snapshot: snapshot(main, other) };
  const checked = captureSourceBarrier(input);
  assert.equal(checked.kind, "ok", label);
  const originals = ["main.ts", "other.ts"].flatMap(name => {
    const id = fixture.moduleOf(fixture.packageOf("/project"), `src/${name}`);
    return checked.value.modules.find(row => row.module.module === id).module.checkerDiagnostics;
  });
  assert.deepEqual(originals.map(diagnostic => diagnostic.code.number), codes);
  if (borrowedCause !== undefined) {
    const module = checked.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
    const declaration = module.tree.statements.nodes[0];
    assert.equal(declaration.kind, "TypeAliasDeclaration");
    const failure = declaration.type.tsonic.type;
    assert.equal(failure.kind, "unavailable");
    assert.equal(failure.reason, "checker-error");
    assert.deepEqual(failure.causes, [{ kind: "diagnostic", diagnostic: { kind: "checker",
      diagnostic: { module: module.module, index: borrowedCause } } }]);
  }
  const typed = typeSourceBarrier(input, checked.value, createTypedAccount(input));
  assert.equal(typed.kind, "refused", label);
  assert.equal(typed.diagnostics.length, originals.length, label);
  for (const [position, diagnostic] of originals.entries()) {
    assert.equal(typed.diagnostics[position] === diagnostic, true, `${label}/original ${diagnostic.code.rendered}`);
  }
  const published = analyzeHostProgram(input);
  assert.equal(published.kind, "refused", label);
  assert.equal(Object.hasOwn(published, "value"), false, label);
  assert.deepEqual(published.diagnostics, originals);
  const repair = source => source.replace("readonly number", "number").replace("unique symbol", "symbol").replace("notDeclared", "true");
  const repaired = analyzeHostProgram({ ...input, snapshot: snapshot(repair(main), repair(other)) });
  assert.equal(repaired.kind, "ok", label);
  assert.deepEqual(repaired.diagnostics, []);
});

for (const [label, source, codes] of [
  ["unused named import", "import { missing } from './library.js';", [2305]],
  ["named re-export", "export { missing as exposed } from './library.js';", [2305]],
  ["named re-export of a missing module", "export { value } from './absent.js';", [2307]],
  ["direct local export of an unbound name", "const value: boolean = true; export { missing };", [2304]],
  ["renamed local export of an unbound name", "const value: boolean = true; export { missing as exposed };", [2304]],
  ["re-export with an independent error",
    "export { missing as exposed } from './library.js'; export type Invalid = readonly number;", [2305, 1354]],
]) test(`module bindings preserve exact original checker errors: ${label}`, async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", source);
  const snapshot = main => fixture.projectSnapshot({ sourceFiles: {
    "main.ts": main + "\nexport const healthy: boolean = true;",
    "library.ts": "export const value: boolean = true;",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const failedInput = { ...input, snapshot: snapshot(source) };
  const checked = captureSourceBarrier(failedInput);
  assert.equal(checked.kind, "ok");
  const module = checked.value.modules.find(row => row.module.module === failedInput.snapshot.entryPoint).module;
  assert.deepEqual(module.checkerDiagnostics.map(diagnostic => diagnostic.code.number), codes);
  const [binding] = module.bindings;
  assert.deepEqual(binding.target, { kind: "available", value: { kind: "unresolved",
    diagnostics: [{ module: module.module, index: 0 }] } });
  const typed = typeSourceBarrier(failedInput, checked.value, createTypedAccount(failedInput));
  assert.equal(typed.kind, "refused");
  assert.equal(typed.diagnostics.length, codes.length);
  for (const [position, original] of module.checkerDiagnostics.entries())
    assert.equal(typed.diagnostics[position] === original, true, `${label}/original ${original.code.rendered}`);
  const refused = analyzeHostProgram(failedInput);
  assert.equal(refused.kind, "refused");
  assert.equal(Object.hasOwn(refused, "value"), false);
  assert.deepEqual(refused.diagnostics, module.checkerDiagnostics);
  const repaired = source.replace("missing", "value").replace("./absent", "./library").replace("readonly number", "number");
  const accepted = analyzeHostProgram({ ...input, snapshot: snapshot(repaired) });
  assert.equal(accepted.kind, "ok");
  assert.deepEqual(accepted.diagnostics, []);
});

for (const [label, source, codes] of [
  ["side-effect only", "import './absent.js';", [2882]],
  ["empty import", "import {} from './absent.js';", [2307]],
  ["star export and an independent annotation", "export * from './absent.js'; export type Invalid = readonly number;", [2307, 1354]],
]) test(`static module specifiers without bindings preserve exact original checker errors: ${label}`, async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", source);
  const snapshot = main => fixture.projectSnapshot({ sourceFiles: {
    "main.ts": main + "\nexport const healthy: boolean = true;",
    "library.ts": "export const value: boolean = true;",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const failed = { ...input, snapshot: snapshot(source) };
  const captured = captureSourceBarrier(failed);
  assert.equal(captured.kind, "ok");
  const module = captured.value.modules.find(row => row.module.module === failed.snapshot.entryPoint).module;
  assert.deepEqual(module.bindings, []);
  assert.deepEqual(module.checkerDiagnostics.map(diagnostic => diagnostic.code.number), codes);
  const [statement] = module.tree.statements.nodes;
  const target = statement.tsonic.target;
  assert.equal(target === statement.moduleSpecifier.tsonic.target, true, "one exact checked target");
  assert.deepEqual(target, { kind: "unavailable", reason: "checker-error", causes: [
    { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: module.module, index: 0 } } },
  ] });
  const typed = typeSourceBarrier(failed, captured.value, createTypedAccount(failed));
  assert.equal(typed.kind, "refused");
  assert.equal(typed.diagnostics.length, codes.length);
  for (const [position, original] of module.checkerDiagnostics.entries())
    assert.equal(typed.diagnostics[position] === original, true, `${label}/original ${original.code.rendered}`);
  const refused = analyzeHostProgram(failed);
  assert.equal(refused.kind, "refused");
  assert.equal(Object.hasOwn(refused, "value"), false);
  assert.deepEqual(refused.diagnostics, module.checkerDiagnostics);
  const repaired = source.replace("./absent", "./library").replace("readonly number", "number");
  const accepted = analyzeHostProgram({ ...input, snapshot: snapshot(repaired) });
  assert.equal(accepted.kind, "ok");
  assert.deepEqual(accepted.diagnostics, []);
});

for (const [label, main, relay, code] of [
  ["direct", "import { missing } from './library.js'; export function read(): boolean { return ((missing)); }", null, 2305],
  ["missing module", "import { value } from './absent.js'; export function read(): boolean { return value; }", null, 2307],
  ["through a re-export", "import { forwarded } from './relay.js'; export function read(): boolean { return forwarded; }",
    "export { missing as forwarded } from './library.js';", 2305],
]) test(`used module bindings preserve the exact original checker failure: ${label}`, async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", main);
  const snapshot = (source, exported) => fixture.projectSnapshot({
    sourceFiles: { "main.ts": source, "library.ts": "export const value: boolean = true;",
      ...(exported === null ? {} : { "relay.ts": exported }) },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
  });
  const failed = { ...input, snapshot: snapshot(main, relay) };
  const captured = captureSourceBarrier(failed);
  assert.equal(captured.kind, "ok");
  const module = captured.value.modules.find(row => row.module.module === failed.snapshot.entryPoint).module;
  const origin = relay === null ? module : captured.value.modules.find(row =>
    row.module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/relay.ts")).module;
  assert.deepEqual(origin.checkerDiagnostics.map(diagnostic => diagnostic.code.number), [code]);
  const [original] = origin.checkerDiagnostics;
  let expression = module.tree.statements.nodes.find(statement => statement.kind === "FunctionDeclaration").body.statements.nodes[0].expression;
  const expected = { kind: "unavailable", reason: "checker-error", causes: [
    { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: origin.module, index: 0 } } },
  ] };
  for (;;) {
    const checkedValue = expression.kind === "ParenthesizedExpression" ? expression.tsonic : expression.tsonic.value;
    assert.deepEqual(checkedValue.views.read, expected);
    if (expression.kind !== "ParenthesizedExpression") break;
    expression = expression.expression;
  }
  const typed = typeSourceBarrier(failed, captured.value, createTypedAccount(failed));
  assert.equal(typed.kind, "refused");
  assert.equal(typed.diagnostics.length === 1 && typed.diagnostics[0] === original, true);
  const refused = analyzeHostProgram(failed);
  assert.equal(refused.kind, "refused");
  assert.equal(Object.hasOwn(refused, "value"), false);
  assert.deepEqual(refused.diagnostics, [original]);
  const accepted = analyzeHostProgram({ ...input, snapshot: snapshot(main.replaceAll("missing", "value").replace("./absent", "./library"),
    relay?.replace("missing", "value") ?? null) });
  assert.equal(accepted.kind, "ok");
  assert.deepEqual(accepted.diagnostics, []);
});

for (const [label, source, codes] of [
  ["namespace", "import * as ns from './library.js'; export function read(): boolean { return ns.missing; }", [2339]],
  ["structural receiver", "export function read(arg: { value: boolean }): boolean { return ((arg.missing)); }", [2339]],
  ["nested receiver", "export function read(arg: { value: boolean }): boolean { return arg.missing.next.next; }", [2339]],
  ["wrapped nested receiver", "export function read(arg: { value: boolean }): boolean { return ((arg.missing!)).next; }", [2339]],
  ["two separate reads",
    "export function read(arg: { value: boolean }): boolean { arg.missing; return arg.vaule; }", [2339, 2551]],
]) test(`failed property reads retain original diagnostics without selecting a member: ${label}`, async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", source);
  const snapshot = main => fixture.projectSnapshot({
    sourceFiles: { "main.ts": main, "library.ts": "export const value: boolean = true;" },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
  });
  const failed = { ...input, snapshot: snapshot(source) };
  const captured = captureSourceBarrier(failed);
  assert.equal(captured.kind, "ok");
  const module = captured.value.modules.find(row => row.module.module === failed.snapshot.entryPoint).module;
  assert.deepEqual(module.checkerDiagnostics.map(diagnostic => diagnostic.code.number), codes);
  const statements = module.tree.statements.nodes.find(node => node.kind === "FunctionDeclaration").body.statements.nodes;
  for (const [index, statement] of statements.entries()) {
    const expected = { kind: "unavailable", reason: "checker-error", causes: [
      { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: module.module, index } } },
    ] };
    let selected = statement.expression;
    let reads = 0;
    for (;;) {
      if (selected.kind === "ParenthesizedExpression" || selected.kind === "NonNullExpression") {
        selected = selected.expression;
        continue;
      }
      if (selected.kind !== "PropertyAccessExpression") break;
      const unavailable = selected.tsonic.value.views.read;
      assert.deepEqual(unavailable, expected);
      assert.equal(selected.tsonic.origins === unavailable && selected.name.tsonic.key === unavailable
        && selected.tsonic.accessor === unavailable, true, "the failed read has no invented selection");
      reads += 1;
      selected = selected.expression;
    }
    assert.ok(reads > 0);
  }
  const typed = typeSourceBarrier(failed, captured.value, createTypedAccount(failed));
  assert.equal(typed.kind, "refused");
  assert.equal(typed.diagnostics.length, codes.length);
  assert.equal(typed.diagnostics.every((diagnostic, index) => diagnostic === module.checkerDiagnostics[index]), true);
  const refused = analyzeHostProgram(failed);
  assert.equal(refused.kind, "refused");
  assert.equal(Object.hasOwn(refused, "value"), false);
  assert.deepEqual(refused.diagnostics, module.checkerDiagnostics);
  const repaired = source.replace("arg.missing; ", "").replace(/return .*?;/u, "return true;");
  const ready = { ...input, snapshot: snapshot(repaired) };
  const readyChecked = captureSourceBarrier(ready);
  assert.equal(readyChecked.kind, "ok");
  assert.equal(typeSourceBarrier(ready, readyChecked.value, createTypedAccount(ready)).kind, "ok");
  if (label === "namespace") assert.equal(analyzeHostProgram(ready).kind, "ok");
});

for (const [label, source, codes] of [
  ["property callee", "export function read(arg:{value:boolean}):boolean{return ((arg.missing))();}", [2339]],
  ["separate argument failure", "export function read(arg:{value:boolean}):boolean{return arg.missing(unknownArgument);}", [2339, 2304]],
  ["unresolved callee", "export function read():boolean{return unknownCallee(true);}", [2304]],
]) test(`calls on failed callees retain their exact original diagnostics: ${label}`, async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", source);
  const checked = captureSourceBarrier(input);
  assert.equal(checked.kind, "ok");
  const module = checked.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
  const fn = module.tree.statements.nodes[0];
  const call = fn.body.statements.nodes[0].expression;
  assert.equal(call.kind, "CallExpression");
  assert.deepEqual(module.checkerDiagnostics.map(diagnostic => diagnostic.code.number), codes);
  const original = index => ({ kind: "unavailable", reason: "checker-error", causes: [
    { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: module.module, index } } },
  ] });
  assert.deepEqual(call.tsonic.application, original(0));
  assert.equal(call.tsonic.application === call.tsonic.views.read, true, "there is one unavailable call fact and no candidate");
  const body = module.bodies.find(row => row.body === fn.tsonic.body);
  assert.deepEqual(body.candidateLists, []);
  if (codes.length === 2) {
    assert.equal(call.arguments.nodes.length, 1);
    assert.deepEqual(call.arguments.nodes[0].tsonic.value.views.read, original(1));
  }
  const typed = typeSourceBarrier(input, checked.value, createTypedAccount(input));
  assert.equal(typed.kind, "refused");
  assert.equal(typed.diagnostics.length, codes.length);
  assert.equal(typed.diagnostics.every((diagnostic, index) => diagnostic === module.checkerDiagnostics[index]), true);
  const refused = analyzeHostProgram(input);
  assert.equal(refused.kind, "refused");
  assert.equal(Object.hasOwn(refused, "value"), false);
  assert.deepEqual(refused.diagnostics, module.checkerDiagnostics);
});

test("calls on failed callees retain independent authored type and value argument originals", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const source = "export function read(): boolean { return missingCallee<MissingFirst, boolean, MissingSecond>(missingValue); }";
  const input = analysisInput(fixture, "sdk-minimal", source);
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const module = captured.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
  const fn = module.tree.statements.nodes[0];
  const call = fn.body.statements.nodes[0].expression;
  assert.equal(call.kind, "CallExpression");
  const original = index => ({ kind: "unavailable", reason: "checker-error", causes: [
    { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: module.module, index } } },
  ] });
  assert.deepEqual(call.tsonic.application, original(0));
  assert.equal(call.tsonic.application === call.tsonic.views.read, true);
  assert.deepEqual(module.bodies.find(row => row.body === fn.tsonic.body).candidateLists, []);
  const [firstType, readyType, secondType] = call.typeArguments.nodes;
  assert.deepEqual(firstType.tsonic.type, original(1));
  assert.equal(readyType.tsonic.type.kind, "available");
  assert.deepEqual(secondType.tsonic.type, original(2));
  assert.deepEqual(call.arguments.nodes[0].tsonic.value.views.read, original(3));
  const published = module.checkerDiagnostics;
  assert.deepEqual(published.map(diagnostic => diagnostic.code.number), [2304, 2304, 2304, 2304]);
  assert.deepEqual(published.map(({ site: { origin: { start, length } } }) => source.slice(start, start + length)),
    ["missingCallee", "MissingFirst", "MissingSecond", "missingValue"]);
  const typed = typeSourceBarrier(input, captured.value, createTypedAccount(input));
  assert.equal(typed.kind, "refused");
  assert.equal(typed.diagnostics.length, published.length);
  assert.equal(typed.diagnostics.every((diagnostic, index) => diagnostic === published[index]), true);
  const refused = analyzeHostProgram(input);
  assert.equal(refused.kind, "refused");
  assert.equal(Object.hasOwn(refused, "value"), false);
  assert.deepEqual(refused.diagnostics, published);
});

test("an ordinary noncallable invocation keeps its own original and its independent argument failure", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const snapshotOf = source => fixture.projectSnapshot({ sourceFiles: { "main.ts": source }, libraries: [
    { name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent + "\ninterface Function { readonly length: number; }" },
  ] });
  const source = "export function read(flag:boolean):boolean{return flag(missingOperand);}";
  const snapshot = snapshotOf(source);
  const input = { ...analysisInput(fixture, "sdk-minimal"), snapshot };
  const checked = captureSourceBarrier(input);
  assert.equal(checked.kind, "ok");
  const module = checked.value.modules.find(row => row.module.module === snapshot.entryPoint).module;
  const declaration = module.tree.statements.nodes[0];
  const call = declaration.body.statements.nodes[0].expression;
  const originals = module.checkerDiagnostics;
  assert.deepEqual(originals.map(row => row.code.number), [2349, 2304]);
  const cause = index => ({ kind: "unavailable", reason: "checker-error", causes: [
    { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: module.module, index } } },
  ] });
  assert.deepEqual(call.tsonic.application, cause(0));
  assert.equal(call.tsonic.application === call.tsonic.views.read, true);
  assert.equal(call.expression.tsonic.value.views.read.kind, "available");
  assert.deepEqual(call.arguments.nodes[0].tsonic.value.views.read, cause(1));
  assert.deepEqual(module.bodies.find(row => row.body === declaration.tsonic.body).candidateLists, []);
  const typed = typeSourceBarrier(input, checked.value, createTypedAccount(input));
  assert.equal(typed.kind, "refused");
  assert.equal(typed.diagnostics.length, originals.length);
  assert.equal(typed.diagnostics.every((row, index) => row === originals[index]), true);
  assert.deepEqual(analyzeHostProgram(input), { kind: "refused", diagnostics: originals });
  const onlyCall = analyzeHostProgram({ ...input, snapshot: snapshotOf(source.replace("missingOperand", "true")) });
  assert.equal(onlyCall.kind, "refused");
  assert.deepEqual(onlyCall.diagnostics.map(row => row.code.number), [2349]);
  const healed = snapshotOf("function pass(value:boolean):boolean{return value;} export function read():boolean{return pass(true);}");
  assert.equal(analyzeHostProgram({ ...input, snapshot: healed }).kind, "ok");
});

test("failed local annotations and an independent read retain their original errors", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  for (const [firstType, secondType, result, expected] of [
    ["MissingFirst", "MissingSecond", "missingValue", ["MissingFirst", "MissingSecond", "missingValue"]],
    ["boolean", "boolean", "missingValue", ["missingValue"]],
    ["MissingFirst", "MissingSecond", "true", ["MissingFirst", "MissingSecond"]],
    ["boolean", "boolean", "true", []],
  ]) {
    const source = `export function read(): boolean { let first: ${firstType}; let second: ${secondType}; return ${result}; }`;
    const input = analysisInput(fixture, "sdk-minimal", source);
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok");
    const module = captured.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
    const originals = module.checkerDiagnostics;
    assert.deepEqual(originals.map(({ site: { origin: { start, length } } }) => source.slice(start, start + length)), expected);
    const typed = typeSourceBarrier(input, captured.value, createTypedAccount(input));
    const analyzed = analyzeHostProgram(input);
    assert.equal(typed.kind, expected.length === 0 ? "ok" : "refused");
    assert.equal(typed.diagnostics.length, originals.length);
    assert.equal(typed.diagnostics.every((diagnostic, index) => diagnostic === originals[index]), true);
    assert.equal(analyzed.kind, typed.kind);
    assert.deepEqual(analyzed.diagnostics, originals);
    assert.equal(Object.hasOwn(analyzed, "value"), expected.length === 0);
  }
});

test("static module specifiers without a published checker error retain missing evidence", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  for (const source of ["export {} from './absent.js';", "// @ts-expect-error\nimport './absent.js';"]) {
    const input = analysisInput(fixture, "sdk-minimal", source);
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok", source);
    const module = captured.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
    assert.deepEqual(module.checkerDiagnostics, [], source);
    assert.deepEqual(module.tree.statements.nodes[0].tsonic.target,
      { kind: "unavailable", reason: "incomplete-association", causes: [] }, source);
  }
});

test("Forms keeps an earned diagnosis and exactly one original Query refusal across module roots", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const { encodeKey } = await import("../../packages/host/dist/ids/index.js");
  const main = "export declare const forbidden: boolean;";
  const project = analysisInput(fixture, "sdk-minimal", main);
  const snapshot = fixture.projectSnapshot({
    sourceFiles: {
      "main.ts": main,
      "other.ts": "export function second(flag: boolean): boolean { return flag; }",
      "z.ts": "export function third(flag: boolean): boolean { return flag; }",
    },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
  });
  const captured = captureSourceBarrier({ ...project, snapshot });
  assert.equal(captured.kind, "ok");
  const checked = captured.value.modules.find(row => row.module.module === snapshot.entryPoint);
  assert.ok(checked);
  const module = checked.module.module;
  const detectors = checked.nodes.filter(node => node.kind === "DeclareKeyword");
  assert.equal(detectors.length, 1);
  const [detector] = detectors;
  assert.deepEqual(detector.origin, { module, start: main.indexOf("declare"), length: "declare".length, derived: [] });
  const forms = pipelineWiring.validate.formDiagnostics;
  const constraints = pipelineWiring.infer.constraintsOf;
  try {
    for (const [maximumRecords, earned] of [[1, false], [2, true], [6, true]]) {
      const label = `maximumRecords=${maximumRecords}`;
      let original;
      pipelineWiring.validate.formDiagnostics = (deps, site, unit) => {
        assert.equal(earned, true, label);
        assert.equal(original, undefined, label);
        assert.equal(site.module, module, label);
        assert.equal(site.report.id, detector.id, label);
        const report = forms(deps, site, unit);
        assert.equal(report.kind, "ok", label);
        [original] = report.diagnostics;
        return report;
      };
      pipelineWiring.infer.constraintsOf = () => assert.fail(`No solver may start before the detector is complete: ${label}`);
      const result = analyzeHostProgram({ ...project, snapshot, limits: { ...project.limits, query: { maximumRecords } } });
      assert.equal(result.kind, "refused", label);
      assert.equal(Object.hasOwn(result, "value"), false, label);
      assert.deepEqual(result.diagnostics.map(diagnostic => diagnostic.code.rendered),
        earned ? ["TSONIC_SOURCE_FORM_UNSUPPORTED", "TSONIC_COMPILER_RESOURCE_LIMIT"] : ["TSONIC_COMPILER_RESOURCE_LIMIT"], label);
      assert.equal(original !== undefined, earned, label);
      if (earned) {
        assert.strictEqual(result.diagnostics[0], original, label);
        assert.deepEqual(result.diagnostics[0].site, { kind: "source", origin: detector.origin }, label);
      }
      const stop = result.diagnostics.at(-1);
      assert.deepEqual(stop.site, { kind: "none" });
      assert.deepEqual(stop.evidence, ["query.maximumRecords", "formDiagnostics", encodeKey([module, detector.id]), encodeKey(["result"])]);
      assert.deepEqual(stop.arguments, [{ kind: "text", value: "query.maximumRecords" }, { kind: "number", value: maximumRecords }]);
    }
  } finally {
    pipelineWiring.validate.formDiagnostics = forms;
    pipelineWiring.infer.constraintsOf = constraints;
  }
});

test("the source barrier retains object data-property origins and initializer order", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const input = analysisInput(fixture, "sdk-minimal", "export const shape: { z: boolean; a: boolean } = { z: true, a: false };");
  const result = captureSourceBarrier(input);
  assert.equal(result.kind, "ok");
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const checked = result.value.modules.find(entry => entry.module.module === main).module;
  const declaration = checked.tree.statements.nodes[0].declarationList.declarations.nodes[0];
  const literal = declaration.initializer;
  const body = checked.bodies.find(row => row.root.id === literal.id);
  assert.equal(literal.kind, "ObjectLiteralExpression");
  assert.equal(body.root === literal, true);
  assert.deepEqual(literal.properties.nodes.map(property => property.initializer.kind), ["TrueKeyword", "FalseKeyword"]);
  for (const [index, property] of literal.properties.nodes.entries()) {
    const key = { kind: "text", value: ["z", "a"][index] };
    const origin = { kind: "source-member", occurrence: { body: body.body, node: property.id } };
    assert.deepEqual(property.tsonic.key, { kind: "available", value: key });
    assert.deepEqual(property.tsonic.origins, { kind: "available", value: [origin] });
    assert.equal(property.name.tsonic.role, "property-name");
    assert.deepEqual(property.name.tsonic.origins, property.tsonic.origins);
  }
});

test("the source barrier retains a library's actual generic bodyless callable without a synthetic body", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const source = 'import { hold } from "header-fixture"; export { hold };';
  const input = analysisInput(fixture, "sdk-minimal", source);
  const root = "/project/node_modules/header-fixture";
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
    extraFiles: { [root + "/package.json"]: '{"name":"header-fixture","version":"1.0.0","types":"index.d.ts"}' },
    otherPackages: [{ root, name: "header-fixture", modules: {
      "index.d.ts": ["declaration", "export declare function hold<T>(value: T): T;", true],
    } }] });
  const result = captureSourceBarrier({ ...input, snapshot });
  assert.equal(result.kind, "ok");
  const provider = fixture.moduleOf(fixture.packageOf(root), "index.d.ts");
  const checked = result.value.modules.find(entry => entry.module.module === provider).module;
  const declaration = checked.tree.statements.nodes[0];
  assert.equal(declaration.kind, "FunctionDeclaration");
  assert.equal(declaration.body, null);
  assert.equal(declaration.tsonic.body, null);
  assert.equal(checked.bodies.some(body => body.owner === declaration.tsonic.definition), false);
  const [endpoint] = declaration.tsonic.signatures;
  assert.equal(endpoint.role, "api-signature");
  assert.equal(endpoint.body, null);
  assert.equal(endpoint.declaration, declaration.tsonic.definition);
  const signature = fixture.types.readSignature(result.value.types, endpoint.signature);
  const parameter = declaration.parameters.nodes[0];
  assert.deepEqual(parameter.tsonic.declaration, { kind: "definition", definition: signature.parameters[0].declaration });
  assert.equal(signature.parameters[0].passing, "by-value");
  assert.equal(signature.result, signature.parameters[0].type);
  assert.deepEqual(signature.typeParameters, [declaration.typeParameters.nodes[0].tsonic.parameter]);
});

test("the source barrier retains the exact value declaration used by an authored type query", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const input = analysisInput(fixture, "sdk-minimal", "export let signal: boolean = true; export function read(value: typeof signal): boolean { return value; }");
  const result = captureSourceBarrier(input);
  assert.equal(result.kind, "ok");
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const source = result.value.modules.find(entry => entry.module.module === main).module;
  const signal = source.tree.statements.nodes[0].declarationList.declarations.nodes[0];
  const query = source.tree.statements.nodes[1].parameters.nodes[0].type;
  const declaration = signal.tsonic.declaration.definition;
  assert.equal(query.kind, "TypeQuery");
  assert.deepEqual(query.exprName.tsonic.resolution, { kind: "declarations", definitions: [declaration] });
  assert.deepEqual(query.tsonic.referencedDefinitions, [declaration]);
  assert.deepEqual(fixture.types.readType(result.value.types, query.tsonic.type.value), { kind: "primitive", primitive: "bool" });
});

test("the source barrier keeps a checked struct marker distinct from an unmarked value of the same declared type", async () => {
  const { fixture, result, module, marked, plain, call, fieldCall } = await captureCheckedMarkers();
  assert.equal(marked.type.tsonic.type.kind, "available");
  assert.deepEqual(marked.type.tsonic.type, plain.type.tsonic.type);
  assert.equal(plain.tsonic.core.markers.kind, "unavailable");
  const type = fieldCall.typeArguments.nodes[0];
  const body = module.bodies.find(entry => entry.root.id === call.id);
  const expected = { name: "flag", readonly: false, typeNode: { kind: "body", value: { body: body.body, node: type.id } },
    type: type.tsonic.type };
  const markers = node => node.tsonic.core.markers.value;
  assert.deepEqual(markers(fieldCall).field, expected);
  assert.deepEqual(markers(call).struct, { valueType: true, fields: { kind: "available", value: [expected] } });
  assert.deepEqual(markers(marked).struct, markers(call).struct);
  assert.deepEqual(markers(marked).application, { kind: "available", value: null });
  for (const [invocation, role] of [[call, "struct"], [fieldCall, "field"]]) {
    const signature = invocation.tsonic.application.value.resolvedSignature.value;
    assert.deepEqual(markers(invocation).application, { kind: "available", value: { role,
      occurrence: { body: body.body, node: invocation.id }, declaration: fixture.types.readSignature(result.value.types, signature).declaration } });
  }
  const original = markers(fieldCall).application;
  const struct = markers(call).application.value;
  const checkedApplication = fieldCall.tsonic.application.value;
  const originalSignature = checkedApplication.resolvedSignature;
  for (const [changed, selected] of [[{ declaration: struct.declaration }, originalSignature],
    [{ occurrence: struct.occurrence }, originalSignature], [{ role: "struct" }, originalSignature],
    [{ declaration: struct.declaration }, call.tsonic.application.value.resolvedSignature]]) {
    markers(fieldCall).application = { kind: "available", value: { ...original.value, ...changed } };
    checkedApplication.resolvedSignature = selected;
    const violations = fixture.verifyChecked(module, result.value.types,
      result.value.modules.map(entry => entry.module).filter(checked => checked !== module),
      definition => result.value.descriptions.get(definition)?.generics ?? null);
    assert.deepEqual(violations.filter(violation => violation.rule === "core-capture-reference"), [{ rule: "core-capture-reference",
      site: { kind: "node", node: { kind: "body", value: { body: body.body, node: fieldCall.id } } },
      detail: [{ kind: "text", value: "a marker application retains its exact checked call, marker payload and selected declaration" }] }]);
  }
  markers(fieldCall).application = original;
  checkedApplication.resolvedSignature = originalSignature;
  const text = fixture.hir.printHir(module);
  const parsed = fixture.hir.parseHir(text);
  assert.equal(parsed.kind, "parsed");
  assert.equal(fixture.hir.printHir(parsed.value), text);
});

test("real public Host analysis retains an omitted initializer's actual captured boolean mutation", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export function choose(a:boolean,b:boolean=(a=true)):boolean{return a;}");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const caller = main.bodies.find(body => body.kind === "selected" && body.tir.params.length === 2);
  assert.notEqual(caller, undefined);
  const child = main.bodies.find(body => body.kind === "selected" && body.instance.body === caller.tir.params[1].tsonic.initializer);
  assert.notEqual(child, undefined);
  assert.equal(child.tir.root, readyDefaultRoot(caller.tir.params[1]));
  assert.deepEqual(child.tir.captures, [{ local: caller.tir.params[0].tsonic.local, capture: "captured-location" }]);
  const summary = result.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === child.instance.body);
  assert.notEqual(summary, undefined);
  assert.equal(summary.writes.length, 1);
  assert.deepEqual(summary.contentsOnReturn, summary.writes);
  assert.equal(summary.initialization.points.some(point => point.kind === "need"), false);
  const returned = summary.initialization.points.findIndex(point => point.kind === "return");
  assert.equal(returned >= 0, true);
  assert.deepEqual(summary.initialization.rows.filter(row => row.point === returned),
    [{ point: returned, cell: null, condition: 0 }, { point: returned, cell: 0, condition: 1 }]);
  const mutations = child.facts[0].origins.writes.filter(row => row.targets.length !== 0);
  assert.equal(mutations.length, 1);
  assert.equal(mutations[0].operation, "mutation");
  assert.deepEqual(mutations[0].targets, [child.facts[0].arena.contexts[0].captures[0].location]);
  assert.deepEqual(caller.facts.map(facts => facts.execution.provided), [1, 2]);
  assert.deepEqual(caller.facts.map(facts => facts.origins.activations.length), [1, 0]);
  assert.equal(caller.facts[0].origins.exitContents.onReturn.length, 1);
  assert.equal(caller.facts[1].origins.exitContents.onReturn.length, 0);
});

test("real public Host analysis transports a captured string replacement through its actual omitted initializer", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function choose(a:string,replacement:string,b:string=(a=replacement)):string{return a;}");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const caller = main.bodies.find(body => body.kind === "selected" && body.tir.params.length === 3);
  assert.equal(caller !== undefined, true);
  const child = main.bodies.find(body => body.kind === "selected" && body.instance.body === caller.tir.params[2].tsonic.initializer);
  assert.equal(child !== undefined, true);
  const source = caller.tir.params[1].tsonic.local;
  const replacement = child.tir.captures.findIndex(row => row.local.body === source.body && row.local.local === source.local);
  assert.equal(replacement >= 0, true);
  const childSummary = result.value.index.summaries.find(row => row.key.kind === "body"
    && row.key.execution.instance.body === child.instance.body);
  assert.equal(childSummary !== undefined, true);
  assert.equal(childSummary.writes.length, 1);
  assert.deepEqual(childSummary.contentsOnReturn, childSummary.writes);
  const written = childSummary.arena.origins[childSummary.writes[0].value];
  assert.equal(written.kind, "complete");
  assert.equal(written.producers.length, 1);
  const bound = childSummary.arena.boundProducers[written.producers[0]];
  assert.deepEqual(childSummary.arena.producers[bound.producer], { id: bound.producer, kind: "capture", index: replacement, path: null });
  assert.deepEqual(caller.facts.map(facts => facts.execution.provided), [2, 3]);
  for (const facts of caller.facts) {
    const returned = facts.origins.subjects.find(row => row.role === "return");
    assert.equal(returned !== undefined, true);
    const origins = facts.arena.origins[returned.origins];
    assert.equal(origins.kind, "complete");
    assert.equal(origins.producers.length, 1);
    const value = facts.arena.boundProducers[origins.producers[0]];
    assert.equal(facts.arena.producers[value.producer].kind, "parameter");
    assert.equal(facts.arena.producers[value.producer].index, facts.execution.provided === 2 ? 1 : 0);
    assert.deepEqual(value.bindings, caller.mir.bindings.bindings);
  }
});

test("real public Host analysis preserves an imported generic declaration's actual constraint and default", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  input.snapshot = fixture.projectSnapshot({ sourceFiles: {
    "main.ts": "import type { Box } from './foreign.js';export type Applied=Box;export function value(input:boolean):boolean{return input;}",
    "foreign.ts": "export interface Box<T extends boolean=boolean>{(value:T):T;}",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.diagnostics.some(diagnostic => diagnostic.severity === "error"), false);
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const foreign = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/foreign.ts"));
  const box = readyModuleStatements(readyModuleRoot(foreign.tree))[0];
  const parameter = box.typeParameters.nodes[0];
  const applied = readyModuleStatements(readyModuleRoot(main.tree))[1];
  const selected = result.value.index.types.terms[applied.tsonic.type];
  assert.equal(selected.kind, "declared");
  assert.equal(selected.definition, box.tsonic.definition);
  assert.deepEqual(selected.arguments.map(type => result.value.index.types.terms[type]), [{ kind: "primitive", primitive: "bool" }]);
  for (const type of [parameter.tsonic.parameter.constraint, parameter.tsonic.parameter.default])
    assert.deepEqual(result.value.index.types.terms[type], { kind: "primitive", primitive: "bool" });
  assert.equal(readyModuleRoot(foreign.tree).tsonic.module, foreign.module);
  assert.equal(readyModuleRoot(main.tree).tsonic.module, main.module);
  assert.notEqual(foreign.module, main.module);
  assert.equal(main.bodies.some(body => body.kind === "selected" && body.tir.params.length === 1), true);
});

test("real public AnalyzeHostProgram closes the exported float64 add and every actual loaded declaration module", async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.diagnostics.some(diagnostic => diagnostic.severity === "error"), false);
  const { index, modules } = result.value;
  assert.equal(index.schema, 1);
  assert.equal(index.modules.length, input.snapshot.source.input.packages.modules.length);
  assert.equal(modules.length, input.snapshot.source.input.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = modules.find(module => module.module === main);
  assert.notEqual(module, undefined);
  const selected = module.bodies.filter(body => body.kind === "selected");
  assert.equal(selected.length, 2, "actual module execution and exported function execution are both present");
  assert.equal(selected.every(body => body.instance.bindings.kind === "instantiated"), true);
  assert.equal(module.bodies.filter(body => body.kind === "template").length, 2);
  assert.equal(index.dependencyInventory.operations.length, 2);
  assert.equal(index.summaries.length, 2);
  const add = selected.find(body => body.tir.params.length === 2);
  assert.notEqual(add, undefined);
  assert.deepEqual(add.mir.entries.map(entry => entry.provided), [2]);
  assert.equal(add.facts.length, 1);
  assert.equal(add.mir.blocks.some(block => block.statements.some(statement => statement.kind === "assign"
    && statement.value.kind === "binary" && statement.value.operation.decision.operation.kind === "native-operator"
    && statement.value.operation.decision.operation.operator === "+"
    && statement.value.operation.decision.operation.carrier === "float64")), true,
  "the selected native addition survives as the canonical MIR binary assignment");
});

test("real public Host analysis preserves a declared structural alias without inventing an execution body", async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const source = "export type Fields = { value: boolean; }; export function identity(input: boolean): boolean { return input; }\n";
  const input = analysisInput(fixture, "sdk-minimal", source);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.diagnostics.some(diagnostic => diagnostic.severity === "error"), false);
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  assert.equal(module !== undefined, true);
  const root = module.bodies.find(body => body.kind === "selected" && body.tir.root.kind === "SourceFile");
  assert.equal(root !== undefined, true);
  const alias = readyModuleStatements(root.tir.root).find(node => node.kind === "TypeAliasDeclaration");
  assert.equal(alias !== undefined, true);
  assert.equal(alias.type.kind, "TypeLiteral");
  assert.equal(alias.type.tsonic.type, alias.tsonic.type);
  const shape = result.value.index.types.terms[alias.tsonic.type];
  assert.equal(shape.kind, "shape");
  assert.deepEqual(shape.members.map(member => member.key), [{ kind: "text", value: "value" }]);
  assert.deepEqual(result.value.index.types.terms[shape.members[0].read], { kind: "primitive", primitive: "bool" });
  const published = result.value.index.modules.find(module => module.module === main);
  assert.equal(published.items.some(item => item.definition === alias.tsonic.definition && item.node === alias.id), true);
  assert.equal(module.bodies.filter(body => body.kind === "template").length, 2);
  assert.equal(module.bodies.filter(body => body.kind === "selected").length, 2);
});

test("real public Host analysis preserves generic nested structural members and bodyless accessors without creating executions", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const source = "export type Fields<T> = { value: T; readonly nested: { flag: boolean; }; method(input: boolean): boolean; get enabled(): boolean; set enabled(input: boolean | string); }; "
    + "export function identity(input: boolean): boolean { return input; }\n";
  const input = analysisInput(fixture, "sdk-minimal", source);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const selected = module.bodies.filter(body => body.kind === "selected");
  assert.equal(selected.length, 2);
  assert.equal(module.bodies.filter(body => body.kind === "template").length, 2);
  const root = selected.find(body => body.tir.root.kind === "SourceFile");
  assert.equal(root !== undefined, true);
  const alias = readyModuleStatements(root.tir.root).find(node => node.kind === "TypeAliasDeclaration");
  assert.equal(alias !== undefined && alias.type.kind === "TypeLiteral", true);
  const parameter = alias.typeParameters.nodes[0].tsonic.parameter.declaration;
  const shape = result.value.index.types.terms[alias.tsonic.type];
  assert.equal(shape.kind, "shape");
  const members = new Map(shape.members.map(member => [member.key.value, member]));
  assert.deepEqual(result.value.index.types.terms[members.get("value").read], { kind: "param", parameter });
  assert.equal(members.get("nested").write, null);
  const nested = result.value.index.types.terms[members.get("nested").read];
  assert.equal(nested.kind, "shape");
  assert.deepEqual(nested.members.map(member => member.key), [{ kind: "text", value: "flag" }]);
  const callable = alias.type.members.nodes.find(node => node.kind === "MethodSignature");
  const getter = alias.type.members.nodes.find(node => node.kind === "GetAccessor");
  const setter = alias.type.members.nodes.find(node => node.kind === "SetAccessor");
  assert.equal(callable !== undefined && getter !== undefined && setter !== undefined, true);
  for (const declaration of [callable, getter, setter]) {
    assert.equal(declaration.tsonic.template, null);
    for (const formal of declaration.parameters.nodes) assert.equal(formal.tsonic.local, null);
    assert.equal(declaration.tsonic.signatures.every(endpoint => endpoint.body === null), true);
  }
  assert.deepEqual(members.get("enabled").readOrigins, [{ kind: "declared", declaration: getter.tsonic.definition }]);
  assert.deepEqual(members.get("enabled").writeOrigins, [{ kind: "declared", declaration: setter.tsonic.definition }]);
});

test("public Host analysis carries declaration-only computed string and numeric names without executing them", checkComputedDeclarationNames);
test("public Host analysis publishes numeric and quoted member keys in the exact checked key domain", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export type Fields = { 0x20: boolean; 9007199254740993: boolean; "1.5": boolean };
    export type Keys = keyof Fields;
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.deepEqual(result.diagnostics, []);
  const module = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const [fields, keys] = readyModuleStatements(readyModuleRoot(module.tree));
  assert.deepEqual(fields.type.members.nodes.map(member => [member.name.kind, member.name.text, member.name.tsonic.role]), [
    ["NumericLiteral", "0x20", "declaration-name"],
    ["NumericLiteral", "9007199254740993", "declaration-name"],
    ["StringLiteral", "1.5", "declaration-name"],
  ]);
  const terms = result.value.index.types.terms;
  const exact = numerator => ({ kind: "number", value: { numerator, denominator: 1n, negativeZero: false } });
  const values = [exact(32n), exact(9007199254740992n), { kind: "string", value: "1.5" }];
  const shape = terms[fields.tsonic.type];
  assert.deepEqual(shape.members.map(({ key }) => key.kind === "text" ? { kind: "string", value: key.value } : key), values);
  const domain = terms[keys.tsonic.type];
  assert.equal(domain.kind, "union");
  assert.deepEqual(domain.members.map(member => terms[member].value), values);
});
test("public Host analysis preserves exact authored union arms through a foreign alias", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const main = 'import type { Values as Original } from "./values.js"; export type Alias = Original;'
    + ' export type Wrapped = (Original); export type Nearby = 9007199254740992; export type Duplicate = 0x20 | 32;';
  const input = analysisInput(fixture, "sdk-minimal", main);
  input.snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": main,
    "values.ts": "export type Values = 9007199254740992 | 9007199254740993;" },
  libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.deepEqual(result.diagnostics, []);
  const entry = result.value.modules.find(module => module.module === input.snapshot.entryPoint);
  const origin = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/values.ts"));
  const [original] = readyModuleStatements(readyModuleRoot(origin.tree));
  const [, alias, wrapped, nearby, duplicate] = readyModuleStatements(readyModuleRoot(entry.tree));
  const exact = original.tsonic.type;
  assert.deepEqual([alias.tsonic.type, wrapped.tsonic.type], [exact, exact]);
  assert.notEqual(nearby.tsonic.type, exact);
  const terms = result.value.index.types.terms;
  const union = terms[exact];
  assert.equal(union.kind, "union");
  assert.deepEqual(new Set(union.members), new Set(original.type.types.nodes.map(arm => arm.tsonic.type)));
  assert.deepEqual(new Set(union.members.map(arm => terms[arm].value.value.numerator)), new Set([9007199254740992n, 9007199254740993n]));
  assert.deepEqual(terms[duplicate.tsonic.type].value, { kind: "number", value: { numerator: 32n, denominator: 1n, negativeZero: false } });
});
test("public Host analysis preserves distinct exact values from a closed multi-key indexed read", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const main = 'import type { Read as Original } from "./values.js"; export type Result = ((Original));'
    + ' export type Nearby = 9007199254740992; export type Equal = { left: 32; right: 0x20 }["left" | "right"];';
  const input = { ...analysisInput(fixture, "sdk-minimal", main),
    snapshot: fixture.projectSnapshot({ sourceFiles: { "main.ts": main, "values.ts":
      'type Table = { left: 9007199254740992; right: 9007199254740993 }; export type Read = Table["left" | "right"];' },
      libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] }) };
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.deepEqual(result.diagnostics, []);
  const entry = result.value.modules.find(module => module.module === input.snapshot.entryPoint);
  const origin = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/values.ts"));
  const [table, read] = readyModuleStatements(readyModuleRoot(origin.tree));
  const [, imported, nearby, equal] = readyModuleStatements(readyModuleRoot(entry.tree));
  assert.equal(imported.tsonic.type, read.tsonic.type);
  assert.notEqual(nearby.tsonic.type, read.tsonic.type);
  const terms = result.value.index.types.terms;
  const choice = terms[read.tsonic.type];
  assert.equal(choice.kind, "union");
  assert.deepEqual(new Set(choice.members), new Set(terms[table.tsonic.type].members.map(member => member.read)));
  assert.deepEqual(new Set(choice.members.map(member => terms[member].value.value.numerator)), new Set([9007199254740992n, 9007199254740993n]));
  assert.deepEqual(terms[equal.tsonic.type].value, { kind: "number", value: { numerator: 32n, denominator: 1n, negativeZero: false } });
});
test("public Host analysis keeps computed names nonexecuting in aliases and nested annotations", checkNestedComputedDeclarationNames);
test("public Host analysis retains parenthesized declaration keys without executing them", checkParenthesizedComputedDeclarationNames);
test("public Host analysis keeps call-shaped declaration keys out of runtime calls", checkCallShapedComputedDeclarationName);
test("public Host analysis retains authored optional dots in declaration-only keys", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { instantiate, parseModuleBodies, printModuleBodies } = await import("../../packages/host/dist/ir-program/index.js");
  const source = "export interface Shape { [keys?.key]: boolean; [keys?.nested.key](): boolean; }";
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source }, libraries: [{ name: "lib.es5.d.ts",
    text: fixture.sdk.barebonesLibContent + '\ndeclare const keys: { readonly key: "chosen"; readonly nested: { readonly key: "deep" } };' }] });
  const input = { ...analysisInput(fixture, "sdk-minimal", source), snapshot };
  const { deps, program } = fixture.openAndCapture(snapshot);
  const raw = captureSingleModule(fixture.front, deps, program, snapshot.entryPoint);
  assert.equal(raw.kind, "ok");
  assert.deepEqual(raw.value.checkerDiagnostics, []);
  assert.deepEqual(raw.value.memberUses, []);
  assert.deepEqual(raw.value.calls, []);
  const output = analyzeHostProgram(input);
  assert.equal(output.kind, "ok", JSON.stringify(output.diagnostics));
  assert.deepEqual(output.diagnostics, []);
  const { index, modules } = output.value;
  const module = modules.find(row => row.module === snapshot.entryPoint);
  const [property, method] = readyModuleStatements(readyModuleRoot(module.tree))[0].members.nodes;
  for (const [name, chain, key] of [[property.name, property.name.expression, "chosen"],
    [method.name, method.name.expression.expression, "deep"]]) {
    assert.deepEqual(name.tsonic.key, { kind: "available", value: { kind: "text", value: key } });
    const dot = chain.questionDotToken;
    assert.equal(dot.kind, "QuestionDotToken");
    assert.equal(dot.parent, chain.id);
    assert.equal(dot.tsonic, null);
    assert.equal(source.slice(dot.origin.start, dot.origin.start + dot.origin.length), "?.");
    assert.deepEqual(chain.tsonic, { role: "declaration-name-expression" });
  }
  assert.equal(method.name.expression.questionDotToken, null);
  assert.deepEqual(method.name.expression.tsonic, { role: "declaration-name-expression" });
  const selected = module.bodies.find(body => body.kind === "selected");
  assert.deepEqual(selected.mir.constants, []);
  assert.equal(selected.mir.blocks.every(block => block.statements.length === 0 && block.terminator.kind !== "call"), true);
  assert.deepEqual(parseModuleBodies(index, printModuleBodies(index, module)), { kind: "parsed", value: module });
  const template = module.bodies.find(body => body.kind === "template");
  const replayed = instantiate(index, { ...module, bodies: [template] }, { kind: "tir", body: template.instance.body },
    selected.instance.bindings.bindings, input.limits.instantiation);
  assert.equal(replayed.kind, "instantiated");
  assert.equal(replayed.artifact.kind, "tir");
  assert.deepEqual(replayed.artifact.body, selected.tir);
  const executing = analysisInput(fixture, "sdk-minimal",
    'export function field(keys: { readonly key: "chosen" }): "chosen" { return keys?.key; }');
  assert.throws(() => analyzeHostProgram(executing), /selected optional or index-backed property transport is not implemented/);
});
test("declaration-only non-null syntax retains the authored wrapper without a runtime proof", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { parseTir, printTir } = await import("../../packages/host/dist/ir-tir/index.js");
  const source = "export interface Shape { [((choice!)!)]: boolean; }";
  const input = { ...analysisInput(fixture, "sdk-minimal", source), snapshot: fixture.projectSnapshot({
    sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent + '\ndeclare const choice: "chosen";' }],
  }) };
  const checked = captureSourceBarrier(input);
  assert.equal(checked.kind, "ok");
  const sourceModule = checked.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
  const syntax = sourceModule.tree.statements.nodes[0].members.nodes[0].name;
  assert.deepEqual(syntax.tsonic.key, { kind: "available", value: { kind: "text", value: "chosen" } });
  assert.deepEqual(sourceModule.checkerDiagnostics.map(diagnostic => diagnostic.code.rendered), ["TS1169"]);
  const typed = typeSourceBarrier(input, checked.value, createTypedAccount(input));
  assert.equal(typed.kind, "ok");
  const module = typed.value.modules.get(input.snapshot.entryPoint);
  for (const body of module.bodies) {
    const name = readyModuleStatements(body.root)[0].members.nodes[0].name;
    assert.deepEqual(name.tsonic.key, syntax.tsonic.key);
    let [original, written] = [syntax.expression, name.expression];
    let parent = name;
    const kinds = [];
    while (written !== undefined) {
      assert.equal(written.id, original.id);
      assert.equal(written.parent, parent.id);
      assert.deepEqual(written.origin, original.origin);
      assert.deepEqual(written.tsonic, { role: "declaration-name-expression" });
      kinds.push(written.kind);
      parent = written;
      [original, written] = [original.expression, written.expression];
    }
    assert.deepEqual(kinds, ["ParenthesizedExpression", "NonNullExpression", "ParenthesizedExpression", "NonNullExpression", "Identifier"]);
    const parsed = parseTir(printTir(body));
    assert.equal(parsed.kind, "parsed");
    assert.equal(printTir(parsed.value), printTir(body));
  }
});

test("a public interface method retains its own authored self return type", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `export interface Fluent { advance(): this; }
export function keep(value: boolean): boolean { return !value; }`);
  const program = analyzeHostProgram(input);
  assert.equal(program.kind, "ok");
  const { index, modules } = program.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const root = module.bodies.find(body => body.kind === "selected" && body.tir.root.kind === "SourceFile");
  const owner = readyModuleStatements(root.tir.root).find(node => node.kind === "InterfaceDeclaration");
  const [method] = owner.members.nodes;
  assert.equal(method.kind, "MethodSignature");
  assert.equal(method.type.kind, "ThisType");
  assert.deepEqual(index.types.terms[method.type.tsonic.type], { kind: "self", owner: owner.tsonic.definition });
  const signature = index.types.signatures.find(row => row.declaration === method.tsonic.definition);
  assert.equal(signature.result, method.type.tsonic.type);
});

test("real public Host analysis reads a declared structural field through its actual selected native place", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export type Box = { flag: boolean; }; export function read(box: Box): boolean { return box.flag; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const caller = module.bodies.find(body => body.kind === "selected" && body.tir.params.length === 1);
  assert.equal(caller !== undefined, true);
  const read = caller.tir.root.statements.nodes[0].expression;
  assert.equal(read.kind, "PropertyAccessExpression");
  const selection = read.tsonic.selection.decision.decision;
  assert.equal(selection.read, read.tsonic.convertedType);
  assert.equal(selection.write, null);
  assert.deepEqual(selection.location, { kind: "data", receiver: "by-reference", check: { kind: "none" } });
  assert.deepEqual(result.value.index.types.terms[read.tsonic.convertedType], { kind: "primitive", primitive: "bool" });
  const place = caller.mir.places.find(place => place.base.kind === "place"
    && place.base.projection.kind === "field" && place.base.tir.node === read.id
    && place.storage === read.tsonic.convertedType);
  assert.notEqual(place, undefined);
  const held = caller.mir.places[place.base.place];
  assert.equal(caller.mir.locals[held.base.local].role.kind, "temporary");
  assert.equal(caller.mir.blocks.flatMap(block => block.statements).filter(statement => statement.kind === "assign" && statement.place === held.id).length, 1);
  const summary = result.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === caller.instance.body);
  const [parameter] = summary.parameters;
  assert.equal(parameter.reads.kind, "complete");
  assert.deepEqual(parameter.writes, { kind: "complete", paths: [] });
  assert.equal(parameter.reads.paths.length, 1);
  const projection = summary.arena.projections[parameter.reads.paths[0]].projection;
  assert.equal(projection.kind, "field");
  assert.equal(projection.member.decision.primary, selection.primary);
  const fact = caller.facts[0].origins.reads.find(row => row.place === place.id);
  assert.deepEqual(caller.facts[0].arena.origins[fact.origins].producers, [], "a scalar field read is not the receiver reference");
});

test("a written ordinary field updates the referent and carries its exact parameter effect through a call", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export type Box = { flag: boolean };
    function write(other: Box, box: Box, value: boolean): boolean {
      const alias = box;
      alias.flag = value;
      return box.flag;
    }
    export function forward(other: Box, box: Box, value: boolean): boolean { return write(other, box, value); }
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const chapter = modules.find(row => row.module === input.snapshot.entryPoint);
  assert.equal(chapter.tree.kind, "ready-root");
  const callables = new Map(chapter.tree.root.statements.nodes.filter(slot => slot.kind === "ready-callable")
    .map(slot => [slot.node.name.text, slot.node.tsonic.definition]));
  for (const name of ["write", "forward"]) {
    const body = chapter.bodies.find(row => row.kind === "selected" && row.tir.owner === callables.get(name));
    assert.ok(body);
    const facts = body.facts.find(row => row.execution.provided === 3);
    assert.ok(facts);
    const summary = index.summaries.find(row => row.key.kind === "body"
      && fixture.types.executionKey(row.key.execution) === fixture.types.executionKey(facts.execution));
    assert.deepEqual(summary.parameters.map(parameter => parameter.writes.paths.length), [0, 1, 0]);
    const [path] = summary.parameters[1].writes.paths;
    assert.equal(summary.arena.projections[path].projection.kind, "field");
    assert.deepEqual(summary.arena.projections[path].projection.member.decision.key, { kind: "text", value: "flag" });
    if (name !== "write") continue;
    const assignment = body.tir.root.statements.nodes[1].expression;
    assert.equal(assignment.left.tsonic.access.kind, "write");
    const selection = assignment.left.tsonic.selection.decision.decision;
    assert.equal(selection.read, null);
    assert.equal(selection.write, assignment.left.tsonic.access.storage);
    const [event] = facts.origins.writes.filter(row => row.destination === "member");
    assert.equal(event.operation, "mutation");
    assert.equal(event.node, assignment.id);
    assert.deepEqual(event.values.map(value => value.source), [{ body: body.instance.body, node: assignment.right.id }]);
    assert.deepEqual(event.targets.map(target => {
      const producer = facts.arena.producers[facts.arena.boundProducers[target].producer];
      return [producer.kind, producer.index, producer.path];
    }), [["parameter", 1, null]]);
    const statement = body.mir.blocks[event.point.block].statements[event.point.statement];
    assert.equal(statement.kind, "assign");
    assert.equal(body.mir.places[statement.place].base.projection.kind, "field");
    assert.equal(facts.origins.reads.some(read => read.place === statement.place), false);
  }
});

test("a conditional field assignment retains the same qualified read and write path", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export type Box = { flag: boolean };
    export function update(box: Box, value: boolean): boolean { return box.flag ||= value; }
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const chapter = modules.find(row => row.module === input.snapshot.entryPoint);
  const body = chapter.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "Block");
  const expression = body.tir.root.statements.nodes[0].expression;
  assert.equal(expression.tsonic.selection.kind, "or");
  assert.equal(expression.left.tsonic.access.kind, "read-write");
  const selection = expression.left.tsonic.selection.decision.decision;
  assert.equal(selection.read, expression.left.tsonic.access.read);
  assert.equal(selection.write, expression.left.tsonic.access.storage);
  const facts = body.facts.find(row => row.execution.provided === 2);
  const summary = index.summaries.find(row => row.key.kind === "body"
    && fixture.types.executionKey(row.key.execution) === fixture.types.executionKey(facts.execution));
  const [field] = summary.parameters[0].writes.paths;
  assert.deepEqual(summary.parameters[0].reads.paths, [field]);
  assert.deepEqual(summary.parameters[0].writes.paths, [field]);
  assert.deepEqual(summary.parameters[1].writes.paths, []);
  const [event] = facts.origins.writes.filter(row => row.destination === "member");
  const statement = body.mir.blocks[event.point.block].statements[event.point.statement];
  assert.equal(facts.origins.reads.some(read => read.place === statement.place), true);
  assert.equal(body.mir.blocks.some(block => block.terminator.kind === "switch" && block.id !== event.point.block), true);
});

test("an immutable ordinary object alias reads the field of the original reference without becoming a formal", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const source = "export type Box = { flag: boolean };"
    + "export function read(other: Box, value: Box): boolean { const alias = value; return alias.flag; }";
  const input = analysisInput(fixture, "sdk-minimal", source);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const bodies = result.value.modules.find(module => module.module === input.snapshot.entryPoint).bodies;
  const caller = bodies.find(row => row.kind === "selected" && row.tir.root.kind === "Block");
  assert.ok(caller);
  const call = caller.mir.blocks.find(block => block.terminator.kind === "call").terminator;
  const initializer = bodies.find(row => row.kind === "selected" && row.instance.body === call.callee.instance.body);
  assert.equal(initializer?.tir.root.kind, "Identifier");
  assert.equal(initializer.tir.root.text, "value");
  const capturePlace = caller.mir.places[call.callee.captures[0].place];
  assert.deepEqual(caller.mir.locals[capturePlace.base.local].role, { kind: "parameter", index: 1 });
  const chosen = caller.tir.root.statements.nodes.at(-1).expression;
  assert.equal(chosen.expression.text, "alias");
  const summary = result.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === caller.instance.body);
  assert.equal(summary.parameters.length, 2);
  assert.deepEqual(summary.parameters[0].reads, { kind: "complete", paths: [] });
  const selected = summary.parameters[1];
  assert.deepEqual(selected.slot, { kind: "parameter", index: 1 });
  assert.deepEqual(selected.writes, { kind: "complete", paths: [] });
  assert.equal(selected.reads.paths.length, 1);
  const projection = summary.arena.projections[selected.reads.paths[0]].projection;
  assert.equal(projection.kind, "field");
  assert.equal(projection.member.decision.primary, chosen.tsonic.selection.decision.decision.primary);
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { checkedSourceObjectFieldsOf } = await import("../../packages/host/dist/ir-hir/index.js");
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const checked = captured.value.checked;
  const body = checked.bodies.get(caller.instance.body);
  const access = body.root.statements.nodes.at(-1).expression;
  const itemOf = definition => checked.nodeOf(checked.declarationSourceOf(definition));
  const scalar = () => assert.fail("a scalar field has no object domain to open");
  for (const [cap, reads, complete] of [[0, 0, false], [1, 1, false], [2, 2, false], [3, 3, false], [6, 3, true]]) {
    let remaining = cap;
    let read = 0;
    const proof = checkedSourceObjectFieldsOf(body, reference => {
      read += 1;
      return checked.nodeOf(reference);
    }, itemOf, scalar, work => {
      if (work > remaining) return false;
      remaining -= work;
      return true;
    }).field(access);
    assert.equal(read, reads);
    assert.equal(proof !== null, complete);
    if (proof !== null) {
      assert.deepEqual(proof.local, access.expression.tsonic.resolution.local);
      assert.equal(proof.field, access.tsonic.origins.value[0].declaration);
    }
  }
  const open = source.replace("const alias = value;", "let alias = value; alias = { flag: other.flag };");
  const openCapture = captureSourceBarrier(analysisInput(fixture, "sdk-minimal", open));
  assert.equal(openCapture.kind, "ok");
  const openChecked = openCapture.value.checked;
  const openBody = openChecked.bodies.get(caller.instance.body);
  assert.equal(checkedSourceObjectFieldsOf(openBody, openChecked.nodeOf,
    definition => openChecked.nodeOf(openChecked.declarationSourceOf(definition)), scalar, () => true).field(openBody.root.statements.nodes.at(-1).expression), null);
});

test("a copied reference captured by a detached initializer preserves its value without creating a caller cell", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const source = "export type Box = { flag: boolean }; "
    + "export function read(box: Box): boolean { const alias = box; const second = alias; return second.flag; }";
  const input = analysisInput(fixture, "sdk-minimal", source);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const bodies = result.value.modules.find(module => module.module === input.snapshot.entryPoint).bodies;
  const caller = bodies.find(row => row.kind === "selected" && row.tir.root.kind === "Block");
  const operation = caller.mir.blocks.map(block => block.terminator)
    .find(row => row.kind === "call" && row.callee.kind === "body" && row.callee.captures[0]?.capture === "captured-value");
  const callee = bodies.find(row => row.kind === "selected" && row.instance.body === operation.callee.instance.body);
  assert.equal(callee.tir.root.text, "alias");
  const captured = callee.mir.locals.find(row => row.role.kind === "capture");
  assert.equal(captured.mode, "captured-value");
  const [facts] = caller.facts;
  const [nested] = callee.facts;
  assert.deepEqual(nested.arena.cells, []);
  const subject = nested.arena.contexts[0].captures[0];
  assert.deepEqual(Object.keys(subject).sort(), ["index", "origins"]);
  const [context] = facts.arena.contexts.filter(value => "origins" in (value.captures[0] ?? {}));
  assert.deepEqual(context.captures, [{ index: 0, origins: facts.arena.contexts[0].arguments[0].origins }]);
  const summary = result.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === caller.instance.body);
  assert.equal(summary.parameters[0].reads.paths.length, 1);
  assert.deepEqual(summary.parameters[0].writes, { kind: "complete", paths: [] });
});

for (const annotation of [": Box", ""]) test(`a mutable reference slot${annotation === "" ? " inferred from its closed inputs" : ""} charges a field write to its saved receiver despite rebinding on the right`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const source = "export type Box = { flag: boolean }; "
    + "export function swap(before: Box, after: Box, value: boolean): boolean { "
    + `let alias${annotation} = before; alias = after; alias.flag = (alias = before, value); return alias.flag; }`;
  const input = analysisInput(fixture, "sdk-minimal", source);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const body = modules.find(module => module.module === input.snapshot.entryPoint).bodies.find(row =>
    row.kind === "selected" && row.tir.params.length === 3);
  const facts = body.facts.find(row => row.execution.provided === 3);
  const summary = index.summaries.find(row => row.key.kind === "body"
    && fixture.types.executionKey(row.key.execution) === fixture.types.executionKey(facts.execution));
  assert.equal(summary.parameters.length, 3);
  const [field] = summary.parameters[1].writes.paths;
  const selected = summary.arena.projections[field].projection.member.decision;
  assert.equal(selected.key.value, "flag");
  assert.equal(summary.arena.projections.length, 1);
  assert.notEqual(selected.read, null);
  assert.notEqual(selected.write, null);
  assert.deepEqual(summary.parameters.map(parameter => parameter.reads), [
    { kind: "complete", paths: [field] }, { kind: "complete", paths: [] }, { kind: "complete", paths: [] },
  ]);
  assert.deepEqual(summary.parameters.map(parameter => parameter.writes), [
    { kind: "complete", paths: [] }, { kind: "complete", paths: [field] }, { kind: "complete", paths: [] },
  ]);
  const [event] = facts.origins.writes.filter(row => row.destination === "member");
  assert.equal(event.targets.length, 1);
  const producer = facts.arena.producers[facts.arena.boundProducers[event.targets[0]].producer];
  assert.deepEqual([producer.kind, producer.index, producer.path], ["parameter", 1, null]);
  const assignment = body.mir.blocks[event.point.block].statements[event.point.statement];
  const place = body.mir.places[assignment.place].base;
  assert.equal(place.kind, "place");
  const holder = body.mir.places[place.place].base;
  assert.equal(holder.kind, "local");
  assert.equal(body.mir.locals[holder.local].role.kind, "temporary", "the projection cannot borrow the mutable alias cell");
});

test("one actual invocation retains both capture modes without assigning a cell to the copied slot", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const source = "export function run(left: boolean): boolean { let current: boolean = left; "
    + "const saved = left; const output = saved === current; return output; }";
  const result = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", source));
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const selected = result.value.modules.flatMap(module => module.bodies).filter(row => row.kind === "selected");
  const nested = selected.find(row => row.tir.root.kind === "BinaryExpression");
  assert.deepEqual(nested.tir.captures.map(row => row.capture), ["captured-value", "captured-location"]);
  assert.deepEqual(nested.mir.locals.filter(row => row.role.kind === "capture").map(row => row.mode),
    ["captured-value", "captured-location"]);
  const arena = nested.facts[0].arena;
  assert.deepEqual(arena.cells.map(cell => [cell.id, cell.role]), [[0, { kind: "capture", index: 1 }]]);
  const [copied, borrowed] = arena.contexts[0].captures;
  assert.equal(copied.index, 0);
  assert.ok("origins" in copied && !("cell" in copied));
  assert.deepEqual({ index: borrowed.index, cell: borrowed.cell }, { index: 1, cell: 0 });
  const caller = selected.find(row => row.tir.root.kind === "Block");
  const call = caller.mir.blocks.map(block => block.terminator).find(row => row.kind === "call"
    && row.callee.kind === "body" && row.callee.instance.body === nested.instance.body);
  assert.deepEqual(call.callee.captures.map(row => row.capture), ["captured-value", "captured-location"]);
  const context = caller.facts[0].arena.contexts.find(value => value.captures.length === 2);
  assert.ok("origins" in context.captures[0] && !("cell" in context.captures[0]));
  const cell = caller.facts[0].arena.cells[context.captures[1].cell];
  const place = caller.mir.places[call.callee.captures[1].place];
  assert.equal(place.base.kind, "local");
  assert.deepEqual(cell.role, { kind: "local", local: place.base.local });
});

test("applied field reads follow the actual forwarded object rather than the callee formal index", async () => {
  const { accountFailure, createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const input = analysisInput(await loadFrontFixture(), "sdk-minimal", `export type Box = { flag: boolean };
    function peek(box: Box): boolean { return box.flag; }
    function forward(unused: Box, selected: Box): boolean { return peek(selected); }
    export function top(selected: Box, unused: Box): boolean { selected.flag; return forward(unused, selected); }`);
  const original = pipelineWiring.bodyAnalysis.analyzeBodyRound;
  let witness = null;
  let result;
  try {
    pipelineWiring.bodyAnalysis.analyzeBodyRound = (deps, round) => {
      if (round.tir.params.length === 2 && round.tir.root.statements.nodes.length === 1) {
        const local = round.mir.locals.find(row => row.role.kind === "parameter" && row.role.index === 1);
        witness = { ...local, sourceObjectHolding: deps.sourceObjectHolding, scalar: deps.signatureOf(round.tir.signature).result };
      }
      return original(deps, round);
    };
    result = analyzeHostProgram(input);
  } finally {
    pipelineWiring.bodyAnalysis.analyzeBodyRound = original;
  }
  assert.equal(result.kind, "ok");
  const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const bodies = chapter.bodies.filter(row => row.kind === "selected" && row.tir.params.length !== 0);
  const summaries = result.value.index.summaries.filter(row => row.key.kind === "body");
  const peek = bodies.find(row => row.tir.params.length === 1);
  const forward = bodies.find(row => row.tir.params.length === 2 && row.tir.root.statements.nodes.length === 1);
  const top = bodies.find(row => row.tir.params.length === 2 && row.tir.root.statements.nodes.length === 2);
  assert.equal(bodies.length, 3);
  const leaf = peek.tir.root.statements.nodes[0].expression.tsonic.selection.decision.decision.primary;
  for (const [body, selected] of [[peek, 0], [forward, 1], [top, 0]]) {
    const summary = summaries.find(row => row.key.execution.instance.body === body.instance.body);
    assert.equal(summary.arena.projections.length, 1);
    const projection = summary.arena.projections[0];
    assert.equal(projection.parent, null);
    assert.equal(projection.projection.kind, "field");
    assert.equal(projection.projection.member.decision.primary, leaf);
    assert.deepEqual(summary.parameters.map(row => [row.slot.index, row.reads.paths, row.writes.paths]),
      body.tir.params.map((_, index) => [index, index === selected ? [projection.id] : [], []]));
    assert.deepEqual(summary.arena.origins[summary.result].producers, []);
  }
  for (const [caller, callee, slot, actual] of [[forward, peek, 0, 1], [top, forward, 1, 0]]) {
    const [facts] = caller.facts;
    const activation = facts.origins.activations.find(row => row.activation.body === callee.instance.body && row.entry === null);
    assert.equal(activation !== undefined, true);
    const argument = facts.arena.contexts[activation.context].arguments[slot];
    assert.equal(argument.kind, "provided");
    const [bound] = facts.arena.origins[argument.origins].producers;
    assert.equal(facts.arena.producers[facts.arena.boundProducers[bound].producer].index, actual);
  }
  assert.equal(witness !== null, true);
  const { sourceObjectHolding, source, storage, scalar } = witness;
  const limits = input.limits.dataflow;
  const account = createAccount(limits);
  assert.deepEqual(sourceObjectHolding(account, source, storage), { kind: "complete", value: true });
  const { work } = InvocationAccount.stateOf(account);
  assert.deepEqual(sourceObjectHolding(createAccount({ ...limits, maximumWork: work }), source, storage), { kind: "complete", value: true });
  assert.deepEqual(sourceObjectHolding(createAccount(limits), source, scalar), { kind: "complete", value: false });
  for (let maximumWork = 0; maximumWork < work; maximumWork += 1) {
    const cut = createAccount({ ...limits, maximumWork });
    const refusal = sourceObjectHolding(cut, source, storage);
    assert.equal(refusal === accountFailure(cut), true);
    assert.equal(sourceObjectHolding(cut, source, storage) === refusal, true);
  }
});

test("a verified object parameter field cannot be changed to in-place storage", async () => {
  const { accountFailure, createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { tirReadyReadAdmission } = await import("../../packages/host/dist/ir-program/index.js");
  const { verifyTir } = await import("../../packages/host/dist/ir-tir/index.js");
  const input = analysisInput(await loadFrontFixture(), "sdk-minimal",
    "export type Box = { flag: boolean; }; export type Decoy = { flag: boolean; }; export function read(box: Box): boolean { return box.flag; }");
  const source = captureSourceBarrier(input);
  assert.equal(source.kind, "ok");
  const typed = typeSourceBarrier(input, source.value, createAccount(input.limits.dataflow));
  assert.equal(typed.kind, "ok");
  const proof = typed.value.verifierOf(input.snapshot.entryPoint);
  const body = proof.module.bodies.find(row => row.root.kind === "Block" && row.bindings.kind === "instantiated");
  const member = body.root.statements.nodes[0].expression.tsonic.selection.decision.decision;
  const verify = () => verifyTir(proof, tirReadyReadAdmission(createAccount(input.limits.dataflow)))(body);
  assert.deepEqual(verify(), { kind: "complete", violations: [] });
  const original = member.location;
  member.location = { ...original, receiver: "in-place" };
  const changed = verify();
  member.location = original;
  assert.equal(changed.kind, "complete");
  assert.deepEqual(changed.violations.map(row => row.rule), ["access-location"]);
  const verifyWith = maximumWork => {
    const account = createAccount({ ...input.limits.dataflow, maximumWork });
    const visited = [];
    const admitted = [];
    const source = { ...proof, declarationSourceOf: definition => {
      visited.push(definition);
      return proof.declarationSourceOf(definition);
    } };
    const pay = tirReadyReadAdmission(account);
    const result = verifyTir(source, request => {
      if (request.kind === "source-declaration") admitted.push({ definition: request.definition, work: InvocationAccount.stateOf(account).work });
      return pay(request);
    })(body);
    return { result, visited, admitted, failure: accountFailure(account) };
  };
  const full = verifyWith(input.limits.dataflow.maximumWork);
  assert.deepEqual(full.result, { kind: "complete", violations: [] });
  assert.deepEqual(full.admitted.slice(1).map(value => value.definition), full.visited);
  assert.equal(full.visited.length, 2);
  const decoy = proof.source.tree.statements.nodes.find(node => node.kind === "TypeAliasDeclaration" && node.name.text === "Decoy");
  const crossed = { ...proof, declarationSourceOf: definition => definition === full.visited[0]
    ? proof.declarationSourceOf(decoy.tsonic.definition) : proof.declarationSourceOf(definition) };
  const rejected = verifyTir(crossed, tirReadyReadAdmission(createAccount(input.limits.dataflow)))(body);
  assert.equal(rejected.kind, "complete");
  assert.deepEqual(rejected.violations.map(row => row.rule), ["access-location"]);
  for (const [index, step] of full.admitted.entries()) {
    const cut = verifyWith(step.work);
    assert.equal(cut.result.kind === "resource-stop" && cut.result.stop === cut.failure, true);
    assert.deepEqual(cut.visited, full.visited.slice(0, Math.max(0, index - 1)));
  }
});

for (const [form, value, unaryCount] of [["single", "!flag", 1], ["nested", "!(!flag)", 2]])
test(`real public Host analysis retains ${form} boolean negation as its selected native unary operations`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `export function negate(flag: boolean): boolean { return ${value}; }\n`);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const callable = module.bodies.find(body => body.kind === "selected" && body.tir.params.length === 1);
  assert.notEqual(callable, undefined);
  const expression = callable.tir.root.statements.nodes[0].expression;
  assert.equal(expression.kind, "PrefixUnaryExpression");
  assert.equal(expression.operator, "ExclamationToken");
  assert.equal(callable.mir.blocks.flatMap(block => block.statements).filter(statement => statement.kind === "assign"
    && statement.value.kind === "unary" && statement.value.operation.decision.operation.kind === "native-operator"
    && statement.value.operation.decision.operation.operator === "!"
    && statement.value.operation.decision.operation.carrier === "bool").length, unaryCount);
  assert.deepEqual(callable.facts.map(facts => facts.execution.provided), [1]);
});

test("real public Host analysis selects the native Boolean carrier for actual literal negation", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  for (const literal of [true, false]) {
    const input = analysisInput(fixture, "sdk-minimal", `export function negate(): boolean { return !${literal}; }`);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok");
    assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
    const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
    const selected = main.bodies.find(body => body.kind === "selected" && body.tir.root.kind === "Block");
    const expression = selected.tir.root.statements.nodes[0].expression;
    assert.equal(expression.kind, "PrefixUnaryExpression");
    const unary = selected.mir.blocks.flatMap(block => block.statements).find(statement => statement.kind === "assign"
      && statement.value.kind === "unary");
    const { decision } = unary.value.operation;
    assert.deepEqual(decision.operation, { kind: "native-operator", operator: "!", carrier: "bool" });
    assert.deepEqual(decision.operands, [expression.operand.tsonic.type]);
    const terms = result.value.index.types.terms;
    assert.deepEqual(terms[decision.operands[0]], { kind: "literal", value: { kind: "boolean", value: literal }, base: decision.result });
    assert.deepEqual(terms[decision.result], { kind: "primitive", primitive: "bool" });
  }
});

test("real public Host analysis publishes a recursive declared alias without unfolding its member graph", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export type Link = { next: Link }; export function identity(value: boolean): boolean { return value; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const root = module.bodies.find(body => body.kind === "selected" && body.tir.root.kind === "SourceFile");
  const alias = readyModuleStatements(root.tir.root).find(node => node.kind === "TypeAliasDeclaration");
  assert.equal(alias !== undefined, true);
  const shape = result.value.index.types.terms[alias.tsonic.type];
  assert.equal(shape.kind, "shape");
  assert.equal(shape.members.length, 1);
  assert.deepEqual(shape.members[0].key, { kind: "text", value: "next" });
  assert.equal(shape.members[0].read, alias.tsonic.type);
});

test("real public Host analysis preserves exact native string equality and inequality decisions and their Boolean counterparts", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  for (const domain of ["string", "boolean"])
  for (const [token, operator] of [["EqualsEqualsToken", "=="], ["EqualsEqualsEqualsToken", "==="],
    ["ExclamationEqualsToken", "!="], ["ExclamationEqualsEqualsToken", "!=="]]) {
    const input = analysisInput(fixture, "sdk-minimal",
      `export function compare(left: ${domain}, right: ${domain}): boolean { return left ${operator} right; }`);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok");
    const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
    const selected = main.bodies.find(body => body.kind === "selected" && body.tir.params.length === 2);
    const expression = selected.tir.root.statements.nodes[0].expression;
    assert.equal(expression.kind, "BinaryExpression");
    assert.equal(expression.operatorToken.kind, token);
    assert.equal(expression.tsonic.role, "comparison");
    const operation = selected.mir.blocks.flatMap(block => block.statements).find(statement => statement.kind === "assign"
      && statement.value.kind === "binary").value.operation.decision;
    assert.deepEqual(operation.operation, { kind: domain === "string" ? "string-operator" : "boolean-operator", operator });
    assert.deepEqual(operation.execution, { kind: "pure" });
    const table = result.value.index.types;
    const terms = table.terms;
    const operand = domain === "string" ? { kind: "string" } : { kind: "primitive", primitive: "bool" };
    assert.deepEqual(operation.operands.map(type => terms[type]), [operand, operand]);
    assert.deepEqual(terms[operation.result], { kind: "primitive", primitive: "bool" });
    for (const equal of [true, false]) {
      const values = domain === "string" ? ["e\u0301", equal ? "e\u0301" : "é"] : [false, !equal];
      const arguments_ = values.map((value, index) => ({ kind: domain, type: operation.operands[index], value }));
      const evaluated = evaluate({ types: table, typeOf: type => table.terms[type], signatureOf: signature => table.signatures[signature],
        selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation }, selected.instance, selected.mir, arguments_,
      "compile-time", { query: "constValue", key: [selected.instance, "compile-time"] });
      assert.equal(evaluated.kind, "done");
      assert.equal(evaluated.value.kind, "ok");
      assert.deepEqual(evaluated.value.value, { kind: "value",
        value: { kind: "boolean", type: operation.result, value: operator.startsWith("!") ? !equal : equal } });
    }
  }
});

test("real public Host analysis returns a string parameter with its actual entry origins", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export function echo(value: string): string { return value; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const callable = module.bodies.find(body => body.kind === "selected" && body.tir.params.length === 1);
  assert.equal(callable !== undefined, true);
  assert.deepEqual(callable.facts.map(facts => facts.execution.provided), [1]);
  assert.equal(result.value.index.types.terms[callable.tir.params[0].type.tsonic.type].kind, "string");
  const facts = callable.facts[0];
  const returns = facts.origins.subjects.filter(subject => subject.role === "return");
  assert.equal(returns.length, 1);
  const returned = facts.arena.origins.find(origins => origins.id === returns[0].origins);
  assert.equal(returned.kind, "complete");
  assert.equal(returned.includesAbsence, false);
  assert.equal(returned.producers.length, 1);
  const bound = facts.arena.boundProducers.find(row => row.id === returned.producers[0]);
  const producer = facts.arena.producers.find(row => row.id === bound.producer);
  assert.equal(producer.kind, "parameter");
  assert.equal(producer.index, 0);
  assert.deepEqual(bound.bindings, callable.mir.bindings.bindings);
  assert.deepEqual(facts.arena.contexts.find(row => row.id === bound.context).arguments[0], { kind: "provided", origins: returned.id });
  const escapes = facts.origins.escapes.filter(escape => escape.target.kind === "return");
  assert.equal(escapes.length, 1);
  assert.equal(escapes[0].producer, producer.id);
  const summary = result.value.index.summaries.find(summary => summary.key.kind === "body"
    && fixture.types.executionKey(summary.key.execution) === fixture.types.executionKey(facts.execution));
  assert.equal(summary !== undefined, true);
  const resultOrigins = summary.arena.origins.find(origins => origins.id === summary.result);
  assert.equal(resultOrigins.producers.length, 1);
  assert.equal(summary.retention.length, 1);
  assert.equal(summary.retention[0].source, resultOrigins.producers[0]);
  assert.deepEqual(summary.retention[0].into, { kind: "return" });
  assert.equal(summary.retention[0].at.kind, "body");
  assert.deepEqual(summary.retention[0].at.execution, facts.execution);
  assert.deepEqual(summary.retention[0].at.point, escapes[0].point);
  assert.equal(summary.retention[0].at.edge, null);
});

test("real public Host analysis retains an authored thrown string and its actual unwind outcome", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export function escape(value:string):never{throw value;}");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const callable = main.bodies.find(body => body.kind === "selected" && body.tir.params.length === 1);
  assert.equal(callable !== undefined, true);
  const thrown = callable.mir.blocks.find(block => block.terminator.kind === "throw");
  assert.equal(thrown !== undefined, true);
  assert.deepEqual(thrown.terminator.unwind, { kind: "escape" });
  const facts = callable.facts[0];
  const summary = result.value.index.summaries.find(row => row.key.kind === "body"
    && fixture.types.executionKey(row.key.execution) === fixture.types.executionKey(facts.execution));
  assert.equal(summary !== undefined, true);
  assert.equal(summary.returns, false);
  assert.equal(summary.unwinds, true);
  assert.deepEqual(summary.initialization.points, [{ kind: "unwind" }]);
  const origins = summary.arena.origins[summary.thrown];
  assert.equal(origins.kind, "complete");
  assert.equal(origins.includesAbsence, false);
  assert.equal(origins.producers.length, 1);
  const bound = summary.arena.boundProducers[origins.producers[0]];
  assert.deepEqual(summary.arena.producers[bound.producer], { id: bound.producer, path: null, kind: "parameter", index: 0 });
  assert.deepEqual(bound.bindings, callable.mir.bindings.bindings);
  assert.deepEqual(facts.origins.escapes.map(row => [row.point, row.target]),
    [[{ block: thrown.id, statement: null }, { kind: "throw" }]]);
  assert.equal(summary.retention.length, 1);
  assert.equal(summary.retention[0].source, origins.producers[0]);
  assert.deepEqual(summary.retention[0].into, { kind: "throw" });
  assert.deepEqual(summary.retention[0].at.point, { block: thrown.id, statement: null });
});

test("real public Host analysis separates actual returned and thrown string formals at their finite exits", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function choose(flag:boolean,left:string,right:string):string{if(flag){return left;}throw right;}");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const callable = main.bodies.find(body => body.kind === "selected" && body.tir.params.length === 3);
  assert.equal(callable !== undefined, true);
  const facts = callable.facts[0];
  const summary = result.value.index.summaries.find(row => row.key.kind === "body"
    && fixture.types.executionKey(row.key.execution) === fixture.types.executionKey(facts.execution));
  assert.equal(summary !== undefined, true);
  assert.equal(summary.returns, true);
  assert.equal(summary.unwinds, true);
  assert.deepEqual(summary.initialization.points, [{ kind: "return" }, { kind: "unwind" }]);
  for (const [kind, origins, index] of [["return", summary.result, 1], ["throw", summary.thrown, 2]]) {
    const value = summary.arena.origins[origins];
    assert.equal(value.kind, "complete");
    assert.equal(value.includesAbsence, false);
    assert.equal(value.producers.length, 1);
    const bound = summary.arena.boundProducers[value.producers[0]];
    assert.deepEqual(summary.arena.producers[bound.producer], { id: bound.producer, path: null, kind: "parameter", index });
    assert.deepEqual(bound.bindings, callable.mir.bindings.bindings);
    const exit = callable.mir.blocks.find(block => block.terminator.kind === kind);
    assert.equal(exit !== undefined, true);
    const retained = summary.retention.filter(row => row.into.kind === kind);
    assert.equal(retained.length, 1);
    assert.equal(retained[0].source, bound.id);
    assert.deepEqual(retained[0].at.point, { block: exit.id, statement: null });
    assert.equal(facts.origins.escapes.some(row => row.point.block === exit.id && row.target.kind === kind), true);
  }
  assert.notEqual(summary.arena.origins[summary.result].producers[0], summary.arena.origins[summary.thrown].producers[0]);
});

test("real public Host analysis retains an authored callee throw at its actual caller argument and unwind point", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function fail(value:string):string{throw value;}export function call(value:string):string{return fail(value);}");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const caller = main.bodies.find(body => body.kind === "selected" && body.mir.blocks.some(block => block.terminator.kind === "call"));
  assert.equal(caller !== undefined, true);
  const call = caller.mir.blocks.find(block => block.terminator.kind === "call");
  assert.equal(call.terminator.callee.kind, "direct");
  assert.deepEqual(call.terminator.unwind, { kind: "escape" });
  const facts = caller.facts[0];
  const invocation = facts.origins.invocations[0].alternatives[0];
  const argument = facts.arena.contexts[0].arguments[0].origins;
  assert.equal(invocation.thrown, argument);
  const summary = result.value.index.summaries.find(row => row.key.kind === "body"
    && fixture.types.executionKey(row.key.execution) === fixture.types.executionKey(facts.execution));
  assert.equal(summary !== undefined, true);
  assert.equal(summary.returns, false);
  assert.equal(summary.unwinds, true);
  assert.deepEqual(summary.initialization.points, [{ kind: "unwind" }]);
  const thrown = summary.arena.origins[summary.thrown];
  assert.equal(thrown.kind, "complete");
  assert.equal(thrown.includesAbsence, false);
  assert.equal(thrown.producers.length, 1);
  const bound = summary.arena.boundProducers[thrown.producers[0]];
  assert.deepEqual(summary.arena.producers[bound.producer], { id: bound.producer, kind: "parameter", index: 0, path: null });
  assert.deepEqual(bound.bindings, caller.mir.bindings.bindings);
  assert.deepEqual(summary.retention.map(row => ({ source: row.source, at: row.at, into: row.into })), [{
    source: bound.id, at: { kind: "body", execution: facts.execution,
      point: { block: call.id, statement: null }, edge: null }, into: { kind: "throw" },
  }]);
  assert.equal(facts.origins.escapes.some(row => row.point.block === call.id && row.point.statement === null
    && row.target.kind === "throw"), true);
});

test("real public Host analysis transports a string argument and return through the selected direct call", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function pass(value: string): string { return value; } export function call(value: string): string { return pass(value); }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const selected = main.bodies.filter(body => body.kind === "selected");
  const caller = selected.find(body => body.mir.blocks.some(block => block.terminator.kind === "call"));
  assert.equal(caller !== undefined, true);
  const call = caller.mir.blocks.find(block => block.terminator.kind === "call").terminator;
  assert.equal(call.callee.kind, "direct");
  const callee = selected.find(body => fixture.types.sameInstance(body.instance, call.callee.resolution.activation));
  assert.equal(callee !== undefined, true);
  assert.deepEqual(call.arguments.map(argument => [argument.kind, argument.passing]), [["value", "by-value"]]);
  assert.deepEqual(caller.facts.map(facts => facts.execution.provided), [1]);
  const facts = caller.facts[0];
  const returned = facts.origins.subjects.find(subject => subject.role === "return");
  assert.equal(returned !== undefined, true);
  const origins = facts.arena.origins.find(row => row.id === returned.origins);
  assert.equal(origins.kind, "complete");
  assert.equal(origins.includesAbsence, false);
  assert.equal(origins.producers.length, 1);
  const bound = facts.arena.boundProducers.find(row => row.id === origins.producers[0]);
  const producer = facts.arena.producers.find(row => row.id === bound.producer);
  assert.equal(producer.kind, "parameter");
  assert.equal(producer.index, 0);
  assert.deepEqual(bound.bindings, caller.mir.bindings.bindings);
  const summary = result.value.index.summaries.find(row => row.key.kind === "body"
    && fixture.types.executionKey(row.key.execution) === fixture.types.executionKey(facts.execution));
  assert.equal(summary !== undefined, true);
  assert.equal(summary.arena.origins.find(row => row.id === summary.result).producers.length, 1);
  assert.equal(summary.retention.some(row => row.into.kind === "return"), true);
});

test("real public Host analysis returns the second actual string-call argument rather than a destination entry", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function second(left: string, right: string): string { return right; } export function call(left: string, right: string): string { return second(left, right); }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const caller = main.bodies.find(body => body.kind === "selected" && body.mir.blocks.some(block => block.terminator.kind === "call"));
  assert.equal(caller !== undefined, true);
  const facts = caller.facts[0];
  const invocation = facts.origins.invocations[0].alternatives[0];
  assert.deepEqual(invocation.arguments.map(argument => facts.arena.origins[argument.actual].producers), [[0], [1]]);
  const returned = facts.origins.subjects.find(subject => subject.role === "return");
  const origins = facts.arena.origins[returned.origins];
  assert.deepEqual(origins.producers, [1]);
  assert.deepEqual(facts.arena.origins[invocation.result].producers, [1]);
  const bound = facts.arena.boundProducers[origins.producers[0]];
  assert.equal(facts.arena.producers[bound.producer].kind, "parameter");
  assert.equal(facts.arena.producers[bound.producer].index, 1);
  const summary = result.value.index.summaries.find(row => row.key.kind === "body"
    && fixture.types.executionKey(row.key.execution) === fixture.types.executionKey(facts.execution));
  assert.deepEqual(summary.arena.origins[summary.result].producers, [1]);
  assert.deepEqual(summary.retention.map(row => row.source), [1]);
  assert.equal(summary.retention.every(row => row.into.kind === "return"), true);
});

test("real public Host analysis uses a selected native boolean negation as its branch condition", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function choose(flag: boolean, a: number, b: number): number { if (!flag) return a; else return b; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const callable = module.bodies.find(body => body.kind === "selected" && body.tir.params.length === 3);
  assert.notEqual(callable, undefined);
  assert.equal(callable.tir.root.statements.nodes[0].expression.kind, "PrefixUnaryExpression");
  assert.equal(callable.mir.blocks.filter(block => block.terminator.kind === "switch").length, 1);
  assert.equal(callable.mir.blocks.filter(block => block.terminator.kind === "return").length, 2);
  assert.equal(callable.mir.blocks.flatMap(block => block.statements).filter(statement => statement.kind === "assign"
    && statement.value.kind === "unary" && statement.value.operation.decision.operation.kind === "native-operator"
    && statement.value.operation.decision.operation.operator === "!"
    && statement.value.operation.decision.operation.carrier === "bool").length, 1);
  assert.deepEqual(callable.facts.map(facts => facts.execution.provided), [3]);
});

test("real public AnalyzeHostProgram closes supplied and omitted boolean-default entries with their genuine initializer execution", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export function value(argument: boolean = true): boolean { return argument; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const selected = module.bodies.filter(body => body.kind === "selected");
  const callable = selected.find(body => body.tir.params.length === 1);
  assert.notEqual(callable, undefined);
  assert.deepEqual(callable.mir.entries.map(entry => entry.provided), [1, 0]);
  assert.equal(callable.facts.length, 2);
  assert.deepEqual(callable.facts.map(facts => facts.execution.provided), [0, 1]);
  const header = callable.tir.params[0];
  const initializer = selected.find(body => body.instance.body === header.tsonic.initializer);
  assert.notEqual(initializer, undefined);
  assert.equal(initializer.tir.root === readyDefaultRoot(header), true);
  assert.deepEqual(initializer.mir.entries.map(entry => entry.provided), [0]);
  const calls = callable.mir.blocks.filter(block => block.terminator.kind === "call" && block.terminator.callee.kind === "body");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].terminator.callee.instance.body, initializer.instance.body);
  assert.equal(calls[0].terminator.tir.node, header.id);
  assert.equal(result.value.index.dependencyInventory.dependencies.some(edge => edge.dependent.instance.body === callable.instance.body
    && edge.dependent.provided === 0 && edge.target.kind === "body" && edge.target.execution.instance.body === initializer.instance.body), true);
  assert.equal(result.value.index.dependencyInventory.dependencies.some(edge => edge.dependent.instance.body === callable.instance.body
    && edge.dependent.provided === 1 && edge.target.kind === "body" && edge.target.execution.instance.body === initializer.instance.body), false);
});

test("real public Host analysis retains the qualified outer parameter of a capture-bearing default initializer", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export function select(a: boolean, b = a): boolean { return b; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const selected = module.bodies.filter(body => body.kind === "selected");
  const callable = selected.find(body => body.tir.params.length === 2);
  assert.notEqual(callable, undefined);
  const header = callable.tir.params[1];
  const initializer = selected.find(body => body.instance.body === header.tsonic.initializer);
  assert.notEqual(initializer, undefined);
  assert.equal(initializer.tir.root === readyDefaultRoot(header), true);
  assert.deepEqual(initializer.tir.captures, [{ local: callable.tir.params[0].tsonic.local, capture: "captured-location" }]);
  assert.deepEqual(callable.facts.map(facts => facts.execution.provided), [1, 2]);
  const calls = callable.mir.blocks.filter(block => block.terminator.kind === "call" && block.terminator.callee.kind === "body");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].terminator.callee.instance.body, initializer.instance.body);
  assert.equal(calls[0].terminator.tir.node, header.id);
  assert.equal(calls[0].terminator.callee.captures.length, 1);
  assert.equal(calls[0].terminator.callee.captures[0].capture, "captured-location");
  const mirCapture = initializer.mir.locals.find(local => local.role.kind === "capture");
  assert.equal(mirCapture !== undefined, true);
  assert.deepEqual(mirCapture.source, callable.tir.params[0].tsonic.local);
  assert.equal(mirCapture.mode, "captured-location");
  assert.equal(initializer.facts[0].initialization.reads.some(row => row.node === initializer.tir.root.id && !row.assigned), true);
  const childSummary = result.value.index.summaries.find(summary => summary.key.kind === "body"
    && summary.key.execution.instance.body === initializer.instance.body);
  assert.equal(childSummary !== undefined, true);
  const need = childSummary.initialization.points.find(point => point.kind === "need");
  assert.equal(need !== undefined, true);
  assert.deepEqual(need.witness.read, { kind: "body", value: { body: initializer.instance.body, node: initializer.tir.root.id } });
  const callerSummaries = result.value.index.summaries.filter(summary => summary.key.kind === "body"
    && summary.key.execution.instance.body === callable.instance.body);
  assert.deepEqual(callerSummaries.map(summary => summary.key.execution.provided), [1, 2]);
  assert.equal(callerSummaries.every(summary => summary.initialization.points.every(point => point.kind !== "need")), true,
    "the actual provided a discharges the child's original read only at the omitted b entry");
  assert.equal(callerSummaries.every(summary => summary.arena.producers.every(row => row.kind !== "local")), true);
});

test("real public Host analysis transports a captured string default through its actual value and location relations", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export function select(a: string, b = a): string { return b; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const caller = main.bodies.find(body => body.kind === "selected" && body.tir.params.length === 2);
  assert.notEqual(caller, undefined);
  const header = caller.tir.params[1];
  const child = main.bodies.find(body => body.kind === "selected" && body.instance.body === header.tsonic.initializer);
  assert.notEqual(child, undefined);
  assert.equal(child.tir.root, readyDefaultRoot(header));
  assert.deepEqual(child.tir.captures, [{ local: caller.tir.params[0].tsonic.local, capture: "captured-location" }]);
  const summaryOf = (body, provided) => result.value.index.summaries.find(summary => summary.key.kind === "body"
    && summary.key.execution.instance.body === body && summary.key.execution.provided === provided);
  const producersOf = summary => summary.arena.origins[summary.result].producers.map(bound =>
    summary.arena.producers[summary.arena.boundProducers[bound].producer]);
  const childSummary = summaryOf(child.instance.body, 0);
  assert.notEqual(childSummary, undefined);
  assert.deepEqual(producersOf(childSummary).map(producer => [producer.kind, producer.index]), [["capture", 0]]);
  assert.equal(child.facts[0].initialization.reads.some(row => row.node === child.tir.root.id && !row.assigned), true);
  assert.equal(childSummary.initialization.points.some(point => point.kind === "need"), true);
  assert.deepEqual(caller.facts.map(facts => facts.execution.provided), [1, 2]);
  for (const provided of [1, 2]) {
    const summary = summaryOf(caller.instance.body, provided);
    assert.notEqual(summary, undefined);
    assert.deepEqual(producersOf(summary).map(producer => [producer.kind, producer.index]), [["parameter", provided - 1]]);
    assert.equal(summary.initialization.points.every(point => point.kind !== "need"), true);
    assert.equal(summary.retention.some(row => row.into.kind === "return"), true);
  }
});

test("real public Host analysis discharges chained captured defaults against their actual preceding initializer results", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function chain(a: boolean, b = a, c = b): boolean { return c; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const caller = module.bodies.find(body => body.kind === "selected" && body.tir.params.length === 3);
  assert.equal(caller !== undefined, true);
  assert.deepEqual(caller.mir.entries.map(entry => entry.provided), [3, 2, 1]);
  assert.deepEqual(caller.facts.map(facts => facts.execution.provided), [1, 2, 3]);
  for (const index of [1, 2]) {
    const header = caller.tir.params[index];
    const child = module.bodies.find(body => body.kind === "selected" && body.instance.body === header.tsonic.initializer);
    assert.equal(child !== undefined && child.tir.root === readyDefaultRoot(header), true);
    const source = caller.tir.params[index - 1].tsonic.local;
    assert.deepEqual(child.tir.captures, [{ local: source, capture: "captured-location" }]);
    const capture = child.mir.locals.find(local => local.role.kind === "capture");
    assert.equal(capture !== undefined, true);
    assert.deepEqual(capture.source, source);
    const summary = result.value.index.summaries.find(summary => summary.key.kind === "body"
      && summary.key.execution.instance.body === child.instance.body);
    assert.equal(summary !== undefined, true);
    const need = summary.initialization.points.find(point => point.kind === "need");
    assert.equal(need !== undefined, true);
    assert.deepEqual(need.witness.read, { kind: "body", value: { body: child.instance.body, node: child.tir.root.id } });
  }
  const summaries = result.value.index.summaries.filter(summary => summary.key.kind === "body"
    && summary.key.execution.instance.body === caller.instance.body);
  assert.deepEqual(summaries.map(summary => summary.key.execution.provided), [1, 2, 3]);
  assert.equal(summaries.every(summary => summary.initialization.points.every(point => point.kind !== "need")), true);
  for (const provided of [1, 2, 3]) {
    const dependencies = result.value.index.dependencyInventory.dependencies.filter(edge => edge.reason === "initializer"
      && edge.dependent.instance.body === caller.instance.body && edge.dependent.provided === provided);
    assert.equal(dependencies.length, 3 - provided);
  }
});

test("an omitted optional parameter runs its actual Boolean call and converts only its normal result", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    let reached: boolean = false;
    function next(fail: boolean): boolean { if (fail) throw fail; reached = true; return reached; }
    export function choose(fail: boolean, value: boolean | null = next(fail)): boolean | null { return value; }
    export function omitted(fail: boolean): boolean | null { return choose(fail); }
    export function suppliedNull(fail: boolean): boolean | null { return choose(fail, null); }
    export function suppliedUndefined(fail: boolean): boolean | null { return choose(fail, undefined); }
    export function suppliedFalse(fail: boolean): boolean | null { return choose(fail, false); }
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const main = modules.find(row => row.module === input.snapshot.entryPoint);
  const selected = name => {
    const declaration = readyModuleStatements(readyModuleRoot(main.tree)).find(node => node.kind === "FunctionDeclaration" && node.name.text === name);
    return main.bodies.find(body => body.kind === "selected" && body.tir.owner === declaration.tsonic.definition);
  };
  const next = selected("next");
  const choose = selected("choose");
  const initializer = main.bodies.find(body => body.kind === "selected" && body.instance.body === choose.tir.params[1].tsonic.initializer);
  const root = initializer.tir.root;
  assert.equal(root.kind, "CallExpression");
  assert.deepEqual(index.types.terms[next.tir.completion], { kind: "primitive", primitive: "bool" });
  assert.equal(index.types.terms[choose.tir.completion].kind, "optional");
  assert.equal(root.tsonic.type, next.tir.completion);
  assert.equal(root.tsonic.convertedType, choose.tir.completion);
  assert.equal(root.tsonic.conversion.kind, "convert");
  assert.equal(root.tsonic.conversion.role, "initialization");
  const [call] = initializer.mir.blocks.map(block => block.terminator).filter(terminator => terminator.kind === "call");
  assert.equal(call.callee.resolution.activation.body, next.instance.body);
  assert.deepEqual(call.unwind, { kind: "escape" });
  const [conversion] = initializer.mir.blocks[call.next].statements.filter(row => row.kind === "assign" && row.value.kind === "convert");
  assert.deepEqual(conversion.value.operand, { kind: "place", place: call.destination });
  assert.equal(conversion.value.to, choose.tir.completion);
  const dependencies = index.dependencyInventory.dependencies;
  const defaults = dependencies.filter(row => row.reason === "initializer" && row.dependent.instance.body === choose.instance.body);
  assert.equal(defaults.length, 1);
  assert.equal(defaults[0].dependent.provided, 1);
  assert.equal(defaults[0].target.execution.instance.body, initializer.instance.body);
  for (const name of ["omitted", "suppliedNull", "suppliedUndefined", "suppliedFalse"]) {
    const caller = selected(name);
    const [invocation] = caller.mir.blocks.map(block => block.terminator).filter(row => row.kind === "call");
    const omitted = name === "omitted";
    assert.deepEqual(invocation.arguments.map(argument => argument.kind), ["value", omitted ? "omitted" : "value"]);
    const [edge] = dependencies.filter(row => row.reason === "call" && row.dependent.instance.body === caller.instance.body);
    assert.equal(edge.target.execution.instance.body, choose.instance.body);
    assert.equal(edge.target.execution.provided, omitted ? 1 : 2);
    const summary = index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === caller.instance.body);
    assert.equal(summary.returns, true);
    assert.equal(summary.unwinds, omitted);
  }
});

test("a default before a required formal does not turn a supplied absence into omission", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate, resumeEvaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const base = `
    function fail(): boolean { throw true; }
    export function select(before: boolean | null = fail(), required: string, after: boolean = true): boolean | null { return before; }
  `;
  const text = base + `
    export function suppliedUndefined(required: string): boolean | null { return select(undefined, required); }
    export function suppliedNull(required: string): boolean | null { return select(null, required, false); }
    export function suppliedValue(required: string, flag: boolean): boolean | null { return select(flag, required); }
  `;
  const input = analysisInput(fixture, "sdk-minimal", text);
  const output = analyzeHostProgram(input);
  assert.equal(output.kind, "ok", JSON.stringify(output.diagnostics));
  const { index, modules } = output.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const selected = name => {
    const declaration = readyModuleStatements(readyModuleRoot(module.tree)).find(node => node.kind === "FunctionDeclaration" && node.name.text === name);
    return module.bodies.find(row => row.kind === "selected" && row.tir.owner === declaration.tsonic.definition);
  };
  const select = selected("select");
  const [before, , after] = select.tir.params;
  assert.deepEqual(select.mir.entries.map(entry => entry.provided), [3, 2]);
  const edgesOf = body => index.dependencyInventory.dependencies.filter(row => row.dependent.instance.body === body);
  assert.deepEqual(edgesOf(select.instance.body).filter(row => row.reason === "initializer")
    .map(row => [row.dependent.provided, row.target.execution.instance.body]), [[2, after.tsonic.initializer]]);
  const first = index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === before.tsonic.initializer);
  assert.equal(first.returns, false);
  assert.equal(first.unwinds, true);
  const trailing = module.bodies.find(row => row.kind === "selected" && row.instance.body === after.tsonic.initializer);
  const { types } = index;
  const evaluateWith = { types, typeOf: type => types.terms[type], signatureOf: signature => types.signatures[signature],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };

  for (const [name, provided, absent] of [["suppliedUndefined", 2, true], ["suppliedNull", 3, true], ["suppliedValue", 2, false]]) {
    const body = selected(name);
    const invocation = body.mir.blocks.find(block => block.terminator.kind === "call").terminator;
    assert.deepEqual(invocation.arguments.map(argument => argument.kind), ["value", "value", provided === 2 ? "omitted" : "value"]);
    const [edge] = edgesOf(body.instance.body).filter(row => row.reason === "call");
    assert.deepEqual(edge.target, { kind: "body", execution: { instance: select.instance, provided } });
    const summary = index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === body.instance.body);
    assert.equal(summary.returns, true);
    assert.equal(summary.unwinds, false);
    assert.equal(summary.arena.origins[summary.result].includesAbsence, absent);
    const arguments_ = [{ kind: "string", type: body.tir.params[0].tsonic.storage, value: "required" }];
    if (name === "suppliedValue") arguments_.push({ kind: "boolean", type: body.tir.params[1].tsonic.storage, value: false });
    const initial = evaluate(evaluateWith, body.instance, body.mir, arguments_, "compile-time",
      { query: "constValue", key: [body.instance, "compile-time"] });
    assert.equal(initial.kind, "paused");
    assert.deepEqual(initial.requests, [{ kind: "mir-body", instance: select.instance }]);
    let evaluated = resumeEvaluate(evaluateWith, initial.paused, [{ kind: "mir-body", body: select.mir }]);
    if (provided === 2) {
      assert.equal(evaluated.kind, "paused");
      assert.deepEqual(evaluated.requests, [{ kind: "mir-body", instance: trailing.instance }]);
      evaluated = resumeEvaluate(evaluateWith, evaluated.paused, [{ kind: "mir-body", body: trailing.mir }]);
    }
    assert.equal(evaluated.kind, "done");
    assert.equal(evaluated.value.kind, "ok");
    assert.deepEqual(evaluated.value.value, { kind: "value", value: absent
      ? { kind: "absence", type: body.tir.completion } : { kind: "boolean", type: body.tir.completion, value: false } });
  }

  const tooFew = base + "export function missing(): boolean | null { return select(undefined); }";
  const refusal = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", tooFew));
  assert.equal(refusal.kind, "refused");
  assert.equal(Object.hasOwn(refusal, "value"), false);
  assert.deepEqual(refusal.diagnostics.map(row => [row.code.rendered, row.site.origin.start, row.arguments]),
    [["TS2554", tooFew.lastIndexOf("select(undefined)"), [{ kind: "text", value: "2-3" }, { kind: "text", value: "1" }]]]);
});

test("a later default reads the current optional value in an earlier parameter, including supplied absence", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  for (const carrier of ["boolean", "string"]) {
    const storage = `${carrier} | null`;
    const input = analysisInput(fixture, "sdk-minimal", `
      export function choose(input: ${carrier}, first: ${storage} = input, second: ${storage} = first): ${storage} { return second; }
      export function defaulted(input: ${carrier}): ${storage} { return choose(input); }
      export function suppliedNull(input: ${carrier}): ${storage} { return choose(input, null); }
      export function suppliedUndefined(input: ${carrier}): ${storage} { return choose(input, undefined); }
      export function suppliedValue(input: ${carrier}): ${storage} { return choose(input, input); }
      export function chooseOnWrite(input: ${carrier}, first: ${storage} = input, changed: ${storage} = (first = null)): ${storage} { return first; }
      export function storedAbsence(input: ${carrier}): ${storage} { return chooseOnWrite(input, input); }
      export function bypassedWrite(input: ${carrier}): ${storage} { return chooseOnWrite(input, input, input); }
      export function chooseOnBranch(input: ${carrier}, flag: boolean, first: ${storage} = input,
        changed: ${storage} = !flag ? (first = null) : first): ${storage} { return first; }
      export function maybeAbsent(input: ${carrier}, flag: boolean): ${storage} { return chooseOnBranch(input, flag, input); }
    `);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { index, modules } = result.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    const selected = name => {
      const declaration = readyModuleStatements(readyModuleRoot(module.tree)).find(node => node.kind === "FunctionDeclaration" && node.name.text === name);
      return module.bodies.find(body => body.kind === "selected" && body.tir.owner === declaration.tsonic.definition);
    };
    const summaryOf = (body, provided) => index.summaries.find(row => row.key.kind === "body"
      && row.key.execution.instance.body === body && row.key.execution.provided === provided);
    const choose = selected("choose");
    const earlier = choose.tir.params[1];
    const later = choose.tir.params[2];
    const child = module.bodies.find(body => body.kind === "selected" && body.instance.body === later.tsonic.initializer);
    assert.deepEqual(child.tir.captures, [{ local: earlier.tsonic.local, capture: "captured-location" }]);
    const childSummary = summaryOf(child.instance.body, 0);
    const [location] = childSummary.arena.contexts[0].captures;
    const childResult = childSummary.arena.origins[childSummary.result];
    assert.deepEqual(childResult.producers, [location.location]);
    assert.equal(childResult.includesAbsence, false, "the actual caller binds the symbolic capture's absence");
    assert.equal(childSummary.initialization.points.some(point => point.kind === "need" && point.cell === location.cell), true);
    assert.equal(childSummary.retention.length, carrier === "string" ? 1 : 0);
    const dependencies = index.dependencyInventory.dependencies;
    const checkResult = (summary, absent, includesSource) => {
      const origins = summary.arena.origins[summary.result];
      assert.equal(origins.includesAbsence, absent);
      assert.deepEqual(origins.producers.map(bound => {
        const producer = summary.arena.producers[summary.arena.boundProducers[bound].producer];
        return [producer.kind, producer.index];
      }), carrier === "string" && includesSource ? [["parameter", 0]] : []);
    };
    for (const [name, provided, absent] of [["defaulted", 1, false], ["suppliedNull", 2, true],
      ["suppliedUndefined", 2, true], ["suppliedValue", 2, false]]) {
      const caller = selected(name);
      checkResult(summaryOf(caller.instance.body, 1), absent, !absent);
      const call = dependencies.find(row => row.reason === "call" && row.dependent.instance.body === caller.instance.body);
      assert.equal(call.target.execution.provided, provided);
      const placed = dependencies.filter(row => row.reason === "initializer"
        && row.dependent.instance.body === choose.instance.body && row.dependent.provided === provided);
      assert.deepEqual(placed.map(row => row.target.execution.instance.body), provided === 1
        ? [earlier.tsonic.initializer, later.tsonic.initializer] : [later.tsonic.initializer]);
    }
    const write = selected("chooseOnWrite");
    const writeBody = write.tir.params[2].tsonic.initializer;
    const writeSummary = summaryOf(writeBody, 0);
    const [writtenLocation] = writeSummary.arena.contexts[0].captures;
    for (const rows of [writeSummary.writes, writeSummary.contentsOnReturn]) {
      assert.equal(rows.length, 1);
      const [row] = rows;
      assert.equal(row.target, writtenLocation.cell);
      assert.deepEqual(writeSummary.arena.origins[row.value],
        { id: row.value, kind: "complete", producers: [], includesAbsence: true });
    }
    assert.equal(writeSummary.retention.length, 0);
    for (const [name, provided, absent] of [["storedAbsence", 2, true], ["bypassedWrite", 3, false]]) {
      const caller = selected(name);
      checkResult(summaryOf(caller.instance.body, 1), absent, !absent);
      const call = dependencies.find(row => row.reason === "call" && row.dependent.instance.body === caller.instance.body);
      assert.equal(call.target.execution.provided, provided);
      assert.equal(dependencies.some(row => row.reason === "initializer" && row.dependent.instance.body === write.instance.body
        && row.dependent.provided === provided && row.target.execution.instance.body === writeBody), absent);
    }
    const branch = selected("chooseOnBranch");
    const branchSummary = summaryOf(branch.tir.params[3].tsonic.initializer, 0);
    const [branchWrite] = branchSummary.writes;
    const [branchContents] = branchSummary.contentsOnReturn;
    assert.equal(branchSummary.writes.length, 1);
    assert.equal(branchSummary.contentsOnReturn.length, 1);
    assert.equal(branchContents.target, branchWrite.target);
    assert.deepEqual(branchSummary.arena.origins[branchWrite.value],
      { id: branchWrite.value, kind: "complete", producers: [], includesAbsence: true });
    assert.deepEqual(branchSummary.arena.origins[branchContents.value],
      { id: branchContents.value, kind: "complete",
        producers: [branchSummary.arena.contexts[0].captures.find(row => row.cell === branchWrite.target).location],
        includesAbsence: true });
    checkResult(summaryOf(selected("maybeAbsent").instance.body, 2), true, true);
  }
});

test("actual placed-body capture verification rejects wrong modes, qualified locals and creator associations", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { verifyTir: verifyTirOperation } = await import("../../packages/host/dist/ir-tir/index.js");
  const verifyTir = await tirFixtureBodyVerifier(verifyTirOperation);
  const input = analysisInput(fixture, "sdk-minimal", "export function select(a: boolean, b = a): boolean { return b; }\n");
  const source = captureSourceBarrier(input);
  assert.equal(source.kind, "ok");
  const typed = typeSourceBarrier(input, source.value, createTypedAccount(input));
  assert.equal(typed.kind, "ok");
  const child = [...typed.value.bodies.values()].find(body => body.bindings.kind === "instantiated" && body.captures.length === 1);
  assert.equal(child !== undefined, true);
  const verifier = typed.value.verifierOf(child.root.origin.module);
  assert.deepEqual(verifyTir(verifier, child), []);
  assert.equal(verifyTir(verifier, { ...child, captures: [{ ...child.captures[0], capture: "captured-value" }] })
    .some(finding => finding.rule === "closure-capture-binding"), true);
  assert.equal(verifyTir(verifier, { ...child, captures: [{ ...child.captures[0], local: { body: child.body, local: 0 } }] })
    .some(finding => finding.rule === "capture-qualified"), true);
  const nodeOf = reference => {
    const node = verifier.nodeOf(reference);
    return node?.kind === "Parameter" && node.tsonic.initializer === child.body
      ? { ...node, tsonic: { ...node.tsonic, initializer: null } } : node;
  };
  assert.equal(verifyTir({ ...verifier, nodeOf }, child).some(finding => finding.rule === "capture-qualified"), true,
    "a capture cannot substitute an arrow-value decision for its actual placed creator association");
});

for (const count of [2, 12])
test(`real public Host publication orders all ${count + 1} default entries numerically without changing their MIR prologues`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const parameters = Array.from({ length: count }, (_, index) => `argument${index}: boolean = true`).join(", ");
  const input = analysisInput(fixture, "sdk-minimal", `export function value(${parameters}): boolean { return argument0; }\n`);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const callable = module.bodies.find(body => body.kind === "selected" && body.tir.params.length === count);
  assert.notEqual(callable, undefined);
  assert.deepEqual(callable.mir.entries.map(entry => entry.provided), Array.from({ length: count + 1 }, (_, index) => count - index));
  assert.deepEqual(callable.facts.map(facts => facts.execution.provided), Array.from({ length: count + 1 }, (_, index) => index));
  for (let provided = 0; provided <= count; provided += 1) {
    const dependencies = result.value.index.dependencyInventory.dependencies.filter(edge => edge.reason === "initializer"
      && edge.dependent.instance.body === callable.instance.body && edge.dependent.provided === provided);
    assert.equal(dependencies.length, count - provided);
  }
});

for (const [form, statements] of [
  ["else", "if (flag) return a; else return b;"],
  ["fall-through", "if (flag) return a; return b;"],
  ["blocks", "if (flag) { return a; } else { return b; }"],
])
test(`real public Host analysis closes a scalar boolean ${form} branch with both actual return paths`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `export function choose(flag: boolean, a: number, b: number): number { ${statements} }\n`);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const callable = module.bodies.find(body => body.kind === "selected" && body.tir.params.length === 3);
  assert.notEqual(callable, undefined);
  assert.equal(callable.tir.root.statements.nodes[0].kind, "IfStatement");
  assert.equal(callable.mir.blocks.filter(block => block.terminator.kind === "switch").length, 1);
  assert.equal(callable.mir.blocks.filter(block => block.terminator.kind === "return").length, 2);
  assert.deepEqual(callable.facts.map(facts => facts.execution.provided), [3]);
});

test("real public Host analysis closes an inferred null default with the single native absence type", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export function value(argument = null) { return argument; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const callable = module.bodies.find(body => body.kind === "selected" && body.tir.params.length === 1);
  assert.notEqual(callable, undefined);
  const parameter = result.value.index.types.signatures[callable.tir.signature].parameters[0];
  assert.deepEqual(result.value.index.types.terms[parameter.type], { kind: "intrinsic", intrinsic: "absence" });
  assert.deepEqual(callable.mir.entries.map(entry => entry.provided), [1, 0]);
  assert.deepEqual(callable.facts.map(facts => facts.execution.provided), [0, 1]);
});

for (const annotation of [": boolean", ""])
test(`real public Host analysis executes an ${annotation === "" ? "inferred" : "annotated"} local boolean initializer as its own selected body`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `export function local(): boolean { const value${annotation} = true; return value; }\n`);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const selected = module.bodies.filter(body => body.kind === "selected");
  const callable = selected.find(body => body.tir.root.kind === "Block");
  assert.notEqual(callable, undefined);
  const declaration = callable.tir.root.statements.nodes[0].declarationList.declarations.nodes[0];
  const initializer = selected.find(body => body.instance.body === declaration.tsonic.initializer);
  assert.notEqual(initializer, undefined);
  assert.equal(initializer.tir.root === declaration.initializer, true);
  assert.equal(selected.length, 3);
  assert.equal(callable.facts.length, 1);
  assert.equal(callable.mir.blocks.some(block => block.terminator.kind === "call" && block.terminator.callee.kind === "body"
    && block.terminator.callee.instance.body === initializer.instance.body
    && block.terminator.tir.node === declaration.id), true);
  assert.equal(result.value.index.dependencyInventory.dependencies.some(edge => edge.reason === "initializer"
    && edge.dependent.instance.body === callable.instance.body && edge.target.kind === "body"
    && edge.target.execution.instance.body === initializer.instance.body), true);
  if (annotation !== "") {
    const conversions = initializer.mir.blocks.flatMap(block => block.statements)
      .filter(statement => statement.kind === "assign" && statement.value.kind === "convert");
    assert.equal(conversions.some(statement => statement.value.operation.decision.operation.kind === "conversion"
      && statement.value.operation.decision.operation.embedding.kind === "conversion"
      && statement.value.operation.decision.operation.embedding.conversion === "literal-fit"), true);
  }
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const table = result.value.index.types;
  const evaluated = evaluate({ types: table, typeOf: type => table.terms[type], signatureOf: signature => table.signatures[signature],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation }, initializer.instance, initializer.mir, [],
  "compile-time", { query: "constValue", key: [initializer.instance, "compile-time"] });
  assert.equal(evaluated.kind, "done");
  assert.equal(evaluated.value.kind, "ok");
  assert.deepEqual(evaluated.value.value, { kind: "value", value: { kind: "boolean", value: true, type: initializer.tir.completion } });
});

test("real public Host analysis discharges a body-local captured initializer through its actual storage lifetime", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function local(input: boolean): boolean { let a: boolean = input; const b: boolean = a; return b; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const caller = module.bodies.find(body => body.kind === "selected" && body.tir.params.length === 1);
  assert.notEqual(caller, undefined);
  const declarations = caller.tir.root.statements.nodes.slice(0, 2)
    .map(statement => statement.declarationList.declarations.nodes[0]);
  const source = declarations[0].name.tsonic.declaration.local;
  const child = module.bodies.find(body => body.kind === "selected" && body.instance.body === declarations[1].tsonic.initializer);
  assert.equal(child !== undefined && child.tir.root === declarations[1].initializer, true);
  assert.deepEqual(child.tir.captures, [{ local: source, capture: "captured-location" }]);
  const local = caller.mir.locals.find(local => local.source?.body === source.body && local.source.local === source.local);
  assert.notEqual(local, undefined);
  const facts = caller.facts[0];
  const cell = facts.arena.cells.find(cell => cell.role.kind === "local" && cell.role.local === local.id);
  assert.equal(cell !== undefined && cell.occurrence.kind === "declared", true);
  assert.equal(caller.tir.locals[source.local].declaration.value.node, declarations[0].id);
  assert.deepEqual(cell.occurrence.at, { kind: "node", node: { kind: "body", value: { body: caller.instance.body, node: declarations[0].id } } });
  assert.equal(cell.lifetimes.some(marker => marker.kind === "live"), true);
  for (const marker of cell.lifetimes) {
    const operation = caller.mir.blocks[marker.point.block].statements[marker.point.statement];
    assert.equal(operation.kind, marker.kind === "live" ? "storage-live" : "storage-dead");
    assert.equal(operation.local, local.id);
  }
  const summary = result.value.index.summaries.find(summary => summary.key.kind === "body"
    && summary.key.execution.instance.body === caller.instance.body);
  assert.notEqual(summary, undefined);
  assert.equal(summary.initialization.points.every(point => point.kind !== "need"), true);
});

test("real public Host analysis retains one current local cell across two distinct captured initializer calls", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function local(input: boolean): boolean { let a: boolean = input; const b: boolean = a; const c: boolean = a; return c; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const caller = module.bodies.find(body => body.kind === "selected" && body.tir.params.length === 1);
  assert.equal(caller !== undefined, true);
  const declarations = caller.tir.root.statements.nodes.slice(0, 3)
    .map(statement => statement.declarationList.declarations.nodes[0]);
  const source = declarations[0].name.tsonic.declaration.local;
  const local = caller.mir.locals.find(local => local.source?.body === source.body && local.source.local === source.local);
  assert.equal(local !== undefined, true);
  const facts = caller.facts[0];
  const cells = facts.arena.cells.filter(cell => cell.role.kind === "local" && cell.role.local === local.id);
  assert.equal(cells.length, 1);
  const cell = cells[0];
  assert.equal(caller.tir.locals[source.local].declaration.value.node, declarations[0].id);
  assert.deepEqual(cell.occurrence, { kind: "declared", at: { kind: "node", node: { kind: "body", value: { body: caller.instance.body, node: declarations[0].id } } } });
  const children = declarations.slice(1).map(declaration => declaration.tsonic.initializer);
  const calls = caller.mir.blocks.filter(block => block.terminator.kind === "call"
    && block.terminator.callee.kind === "body" && children.includes(block.terminator.callee.instance.body));
  assert.equal(calls.length, 2);
  for (const block of calls) {
    const activation = facts.origins.activations.find(row => row.point.block === block.id && row.point.statement === null);
    assert.equal(activation !== undefined, true);
    const capture = facts.arena.contexts[activation.context].captures[0];
    assert.equal(capture.cell, cell.id);
    const bound = facts.arena.boundProducers[capture.location];
    const producer = facts.arena.producers[bound.producer];
    assert.equal(producer.kind, "local");
    assert.deepEqual(producer.local, source);
  }
  const summary = result.value.index.summaries.find(summary => summary.key.kind === "body"
    && summary.key.execution.instance.body === caller.instance.body);
  assert.equal(summary !== undefined, true);
  assert.equal(summary.initialization.points.every(point => point.kind !== "need"), true);
});

test("real public Host analysis rejects an uninitialized body-local captured read without publishing a program", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function local(): boolean { let a: boolean; const b: boolean = a; return b; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "refused");
  assert.equal("value" in result, false);
  assert.equal(result.diagnostics.some(diagnostic => diagnostic.code.rendered === "TSONIC_READ_BEFORE_INITIALIZATION"), true);
});

test("own-storage initialization witnesses report the authored read, not its enclosing operation", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const helper = "function pass(value: boolean): boolean { return value; }";
  for (const [body, storage, initial] of [
    ["return unready;", "boolean", "flag"],
    ["return !unready;", "boolean", "flag"],
    ["throw unready;", "string", "message"],
    ["let next: boolean = flag; next = unready; return next;", "boolean", "flag"],
    ["return pass((unready));", "boolean", "flag"],
    ["if (unready) return true; return false;", "boolean", "flag"],
    ["while (unready) { return true; } return false;", "boolean", "flag"],
    ["return ((unready));", "boolean", "flag"],
    ["return (flag, unready);", "boolean", "flag"],
    ["return flag ? unready : flag;", "boolean", "flag"],
    ["return flag ? flag : unready;", "boolean", "flag"],
    ["return flag && unready;", "boolean", "flag"],
  ]) {
    const declaration = `unready: ${storage}`;
    const source = `// λ🌱\n${helper} export function inspect(flag: boolean, message: string): boolean { let ${declaration}; ${body} }`;
    const input = analysisInput(fixture, "sdk-minimal", source);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "refused", body);
    assert.equal(Object.hasOwn(result, "value"), false, body);
    assert.deepEqual(result.diagnostics.map(diagnostic => diagnostic.code.rendered), ["TSONIC_READ_BEFORE_INITIALIZATION"], body);
    const [diagnostic] = result.diagnostics;
    const module = input.snapshot.entryPoint;
    assert.deepEqual(diagnostic.site, { kind: "source", origin: {
      module, start: source.lastIndexOf("unready"), length: "unready".length, derived: [],
    } }, body);
    assert.deepEqual(diagnostic.related.map(row => row.site), [{ kind: "source", origin: {
      module, start: source.indexOf(declaration), length: declaration.length, derived: [],
    } }], body);
    const repaired = source.replace(`let ${declaration};`, `let ${declaration} = ${initial};`);
    assert.equal(analyzeHostProgram(analysisInput(fixture, "sdk-minimal", repaired)).kind, "ok", body);
  }
});

test("independent analysis roots retain their own errors and a dependent transports the actual cause", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeTypedSource } = await import("../../packages/host/dist/pipeline/analysis-barrier.js");
  const { accountFailure, createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const { executionKey } = await import("../../packages/host/dist/ir-types/index.js");
  const first = "export function first(): boolean { let beginning: boolean; return beginning; }";
  const last = "export function last(): boolean { let ending: boolean; return ending; }";
  const dependent = "export function dependent(): boolean { return first(); }";
  const healthy = "export function healthy(): boolean { return true; }";
  for (const declarations of [[first, dependent, healthy, last], [last, healthy, dependent, first]]) {
    const text = declarations.join("\n");
    const input = analysisInput(fixture, "sdk-minimal", text);
    const checked = captureSourceBarrier(input);
    assert.equal(checked.kind, "ok");
    const account = createAccount(input.limits.dataflow);
    const ready = typeSourceBarrier(input, checked.value, account);
    assert.equal(ready.kind, "ok");
    const module = ready.value.modules.get(input.snapshot.entryPoint);
    const unitFor = name => {
      const declaration = readyModuleStatements(readyModuleRoot(module.tree)).find(node => node.name.text === name);
      const body = module.bodies.find(body => body.bindings.kind === "instantiated" && body.body === declaration.tsonic.signatures[0].body);
      const instance = { body: body.body, bindings: body.bindings };
      const key = executionKey({ instance, provided: 0 });
      return { request: { query: "bodyFactsOf", key }, position: { kind: "execution-result", execution: key } };
    };
    const result = analyzeTypedSource(input, ready.value, account);
    assert.equal(result.kind, "refused");
    const originalSites = ["beginning", "ending"].map(name => ({
      kind: "source", origin: { module: input.snapshot.entryPoint, start: text.lastIndexOf(name), length: name.length, derived: [] },
    })).sort((left, right) => left.origin.start - right.origin.start);
    assert.deepEqual(result.diagnostics.map(diagnostic => diagnostic.code.rendered),
      ["TSONIC_READ_BEFORE_INITIALIZATION", "TSONIC_READ_BEFORE_INITIALIZATION"]);
    assert.deepEqual(result.diagnostics.map(diagnostic => diagnostic.site), originalSites);
    for (const name of ["first", "last"]) {
      const owned = ready.value.database.errorOf(unitFor(name));
      assert.equal(owned.kind, "completed", name);
      assert.equal(owned.error.kind, "error", name);
      assert.equal(owned.error.causes.length, 1, name);
      const [cause] = owned.error.causes;
      assert.equal(cause.kind, "unit");
      assert.deepEqual(cause.unit.request, unitFor(name).request);
      const body = module.bodies.find(row => row.bindings.kind === "instantiated"
        && row.body === readyModuleStatements(readyModuleRoot(module.tree)).find(node => node.name.text === name).tsonic.signatures[0].body);
      assert.deepEqual(cause.unit.position, { kind: "execution-source-node", execution: unitFor(name).position.execution,
        node: { body: body.body, node: body.root.statements.nodes.at(-1).expression.id } });
      assert.deepEqual(ready.value.database.errorOf(cause.unit), { kind: "completed", error: { kind: "error",
        causes: [{ kind: "diagnostic", diagnostic: { kind: "host", unit: cause.unit, code: "TSONIC_READ_BEFORE_INITIALIZATION" } }] } });
    }
    assert.deepEqual(ready.value.database.errorOf(unitFor("dependent")), { kind: "completed",
      error: { kind: "error", causes: [{ kind: "unit", unit: unitFor("first") }] } });
    assert.deepEqual(ready.value.database.errorOf(unitFor("healthy")), { kind: "completed", error: null });
    const published = analyzeHostProgram(input);
    assert.equal(published.kind, "refused");
    assert.equal(Object.hasOwn(published, "value"), false);
    assert.deepEqual(published.diagnostics, result.diagnostics);
    const { work, entries } = InvocationAccount.stateOf(account);
    for (const [field, dimension, needed] of [["maximumWork", "work", work], ["maximumResultEntries", "result-entries", entries]]) {
      const fresh = captureSourceBarrier(input);
      assert.equal(fresh.kind, "ok");
      const cut = createAccount({ ...input.limits.dataflow, [field]: needed - 1 });
      const limited = typeSourceBarrier(input, fresh.value, cut);
      assert.equal(limited.kind, "ok");
      const stopped = analyzeTypedSource(input, limited.value, cut);
      assert.equal(stopped.kind, "refused");
      assert.equal(Object.hasOwn(stopped, "value"), false);
      assert.equal(accountFailure(cut)?.dimension, dimension);
      const original = limited.value.database.errorOf(unitFor("first"));
      assert.equal(original.kind, "completed", dimension);
      assert.equal(original.error?.kind, "error", dimension);
      const earned = limited.value.database.diagnostics();
      assert.deepEqual(stopped.diagnostics, earned);
      const lastDiagnostic = stopped.diagnostics.at(-1);
      assert.equal(lastDiagnostic.code.rendered, "TSONIC_COMPILER_RESOURCE_LIMIT");
      assert.deepEqual(lastDiagnostic.arguments, [{ kind: "text", value: dimension }, { kind: "number", value: needed - 1 }]);
      assert.equal(stopped.diagnostics.filter(diagnostic => diagnostic === lastDiagnostic).length, 1);
      assert.equal(stopped.diagnostics.some(diagnostic => diagnostic.site.kind === "source"
        && diagnostic.site.origin.start === text.lastIndexOf("beginning")), true, dimension);
    }
    const repaired = text.replace("beginning: boolean;", "beginning: boolean = true;").replace("ending: boolean;", "ending: boolean = false;");
    assert.equal(analyzeHostProgram(analysisInput(fixture, "sdk-minimal", repaired)).kind, "ok");
  }
});

test("converged execution errors at one source site retain distinct provided-count units", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeTypedSource } = await import("../../packages/host/dist/pipeline/analysis-barrier.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const { executionKey } = await import("../../packages/host/dist/ir-types/index.js");
  const text = "export function check(flag: boolean = true): boolean { let local: boolean; return local; }";
  const input = analysisInput(fixture, "sdk-minimal", text);
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const account = createAccount(input.limits.dataflow);
  const ready = typeSourceBarrier(input, captured.value, account);
  assert.equal(ready.kind, "ok");
  const owner = ready.value.modules.get(input.snapshot.entryPoint);
  const declaration = readyModuleStatements(readyModuleRoot(owner.tree))[0];
  const selected = owner.bodies.find(body => body.bindings.kind === "instantiated" && body.body === declaration.tsonic.signatures[0].body);
  const instance = { body: selected.body, bindings: selected.bindings };
  const result = analyzeTypedSource(input, ready.value, account);
  assert.equal(result.kind, "refused");
  assert.equal(Object.hasOwn(result, "value"), false);
  assert.equal(result.diagnostics.length, 2);
  assert.equal(result.diagnostics[0] === result.diagnostics[1], false);
  for (const diagnostic of result.diagnostics) {
    assert.equal(diagnostic.code.rendered, "TSONIC_READ_BEFORE_INITIALIZATION");
    assert.deepEqual(diagnostic.site, { kind: "source", origin: {
      module: input.snapshot.entryPoint, start: text.lastIndexOf("local"), length: "local".length, derived: [],
    } });
  }
  for (const provided of [0, 1]) {
    const request = { query: "bodyFactsOf", key: executionKey({ instance, provided }) };
    const read = selected.root.statements.nodes.at(-1).expression;
    const originUnit = { request, position: { kind: "execution-source-node", execution: request.key,
      node: { body: selected.body, node: read.id } } };
    assert.deepEqual(ready.value.database.errorOf(originUnit), { kind: "completed", error: { kind: "error",
      causes: [{ kind: "diagnostic", diagnostic: { kind: "host", unit: originUnit, code: "TSONIC_READ_BEFORE_INITIALIZATION" } }] } });
    assert.deepEqual(ready.value.database.errorOf({ request, position: { kind: "execution-result", execution: request.key } }), { kind: "completed", error: {
      kind: "error", causes: [{ kind: "unit", unit: originUnit }],
    } });
  }
});

test("one execution retains each independent own-storage read at its actual answer position", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeTypedSource } = await import("../../packages/host/dist/pipeline/analysis-barrier.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const { executionKey } = await import("../../packages/host/dist/ir-types/index.js");
  const { iterateChildrenOfSyntax } = await import("../../packages/host/dist/ir-hir/index.js");
  for (const body of [
    "if (flag) return first; return second;",
    "if (flag) return second; return first;",
    "return first === second;",
    "while (flag) { if (first) return true; } return second;",
  ]) {
    const text = `export function inspect(flag: boolean): boolean { let first: boolean; let second: boolean; ${body} }`;
    const input = analysisInput(fixture, "sdk-minimal", text);
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok", body);
    const account = createAccount(input.limits.dataflow);
    const typed = typeSourceBarrier(input, captured.value, account);
    assert.equal(typed.kind, "ok", body);
    const owner = typed.value.modules.get(input.snapshot.entryPoint);
    const declaration = readyModuleStatements(readyModuleRoot(owner.tree))[0];
    const selected = owner.bodies.find(row => row.bindings.kind === "instantiated" && row.body === declaration.tsonic.signatures[0].body);
    const request = { query: "bodyFactsOf", key: executionKey({ instance: { body: selected.body, bindings: selected.bindings }, provided: 1 }) };
    const expectedSites = ["first", "second"].map(name => ({ module: input.snapshot.entryPoint,
      start: text.lastIndexOf(name), length: name.length, derived: [] })).sort((left, right) => left.start - right.start);
    const result = analyzeTypedSource(input, typed.value, account);
    assert.equal(result.kind, "refused", body);
    assert.equal(Object.hasOwn(result, "value"), false, body);
    assert.deepEqual(result.diagnostics.map(row => [row.code.rendered, row.site.origin]),
      expectedSites.map(origin => ["TSONIC_READ_BEFORE_INITIALIZATION", origin]), body);
    const nodes = new Map();
    const stack = [selected.root];
    while (stack.length !== 0) {
      const node = stack.pop();
      if (node.kind === "Identifier") nodes.set(node.origin.start, node);
      for (const child of iterateChildrenOfSyntax(node)) stack.push(child);
    }
    const positions = expectedSites.map(origin => ({ kind: "execution-source-node", execution: request.key,
      node: { body: selected.body, node: nodes.get(origin.start).id } }));
    for (const position of positions) {
      const unit = { request, position };
      assert.deepEqual(typed.value.database.errorOf(unit), { kind: "completed", error: { kind: "error",
        causes: [{ kind: "diagnostic", diagnostic: { kind: "host", unit, code: "TSONIC_READ_BEFORE_INITIALIZATION" } }] } }, body);
    }
    const answer = typed.value.database.errorOf({ request, position: { kind: "execution-result", execution: request.key } });
    assert.equal(answer.kind, "completed", body);
    assert.deepEqual(answer.error.causes.map(cause => cause.unit.position).sort((left, right) => left.node.node - right.node.node),
      positions.toSorted((left, right) => left.node.node - right.node.node), body);
    assert.equal(answer.error.causes.every(cause => cause.kind === "unit"), true, body);
    const published = analyzeHostProgram(input);
    assert.equal(published.kind, "refused", body);
    assert.deepEqual(published.diagnostics, result.diagnostics, body);
    const one = text.replace("let first: boolean;", "let first: boolean = true;");
    const remaining = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", one));
    assert.deepEqual(remaining.diagnostics.map(row => row.site.origin.start), [one.lastIndexOf("second")], body);
    const repaired = one.replace("let second: boolean;", "let second: boolean = false;");
    assert.equal(analyzeHostProgram(analysisInput(fixture, "sdk-minimal", repaired)).kind, "ok", body);
  }
});

test("an errored callee cannot hide an independent initialization read in its caller", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const callee = "function fail(input: boolean): boolean { let calleeSlot: boolean; return calleeSlot; }";
  const cases = [
    ["argument", "let unready: boolean; return fail(unready);", true],
    ["other branch", "let unready: boolean; if (flag) return fail(flag); return unready;", true],
    ["after the call", "let unready: boolean; fail(flag); return unready;", false],
    ["after the join", "let unready: boolean; if (flag) fail(flag); return unready;", false],
    ["only the failing edge already wrote the cell", "let unready: boolean; if (flag) { unready = true; fail(flag); } return unready;", true],
    ["guaranteed write after the call", "let unready: boolean; fail(flag); unready = true; return unready;", false],
  ];
  for (const [label, body, reportCaller] of cases) {
    const text = `${callee}\nexport function caller(flag: boolean): boolean { ${body} }`;
    const result = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", text));
    assert.equal(result.kind, "refused", label);
    assert.equal(Object.hasOwn(result, "value"), false, label);
    assert.deepEqual(result.diagnostics.map(diagnostic => [diagnostic.code.rendered, diagnostic.site.origin.start]),
      [["TSONIC_READ_BEFORE_INITIALIZATION", text.lastIndexOf("calleeSlot")],
        ...(reportCaller ? [["TSONIC_READ_BEFORE_INITIALIZATION", text.lastIndexOf("unready")]] : [])], label);
  }
});

test("real public Host analysis closes a direct zero-argument scalar call through its actual selected callee", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { sameInstance } = await import("../../packages/host/dist/ir-types/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function value(): boolean { return true; } export function read(): boolean { return value(); }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const selected = module.bodies.filter(body => body.kind === "selected");
  const caller = selected.find(body => body.mir.blocks.some(block => block.terminator.kind === "call"));
  assert.notEqual(caller, undefined);
  const block = caller.mir.blocks.find(block => block.terminator.kind === "call");
  const call = block.terminator;
  assert.equal(call.callee.kind, "direct");
  assert.notEqual(call.callee.resolution.activation, null);
  const callee = selected.find(body => sameInstance(body.instance, call.callee.resolution.activation));
  assert.notEqual(callee, undefined);
  assert.notEqual(callee, caller);
  assert.equal(call.arguments.length, 0);
  assert.equal(caller.facts.some(facts => facts.origins.activations.some(row => row.node === call.tir.node
    && row.point.block === block.id && row.point.statement === null && sameInstance(row.activation, callee.instance))), true);
  assert.equal(result.value.index.dependencyInventory.dependencies.some(edge => edge.reason === "call"
    && sameInstance(edge.dependent.instance, caller.instance) && edge.dependent.provided === 0
    && edge.target.kind === "body" && sameInstance(edge.target.execution.instance, callee.instance)
    && edge.target.execution.provided === 0), true);
});

test("recursive executions publish one stable qualified component and no partial member on a cut", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeTypedSource } = await import("../../packages/host/dist/pipeline/analysis-barrier.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const { executionKey } = await import("../../packages/host/dist/ir-types/index.js");
  const { accountFailure } = await import("../../packages/host/dist/dataflow/index.js");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const finite = "export function fill(value:boolean):boolean { if(value) return true; return fill(true); }";
  const never = "export function stay():boolean { return stay(); }";
  const unwind = "export function own(flag:boolean,message:string):string { if(flag) throw message; return own(flag,message); }";
  const left = "export function left(flag:boolean,message:string):string { if(flag) return message; return right(true,message); }";
  const right = "export function right(flag:boolean,message:string):string { if(flag) throw message; return left(true,message); }";
  const both = "export function both(flag:boolean,next:boolean=true):boolean { if(flag) return both(false); if(next) return both(true,true); return flag; }";
  const program = source => analyzeHostProgram(analysisInput(fixture, "sdk-minimal", source));
  for (const [text, expected] of [[finite, [[1, true, false]]], [never, [[0, false, false]]], [unwind, [[2, false, true]]],
    [[left, right].join("\n"), [[2, true, true], [2, true, true]]], [[right, left].join("\n"), [[2, true, true], [2, true, true]]]]) {
    const result = program(text);
    assert.equal(result.kind, "ok");
    const inventory = result.value.index.dependencyInventory;
    const recursive = inventory.components.find(component => component.members.some(member => component.rows.some(index =>
      inventory.dependencies[index].target.kind === "body"
      && executionKey(inventory.dependencies[index].target.execution) === executionKey(inventory.operations[member].execution))));
    const keys = recursive.members.map(index => executionKey(inventory.operations[index].execution));
    const stable = result.value.index.summaries.filter(row => row.key.kind === "body" && keys.includes(executionKey(row.key.execution)));
    assert.deepEqual(stable.map(row => [row.key.execution.provided, row.returns, row.unwinds]), expected);
  }
  const baseline = analysisInput(fixture, "sdk-minimal", both);
  const converge = pipelineWiring.summaries.convergeComponent;
  const round = pipelineWiring.bodyAnalysis.analyzeBodyRound;
  let component = null;
  let beforePublication = null;
  const run = input => {
    const source = captureSourceBarrier(input);
    assert.equal(source.kind, "ok");
    const account = createTypedAccount(input);
    const typed = typeSourceBarrier(input, source.value, account);
    assert.equal(typed.kind, "ok");
    const result = analyzeTypedSource(input, typed.value, account);
    return { result, database: typed.value.database, stop: accountFailure(account) };
  };
  const unitAt = (executions, execution) => ({ request: { query: "bodyFactsOf", key: executions[0] },
    position: { kind: "execution-result", execution } });
  try {
    pipelineWiring.summaries.convergeComponent = (deps, input) => {
      if (input.members.length === 2) component = input.members.map(member => executionKey(member.execution));
      const result = converge(deps, input);
      if (input.members.length === 2 && result.kind === "complete")
        beforePublication = InvocationAccount.stateOf(deps.resources.account).entries;
      return result;
    };
    const actual = run(baseline);
    assert.equal(actual.result.kind, "ok");
    assert.equal(component.length, 2);
    const complete = actual.result.value.inventory.operations.filter(operation => operation.kind === "body"
      && component.includes(executionKey(operation.execution))).map(operation => operation.execution);
    assert.deepEqual(complete.map(execution => execution.provided).sort(), [1, 2]);
    assert.equal(complete[0].instance.body, complete[1].instance.body);
    for (const execution of component)
      assert.deepEqual(actual.database.errorOf(unitAt(component, execution)), { kind: "completed", error: null });
    const before = beforePublication;
    for (const limits of [
      { ...baseline.limits, summaries: { ...baseline.limits.summaries, maximumIterationsPerComponent: 1 } },
      { ...baseline.limits, dataflow: { ...baseline.limits.dataflow, maximumResultEntries: before - 1 } },
    ]) {
      assert.ok(before > 1);
      const cut = run({ ...baseline, limits });
      assert.equal(cut.result.kind, "refused");
      assert.equal("value" in cut.result, false);
      assert.ok(cut.stop);
      for (const execution of component) assert.notEqual(cut.database.errorOf(unitAt(component, execution)).kind, "completed");
      if (cut.stop.kind === "refused") assert.ok(cut.result.diagnostics.includes(cut.stop.diagnostics[0]));
    }
    const source = "export function self(flag:boolean):boolean { if(flag) { let missing:boolean; return missing; } return self(false); }";
    let detector = null;
    let repeatedGround = false;
    pipelineWiring.bodyAnalysis.analyzeBodyRound = (deps, input) => {
      const result = round(deps, input);
      if (result.kind !== "complete" || result.value.kind !== "ok" || result.value.value.kind !== "error") return result;
      const [emission] = result.value.emissions;
      assert.equal(emission.identity.kind, "host");
      detector = emission.identity.unit;
      const matches = result.value.value.causes.filter(cause => cause.kind === "unit"
        && cause.unit.position.kind === "execution-source-node"
        && cause.unit.position.execution === detector.position.execution
        && cause.unit.position.node.node === detector.position.node.node);
      repeatedGround ||= matches.length === 2;
      return result;
    };
    const refused = run(analysisInput(fixture, "sdk-minimal", source));
    assert.equal(refused.result.kind, "refused");
    assert.deepEqual(refused.result.diagnostics.map(row => [row.code.rendered, row.site.origin.start]),
      [["TSONIC_READ_BEFORE_INITIALIZATION", source.lastIndexOf("missing")]]);
    assert.ok(repeatedGround && detector !== null, "actual direct and absorbed recursive paths share one detector ground");
    const member = { request: detector.request, position: { kind: "execution-result", execution: detector.position.execution } };
    assert.deepEqual(refused.database.errorOf(member),
      { kind: "completed", error: { kind: "error", causes: [{ kind: "unit", unit: detector }] } });
  } finally {
    pipelineWiring.summaries.convergeComponent = converge;
    pipelineWiring.bodyAnalysis.analyzeBodyRound = round;
  }
});

for (const [count, source] of [
  [1, "export function value(input: boolean): boolean { return input; } export function read(input: boolean): boolean { return value(input); }"],
  [2, "export function add(a: number, b: number): number { return a + b; } export function read(a: number, b: number): number { return add(a, b); }"],
])
test(`real public Host analysis closes ${count} fixed by-value scalar call arguments through the selected mapping`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", source);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const caller = main.bodies.find(body => body.kind === "selected" && body.mir.blocks.some(block => block.terminator.kind === "call"));
  assert.equal(caller !== undefined, true);
  const call = caller.mir.blocks.find(block => block.terminator.kind === "call").terminator;
  assert.equal(call.callee.kind, "direct");
  assert.deepEqual(call.callee.resolution.decision.parameters, Array.from({ length: count }, (_, parameter) =>
    ({ kind: "argument", parameter, argument: parameter, component: null, passing: "by-value" })));
  assert.deepEqual(call.arguments.map(argument => [argument.kind, argument.passing]),
    Array.from({ length: count }, () => ["value", "by-value"]));
  assert.equal(result.value.index.dependencyInventory.dependencies.some(edge => edge.reason === "call"
    && edge.dependent.instance.body === caller.instance.body && edge.dependent.provided === count
    && edge.target.kind === "body" && edge.target.execution.instance.body === call.callee.resolution.activation.body
    && edge.target.execution.provided === count), true);
});

for (const [position, expression] of [["argument", "value(!input)"], ["result", "!value(input)"]])
test(`real public Host analysis composes native boolean negation with a scalar call ${position}`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    `export function value(input: boolean): boolean { return input; } export function read(input: boolean): boolean { return ${expression}; }\n`);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const caller = main.bodies.find(body => body.kind === "selected" && body.mir.blocks.some(block => block.terminator.kind === "call"));
  assert.notEqual(caller, undefined);
  const returned = caller.tir.root.statements.nodes[0].expression;
  assert.equal(returned.kind, position === "argument" ? "CallExpression" : "PrefixUnaryExpression");
  const unary = position === "argument" ? returned.arguments.nodes[0] : returned;
  assert.equal(unary.kind, "PrefixUnaryExpression");
  assert.equal(unary.operator, "ExclamationToken");
  const call = caller.mir.blocks.find(block => block.terminator.kind === "call").terminator;
  assert.equal(call.callee.kind, "direct");
  assert.deepEqual(call.callee.resolution.decision.parameters,
    [{ kind: "argument", parameter: 0, argument: 0, component: null, passing: "by-value" }]);
  assert.equal(caller.mir.blocks.flatMap(block => block.statements).filter(statement => statement.kind === "assign"
    && statement.value.kind === "unary" && statement.value.operation.decision.operation.kind === "native-operator"
    && statement.value.operation.decision.operation.operator === "!"
    && statement.value.operation.decision.operation.carrier === "bool").length, 1);
  assert.equal(result.value.index.dependencyInventory.dependencies.some(edge => edge.reason === "call"
    && edge.dependent.instance.body === caller.instance.body && edge.dependent.provided === 1
    && edge.target.kind === "body" && edge.target.execution.instance.body === call.callee.resolution.activation.body
    && edge.target.execution.provided === 1), true);
});

test("real public Host analysis closes a twelve-call dependency chain with every actual body and summary", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const links = 12;
  const declarations = ["export function value0(input: boolean): boolean { return input; }"];
  for (let index = 1; index <= links; index += 1)
    declarations.push(`export function value${index}(input: boolean): boolean { return value${index - 1}(input); }`);
  const input = analysisInput(fixture, "sdk-minimal", declarations.join("\n"));
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const selected = main.bodies.filter(body => body.kind === "selected");
  assert.equal(selected.length, links + 2);
  assert.equal(main.bodies.filter(body => body.kind === "template").length, links + 2);
  assert.equal(result.value.index.dependencyInventory.operations.length, links + 2);
  assert.equal(result.value.index.summaries.length, links + 2);
  assert.equal(result.value.index.dependencyInventory.dependencies.filter(edge => edge.reason === "call").length, links);
  assert.equal(selected.reduce((count, body) => count + body.mir.blocks.filter(block => block.terminator.kind === "call").length, 0), links);
  for (const body of selected) {
    assert.equal(body.facts.length, 1);
    assert.deepEqual(body.facts.map(facts => facts.execution.provided), [body.tir.params.length]);
    for (const block of body.mir.blocks) if (block.terminator.kind === "call") {
      const call = block.terminator;
      assert.equal(call.callee.kind, "direct");
      assert.equal(selected.some(target => target.instance.body === call.callee.resolution.activation.body), true);
    }
  }
});

test("real public Host analysis preserves every repeated callee occurrence across nested calls and branches", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function value(input: boolean): boolean { return input; }\n"
    + "export function choose(input: boolean): boolean { if (value(!input)) { return !value(input); } return value(value(input)); }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  assert.equal(main !== undefined, true);
  const selected = main.bodies.filter(body => body.kind === "selected");
  assert.equal(selected.length, 3);
  assert.equal(main.bodies.filter(body => body.kind === "template").length, 3);
  const caller = selected.find(body => body.mir.blocks.some(block => block.terminator.kind === "call"));
  assert.equal(caller !== undefined, true);
  const calls = caller.mir.blocks.filter(block => block.terminator.kind === "call").map(block => block.terminator);
  assert.equal(calls.length, 4);
  assert.equal(caller.mir.blocks.some(block => block.terminator.kind === "switch"), true);
  assert.equal(caller.mir.blocks.filter(block => block.terminator.kind === "return").length, 2);
  const targets = new Set();
  for (const call of calls) {
    assert.equal(call.callee.kind, "direct");
    targets.add(call.callee.resolution.activation.body);
    assert.equal(selected.some(body => body.instance.body === call.callee.resolution.activation.body), true);
    assert.deepEqual(call.callee.resolution.decision.parameters,
      [{ kind: "argument", parameter: 0, argument: 0, component: null, passing: "by-value" }]);
  }
  assert.equal(targets.size, 1, "four actual call occurrences share one completed callee operation");
  const inventory = result.value.index.dependencyInventory;
  const dependencies = inventory.dependencies.filter(edge => edge.reason === "call"
    && edge.dependent.instance.body === caller.instance.body);
  assert.equal(dependencies.length, 4);
  assert.equal(new Set(dependencies.map(edge => edge.at.node)).size, 4);
  assert.equal(dependencies.every(edge => edge.target.kind === "body"
    && targets.has(edge.target.execution.instance.body) && edge.target.execution.provided === 1), true);
  assert.equal(inventory.operations.length, 3);
  assert.equal(result.value.index.summaries.length, 3);
  assert.deepEqual(caller.facts.map(facts => facts.execution.provided), [1]);
});

test("authored native faults take their selected abort, handler and call-unwind continuations", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate, resumeEvaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export function remainder(left = 5, right = 2) { return left % right; }
    export function direct(left = 5, right = 2) { try { return left % right; } catch { return left; } }
    export function called(left = 5, right = 2) { try { return remainder(left, right); } catch { return left; } }
    export function bound(left = 5, right = 2) { try { return left % right; } catch (error) { return left; } }`);
  for (const law of ["abort", "unwind"]) {
    const nativeFacts = { ...input.snapshot.nativeFacts, remainderSign: [{ carrier: "int64", sign: "dividend" }],
      remainderByZero: [{ carrier: "int64", law }] };
    const result = analyzeHostProgram({ ...input, snapshot: { ...input.snapshot, nativeFacts } });
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { index, modules } = result.value;
    const selected = name => modules.flatMap(chapter => chapter.bodies).find(row => row.kind === "selected"
      && row.instance.body.includes(`;${name}];function;0]`));
    const remainder = selected("remainder");
    const direct = selected("direct");
    const called = selected("called");
    const bound = selected("bound");
    assert.ok(remainder && direct && called && bound);
    for (const body of [remainder, direct, called, bound]) {
      const summary = index.summaries.find(row => row.key.execution.instance.body === body.instance.body && row.key.execution.provided === 2);
      assert.ok(summary);
      assert.equal(summary.returns, true);
      assert.equal(summary.unwinds, law === "unwind" && body === remainder);
      assert.deepEqual(summary.arena.origins[summary.thrown].producers, []);
      const operationOwner = body === called ? remainder : body;
      const operation = operationOwner.mir.blocks.find(row => row.terminator.kind === "invoke").terminator;
      const arm = law === "abort" ? "abort" : operationOwner === remainder ? "escape" : "handler";
      assert.equal(operation.unwind.kind, arm);
      if (arm === "handler") assert.equal(operation.unwind.exception === null, body !== bound);
      const { types } = index;
      const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
        selectedNativeFacts: nativeFacts, limits: input.limits.evaluation };
      const type = body.mir.result;
      const number = numerator => ({ kind: "number", type, value: { numerator, denominator: 1n, negativeZero: false } });
      for (const divisor of [2n, 0n]) {
        let execution = evaluate(deps, body.instance, body.mir, [number(5n), number(divisor)], "compile-time",
          { query: "constValue", key: [body.instance, "compile-time"] });
        if (body === called) {
          assert.equal(execution.kind, "paused");
          assert.deepEqual(execution.requests, [{ kind: "mir-body", instance: remainder.instance }]);
          execution = resumeEvaluate(deps, execution.paused, [{ kind: "mir-body", body: remainder.mir }]);
        }
        assert.equal(execution.kind, "done");
        assert.equal(execution.value.kind, "ok");
        if (divisor !== 0n || law === "unwind" && (body === direct || body === called)) {
          assert.deepEqual(execution.value.value, { kind: "value", value: number(divisor === 0n ? 5n : 1n) });
          assert.deepEqual(execution.value.diagnostics, []);
        } else if (law === "unwind" && body === bound) {
          assert.deepEqual(execution.value.value, { kind: "not-constant", at: operation.tir, reason: "external-operation" });
          assert.deepEqual(execution.value.diagnostics, []);
        } else {
          assert.deepEqual(execution.value.value, { kind: "value", value: { kind: "error", type } });
          const [failure] = execution.value.diagnostics;
          assert.equal(execution.value.diagnostics.length, 1);
          assert.equal(failure.code.name, "TSONIC_CONSTANT_EVALUATION_FAILED");
          assert.match(failure.message, law === "abort" ? /process-ending integer remainder by zero/u : /integer remainder by zero escaped/u);
          assert.deepEqual(failure.site, { kind: "source", origin: operation.origin });
        }
      }
    }
  }
});

test("authored finally uses one cleanup graph while preserving the exact pending completion", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const { parseMir, printMir } = await import("../../packages/host/dist/ir-mir/index.js");
  const { accountFailure, createAccount, graphOfMir } = await import("../../packages/host/dist/dataflow/index.js");
  for (const [statements, expected, entryCount] of [
    ["try { return flag; } finally { flag = !flag; }", [false, true], 1],
    ["let result: boolean; try { if (flag) return true; result = flag; } finally { flag = !flag; } return result;", [false, true], 2],
    ["try { return flag; } finally { return !flag; }", [true, false], 1],
    ["try { try { throw flag; } catch { flag = !flag; } } finally { flag = !flag; } return flag;", [false, true], 1],
    ["try { try { throw flag; } finally { flag = !flag; } } catch { return flag; }", [true, false], 1],
    ["let result: boolean; result = false; outer: while (flag) { try { if (result) break outer; continue outer; } finally { result = !result; } } return result;",
      [false, false], 2],
  ]) {
    const input = analysisInput(fixture, "sdk-minimal", `export function run(flag: boolean): boolean { ${statements} }`);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", statements);
    const body = result.value.modules.flatMap(module => module.bodies)
      .find(row => row.kind === "selected" && row.instance.body.includes(";run];function;0]"));
    assert.ok(body, statements);
    const entries = body.mir.blocks.map(row => row.terminator).filter(row => row.kind === "cleanup-enter");
    assert.equal(entries.length, entryCount, statements);
    assert.equal(new Set(entries.map(row => row.entry)).size, 1, statements);
    if (entryCount === 2) assert.equal(new Set(entries.map(row => row.continuation)).size, 2, statements);
    const wire = parseMir(printMir(body.mir));
    assert.equal(wire.kind, "parsed", statements);
    assert.deepEqual(wire.value, body.mir, statements);
    const graph = graphOfMir(body.mir, createAccount(input.limits.dataflow));
    assert.equal(graph.kind, "complete", statements);
    const { blocks, entries: roots } = graph.value.qualification;
    assert.deepEqual(roots.map(root => blocks[root]), body.mir.entries.map(row => row.block), statements);
    const resume = body.mir.blocks.find(row => row.terminator.kind === "cleanup-resume");
    if (resume !== undefined) {
      const exits = blocks.flatMap((block, point) => block === resume.id
        ? graph.value.successors[point].map(target => blocks[target]) : []);
      assert.deepEqual(exits.toSorted((left, right) => left - right), entries.map(row => row.continuation).toSorted((left, right) => left - right), statements);
    }
    for (const dimension of ["maximumWork", "maximumResultEntries"]) {
      const limit = createAccount({ ...input.limits.dataflow, [dimension]: 0 });
      assert.equal(graphOfMir(body.mir, limit), accountFailure(limit), statements);
    }
    const { types } = result.value.index;
    const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
      selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
    for (const [index, flag] of [false, true].entries()) {
      const execution = evaluate(deps, body.instance, wire.value, [{ kind: "boolean", type: body.mir.result, value: flag }],
        "compile-time", { query: "constValue", key: [body.instance, "compile-time"] });
      assert.equal(execution.kind, "done", statements);
      assert.equal(execution.value.kind, "ok", statements);
      assert.deepEqual(execution.value.value, { kind: "value", value: { kind: "boolean", type: body.mir.result, value: expected[index] } }, statements);
      assert.deepEqual(execution.value.diagnostics, [], statements);
    }
  }
  const reading = analyzeHostProgram(analysisInput(fixture, "sdk-minimal",
    "export function run(flag: boolean): boolean { let result: boolean; try { if (flag) return true; result = flag; } finally { flag = result; } return result; }"));
  assert.equal(reading.kind, "refused");
  assert.deepEqual(reading.diagnostics.map(row => row.code.name), ["TSONIC_READ_BEFORE_INITIALIZATION"]);
});

test("authored finally does not lend the normal continuation's live stores to a returning predecessor", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export function run(flag: boolean): boolean {
      let observed: boolean;
      observed = flag;
      try {
        if (flag) { observed = !flag; return flag; }
      } finally { flag = !flag; }
      return observed;
    }`);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const selected = result.value.modules.flatMap(row => row.bodies)
    .find(row => row.kind === "selected" && row.instance.body.includes(";run];function;0]"));
  assert.ok(selected);
  const local = selected.tir.locals.find(row => row.name === "observed");
  const storage = selected.mir.locals.find(row => row.source?.local === local.id);
  const place = selected.mir.places.find(row => row.base.kind === "local" && row.base.local === storage.id);
  const stores = selected.facts[0].liveness.stores.filter(({ point }) => {
    if (point.statement === null) return false;
    const statement = selected.mir.blocks[point.block].statements[point.statement];
    return statement.kind === "assign" && statement.place === place.id;
  });
  assert.deepEqual(stores.map(row => row.observed), [true, false]);
});

test("authored finally preserves call-thrown origins but does not publish an overridden unwind", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate, resumeEvaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    function fail(value: string): string { throw value; }
    export function escapes(value: string, replacement: string): string {
      try { return fail(value); } finally { value = replacement; }
    }
    export function overrides(value: string, replacement: string): string {
      try { return fail(value); } finally { return replacement; }
    }`);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const selected = result.value.modules.flatMap(module => module.bodies).filter(row => row.kind === "selected");
  const named = name => selected.find(row => row.instance.body.includes(`;${name}];function;0]`));
  const failed = named("fail");
  assert.ok(failed);
  const { types } = result.value.index;
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  for (const [name, overrides] of [["escapes", false], ["overrides", true]]) {
    const body = named(name);
    assert.ok(body);
    const facts = body.facts[0];
    const summary = result.value.index.summaries.find(row => row.key.kind === "body"
      && fixture.types.executionKey(row.key.execution) === fixture.types.executionKey(facts.execution));
    assert.ok(summary);
    assert.equal(summary.unwinds, !overrides);
    assert.equal(summary.returns, overrides);
    const outcome = summary.arena.origins[overrides ? summary.result : summary.thrown];
    assert.equal(outcome.kind, "complete");
    assert.equal(outcome.producers.length, 1);
    const origin = summary.arena.boundProducers[outcome.producers[0]];
    assert.deepEqual(summary.arena.producers[origin.producer], { id: origin.producer, kind: "parameter", index: overrides ? 1 : 0, path: null });
    const type = body.mir.result;
    const paused = evaluate(deps, body.instance, body.mir, [{ kind: "string", type, value: "original" }, { kind: "string", type, value: "replacement" }],
      "compile-time", { query: "constValue", key: [body.instance, "compile-time"] });
    assert.equal(paused.kind, "paused");
    assert.deepEqual(paused.requests, [{ kind: "mir-body", instance: failed.instance }]);
    const evaluation = resumeEvaluate(deps, paused.paused, [{ kind: "mir-body", body: failed.mir }]);
    assert.equal(evaluation.kind, "done");
    assert.equal(evaluation.value.kind, "ok");
    assert.deepEqual(evaluation.value.value, { kind: "value",
      value: overrides ? { kind: "string", type, value: "replacement" } : { kind: "error", type } });
    assert.deepEqual(evaluation.value.diagnostics.map(row => row.site.origin),
      overrides ? [] : [failed.mir.blocks.find(block => block.terminator.kind === "throw").terminator.origin]);
  }
});

test("an authored unbound handler catches the actual call and ends only the exited lexical storage", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const result = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", `
    function fail(value: boolean): void { throw value; }
    export function recover(flag: boolean): boolean {
      try {
        let carried: boolean = flag;
        if (flag) fail(carried);
        return false;
      } catch { return true; }
    }
    export function nested(value: boolean): boolean {
      try { try { throw value; } catch { throw false; } }
      catch { return true; }
    }
    export function propagate(value: string): string {
      try { throw value; } catch (error) { throw error; }
    }`));
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const selected = name => modules.flatMap(chapter => chapter.bodies).find(row => row.kind === "selected"
    && row.instance.body.includes(`;${name}];function;0]`));
  const recover = selected("recover");
  const nested = selected("nested");
  const fail = selected("fail");
  assert.ok(recover && nested && fail);
  const summaryOf = row => index.summaries.find(summary => summary.key.execution.instance.body === row.instance.body);
  assert.deepEqual([recover, nested, fail].map(row => [summaryOf(row).returns, summaryOf(row).unwinds]),
    [[true, false], [true, false], [false, true]]);
  assert.equal(recover.mir.locals.some(local => local.role.kind === "exception"), false);
  const calls = recover.mir.blocks.filter(block => block.terminator.kind === "call");
  assert.equal(calls.length, 2);
  const lexical = recover.mir.locals.find(local => local.role.kind === "user");
  for (const { terminator } of calls) {
    assert.equal(terminator.unwind.kind, "handler");
    assert.equal(terminator.unwind.exception, null);
    const landing = recover.mir.blocks[terminator.unwind.target];
    assert.deepEqual(landing.statements.map(statement => [statement.kind, statement.local]), [["storage-dead", lexical.id]]);
    assert.equal(landing.terminator.kind, "goto");
  }
  const throws = nested.mir.blocks.filter(block => block.terminator.kind === "throw");
  assert.equal(throws.length, 2);
  assert.equal(new Set(throws.map(row => row.terminator.unwind.target)).size, 2, "a handler's throw targets its outer handler");
  const propagate = selected("propagate");
  const payload = propagate.tir.locals.find(local => local.role === "catch");
  const exception = propagate.mir.locals.find(local => local.role.kind === "exception");
  assert.deepEqual(exception.source, { body: propagate.tir.body, local: payload.id });
  assert.deepEqual(index.types.terms[exception.storage], { kind: "intrinsic", intrinsic: "unknown" });
  const propagation = propagate.mir.blocks.filter(block => block.terminator.kind === "throw").map(block => block.terminator);
  const [caught, escaping] = propagation;
  assert.equal(caught.unwind.kind, "handler");
  assert.equal(propagate.mir.places[caught.unwind.exception].base.local, exception.id);
  assert.deepEqual(escaping.operand, { kind: "place", place: caught.unwind.exception });
  assert.equal(escaping.unwind.kind, "escape");
  const summary = summaryOf(propagate);
  assert.equal(summary.unwinds, true);
  assert.equal(summary.thrown, summary.arena.contexts[0].arguments[0].origins);
  const uninitialized = analyzeHostProgram(analysisInput(fixture, "sdk-minimal",
    "export function recover(): boolean { try { let value: boolean; throw value; } catch { return true; } }"));
  assert.equal(uninitialized.kind, "refused");
  assert.deepEqual(uninitialized.diagnostics.map(row => row.code.name), ["TSONIC_READ_BEFORE_INITIALIZATION"]);
});

test("public argument calls execute left to right and never enter later operands after a throw", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate, resumeEvaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    function left(fails: boolean, value: string): string { if (fails) throw value; return value; }
    function right(fails: boolean, value: string): string { if (fails) throw value; return value; }
    function take(first: string, second: string): string { return second; }
    export function run(leftFails: boolean, rightFails: boolean, first: string, second: string): string {
      return take(left(leftFails, first), right(rightFails, second));
    }
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const callables = readyModuleStatements(readyModuleRoot(module.tree)).map(declaration => {
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    assert.ok(body);
    return body;
  });
  const [left, right, take, run] = callables;
  const deps = { types: index.types, typeOf: id => index.types.terms[id], signatureOf: id => index.types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  const edges = index.dependencyInventory.dependencies.filter(edge => edge.reason === "call"
    && edge.dependent.instance.body === run.instance.body);
  assert.equal(edges.length, 3);
  assert.deepEqual(new Set(edges.map(edge => edge.target.execution.instance.body)),
    new Set([left.instance.body, right.instance.body, take.instance.body]));
  for (const leftFails of [false, true]) for (const rightFails of [false, true]) {
    const failing = leftFails ? left : rightFails ? right : null;
    const values = [leftFails, rightFails, "left", "right"].map((value, position) =>
      ({ kind: typeof value, type: run.tir.params[position].tsonic.storage, value }));
    const invocations = failing === left ? [left] : failing === right ? [left, right] : [left, right, take];
    let step = evaluate(deps, run.instance, run.mir, values, "compile-time", { query: "constValue", key: [run.instance, "compile-time"] });
    for (const body of invocations) {
      assert.equal(step.kind, "paused");
      assert.deepEqual(step.requests, [{ kind: "mir-body", instance: body.instance }]);
      step = resumeEvaluate(deps, step.paused, [{ kind: "mir-body", body: body.mir }]);
    }
    assert.equal(step.kind, "done");
    assert.equal(step.value.kind, "ok");
    const outcome = failing === null ? { kind: "string", type: run.tir.completion, value: "right" }
      : { kind: "error", type: run.tir.completion };
    assert.deepEqual(step.value.value, { kind: "value", value: outcome });
    const expectedOrigins = failing === null ? [] : [failing.mir.blocks.find(block => block.terminator.kind === "throw").terminator.origin];
    assert.deepEqual(step.value.diagnostics.map(row => row.site.origin), expectedOrigins);
  }
});

test("real public Host analysis joins a named import to its actual selected callee in another loaded module", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  input.snapshot = fixture.projectSnapshot({
    sourceFiles: {
      "main.ts": "import { value } from './leaf.js'; export function read(input: boolean): boolean { return value(!input); }\n",
      "leaf.ts": "export function value(input: boolean): boolean { return input; }\n",
    },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
  });
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const leaf = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/leaf.ts"));
  assert.equal(main !== undefined && leaf !== undefined, true);
  const record = result.value.index.modules.find(module => module.module === main.module);
  assert.equal(record !== undefined, true);
  assert.equal(record.bindings.length, 1);
  const caller = main.bodies.find(body => body.kind === "selected" && body.mir.blocks.some(block => block.terminator.kind === "call"));
  assert.equal(caller !== undefined, true);
  const call = caller.mir.blocks.find(block => block.terminator.kind === "call").terminator;
  const name = caller.tir.root.statements.nodes[0].expression.expression;
  assert.equal(name.tsonic.resolution.kind, "definition");
  assert.deepEqual(name.tsonic.resolution.aliases, [record.bindings[0].occurrence]);
  assert.equal(call.callee.kind, "direct");
  assert.equal(leaf.bodies.some(body => body.kind === "selected" && body.instance.body === call.callee.resolution.activation.body), true);
  assert.equal(main.bodies.some(body => body.instance.body === call.callee.resolution.activation.body), false);
  const inventory = result.value.index.dependencyInventory;
  assert.equal(inventory.operations.length, 4);
  assert.equal(result.value.index.summaries.length, 4);
  const edges = inventory.dependencies.filter(edge => edge.reason === "call");
  assert.equal(edges.length, 1);
  assert.equal(edges[0].dependent.instance.body, caller.instance.body);
  assert.equal(edges[0].target.kind, "body");
  assert.equal(edges[0].target.execution.instance.body, call.callee.resolution.activation.body);
  assert.equal(edges[0].target.execution.provided, 1);
});

for (const reexport of [false, true])
test(`real public Host analysis preserves the actual ${reexport ? "three-module re-export" : "renamed import"} binding chain`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  const sourceFiles = reexport ? {
    "main.ts": "import { forwarded as renamed } from './relay.js'; export function read(input: boolean): boolean { return renamed(!input); }\n",
    "relay.ts": "export { value as forwarded } from './leaf.js';\n",
    "leaf.ts": "export function value(input: boolean): boolean { return input; }\n",
  } : {
    "main.ts": "import { value as renamed } from './leaf.js'; export function read(input: boolean): boolean { return renamed(!input); }\n",
    "leaf.ts": "export function value(input: boolean): boolean { return input; }\n",
  };
  input.snapshot = fixture.projectSnapshot({ sourceFiles,
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.source.input.packages.modules.length);
  const moduleOf = name => fixture.moduleOf(fixture.packageOf("/project"), `src/${name}.ts`);
  const main = result.value.modules.find(module => module.module === moduleOf("main"));
  const leaf = result.value.modules.find(module => module.module === moduleOf("leaf"));
  assert.equal(main !== undefined && leaf !== undefined, true);
  const mainRecord = result.value.index.modules.find(module => module.module === main.module);
  assert.equal(mainRecord !== undefined && mainRecord.bindings.length === 1, true);
  const aliases = [mainRecord.bindings[0].occurrence];
  if (reexport) {
    const relay = result.value.index.modules.find(module => module.module === moduleOf("relay"));
    assert.equal(relay !== undefined && relay.bindings.length === 1, true);
    aliases.push(relay.bindings[0].occurrence);
  }
  const caller = main.bodies.find(body => body.kind === "selected" && body.mir.blocks.some(block => block.terminator.kind === "call"));
  assert.equal(caller !== undefined, true);
  const name = caller.tir.root.statements.nodes[0].expression.expression;
  assert.equal(name.tsonic.resolution.kind, "definition");
  assert.deepEqual(name.tsonic.resolution.aliases, aliases);
  const call = caller.mir.blocks.find(block => block.terminator.kind === "call").terminator;
  assert.equal(call.callee.kind, "direct");
  assert.equal(leaf.bodies.some(body => body.kind === "selected" && body.instance.body === call.callee.resolution.activation.body), true);
  assert.equal(main.bodies.some(body => body.instance.body === call.callee.resolution.activation.body), false);
  const inventory = result.value.index.dependencyInventory;
  assert.equal(inventory.operations.length, reexport ? 5 : 4);
  assert.equal(result.value.index.summaries.length, inventory.operations.length);
  const edges = inventory.dependencies.filter(edge => edge.reason === "call");
  assert.equal(edges.length, 1);
  assert.equal(edges[0].dependent.instance.body, caller.instance.body);
  assert.equal(edges[0].target.kind, "body");
  assert.equal(edges[0].target.execution.instance.body, call.callee.resolution.activation.body);
  assert.equal(edges[0].target.execution.provided, 1);
});

for (const [syntax, aliasCount] of [
  ["import * as imported from './leaf.js'; export { imported as tools };", 2],
  ["export * as tools from './leaf.js';", 1],
]) test(`real public Host analysis preserves a ${aliasCount === 1 ? "direct" : "re-exported"} namespace as a module target`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { createModuleBindingViews, resolveModuleExport } = await import("../../packages/host/dist/ir-hir/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  const sourceFiles = {
    "main.ts": `${syntax} export function own(value: boolean): boolean { return !value; }`,
    "leaf.ts": "export function leaf(value: boolean): boolean { return value; }",
  };
  input.snapshot = fixture.projectSnapshot({ sourceFiles,
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const moduleOf = name => fixture.moduleOf(fixture.packageOf("/project"), `src/${name}.ts`);
  const modules = result.value.index.modules;
  assert.equal(modules.length, input.snapshot.source.input.packages.modules.length);
  const main = modules.find(module => module.module === moduleOf("main"));
  const entry = main.exports.find(candidate => candidate.name === "tools");
  assert.equal(entry.target.kind, "binding");
  const views = createModuleBindingViews(modules.map(module => module.bindings));
  const resolution = resolveModuleExport(views, entry);
  assert.deepEqual(resolution.target, { kind: "available", value: { kind: "module", module: moduleOf("leaf") } });
  assert.equal(resolution.aliases.length, aliasCount);
  assert.deepEqual(resolution.aliases[0], entry.target.occurrence);
  assert.equal(resolution.cycle, null);
  if (aliasCount === 1) {
    const occurrence = entry.target.occurrence;
    assert.equal(occurrence.kind, "item");
    assert.equal(main.items.some(item => item.definition === occurrence.value.owner && item.node === occurrence.value.node), true);
  }
  assert.equal(main.exports.find(candidate => candidate.name === "own").target.kind, "declarations");
});

test("real public Host analysis forwards star exports without forwarding the default", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  const sourceFiles = {
    "main.ts": `import onlyDefault from './leaf.js'; import { value } from './relay.js';
export function read(input: boolean): boolean { return value(!input); }
export function readDefault(input: boolean): boolean { return onlyDefault(!input); }`,
    "relay.ts": "export * from './leaf.js';",
    "leaf.ts": `export default function hidden(input: boolean): boolean { return !input; }
export function value(input: boolean): boolean { return input; }`,
  };
  input.snapshot = fixture.projectSnapshot({ sourceFiles,
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const moduleOf = name => fixture.moduleOf(fixture.packageOf("/project"), `src/${name}.ts`);
  const modules = result.value.index.modules;
  assert.equal(modules.length, input.snapshot.source.input.packages.modules.length);
  const leaf = modules.find(module => module.module === moduleOf("leaf"));
  const relay = modules.find(module => module.module === moduleOf("relay"));
  const main = result.value.modules.find(module => module.module === moduleOf("main"));
  assert.deepEqual(leaf.exports.map(entry => entry.name), ["default", "value"]);
  assert.deepEqual(relay.exports, leaf.exports.filter(entry => entry.name === "value"));
  const callers = modules.find(module => module.module === main.module).exports;
  for (const [entry, target] of [["read", "value"], ["readDefault", "default"]]) {
    const owner = callers.find(exported => exported.name === entry).target.definitions[0];
    const caller = main.bodies.find(body => body.kind === "selected" && body.tir.owner === owner);
    const calls = caller.mir.blocks.map(block => block.terminator).filter(terminator => terminator.kind === "call");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].callee.kind, "direct");
    assert.equal(calls[0].callee.resolution.decision.api.declaration,
      leaf.exports.find(exported => exported.name === target).target.definitions[0]);
  }
});

test("real public Host analysis calls a quoted export through its actual binding", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { createModuleBindingViews, resolveModuleExport } = await import("../../packages/host/dist/ir-hir/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  input.snapshot = fixture.projectSnapshot({ sourceFiles: {
    "main.ts": `import { "native-value" as selected } from './leaf.js';
export function read(input: boolean): boolean { return selected(!input); }`,
    "leaf.ts": `function value(input: boolean): boolean { return input; }
export { value as "native-value" };`,
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const program = analyzeHostProgram(input);
  assert.equal(program.kind, "ok");
  const indexed = program.value.index.modules;
  const leafId = fixture.moduleOf(fixture.packageOf("/project"), "src/leaf.ts");
  const leaf = indexed.find(module => module.module === leafId);
  const [entry] = leaf.exports;
  assert.equal(entry.name, "native-value");
  assert.equal(entry.target.kind, "binding");
  const resolution = resolveModuleExport(createModuleBindingViews(indexed.map(module => module.bindings)), entry);
  assert.equal(resolution.target.kind, "available");
  assert.equal(resolution.target.value.kind, "declarations");
  assert.deepEqual(resolution.aliases, [entry.target.occurrence]);
  const main = program.value.modules.find(module => module.module === input.snapshot.entryPoint);
  const caller = main.bodies.find(body => body.kind === "selected" && body.tir.root.kind === "Block");
  const call = caller.mir.blocks.find(block => block.terminator.kind === "call").terminator;
  assert.equal(call.callee.kind, "direct");
  assert.deepEqual(resolution.target.value.definitions, [call.callee.resolution.decision.api.declaration]);
  assert.equal(fixture.ids.decodeDefId(call.callee.resolution.decision.api.declaration).value.module, leafId);
});

test("real public Host analysis re-exports an imported type without inventing a callable endpoint", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { createModuleBindingViews, resolveModuleExport } = await import("../../packages/host/dist/ir-hir/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  input.snapshot = fixture.projectSnapshot({ sourceFiles: {
    "main.ts": `import type { Flag as ImportedFlag } from './leaf.js';
export type { ImportedFlag as PublicFlag };
export function read(value: ImportedFlag): ImportedFlag { return value; }`,
    "leaf.ts": "export type Flag = boolean;",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const program = analyzeHostProgram(input);
  assert.equal(program.kind, "ok");
  const { index, modules } = program.value;
  const main = index.modules.find(module => module.module === input.snapshot.entryPoint);
  const leafId = fixture.moduleOf(fixture.packageOf("/project"), "src/leaf.ts");
  const leaf = modules.find(module => module.module === leafId);
  const root = leaf.bodies.find(body => body.kind === "selected" && body.tir.root.kind === "SourceFile");
  const alias = readyModuleStatements(root.tir.root).find(node => node.kind === "TypeAliasDeclaration");
  const exported = main.exports.find(entry => entry.name === "PublicFlag");
  const resolved = resolveModuleExport(createModuleBindingViews(index.modules.map(module => module.bindings)), exported);
  assert.deepEqual(resolved.target, { kind: "available", value: { kind: "declarations", definitions: [alias.tsonic.definition] } });
  assert.equal(resolved.aliases.length, 2);
  assert.deepEqual(index.types.terms[alias.tsonic.type], { kind: "primitive", primitive: "bool" });
  assert.equal(leaf.bodies.filter(body => body.kind === "selected").length, 1);
  assert.equal(index.dependencyInventory.dependencies.some(edge => edge.reason === "call"), false);
});

test("checked and published export tables retain a transitive type-only star's actual occurrence", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { checkedSourceViews } = await import("../../packages/host/dist/pipeline/checked-inputs.js");
  const { parseHir, printHir } = await import("../../packages/host/dist/ir-hir/index.js");
  const { parseProgramIndex, printProgramIndex } = await import("../../packages/host/dist/ir-program/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  input.snapshot = fixture.projectSnapshot({ sourceFiles: {
    "main.ts": "export * from './types.js';",
    "types.ts": "export type * from './leaf.js';",
    "values.ts": "export * from './leaf.js';",
    "mixed.ts": "export type * from './leaf.js'; export * from './leaf.js';",
    "leaf.ts": "export function run(value: boolean): boolean { return value; }",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const checked = captureSourceBarrier(input);
  assert.equal(checked.kind, "ok");
  const moduleOf = name => fixture.moduleOf(fixture.packageOf("/project"), `src/${name}.ts`);
  const checkedOf = name => checked.value.modules.find(row => row.module.module === moduleOf(name)).module;
  const authored = checkedOf("types").tree.statements.nodes[0];
  assert.equal(authored.kind, "ExportDeclaration");
  assert.equal(authored.isTypeOnly, true);
  const [root] = checkedOf("main").exports;
  const views = checkedSourceViews(checked.value.modules);
  assert.notEqual(root.typeOnlyStar, null);
  assert.equal(views.nodeOf(root.typeOnlyStar) === authored, true);
  const [leaf] = checkedOf("leaf").exports;
  assert.deepEqual(root.target, leaf.target);
  assert.deepEqual(checkedOf("types").exports[0], root);
  for (const name of ["values", "mixed"]) assert.deepEqual(checkedOf(name).exports[0], leaf);
  const decoded = parseHir(printHir(checkedOf("main")));
  assert.equal(decoded.kind, "parsed");
  assert.deepEqual(decoded.value.exports, [root]);
  const actual = analyzeHostProgram(input);
  assert.equal(actual.kind, "ok");
  const index = parseProgramIndex(printProgramIndex(actual.value.index));
  assert.equal(index.kind, "parsed");
  assert.deepEqual(index.value.modules.find(row => row.module === input.snapshot.entryPoint).exports, [root]);
});

for (const selection of ["configured", "none", "named-type-only", "star-type-only", "alias-through-type-star", "star-through-type-alias"]) {
  test(`real external entry selection uses the target session and not inverse exports: ${selection}`, async () => {
    const fixture = await loadFrontFixture();
    const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
    const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
    const input = analysisInput(fixture, "sdk-minimal");
    const moduleOf = name => fixture.moduleOf(fixture.packageOf("/project"), `src/${name}.ts`);
    const main = moduleOf("main");
    const leaf = moduleOf("leaf");
    const externalEntries = selection === "configured" ? [{ module: main, name: "late" }, { module: main, name: "entry" }, { module: leaf, name: "run" }]
      : selection === "named-type-only" || selection === "alias-through-type-star" ? [{ module: main, name: "hidden" }]
      : selection === "star-through-type-alias" ? [{ module: moduleOf("again"), name: "hidden" }]
      : selection === "star-type-only" ? [{ module: moduleOf("types"), name: "later" }] : [];
    const aliasThroughStar = selection === "alias-through-type-star" || selection === "star-through-type-alias";
    input.snapshot = fixture.projectSnapshot({ sourceFiles: {
      "main.ts": "export { first as entry, next as late } from './relay.js';"
        + (aliasThroughStar ? " export { later as hidden } from './types.js';" : " export type { later as hidden } from './leaf.js';"),
      ...(selection === "star-through-type-alias" ? { "again.ts": "export * from './main.js';" } : {}),
      "relay.ts": "export { run as first, later as next } from './leaf.js';",
      "types.ts": "export type * from './leaf.js';",
      "leaf.ts": `export function run(value: boolean = false): boolean { return value; }
export function later(value: boolean): boolean { return value; }
export function unrequested(value: boolean): boolean { return value; }`,
    }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }], externalEntries });
    const initialize = pipelineWiring.bodyAnalysis.proveInitialization;
    const observed = [];
    let checks = 0;
    pipelineWiring.bodyAnalysis.proveInitialization = (deps, incoming) => {
      checks += 1;
      for (const execution of incoming.entries) {
        const body = fixture.ids.decodeBodyId(execution.instance.body);
        assert.equal(body.kind, "decoded");
        const declaration = fixture.ids.decodeDefId(body.value.owner);
        assert.equal(declaration.kind, "decoded");
        assert.equal(declaration.value.module, leaf);
        observed.push([declaration.value.segments.at(-1).name, execution.provided]);
      }
      return initialize(deps, incoming);
    };
    try {
      if (selection === "named-type-only" || selection === "star-type-only" || aliasThroughStar) {
        assert.throws(() => analyzeHostProgram(input), /A type-only export cannot expose a runtime entry/u);
        assert.equal(checks, 0);
      } else {
        const result = analyzeHostProgram(input);
        assert.equal(result.kind, "ok");
        assert.equal(checks, 1);
        assert.deepEqual(observed, selection === "configured" ? [["later", 1], ["run", 1], ["run", 0]] : []);
        const published = result.value.modules.find(row => row.module === leaf);
        assert.equal(published.bodies.some(row => row.tir.root.kind === "Block"
          && fixture.ids.decodeDefId(row.tir.owner).value.segments.at(-1).name === "unrequested"), true);
      }
    } finally { pipelineWiring.bodyAnalysis.proveInitialization = initialize; }
  });
}

test("analysis cannot publish empty observations over an unavailable checked identifier observation", async () => {
  const fixture = await loadFrontFixture();
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeTypedSource } = await import("../../packages/host/dist/pipeline/analysis-barrier.js");
  const input = analysisInput(fixture, "sdk-minimal", `
export function read(value: boolean): boolean { return value; }
export function readLater(value: boolean): boolean { return value; }`);
  const source = captureSourceBarrier(input);
  assert.equal(source.kind, "ok");
  const account = createAccount(input.limits.dataflow);
  const typed = typeSourceBarrier(input, source.value, account);
  assert.equal(typed.kind, "ok");
  const checked = source.value.modules.find(row => row.module.module === input.snapshot.entryPoint);
  const executionRoots = [...typed.value.bodies.values()].filter(body => body.bindings.kind === "instantiated"
    && body.root.kind === "Block" && body.root.origin.module === checked.module.module);
  assert.equal(executionRoots.length, 2);
  const [read, readLater] = executionRoots.map(body => checked.nodes[body.root.id].statements.nodes[0].expression);
  assert.equal(read.kind, "Identifier");
  assert.equal(read.tsonic.role, "value");
  assert.equal(readLater.kind, "Identifier");
  assert.equal(readLater.tsonic.role, "value");
  assert.deepEqual(read.tsonic.value.observation, { kind: "available", value: null });
  read.tsonic.value.observation = { kind: "unavailable", reason: "not-provided", causes: [] };
  Object.defineProperty(readLater.tsonic.value, "observation", {
    get() { assert.fail("an observation refusal must leave the following actual body unread"); },
  });
  assert.throws(() => analyzeTypedSource(input, typed.value, account),
    error => error.cause?.owner === "pipeline" && error.cause.message === "A selected execution cannot borrow unavailable observation capture.");
});

test("a cross-module omitted reference formal runs its actual placed default", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  const provider = fixture.moduleOf(fixture.packageOf("/project"), "src/provider.ts");
  input.snapshot = fixture.projectSnapshot({ sourceFiles: {
    "main.ts": "import {select} from './provider.js'; export function run(value: string): string | undefined { return select(value); }",
    "provider.ts": "export function select(fallback: string, value: string | undefined = fallback): string | undefined { return value; }",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const caller = result.value.modules.find(module => module.module === input.snapshot.entryPoint).bodies
    .find(body => body.kind === "selected" && body.tir.root.kind === "Block");
  const target = result.value.modules.find(module => module.module === provider).bodies
    .find(body => body.kind === "selected" && body.tir.params[1]?.initializer != null);
  assert.ok(caller);
  assert.ok(target);
  const signature = result.value.index.types.signatures[target.tir.signature];
  const initializer = result.value.modules.find(module => module.module === provider).bodies
    .find(body => body.kind === "selected" && body.instance.body === signature.parameters[1].initializer);
  assert.equal(initializer?.tir.root.kind, "Identifier");
  assert.equal(initializer.tir.root.text, "fallback");
  assert.equal(initializer.tir.root.origin.module, provider);
  const [facts] = caller.facts;
  const [invocation] = facts.origins.invocations;
  const [alternative] = invocation.alternatives;
  assert.deepEqual(alternative.summary, { kind: "body", execution: { instance: target.instance, provided: 1 } });
  assert.equal(alternative.arguments[1].kind, "omitted");
  const origin = facts.arena.origins[alternative.result];
  assert.equal(origin.includesAbsence, false);
  assert.equal(origin.producers.length, 1);
  const producer = facts.arena.producers[facts.arena.boundProducers[origin.producers[0]].producer];
  assert.equal(producer.kind, "parameter");
  assert.equal(producer.index, 0);
  assert.deepEqual(result.value.index.dependencyInventory.dependencies.filter(edge =>
    edge.dependent.instance.body === caller.instance.body && edge.reason === "initializer").map(edge => edge.target),
  [{ kind: "body", execution: { instance: initializer.instance, provided: 0 } }]);
});

test("module initialization publishes real static writes in runtime dependency order", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { programLookup } = await import("../../packages/host/dist/ir-program/program-values.js");
  const { summaryKey } = await import("../../packages/host/dist/ir-facts/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  input.snapshot = fixture.projectSnapshot({ sourceFiles: {
    "main.ts": "import './foundation.js'; export const current: boolean = true;",
    "foundation.ts": "export const previous: boolean = false;",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index } = result.value;
  const lookup = programLookup(index);
  const plan = index.initialization;
  assert.deepEqual(plan.modules.map(execution => {
    const body = fixture.ids.decodeBodyId(execution.instance.body).value;
    return fixture.ids.decodeDefId(body.owner).value.module;
  }), [fixture.moduleOf(fixture.packageOf("/project"), "src/foundation.ts"), input.snapshot.entryPoint]);
  for (const [position, name] of ["previous", "current"].entries()) {
    const summary = lookup.summaries.get(summaryKey({ kind: "body", execution: plan.modules[position] }));
    const [cell] = summary.arena.cells;
    assert.equal(cell.role.kind, "static");
    assert.equal(fixture.ids.decodeDefId(cell.role.declaration.definition).value.segments.at(-1).name, name);
    assert.equal(cell.occurrence.kind, "declared");
    assert.deepEqual(summary.initialization.cells, [cell.id]);
    assert.deepEqual(summary.initialization.points, [{ kind: "return" }]);
    assert.deepEqual(summary.initialization.rows, [
      { point: 0, cell: null, condition: 0 }, { point: 0, cell: 0, condition: 1 },
    ]);
    assert.deepEqual(summary.contentsOnReturn, [{ target: cell.id, value: 0 }]);
    assert.deepEqual(summary.contentsOnUnwind, []);
  }
});

test("cyclic module initialization proves the actual early call rather than rejecting the cycle", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  const moduleOf = name => fixture.moduleOf(fixture.packageOf("/project"), `src/${name}.ts`);
  const main = moduleOf("main");
  const provider = moduleOf("provider");
  const unused = moduleOf("unused");
  const importValue = "import { previous } from './provider.js';";
  const current = "current: boolean = previous";
  const entry = (value, imported = importValue, initializer = current) =>
    `${imported}\nexport function inspect(value: boolean): boolean { return ${value}; }\nexport const ${initializer};`;
  const previous = "previous: boolean = inspect(false)";
  const providerText = `import { inspect } from './main.js';\nexport interface Marker { readonly flag: boolean }\nexport const ${previous};`;
  const run = (mainText, other = {}) => analyzeHostProgram({ ...input, snapshot: fixture.projectSnapshot({
    sourceFiles: { "main.ts": mainText, "provider.ts": providerText, ...other },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
  }) });
  const assertPlan = (result, expected) => {
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    assert.deepEqual(result.value.index.initialization.modules.map(execution => {
      const body = fixture.ids.decodeBodyId(execution.instance.body).value;
      assert.equal(body.role, "module");
      assert.equal(execution.provided, 0);
      return fixture.ids.decodeDefId(body.owner).value.module;
    }), expected);
  };
  const safe = run(entry("value"), { "unused.ts": "export let unset: boolean; export const read: boolean = unset;" });
  assertPlan(safe, [provider, main]);
  assert.equal(safe.value.modules.some(module => module.module === unused), true);
  const typeOnly = run(entry("value", "import type { Marker } from './provider.js';", "current: boolean = false"));
  assertPlan(typeOnly, [main]);
  assert.equal(typeOnly.value.modules.some(module => module.module === provider), true);

  const unsafeEntry = entry("current");
  const refused = run(unsafeEntry);
  assert.equal(refused.kind, "refused");
  assert.equal(refused.diagnostics.length, 1);
  const [diagnostic] = refused.diagnostics;
  const site = (module, start, length) => ({ kind: "source", origin: { module, start, length, derived: [] } });
  assert.equal(diagnostic.code.name, "TSONIC_STATIC_READ_BEFORE_INITIALIZATION");
  assert.equal(diagnostic.source, "initialization");
  assert.deepEqual(diagnostic.site, site(main, unsafeEntry.indexOf("return current") + "return ".length, "current".length));
  assert.deepEqual(diagnostic.related.map(row => row.site), [
    site(provider, providerText.indexOf(previous), previous.length),
    site(provider, providerText.indexOf("inspect(false)"), "inspect(false)".length),
    site(main, unsafeEntry.indexOf(current), current.length),
  ]);
});

test("an authored module throw prevents the later module from executing without dropping it from Program", checkInterruptedModuleInitialization);

test("module branches preserve qualified lexical locals, hoisted storage and definite writes", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const prefix = "export const gate: boolean = true; export let out: boolean;";
  const suffix = "export const observed: boolean = out;";
  const thenArm = "{ let scratch: boolean = gate; var cached: boolean = scratch; out = cached; }";
  const elseArm = "{ const scratch: boolean = false; out = scratch; }";
  const source = `${prefix} if (gate) ${thenArm} else ${elseArm} ${suffix}`;
  const input = analysisInput(fixture, "sdk-minimal", source);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const main = input.snapshot.entryPoint;
  const body = result.value.modules.find(module => module.module === main).bodies
    .find(row => row.kind === "selected" && row.tir.root.kind === "SourceFile");
  const branch = readyModuleStatements(body.tir.root)[2];
  assert.equal(branch.kind, "IfStatement");
  const lexical = [branch.thenStatement, branch.elseStatement].map(arm => arm.statements.nodes[0].declarationList.declarations.nodes[0]);
  const [hoisted] = branch.thenStatement.statements.nodes[1].declarationList.declarations.nodes;
  const slots = lexical.map(declaration => declaration.tsonic.declaration);
  for (const [position, target] of slots.entries()) {
    assert.equal(target.kind, "local");
    assert.equal(target.local.body, body.instance.body);
    assert.equal(body.tir.locals[target.local.local].name, "scratch");
    assert.equal(body.tir.locals[target.local.local].mutable, position === 0);
  }
  assert.notEqual(slots[0].local.local, slots[1].local.local);
  const definition = hoisted.tsonic.declaration;
  assert.equal(definition.kind, "definition");
  const storage = body.mir.places.find(place => place.base.kind === "static" && place.base.definition === definition.definition);
  assert.ok(storage);
  const initialization = body.mir.blocks.map(block => block.terminator).find(terminator =>
    terminator.kind === "call" && terminator.destination === storage.id);
  assert.equal(initialization?.callee.kind, "body");
  assert.equal(initialization.callee.instance.body, hoisted.tsonic.initializer);
  assert.deepEqual(initialization.callee.captures.map(capture => capture.local), [slots[0].local]);
  const statements = body.mir.blocks.flatMap(block => block.statements);
  const active = body.mir.locals.filter(local => slots.some(({ local: sourceLocal }) =>
    local.source?.body === sourceLocal.body && local.source.local === sourceLocal.local));
  assert.equal(active.length, 2);
  for (const local of active) for (const kind of ["storage-live", "storage-dead"])
    assert.equal(statements.filter(statement => statement.kind === kind && statement.local === local.id).length, 1);

  const missing = `${prefix} if (gate) ${thenArm} ${suffix}`;
  const refused = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", missing));
  assert.equal(refused.kind, "refused");
  assert.equal(refused.diagnostics.length, 1);
  const [diagnostic] = refused.diagnostics;
  assert.equal(diagnostic.code.name, "TSONIC_STATIC_READ_BEFORE_INITIALIZATION");
  assert.deepEqual(diagnostic.site, { kind: "source", origin: { module: main, start: missing.lastIndexOf("out"), length: 3, derived: [] } });

  for (const resource of ["using", "await using"]) {
    const input = analysisInput(fixture, "sdk-minimal", `{ ${resource} handle = null; } export const okay: boolean = true;`);
    assert.throws(() => analyzeHostProgram(input), error => error instanceof Error
      && error.message === `front: checked annotation not implemented: ${resource} declaration`);
  }
  const ordinary = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", "{ let handle: null = null; } export const okay: boolean = true;"));
  assert.equal(ordinary.kind, "ok", JSON.stringify(ordinary.diagnostics));
});

test("authored module loops distinguish guaranteed writes from a zero-iteration body", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const prefix = "export let gate: boolean = false; export let state: boolean;";
  for (const [kind, loop, field, writes] of [
    ["WhileStatement", "while (gate) { state = true; gate = false; }", "state", false],
    ["DoStatement", "do { state = true; } while (gate);", "state", true],
    ["ForStatement", "for (; gate; gate = false) { state = true; }", "state", false],
    ["ForStatement", "for (state = true; gate; gate = false) { }", "state", true],
    ["ForStatement", "for (var seed: boolean = true; gate; gate = false) { }", "seed", true],
  ]) {
    const text = `${prefix} ${loop} export const observed: boolean = ${field};`;
    const input = analysisInput(fixture, "sdk-minimal", text);
    const result = analyzeHostProgram(input);
    const main = input.snapshot.entryPoint;
    if (!writes) {
      assert.equal(result.kind, "refused", loop);
      assert.equal(result.diagnostics.length, 1, loop);
      const [diagnostic] = result.diagnostics;
      assert.equal(diagnostic.code.name, "TSONIC_STATIC_READ_BEFORE_INITIALIZATION", loop);
      assert.deepEqual(diagnostic.site, { kind: "source", origin: { module: main, start: text.lastIndexOf(field), length: field.length, derived: [] } });
      continue;
    }
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const body = result.value.modules.find(module => module.module === main).bodies
      .find(row => row.kind === "selected" && row.tir.root.kind === "SourceFile");
    const statement = readyModuleStatements(body.tir.root)[2];
    assert.equal(statement.kind, kind);
    assert.equal(body.mir.blocks.some(block => block.terminator.kind === "switch" && block.terminator.tir.node === statement.id), true);
    if (field === "seed") {
      const [seed] = statement.initializer.declarations.nodes;
      assert.equal(seed.tsonic.declaration.kind, "definition");
      const place = body.mir.places.find(place => place.base.kind === "static" && place.base.definition === seed.tsonic.declaration.definition);
      assert.ok(place);
      assert.equal(body.mir.blocks.some(block => block.terminator.kind === "call" && block.terminator.destination === place.id
        && block.terminator.tir.node === seed.id && block.terminator.callee.kind === "body"
        && block.terminator.callee.instance.body === seed.tsonic.initializer), true);
    }
  }
});

test("a module label preserves its qualified transfer and follows the actual static write", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const prefix = "export let gate: boolean = false; export let state: boolean;";
  const suffix = "export const observed: boolean = state;";
  for (const [kind, labeled] of [
    ["BreakStatement", "outer: { state = true; if (gate) break outer; state = false; }"],
    ["ContinueStatement", "outer: do { state = true; if (gate) continue outer; state = false; } while (gate);"],
  ]) {
    const input = analysisInput(fixture, "sdk-minimal", `${prefix} ${labeled} ${suffix}`);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const body = result.value.modules.find(module => module.module === input.snapshot.entryPoint).bodies
      .find(row => row.kind === "selected" && row.tir.root.kind === "SourceFile");
    const label = readyModuleStatements(body.tir.root)[2];
    assert.equal(label.kind, "LabeledStatement");
    const block = label.statement.kind === "DoStatement" ? label.statement.statement : label.statement;
    const transfer = block.statements.nodes[1].thenStatement;
    assert.equal(transfer.kind, kind);
    assert.deepEqual(transfer.tsonic.target, { body: body.instance.body, node: label.id });
    assert.deepEqual(transfer.label.tsonic, { role: "label", target: transfer.tsonic.target });
    assert.equal(body.mir.blocks.some(row => row.terminator.kind === "goto" && row.terminator.tir.node === transfer.id), true);
  }
  const text = `${prefix} outer: { if (gate) break outer; state = false; } ${suffix}`;
  const input = analysisInput(fixture, "sdk-minimal", text);
  const refused = analyzeHostProgram(input);
  assert.equal(refused.kind, "refused");
  assert.equal(refused.diagnostics.length, 1);
  const [diagnostic] = refused.diagnostics;
  assert.equal(diagnostic.code.name, "TSONIC_STATIC_READ_BEFORE_INITIALIZATION");
  assert.deepEqual(diagnostic.site, { kind: "source", origin: {
    module: input.snapshot.entryPoint, start: text.lastIndexOf("state"), length: 5, derived: [],
  } });
});

test("switch clauses share lexical storage without initializing on bypass", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate, resumeEvaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const { instanceKey } = await import("../../packages/host/dist/ir-types/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export function capture(gate: boolean, seed: boolean): boolean {
      let result: boolean = seed;
      switch (gate) {
        case true: const held: boolean = !seed; result = held;
        case false: result = !result; break;
      }
      return result;
    }
    export function bypass(gate: boolean, seed: boolean): boolean {
      let result: boolean = seed;
      switch (gate) { case true: const held: boolean = !seed; result = held; }
      return result;
    }`);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const own = modules.find(module => module.module === input.snapshot.entryPoint);
  const selected = own.bodies.filter(body => body.kind === "selected");
  const callables = selected.filter(row => row.tir.root.kind === "Block");
  assert.equal(callables.length, 2);
  const byInstance = new Map(selected.map(body => [instanceKey(body.instance), body.mir]));
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  for (const body of callables) {
    const reviewedSwitch = body.tir.root.statements.nodes[1];
    assert.equal(reviewedSwitch.kind, "SwitchStatement");
    const lexical = reviewedSwitch.caseBlock.clauses.nodes[0].statements.nodes[0].declarationList.declarations.nodes[0];
    const reference = lexical.tsonic.declaration.local;
    const storage = body.mir.locals.find(local => local.source?.body === reference.body && local.source.local === reference.local);
    assert.ok(storage);
    const split = body.mir.blocks.find(block => block.terminator.kind === "switch" && block.terminator.tir.node === reviewedSwitch.id);
    assert.ok(split);
    assert.equal(split.statements.some(statement => statement.kind === "storage-live" && statement.local === storage.id), true);
    assert.equal(body.mir.blocks.flatMap(block => block.statements)
      .filter(statement => statement.kind === "storage-live" && statement.local === storage.id).length, 1);
    const name = fixture.ids.decodeDefId(body.tir.owner).value.segments.at(-1).name;
    const type = types.signatures[body.tir.signature].result;
    const valueOf = value => ({ kind: "boolean", type, value });
    const locals = body.tir.root.statements.nodes[0].declarationList.declarations.nodes;
    for (const gate of [false, true]) for (const seed of [false, true]) {
      let step = evaluate(deps, body.instance, body.mir, [valueOf(gate), valueOf(seed)], "compile-time",
        { query: "constValue", key: [body.instance, "compile-time"] });
      const invoked = [];
      while (step.kind === "paused") {
        const [request] = step.requests;
        assert.equal(step.requests.length, 1);
        assert.equal(request.kind, "mir-body");
        invoked.push(request.instance.body);
        const mir = byInstance.get(instanceKey(request.instance));
        assert.ok(mir);
        step = resumeEvaluate(deps, step.paused, [{ kind: "mir-body", body: mir }]);
      }
      assert.deepEqual(invoked, gate ? [locals[0].tsonic.initializer, lexical.tsonic.initializer] : [locals[0].tsonic.initializer]);
      assert.equal(step.kind, "done");
      assert.equal(step.value.kind, "ok");
      assert.deepEqual(step.value.value, { kind: "value", value: valueOf((name === "capture") === gate ? seed : !seed) });
    }
  }

  const read = "export function take(gate:boolean, seed:boolean):boolean { let result:boolean=seed; switch(gate){case true: const held:boolean=!seed; case false: result=held; break;} return result;}";
  const refused = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", read));
  assert.equal(refused.kind, "refused");
  assert.equal(refused.diagnostics.length, 1);
  assert.equal(refused.diagnostics[0].code.name, "TSONIC_READ_BEFORE_INITIALIZATION");
  assert.deepEqual(refused.diagnostics[0].site, { kind: "source", origin: {
    module: input.snapshot.entryPoint, start: read.indexOf("held; break"), length: "held".length, derived: [],
  } });

  const module = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", `
    export let gate: boolean = false; export let state: boolean;
    switch (gate) { case true: const held: boolean = gate; state = held; break; default: state = false; }
    export const observed: boolean = state;`));
  assert.equal(module.kind, "ok", JSON.stringify(module.diagnostics));
  const source = module.value.modules.find(row => row.module === input.snapshot.entryPoint).bodies
    .find(row => row.kind === "selected" && row.tir.root.kind === "SourceFile");
  const dispatch = readyModuleStatements(source.tir.root)[2];
  assert.equal(dispatch.kind, "SwitchStatement");
  const held = dispatch.caseBlock.clauses.nodes[0].statements.nodes[0].declarationList.declarations.nodes[0];
  assert.equal(held.tsonic.declaration.kind, "local");
  assert.equal(held.tsonic.declaration.local.body, source.instance.body);
});

test("lexical for initializers run in order and retain only their own scope across transfers", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { instanceKey } = await import("../../packages/host/dist/ir-types/index.js");
  const { evaluate, resumeEvaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export function count(limit = 1) {
      let cursor = 9;
      let kept = 0;
      outer: for (let cursor = 0, first = cursor; cursor < limit; ++cursor) {
        if (cursor === 1) continue outer;
        if (cursor === 3) break outer;
        kept = first + cursor;
      }
      return kept + cursor;
    }
    export function early(gate: boolean, fallback: boolean): boolean {
      for (const bound: boolean = !fallback; gate; ) { return bound; }
      return fallback;
    }
  `);
  const nativeFacts = { ...input.snapshot.nativeFacts, integerOverflow: ["add", "increment"]
    .map(operation => ({ carrier: "int64", operation, result: "int64", law: "wrap" })) };
  const result = analyzeHostProgram({ ...input, snapshot: { ...input.snapshot, nativeFacts } });
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const own = modules.find(row => row.module === input.snapshot.entryPoint);
  const selected = own.bodies.filter(row => row.kind === "selected");
  const byInstance = new Map(selected.map(row => [instanceKey(row.instance), row.mir]));
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: nativeFacts, limits: input.limits.evaluation };
  const run = (body, arguments_, expected, placed) => {
    let step = evaluate(deps, body.instance, body.mir, arguments_, "compile-time",
      { query: "constValue", key: [body.instance, "compile-time"] });
    const invoked = [];
    while (step.kind === "paused") {
      const [request] = step.requests;
      assert.equal(step.requests.length, 1);
      assert.equal(request.kind, "mir-body");
      invoked.push(request.instance.body);
      const mir = byInstance.get(instanceKey(request.instance));
      assert.ok(mir);
      step = resumeEvaluate(deps, step.paused, [{ kind: "mir-body", body: mir }]);
    }
    assert.deepEqual(invoked, placed);
    assert.equal(step.kind, "done");
    assert.equal(step.value.kind, "ok");
    assert.deepEqual(step.value.diagnostics, []);
    assert.deepEqual(step.value.value, { kind: "value", value: expected });
  };
  const [count, early] = readyModuleStatements(readyModuleRoot(own.tree)).map(declaration =>
    selected.find(row => row.instance.body === declaration.tsonic.signatures[0].body));
  const [cursorDeclaration, keptDeclaration, label, after] = count.tir.root.statements.nodes;
  const [outer] = cursorDeclaration.declarationList.declarations.nodes;
  const [kept] = keptDeclaration.declarationList.declarations.nodes;
  const loop = label.statement;
  assert.equal(loop.kind, "ForStatement");
  const [inner, first] = loop.initializer.declarations.nodes;
  assert.equal(inner.name.text, outer.name.text);
  assert.notDeepEqual(inner.tsonic.declaration, outer.tsonic.declaration);
  assert.deepEqual(after.expression.right.tsonic.resolution, outer.tsonic.declaration);
  const innerPlace = count.mir.locals.find(local => local.source?.local === inner.tsonic.declaration.local.local);
  assert.ok(innerPlace);
  const markers = count.mir.blocks.flatMap(block => block.statements.filter(statement => statement.local === innerPlace.id));
  assert.equal(markers.filter(statement => statement.kind === "storage-live").length, 1);
  assert.equal(markers.filter(statement => statement.kind === "storage-dead").length, 2,
    "the normal loop exit and the outward labelled break each end the slot");
  const continued = loop.statement.statements.nodes[0].thenStatement;
  assert.equal(markers.some(statement => statement.tir.node === continued.id), false, "continue keeps the header live");
  const number = numerator => ({ kind: "number", type: count.tir.completion, value: { numerator, denominator: 1n, negativeZero: false } });
  const placed = [outer, kept, inner, first].map(declaration => declaration.tsonic.initializer);
  for (const [limit, expected] of [[0n, 9n], [1n, 9n], [3n, 11n], [8n, 11n]]) run(count, [number(limit)], number(expected), placed);

  const [constLoop, returned] = early.tir.root.statements.nodes;
  const [bound] = constLoop.initializer.declarations.nodes;
  const boundSlot = early.mir.locals.find(local => local.source?.local === bound.tsonic.declaration.local.local);
  assert.ok(boundSlot);
  const earlyReturn = constLoop.statement.statements.nodes[0];
  const exits = early.mir.blocks.filter(block => block.terminator.kind === "return");
  const direct = exits.find(block => block.terminator.tir.node === earlyReturn.id);
  const normal = exits.find(block => block.terminator.tir.node === returned.id);
  assert.ok(direct && normal);
  assert.equal(direct.statements.some(statement => statement.kind === "storage-dead" && statement.local === boundSlot.id), false);
  assert.equal(normal.statements.filter(statement => statement.kind === "storage-dead" && statement.local === boundSlot.id).length, 1);
  const boolean = value => ({ kind: "boolean", type: early.tir.completion, value });
  for (const gate of [false, true]) for (const fallback of [false, true])
    run(early, [boolean(gate), boolean(fallback)], boolean(gate ? !fallback : fallback), [bound.tsonic.initializer]);

  const module = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", `
    export let gate: boolean = false;
    export let written: boolean;
    for (let gate: boolean = true; ; ) { written = gate; break; }
    export const observed: boolean = written;
  `));
  assert.equal(module.kind, "ok", JSON.stringify(module.diagnostics));
  const main = module.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const top = main.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "SourceFile");
  const header = readyModuleStatements(top.tir.root)[2].initializer.declarations.nodes[0];
  assert.equal(header.tsonic.declaration.kind, "local");
  assert.equal(header.tsonic.declaration.local.body, top.instance.body);
  const slot = top.mir.locals.find(local => local.source?.local === header.tsonic.declaration.local.local);
  assert.ok(slot);
  assert.equal(top.mir.blocks.flatMap(block => block.statements)
    .filter(statement => statement.kind === "storage-dead" && statement.local === slot.id).length, 1);

  const placedRead = "export function read(): boolean { for (let first: boolean, second: boolean = first; ; ) { return second; } }";
  const placedRefusal = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", placedRead));
  assert.equal(placedRefusal.kind, "refused");
  assert.deepEqual(placedRefusal.diagnostics.map(row => row.code.name), ["TSONIC_READ_BEFORE_INITIALIZATION"]);
  const directRead = "export function read(): boolean { for (let first: true; first; ) { break; } return true; }";
  const directRefusal = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", directRead));
  assert.equal(directRefusal.kind, "refused");
  const diagnostic = directRefusal.diagnostics.find(row => row.code.name === "TSONIC_READ_BEFORE_INITIALIZATION");
  assert.equal(diagnostic?.site.kind, "source");
  assert.equal(diagnostic.site.origin.start, directRead.lastIndexOf("first"), JSON.stringify(diagnostic));
});

test("native compound static assignment reads the selected cell before a same-cell RHS store", checkCompoundStaticAssignment);

test("direct static updates return the old or new native value and store only on success", checkStaticUpdates);

test("authored comma sequences preserve ordered effects and forward only the right value", checkCommaSequence);

test("selecting a known Boolean edge still proves the authored condition read", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  for (const [value, control] of [
    [true, "if (known) return flag; return false;"],
    [false, "while (known) { return false; } return flag;"],
    [true, "return known ? flag : flag;"],
  ]) {
    const source = `export function read(flag: boolean): boolean { let known: ${value}; ${control} }`;
    const input = analysisInput(fixture, "sdk-minimal", source);
    const refused = analyzeHostProgram(input);
    assert.equal(refused.kind, "refused", control);
    assert.equal(refused.diagnostics.length, 1);
    assert.equal(refused.diagnostics[0].code.name, "TSONIC_READ_BEFORE_INITIALIZATION");
    assert.deepEqual(refused.diagnostics[0].site, { kind: "source", origin: {
      module: input.snapshot.entryPoint, start: source.lastIndexOf("known"), length: "known".length, derived: [],
    } });
    const safe = source.replace(`known: ${value};`, `known: ${value} = ${value};`);
    const ready = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", safe));
    assert.equal(ready.kind, "ok", JSON.stringify(ready.diagnostics));
    const selected = ready.value.modules.find(module => module.module === input.snapshot.entryPoint).bodies
      .find(body => body.kind === "selected" && body.tir.root.kind === "Block");
    assert.equal(selected.mir.blocks.some(block => block.terminator.kind === "switch"), false);
    const local = selected.mir.locals.find(row => row.source?.local === 1 && row.source.body === selected.instance.body);
    assert.ok(local);
    const place = selected.mir.places.find(row => row.base.kind === "local" && row.base.local === local.id);
    const reads = selected.mir.blocks.flatMap(block => block.statements).filter(row => row.kind === "assign"
      && row.value.kind === "use" && row.value.operand.kind === "place" && row.value.operand.place === place.id);
    assert.equal(reads.length, 1);
    assert.equal(reads[0].origin.start, safe.lastIndexOf("known"));
  }
});

test("a target-selected static alias exposes only its initialized declaring module cell", checkSelectedStaticExposure);

test("a selected callable reads the actual initialized module static through its source binding", checkQualifiedStaticRead);

test("a plain assignment writes the exact module static selected at the authored target", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { verifyMir } = await import("../../packages/host/dist/ir-mir/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { instanceKey } = await import("../../packages/host/dist/ir-types/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const snapshot = body => fixture.projectSnapshot({
    sourceFiles: { "main.ts": "export let selected: boolean; export let other: boolean; "
      + `export function set(replacement: boolean): boolean { ${body} }` },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
    externalEntries: [{ module, name: "set" }],
  });
  const selected = { ...input, snapshot: snapshot("selected = replacement; other = replacement; return selected;") };
  const result = analyzeHostProgram(selected);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const [entry] = index.initialization.entries;
  const body = modules.find(row => row.module === module).bodies.find(row => row.kind === "selected" && row.instance.body === entry.instance.body);
  const [first, second, returned] = body.tir.root.statements.nodes;
  const assignment = first.expression;
  const destination = assignment.left.tsonic.resolution;
  assert.equal(destination.kind, "static");
  assert.equal(assignment.left.tsonic.access.kind, "write");
  assert.equal(assignment.tsonic.calculation, null);
  assert.deepEqual(returned.expression.tsonic.resolution, destination);
  const store = body.mir.blocks.flatMap(block => block.statements).find(statement => statement.tir.node === assignment.id);
  assert.equal(store.kind, "assign");
  assert.deepEqual(body.mir.places[store.place].base, { kind: "static", definition: destination.declaration.owner });
  const other = body.mir.places.find(place => place.base.kind === "static" && place.base.definition === second.expression.left.tsonic.resolution.declaration.owner);
  assert.equal(other.storage, body.mir.places[store.place].storage);
  const summary = index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === body.instance.body);
  assert.equal(summary.initialization.points.some(point => point.kind === "need"), false);
  assert.deepEqual(summary.contentsOnReturn.map(write => summary.arena.cells[write.target].role.declaration.definition).sort(),
    [destination.declaration.owner, other.base.definition].sort());

  const captured = captureSourceBarrier(selected);
  assert.equal(captured.kind, "ok");
  const typed = typeSourceBarrier(selected, captured.value, createTypedAccount(selected));
  assert.equal(typed.kind, "ok");
  const context = { selectedNativeFacts: selected.snapshot.nativeFacts, source: body.tir, types: index.types,
    requiredEntries: typed.value.required.provided.get(instanceKey(body.instance)),
    limits: selected.limits.mirVerification, declarationOf: typed.value.declarationOf,
    bodyOwner: identity => fixture.ids.decodeBodyId(identity).value.owner,
    bodyOf: instance => typed.value.bodies.get(instanceKey(instance)) ?? null };
  for (const write of [{ ...store, place: other.id }, { ...store, place: store.value.operand.place }]) {
    const crossed = { ...body.mir, blocks: body.mir.blocks.map(block => ({ ...block,
      statements: block.statements.map(statement => statement === store ? write : statement) })) };
    const outcome = verifyMir(crossed, context);
    assert.equal(outcome.kind, "complete");
    assert.equal(outcome.violations.some(issue => issue.rule === "static-write-exact"), true);
  }
  const refused = analyzeHostProgram({ ...input, snapshot: snapshot("other = replacement; return selected;") });
  assert.equal(refused.kind, "refused");
  assert.equal(refused.diagnostics.some(diagnostic => diagnostic.code.name === "TSONIC_STATIC_READ_BEFORE_INITIALIZATION"), true,
    "A write to another static of the same type does not initialize this declaration");
});

test("authored parenthesized storage targets retain their actual leaf and native effects", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const cases = [
    ["plain", "left: boolean, right: boolean", ": boolean", "((left)) = right", [false, true], true, "write"],
    ["calculated", "left = 1, right = 1", "", "((left)) ^= (left = right)", [7n, 2n], 5n, "read-write"],
    ["literal", "left = 1", "", "((left)) += 2", [7n], 9n, "read-write"],
    ["conditional", "left: boolean, right: boolean", ": boolean", "((left)) ||= (right = !right)", [false, true], false, "read-write"],
    ["prefix", "left = 1", "", "++((left))", [7n], 8n, "read-write"],
    ["postfix", "left = 1", "", "((left))++", [7n], 7n, "read-write"],
  ];
  const source = cases.map(([name, params, returns, expression]) =>
    `export function ${name}(${params})${returns} { return ${expression}; }`).join("\n");
  const input = analysisInput(fixture, "sdk-minimal", source);
  const nativeFacts = { ...input.snapshot.nativeFacts, integerOverflow: ["add", "increment"].map(operation =>
    ({ carrier: "int64", operation, result: "int64", law: "wrap" })) };
  const result = analyzeHostProgram({ ...input, snapshot: { ...input.snapshot, nativeFacts } });
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  assert.equal(readyModuleStatements(readyModuleRoot(module.tree)).length, cases.length);
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: nativeFacts, limits: input.limits.evaluation };
  for (const [index, declaration] of readyModuleStatements(readyModuleRoot(module.tree)).entries()) {
    const [name, , , , args, expected, access] = cases[index];
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    const expression = body.tir.root.statements.nodes[0].expression;
    const outer = expression.kind === "BinaryExpression" ? expression.left : expression.operand;
    const inner = outer.expression;
    const leaf = inner.expression;
    assert.deepEqual([outer.kind, inner.kind, leaf.kind], ["ParenthesizedExpression", "ParenthesizedExpression", "Identifier"], name);
    for (const wrapper of [outer, inner]) {
      assert.deepEqual(wrapper.tsonic.conversion, { kind: "identity" }, name);
      assert.equal(wrapper.tsonic.narrowing, null, name);
      assert.equal(wrapper.tsonic.convertedType, leaf.tsonic.access.storage, name);
    }
    assert.equal(source.slice(outer.origin.start, outer.origin.start + outer.origin.length), "((left))", name);
    assert.equal(leaf.tsonic.role, "assignment-target", name);
    assert.equal(leaf.tsonic.access.kind, access, name);
    const local = body.mir.locals.find(row => row.role.kind === "parameter" && row.role.index === 0).id;
    const statements = body.mir.blocks.flatMap(block => block.statements);
    assert.equal(statements.some(row => row.tir.node === outer.id || row.tir.node === inner.id), false, name);
    assert.equal(statements.filter(row => row.kind === "assign" && row.tir.node === expression.id
      && body.mir.places[row.place].base.local === local).length, 1, name);
    const type = body.tir.completion;
    const payload = value => typeof value === "bigint"
      ? { kind: "number", type, value: { numerator: value, denominator: 1n, negativeZero: false } }
      : { kind: "boolean", type, value };
    const run = evaluate(deps, body.instance, body.mir, args.map(payload), "compile-time",
      { query: "constValue", key: [body.instance, "compile-time"] });
    assert.equal(run.kind, "done", name);
    assert.equal(run.value.kind, "ok", name);
    assert.deepEqual(run.value.value, { kind: "value", value: payload(expected) }, name);
  }
});

test("wrapped static targets use the qualified definition and reject crossed MIR stores", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { verifyMir } = await import("../../packages/host/dist/ir-mir/index.js");
  const { instanceKey } = await import("../../packages/host/dist/ir-types/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export let state = 1;
    export function set(next = 1) { return ((state)) = next; }
    export function combine(next = 1) { return ((state)) ^= (state = next); }
    export function increment() { return ((state))++; }
  `);
  const nativeFacts = { ...input.snapshot.nativeFacts,
    integerOverflow: [{ carrier: "int64", operation: "increment", result: "int64", law: "abort" }] };
  const selected = { ...input, snapshot: { ...input.snapshot, nativeFacts } };
  const result = analyzeHostProgram(selected);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [state, ...declarations] = readyModuleStatements(readyModuleRoot(module.tree));
  const definition = state.declarationList.declarations.nodes[0].tsonic.declaration.definition;
  const checked = captureSourceBarrier(selected);
  assert.equal(checked.kind, "ok");
  const typed = typeSourceBarrier(selected, checked.value, createTypedAccount(selected));
  assert.equal(typed.kind, "ok");
  const [plain, compound, postfix] = declarations.map(node =>
    module.bodies.find(row => row.kind === "selected" && row.instance.body === node.tsonic.signatures[0].body));
  for (const [position, body] of [plain, compound, postfix].entries()) {
    const expression = body.tir.root.statements.nodes[0].expression;
    const outer = expression.kind === "BinaryExpression" ? expression.left : expression.operand;
    const leaf = outer.expression.expression;
    assert.equal(leaf.tsonic.resolution.declaration.owner, definition);
    const entry = body.mir.blocks[body.mir.entries.find(row => row.provided === body.tir.params.length).block];
    if (position === 2) {
      assert.equal(entry.terminator.kind, "invoke");
      assert.deepEqual(entry.terminator.unwind, { kind: "abort" });
    }
    const written = position === 2 ? body.mir.blocks[entry.terminator.next] : entry;
    const store = written.statements.find(row => row.tir.node === expression.id && row.kind === "assign"
      && body.mir.places[row.place].base.kind === "static");
    assert.ok(store, `qualified store for wrapped static operation ${position}`);
    assert.deepEqual(body.mir.places[store.place].base, { kind: "static", definition });
    assert.equal(store.value.operand.kind, "place");
    const context = { selectedNativeFacts: nativeFacts, source: body.tir, types: index.types, limits: input.limits.mirVerification,
      requiredEntries: typed.value.required.provided.get(instanceKey(body.instance)),
      declarationOf: typed.value.declarationOf, bodyOwner: identity => fixture.ids.decodeBodyId(identity).value.owner,
      bodyOf: instance => typed.value.bodies.get(instanceKey(instance)) ?? null };
    const crossed = { ...body.mir, blocks: body.mir.blocks.map(block => ({ ...block,
      statements: block.statements.map(row => row === store ? { ...row, place: store.value.operand.place } : row) })) };
    const rejected = verifyMir(crossed, context);
    assert.equal(rejected.kind, "complete");
    assert.equal(rejected.violations.some(row => row.rule === "static-write-exact"), true);
  }
});

test("an authored module assignment stays in source order before a separately placed initializer", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const prefix = "export let state: boolean; export let other: boolean; ";
  const read = "export const observed: boolean = state;";
  const run = source => analyzeHostProgram(analysisInput(fixture, "sdk-minimal", prefix + source));
  for (const wrapped of [false, true]) {
    const positive = run((wrapped ? "void (state = true); " : "state = true; ") + read);
    assert.equal(positive.kind, "ok", JSON.stringify(positive.diagnostics));
    const entry = positive.value.index.initialization.modules.at(-1);
    const module = positive.value.modules.flatMap(row => row.bodies)
      .find(row => row.kind === "selected" && row.instance.body === entry.instance.body);
    const expression = readyModuleStatements(module.tir.root)[2].expression;
    assert.equal(expression.kind, wrapped ? "VoidExpression" : "BinaryExpression");
    const assignment = wrapped ? expression.expression.expression : expression;
    assert.equal(assignment.tsonic.role, "assignment");
    const statements = module.mir.blocks.flatMap(row => row.statements);
    const stores = statements.filter(row => row.kind === "assign" && row.tir.node === assignment.id);
    assert.equal(stores.length, 1);
    const definition = assignment.left.tsonic.resolution.declaration.owner;
    assert.deepEqual(module.mir.places[stores[0].place].base, { kind: "static", definition });
    if (wrapped) assert.equal(statements.some(row => row.kind === "assign" && row.tir.node === expression.id), false);
    const block = module.mir.blocks.find(row => row.statements.includes(stores[0]));
    assert.equal(block.terminator.kind, "call");
    assert.equal(block.terminator.callee.kind, "body");
    assert.notEqual(block.terminator.callee.instance.body, module.instance.body);
  }
  for (const source of ["other = true; " + read, "void (other = true); " + read, read + " state = true;"]) {
    const refused = run(source);
    assert.equal(refused.kind, "refused");
    const original = refused.diagnostics.find(diagnostic => diagnostic.code.name === "TSONIC_STATIC_READ_BEFORE_INITIALIZATION");
    assert.ok(original);
    assert.equal(original.site.origin.start, prefix.length + source.indexOf(read) + read.indexOf("state"));
  }
});

test("inferred static storage keeps its finalized initializer type for direct and imported accesses", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { verifyTir: verifyTirOperation } = await import("../../packages/host/dist/ir-tir/index.js");
  const verifyTir = await tirFixtureBodyVerifier(verifyTirOperation);
  const input = analysisInput(fixture, "sdk-minimal");
  const moduleOf = name => fixture.moduleOf(fixture.packageOf("/project"), `src/${name}.ts`);
  const declarationText = "function seed(next: boolean): boolean { return next; } export let state = seed(true); ";
  for (const fromImport of [false, true]) {
    const snapshot = fixture.projectSnapshot({
      sourceFiles: fromImport ? {
        "provider.ts": declarationText + "export function put(next: boolean): boolean { state = next; return next; }",
        "main.ts": "import { state as renamed, put } from './provider.js'; export const started = put(false); "
          + "export function read(): boolean { return renamed; }",
      } : { "main.ts": declarationText + "state = false; export function read(): boolean { return state; }" },
      libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
      externalEntries: [{ module: moduleOf("main"), name: "read" }],
    });
    const selected = { ...input, snapshot };
    const result = analyzeHostProgram(selected);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const [entry] = result.value.index.initialization.entries;
    assert.ok(entry);
    const module = result.value.modules.find(row => row.module === moduleOf("main"));
    const reader = module.bodies.find(row => row.kind === "selected" && row.instance.body === entry.instance.body);
    const read = reader.tir.root.statements.nodes[0].expression;
    assert.equal(read.tsonic.resolution.kind, "static");
    const { declaration, aliases } = read.tsonic.resolution;
    assert.equal(aliases.length > 0, fromImport);
    assert.equal(fixture.ids.decodeDefId(declaration.owner).value.module, moduleOf(fromImport ? "provider" : "main"));
    assert.ok(reader.mir.places.some(place => place.base.kind === "static" && place.base.definition === declaration.owner));
    const ownerModule = result.value.modules.find(row => row.module === moduleOf(fromImport ? "provider" : "main"));
    assert.ok(ownerModule.bodies.some(body => body.kind === "selected" && body.mir.blocks.some(block =>
      block.statements.some(statement => statement.kind === "assign" &&
        body.mir.places[statement.place].base.kind === "static" &&
        body.mir.places[statement.place].base.definition === declaration.owner))));

    const captured = captureSourceBarrier(selected);
    assert.equal(captured.kind, "ok");
    const typed = typeSourceBarrier(selected, captured.value, createTypedAccount(selected));
    assert.equal(typed.kind, "ok");
    const verifier = typed.value.verifierOf(moduleOf("main"));
    const checked = verifier.nodeOf({ kind: "item", value: declaration });
    assert.equal(checked.type, null);
    assert.deepEqual(checked.tsonic.declaredType, { kind: "available", value: null });
    const storage = typed.value.staticStorageOf(declaration);
    assert.deepEqual(fixture.types.readType(typed.value.source.types, storage), { kind: "primitive", primitive: "bool" });
    assert.equal(typed.value.staticStorageOf({ ...declaration, owner: fixture.ids.decodeBodyId(reader.instance.body).value.owner }), null);
    const typedReader = verifier.bodyOf(reader.instance);
    assert.deepEqual(verifyTir(verifier, typedReader), []);
    assert.equal(verifyTir({ ...verifier, staticStorageOf: () => null }, typedReader)
      .some(issue => issue.rule === "static-reference-exact"), true);
  }
});

test("a fresh inferred Boolean static accepts the opposite value without widening its const neighbor", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  for (const initializer of ["true", "(true)"]) {
    const input = analysisInput(fixture, "sdk-minimal",
      `export let state = ${initializer}; export const exact = true; state = false; export const observed: boolean = state;`);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok");
    const typed = typeSourceBarrier(input, captured.value, createTypedAccount(input));
    assert.equal(typed.kind, "ok");
    const module = typed.value.modules.get(input.snapshot.entryPoint);
    const [mutable, constant, assignment] = readyModuleStatements(readyModuleRoot(module.tree));
    const storage = entry => fixture.types.readType(typed.value.source.types, entry.declarationList.declarations.nodes[0].tsonic.storage);
    assert.deepEqual(storage(mutable), { kind: "primitive", primitive: "bool" });
    assert.deepEqual(storage(constant).value, { kind: "boolean", value: true });
    assert.equal(assignment.expression.tsonic.role, "assignment");
    const source = typed.value.verifierOf(input.snapshot.entryPoint).source;
    const [checkedLet, checkedConst] = source.tree.statements.nodes;
    for (const [checked, typedEntry] of [[checkedLet, mutable], [checkedConst, constant]]) {
      const { tsonic } = checked.declarationList.declarations.nodes[0];
      assert.deepEqual(tsonic.declaredType, { kind: "available", value: null });
      assert.deepEqual(tsonic.inferredTypeBound, { kind: "available", value: typedEntry.declarationList.declarations.nodes[0].tsonic.storage });
    }
  }
  const local = analyzeHostProgram(analysisInput(fixture, "sdk-minimal",
    "export function read(): boolean { let state = true; state = false; return state; }"));
  assert.equal(local.kind, "ok", JSON.stringify(local.diagnostics));
  const selected = local.value.modules.flatMap(module => module.bodies)
    .find(body => body.kind === "selected" && body.tir.root.kind === "Block");
  assert.ok(selected);
  const [declaration, assignment, returned] = selected.tir.root.statements.nodes;
  assert.deepEqual(local.value.index.types.terms[declaration.declarationList.declarations.nodes[0].tsonic.storage],
    { kind: "primitive", primitive: "bool" });
  assert.equal(assignment.expression.left.tsonic.resolution.kind, "local");
  assert.deepEqual(returned.expression.tsonic.resolution, assignment.expression.left.tsonic.resolution);
});

test("unannotated integral initializers select native int64 before materializing the exact MIR literal", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export const wide = 9_007_199_254_740_993; export const hexadecimal = (0x20_0000_0000_0001); "
      + "export const maximum = 9_223_372_036_854_775_807; "
      + "export function initialized(): boolean { const local = 0b1; return true; }");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const selected = module.bodies.filter(row => row.kind === "selected");
  const root = selected.find(row => row.tir.root.kind === "SourceFile");
  const int64 = { kind: "primitive", primitive: "int64" };
  const local = selected.find(row => row.tir.root.kind === "Block");
  for (const [owner, statement, expected, token] of [
    [root, 0, 9007199254740993n, "9_007_199_254_740_993"],
    [root, 1, 9007199254740993n, "0x20_0000_0000_0001"],
    [root, 2, 9223372036854775807n, "9_223_372_036_854_775_807"],
    [local, 0, 1n, "0b1"],
  ]) {
    const statements = owner === local ? owner.tir.root.statements.nodes : readyModuleStatements(owner.tir.root);
    const declaration = statements[statement].declarationList.declarations.nodes[0];
    assert.equal(declaration.type, null);
    const { storage, initializer } = declaration.tsonic;
    assert.deepEqual(index.types.terms[storage], int64);
    const body = selected.find(row => row.instance.body === initializer);
    const literal = body.tir.root.kind === "ParenthesizedExpression" ? body.tir.root.expression : body.tir.root;
    assert.equal(literal.text, token);
    assert.equal(literal.tsonic.type, storage);
    assert.deepEqual(literal.tsonic.conversion, { kind: "identity" });
    assert.equal(body.tir.completion, storage);
    assert.ok(body.mir.constants.some(constant => constant.type === storage && constant.value.kind === "literal"
      && constant.value.value.kind === "number" && constant.value.value.token === token
      && constant.value.value.value.numerator === expected && constant.value.value.value.denominator === 1n));
    assert.equal(body.mir.constants.some(constant => index.types.terms[constant.type]?.primitive === "float64"), false);
    assert.equal(body.mir.blocks.some(block => block.statements.some(statement =>
      statement.kind === "assign" && statement.value.kind === "convert")), false);
  }
});

test("WT-10 retains the counted range, exact call invalidation and both kinds of explicit checks", async () => {
  const fixture = await loadFrontFixture();
  const { nativeInt32Input } = await import("./fixtures/native-int32-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  for (const [replace, work, records] of [[false, 115332, 20011], [true, 116231, 20272]]) {
    const input = await nativeInt32Input(fixture, `
      function pure(): void {}
      function clear(p: { x: { v: Native } | null }): void { p.x = null; }
      export function read(o: { x: { v: Native } | null }, a: Native[], replacement: Native[]): Native {
        let sum = 0;
        for (let i = 0; i < a.length; i++) { ${replace ? "a = replacement;" : ""} sum += a[i]; }
        if (o.x !== null) { pure(); sum += o.x.v; clear(o); sum += o.x.v; }
        return sum;
      }
    `, true);
    const native = input.snapshot.nativeFacts;
    const prepared = { ...input, snapshot: { ...input.snapshot, nativeFacts: { ...native, integerOverflow: [
      { carrier: "int32", operation: "add", result: "int32", law: "wrap" },
      { carrier: "int64", operation: "add", result: "int64", law: "wrap" },
      { carrier: "int64", operation: "increment", result: "int64", law: "wrap" },
    ] } } };
    const result = analyzeHostProgram(prepared);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { index, modules } = result.value;
    const chapter = modules.find(row => row.module === input.snapshot.entryPoint);
    const selected = chapter.bodies.find(row => row.kind === "selected" && row.instance.body.includes(";read];function;0]"));
    const [declaration, loop, guard] = selected.tir.root.statements.nodes;
    const sum = declaration.declarationList.declarations.nodes[0];
    assert.equal(sum.type, null);
    assert.deepEqual(index.types.terms[sum.tsonic.storage], { kind: "primitive", primitive: "int32" });
    const facts = selected.facts.find(row => row.execution.provided === 3);
    const checks = selected.mir.blocks.map(row => row.terminator).filter(row => row.kind === "check");
    const indexCheck = checks.find(row => selected.mir.places[row.place].base.projection.kind === "index");
    const fieldChecks = checks.filter(row => selected.mir.places[row.place].base.projection.kind === "refined");
    assert.equal(checks.length, 3);
    assert.equal(fieldChecks.length, 2);
    const measured = facts.refinements.countedLoops.find(row => row.statement === loop.id);
    const indexProof = facts.refinements.refinements.find(row => row.node === indexCheck.tir.node);
    if (replace) assert.equal(indexProof, undefined);
    else {
      assert.equal(indexProof.kind, "proven");
      assert.ok(measured);
    }
    const clear = selected.mir.blocks.map(row => row.terminator).find(row => row.kind === "call"
      && row.callee.kind === "direct" && row.callee.resolution.decision.api.declaration.includes(";clear]"));
    assert.ok(clear);
    assert.deepEqual(fieldChecks.map(check => facts.refinements.refinements.find(row => row.node === check.tir.node)), [
      { kind: "proven", node: fieldChecks[0].tir.node, guards: [guard.expression.id] },
      { kind: "unproven", node: fieldChecks[1].tir.node, guards: [guard.expression.id],
        reason: { kind: "invalidated", sites: [{ kind: "call", at: clear.tir }] } },
    ]);
    const bounded = (maximumWork, maximumResultEntries) => analyzeHostProgram({ ...prepared, limits: { ...prepared.limits,
      dataflow: { maximumWork, maximumResultEntries },
    } });
    assert.equal(bounded(work, records).kind, "ok");
    for (const [limit, maximumWork, maximumResultEntries, maximum] of [
      ["work", work - 1, records, work - 1],
      ["result-entries", work, records - 1, records - 1],
    ]) {
      const refused = bounded(maximumWork, maximumResultEntries);
      assert.equal(refused.kind, "refused");
      assert.equal("value" in refused, false);
      assert.deepEqual(refused.diagnostics.map(row => [row.source, row.code.rendered, row.site, row.arguments]), [
        ["pipeline", "TSONIC_COMPILER_RESOURCE_LIMIT", { kind: "none" },
          [{ kind: "text", value: limit }, { kind: "number", value: maximum }]],
      ]);
    }
  }
});

test("the actual selected compound writes infer one exact native storage carrier before literal defaulting", async () => {
  const fixture = await loadFrontFixture();
  const { nativeInt32Input } = await import("./fixtures/native-int32-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const analyze = async source => {
    const input = await nativeInt32Input(fixture, source, true);
    const native = input.snapshot.nativeFacts;
    return { entry: input.snapshot.entryPoint, result: analyzeHostProgram({ ...input, snapshot: { ...input.snapshot,
      nativeFacts: { ...native, integerOverflow: [
        { carrier: "int32", operation: "add", result: "int32", law: "wrap" },
        { carrier: "int64", operation: "add", result: "int64", law: "wrap" },
        { carrier: "int64", operation: "increment", result: "int64", law: "wrap" },
      ] },
    } }) };
  };
  for (const [carrier, source] of [
    ["int32", `function pure(): void {} export function read(o: { x: { v: Native } | null }, a: Native[]): Native {
      let sum = 0;
      for (let i = 0; i < a.length; i++) sum += a[i];
      if (o.x !== null) { pure(); sum += o.x.v; }
      return sum;
    }`],
    ["int32", "export function read(value: Native): Native { let sum = (0); sum += sum; sum += sum + value; sum += value; return sum; }"],
    ["int32", `export function read(value: Native): Native {
      let first = 0; let second = 0;
      first += second; second += first; first += value;
      return second;
    }`],
    ["float64", `export function read(): number {
      let first = 0; let second = 0; let upstream = 0.5;
      upstream += upstream; first += second; second += first; first += upstream;
      return second;
    }`],
    ["int64", "export function read(): void { let sum = 0; sum += sum; sum += sum + sum; }"],
  ]) {
    const { entry, result } = await analyze(source);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const chapter = result.value.modules.find(row => row.module === entry);
    const selected = chapter.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "Block"
      && row.tir.root.statements.nodes[0]?.kind === "VariableStatement");
    const declaration = selected.tir.root.statements.nodes[0].declarationList.declarations.nodes[0];
    assert.equal(declaration.type, null);
    const { storage, initializer } = declaration.tsonic;
    assert.deepEqual(result.value.index.types.terms[storage], { kind: "primitive", primitive: carrier });
    for (const statement of selected.tir.root.statements.nodes) {
      if (statement.kind !== "VariableStatement") continue;
      for (const local of statement.declarationList.declarations.nodes) assert.equal(local.tsonic.storage, storage);
    }
    const placed = chapter.bodies.find(row => row.kind === "selected" && row.instance.body === initializer);
    assert.equal(placed.tir.completion, storage);
    assert.ok(placed.mir.constants.some(row => row.type === storage && row.value.kind === "literal"
      && row.value.value.kind === "number" && row.value.value.value.numerator === 0n));
    const compounds = selected.mir.blocks.flatMap(row => row.statements).filter(row => row.kind === "assign" && row.value.kind === "binary"
      && row.value.operation.decision.kind === "selected" && row.value.operation.decision.operation.kind === "native-operator"
      && row.value.operation.decision.operation.operator === "+");
    assert.ok(compounds.length >= 2);
    for (const row of compounds) {
      assert.equal(row.value.operation.decision.operation.carrier, carrier);
      assert.deepEqual(row.value.operation.decision.operands, [storage, storage]);
      assert.equal(row.value.operation.decision.result, storage);
    }
    if (selected.tir.params.length === 2) {
      const facts = selected.facts.find(row => row.execution.provided === 2);
      assert.equal(facts.refinements.countedLoops.length, 1);
      const checks = selected.mir.blocks.map(row => row.terminator).filter(row => row.kind === "check");
      assert.deepEqual(checks.map(row => selected.mir.places[row.place].base.projection.kind), ["index", "refined"]);
      assert.deepEqual(facts.refinements.refinements.map(row => [row.kind, row.node]),
        checks.map(row => ["proven", row.tir.node]));
    }
  }
  for (const [source, expected] of [
    ["export function read(value: Native): void { let sum = 0; let wide = 0; sum += value; sum += wide; }",
      "TSONIC_NATIVE_STORAGE_CARRIER_CONFLICT"],
    ["export function read(value: Native): Native { let sum = 2147483648; sum += value; return sum; }",
      "TSONIC_NATIVE_STORAGE_LITERAL_INEXACT"],
  ]) {
    const { result } = await analyze(source);
    assert.equal(result.kind, "refused");
    assert.equal(result.diagnostics.length, 1);
    assert.equal(result.diagnostics[0].code.name, expected);
  }
});

test("numeric assignment fits the authored literal into finalized native static and local storage", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export let state = 9_007_199_254_740_993; "
    + "state = ((9_007_199_254_740_995)); export const observed = state; "
    + "export function mutate(): boolean { let local = 0b1; local = 0x20_0000_0000_0001; return true; }");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const bodies = module.bodies.filter(row => row.kind === "selected");
  for (const [kind, token, expected, rootKind] of [["SourceFile", "9_007_199_254_740_995", 9007199254740995n, "static"],
    ["Block", "0x20_0000_0000_0001", 9007199254740993n, "local"]]) {
    const body = bodies.find(row => row.tir.root.kind === kind);
    const statements = kind === "SourceFile" ? readyModuleStatements(body.tir.root) : body.tir.root.statements.nodes;
    const tree = statements[1].expression;
    const storage = tree.left.tsonic.access.storage;
    assert.equal(tree.tsonic.storage, storage);
    assert.deepEqual(index.types.terms[storage], { kind: "primitive", primitive: "int64" });
    let literal = tree.right;
    while (literal.kind === "ParenthesizedExpression") literal = literal.expression;
    assert.equal(literal.text, token);
    assert.equal(literal.tsonic.type, storage);
    assert.deepEqual(literal.tsonic.conversion, { kind: "identity" });
    const writes = body.mir.blocks.flatMap(block => block.statements.filter(statement => statement.kind === "assign"
      && statement.origin.start === tree.origin.start && statement.origin.length === tree.origin.length));
    assert.equal(writes.length, 1);
    const [write] = writes;
    assert.equal(body.mir.places[write.place].base.kind, rootKind);
    assert.equal(write.value.kind, "use");
    assert.equal(write.value.operand.kind, "constant");
    const constant = body.mir.constants[write.value.operand.constant];
    assert.equal(constant.type, storage);
    assert.deepEqual(constant.value, { kind: "literal", value: {
      kind: "number", token, value: { numerator: expected, denominator: 1n, negativeZero: false },
    } });
    assert.equal(body.mir.constants.some(constant => index.types.terms[constant.type]?.primitive === "float64"), false);
  }
  for (const literal of ["9_223_372_036_854_775_808", "1.5"]) {
    assert.throws(() => analyzeHostProgram(analysisInput(fixture, "sdk-minimal", `export let value = 1; value = ${literal};`)),
      /an authored literal that does not fit its selected native destination/);
  }
});

test("a callable with an inferred return publishes its actual placed int64 signature without replacing the checked endpoint", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "const wide = 9_007_199_254_740_993; export function read() { return wide; }");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const declaration = readyModuleStatements(readyModuleRoot(module.tree))[1];
  const [checked] = declaration.tsonic.signatures;
  const selected = module.bodies.find(row => row.kind === "selected" && row.instance.body === checked.body);
  const placed = index.signatures.find(row => row.kind === "api-body" && row.bindings.kind === "instantiated" && row.body === checked.body);
  assert.equal(checked.declaration, declaration.tsonic.definition);
  assert.equal(checked.role, "api-body");
  assert.equal(placed.signature, selected.tir.signature);
  assert.notEqual(placed.signature, checked.signature);
  assert.equal(index.types.signatures[checked.signature].declaration, checked.declaration);
  const native = index.types.signatures[placed.signature];
  assert.equal(native.declaration, checked.declaration);
  assert.equal(native.result, selected.tir.completion);
  assert.deepEqual(index.types.terms[native.result], { kind: "primitive", primitive: "int64" });
  assert.equal(selected.tir.root.statements.nodes[0].expression.tsonic.type, native.result);
  assert.equal(selected.mir.blocks.some(block => block.statements.some(statement =>
    statement.kind === "assign" && statement.value.kind === "convert")), false);
});

test("a direct call consumes an inferred native result through the original checked callable endpoint", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { verifyTir: verifyTirOperation } = await import("../../packages/host/dist/ir-tir/index.js");
  const verifyTir = await tirFixtureBodyVerifier(verifyTirOperation);
  const input = analysisInput(fixture, "sdk-minimal", "const wide = 9_007_199_254_740_993; "
    + "export function read() { return wide; } export const observed = read();");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [, declaration, observed] = readyModuleStatements(readyModuleRoot(module.tree));
  const [checked] = declaration.tsonic.signatures;
  const initializer = observed.declarationList.declarations.nodes[0].tsonic;
  const bodies = module.bodies.filter(row => row.kind === "selected");
  const caller = bodies.find(row => row.instance.body === initializer.initializer);
  const called = bodies.find(row => row.instance.body === checked.body);
  const application = caller.tir.root.tsonic.application;
  assert.equal(application.kind, "decided");
  const { callee } = application.decision;
  assert.deepEqual(callee.decision.advertised, checked);
  assert.deepEqual(callee.decision.api, checked);
  assert.deepEqual(callee.activation, called.instance);
  assert.equal(callee.decision.completion.signature, called.tir.signature);
  assert.notEqual(callee.decision.completion.signature, checked.signature);
  const selected = index.types.signatures[callee.decision.completion.signature];
  assert.equal(selected.result, initializer.storage);
  assert.equal(callee.decision.completion.completion, selected.result);
  assert.deepEqual(index.types.terms[selected.result], { kind: "primitive", primitive: "int64" });
  const invocation = caller.mir.blocks.map(block => block.terminator).find(terminator => terminator.kind === "call");
  assert.equal(invocation.callee.kind, "direct");
  assert.deepEqual(invocation.callee.resolution, callee);
  assert.equal(caller.mir.blocks.some(block => block.statements.some(statement =>
    statement.kind === "assign" && statement.value.kind === "convert")), false);

  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const typed = typeSourceBarrier(input, captured.value, createTypedAccount(input));
  assert.equal(typed.kind, "ok");
  const verifier = typed.value.verifierOf(module.module);
  const activation = verifier.bodyOf(caller.instance);
  const decision = activation.root.tsonic.application.decision.callee.decision;
  const queries = [];
  const observedVerifier = { ...verifier, bodyOf: instance => { queries.push(instance); return verifier.bodyOf(instance); } };
  assert.deepEqual(verifyTir(observedVerifier, activation), []);
  assert.deepEqual(queries, [called.instance]);

  const ready = decision.completion.signature;
  decision.completion.signature = decision.api.signature;
  assert.equal(verifyTir(verifier, activation).filter(issue => issue.rule === "completion-endpoint").length, 1);
  decision.completion.signature = ready;
  const unrelated = verifyTir({ ...verifier, bodyOf: () => activation }, activation);
  assert.equal(unrelated.some(issue => issue.rule === "nested-instance-key"), true);
  assert.equal(unrelated.some(issue => issue.rule === "completion-endpoint"), false);
  const bindings = decision.implementationBindings;
  decision.implementationBindings = { ...bindings, methodBindings: [{ kind: "rigid", parameter: checked.declaration }] };
  const crossed = verifyTir({ ...verifier, bodyOf: () => assert.fail("crossed implementation bindings cannot read an instance") }, activation);
  assert.equal(crossed.some(issue => issue.rule === "call-endpoints" && issue.detail[0].value.includes("implementation bindings")), true);
  decision.implementationBindings = bindings;
});

test("calls use the actual native inferred argument or the separately placed inferred default", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "const wide = 9_007_199_254_740_993; "
    + "export function read(value = wide) { return value; } export const viaDefault = read(); export const supplied = read(wide);");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [wide, read, viaDefault, supplied] = readyModuleStatements(readyModuleRoot(module.tree));
  const bodies = module.bodies.filter(row => row.kind === "selected");
  const storage = wide.declarationList.declarations.nodes[0].tsonic.storage;
  const called = bodies.find(row => row.instance.body === read.tsonic.signatures[0].body);
  const [formal] = index.types.signatures[called.tir.signature].parameters;
  assert.deepEqual(index.types.terms[storage], { kind: "primitive", primitive: "int64" });
  assert.equal(formal.type, storage);
  assert.deepEqual(called.mir.entries.map(row => row.provided), [1, 0]);
  for (const [declaration, provided] of [[viaDefault, 0], [supplied, 1]]) {
    const selected = declaration.declarationList.declarations.nodes[0].tsonic;
    assert.equal(selected.storage, storage);
    const caller = bodies.find(row => row.instance.body === selected.initializer);
    const application = caller.tir.root.tsonic.application.decision;
    assert.deepEqual(application.callee.activation, called.instance);
    const [argument] = application.arguments;
    const terminator = caller.mir.blocks.map(block => block.terminator).find(row => row.kind === "call");
    if (provided === 0) {
      assert.equal(argument.kind, "omitted");
      assert.equal(argument.value.kind, "initializer");
      assert.equal(argument.value.instance.body, formal.initializer);
      assert.deepEqual(terminator.arguments, [{ kind: "omitted" }]);
    } else {
      const [value] = caller.tir.root.arguments.nodes;
      assert.deepEqual(argument, { kind: "provided", parameter: 0, expression: value.id });
      assert.equal(value.tsonic.type, storage);
      assert.deepEqual(value.tsonic.conversion, { kind: "identity" });
      assert.equal(terminator.arguments[0].kind, "value");
    }
  }
});

test("an inferred return materializes its own authored integer before publishing a caller", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function read() { return ((9_007_199_254_740_993)); } export const observed = read();");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [declaration, observed] = readyModuleStatements(readyModuleRoot(module.tree));
  const selected = module.bodies.filter(row => row.kind === "selected");
  const callee = selected.find(row => row.instance.body === declaration.tsonic.signatures[0].body);
  const caller = selected.find(row => row.instance.body === observed.declarationList.declarations.nodes[0].tsonic.initializer);
  const type = callee.tir.completion;
  assert.deepEqual(index.types.terms[type], { kind: "primitive", primitive: "int64" });
  assert.equal(index.types.signatures[callee.tir.signature].result, type);
  assert.equal(caller.tir.completion, type);
  assert.deepEqual(caller.tir.root.tsonic.application.decision.callee.activation, callee.instance);
  const literal = callee.tir.root.statements.nodes[0].expression.expression.expression;
  assert.equal(literal.tsonic.type, type);
  assert.deepEqual(literal.tsonic.conversion, { kind: "identity" });
  assert.ok(callee.mir.constants.some(constant => constant.type === type && constant.value.kind === "literal"
    && constant.value.value.kind === "number" && constant.value.value.token === "9_007_199_254_740_993"
    && constant.value.value.value.numerator === 9007199254740993n && constant.value.value.value.denominator === 1n));
  assert.equal(callee.mir.constants.some(constant => index.types.terms[constant.type]?.primitive === "float64"), false);
});

test("an omitted inferred parameter runs its own exact native integer initializer", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function read(value = (0x20_0000_0000_0001)) { return value; } export const omitted = read();");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [declaration, omitted] = readyModuleStatements(readyModuleRoot(module.tree));
  const selected = module.bodies.filter(row => row.kind === "selected");
  const callee = selected.find(row => row.instance.body === declaration.tsonic.signatures[0].body);
  const caller = selected.find(row => row.instance.body === omitted.declarationList.declarations.nodes[0].tsonic.initializer);
  const [formal] = index.types.signatures[callee.tir.signature].parameters;
  const [argument] = caller.tir.root.tsonic.application.decision.arguments;
  assert.equal(argument.kind, "omitted");
  assert.equal(argument.value.kind, "initializer");
  const initializer = selected.find(row => row.instance.body === formal.initializer);
  assert.deepEqual(argument.value.instance, initializer.instance);
  assert.deepEqual(index.types.terms[formal.type], { kind: "primitive", primitive: "int64" });
  assert.equal(initializer.tir.completion, formal.type);
  assert.equal(callee.tir.completion, formal.type);
  assert.equal(caller.tir.completion, formal.type);
  assert.deepEqual(initializer.tir.root.expression.tsonic.conversion, { kind: "identity" });
  assert.ok(initializer.mir.constants.some(constant => constant.type === formal.type && constant.value.kind === "literal"
    && constant.value.value.kind === "number" && constant.value.value.token === "0x20_0000_0000_0001"
    && constant.value.value.value.numerator === 9007199254740993n && constant.value.value.value.denominator === 1n));
  assert.equal(initializer.mir.constants.some(constant => index.types.terms[constant.type]?.primitive === "float64"), false);
});

test("authored native int64 addition publishes an exact wrapping operation and evaluates without rounding", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function add(left = 9_223_372_036_854_775_807, right = 1) { return left + right; } export const sum = add();");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [declaration] = readyModuleStatements(readyModuleRoot(module.tree));
  const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
  const type = body.tir.completion;
  const row = body.mir.blocks.flatMap(block => block.statements).find(statement => statement.kind === "assign" && statement.value.kind === "binary");
  const decision = row.value.operation.decision;
  assert.deepEqual(index.types.terms[type], { kind: "primitive", primitive: "int64" });
  assert.deepEqual(decision, { kind: "selected", operation: { kind: "native-operator", operator: "+", carrier: "int64" },
    operands: [type, type], result: type, execution: { kind: "pure" } });
  assert.equal(body.mir.blocks.some(block => block.terminator.kind === "invoke"), false);
  const args = [9223372036854775807n, 1n].map(numerator =>
    ({ kind: "number", type, value: { numerator, denominator: 1n, negativeZero: false } }));
  const types = index.types;
  const evaluated = evaluate({ types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation }, body.instance, body.mir, args,
  "compile-time", { query: "constValue", key: [body.instance, "compile-time"] });
  assert.equal(evaluated.kind, "done");
  assert.equal(evaluated.value.kind, "ok");
  assert.deepEqual(evaluated.value.value, { kind: "value", value: { kind: "number", type,
    value: { numerator: -9223372036854775808n, denominator: 1n, negativeZero: false } } });
});

test("process-ending native addition initializes its result only on the normal edge", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const analyze = source => {
    const input = analysisInput(fixture, "sdk-minimal", source);
    const snapshot = { ...input.snapshot, nativeFacts: { ...input.snapshot.nativeFacts,
      integerOverflow: [{ carrier: "int64", operation: "add", result: "int64", law: "abort" }] } };
    return { result: analyzeHostProgram({ ...input, snapshot }), input: { ...input, snapshot } };
  };
  const { result, input } = analyze("export function add(left = 1, right = 2) { return left + right; } export const sum = add();");
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [declaration] = readyModuleStatements(readyModuleRoot(module.tree));
  const selected = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
  const block = selected.mir.blocks.find(row => row.terminator.kind === "invoke");
  const invoke = block.terminator;
  const type = selected.tir.completion;
  const returned = selected.mir.blocks[invoke.next].terminator;
  assert.deepEqual(invoke.unwind, { kind: "abort" });
  assert.deepEqual(invoke.operation.decision.execution, { kind: "invocation", writesStorage: false, failure: "abort" });
  assert.equal(returned.kind, "return");
  assert.deepEqual(returned.value, { kind: "place", place: invoke.destination });
  const facts = selected.facts.find(row => row.execution.provided === 2);
  const summary = index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === selected.instance.body
    && row.key.execution.provided === 2);
  const expression = selected.tir.root.statements.nodes[0].expression;
  for (const [operand, source] of [[invoke.operands[0], expression.left], [invoke.operands[1], expression.right]]) {
    assert.equal(operand.kind, "place");
    assert.ok(facts.initialization.reads.some(row => row.node === source.id && row.place === operand.place && row.assigned));
    assert.ok(facts.origins.reads.some(row => row.node === source.id && row.place === operand.place));
  }
  assert.ok(facts.initialization.reads.some(row => row.place === invoke.destination && row.assigned));
  const writes = facts.origins.writes.filter(row => row.node === expression.id);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].point, { block: block.id, statement: null });
  assert.deepEqual(facts.arena.origins[writes[0].values[0].origins], { id: writes[0].values[0].origins, kind: "complete",
    producers: [], includesAbsence: false });
  assert.equal(summary.returns, true);
  assert.equal(summary.unwinds, false);
  assert.deepEqual(summary.contentsOnUnwind, []);
  assert.equal(summary.initialization.points.some(point => point.kind === "unwind"), false);
  assert.equal(facts.origins.invocations.some(row => row.node === expression.id), false);

  const table = index.types;
  for (const [left, expected] of [[9007199254740993n, 9007199254740994n], [9223372036854775807n, null]]) {
    const args = [left, 1n].map(numerator => ({ kind: "number", type, value: { numerator, denominator: 1n, negativeZero: false } }));
    const evaluated = evaluate({ types: table, typeOf: id => table.terms[id], signatureOf: id => table.signatures[id],
      selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation }, selected.instance, selected.mir, args,
    "compile-time", { query: "constValue", key: [selected.instance, "compile-time"] });
    assert.equal(evaluated.kind, "done");
    assert.equal(evaluated.value.kind, "ok");
    if (expected !== null) {
      assert.deepEqual(evaluated.value.value, { kind: "value", value: { kind: "number", type,
        value: { numerator: expected, denominator: 1n, negativeZero: false } } });
    } else {
      assert.deepEqual(evaluated.value.value, { kind: "value", value: { kind: "error", type } });
      assert.equal(evaluated.value.diagnostics.length, 1);
      assert.equal(evaluated.value.diagnostics[0].code.name, "TSONIC_CONSTANT_EVALUATION_FAILED");
      assert.match(evaluated.value.diagnostics[0].message, /process-ending integer overflow/u);
      assert.deepEqual(evaluated.value.diagnostics[0].site, { kind: "source", origin: invoke.origin });
    }
  }
  const prefix = "const left = 1; function add() { return left + right; } ";
  const caller = "export const sum = add(); ";
  const right = "const right = 2;";
  assert.equal(analyze(prefix + right + caller).result.kind, "ok");
  const refused = analyze(prefix + caller + right).result;
  assert.equal(refused.kind, "refused");
  assert.equal(refused.diagnostics.length, 1);
  assert.equal(refused.diagnostics[0].code.name, "TSONIC_STATIC_READ_BEFORE_INITIALIZATION");
  assert.equal(refused.diagnostics[0].site.origin.start, prefix.indexOf("right"));
});

test("the same authored int64 addition lowers according to the exact selected failure or result carrier", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { lowerToMir } = await import("../../packages/host/dist/lower-mir/index.js");
  const { verifyMir } = await import("../../packages/host/dist/ir-mir/index.js");
  const { instanceKey } = await import("../../packages/host/dist/ir-types/index.js");
  const original = analysisInput(fixture, "sdk-minimal", "const left = 9_007_199_254_740_993; const right = 1; export const sum = left + right;");
  const withOverflow = rows => ({ ...original, snapshot: { ...original.snapshot,
    nativeFacts: { ...original.snapshot.nativeFacts, integerOverflow: rows } } });
  const typedBarrier = input => {
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok", JSON.stringify(captured.diagnostics));
    return typeSourceBarrier(input, captured.value, createTypedAccount(input));
  };
  for (const [law, carrier, primitive] of [["unwind", "escape", "int64"], ["abort", "abort", "int64"], ["wrap", null, "uint64"]]) {
    const input = withOverflow([{ carrier: "int64", operation: "add", result: primitive, law }]);
    const typed = typedBarrier(input);
    assert.equal(typed.kind, "ok", JSON.stringify(typed.diagnostics));
    const { types } = typed.value.source;
    const body = [...typed.value.bodies.values()].find(row => row.bindings.kind === "instantiated" && row.root.kind === "BinaryExpression");
    const defs = { completionSelector: fixture.types.internType(types, { kind: "primitive", primitive: "int32" }),
      exceptionStorage: fixture.types.internType(types, { kind: "intrinsic", intrinsic: "unknown" }) };
    const mir = lowerToMir({ defs, typeOf: id => fixture.types.readType(types, id), signatureOf: id => fixture.types.readSignature(types, id),
      limits: input.limits.lowering, unit: { query: "mirOf", key: instanceKey({ body: body.body, bindings: body.bindings }) } }, body, [], [0]);
    assert.equal(mir.kind, "ok", JSON.stringify(mir.diagnostics));
    const invokes = mir.value.blocks.map(block => block.terminator).filter(row => row.kind === "invoke");
    assert.equal(invokes.length, carrier === null ? 0 : 1);
    if (carrier !== null) {
      assert.deepEqual(invokes[0].unwind, { kind: carrier });
      assert.equal(invokes[0].operands.length, 2);
      assert.deepEqual(invokes[0].operation.decision.execution, { kind: "invocation", writesStorage: false, failure: law });
    }
    assert.deepEqual(fixture.types.readType(types, body.completion), { kind: "primitive", primitive });
    const checked = verifyMir(mir.value, { selectedNativeFacts: input.snapshot.nativeFacts, source: body, requiredEntries: [0],
      types: fixture.types.viewTypes(types), limits: input.limits.mirVerification, declarationOf: typed.value.declarationOf,
      bodyOwner: key => fixture.ids.decodeBodyId(key).value.owner,
      bodyOf: instance => typed.value.bodies.get(instanceKey(instance)) ?? null });
    assert.deepEqual(checked, { kind: "complete", violations: [] });
  }
  for (const rows of [[], [{ carrier: "int64", operation: "subtract", result: "int64", law: "wrap" }]])
    assert.throws(() => typedBarrier(withOverflow(rows)), /actual selected native addition law for int64 and int64/u);
});

for (const [operator, syntax, family, name, operands, expected] of [
  ["-", "MinusToken", "subtract", "subtraction", [-9223372036854775808n, 1n], 9223372036854775807n],
  ["*", "AsteriskToken", "multiply", "multiplication", [9223372036854775807n, 2n], -2n],
])
test(`authored native ${name} uses its own selected overflow law end to end`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const original = analysisInput(fixture, "sdk-minimal",
    `export function compute(left = 5, right = 2) { return left ${operator} right; } export const observed = compute();`);
  const withLaw = law => ({ ...original, snapshot: { ...original.snapshot,
    nativeFacts: { ...original.snapshot.nativeFacts, integerOverflow: [{ carrier: "int64", operation: family, result: "int64", law }] } } });
  assert.throws(() => analyzeHostProgram(original), new RegExp(`actual selected native ${name} law for int64 and int64`, "u"));
  for (const law of ["wrap", "abort"]) {
    const input = withLaw(law);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { index, modules } = result.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    const [declaration] = readyModuleStatements(readyModuleRoot(module.tree));
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    const expression = body.tir.root.statements.nodes[0].expression;
    const type = body.tir.completion;
    assert.equal(expression.operatorToken.kind, syntax);
    assert.equal(expression.tsonic.role, "arithmetic");
    assert.deepEqual(index.types.terms[type], { kind: "primitive", primitive: "int64" });
    const invokes = body.mir.blocks.map(block => block.terminator).filter(row => row.kind === "invoke");
    const binary = body.mir.blocks.flatMap(block => block.statements).find(row => row.kind === "assign" && row.value.kind === "binary");
    assert.equal(invokes.length, law === "abort" ? 1 : 0);
    const operation = law === "abort" ? invokes[0].operation : binary.value.operation;
    assert.deepEqual(operation.decision, { kind: "selected", operation: { kind: "native-operator", operator, carrier: "int64" },
      operands: [type, type], result: type, execution: law === "wrap" ? { kind: "pure" } :
        { kind: "invocation", writesStorage: false, failure: "abort" } });
    if (law === "abort") assert.deepEqual(invokes[0].unwind, { kind: "abort" });
    const args = operands.map(numerator => ({ kind: "number", type, value: { numerator, denominator: 1n, negativeZero: false } }));
    const types = index.types;
    const evaluated = evaluate({ types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
      selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation }, body.instance, body.mir, args,
    "compile-time", { query: "constValue", key: [body.instance, "compile-time"] });
    assert.equal(evaluated.kind, "done");
    assert.equal(evaluated.value.kind, "ok");
    assert.deepEqual(evaluated.value.value, { kind: "value", value: law === "wrap" ? { kind: "number", type,
      value: { numerator: expected, denominator: 1n, negativeZero: false } } : { kind: "error", type } });
    if (law === "abort") assert.deepEqual(evaluated.value.diagnostics.map(row => row.code.name), ["TSONIC_CONSTANT_EVALUATION_FAILED"]);
  }
});

test("authored literal operands select native defaults before the real operator", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export const answer = (9_007_199_254_740_993) + 2; export const ordered = 9_007_199_254_740_992 < (9_007_199_254_740_993); "
    + "export const identity = +(0x20_0000_0000_0001);");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const types = index.types;
  const int64 = types.terms.findIndex(row => row.kind === "primitive" && row.primitive === "int64");
  for (const [ordinal, tokens, expected] of [
    [0, ["9_007_199_254_740_993", "2"], 9007199254740995n],
    [1, ["9_007_199_254_740_992", "9_007_199_254_740_993"], true],
    [2, ["0x20_0000_0000_0001"], 9007199254740993n],
  ]) {
    const statement = readyModuleStatements(readyModuleRoot(module.tree))[ordinal];
    const initializer = statement.declarationList.declarations.nodes[0].tsonic.initializer;
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === initializer);
    assert.equal(body.mir.constants.length, tokens.length);
    const computed = body.mir.blocks.flatMap(block => block.statements).find(row => row.kind === "assign"
      && (row.value.kind === "unary" || row.value.kind === "binary")).value;
    const operands = computed.kind === "binary" ? [computed.left, computed.right] : [computed.operand];
    assert.deepEqual(operands.map(operand => {
      assert.equal(operand.kind, "constant");
      const constant = body.mir.constants[operand.constant];
      assert.equal(constant.value.kind, "literal");
      return [constant.type, constant.value.value.token];
    }), tokens.map(token => [int64, token]));
    const operation = computed.operation.decision;
    assert.deepEqual(operation.operands, tokens.map(() => int64));
    assert.equal(operation.operation.carrier, "int64");
    const type = body.tir.completion;
    const evaluated = evaluate({ types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
      selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation }, body.instance, body.mir, [],
    "compile-time", { query: "constValue", key: [body.instance, "compile-time"] });
    assert.equal(evaluated.kind, "done");
    assert.equal(evaluated.value.kind, "ok");
    assert.deepEqual(evaluated.value.value, { kind: "value", value: typeof expected === "boolean"
      ? { kind: "boolean", type, value: expected }
      : { kind: "number", type, value: { numerator: expected, denominator: 1n, negativeZero: false } } });
  }
  const outOfRange = analysisInput(fixture, "sdk-minimal", "export const answer = 9_223_372_036_854_775_808 + 1;");
  assert.throws(() => analyzeHostProgram(outOfRange), /authored integral literal outside its selected int64 range/u);
});

for (const [operator, token, name, operand, expected] of [
  ["+", "PlusToken", "unary identity", 9007199254740993n, 9007199254740993n],
  ["~", "TildeToken", "complement", -9223372036854775808n, 9223372036854775807n],
  ["-", "MinusToken", "negation", -9223372036854775808n, -9223372036854775808n],
])
test(`authored integer ${name} uses the actual unary native semantics`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    `export function compute(value = 1) { return ${operator}value; } export const observed = compute();`);
  const analyze = integerOverflow => analyzeHostProgram({ ...input, snapshot: { ...input.snapshot,
    nativeFacts: { ...input.snapshot.nativeFacts, integerOverflow } } });
  if (operator === "-")
    assert.throws(() => analyze(input.snapshot.nativeFacts.integerOverflow), /actual selected native negation law/u);
  for (const law of operator === "-" ? ["wrap", "abort"] : [null]) {
    const integerOverflow = law === null ? [] : [{ carrier: "int64", operation: "negate", result: "int64", law }];
    const nativeFacts = { ...input.snapshot.nativeFacts, integerOverflow };
    const result = analyze(integerOverflow);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { index, modules } = result.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    const [declaration] = readyModuleStatements(readyModuleRoot(module.tree));
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    const type = body.tir.completion;
    const expression = body.tir.root.statements.nodes[0].expression;
    assert.equal(expression.kind, "PrefixUnaryExpression");
    assert.equal(expression.operator, token);
    assert.deepEqual(index.types.terms[type], { kind: "primitive", primitive: "int64" });
    const invokes = body.mir.blocks.map(block => block.terminator).filter(row => row.kind === "invoke");
    assert.equal(invokes.length, law === "abort" ? 1 : 0);
    const operation = law === "abort" ? invokes[0].operation : body.mir.blocks.flatMap(block => block.statements)
      .find(row => row.kind === "assign" && row.value.kind === "unary").value.operation;
    assert.deepEqual(operation.decision, { kind: "selected", operation: { kind: "native-operator", operator, carrier: "int64" },
      operands: [type], result: type, execution: law === "abort" ? { kind: "invocation", writesStorage: false, failure: "abort" } : { kind: "pure" } });
    if (law === "abort") assert.deepEqual(invokes[0].unwind, { kind: "abort" });
    const args = [{ kind: "number", type, value: { numerator: operand, denominator: 1n, negativeZero: false } }];
    const types = index.types;
    const evaluated = evaluate({ types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
      selectedNativeFacts: nativeFacts, limits: input.limits.evaluation }, body.instance, body.mir, args,
    "compile-time", { query: "constValue", key: [body.instance, "compile-time"] });
    assert.equal(evaluated.kind, "done");
    assert.equal(evaluated.value.kind, "ok");
    assert.deepEqual(evaluated.value.value, { kind: "value", value: law === "abort" ? { kind: "error", type } : {
      kind: "number", type, value: { numerator: expected, denominator: 1n, negativeZero: false } } });
    if (law === "abort") assert.deepEqual(evaluated.value.diagnostics.map(row => row.code.name), ["TSONIC_CONSTANT_EVALUATION_FAILED"]);
  }
});

for (const [operator, token, operation] of [["+", "PlusToken", "identity"], ["-", "MinusToken", "negation"]])
test(`authored floating unary ${operation} preserves the selected encoding without a numeric conversion`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `export function accept(value: number): number { return ${operator}value; }`);
  const nativeFacts = { ...input.snapshot.nativeFacts, integerOverflow: [], conversions: [] };
  const analyze = facts => analyzeHostProgram({ ...input, snapshot: { ...input.snapshot, nativeFacts: facts } });
  const result = analyze(nativeFacts);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === readyModuleStatements(readyModuleRoot(module.tree))[0].tsonic.signatures[0].body);
  const type = body.tir.completion;
  assert.deepEqual(types.terms[type], { kind: "primitive", primitive: "float64" });
  const expression = body.tir.root.statements.nodes[0].expression;
  assert.equal(expression.operator, token);
  assert.deepEqual(expression.tsonic.conversion, { kind: "identity" });
  assert.equal(body.mir.blocks.some(block => block.terminator.kind === "invoke"), false);
  const row = body.mir.blocks.flatMap(block => block.statements).find(statement => statement.kind === "assign" && statement.value.kind === "unary");
  assert.deepEqual(row.value.operation.decision, { kind: "selected", operation: { kind: "native-operator", operator, carrier: "float64" },
    operands: [type], result: type, execution: { kind: "pure" } });
  for (const [bits, opposite] of [
    [0n, 0x8000000000000000n], [0x8000000000000000n, 0n], [1n, 0x8000000000000001n],
    [0x3ff8000000000000n, 0xbff8000000000000n], [0x7ff0000000000000n, 0xfff0000000000000n],
    [0xfff0000000000000n, 0x7ff0000000000000n], [0xfff8000000000007n, 0x7ff8000000000007n],
    [0x7ff0000000000003n, 0xfff0000000000003n],
  ]) {
    const value = { kind: "floating", type, bits };
    const run = evaluate({ types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
      selectedNativeFacts: nativeFacts, limits: input.limits.evaluation }, body.instance, body.mir, [value], "compile-time",
    { query: "constValue", key: [body.instance, "compile-time"] });
    assert.equal(run.kind, "done");
    assert.equal(run.value.kind, "ok");
    assert.deepEqual(run.value.value, { kind: "value", value: { ...value, bits: operator === "+" ? bits : opposite } });
    assert.deepEqual(run.value.diagnostics, []);
  }
  assert.throws(() => analyze({ ...nativeFacts, floatingFormats: [] }),
    error => error instanceof Error && error.message.includes(`actual selected native floating format for unary ${operator}`));
});

test("authored floating comparisons use the selected IEEE ordering and unordered relation", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const operators = [
    ["<", ["less"]], ["<=", ["less", "equal"]], [">", ["greater"]], [">=", ["greater", "equal"]],
    ["==", ["equal"]], ["===", ["equal"]], ["!=", ["less", "greater", "unordered"]], ["!==", ["less", "greater", "unordered"]],
  ];
  const source = operators.map(([operator], index) =>
    `export function compare${index}(left: number, right: number): boolean { return left ${operator} right; }`).join("\n");
  const input = analysisInput(fixture, "sdk-minimal", source);
  const nativeFacts = { ...input.snapshot.nativeFacts, integerOverflow: [], conversions: [] };
  const analyze = facts => analyzeHostProgram({ ...input, snapshot: { ...input.snapshot, nativeFacts: facts } });
  const program = analyze(nativeFacts);
  assert.equal(program.kind, "ok", JSON.stringify(program.diagnostics));
  const { index: { types }, modules } = program.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const pairs = [
    [0n, 0x8000000000000000n, "equal"], [0x8000000000000000n, 0n, "equal"],
    [0xbff8000000000000n, 0xbff0000000000000n, "less"], [0x3ff8000000000000n, 0x3ff0000000000000n, "greater"],
    [0x8000000000000001n, 1n, "less"], [0xfff0000000000000n, 0x7ff0000000000000n, "less"],
    [0x7ff0000000000000n, 0x7ff0000000000000n, "equal"], [0x7fefffffffffffffn, 0x7ff0000000000000n, "less"],
    [0x7ff8000000000007n, 0x7ff8000000000007n, "unordered"], [0n, 0xfff0000000000003n, "unordered"],
  ];
  for (const [ordinal, [operator, trueOn]] of operators.entries()) {
    const header = readyModuleStatements(readyModuleRoot(module.tree))[ordinal];
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === header.tsonic.signatures[0].body);
    const operation = body.mir.blocks.flatMap(block => block.statements).find(row => row.kind === "assign" && row.value.kind === "binary").value.operation.decision;
    const [type] = operation.operands;
    assert.deepEqual(operation, { kind: "selected", operation: { kind: "native-operator", operator, carrier: "float64" },
      operands: [type, type], result: body.tir.completion, execution: { kind: "pure" } });
    assert.deepEqual(types.terms[type], { kind: "primitive", primitive: "float64" });
    assert.deepEqual(types.terms[operation.result], { kind: "primitive", primitive: "bool" });
    assert.equal(body.mir.blocks.some(block => block.terminator.kind === "invoke"), false);
    for (const [left, right, order] of pairs) {
      const values = [left, right].map(bits => ({ kind: "floating", type, bits }));
      const run = evaluate({ types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
        selectedNativeFacts: nativeFacts, limits: input.limits.evaluation }, body.instance, body.mir, values, "compile-time",
      { query: "constValue", key: [body.instance, "compile-time"] });
      assert.equal(run.kind, "done");
      assert.equal(run.value.kind, "ok");
      assert.deepEqual(run.value.value, { kind: "value", value: { kind: "boolean", type: operation.result, value: trueOn.includes(order) } });
      assert.deepEqual(run.value.diagnostics, []);
    }
  }
  assert.throws(() => analyze({ ...nativeFacts, floatingFormats: [] }), /actual selected native floating format for comparison/u);
});

test("authored bitwise operations preserve native integer widths without selecting shift or overflow laws", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const cases = [["&", "AmpersandToken", 4n], ["|", "BarToken", 9223372036854775807n], ["^", "CaretToken", 9223372036854775803n]];
  const source = cases.map(([operator], ordinal) =>
    `export function bits${ordinal}(left = 5, right = 6) { return left ${operator} right; }`).join(" ");
  const original = analysisInput(fixture, "sdk-minimal", source);
  const nativeFacts = { ...original.snapshot.nativeFacts, integerOverflow: [], invalidShiftCount: [] };
  const snapshot = { ...original.snapshot, nativeFacts };
  const result = analyzeHostProgram({ ...original, snapshot });
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === snapshot.entryPoint);
  const types = index.types;
  for (const [ordinal, [operator, token, expected]] of cases.entries()) {
    const declaration = readyModuleStatements(readyModuleRoot(module.tree))[ordinal];
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    const type = body.tir.completion;
    const expression = body.tir.root.statements.nodes[0].expression;
    assert.equal(expression.operatorToken.kind, token);
    assert.deepEqual(types.terms[type], { kind: "primitive", primitive: "int64" });
    const value = body.mir.blocks.flatMap(block => block.statements).find(row => row.kind === "assign" && row.value.kind === "binary").value;
    assert.deepEqual(value.operation.decision, { kind: "selected", operation: { kind: "native-operator", operator, carrier: "int64" },
      operands: [type, type], result: type, execution: { kind: "pure" } });
    const args = [9223372036854775805n, 6n].map(numerator => ({ kind: "number", type,
      value: { numerator, denominator: 1n, negativeZero: false } }));
    const evaluated = evaluate({ types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
      selectedNativeFacts: nativeFacts, limits: original.limits.evaluation }, body.instance, body.mir, args,
    "compile-time", { query: "constValue", key: [body.instance, "compile-time"] });
    assert.equal(evaluated.kind, "done");
    assert.equal(evaluated.value.kind, "ok");
    assert.deepEqual(evaluated.value.value, { kind: "value", value: { kind: "number", type,
      value: { numerator: expected, denominator: 1n, negativeZero: false } } });
  }
  const mixed = analysisInput(fixture, "sdk-minimal", "const left = 1; export function mix(right: number) { return left & right; }");
  assert.throws(() => analyzeHostProgram(mixed), /binary operator & over int64 and float64/u);
});

for (const [operator, label] of [[">>", "right shift"], [">>>", "zero-fill right shift"]])
test(`authored integer ${label} preserves width and its independent count behavior`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `export function shift(left = 1, count = 1) { return left ${operator} count; } `
    + `export const observed = 9_007_199_254_740_993 ${operator} 53;`);
  const analyze = invalidShiftCount => {
    const nativeFacts = { ...input.snapshot.nativeFacts, integerOverflow: [], invalidShiftCount };
    const snapshot = { ...input.snapshot, nativeFacts };
    return { nativeFacts, program: analyzeHostProgram({ ...input, snapshot }) };
  };
  assert.throws(() => analyze([]), /actual selected native shift-count law/u);
  for (const law of [{ kind: "mask", mask: 63n }, { kind: "fail", failure: "abort" }]) {
    const { nativeFacts, program } = analyze([{ carrier: "int64", law }]);
    assert.equal(program.kind, "ok", JSON.stringify(program.diagnostics));
    const { index, modules } = program.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    const [declaration, observed] = readyModuleStatements(readyModuleRoot(module.tree));
    const types = index.types;
    for (const [bodyId, numbers, expected] of [
      [observed.declarationList.declarations.nodes[0].tsonic.initializer, [], 1n],
      [declaration.tsonic.signatures[0].body, [-9223372036854775808n, 63n], operator === ">>" ? -1n : 1n],
      [declaration.tsonic.signatures[0].body, [-2n, 1n], operator === ">>" ? -1n : 9223372036854775807n],
      [declaration.tsonic.signatures[0].body, [-2n, 0n], -2n],
      [declaration.tsonic.signatures[0].body, [-2n, 64n], law.kind === "mask" ? -2n : null],
      [declaration.tsonic.signatures[0].body, [-2n, -1n], law.kind === "mask" ? operator === ">>" ? -1n : 1n : null],
      [declaration.tsonic.signatures[0].body, [9007199254740993n, 64n], law.kind === "mask" ? 9007199254740993n : null],
    ]) {
      const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === bodyId);
      const type = body.tir.completion;
      const invokes = body.mir.blocks.map(row => row.terminator).filter(row => row.kind === "invoke");
      assert.equal(invokes.length, law.kind === "mask" ? 0 : 1);
      const operation = law.kind === "mask" ? body.mir.blocks.flatMap(row => row.statements)
        .find(row => row.kind === "assign" && row.value.kind === "binary").value.operation : invokes[0].operation;
      assert.deepEqual(operation.decision.operation, { kind: "native-operator", operator, carrier: "int64" });
      const args = numbers.map(numerator => ({ kind: "number", type, value: { numerator, denominator: 1n, negativeZero: false } }));
      const evaluated = evaluate({ types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
        selectedNativeFacts: nativeFacts, limits: input.limits.evaluation }, body.instance, body.mir, args,
      "compile-time", { query: "constValue", key: [body.instance, "compile-time"] });
      assert.equal(evaluated.kind, "done");
      assert.equal(evaluated.value.kind, "ok");
      assert.deepEqual(evaluated.value.value, { kind: "value", value: expected === null ? { kind: "error", type } : {
        kind: "number", type, value: { numerator: expected, denominator: 1n, negativeZero: false } } });
      if (expected === null) {
        assert.deepEqual(invokes[0].unwind, { kind: "abort" });
        assert.equal(evaluated.value.diagnostics.length, 1);
        const [diagnostic] = evaluated.value.diagnostics;
        assert.equal(diagnostic.code.name, "TSONIC_CONSTANT_EVALUATION_FAILED");
        assert.match(diagnostic.message, /process-ending invalid integer shift count/u);
        assert.deepEqual(diagnostic.site, { kind: "source", origin: invokes[0].origin });
      }
    }
  }
});

test("authored native local updates return the correct snapshot and store only on success", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const { parseMir, printMir } = await import("../../packages/host/dist/ir-mir/index.js");
  const { parseTir, printTir } = await import("../../packages/host/dist/ir-tir/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export function preUp(value = 1) { return ++value; }
    export function postUp(value = 1) { return value++ + value; }
    export function preDown(value = 1) { return --value; }
    export function postDown(value = 1) { return value-- + value; }
  `);
  const add = { carrier: "int64", operation: "add", result: "int64", law: "wrap" };
  const analyze = integerOverflow => {
    const nativeFacts = { ...input.snapshot.nativeFacts, integerOverflow };
    return { nativeFacts, program: analyzeHostProgram({ ...input, snapshot: { ...input.snapshot, nativeFacts } }) };
  };
  for (const law of ["wrap", "abort"]) {
    const { nativeFacts, program } = analyze([add,
      { ...add, operation: "decrement", law }, { ...add, operation: "increment", law }]);
    assert.equal(program.kind, "ok", JSON.stringify(program.diagnostics));
    const { index, modules } = program.value;
    const { types } = index;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    for (const [position, [operator, postfix, boundary, expected, wrapped]] of [
      ["++", false, 9223372036854775807n, 8n, -9223372036854775808n],
      ["++", true, 9223372036854775807n, 15n, -1n],
      ["--", false, -9223372036854775808n, 6n, 9223372036854775807n],
      ["--", true, -9223372036854775808n, 13n, -1n],
    ].entries()) {
      assert.equal(module.tree.kind, "ready-root");
      const slot = module.tree.root.statements.nodes[position];
      assert.equal(slot.kind, "ready-callable");
      const declaration = slot.node;
      const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
      const returned = body.tir.root.statements.nodes[0].expression;
      const update = postfix ? returned.left : returned;
      const label = `${law} ${position}`;
      const mir = parseMir(printMir(body.mir));
      const tir = parseTir(printTir(body.tir));
      assert.equal(mir.kind, "parsed", label);
      assert.equal(tir.kind, "parsed", label);
      assert.equal(printMir(mir.value), printMir(body.mir), label);
      assert.equal(printTir(tir.value), printTir(body.tir), label);
      assert.equal(update.kind, postfix ? "PostfixUnaryExpression" : "PrefixUnaryExpression", label);
      assert.equal(update.operand.tsonic.access.kind, "read-write", label);
      const type = body.tir.completion;
      assert.deepEqual(update.tsonic.operation.decision.decision, {
        kind: "selected", operation: { kind: "native-operator", operator, carrier: "int64" },
        operands: [type], result: type, execution: law === "wrap" ? { kind: "pure" }
          : { kind: "invocation", writesStorage: false, failure: "abort" },
      }, label);
      const entry = body.mir.entries.find(row => row.provided === 1).block;
      const parameter = body.mir.locals.find(local => local.role.kind === "parameter" && local.role.index === 0).id;
      const writes = body.mir.blocks.flatMap(block => block.statements.flatMap(row => {
        if (row.kind !== "assign" || row.tir.node !== update.id || body.mir.places[row.place].base.local !== parameter) return [];
        return [block.id];
      }));
      const invoke = body.mir.blocks[entry].terminator;
      if (law === "abort") {
        assert.equal(invoke.kind, "invoke", label);
        assert.deepEqual(invoke.unwind, { kind: "abort" }, label);
        assert.deepEqual(writes, [invoke.next], label);
      } else assert.deepEqual(writes, [entry], label);
      for (const [numerator, result] of [[7n, expected], [boundary, law === "wrap" ? wrapped : null]]) {
        const integer = value => ({ kind: "number", type, value: { numerator: value, denominator: 1n, negativeZero: false } });
        const evaluated = evaluate({ types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
          selectedNativeFacts: nativeFacts, limits: input.limits.evaluation }, body.instance, body.mir, [integer(numerator)],
        "compile-time", { query: "constValue", key: [body.instance, "compile-time"] });
        assert.equal(evaluated.kind, "done", label);
        assert.equal(evaluated.value.kind, "ok", label);
        assert.deepEqual(evaluated.value.value, { kind: "value", value: result === null ? { kind: "error", type } : integer(result) }, label);
        if (result === null) {
          assert.equal(evaluated.value.diagnostics.length, 1, label);
          assert.deepEqual(evaluated.value.diagnostics[0].site, { kind: "source", origin: invoke.origin }, label);
        }
      }
    }
  }
  assert.throws(() => analyze([add, { ...add, operation: "decrement", law: "wrap" }]), /actual selected native increment law/u);
});

for (const [syntax, statement, minimum, detail = ""] of [
  ["WhileStatement", "while (remaining > threshold) { --remaining; ++visits; }", 0n],
  ["DoStatement", "do { --remaining; ++visits; } while (remaining > threshold);", 1n],
  ["ForStatement", "for (visits = remaining; remaining > threshold; --remaining) { ++visits; }", 0n],
  ["DoStatement", "do { --remaining; ++visits; continue; } while (remaining > threshold);", 1n, " after an unconditional continue"],
]) {
  test(`authored ${syntax} runs its native condition at the correct edge${detail}`, async () => {
    const fixture = await loadFrontFixture();
    const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
    const { evaluate, resumeEvaluate } = await import("../../packages/host/dist/evaluate/index.js");
    const { instanceKey } = await import("../../packages/host/dist/ir-types/index.js");
    const input = analysisInput(fixture, "sdk-minimal",
      `export function count(remaining = 1, threshold = 0) { let visits = 0; ${statement} return visits; }`);
    const nativeFacts = { ...input.snapshot.nativeFacts, integerOverflow: ["decrement", "increment"]
      .map(operation => ({ carrier: "int64", operation, result: "int64", law: "wrap" })) };
    const program = analyzeHostProgram({ ...input, snapshot: { ...input.snapshot, nativeFacts } });
    assert.equal(program.kind, "ok", JSON.stringify(program.diagnostics));
    const { index, modules } = program.value;
    const { types } = index;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    const declaration = readyModuleStatements(readyModuleRoot(module.tree))[0];
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    const initializerId = body.tir.root.statements.nodes[0].declarationList.declarations.nodes[0].tsonic.initializer;
    const initializer = module.bodies.find(row => row.kind === "selected" && row.instance.body === initializerId);
    const loop = body.tir.root.statements.nodes[1];
    assert.equal(loop.kind, syntax);
    const controls = body.mir.blocks.flatMap(block => block.terminator.kind === "switch" ? [block.terminator] : []);
    assert.equal(controls.length, 1, "one native branch is revisited, not duplicated per iteration");
    assert.deepEqual(controls[0].tir, { body: body.instance.body, node: loop.id });
    const type = body.tir.completion;
    assert.deepEqual(types.terms[type], { kind: "primitive", primitive: "int64" });
    const view = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
      selectedNativeFacts: nativeFacts, limits: input.limits.evaluation };
    const unit = { query: "constValue", key: [body.instance, "compile-time"] };
    const integer = numerator => ({ kind: "number", type, value: { numerator, denominator: 1n, negativeZero: false } });
    for (const [remaining, threshold, expected] of [[0n, 0n, minimum], [1n, 0n, 1n], [4n, 0n, 4n],
      [9007199254740996n, 9007199254740993n, 3n]]) {
      const label = `${syntax}${detail}/${remaining}/${threshold}`;
      const paused = evaluate(view, body.instance, body.mir, [integer(remaining), integer(threshold)], "compile-time", unit);
      assert.equal(paused.kind, "paused", label);
      assert.equal(paused.requests.length, 1, label);
      assert.equal(paused.requests[0].kind, "mir-body", label);
      assert.equal(instanceKey(paused.requests[0].instance), instanceKey(initializer.instance), label);
      const result = resumeEvaluate(view, paused.paused, [{ kind: "mir-body", body: initializer.mir }]);
      assert.equal(result.kind, "done", label);
      assert.equal(result.value.kind, "ok", label);
      assert.deepEqual(result.value.diagnostics, [], label);
      assert.deepEqual(result.value.value, { kind: "value", value: integer(syntax === "ForStatement" ? remaining + expected : expected) }, label);
    }
    if (detail === "") {
      const condition = syntax === "WhileStatement" ? "while (value) { return false; }"
        : syntax === "DoStatement" ? "do { value; } while (value);" : "for (; value;) { return false; }";
      assert.throws(() => analyzeHostProgram(analysisInput(fixture, "sdk-minimal",
        `export function notBoolean(value: number): boolean { ${condition} return false; }`)),
      /condition without a selected boolean conversion/u);
    }
  });
}

test("loop-condition writes initialize storage only on the actual evaluation paths", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  for (const [syntax, accepted, rejected] of [
    ["WhileStatement", "while ((stored = input) && flag) { break; } return stored;",
      "while (flag && (stored = input)) { break; } return stored;"],
    ["DoStatement", "do { flag = false; continue; } while ((stored = input, flag)); return stored;",
      "do { return stored; } while ((stored = input, flag));"],
    ["ForStatement", "for (; (stored = input, flag);) { break; } return stored;",
      "for (; flag; stored = input) { break; } return stored;"],
  ]) {
    const prefix = "export function run(flag: boolean, input: boolean): boolean { let stored: boolean; ";
    const input = analysisInput(fixture, "sdk-minimal", prefix + accepted + " }");
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", syntax);
    const { index: { types }, modules } = result.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    const declaration = readyModuleStatements(readyModuleRoot(module.tree))[0];
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    const [, loop, completion] = body.tir.root.statements.nodes;
    assert.equal(loop.kind, syntax);
    const storage = body.tir.locals.find(local => local.name === "stored");
    const local = body.mir.locals.find(candidate => candidate.source?.body === body.instance.body && candidate.source.local === storage.id);
    const operand = body.mir.blocks.find(block => block.terminator.kind === "return").terminator.value;
    assert.equal(operand.kind, "place", syntax);
    assert.equal(body.mir.places[operand.place].base.local, local.id, syntax);
    const facts = body.facts.find(row => row.execution.provided === 2);
    const read = facts.initialization.reads.find(row => row.node === completion.expression.id && row.place === operand.place);
    assert.equal(read?.assigned, true, syntax);
    const view = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
      selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
    const unit = { query: "constValue", key: [body.instance, "compile-time"] };
    const boolean = value => ({ kind: "boolean", type: body.tir.completion, value });
    for (const flag of [false, true]) for (const value of [false, true]) {
      const outcome = evaluate(view, body.instance, body.mir, [boolean(flag), boolean(value)], "compile-time", unit);
      assert.equal(outcome.kind, "done", syntax);
      assert.deepEqual(outcome.value, { kind: "ok", diagnostics: [], emissions: [],
        positions: [{ position: { kind: "result" }, error: null }], value: { kind: "value", value: boolean(value) } }, syntax);
    }
    const unsafe = prefix + rejected + " }";
    const refused = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", unsafe));
    assert.equal(refused.kind, "refused", syntax);
    assert.equal(Object.hasOwn(refused, "value"), false, syntax);
    assert.deepEqual(refused.diagnostics.map(diagnostic => [diagnostic.code.rendered,
      diagnostic.site.origin.start, diagnostic.site.origin.length]),
    [["TSONIC_READ_BEFORE_INITIALIZATION", unsafe.indexOf("return stored") + "return ".length, "stored".length]], syntax);
  }
});

test("unlabelled break and continue retain their own loop and native successor", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { parseTir, printTir, verifyTir: verifyTirOperation } = await import("../../packages/host/dist/ir-tir/index.js");
  const verifyTir = await tirFixtureBodyVerifier(verifyTirOperation);
  const { evaluate, resumeEvaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export function count(remaining = 3, threshold = 0, stop = 2, enter = true) {
      let visits = 0;
      for (; remaining > threshold; --remaining) {
        while (enter) { break; }
        if (remaining === stop) continue;
        ++visits;
      }
      return visits;
    }`);
  const nativeFacts = { ...input.snapshot.nativeFacts, integerOverflow: ["decrement", "increment"]
    .map(operation => ({ carrier: "int64", operation, result: "int64", law: "wrap" })) };
  input.snapshot = { ...input.snapshot, nativeFacts };
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const declaration = readyModuleStatements(readyModuleRoot(module.tree))[0];
  const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
  const source = captureSourceBarrier(input);
  assert.equal(source.kind, "ok");
  const typed = typeSourceBarrier(input, source.value, createTypedAccount(input));
  assert.equal(typed.kind, "ok");
  const verifier = typed.value.verifierOf(module.module);
  const typedBody = [...typed.value.bodies.values()].find(row => row.body === body.instance.body && row.bindings.kind === "instantiated");
  assert.deepEqual(verifyTir(verifier, typedBody), []);
  const parsed = parseTir(printTir(typedBody));
  assert.equal(parsed.kind, "parsed");
  assert.equal(printTir(parsed.value), printTir(typedBody));
  const decodedVerifier = { ...verifier, module: { ...verifier.module,
    bodies: verifier.module.bodies.map(row => row === typedBody ? parsed.value : row) } };
  assert.deepEqual(verifyTir(decodedVerifier, parsed.value).map(issue => [issue.rule, issue.site.node]),
    typedBody.params.filter(formal => formal.initializer.kind === "ready-default").map(formal => ["nested-template-identity", formal.id]));
  const outer = parsed.value.root.statements.nodes[1];
  const inner = outer.statement.statements.nodes[0];
  const stop = inner.statement.statements.nodes[0];
  const next = outer.statement.statements.nodes[1].thenStatement;
  assert.deepEqual(stop.tsonic.target, { body: body.instance.body, node: inner.id });
  assert.deepEqual(next.tsonic.target, { body: body.instance.body, node: outer.id });
  const initializerId = body.tir.root.statements.nodes[0].declarationList.declarations.nodes[0].tsonic.initializer;
  const initializer = module.bodies.find(row => row.kind === "selected" && row.instance.body === initializerId);
  for (const [transfer, invalid] of [[stop, { body: stop.tsonic.target.body, node: outer.id }],
    [next, { body: next.tsonic.target.body, node: inner.id }], [next, { body: initializerId, node: outer.id }]]) {
    const original = transfer.tsonic;
    transfer.tsonic = { target: invalid };
    const findings = verifyTir(decodedVerifier, parsed.value);
    assert.equal(findings.some(issue => issue.rule === "node-reference" && issue.site.node === transfer.id), true);
    transfer.tsonic = original;
  }
  const type = body.tir.completion;
  const { types } = index;
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: nativeFacts, limits: input.limits.evaluation };
  const integer = numerator => ({ kind: "number", type, value: { numerator, denominator: 1n, negativeZero: false } });
  const booleanType = body.tir.params[3].tsonic.storage;
  const unit = { query: "constValue", key: [body.instance, "compile-time"] };
  for (const enter of [true, false]) {
    const paused = evaluate(deps, body.instance, body.mir, [integer(3n), integer(0n), integer(2n),
      { kind: "boolean", type: booleanType, value: enter }], "compile-time", unit);
    assert.equal(paused.kind, "paused");
    assert.equal(paused.requests.length, 1);
    assert.equal(paused.requests[0].instance.body, initializerId);
    const evaluated = resumeEvaluate(deps, paused.paused, [{ kind: "mir-body", body: initializer.mir }]);
    assert.equal(evaluated.kind, "done");
    assert.equal(evaluated.value.kind, "ok");
    assert.deepEqual(evaluated.value.diagnostics, []);
    assert.deepEqual(evaluated.value.value, { kind: "value", value: integer(2n) });
  }
});

test("a for-var initializer uses one function-owned slot still visible after the loop", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate, resumeEvaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const authored = "export function count(limit = 1, start = 0) { for (var index = start; index < limit; ++index) { start = index; } return index; }";
  const input = analysisInput(fixture, "sdk-minimal", authored);
  const nativeFacts = { ...input.snapshot.nativeFacts, integerOverflow: [
    { carrier: "int64", operation: "increment", result: "int64", law: "wrap" },
  ] };
  const result = analyzeHostProgram({ ...input, snapshot: { ...input.snapshot, nativeFacts } });
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const declaration = readyModuleStatements(readyModuleRoot(module.tree))[0];
  const selected = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
  const [loop, returned] = selected.tir.root.statements.nodes;
  const variable = loop.initializer.declarations.nodes[0];
  assert.deepEqual(variable.tsonic.declaration.local, returned.expression.tsonic.resolution.local);
  const initializer = module.bodies.find(row => row.kind === "selected" && row.instance.body === variable.tsonic.initializer);
  const slot = selected.mir.locals.find(row => row.role.kind === "user" && row.source.local === variable.tsonic.declaration.local.local);
  assert.notEqual(slot, undefined);
  const life = selected.mir.blocks.flatMap(row => row.statements.filter(statement => "local" in statement && statement.local === slot.id));
  assert.deepEqual(life.map(row => row.kind), ["storage-live"]);
  const type = selected.tir.completion;
  const { types } = index;
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: nativeFacts, limits: input.limits.evaluation };
  const unit = { query: "constValue", key: [selected.instance, "compile-time"] };
  const integer = numerator => ({ kind: "number", type, value: { numerator, denominator: 1n, negativeZero: false } });
  for (const [limit, start, answer] of [[0n, 1n, 1n], [1n, 0n, 1n], [4n, 0n, 4n],
    [9007199254740996n, 9007199254740993n, 9007199254740996n]]) {
    const paused = evaluate(deps, selected.instance, selected.mir, [integer(limit), integer(start)], "compile-time", unit);
    assert.equal(paused.kind, "paused");
    assert.equal(paused.requests.length, 1);
    assert.equal(paused.requests[0].instance.body, initializer.instance.body);
    const computed = resumeEvaluate(deps, paused.paused, [{ kind: "mir-body", body: initializer.mir }]);
    assert.equal(computed.kind, "done");
    assert.equal(computed.value.kind, "ok");
    assert.deepEqual(computed.value.diagnostics, []);
    assert.deepEqual(computed.value.value, { kind: "value", value: integer(answer) });
  }
});

test("an out-of-scope lexical value read publishes its own original checker diagnostic", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const lexical = "export function read(gate: boolean): boolean { for (let held = gate; gate; ) break; return held; }";
  const bounded = analysisInput(fixture, "sdk-minimal", lexical);
  const { deps: captureDeps, program } = fixture.openAndCapture(bounded.snapshot);
  const captured = captureSingleModule(fixture.front, captureDeps, program, bounded.snapshot.entryPoint);
  assert.equal(captured.kind, "ok");
  const [outside] = captured.value.checkerDiagnostics.filter(row => row.code.kind === "checker" && row.code.number === 2304);
  assert.equal(outside?.site.kind, "source");
  assert.equal(outside.site.origin.start, lexical.lastIndexOf("held"));
  const refused = analyzeHostProgram(bounded);
  assert.equal(refused.kind, "refused");
  assert.deepEqual(refused.diagnostics, [outside]);
});

for (const { name, token, syntax, operator, nativeOperation, literal, baseline, literalResult, limit, wrapped } of [
  { name: "addition", token: "+=", syntax: "PlusEqualsToken", operator: "+", nativeOperation: "add",
    literal: 1, baseline: 9n, literalResult: 8n, limit: 9223372036854775807n, wrapped: -9223372036854775808n },
  { name: "subtraction", token: "-=", syntax: "MinusEqualsToken", operator: "-", nativeOperation: "subtract",
    literal: 2, baseline: 5n, literalResult: 5n, limit: -9223372036854775808n, wrapped: 9223372036854775806n },
  { name: "multiplication", token: "*=", syntax: "AsteriskEqualsToken", operator: "*", nativeOperation: "multiply",
    literal: 2, baseline: 14n, literalResult: 14n, limit: 9223372036854775807n, wrapped: -2n },
])
test(`native local compound ${name} reads before its right-hand write and stores only on success`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const { verifyOccurrenceOperation } = await import("../../packages/host/dist/ir-tir/verify-occurrences.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export function nested(left = 1, right = 1) { return left ${token} (left = right); }
    export function literal(left = 1) { return left ${token} ${literal}; }
  `);
  if (nativeOperation !== "add") {
    const wrongLaw = { ...input.snapshot.nativeFacts, integerOverflow: [
      { carrier: "int64", operation: "add", result: "int64", law: "wrap" },
    ] };
    assert.throws(() => analyzeHostProgram({ ...input, snapshot: { ...input.snapshot, nativeFacts: wrongLaw } }),
      error => error.cause?.owner === "rules" && error.cause.message.includes(`the actual selected native ${name} law`));
  }
  for (const law of ["wrap", "abort"]) {
    const nativeFacts = { ...input.snapshot.nativeFacts, integerOverflow: [
      { carrier: "int64", operation: nativeOperation, result: "int64", law },
    ] };
    const program = analyzeHostProgram({ ...input, snapshot: { ...input.snapshot, nativeFacts } });
    assert.equal(program.kind, "ok", JSON.stringify(program.diagnostics));
    const { index, modules } = program.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    const { types } = index;
    for (const [ordinal, authored] of readyModuleStatements(readyModuleRoot(module.tree)).entries()) {
      const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === authored.tsonic.signatures[0].body);
      const assignment = body.tir.root.statements.nodes[0].expression;
      const type = body.tir.completion;
      assert.equal(assignment.operatorToken.kind, syntax);
      assert.deepEqual(assignment.left.tsonic.access, { kind: "read-write", storage: type, read: type, narrowing: null, evidenceIndex: null });
      assert.deepEqual(assignment.tsonic.calculation.decision.decision, { kind: "selected",
        operation: { kind: "native-operator", operator, carrier: "int64" }, operands: [type, type], result: type,
        execution: law === "wrap" ? { kind: "pure" } : { kind: "invocation", writesStorage: false, failure: "abort" } });
      const start = body.mir.blocks[body.mir.entries.find(row => row.provided === body.tir.params.length).block];
      const valid = structuredClone(assignment);
      const checks = node => {
        const findings = [];
        verifyOccurrenceOperation(node, types, null, rule => findings.push(rule));
        return findings;
      };
      assert.deepEqual(checks(valid), []);
      const decision = valid.tsonic.calculation.decision.decision;
      const actual = decision.operation;
      decision.operation = { kind: "pointer-offset" };
      assert.deepEqual(checks(valid), ["operation-type"]);
      decision.operation = actual;
      decision.operation.operator = operator === "+" ? "-" : "+";
      assert.deepEqual(checks(valid), ["operation-type"]);
      decision.operation.operator = operator;
      decision.operands.pop();
      assert.deepEqual(checks(valid), ["operation-type"]);
      valid.tsonic.calculation = null;
      assert.deepEqual(checks(valid), ["operation-type"]);
      const outer = body.mir.blocks.flatMap(block => block.statements.flatMap(row =>
        row.kind === "assign" && row.tir.node === assignment.id && row.value.kind === "use" ? [block.id] : []));
      assert.deepEqual(outer, law === "abort" ? [start.terminator.next] : [start.id]);
      if (law === "abort") assert.deepEqual(start.terminator.unwind, { kind: "abort" });
      if (ordinal === 0) {
        const reading = start.statements.findIndex(row => row.kind === "assign" && row.tir.node === assignment.left.id && row.value.kind === "use");
        const writing = start.statements.findIndex(row => row.kind === "assign" && row.tir.node === assignment.right.expression.id && row.value.kind === "use");
        assert.ok(reading >= 0 && writing > reading, "the actual left value is read before the authored RHS assignment");
      }
      const integer = numerator => ({ kind: "number", type, value: { numerator, denominator: 1n, negativeZero: false } });
      const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
        selectedNativeFacts: nativeFacts, limits: input.limits.evaluation };
      const unit = { query: "constValue", key: [body.instance, "compile-time"] };
      for (const [left, right, expected] of [[7n, 2n, ordinal === 0 ? baseline : literalResult],
        [limit, BigInt(literal), law === "wrap" ? wrapped : null]]) {
        const args = ordinal === 0 ? [integer(left), integer(right)] : [integer(left)];
        const evaluated = evaluate(deps, body.instance, body.mir, args, "compile-time", unit);
        assert.equal(evaluated.kind, "done");
        assert.equal(evaluated.value.kind, "ok");
        assert.deepEqual(evaluated.value.value, { kind: "value", value: expected === null ? { kind: "error", type } : integer(expected) });
        assert.equal(evaluated.value.diagnostics.length, expected === null ? 1 : 0);
        if (expected === null) assert.deepEqual(evaluated.value.diagnostics[0].site, { kind: "source", origin: start.terminator.origin });
      }
    }
  }
});

test("native local Boolean conditional assignment skips the RHS and target write on its retained branch", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const { verifyOccurrenceOperation } = await import("../../packages/host/dist/ir-tir/verify-occurrences.js");
  const cases = [
    ["and", "&&=", "AmpersandAmpersandEqualsToken", true],
    ["or", "||=", "BarBarEqualsToken", false],
  ];
  const source = cases.map(([kind, token]) => `
    export function ${kind}Effect(left: boolean, right: boolean, observed: boolean): boolean {
      left ${token} (observed = right);
      return observed;
    }
    export function ${kind}Value(left: boolean, right: boolean): boolean { return left ${token} right; }
  `).join("\n");
  const input = analysisInput(fixture, "sdk-minimal", source);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  for (const [ordinal, declaration] of readyModuleStatements(readyModuleRoot(module.tree)).entries()) {
    const [kind, , token, take] = cases[Math.floor(ordinal / 2)];
    const observes = ordinal % 2 === 0;
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    const assignment = body.tir.root.statements.nodes[0].expression;
    const type = body.tir.completion;
    assert.equal(assignment.operatorToken.kind, token);
    assert.deepEqual(assignment.left.tsonic.access, { kind: "read-write", storage: type, read: type, narrowing: null, evidenceIndex: null });
    assert.equal(assignment.tsonic.calculation, null);
    assert.deepEqual(assignment.tsonic.selection, { kind, control: assignment.left.id, right: assignment.right.id, disposition: "dynamic" });
    assert.deepEqual(assignment.right.tsonic.demand, { kind: "selected", control: assignment.left.id, when: take ? "true" : "false" });
    const invalid = structuredClone(assignment);
    invalid.left.tsonic.access = { kind: "write", storage: type };
    const findings = [];
    verifyOccurrenceOperation(invalid, types, null, rule => findings.push(rule));
    assert.deepEqual(findings, ["operation-type"]);
    const entry = body.mir.blocks[body.mir.entries.find(row => row.provided === body.tir.params.length).block];
    const snapshots = entry.statements.filter(row => row.kind === "assign" && row.tir.node === assignment.left.id && row.value.kind === "use");
    assert.equal(snapshots.length, 1);
    const [snapshot] = snapshots;
    assert.equal(entry.terminator.kind, "switch");
    assert.deepEqual(entry.terminator.operand, { kind: "place", place: snapshot.place });
    const assigning = take ? entry.terminator.targets[0].target : entry.terminator.otherwise;
    const stores = body.mir.blocks.flatMap(block => block.statements.flatMap(row =>
      row.kind === "assign" && row.tir.node === assignment.id && row.place === snapshot.value.operand.place ? [block.id] : []));
    assert.deepEqual(stores, [assigning]);
    if (observes) {
      const effect = assignment.right.expression;
      const nested = body.mir.blocks.filter(block => block.statements.some(row => row.kind === "assign" && row.tir.node === effect.id));
      assert.deepEqual(nested.map(block => block.id), [assigning]);
    }
    const boolean = value => ({ kind: "boolean", type, value });
    const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
      selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
    for (const left of [false, true]) for (const right of [false, true]) {
      const operands = (observes ? [left, right, !right] : [left, right]).map(boolean);
      const run = evaluate(deps, body.instance, body.mir, operands, "compile-time",
        { query: "constValue", key: [body.instance, "compile-time"] });
      assert.equal(run.kind, "done");
      assert.equal(run.value.kind, "ok");
      assert.deepEqual(run.value.value, { kind: "value", value: boolean(left === take ? right : observes ? !right : left) });
      assert.deepEqual(run.value.diagnostics, []);
    }
  }
});

test("native local coalescing assignment distinguishes absence from false and retains one optional carrier", checkCoalescingAssignment);

for (const [family, annotations, variants, domain] of [
  ["Boolean", ["boolean"], [
    ["&&", "AmpersandAmpersandToken", "and", "true", true],
    ["||", "BarBarToken", "or", "false", false],
  ], [false, true]],
  ["absence", ["boolean | null", "boolean | undefined"], [
    ["??", "QuestionQuestionToken", "coalesce", "absent", null],
  ], [null, false, true]],
])
test(`ordinary native ${family} selection skips unselected RHS effects without a destination store`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  for (const annotation of annotations) for (const [operator, token, kind, when, take] of variants) {
    const input = analysisInput(fixture, "sdk-minimal", `
      export function effect(left: ${annotation}, right: ${annotation}, observed: ${annotation}): ${annotation} {
        left ${operator} (observed = right);
        return observed;
      }
      export function result(left: ${annotation}, right: ${annotation}): ${annotation} { return left ${operator} right; }
    `);
    const output = analyzeHostProgram(input);
    assert.equal(output.kind, "ok", JSON.stringify(output.diagnostics));
    const { index: { types }, modules } = output.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    for (const [ordinal, declaration] of readyModuleStatements(readyModuleRoot(module.tree)).entries()) {
      const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
      const expression = body.tir.root.statements.nodes[0].expression;
      const type = body.tir.completion;
      assert.equal(expression.operatorToken.kind, token);
      assert.equal(expression.tsonic.role, "short-circuit");
      assert.equal(expression.tsonic.type, type);
      assert.deepEqual(expression.tsonic.selection, { kind, control: expression.left.id, right: expression.right.id, disposition: "dynamic" });
      assert.deepEqual(expression.right.tsonic.demand, { kind: "selected", control: expression.left.id, when });
      const entry = body.mir.blocks[body.mir.entries.find(row => row.provided === body.tir.params.length).block];
      assert.equal(entry.terminator.kind, "switch");
      const control = entry.terminator.operand;
      assert.equal(control.kind, "place");
      const copies = entry.statements.filter(row => row.kind === "assign" && row.tir.node === expression.left.id);
      if (ordinal === 0) {
        assert.deepEqual(copies, []);
        assert.equal(entry.terminator.tir.node, expression.left.id);
        assert.equal(body.mir.locals.some(row => row.role.kind === "temporary"), false);
        const selected = take === false ? entry.terminator.otherwise : entry.terminator.targets[0].target;
        const effect = expression.right.expression;
        const effects = body.mir.blocks.filter(block => block.statements.some(row => row.kind === "assign" && row.tir.node === effect.id));
        assert.deepEqual(effects.map(block => block.id), [selected]);
      } else {
        assert.equal(copies.length, 1);
        assert.equal(copies[0].place, control.place);
        assert.equal(copies[0].value.kind, "use");
        assert.equal(copies[0].value.operand.kind, "place");
      }
      const authored = ordinal === 0 ? control.place : copies[0].value.operand.place;
      assert.equal(body.mir.blocks.some(block => block.statements.some(row => row.kind === "assign" && row.place === authored)), false);
      const literal = value => value === null ? { kind: "absence", type } : { kind: "boolean", type, value };
      const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
        selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
      for (const left of domain) for (const right of domain) {
        const observed = right !== true;
        const operands = (ordinal === 0 ? [left, right, observed] : [left, right]).map(literal);
        const run = evaluate(deps, body.instance, body.mir, operands, "compile-time",
          { query: "constValue", key: [body.instance, "compile-time"] });
        assert.equal(run.kind, "done");
        assert.equal(run.value.kind, "ok");
        assert.deepEqual(run.value.value, { kind: "value", value: literal(left === take ? right : ordinal === 0 ? observed : left) });
        assert.deepEqual(run.value.diagnostics, []);
      }
    }
  }
});

test("discarded short-circuit results need no slot but keep the actual guard read and selected call", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate, resumeEvaluate } = await import("../../packages/host/dist/evaluate/index.js");
  for (const [annotation, operator, taken, skipped] of [
    ["boolean", "&&", true, false], ["boolean", "||", false, true], ["boolean | null", "??", null, false],
  ]) {
    const source = `
      function act(right: ${annotation}, normal: boolean, message: string): ${annotation} {
        if (normal) return right;
        throw message;
      }
      export function discard(gate: ${annotation}, right: ${annotation}, normal: boolean, message: string): boolean {
        gate ${operator} act(right, normal, message);
        return normal;
      }
    `;
    const input = analysisInput(fixture, "sdk-minimal", source);
    const output = analyzeHostProgram(input);
    assert.equal(output.kind, "ok", JSON.stringify(output.diagnostics));
    const { index: { types }, modules } = output.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    const [callee, caller] = readyModuleStatements(readyModuleRoot(module.tree)).map(declaration =>
      module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body));
    const selection = caller.tir.root.statements.nodes[0].expression;
    const entry = caller.mir.blocks[caller.mir.entries[0].block];
    assert.equal(entry.terminator.kind, "switch");
    assert.equal(entry.terminator.tir.node, selection.left.id);
    assert.equal(caller.mir.locals.some(row => row.role.kind === "temporary"), false);
    const calls = caller.mir.blocks.filter(block => block.terminator.kind === "call");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].terminator.destination, null);
    const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
      selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
    const unit = { query: "constValue", key: [caller.instance, "compile-time"] };
    const operand = (position, value) => ({ type: caller.tir.params[position].tsonic.storage,
      ...(value === null ? { kind: "absence" } : { kind: typeof value, value }) });
    for (const gate of [taken, skipped]) for (const normal of [true, false]) {
      const initial = evaluate(deps, caller.instance, caller.mir,
        [operand(0, gate), operand(1, true), operand(2, normal), operand(3, "original throw")], "compile-time", unit);
      assert.equal(initial.kind, gate === taken ? "paused" : "done");
      const run = initial.kind === "paused"
        ? resumeEvaluate(deps, initial.paused, [{ kind: "mir-body", body: callee.mir }]) : initial;
      assert.equal(run.kind, "done");
      assert.equal(run.value.kind, "ok");
      if (gate === taken && !normal) {
        assert.deepEqual(run.value.value, { kind: "value", value: { kind: "error", type: caller.tir.completion } });
        assert.equal(run.value.diagnostics.length, 1);
        assert.deepEqual(run.value.diagnostics[0].site.origin, callee.tir.root.statements.nodes[1].origin);
      } else {
        assert.deepEqual(run.value.value, { kind: "value", value: operand(2, normal) });
        assert.deepEqual(run.value.diagnostics, []);
      }
    }
    const missing = `export function fail(right: ${annotation}): ${annotation} { let gate: ${annotation}; gate ${operator} right; return right; }`;
    const rejected = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", missing));
    assert.equal(rejected.kind, "refused");
    assert.equal(rejected.diagnostics.length, 1);
    assert.equal(rejected.diagnostics[0].code.rendered, "TSONIC_READ_BEFORE_INITIALIZATION");
    assert.deepEqual(rejected.diagnostics[0].site.origin, { module: input.snapshot.entryPoint,
      start: missing.lastIndexOf("gate"), length: "gate".length, derived: [] });
  }
});

test("discarded ternaries preserve the selected call without materializing either result", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate, resumeEvaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const source = `
    function yes(value: boolean, normal: boolean, message: string): boolean { if (normal) return value; throw message; }
    function no(value: boolean, normal: boolean, message: string): boolean { if (normal) return value; throw message; }
    export function choose(flag: boolean, value: boolean, normal: boolean, message: string): boolean {
      flag ? yes(value, normal, message) : no(value, normal, message);
      return value;
    }
    export function reads(flag: boolean, first: boolean, second: boolean): boolean {
      flag ? first : second;
      return flag;
    }
  `;
  const input = analysisInput(fixture, "sdk-minimal", source);
  const output = analyzeHostProgram(input);
  assert.equal(output.kind, "ok", JSON.stringify(output.diagnostics));
  const { index: { types }, modules } = output.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [yes, no, choice, reads] = readyModuleStatements(readyModuleRoot(module.tree)).map(declaration =>
    module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body));
  const selected = choice.tir.root.statements.nodes[0].expression;
  const entry = choice.mir.blocks[choice.mir.entries[0].block];
  assert.equal(entry.terminator.kind, "switch");
  assert.equal(entry.terminator.tir.node, selected.condition.id);
  const calls = choice.mir.blocks.filter(block => block.terminator.kind === "call");
  assert.equal(calls.length, 2);
  assert.equal(calls.every(block => block.terminator.destination === null), true);
  assert.equal(choice.mir.locals.some(row => row.role.kind === "temporary"), false);
  const readSelection = reads.tir.root.statements.nodes[0].expression;
  const saved = reads.mir.blocks.flatMap(block => block.statements).filter(row => row.kind === "assign");
  assert.deepEqual(saved.map(row => row.tir.node), [readSelection.whenTrue.id, readSelection.whenFalse.id]);
  assert.equal(saved[0].place, saved[1].place);
  assert.equal(reads.mir.locals.filter(row => row.role.kind === "temporary").length, 1);
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  const boolean = value => ({ kind: "boolean", type: choice.tir.completion, value });
  for (const take of [true, false]) for (const normal of [true, false]) {
    const actual = take ? yes : no;
    const pending = evaluate(deps, choice.instance, choice.mir, [boolean(take), boolean(true), boolean(normal),
      { kind: "string", type: choice.tir.params[3].tsonic.storage, value: "original throw" }], "compile-time",
      { query: "constValue", key: [choice.instance, "compile-time"] });
    assert.equal(pending.kind, "paused");
    assert.deepEqual(pending.requests, [{ kind: "mir-body", instance: actual.instance }]);
    const run = resumeEvaluate(deps, pending.paused, [{ kind: "mir-body", body: actual.mir }]);
    assert.equal(run.kind, "done");
    assert.equal(run.value.kind, "ok");
    assert.deepEqual(run.value.value, { kind: "value", value: normal ? boolean(true) : { kind: "error", type: choice.tir.completion } });
    if (normal) assert.deepEqual(run.value.diagnostics, []);
    else {
      assert.equal(run.value.diagnostics.length, 1);
      assert.deepEqual(run.value.diagnostics[0].site.origin, actual.tir.root.statements.nodes[1].origin);
    }
  }
  for (const expression of ["flag ? first : second", "first ? flag : second"]) {
    const missing = `export function fail(flag: boolean, second: boolean): boolean { let first: boolean; ${expression}; return flag; }`;
    const refused = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", missing));
    assert.equal(refused.kind, "refused");
    assert.equal(refused.diagnostics.length, 1);
    assert.equal(refused.diagnostics[0].code.rendered, "TSONIC_READ_BEFORE_INITIALIZATION");
    assert.deepEqual(refused.diagnostics[0].site.origin, { module: input.snapshot.entryPoint,
      start: missing.lastIndexOf("first"), length: "first".length, derived: [] });
  }
});

test("dynamic short-circuit reads its guard once after earlier operands and before a selected write", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  for (const [operator, take] of [["&&", true], ["||", false]]) {
    const source = `export function compare(first: boolean, gate: boolean, next: boolean): boolean {
      return first === (gate ${operator} (first = next));
    }`;
    const input = analysisInput(fixture, "sdk-minimal", source);
    const output = analyzeHostProgram(input);
    assert.equal(output.kind, "ok", JSON.stringify(output.diagnostics));
    const { index: { types }, modules } = output.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === readyModuleStatements(readyModuleRoot(module.tree))[0].tsonic.signatures[0].body);
    const comparison = body.tir.root.statements.nodes[0].expression;
    const selection = comparison.right.expression;
    const entry = body.mir.blocks[body.mir.entries[0].block];
    const writes = entry.statements.filter(row => row.kind === "assign");
    assert.deepEqual(writes.map(row => row.tir.node), [comparison.left.id, selection.left.id]);
    assert.equal(entry.terminator.kind, "switch");
    assert.deepEqual(entry.terminator.operand, { kind: "place", place: writes[1].place });
    assert.equal(body.mir.blocks.flatMap(block => block.statements)
      .filter(row => row.kind === "assign" && row.tir.node === selection.left.id).length, 1);
    const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
      selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
    const value = choice => ({ kind: "boolean", type: body.tir.completion, value: choice });
    for (const first of [true, false]) for (const gate of [true, false]) for (const next of [true, false]) {
      const run = evaluate(deps, body.instance, body.mir, [first, gate, next].map(value), "compile-time",
        { query: "constValue", key: [body.instance, "compile-time"] });
      assert.equal(run.kind, "done");
      assert.equal(run.value.kind, "ok");
      assert.deepEqual(run.value.value, { kind: "value", value: value(first === (gate === take ? next : gate)) });
    }
    const missing = `export function fail(next: boolean): boolean { let gate: boolean; return gate ${operator} next; }`;
    const failed = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", missing));
    assert.equal(failed.kind, "refused");
    assert.equal(failed.diagnostics.length, 1);
    assert.equal(failed.diagnostics[0].code.rendered, "TSONIC_READ_BEFORE_INITIALIZATION");
    assert.deepEqual(failed.diagnostics[0].site.origin, { module: input.snapshot.entryPoint,
      start: missing.lastIndexOf("gate"), length: "gate".length, derived: [] });
  }
});

test("known Boolean selectors keep only the reachable result and still read the actual guard", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  for (const [operator, takesRight] of [["&&", true], ["||", false]]) {
    const skipped = !takesRight;
    const input = analysisInput(fixture, "sdk-minimal", `
      export function ignore(replacement: boolean, observed: boolean): boolean {
        ${skipped} ${operator} (observed = replacement);
        return observed;
      }
      export function select(replacement: boolean, observed: boolean): boolean {
        ${takesRight} ${operator} (observed = replacement);
        return observed;
      }
      export function retain(): boolean {
        let unready: boolean;
        return ${skipped} ${operator} unready;
      }
      export function keepGuard(guard: ${takesRight}, replacement: boolean): boolean {
        return guard ${operator} replacement;
      }
    `);
    const output = analyzeHostProgram(input);
    assert.equal(output.kind, "ok", JSON.stringify(output.diagnostics));
    const { index: { types }, modules } = output.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
      selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
    for (const [ordinal, declaration] of readyModuleStatements(readyModuleRoot(module.tree)).entries()) {
      const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
      const expression = body.tir.root.statements.nodes.at(-1).expression;
      assert.equal(body.mir.blocks.every(block => block.terminator.kind !== "switch"), true);
      const assigns = body.mir.blocks.flatMap(block => block.statements.filter(row => row.kind === "assign"));
      if (ordinal < 2) {
        const stores = assigns.filter(row => row.tir.node === body.tir.root.statements.nodes[0].expression.right.expression.id);
        assert.equal(stores.length, ordinal, operator);
      } else if (ordinal === 2) assert.equal(assigns.some(row => row.tir.node === expression.right.id), false, operator);
      else assert.equal(assigns.filter(row => row.tir.node === expression.left.id && row.value.kind === "use").length, 1, operator);
      const parameter = (position, value) => ({ kind: "boolean", type: body.tir.params[position].tsonic.storage, value });
      const args = ordinal === 2 ? [] : ordinal === 3 ? [parameter(0, takesRight), parameter(1, true)]
        : [parameter(0, true), parameter(1, false)];
      const run = evaluate(deps, body.instance, body.mir, args, "compile-time",
        { query: "constValue", key: [body.instance, "compile-time"] });
      assert.equal(run.kind, "done");
      assert.equal(run.value.kind, "ok");
      const expected = ordinal === 0 ? false : ordinal === 2 ? skipped : true;
      assert.deepEqual(run.value.value, { kind: "value", value: { kind: "boolean", type: body.tir.completion, value: expected } });
    }
    const missing = `export function fail(replacement: boolean): boolean { let guard: ${takesRight}; return guard ${operator} replacement; }`;
    const rejected = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", missing));
    assert.equal(rejected.kind, "refused");
    assert.equal(rejected.diagnostics.length, 1);
    assert.equal(rejected.diagnostics[0].code.rendered, "TSONIC_READ_BEFORE_INITIALIZATION");
    assert.deepEqual(rejected.diagnostics[0].site.origin, { module: input.snapshot.entryPoint,
      start: missing.lastIndexOf("guard"), length: "guard".length, derived: [] });
  }
});

test("selected Boolean arms retain their actual static reads and stores without attributing join copies as effects", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const initial = "export let state: boolean = false;";
  const cases = [
    { name: "choose", expression: "flag ? state : alternate", reads: ["state", "alternate"], writes: [], ownedCopies: 2 },
    { name: "retain", expression: "state || flag", reads: ["state"], writes: [], ownedCopies: 1 },
    { name: "take", expression: "flag && state", reads: ["state"], writes: [], ownedCopies: 1 },
    { name: "write", expression: "flag ? (state = alternate) : flag", reads: ["alternate"], writes: ["state"], ownedCopies: 1 },
  ];
  const source = initial + "export let alternate: boolean = true;" + cases.map(({ name, expression }) =>
    `export function ${name}(flag: boolean): boolean { return ${expression}; }`).join("\n");
  const input = analysisInput(fixture, "sdk-minimal", source);
  const output = analyzeHostProgram(input);
  assert.equal(output.kind, "ok", JSON.stringify(output.diagnostics));
  const module = output.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const functions = readyModuleStatements(readyModuleRoot(module.tree)).filter(row => row.kind === "FunctionDeclaration");
  assert.equal(functions.length, cases.length);
  for (const [index, declaration] of functions.entries()) {
    const { name, reads, writes, ownedCopies } = cases[index];
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    const expression = body.tir.root.statements.nodes[0].expression;
    const stores = body.mir.blocks.flatMap(block => block.statements.filter(row => row.kind === "assign" && row.value.kind === "use"));
    const staticAt = place => {
      const { base } = body.mir.places[place];
      return base.kind === "static" ? fixture.ids.decodeDefId(base.definition).value.segments.at(-1).name : null;
    };
    const accessed = stores.flatMap(row => row.value.operand.kind === "place" && staticAt(row.value.operand.place) !== null
      ? [staticAt(row.value.operand.place)] : []);
    const assigned = stores.flatMap(row => staticAt(row.place) === null ? [] : [staticAt(row.place)]);
    assert.deepEqual(accessed, reads, name);
    assert.deepEqual(assigned, writes, name);
    const copies = stores.filter(row => row.tir.node === expression.id);
    assert.equal(copies.length, ownedCopies, name);
    assert.equal(copies.every(row => staticAt(row.place) === null
      && row.value.operand.kind === "place" && staticAt(row.value.operand.place) === null), true, name);
  }
  const missing = source.replace(initial, "export let state: boolean;");
  const rejected = analyzeHostProgram({ ...input, snapshot: fixture.projectSnapshot({
    sourceFiles: { "main.ts": missing },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
    externalEntries: [{ module: input.snapshot.entryPoint, name: "choose" }],
  }) });
  assert.equal(rejected.kind, "refused");
  assert.equal(rejected.diagnostics.length, 1);
  const [diagnostic] = rejected.diagnostics;
  assert.equal(diagnostic.code.name, "TSONIC_STATIC_READ_BEFORE_INITIALIZATION");
  assert.deepEqual(diagnostic.site.origin, { module: input.snapshot.entryPoint,
    start: missing.indexOf("state : alternate"), length: "state".length, derived: [] });
});

test("native ternary selection preserves its authored arms and same-carrier result", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const floating = [0x8000000000000000n, 0x3fe0000000000000n, 0xbfd0000000000000n, 0x7ff8000000001234n];
  const text = ["", "e\u0301\u0000λ"];
  for (const [annotation, domain] of [
    ["boolean", [false, true]], ["boolean | null", [null, false, true]],
    ["number", floating], ["number | null", [null, ...floating]],
    ["string", text], ["string | null", [null, ...text]],
  ]) {
    const source = `
      export function effects(flag: boolean, yes: ${annotation}, no: ${annotation}, observed: ${annotation}): ${annotation} {
        flag ? (observed = yes) : (observed = no);
        return observed;
      }
      export function result(flag: boolean, yes: ${annotation}, no: ${annotation}): ${annotation} {
        return flag ? yes : no;
      }
      export function known(yes: ${annotation}, no: ${annotation}, observed: ${annotation}): ${annotation} {
        return false ? (observed = yes) : no;
      }
    `;
    const input = analysisInput(fixture, "sdk-minimal", source);
    const output = analyzeHostProgram(input);
    assert.equal(output.kind, "ok", JSON.stringify(output.diagnostics));
    const { index: { types }, modules } = output.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    for (const [ordinal, declaration] of readyModuleStatements(readyModuleRoot(module.tree)).entries()) {
      const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
      const expression = body.tir.root.statements.nodes[0].expression;
      const type = body.tir.completion;
      assert.equal(expression.kind, "ConditionalExpression");
      assert.equal(expression.questionToken.kind, "QuestionToken");
      assert.equal(expression.colonToken.kind, "ColonToken");
      assert.equal(expression.tsonic.type, type);
      if (annotation === "number") assert.deepEqual(types.terms[type], { kind: "primitive", primitive: "float64" });
      if (annotation === "string") assert.deepEqual(types.terms[type], { kind: "string" });
      if (annotation === "string | null" || annotation === "number | null") {
        assert.equal(types.terms[type].kind, "optional");
        assert.deepEqual(types.terms[types.terms[type].value], annotation === "string | null"
          ? { kind: "string" } : { kind: "primitive", primitive: "float64" });
      }
      assert.deepEqual(expression.tsonic.selection, { kind: "conditional", control: expression.condition.id,
        whenTrue: expression.whenTrue.id, whenFalse: expression.whenFalse.id, disposition: "dynamic" });
      assert.deepEqual(expression.whenTrue.tsonic.demand, { kind: "selected", control: expression.condition.id, when: "true" });
      assert.deepEqual(expression.whenFalse.tsonic.demand, { kind: "selected", control: expression.condition.id, when: "false" });
      const entry = body.mir.blocks[body.mir.entries.find(row => row.provided === body.tir.params.length).block];
      if (ordinal === 2) {
        assert.equal(entry.terminator.kind, "return");
        assert.ok(body.mir.blocks.every(block => block.statements.every(row => row.tir.node !== expression.whenTrue.expression.id)));
      } else {
        assert.equal(entry.terminator.kind, "switch");
        if (ordinal === 0) for (const [arm, target] of [[expression.whenTrue, entry.terminator.targets[0].target],
          [expression.whenFalse, entry.terminator.otherwise]]) {
          const effects = body.mir.blocks.filter(block => block.statements.some(row => row.kind === "assign" && row.tir.node === arm.expression.id));
          assert.deepEqual(effects.map(block => block.id), [target]);
        }
      }
      const value = item => item === null ? { kind: "absence", type }
        : typeof item === "boolean" ? { kind: "boolean", type, value: item }
          : typeof item === "string" ? { kind: "string", type, value: item } : { kind: "floating", type, bits: item };
      const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
        selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
      for (const flag of ordinal === 2 ? [false] : [false, true]) for (const yes of domain) for (const no of domain) {
        const operands = ordinal === 2 ? [value(yes), value(no), value(domain[0])] : [
          { kind: "boolean", type: expression.condition.tsonic.type, value: flag }, value(yes), value(no),
          ...(ordinal === 0 ? [value(domain[0])] : []),
        ];
        const run = evaluate(deps, body.instance, body.mir, operands, "compile-time",
          { query: "constValue", key: [body.instance, "compile-time"] });
        assert.equal(run.kind, "done");
        assert.equal(run.value.kind, "ok");
        assert.deepEqual(run.value.value, { kind: "value", value: value(flag ? yes : no) });
        assert.deepEqual(run.value.diagnostics, []);
      }
    }
  }
});

test("native literal Boolean switch dispatches once and preserves authored clause and transfer order", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export function fallthrough(flag: boolean, first: boolean, second: boolean): boolean {
      switch ((flag)) {
        default: first = second;
        case ((true)): break;
      }
      return first;
    }
    export function firstMatch(flag: boolean, first: boolean, second: boolean): boolean {
      switch (flag) {
        default: return second;
        case true: return first;
        case true: return second;
        case false: return first;
      }
    }
    export function asserted(flag: boolean, first: boolean, second: boolean): boolean {
      switch (flag) {
        default: return !first;
        case (true as true): first = second;
        case <true>true: return first;
        case (false satisfies false): return !second;
      }
    }
    export function unmatched(flag: boolean, first: boolean, second: boolean): boolean {
      switch (flag) { case false: return second; }
      return first;
    }
    export function shared(flag: boolean, first: boolean, second: boolean): boolean {
      switch (flag) { default: return second; }
    }
    export function known(flag: boolean, first: boolean, second: boolean): boolean {
      switch (false) { case false: return second; default: return first; }
    }
    export function empty(flag: boolean, first: boolean, second: boolean): boolean {
      switch (flag = !flag) {}
      return flag;
    }
    export function middle(flag: boolean, first: boolean, second: boolean): boolean {
      switch (flag) {
        case true: first = second;
        default: return first;
        case false: return first;
      }
    }
    export function transfers(flag: boolean, first: boolean, second: boolean): boolean {
      while (flag) {
        flag = false;
        switch (first) { case true: continue; default: break; }
        return second;
      }
      return first;
    }`);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  const expected = new Map([
    ["fallthrough", (flag, first, second) => flag ? first : second],
    ["firstMatch", (_flag, first) => first],
    ["asserted", (flag, _first, second) => flag ? second : !second],
    ["unmatched", (flag, first, second) => flag ? first : second],
    ["shared", (_flag, _first, second) => second],
    ["known", (_flag, _first, second) => second],
    ["empty", flag => !flag],
    ["middle", (flag, first, second) => flag ? second : first],
    ["transfers", (flag, first, second) => flag && !first ? second : first],
  ]);
  for (const declaration of readyModuleStatements(readyModuleRoot(module.tree))) {
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    const name = declaration.name.text;
    const outer = body.tir.root.statements.nodes[0];
    const statement = name === "transfers" ? outer.statement.statements.nodes[1] : outer;
    assert.equal(statement.kind, "SwitchStatement");
    const clauses = statement.caseBlock.clauses.nodes;
    const dispatches = body.mir.blocks.map(block => block.terminator).filter(row => row.kind === "switch" && row.tir.node === statement.id);
    assert.equal(dispatches.length, 1, name);
    const [dispatch] = dispatches;
    assert.equal(dispatch.targets.length, ["shared", "known", "empty"].includes(name) ? 0 : 1, name);
    if (name === "fallthrough") {
      assert.deepEqual(clauses.map(clause => clause.kind), ["DefaultClause", "CaseClause"]);
      const [fallback, matched] = clauses;
      assert.equal(matched.expression.expression.expression.kind, "TrueKeyword");
      const fallbackBlock = body.mir.blocks[dispatch.otherwise];
      assert.equal(fallbackBlock.statements.some(row => row.kind === "assign" && row.tir.node === fallback.statements.nodes[0].expression.id), true);
      assert.equal(fallbackBlock.terminator.kind, "goto");
      assert.equal(fallbackBlock.terminator.target, dispatch.targets[0].target);
      assert.deepEqual(matched.statements.nodes[0].tsonic.target, { body: body.instance.body, node: statement.id });
    }
    if (name === "firstMatch")
      for (const index of [0, 2])
        assert.equal(body.mir.blocks.some(block => block.terminator.tir.node === clauses[index].statements.nodes[0].id), false);
    if (name === "asserted") {
      const [fallback, source, duplicate, opposite] = clauses;
      assert.deepEqual([source.expression.expression.kind, duplicate.expression.kind, opposite.expression.expression.kind],
        ["AsExpression", "TypeAssertionExpression", "SatisfiesExpression"]);
      assert.equal(body.mir.blocks.some(block => block.terminator.tir.node === fallback.statements.nodes[0].id), false);
      const matched = body.mir.blocks[dispatch.targets[0].target];
      assert.equal(matched.statements.filter(row => row.tir.node === source.statements.nodes[0].expression.id).length, 1);
      assert.equal(matched.terminator.kind, "goto");
      assert.equal(body.mir.blocks[matched.terminator.target].terminator.tir.node, duplicate.statements.nodes[0].id);
      assert.equal(body.mir.blocks[dispatch.otherwise].terminator.tir.node, opposite.statements.nodes[0].id);
    }
    if (name === "middle") {
      const taken = body.mir.blocks[dispatch.targets[0].target].terminator;
      assert.equal(taken.kind, "goto");
      assert.equal(body.mir.blocks[taken.target].terminator.tir.node, clauses[1].statements.nodes[0].id);
      assert.equal(body.mir.blocks[dispatch.otherwise].terminator.tir.node, clauses[2].statements.nodes[0].id);
    }
    if (name === "transfers") {
      assert.deepEqual(clauses[0].statements.nodes[0].tsonic.target, { body: body.instance.body, node: outer.id });
      assert.deepEqual(clauses[1].statements.nodes[0].tsonic.target, { body: body.instance.body, node: statement.id });
    }
    const literal = value => ({ kind: "boolean", type: body.tir.completion, value });
    for (const flag of [false, true]) for (const first of [false, true]) for (const second of [false, true]) {
      const run = evaluate(deps, body.instance, body.mir, [flag, first, second].map(literal), "compile-time",
        { query: "constValue", key: [body.instance, "compile-time"] });
      assert.equal(run.kind, "done", name);
      assert.equal(run.value.kind, "ok", name);
      assert.deepEqual(run.value.value, { kind: "value", value: literal(expected.get(name)(flag, first, second)) }, name);
      assert.deepEqual(run.value.diagnostics, []);
    }
  }
  const uninitialized = analyzeHostProgram(analysisInput(fixture, "sdk-minimal",
    "export function read(flag: boolean): boolean { var scratch: boolean; switch (scratch) {} return flag; }"));
  assert.equal(uninitialized.kind, "refused");
  assert.equal(uninitialized.diagnostics.some(diagnostic => diagnostic.code.rendered === "TSONIC_READ_BEFORE_INITIALIZATION"), true);
  const effectful = analysisInput(fixture, "sdk-minimal",
    "export function read(flag: boolean, other: boolean): boolean { switch (flag) { case (other = true): return other; default: return false; } }");
  const dynamic = analyzeHostProgram(effectful);
  assert.equal(dynamic.kind, "ok", JSON.stringify(dynamic.diagnostics));
  const selected = dynamic.value.modules.find(row => row.module === effectful.snapshot.entryPoint).bodies
    .find(row => row.kind === "selected" && row.tir.root.kind === "Block");
  const comparison = selected.mir.blocks.flatMap(block => block.statements)
    .filter(row => row.kind === "assign" && row.value.kind === "binary");
  assert.equal(comparison.length, 1);
  const selectedTypes = dynamic.value.index.types;
  const ready = { ...deps, types: selectedTypes, typeOf: id => selectedTypes.terms[id], signatureOf: id => selectedTypes.signatures[id] };
  for (const flag of [false, true]) for (const other of [false, true]) {
    const literal = value => ({ kind: "boolean", type: selected.tir.completion, value });
    const run = evaluate(ready, selected.instance, selected.mir, [literal(flag), literal(other)], "compile-time",
      { query: "constValue", key: [selected.instance, "compile-time"] });
    assert.equal(run.kind, "done");
    assert.equal(run.value.kind, "ok");
    assert.deepEqual(run.value.value, { kind: "value", value: literal(flag) });
  }
});

test("native string and Float64 coalescing branches only on their selected absence", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  for (const [carrier, first, second] of [
    ["string", { kind: "string", value: "" }, { kind: "string", value: "λ\u0000" }],
    ["number", { kind: "floating", bits: 0x8000000000000000n }, { kind: "floating", bits: 0x7ff8000000001234n }],
  ]) {
    const optional = `${carrier} | null`;
    const input = analysisInput(fixture, "sdk-minimal", `
      export function select(left: ${optional}, right: ${optional}): ${optional} { return left ?? right; }
      export function assign(left: ${optional}, right: ${optional}): ${optional} { return left ??= right; }
      export function effect(left: ${optional}, right: ${optional}, observed: ${optional}): ${optional} {
        left ??= (observed = right);
        return observed;
      }
    `);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { index: { types }, modules } = result.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
      selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
    for (const declaration of readyModuleStatements(readyModuleRoot(module.tree))) {
      const name = declaration.name.text;
      const body = module.bodies.find(row => row.kind === "selected" && row.tir.owner === declaration.tsonic.definition);
      const statement = body.tir.root.statements.nodes[0];
      const expression = statement.expression;
      const type = body.tir.completion;
      assert.deepEqual(expression.tsonic.selection, { kind: "coalesce", control: expression.left.id, right: expression.right.id, disposition: "dynamic" });
      assert.deepEqual(expression.right.tsonic.demand, { kind: "selected", control: expression.left.id, when: "absent" });
      assert.equal(types.terms[type].kind, "optional");
      const dispatch = body.mir.blocks.find(row => row.terminator.kind === "switch");
      assert.equal(dispatch.terminator.targets.length, 1);
      const [target] = dispatch.terminator.targets;
      assert.deepEqual(body.mir.constants[target.constant], { id: target.constant, type, value: { kind: "literal", value: { kind: "absence" } } });
      if (name !== "select") {
        const reads = dispatch.statements.filter(row => row.kind === "assign" && row.tir.node === expression.left.id);
        assert.equal(reads.length, 1);
        const [snapshot] = reads;
        assert.deepEqual(dispatch.terminator.operand, { kind: "place", place: snapshot.place });
        const destination = snapshot.value.operand.place;
        const stores = body.mir.blocks.filter(row => row.statements.some(store => store.kind === "assign"
          && store.tir.node === expression.id && store.place === destination));
        assert.deepEqual(stores.map(row => row.id), [target.target]);
      }
      if (name === "effect") {
        const effects = body.mir.blocks.filter(row => row.statements.some(store => store.kind === "assign"
          && store.tir.node === expression.right.expression.id));
        assert.deepEqual(effects.map(row => row.id), [target.target]);
      }
      const absence = { kind: "absence" };
      const unit = { query: "constValue", key: [body.instance, "compile-time"] };
      for (const left of [first, second, absence]) for (const right of [second, absence]) {
        const operands = (name === "effect" ? [left, right, first] : [left, right]).map(value => ({ ...value, type }));
        const expected = left === absence ? right : name === "effect" ? first : left;
        const run = evaluate(deps, body.instance, body.mir, operands, "compile-time", unit);
        assert.equal(run.kind, "done");
        assert.equal(run.value.kind, "ok");
        assert.deepEqual(run.value.value, { kind: "value", value: { ...expected, type } });
      }
    }
  }
});

test("Evaluate materializes a selected exact Float64 literal without rounding", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const authored = [
    ["zero", "0", 0n],
    ["fraction", "1.25", 0x3ff4000000000000n],
    ["wide", "9_007_199_254_740_994", 0x4340000000000001n],
  ];
  const input = analysisInput(fixture, "sdk-minimal", authored.map(([name, token]) =>
    `export function ${name}(): number { return ${token}; }`).join("\n"));
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  for (const [position, [name, token, bits]] of authored.entries()) {
    const declaration = readyModuleStatements(readyModuleRoot(module.tree))[position];
    assert.equal(declaration.name.text, name);
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    const type = body.tir.completion;
    assert.deepEqual(types.terms[type], { kind: "primitive", primitive: "float64" });
    const conversions = body.mir.blocks.flatMap(block => block.statements).filter(row => row.kind === "assign" && row.value.kind === "convert");
    assert.equal(conversions.length, 1, name);
    const [conversion] = conversions;
    const { from, to, embedding } = conversion.value.operation.decision.operation;
    assert.equal(body.mir.constants[conversion.value.operand.constant].value.value.token, token);
    assert.equal(body.mir.constants[conversion.value.operand.constant].type, from);
    assert.equal(to, type);
    assert.equal(embedding.conversion, "literal-fit");
    assert.deepEqual(embedding.check, { kind: "none" });
    const run = evaluate(deps, body.instance, body.mir, [], "compile-time",
      { query: "constValue", key: [body.instance, "compile-time"] });
    assert.equal(run.kind, "done");
    assert.equal(run.value.kind, "ok");
    assert.deepEqual(run.value.value, { kind: "value", value: { kind: "floating", type, bits } });
    assert.deepEqual(run.value.diagnostics, []);
  }
  for (const token of ["0.1", "9_007_199_254_740_993"]) {
    const inexact = analysisInput(fixture, "sdk-minimal", `export function inexact(): number { return ${token}; }`);
    assert.throws(() => analyzeHostProgram(inexact), /embedding of literal into float64/u);
  }
});

test("a contextual Float64 assignment produces native bits before the stored value is used", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export function read(): number { let value: number; value = ((1.25)); return value; }
    export function compare(other: number): boolean { let value: number; value = 1.25; return value < other; }
    export let published: number;
    published = ((1.25));
    export const observed: number = published;
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  const verifyAssignment = (body, assignment, placeKind) => {
    const storage = assignment.left.tsonic.access.storage;
    assert.deepEqual(types.terms[storage], { kind: "primitive", primitive: "float64" });
    const statements = body.mir.blocks.flatMap(block => block.statements);
    const stores = statements.filter(row => row.kind === "assign" && row.tir.node === assignment.id);
    assert.equal(stores.length, 1);
    const [store] = stores;
    assert.equal(store.value.kind, "use");
    const place = body.mir.places[store.place];
    assert.equal(place.storage, storage);
    assert.equal(place.base.kind, placeKind);
    if (placeKind === "static") assert.equal(place.base.definition, assignment.left.tsonic.resolution.declaration.owner);
    assert.equal(store.value.operand.kind, "place");
    const conversions = statements.filter(row => row.kind === "assign" && row.value.kind === "convert");
    assert.equal(conversions.length, 1);
    const [conversion] = conversions;
    assert.equal(conversion.place, store.value.operand.place);
    assert.equal(conversion.tir.node, assignment.right.id);
    assert.equal(statements.indexOf(conversion) < statements.indexOf(store), true);
    assert.equal(conversion.value.operand.kind, "constant");
    const { from, to, embedding } = conversion.value.operation.decision.operation;
    assert.equal(embedding.conversion, "literal-fit");
    assert.deepEqual(embedding.check, { kind: "none" });
    assert.equal(to, storage);
    assert.equal(types.terms[from].base, storage);
    const constant = body.mir.constants[conversion.value.operand.constant];
    assert.deepEqual(constant.value, {
      kind: "literal", value: { kind: "number", token: "1.25", value: { numerator: 5n, denominator: 4n, negativeZero: false } },
    });
    assert.equal(constant.type, from);
    return { storage, store };
  };
  for (const declaration of readyModuleStatements(readyModuleRoot(module.tree)).filter(row => row.kind === "FunctionDeclaration")) {
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    const { storage } = verifyAssignment(body, body.tir.root.statements.nodes[1].expression, "local");
    const run = arguments_ => evaluate(deps, body.instance, body.mir, arguments_, "compile-time",
      { query: "constValue", key: [body.instance, "compile-time"] });
    const expect = (arguments_, value) => {
      const outcome = run(arguments_);
      assert.equal(outcome.kind, "done");
      assert.equal(outcome.value.kind, "ok");
      assert.deepEqual(outcome.value.value, { kind: "value", value });
      assert.deepEqual(outcome.value.diagnostics, []);
    };
    if (declaration.name.text === "read") expect([], { kind: "floating", type: storage, bits: 0x3ff4000000000000n });
    else for (const [bits, value] of [[0x3ff0000000000000n, false], [0x3ff4000000000000n, false], [0x3ff8000000000000n, true]])
      expect([{ kind: "floating", type: storage, bits }], { kind: "boolean", type: body.tir.completion, value });
  }
  const moduleBody = module.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "SourceFile");
  const authoredStore = readyModuleStatements(moduleBody.tir.root).find(row => row.kind === "ExpressionStatement");
  const { store } = verifyAssignment(moduleBody, authoredStore.expression, "static");
  const initialized = moduleBody.mir.blocks.find(block => block.statements.includes(store)).terminator;
  assert.equal(initialized.kind, "call");
  assert.equal(initialized.callee.kind, "body");
  assert.notEqual(initialized.callee.instance.body, moduleBody.instance.body);
  for (const token of ["0.1", "9_007_199_254_740_993"]) {
    const inexact = analysisInput(fixture, "sdk-minimal",
      `export function inexact(): number { let value: number; value = ((${token})); return value; }`);
    assert.throws(() => analyzeHostProgram(inexact), /embedding of literal into float64/u);
  }
  const exact = analysisInput(fixture, "sdk-minimal",
    "export function exact(): number { let value: number; value = 1.25; return value; }");
  const unavailable = { ...exact, snapshot: { ...exact.snapshot, nativeFacts: { ...exact.snapshot.nativeFacts, floatingFormats: [] } } };
  assert.throws(() => analyzeHostProgram(unavailable), /embedding of literal into float64/u);
});

test("fixed Float64 formals receive their authored exact literal values before the selected call", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate, resumeEvaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const inputFor = second => analysisInput(fixture, "sdk-minimal", `
    export function take(first: number, second: number): number { return second; }
    export function run(): number { return take(1.25, ${second}); }
  `);
  const input = inputFor("1.5");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [callee, caller] = readyModuleStatements(readyModuleRoot(module.tree)).map(declaration =>
    module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body));
  const call = caller.tir.root.statements.nodes[0].expression;
  const { decision } = call.tsonic.application;
  assert.deepEqual(decision.callee.activation, callee.instance);
  const arguments_ = call.arguments.nodes;
  assert.deepEqual(decision.arguments, arguments_.map((argument, parameter) =>
    ({ kind: "provided", parameter, expression: argument.id })));
  const { parameters } = types.signatures[decision.callee.decision.completion.signature];
  const block = caller.mir.blocks.find(row => row.terminator.kind === "call");
  assert.equal(block.terminator.tir.node, call.id);
  const conversions = block.statements.filter(row => row.kind === "assign" && row.value.kind === "convert");
  assert.deepEqual(conversions.map(row => row.tir.node), arguments_.map(argument => argument.id));
  assert.deepEqual(block.terminator.arguments, conversions.map(row =>
    ({ kind: "value", passing: "by-value", operand: { kind: "place", place: row.place } })));
  for (const [index, row] of conversions.entries()) {
    const { from, to, embedding } = row.value.operation.decision.operation;
    const { type, declaration } = parameters[index];
    assert.equal(declaration, callee.tir.params[index].tsonic.declaration);
    assert.equal(to, type);
    assert.deepEqual(types.terms[to], { kind: "primitive", primitive: "float64" });
    assert.equal(embedding.conversion, "literal-fit");
    assert.deepEqual(embedding.check, { kind: "none" });
    assert.equal(row.value.operand.kind, "constant");
    const constant = caller.mir.constants[row.value.operand.constant];
    assert.equal(constant.type, from);
    assert.equal(constant.value.value.token, ["1.25", "1.5"][index]);
  }
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  const initial = evaluate(deps, caller.instance, caller.mir, [], "compile-time",
    { query: "constValue", key: [caller.instance, "compile-time"] });
  assert.equal(initial.kind, "paused");
  const run = resumeEvaluate(deps, initial.paused, [{ kind: "mir-body", body: callee.mir }]);
  assert.equal(run.kind, "done");
  assert.equal(run.value.kind, "ok");
  assert.deepEqual(run.value.diagnostics, []);
  assert.deepEqual(run.value.value, { kind: "value", value: { kind: "floating", type: caller.tir.completion, bits: 0x3ff8000000000000n } });
  assert.throws(() => analyzeHostProgram(inputFor("0.1")), /actual selected argument embedding contribution/u);
});

test("Evaluate consumes the selected optional embedding without changing a native payload", checkOptionalEmbedding);

test("case-free switches evaluate the authored subject once without selecting a comparison", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export function empty(value: number, next: number): number {
      switch (value = next) {}
      return value;
    }
    export function justDefault(value: number, next: number): number {
      switch (value = next) { default: return value; }
    }
    export function reference(value: string): string {
      switch (value) { default: return value; }
    }
    export function boolean(value: boolean): boolean {
      switch (value) {}
      return value;
    }
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  for (const declaration of readyModuleStatements(readyModuleRoot(module.tree))) {
    const name = declaration.name.text;
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    const statement = body.tir.root.statements.nodes[0];
    assert.equal(statement.kind, "SwitchStatement");
    const blocks = body.mir.blocks.filter(row => row.terminator.kind === "switch" && row.terminator.tir.node === statement.id);
    assert.equal(blocks.length, 1);
    const [block] = blocks;
    assert.deepEqual(block.terminator.targets, []);
    assert.deepEqual(body.mir.constants, []);
    assert.equal(block.terminator.operand.kind, "place");
    const scalarAssignment = name === "empty" || name === "justDefault";
    const stores = body.mir.blocks.flatMap(row => row.statements)
      .filter(row => row.kind === "assign" && row.tir.node === statement.expression.id);
    assert.equal(stores.length, scalarAssignment ? 1 : 0);
    if (scalarAssignment) assert.equal(block.statements.includes(stores[0]), true);
    const type = body.tir.completion;
    const operands = scalarAssignment ? [0x3ff0000000000000n, 0x8000000000000000n].map(bits => ({ kind: "floating", type, bits }))
      : name === "reference" ? [{ kind: "string", type, value: "aλ" }] : [{ kind: "boolean", type, value: false }];
    const run = evaluate(deps, body.instance, body.mir, operands, "compile-time",
      { query: "constValue", key: [body.instance, "compile-time"] });
    assert.equal(run.kind, "done");
    assert.equal(run.value.kind, "ok", JSON.stringify(run.value.diagnostics));
    assert.deepEqual(run.value.value, { kind: "value", value: operands.at(-1) });
  }
  const uninitialized = analyzeHostProgram(analysisInput(fixture, "sdk-minimal",
    "export function read(): void { var scratch: number; switch (scratch) { default: return; } }"));
  assert.equal(uninitialized.kind, "refused");
  assert.equal(uninitialized.diagnostics.some(diagnostic => diagnostic.code.rendered === "TSONIC_READ_BEFORE_INITIALIZATION"), true);
  const needsComparison = analysisInput(fixture, "sdk-minimal",
    "export function read(value: number): boolean { switch (value) { case 0: return true; default: return false; } }");
  const numeric = analyzeHostProgram(needsComparison);
  assert.equal(numeric.kind, "ok", JSON.stringify(numeric.diagnostics));
  const selected = numeric.value.modules.find(row => row.module === needsComparison.snapshot.entryPoint).bodies
    .find(row => row.kind === "selected" && row.tir.root.kind === "Block");
  const selectedTypes = numeric.value.index.types;
  const ready = { ...deps, types: selectedTypes, typeOf: id => selectedTypes.terms[id], signatureOf: id => selectedTypes.signatures[id] };
  for (const [bits, value] of [[0n, true], [0x8000000000000000n, true],
    [0x3ff0000000000000n, false], [0x7ff8000000000000n, false]]) {
    const run = evaluate(ready, selected.instance, selected.mir, [{ kind: "floating", type: selected.tir.params[0].tsonic.storage, bits }],
      "compile-time", { query: "constValue", key: [selected.instance, "compile-time"] });
    assert.equal(run.kind, "done");
    assert.equal(run.value.kind, "ok");
    assert.deepEqual(run.value.value, { kind: "value", value: { kind: "boolean", type: selected.tir.completion, value } });
  }
});

test("authored empty loop bodies preserve each form's actual control and effects without an instruction", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export function emptyFor(flag: boolean): boolean { ; for (; flag; flag = false) ; return flag; }
    export function emptyWhile(flag: boolean): boolean { ; while (flag = !flag) ; return flag; }
    export function emptyDo(flag: boolean): boolean { ; do ; while (flag = false); return flag; }
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  for (const [ordinal, declaration] of readyModuleStatements(readyModuleRoot(module.tree)).entries()) {
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    const [empty, loop] = body.tir.root.statements.nodes;
    assert.equal(loop.kind, ["ForStatement", "WhileStatement", "DoStatement"][ordinal]);
    for (const node of [empty, loop.statement]) {
      assert.equal(node.kind, "EmptyStatement");
      assert.equal(node.tsonic, null);
      assert.equal(body.mir.blocks.some(block => block.statements.some(row => row.tir.node === node.id)), false);
    }
    const literal = value => ({ kind: "boolean", type: body.tir.completion, value });
    for (const flag of [false, true]) {
      const run = evaluate(deps, body.instance, body.mir, [literal(flag)], "compile-time",
        { query: "constValue", key: [body.instance, "compile-time"] });
      assert.equal(run.kind, "done");
      assert.equal(run.value.kind, "ok");
      assert.deepEqual(run.value.value, { kind: "value", value: literal(false) });
    }
  }
});

test("module-level empty statements survive publication without adding executable work", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { parseModuleBodies, printModuleBodies } = await import("../../packages/host/dist/ir-program/index.js");
  const run = source => {
    const input = analysisInput(fixture, "sdk-minimal", source);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { index, modules } = result.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === readyModuleRoot(module.tree).tsonic.template.body);
    const text = printModuleBodies(index, module);
    const parsed = parseModuleBodies(index, text);
    assert.equal(parsed.kind, "parsed");
    assert.equal(printModuleBodies(index, parsed.value), text);
    return { index, module, body, statements: body.mir.blocks.flatMap(block => block.statements) };
  };

  const plain = "export let state: boolean; state = true; export const observed: boolean = state;";
  const withEmpties = ";;\r\nexport let state: boolean;\r\n; state = true;\r\n; export const observed: boolean = state;\r\n;";
  for (const [source, count, effects] of [["", 0, false], [";\r\n;;", 3, false], [withEmpties, 5, true]]) {
    const { index, module, body, statements } = run(source);
    const empty = readyModuleStatements(readyModuleRoot(module.tree)).filter(statement => statement.kind === "EmptyStatement");
    const spans = source === withEmpties ? [0, 1, source.indexOf("\r\n; state") + 2,
      source.indexOf("\r\n; export") + 2, source.length - 1] : source === "" ? [] : [0, 3, 4];
    assert.equal(empty.length, count);
    assert.deepEqual(empty.map(node => node.origin.start), spans);
    const template = module.bodies.find(row => row.kind === "template" && row.instance.body === body.instance.body);
    assert.equal(template.tir.root === readyModuleRoot(module.tree), true);
    assert.deepEqual(readyModuleStatements(body.tir.root).filter(statement => statement.kind === "EmptyStatement"), empty);
    for (const node of empty) {
      assert.equal(node.tsonic, null);
      assert.equal(node.origin.length, 1);
      assert.equal(source.slice(node.origin.start, node.origin.start + node.origin.length), ";");
      assert.equal(statements.some(row => row.tir.node === node.id), false);
      assert.equal(body.mir.blocks.some(block => block.terminator.tir.node === node.id), false);
    }
    if (!effects) {
      assert.equal(body.mir.constants.length, 0);
      assert.equal(body.mir.places.length, 0);
      assert.deepEqual(statements, []);
      assert.deepEqual(body.mir.blocks.map(block => block.terminator.kind), ["return"]);
    } else {
      const write = readyModuleStatements(readyModuleRoot(module.tree)).find(statement => statement.kind === "ExpressionStatement").expression;
      const store = statements.find(row => row.tir.node === write.id);
      assert.equal(store.kind, "assign");
      assert.deepEqual(body.mir.places[store.place].base, { kind: "static", definition: write.left.tsonic.resolution.declaration.owner });
      assert.equal(body.mir.blocks.find(block => block.statements.includes(store)).terminator.callee.kind, "body");
      const without = run(plain);
      assert.deepEqual(body.mir.blocks.map(block => [block.statements.map(row => row.kind), block.terminator.kind]),
        without.body.mir.blocks.map(block => [block.statements.map(row => row.kind), block.terminator.kind]));
      assert.deepEqual(index.initialization.modules, without.index.initialization.modules);
    }
  }
});

test("lexical type-only declarations survive publication without runtime work", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { parseModuleBodies, printModuleBodies } = await import("../../packages/host/dist/ir-program/index.js");
  const source = `export function read(input: boolean): boolean {
    type Outer = boolean;
    {
      interface Shape { ready: Outer }
      type Local = Shape["ready"];
      const stored: Local = input;
      return stored;
    }
  }`;
  const run = text => {
    const input = analysisInput(fixture, "sdk-minimal", text);
    return { input, result: analyzeHostProgram(input) };
  };
  const { input, result } = run(source);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const callable = readyModuleStatements(readyModuleRoot(module.tree)).find(node => node.kind === "FunctionDeclaration");
  const selected = module.bodies.find(row => row.kind === "selected" && row.tir.owner === callable.tsonic.definition);
  const [outer, block] = selected.tir.root.statements.nodes;
  const [shape, local, variable] = block.statements.nodes;
  assert.deepEqual([outer.kind, shape.kind, local.kind], ["TypeAliasDeclaration", "InterfaceDeclaration", "TypeAliasDeclaration"]);
  assert.equal(shape.members.nodes[0].type.tsonic.type, outer.tsonic.type);
  assert.equal(variable.declarationList.declarations.nodes[0].type.tsonic.type, local.tsonic.type);
  assert.equal(new Set([outer.tsonic.definition, shape.tsonic.definition, local.tsonic.definition]).size, 3);
  const checkNoRuntimeWork = (module, selected, node) => {
    assert.equal(node.origin.module === module.module, true);
    assert.equal(selected.mir.blocks.some(row => row.terminator.tir.node === node.id
      || row.statements.some(statement => statement.tir.node === node.id)), false);
  };
  for (const node of [outer, shape, local]) checkNoRuntimeWork(module, selected, node);
  const artifact = printModuleBodies(index, module);
  const parsed = parseModuleBodies(index, artifact);
  assert.equal(parsed.kind, "parsed");
  assert.equal(printModuleBodies(index, parsed.value), artifact);

  const inSwitch = run(`export function read(input: boolean): boolean {
    switch (input) {
      case true: type Present = boolean; return input;
      default: interface Absent { value: boolean } return input;
    }
  }`);
  assert.equal(inSwitch.result.kind, "ok", JSON.stringify(inSwitch.result.diagnostics));
  const switchModule = inSwitch.result.value.modules.find(row => row.module === inSwitch.input.snapshot.entryPoint);
  const switchCallable = readyModuleStatements(readyModuleRoot(switchModule.tree)).find(node => node.kind === "FunctionDeclaration");
  const switchBody = switchModule.bodies.find(row => row.kind === "selected" && row.tir.owner === switchCallable.tsonic.definition);
  const selection = switchBody.tir.root.statements.nodes[0];
  const declarations = selection.caseBlock.clauses.nodes.map(clause => clause.statements.nodes[0]);
  assert.deepEqual(declarations.map(node => node.kind), ["TypeAliasDeclaration", "InterfaceDeclaration"]);
  for (const node of declarations) checkNoRuntimeWork(switchModule, switchBody, node);

  for (const invalid of ["type Bad = Missing;", "interface Bad { value: Missing }"]) {
    const text = `export function read(input: boolean): boolean { ${invalid} return input; }`;
    const { result: rejected } = run(text);
    assert.equal(rejected.kind, "refused");
    assert.equal("value" in rejected, false);
    assert.deepEqual(rejected.diagnostics.map(diagnostic => diagnostic.code.number), [2304]);
    const origin = rejected.diagnostics[0].site.origin;
    assert.equal(text.slice(origin.start, origin.start + origin.length), "Missing");
  }
  for (const declaration of ["type Invalid = boolean;", "interface Invalid { ready: boolean }"]) {
    assert.throws(() => run(`export function read(input: boolean): boolean { if (input) ${declaration} return input; }`),
      /ConstraintsOf: a (TypeAliasDeclaration|InterfaceDeclaration) is not inferred yet/);
  }
});

test("labelled native transfers retain their actual lexical targets across nested controls", checkLabelledTransfers);

test("authored same-carrier assertions preserve the operand and written type exactly once", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const kinds = new Map([
    ["AsExpression", (value, type) => `${value} as ${type}`],
    ["TypeAssertionExpression", (value, type) => `<${type}>${value}`],
    ["SatisfiesExpression", (value, type) => `${value} satisfies ${type}`],
  ]);
  const domains = [
    { annotation: "boolean", expression: "(value = !value)", values: [{ kind: "boolean", value: false }, { kind: "boolean", value: true }],
      expected: value => ({ ...value, value: !value.value }) },
    { annotation: "number", expression: "value", values: [
      { kind: "floating", bits: 0x8000000000000000n }, { kind: "floating", bits: 0x7ff8000000001234n },
      { kind: "floating", bits: 0x3ff8000000000000n },
    ], expected: value => value },
    { annotation: "string", expression: "value", values: [{ kind: "string", value: "" }, { kind: "string", value: "α🌱" }],
      expected: value => value },
  ];
  const authored = domains.flatMap(domain => [...kinds].map(([kind, wrap]) => ({
    ...domain, kind, source: `export function select${domain.annotation}${kind}(value: ${domain.annotation}): ${domain.annotation} {
      return ${wrap(domain.expression, domain.annotation)};
    }`,
  })));
  const input = analysisInput(fixture, "sdk-minimal", authored.map(row => row.source).join("\n"));
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  assert.equal(readyModuleStatements(readyModuleRoot(module.tree)).length, authored.length);
  for (const [index, declaration] of readyModuleStatements(readyModuleRoot(module.tree)).entries()) {
    const { kind, annotation, values, expected } = authored[index];
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    const wrapper = body.tir.root.statements.nodes[0].expression;
    const type = body.tir.completion;
    assert.equal(wrapper.kind, kind);
    assert.equal(wrapper.type.tsonic.type, type);
    assert.deepEqual(wrapper.tsonic.conversion, { kind: "identity" });
    assert.equal(wrapper.tsonic.narrowing, null);
    assert.equal(wrapper.expression.tsonic.convertedType, type);
    const statements = body.mir.blocks.flatMap(block => block.statements);
    assert.equal(statements.some(row => row.tir.node === wrapper.id), false);
    if (annotation === "boolean") {
      const assignment = wrapper.expression.expression;
      assert.equal(statements.filter(row => row.kind === "assign" && row.tir.node === assignment.id).length, 1);
    } else assert.deepEqual(statements, []);
    for (const value of values) {
      const run = evaluate(deps, body.instance, body.mir, [{ ...value, type }], "compile-time",
        { query: "constValue", key: [body.instance, "compile-time"] });
      assert.equal(run.kind, "done");
      assert.equal(run.value.kind, "ok");
      assert.deepEqual(run.value.value, { kind: "value", value: { ...expected(value), type } });
      assert.deepEqual(run.value.diagnostics, []);
    }
  }
  assert.throws(() => analyzeHostProgram(analysisInput(fixture, "sdk-minimal",
    "export function cast(): boolean { return true as boolean; }")),
  /assertion without the same selected operand, target and result type/);
  assert.throws(() => analyzeHostProgram(analysisInput(fixture, "sdk-minimal",
    "export function narrower(): boolean { return true satisfies boolean; }")),
  /assertion without the same ready authored target and checked result/);
  for (const wrap of kinds.values()) {
    const text = `export function missing(value: boolean): boolean { return ${wrap("value", "Missing")}; }`;
    const rejected = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", text));
    assert.equal(rejected.kind, "refused");
    assert.deepEqual(rejected.diagnostics.map(row => row.code), [{ kind: "checker", number: 2304, rendered: "TS2304" }]);
    const site = rejected.diagnostics[0].site;
    assert.equal(site.kind, "source");
    assert.equal(site.origin.start, text.indexOf("Missing"));
    assert.equal(site.origin.length, "Missing".length);
  }
});

test("non-null assertions over already-present native values preserve the operand without a check", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate, resumeEvaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const { verifyOccurrenceOperation } = await import("../../packages/host/dist/ir-tir/verify-occurrences.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    function toggle(flag: boolean): boolean { return !flag; }
    export function call(flag: boolean): boolean { return ((toggle(flag)))!; }
    export function store(flag: boolean): boolean { return (flag = !flag)!; }
    export function bits(value: number): number { return value!; }
    export function text(value: string): string { return value!; }
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [toggle, ...callers] = readyModuleStatements(readyModuleRoot(module.tree)).map(declaration =>
    module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body));
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  const arguments_ = [
    [{ kind: "boolean", value: false }, { kind: "boolean", value: true }],
    [{ kind: "boolean", value: false }, { kind: "boolean", value: true }],
    [{ kind: "floating", bits: 0x8000000000000000n }, { kind: "floating", bits: 0x7ff8000000001234n }],
    [{ kind: "string", value: "" }, { kind: "string", value: "α🌱" }],
  ];
  for (const [index, body] of callers.entries()) {
    const wrapper = body.tir.root.statements.nodes[0].expression;
    assert.equal(wrapper.kind, "NonNullExpression");
    assert.equal(wrapper.tsonic.type, body.tir.completion);
    assert.equal(wrapper.expression.tsonic.convertedType, wrapper.tsonic.type);
    assert.equal(wrapper.tsonic.narrowing, null);
    assert.deepEqual(wrapper.tsonic.conversion, { kind: "identity" });
    const statements = body.mir.blocks.flatMap(block => block.statements);
    assert.equal(statements.some(row => row.tir.node === wrapper.id), false);
    if (index === 1)
      assert.equal(statements.filter(row => row.kind === "assign" && row.tir.node === wrapper.expression.expression.id).length, 1);
    if (index >= 2) assert.deepEqual(statements, []);
    const invalid = structuredClone(wrapper);
    invalid.expression.tsonic.convertedType = toggle.tir.completion === body.tir.completion
      ? callers[2].tir.completion : toggle.tir.completion;
    const findings = [];
    verifyOccurrenceOperation(invalid, types, null, rule => findings.push(rule));
    assert.deepEqual(findings, ["operation-type"]);
    const calls = body.mir.blocks.filter(block => block.terminator.kind === "call");
    assert.equal(calls.length, index === 0 ? 1 : 0);
    for (const actual of arguments_[index]) {
      const argument = { ...actual, type: body.tir.params[0].tsonic.storage };
      const initial = evaluate(deps, body.instance, body.mir, [argument], "compile-time",
        { query: "constValue", key: [body.instance, "compile-time"] });
      assert.equal(initial.kind, index === 0 ? "paused" : "done");
      const run = initial.kind === "paused"
        ? resumeEvaluate(deps, initial.paused, [{ kind: "mir-body", body: toggle.mir }]) : initial;
      assert.equal(run.kind, "done");
      assert.equal(run.value.kind, "ok");
      assert.deepEqual(run.value.diagnostics, []);
      assert.deepEqual(run.value.value, { kind: "value", value: actual.kind === "boolean" ? { ...argument, value: !actual.value } : argument });
    }
  }
  const optional = analysisInput(fixture, "sdk-minimal", "export function needsPresence(flag?: boolean): boolean { return flag!; }");
  assert.throws(() => analyzeHostProgram(optional), /non-null assertion without an already-present native operand/u);
  const missing = "export function missingName(): boolean { return missing!; }";
  const rejected = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", missing));
  assert.equal(rejected.kind, "refused");
  assert.deepEqual(rejected.diagnostics.map(row => [row.code.rendered, row.site.origin.start, row.site.origin.length]),
    [["TS2304", missing.indexOf("missing!"), "missing".length]]);
});

test("authored bare return preserves selected void completion and skips the untaken throw", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export function fallthrough(flag: boolean): void { if (flag) return; }
    export function early(flag: boolean, value: string): void { if (flag) return; throw value; }
  `);
  const output = analyzeHostProgram(input);
  assert.equal(output.kind, "ok", JSON.stringify(output.diagnostics));
  const { index: { types }, modules } = output.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  assert.equal(module.tree.kind, "ready-root");
  for (const [ordinal, slot] of module.tree.root.statements.nodes.entries()) {
    assert.equal(slot.kind, "ready-callable");
    const declaration = slot.node;
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    const completion = body.tir.completion;
    assert.deepEqual(types.terms[completion], { kind: "intrinsic", intrinsic: "void" });
    const returned = body.tir.root.statements.nodes[0].thenStatement;
    assert.equal(returned.kind, "ReturnStatement");
    assert.equal(returned.expression, null);
    const returns = body.mir.blocks.map(block => block.terminator).filter(terminator => terminator.kind === "return");
    assert.deepEqual(returns.map(terminator => terminator.value), ordinal === 0 ? [null, null] : [null]);
    assert.equal(returns.some(terminator => terminator.tir.node === returned.id), true);
    if (ordinal === 0) assert.equal(returns.some(terminator => terminator.tir.node === body.tir.root.id), true);
    else assert.equal(body.mir.blocks.some(block => block.terminator.kind === "throw"), true);
    for (const flag of [false, true]) {
      const operands = [{ kind: "boolean", type: body.tir.params[0].tsonic.storage, value: flag }];
      if (ordinal === 1) operands.push({ kind: "string", type: body.tir.params[1].tsonic.storage, value: "thrown" });
      const run = evaluate(deps, body.instance, body.mir, operands, "compile-time",
        { query: "constValue", key: [body.instance, "compile-time"] });
      assert.equal(run.kind, "done");
      assert.equal(run.value.kind, "ok");
      if (ordinal === 1 && !flag) {
        assert.deepEqual(run.value.value, { kind: "value", value: { kind: "error", type: completion } });
        assert.equal(run.value.diagnostics[0].code.rendered, "TSONIC_CONSTANT_EVALUATION_FAILED");
        assert.equal(run.value.diagnostics[0].site.origin.start, body.tir.root.statements.nodes[1].origin.start);
      } else {
        assert.deepEqual(run.value.value, { kind: "value", value: { kind: "absence", type: completion } });
        assert.deepEqual(run.value.diagnostics, []);
      }
    }
  }
  assert.throws(() => analyzeHostProgram(analysisInput(fixture, "sdk-minimal",
    "export function invalid(flag: boolean): boolean { if (flag) return; return flag; }")),
  /a bare return without an actual declared void completion/);
});

test("inferred no-value signatures preserve each actual normal and unwind exit", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export function empty() {}
    export function early(flag: boolean, message: string) { if (flag) return; throw message; }
    export function escape(message: string) { throw message; }
    export function value(flag: boolean) { return flag; }
  `);
  const output = analyzeHostProgram(input);
  assert.equal(output.kind, "ok", JSON.stringify(output.diagnostics));
  const { index: { types, summaries }, modules } = output.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const declarations = readyModuleStatements(readyModuleRoot(module.tree));
  assert.equal(declarations.length, 4);
  for (const [position, declaration] of declarations.entries()) {
    const endpoint = declaration.tsonic.signatures[0];
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === endpoint.body);
    assert.ok(body);
    assert.equal(types.signatures[endpoint.signature].result, body.tir.completion);
    const isValue = position === 3;
    assert.deepEqual(types.terms[body.tir.completion], isValue ? { kind: "primitive", primitive: "bool" }
      : { kind: "intrinsic", intrinsic: "void" });
    const terminators = body.mir.blocks.map(block => block.terminator);
    const returned = terminators.filter(terminator => terminator.kind === "return");
    assert.equal(returned.length, position === 2 ? 0 : 1);
    assert.equal(returned.every(terminator => (terminator.value !== null) === isValue), true);
    const summary = summaries.find(row => row.key.kind === "body"
      && fixture.types.executionKey(row.key.execution) === fixture.types.executionKey(body.facts[0].execution));
    assert.equal(summary.returns, position !== 2);
    assert.equal(summary.unwinds, position === 1 || position === 2);
    if (position === 1) {
      const actualReturn = body.tir.root.statements.nodes[0].thenStatement;
      assert.equal(actualReturn.expression, null);
      assert.equal(returned[0].tir.node, actualReturn.id);
    }
    if (summary.unwinds) assert.equal(terminators.filter(terminator => terminator.kind === "throw").length, 1);
  }
  assert.throws(() => analyzeHostProgram(analysisInput(fixture, "sdk-minimal",
    "export function mixed(flag: boolean) { if (flag) return; return flag; }")), /mixing bare and value returns/u);
});

test("an unseeded recursive result refuses with one diagnostic at its actual declaration", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const source = "export function run(){return run();}";
  const input = analysisInput(fixture, "sdk-minimal", source);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "refused");
  assert.deepEqual(result.diagnostics.map(diagnostic => [diagnostic.code.rendered, diagnostic.site]), [[
    "TSONIC_TYPE_DEPENDENCY_CYCLE", { kind: "source",
      origin: { module: input.snapshot.entryPoint, start: 0, length: source.length, derived: [] } },
  ]]);
});

test("mutual inferred returns refuse once at the same detecting declaration in either source order", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const first = "export function first() { return second(); }";
  const second = "export function second() { return first(); }";
  for (const source of [[first, second].join("\n"), [second, first].join("\n")]) {
    const input = analysisInput(fixture, "sdk-minimal", source);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "refused");
    assert.deepEqual(result.diagnostics.map(diagnostic => [diagnostic.code.rendered, diagnostic.site]), [[
      "TSONIC_TYPE_DEPENDENCY_CYCLE", { kind: "source", origin: { module: input.snapshot.entryPoint,
        start: source.indexOf(second), length: second.length, derived: [] } },
    ]]);
  }
  const acyclic = analyzeHostProgram(analysisInput(fixture, "sdk-minimal",
    [first, "export function second() { return true; }"].join("\n")));
  assert.equal(acyclic.kind, "ok", JSON.stringify(acyclic.diagnostics));
  assert.deepEqual(acyclic.diagnostics, []);
});

test("a public open conditional publishes its actual key domain and constrained branch without selecting it", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export type Selected<T, P> = P extends keyof T ? T[P] : never;");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  assert.deepEqual(result.diagnostics, []);
  const module = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const [alias] = readyModuleStatements(readyModuleRoot(module.tree));
  const { terms } = result.value.index.types;
  const conditional = terms[alias.tsonic.type];
  assert.equal(conditional.projection.kind, "conditional");
  const keys = terms[conditional.projection.extends];
  const indexed = terms[conditional.projection.whenTrue];
  const narrowed = terms[indexed.projection.index];
  assert.equal(keys.projection.kind, "keyof");
  assert.equal(indexed.projection.kind, "indexed");
  assert.equal(keys.source, indexed.source);
  assert.deepEqual(narrowed, {
    kind: "projection", source: conditional.source,
    projection: { kind: "substitution", constraint: conditional.projection.extends },
  });
  assert.equal(module.bodies.flatMap(body => body.kind === "selected" ? body.mir.blocks.flatMap(block => block.statements) : []).length, 0);
});

test("necessary snapshots keep earlier operand reads in authored order when later writes occur in reverse", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const source = "export function read(first: boolean, second: boolean, next: boolean, gate: boolean): boolean {"
    + " return first === (second === (gate && ((second = next), (first = next)))); }";
  const input = analysisInput(fixture, "sdk-minimal", source);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  assert.equal(module.tree.kind, "ready-root");
  const slot = module.tree.root.statements.nodes[0];
  assert.equal(slot.kind, "ready-callable");
  const declaration = slot.node;
  const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
  const head = body.mir.blocks[0];
  assert.equal(head.terminator.kind, "switch");
  const prefix = head.statements.filter(row => row.kind === "assign" && row.value.kind === "use")
    .map(row => source.slice(row.origin.start, row.origin.start + row.origin.length));
  assert.deepEqual(prefix, ["first", "second", "gate"]);
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  for (const first of [false, true]) for (const second of [false, true])
    for (const next of [false, true]) for (const gate of [false, true]) {
      const arguments_ = [first, second, next, gate].map((value, position) =>
        ({ kind: "boolean", type: body.tir.params[position].tsonic.storage, value }));
      const selected = evaluate(deps, body.instance, body.mir, arguments_, "compile-time",
        { query: "constValue", key: [body.instance, "compile-time"] });
      assert.equal(selected.kind, "done");
      assert.equal(selected.value.kind, "ok");
      assert.deepEqual(selected.value.value, { kind: "value",
        value: { kind: "boolean", type: body.tir.completion, value: first === (second === (gate && next)) } });
      assert.deepEqual(selected.value.diagnostics, []);
    }
  const uninitialized = "export function read(next: boolean, gate: boolean): boolean { let first: boolean; let second: boolean;"
    + source.slice(source.indexOf(" return"));
  const refused = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", uninitialized));
  assert.equal(refused.kind, "refused");
  const failures = refused.diagnostics.filter(row => row.code.name === "TSONIC_READ_BEFORE_INITIALIZATION")
    .map(row => row.site.origin.start);
  assert.deepEqual(failures, [uninitialized.indexOf("first ==="), uninitialized.indexOf("second ===")]);
});

test("the authored void operator evaluates its operand once and returns native absence only when used", checkVoidOperand);

test("discarding a selected call result keeps its effects and both continuations without result storage", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate, resumeEvaluate } = await import("../../packages/host/dist/evaluate/index.js");
  for (const [carrier, literal] of [["boolean", true], ["string", "retained only when used"]]) {
    const input = analysisInput(fixture, "sdk-minimal", `
      function value(normal: boolean, result: ${carrier}, failure: string): ${carrier} {
        if (normal) return result;
        throw failure;
      }
      export function discard(normal: boolean, result: ${carrier}, failure: string): boolean {
        ((value(normal, result, failure)));
        return normal;
      }
      export function forward(normal: boolean, result: ${carrier}, failure: string): ${carrier} {
        return value(normal, result, failure);
      }
    `);
    const output = analyzeHostProgram(input);
    assert.equal(output.kind, "ok", JSON.stringify(output.diagnostics));
    const { index: { types }, modules } = output.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    const [callee, discard, forward] = readyModuleStatements(readyModuleRoot(module.tree)).map(declaration =>
      module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body));
    const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
      selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
    for (const body of [discard, forward]) {
      const [call] = body.mir.blocks.map(block => block.terminator).filter(terminator => terminator.kind === "call");
      assert.equal(call.destination === null, body === discard);
      assert.deepEqual(call.unwind, { kind: "escape" });
      assert.equal(body.mir.locals.filter(row => row.role.kind === "temporary").length, body === discard ? 0 : 1);
      assert.deepEqual(body.mir.constants, []);
      const unit = { query: "constValue", key: [body.instance, "compile-time"] };
      for (const normal of [false, true]) {
        const control = { kind: "boolean", type: body.tir.params[0].tsonic.storage, value: normal };
        const result = { kind: carrier, type: body.tir.params[1].tsonic.storage, value: literal };
        const pending = evaluate(deps, body.instance, body.mir, [control, result,
          { kind: "string", type: body.tir.params[2].tsonic.storage, value: "original throw" }], "compile-time", unit);
        assert.equal(pending.kind, "paused");
        assert.deepEqual(pending.requests, [{ kind: "mir-body", instance: callee.instance }]);
        const run = resumeEvaluate(deps, pending.paused, [{ kind: "mir-body", body: callee.mir }]);
        assert.equal(run.kind, "done");
        assert.equal(run.value.kind, "ok");
        const expected = normal ? body === discard ? control : result : { kind: "error", type: body.tir.completion };
        assert.deepEqual(run.value.value, { kind: "value", value: expected });
        if (normal) assert.deepEqual(run.value.diagnostics, []);
        else {
          assert.equal(run.value.diagnostics.length, 1);
          assert.equal(run.value.diagnostics[0].code.rendered, "TSONIC_CONSTANT_EVALUATION_FAILED");
          assert.deepEqual(run.value.diagnostics[0].site.origin, callee.tir.root.statements.nodes[1].origin);
        }
      }
    }
  }
  const input = analysisInput(fixture, "sdk-minimal", `
    let cell: boolean = false;
    function set(value: boolean): boolean { cell = value; return value; }
    export function through(value: boolean): boolean { (set(value), value); return cell; }
  `);
  const output = analyzeHostProgram(input);
  assert.equal(output.kind, "ok", JSON.stringify(output.diagnostics));
  const module = output.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const through = readyModuleStatements(readyModuleRoot(module.tree)).at(-1);
  const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === through.tsonic.signatures[0].body);
  assert.equal(body.mir.blocks.find(block => block.terminator.kind === "call").terminator.destination, null);
  const summary = output.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === body.instance.body);
  const [written] = summary.contentsOnReturn.map(row => summary.arena.cells[row.target].role);
  assert.equal(written.kind, "static");
  assert.equal(written.declaration.definition, body.tir.root.statements.nodes.at(-1).expression.tsonic.resolution.declaration.owner);
  assert.deepEqual(summary.contentsOnUnwind, []);
});

test("a destination-free never call unwinds without observing the later read", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  for (const [completion, action] of [["never", "throw message;"], ["void", ""], ["boolean", "return false;"]]) {
    const source = `function stop(message: string): ${completion} { ${action} }
      export function run(message: string): boolean { let unready: boolean; stop(message); return unready; }`;
    const input = analysisInput(fixture, "sdk-minimal", source);
    const result = analyzeHostProgram(input);
    if (completion !== "never") {
      assert.equal(result.kind, "refused");
      assert.equal(Object.hasOwn(result, "value"), false);
      assert.deepEqual(result.diagnostics.map(row => [row.code.rendered, row.site.origin.start, row.site.origin.length]),
        [["TSONIC_READ_BEFORE_INITIALIZATION", source.lastIndexOf("unready"), "unready".length]]);
      continue;
    }
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { index, modules } = result.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    const declaration = readyModuleStatements(readyModuleRoot(module.tree)).find(row => row.kind === "FunctionDeclaration" && row.name.text === "run");
    const body = module.bodies.find(row => row.kind === "selected" && row.tir.owner === declaration.tsonic.definition);
    const call = body.mir.blocks.find(block => block.terminator.kind === "call").terminator;
    assert.equal(call.destination, null);
    assert.deepEqual(call.unwind, { kind: "escape" });
    const read = body.tir.root.statements.nodes.at(-1).expression;
    assert.equal(body.facts[0].initialization.reads.some(row => row.node === read.id), false);
    const summary = index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === body.instance.body);
    assert.equal(summary.returns, false);
    assert.equal(summary.unwinds, true);
    const thrown = summary.arena.origins[summary.thrown];
    const [bound] = thrown.producers;
    assert.equal(thrown.producers.length, 1);
    const producer = summary.arena.producers[summary.arena.boundProducers[bound].producer];
    assert.equal(producer.kind, "parameter");
    assert.equal(producer.index, 0);
  }
});

test("destination-free void calls execute before continuation without a dummy absence operand", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate, resumeEvaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    function act(flag: boolean, message: string): void { if (flag) return; throw message; }
    export function discard(flag: boolean, message: string): boolean {
      ((act(flag, message)));
      return flag;
    }
    export function forward(flag: boolean, message: string): void {
      return (act(flag, message));
    }
  `);
  const output = analyzeHostProgram(input);
  assert.equal(output.kind, "ok", JSON.stringify(output.diagnostics));
  const { index: { types }, modules } = output.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  const [callee, ...callers] = readyModuleStatements(readyModuleRoot(module.tree)).map(declaration => module.bodies.find(row => row.kind === "selected"
    && row.instance.body === declaration.tsonic.signatures[0].body));
  assert.equal(callers.length, 2);
  for (const [index, body] of callers.entries()) {
    const [call] = body.mir.blocks.map(block => block.terminator).filter(terminator => terminator.kind === "call");
    assert.equal(call.destination, null);
    assert.deepEqual(call.unwind, { kind: "escape" });
    assert.deepEqual(body.mir.constants, []);
    assert.equal(body.mir.locals.some(row => row.role.kind === "temporary"), false);
    const returned = body.mir.blocks[call.next].terminator;
    assert.equal(returned.kind, "return");
    assert.equal(returned.value === null, index === 1);
    const unit = { query: "constValue", key: [body.instance, "compile-time"] };
    for (const flag of [false, true]) {
      const argument = { kind: "boolean", type: body.tir.params[0].tsonic.storage, value: flag };
      const paused = evaluate(deps, body.instance, body.mir, [argument,
        { kind: "string", type: body.tir.params[1].tsonic.storage, value: "original throw" }], "compile-time", unit);
      assert.equal(paused.kind, "paused");
      assert.deepEqual(paused.requests, [{ kind: "mir-body", instance: callee.instance }]);
      const run = resumeEvaluate(deps, paused.paused, [{ kind: "mir-body", body: callee.mir }]);
      assert.equal(run.kind, "done");
      assert.equal(run.value.kind, "ok");
      if (flag) {
        assert.deepEqual(run.value.value, { kind: "value", value: index === 0 ? argument : { kind: "absence", type: body.tir.completion } });
        assert.deepEqual(run.value.diagnostics, []);
      } else {
        assert.deepEqual(run.value.value, { kind: "value", value: { kind: "error", type: body.tir.completion } });
        assert.equal(run.value.diagnostics[0].code.rendered, "TSONIC_CONSTANT_EVALUATION_FAILED");
        assert.equal(run.value.diagnostics[0].site.origin.start, callee.tir.root.statements.nodes[1].origin.start);
      }
    }
  }
  const effectsInput = analysisInput(fixture, "sdk-minimal", `
    let selected: boolean = false;
    function set(flag: boolean): void { selected = flag; }
    export function through(flag: boolean): boolean { set(flag); return selected; }
  `);
  const effects = analyzeHostProgram(effectsInput);
  assert.equal(effects.kind, "ok", JSON.stringify(effects.diagnostics));
  const effectModule = effects.value.modules.find(row => row.module === effectsInput.snapshot.entryPoint);
  const through = readyModuleStatements(readyModuleRoot(effectModule.tree)).find(node => node.kind === "FunctionDeclaration" && node.name.text === "through");
  const effectBody = effectModule.bodies.find(row => row.kind === "selected" && row.instance.body === through.tsonic.signatures[0].body);
  const called = effectBody.mir.blocks.find(block => block.terminator.kind === "call").terminator;
  assert.equal(called.destination, null);
  assert.deepEqual(effectBody.mir.constants, []);
  const selected = effectBody.tir.root.statements.nodes[1].expression.tsonic.resolution;
  assert.equal(selected.kind, "static");
  const summary = effects.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === effectBody.instance.body);
  const [written] = summary.contentsOnReturn.map(row => summary.arena.cells[row.target].role);
  assert.equal(written.kind, "static");
  assert.equal(written.declaration.definition, selected.declaration.owner);
  assert.deepEqual(summary.contentsOnUnwind, []);
});

test("parenthesized type annotations retain authored wrappers without changing native storage", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function hold(value: ((boolean | null))): ((boolean | null)) { return value; }");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const declaration = readyModuleStatements(readyModuleRoot(module.tree))[0];
  const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
  const type = body.tir.completion;
  assert.equal(body.tir.params[0].tsonic.storage, type);
  for (const outer of [body.tir.params[0].type, declaration.type]) {
    assert.equal(outer.kind, "ParenthesizedType");
    assert.equal(outer.type.kind, "ParenthesizedType");
    assert.equal(outer.type.type.kind, "UnionType");
    assert.equal(outer.tsonic.type, type);
    assert.equal(outer.type.tsonic.type, type);
    assert.equal(outer.type.type.tsonic.type, type);
  }
  assert.deepEqual(body.mir.constants, []);
  assert.equal(body.mir.blocks.every(block => block.statements.length === 0), true);
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  for (const value of [{ kind: "absence", type }, { kind: "boolean", type, value: false }, { kind: "boolean", type, value: true }]) {
    const run = evaluate(deps, body.instance, body.mir, [value], "compile-time",
      { query: "constValue", key: [body.instance, "compile-time"] });
    assert.equal(run.kind, "done");
    assert.equal(run.value.kind, "ok");
    assert.deepEqual(run.value.value, { kind: "value", value });
  }
});

test("authored singleton type annotations keep exact Boolean and quoted string payloads", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { declarationType } = await import("../../packages/host/dist/elaborate/declarations.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const input = analysisInput(fixture, "sdk-minimal", String.raw`
    export type Disabled = false;
    export type Label = "a\u0000λ";
    export function echo(value: true): true { return value; }
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [disabled, label, echo] = readyModuleStatements(readyModuleRoot(module.tree));
  const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === echo.tsonic.signatures[0].body);
  for (const [annotation, kind, value, base] of [
    [disabled.type, "FalseKeyword", { kind: "boolean", value: false }, { kind: "primitive", primitive: "bool" }],
    [label.type, "StringLiteral", { kind: "string", value: "a\u0000λ" }, { kind: "string" }],
    [echo.type, "TrueKeyword", { kind: "boolean", value: true }, { kind: "primitive", primitive: "bool" }],
    [body.tir.params[0].type, "TrueKeyword", { kind: "boolean", value: true }, { kind: "primitive", primitive: "bool" }],
  ]) {
    assert.equal(annotation.kind, "LiteralType");
    assert.equal(annotation.literal.kind, kind);
    const type = annotation.tsonic.type;
    assert.deepEqual(annotation.literal.tsonic, { role: "type-literal", type });
    const selected = types.terms[type];
    assert.equal(selected.kind, "literal");
    assert.deepEqual(selected.value, value);
    assert.deepEqual(types.terms[selected.base], base);
  }
  const type = echo.type.tsonic.type;
  assert.equal(body.tir.params[0].tsonic.storage, type);
  assert.equal(body.tir.completion, type);
  assert.deepEqual(body.mir.constants, []);
  assert.equal(body.mir.blocks.every(block => block.statements.length === 0), true);
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  const value = { kind: "boolean", type, value: true };
  const run = evaluate(deps, body.instance, body.mir, [value], "compile-time", { query: "constValue", key: [body.instance, "compile-time"] });
  assert.equal(run.kind, "done");
  assert.equal(run.value.kind, "ok");
  assert.deepEqual(run.value.value, { kind: "value", value });

  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const [checkedFalse, checkedLabel, checkedEcho] = captured.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module.tree.statements.nodes;
  const views = { types: captured.value.types };
  const opposite = checkedEcho.type.tsonic.type;
  const authoredFalse = checkedFalse.type;
  assert.throws(() => declarationType(views, { ...authoredFalse, tsonic: { ...authoredFalse.tsonic, type: opposite },
    literal: { ...authoredFalse.literal, tsonic: { ...authoredFalse.literal.tsonic, type: opposite } } }), /Boolean annotation.*actual checker payload/u);
  const authoredLabel = checkedLabel.type;
  assert.throws(() => declarationType(views, { ...authoredLabel,
    literal: { ...authoredLabel.literal, text: "aλ" } }), /string annotation.*actual checker payload/u);
});

test("a no-substitution template type retains its authored token and shares exact quoted-string type identity", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const source = 'export type Quoted = "a\\u0000λ"; export type Template = `a\\u0000λ`;'
    + 'export function forward(value: `a\\u0000λ`): "a\\u0000λ" { return value; }';
  const input = analysisInput(fixture, "sdk-minimal", source);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [quoted, template, forward] = readyModuleStatements(readyModuleRoot(module.tree));
  const type = quoted.type.tsonic.type;
  const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === forward.tsonic.signatures[0].body);
  for (const annotation of [template.type, body.tir.params[0].type]) {
    assert.equal(annotation.kind, "LiteralType");
    assert.equal(annotation.literal.kind, "NoSubstitutionTemplateLiteral");
    assert.equal(annotation.literal.text, "a\u0000λ");
    const { start, length } = annotation.literal.origin;
    assert.equal(source.slice(start, start + length), '`a\\u0000λ`');
    assert.deepEqual(annotation.literal.tsonic, { role: "type-literal", type });
    assert.equal(annotation.tsonic.type, type);
  }
  const selected = types.terms[type];
  assert.equal(selected.kind, "literal");
  assert.deepEqual(selected.value, { kind: "string", value: "a\u0000λ" });
  assert.deepEqual(types.terms[selected.base], { kind: "string" });
  assert.equal(body.tir.completion, type);
  assert.equal(body.tir.params[0].tsonic.storage, type);
  assert.deepEqual(body.mir.constants, []);
  assert.equal(body.mir.blocks.every(block => block.statements.length === 0), true);
});

test("authored backtick strings without substitutions retain cooked values through verified MIR", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeTypedSource } = await import("../../packages/host/dist/pipeline/analysis-barrier.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const { viewTypes } = await import("../../packages/host/dist/ir-types/index.js");
  const { parseTir, printTir } = await import("../../packages/host/dist/ir-tir/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const cases = [
    ["empty", "``", ""],
    ["escaped", "`λ\\n\\u{1F680}\\u0000`", "λ\n🚀\u0000"],
    ["noInterpolation", "`\\${unknown}\\``", "${unknown}`"],
  ];
  const text = cases.map(([name, token, value]) =>
    `export function ${name}(): string { return ${token}; }\nexport function ${name}Quoted(): string { return ${JSON.stringify(value)}; }`).join("\n");
  const input = analysisInput(fixture, "sdk-minimal", text);
  const checked = captureSourceBarrier(input);
  assert.equal(checked.kind, "ok");
  const checkedModule = checked.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
  const checkedText = fixture.hir.printHir(checkedModule);
  const decoded = fixture.hir.parseHir(checkedText);
  assert.equal(decoded.kind, "parsed");
  assert.equal(fixture.hir.printHir(decoded.value), checkedText);
  const account = createAccount(input.limits.dataflow);
  const ready = typeSourceBarrier(input, checked.value, account);
  assert.equal(ready.kind, "ok");
  const observed = new Map();
  const lower = pipelineWiring.lowerMir.lowerToMir;
  pipelineWiring.lowerMir.lowerToMir = (deps, tir, internal, requiredEntries) => {
    const result = lower(deps, tir, internal, requiredEntries);
    if (tir.bindings.kind === "instantiated" && result.kind === "ok") observed.set(tir.body, { tir, mir: result.value,
      instance: { body: tir.body, bindings: tir.bindings } });
    return result;
  };
  try {
    assert.throws(() => analyzeTypedSource(input, ready.value, account),
      /actual selected non-scalar constant relation/u);
  } finally {
    pipelineWiring.lowerMir.lowerToMir = lower;
  }
  const types = viewTypes(checked.value.types);
  const module = ready.value.modules.get(input.snapshot.entryPoint);
  const bodyFor = name => {
    const declaration = readyModuleStatements(readyModuleRoot(module.tree)).find(row => row.name.text === name);
    return observed.get(declaration.tsonic.signatures[0].body);
  };
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  for (const [name, token, value] of cases) {
    const template = bodyFor(name);
    const quoted = bodyFor(`${name}Quoted`);
    const leaf = template.tir.root.statements.nodes[0].expression;
    const quotedLeaf = quoted.tir.root.statements.nodes[0].expression;
    const original = checkedModule.tree.statements.nodes.find(row => row.name.text === name).body.statements.nodes[0].expression;
    assert.equal(leaf.kind, "NoSubstitutionTemplateLiteral", name);
    assert.equal(leaf.text, value, name);
    assert.deepEqual([leaf.rawText, leaf.tokenFlags, leaf.templateFlags], [original.rawText, original.tokenFlags, original.templateFlags], name);
    assert.equal(text.slice(leaf.origin.start, leaf.origin.start + leaf.origin.length), token, name);
    assert.equal(leaf.tsonic.value, value, name);
    assert.deepEqual([leaf.tsonic.type, leaf.tsonic.convertedType], [quotedLeaf.tsonic.type, quotedLeaf.tsonic.convertedType], name);
    for (const expression of [leaf, quotedLeaf]) {
      const conversion = expression.tsonic.conversion;
      assert.equal(conversion.kind, "convert", name);
      const choice = conversion.operation.decision;
      assert.deepEqual(choice.execution, { kind: "pure" }, name);
      assert.deepEqual(choice.operands, [leaf.tsonic.type], name);
      assert.equal(choice.result, leaf.tsonic.convertedType, name);
      assert.deepEqual([choice.operation.kind, choice.operation.embedding.conversion, choice.operation.embedding.check.kind],
        ["conversion", "literal-fit", "none"], name);
    }
    assert.deepEqual(template.mir.constants, quoted.mir.constants, name);
    assert.equal(template.mir.blocks.some(block => block.terminator.kind === "call" || block.terminator.kind === "invoke"), false, name);
    const serialized = printTir(template.tir);
    const parsed = parseTir(serialized);
    assert.equal(parsed.kind, "parsed", name);
    assert.equal(printTir(parsed.value), serialized, name);
    const run = evaluate(deps, template.instance, template.mir, [], "compile-time",
      { query: "constValue", key: [template.instance, "compile-time"] });
    assert.equal(run.kind, "done", name);
    assert.equal(run.value.kind, "ok", name);
    assert.deepEqual(run.value.value, { kind: "value", value: { kind: "string", type: template.tir.completion, value } }, name);
  }
});

test("discarded string literals preserve authored syntax without materializing unused native values", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const source = 'export function discard(flag: boolean): boolean { "quoted"; (`raw\\nλ`); return flag; }';
  const input = analysisInput(fixture, "sdk-minimal", source);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const declaration = readyModuleStatements(readyModuleRoot(module.tree))[0];
  const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
  const [quoted, template] = body.tir.root.statements.nodes;
  assert.equal(quoted.expression.kind, "StringLiteral");
  assert.equal(quoted.expression.tsonic.value, "quoted");
  assert.equal(template.expression.kind, "ParenthesizedExpression");
  const leaf = template.expression.expression;
  assert.equal(leaf.kind, "NoSubstitutionTemplateLiteral");
  assert.equal(source.slice(leaf.origin.start, leaf.origin.start + leaf.origin.length), "`raw\\nλ`");
  assert.equal(leaf.tsonic.value, "raw\nλ");
  assert.deepEqual(body.mir.constants, []);
  assert.equal(body.mir.blocks.every(block => block.statements.length === 0), true);
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  for (const flag of [false, true]) {
    const value = { kind: "boolean", type: body.tir.completion, value: flag };
    const actual = evaluate(deps, body.instance, body.mir, [value], "compile-time", { query: "constValue", key: [body.instance, "compile-time"] });
    assert.equal(actual.kind, "done");
    assert.equal(actual.value.kind, "ok");
    assert.deepEqual(actual.value.value, { kind: "value", value });
  }
});

test("finite template type annotations retain the checked literals, operands and authored fragments", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const source = 'export type Product = `left\\u03bb${"a" | "b"}-${"1" | "2"}-end`;'
    + 'export type Expected = "leftλa-1-end" | "leftλa-2-end" | "leftλb-1-end" | "leftλb-2-end";'
    + 'export type Single = `one-${"a"}`; export type Exact = "one-a";';
  const input = analysisInput(fixture, "sdk-minimal", source);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [product, expected, single, exact] = readyModuleStatements(readyModuleRoot(module.tree));
  const annotation = product.type;
  assert.equal(annotation.kind, "TemplateLiteralType");
  assert.equal(annotation.tsonic.type, expected.type.tsonic.type, "the actual selected string literals intern as the same explicit union");
  assert.deepEqual(types.terms[annotation.tsonic.type].members.map(type => types.terms[type].value.value).sort(),
    ["leftλa-1-end", "leftλa-2-end", "leftλb-1-end", "leftλb-2-end"]);
  const spans = annotation.templateSpans.nodes;
  assert.equal(spans.length, 2);
  for (const [index, span] of spans.entries()) {
    assert.equal(span.kind, "TemplateLiteralTypeSpan");
    assert.equal(span.tsonic.type, span.type.tsonic.type);
    assert.deepEqual(types.terms[span.tsonic.type].members.map(type => types.terms[type].value.value).sort(),
      index === 0 ? ["a", "b"] : ["1", "2"]);
  }
  assert.deepEqual([annotation.head, ...spans.map(span => span.literal)].map(token => {
    const { start, length } = token.origin;
    return [token.kind, token.text, source.slice(start, start + length), token.tsonic];
  }), [["TemplateHead", "leftλ", '`left\\u03bb${', null],
    ["TemplateMiddle", "-", '}-${', null], ["TemplateTail", "-end", '}-end`', null]]);
  assert.equal(single.type.tsonic.type, exact.type.tsonic.type);
  assert.deepEqual(types.terms[single.type.tsonic.type].value, { kind: "string", value: "one-a" });
  const initializer = module.bodies.find(body => body.kind === "selected");
  assert.equal(initializer !== undefined && initializer.mir.constants.length === 0
    && initializer.mir.blocks.every(block => block.statements.length === 0), true);
  const nonfinite = analysisInput(fixture, "sdk-minimal", 'export type Open = `${string}`;');
  assert.throws(() => analyzeHostProgram(nonfinite), /actual finite checked string result/u);
  const runtime = analysisInput(fixture, "sdk-minimal", 'export const greeting = `left-${true}`;');
  assert.throws(() => analyzeHostProgram(runtime), /checked annotation not implemented: TemplateExpression/u);
});

test("closed keyof and indexed access annotations publish the actual checker results without a runtime member access", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export type Shape = { readonly flag: boolean; marker: "exact" };
    export type Key = keyof Shape;
    export type Marker = Shape["marker"];
    export function pass(value: Shape["flag"]): Shape["flag"] { return value; }
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [shape, key, marker, pass] = readyModuleStatements(readyModuleRoot(module.tree));
  assert.equal(key.type.kind, "TypeOperator");
  assert.equal(key.type.operator, "KeyOfKeyword");
  assert.equal(key.type.type.tsonic.type, shape.type.tsonic.type);
  const keys = types.terms[key.type.tsonic.type];
  assert.equal(keys.kind, "union");
  const values = keys.members.map(member => {
    const selected = types.terms[member];
    assert.equal(selected.kind, "literal");
    assert.equal(selected.value.kind, "string");
    return selected.value.value;
  });
  assert.deepEqual(values.sort(), ["flag", "marker"]);
  assert.equal(marker.type.kind, "IndexedAccessType");
  assert.equal(marker.type.objectType.tsonic.type, shape.type.tsonic.type);
  assert.deepEqual(types.terms[marker.type.indexType.tsonic.type].value, { kind: "string", value: "marker" });
  assert.deepEqual(types.terms[marker.type.tsonic.type].value, { kind: "string", value: "exact" });
  const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === pass.tsonic.signatures[0].body);
  const type = pass.type.tsonic.type;
  assert.deepEqual(types.terms[type], { kind: "primitive", primitive: "bool" });
  assert.equal(body.tir.completion, type);
  assert.equal(body.tir.params[0].tsonic.storage, type);
  assert.deepEqual(body.mir.constants, []);
  assert.equal(body.mir.blocks.every(block => block.statements.length === 0), true);
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  for (const value of [false, true]) {
    const argument = { kind: "boolean", type, value };
    const run = evaluate(deps, body.instance, body.mir, [argument], "compile-time", { query: "constValue", key: [body.instance, "compile-time"] });
    assert.equal(run.kind, "done");
    assert.equal(run.value.kind, "ok");
    assert.deepEqual(run.value.value, { kind: "value", value: argument });
  }
});

test("mutually recursive declared member types preserve both exact qualified dependencies", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export interface Left { other: Right | null; }
    export interface Right { other: Left | null; }
    export type NextLeft = Left["other"];
    export type NextRight = Right["other"];
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [left, right, nextLeft, nextRight] = readyModuleStatements(readyModuleRoot(module.tree));
  assert.notEqual(left.tsonic.definition, right.tsonic.definition);
  for (const [owner, other, query] of [[left, right, nextLeft], [right, left, nextRight]]) {
    const member = owner.members.nodes[0].type;
    assert.equal(member.kind, "UnionType");
    const reference = member.types.nodes.find(node => node.kind === "TypeReference");
    assert.deepEqual(reference.tsonic.declarations, [other.tsonic.definition]);
    assert.equal(query.type.kind, "IndexedAccessType");
    const receiver = types.terms[query.type.objectType.tsonic.type];
    assert.equal(receiver.kind, "declared");
    assert.equal(receiver.definition, owner.tsonic.definition);
    assert.equal(query.type.tsonic.type, member.tsonic.type);
    const optional = types.terms[member.tsonic.type];
    assert.equal(optional.kind, "optional");
    const target = types.terms[optional.value];
    assert.equal(target.kind, "declared");
    assert.equal(target.definition, other.tsonic.definition);
    assert.equal(optional.value, reference.tsonic.type);
  }
  assert.notEqual(nextLeft.type.tsonic.type, nextRight.type.tsonic.type);
  const initializer = module.bodies.find(body => body.kind === "selected");
  assert.equal(initializer !== undefined && initializer.mir.constants.length === 0
    && initializer.mir.blocks.every(block => block.statements.length === 0), true);
});

test("grounded recursive structural aliases publish their real canonical type cycles", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export type Link = { next: Link | null };
    export type First = { next: Second | null };
    export type Second = { back: First | null };
    export type Next = First["next"];
    export type Back = Second["back"];
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [link, first, second, next, back] = readyModuleStatements(readyModuleRoot(module.tree));
  const identities = [link, first, second].map(declaration => declaration.type.tsonic.type);
  assert.equal(new Set(identities).size, 3);
  for (const [index, [declaration, target, selection]] of [[link, link, null], [first, second, next], [second, first, back]].entries()) {
    const row = types.terms[identities[index]];
    assert.equal(row.kind, "shape");
    assert.equal(row.members.length, 1);
    const written = declaration.type.members.nodes[0].type;
    assert.equal(row.members[0].read, written.tsonic.type);
    assert.deepEqual(types.terms[row.members[0].read], { kind: "optional", value: target.type.tsonic.type });
    const reference = written.types.nodes.find(node => node.kind === "TypeReference");
    assert.deepEqual(reference.tsonic.declarations, [target.tsonic.definition]);
    assert.equal(reference.tsonic.type, target.type.tsonic.type);
    if (selection !== null) {
      assert.equal(selection.type.objectType.tsonic.type, identities[index]);
      assert.equal(selection.type.tsonic.type, row.members[0].read);
    }
  }
  const initializer = module.bodies.find(body => body.kind === "selected");
  assert.equal(initializer !== undefined && initializer.mir.constants.length === 0
    && initializer.mir.blocks.every(block => block.statements.length === 0), true);

  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeTypedSource } = await import("../../packages/host/dist/pipeline/analysis-barrier.js");
  const { publishHostProgram } = await import("../../packages/host/dist/pipeline/publication.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const prepare = () => {
    const source = captureSourceBarrier(input);
    assert.equal(source.kind, "ok");
    const account = createAccount(input.limits.dataflow);
    const typed = typeSourceBarrier(input, source.value, account);
    assert.equal(typed.kind, "ok");
    const analyzed = analyzeTypedSource(input, typed.value, account);
    assert.equal(analyzed.kind, "ok");
    return { source: source.value, typed: typed.value, analyzed: analyzed.value, account };
  };
  const firstAttempt = prepare();
  const publication = fixture.types.exportTypes(firstAttempt.source.types, input.limits.instantiation);
  assert.equal(publication.kind, "complete");
  for (const maximumWork of [publication.work - 1, publication.work, publication.work + 1]) {
    const attempt = maximumWork < publication.work ? firstAttempt : prepare();
    const issued = fixture.types.viewTypes(attempt.source.types);
    const snapshot = structuredClone(issued);
    const limits = { ...input.limits, instantiation: { ...input.limits.instantiation, maximumWork } };
    const bounded = publishHostProgram({ ...input, limits }, attempt.typed, attempt.analyzed, attempt.account);
    if (maximumWork < publication.work) {
      assert.equal(bounded.kind, "refused");
      assert.equal(Object.hasOwn(bounded, "value"), false);
      assert.equal(bounded.diagnostics.length, 1);
      assert.equal(bounded.diagnostics[0].source, "ir-program");
      assert.deepEqual(bounded.diagnostics[0].arguments, [{ kind: "text", value: "work" }, { kind: "number", value: maximumWork }]);
    } else {
      assert.equal(bounded.kind, "ok");
      assert.deepEqual(bounded.value.index.types, types);
    }
    assert.deepEqual(issued, snapshot);
  }
});

test("identifier type queries retain each selected type and declaration without reading the queried storage", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    const flag: boolean = true;
    export type Read = typeof flag;
    export function hold(value: typeof flag): typeof flag { return value; }
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [variable, alias, hold] = readyModuleStatements(readyModuleRoot(module.tree));
  const declaration = variable.declarationList.declarations.nodes[0].name.tsonic.declaration;
  assert.equal(declaration.kind, "definition");
  const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === hold.tsonic.signatures[0].body);
  const completion = body.tir.completion;
  const queried = types.terms[alias.type.tsonic.type];
  assert.equal(queried.kind, "literal");
  assert.deepEqual(queried.value, { kind: "boolean", value: true });
  assert.equal(queried.base, completion);
  assert.deepEqual(types.terms[completion], { kind: "primitive", primitive: "bool" });
  assert.equal(hold.type.tsonic.type, completion);
  assert.equal(body.tir.params[0].type.tsonic.type, completion);
  assert.equal(body.tir.params[0].tsonic.storage, completion);
  for (const query of [alias.type, hold.type, body.tir.params[0].type]) {
    assert.equal(query.kind, "TypeQuery");
    assert.equal(query.exprName.text, "flag");
    assert.deepEqual(query.exprName.tsonic, { role: "type-name", type: query.tsonic.type, declarations: [declaration.definition] });
  }
  assert.deepEqual(body.mir.constants, []);
  const [entry] = body.mir.blocks;
  assert.deepEqual(entry.statements, []);
  assert.equal(entry.terminator.kind, "return");
  assert.equal(entry.terminator.value.kind, "place");
  assert.equal(body.mir.places[entry.terminator.value.place].base.kind, "local");
  assert.equal(body.mir.places.every(place => place.base.kind === "local"), true);
});

test("closed conditional type annotations preserve both authored branches and borrow the checker-selected type", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export type Selected = true extends boolean ? "ready" : "other";
    export function hold(value: false extends true ? string : boolean): false extends true ? string : boolean {
      return value;
    }
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [selected, hold] = readyModuleStatements(readyModuleRoot(module.tree));
  const annotation = selected.type;
  assert.equal(annotation.kind, "ConditionalType");
  assert.equal(annotation.checkType.literal.kind, "TrueKeyword");
  assert.equal(annotation.extendsType.kind, "BooleanKeyword");
  assert.equal(annotation.trueType.literal.text, "ready");
  assert.equal(annotation.falseType.literal.text, "other");
  assert.equal(annotation.tsonic.type, annotation.trueType.tsonic.type);
  assert.notEqual(annotation.tsonic.type, annotation.falseType.tsonic.type);
  const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === hold.tsonic.signatures[0].body);
  for (const query of [hold.type, body.tir.params[0].type]) {
    assert.equal(query.kind, "ConditionalType");
    assert.equal(query.checkType.literal.kind, "FalseKeyword");
    assert.equal(query.extendsType.literal.kind, "TrueKeyword");
    assert.equal(query.trueType.kind, "StringKeyword");
    assert.equal(query.falseType.kind, "BooleanKeyword");
    assert.equal(query.tsonic.type, query.falseType.tsonic.type);
    assert.equal(query.tsonic.type, body.tir.completion);
  }
  assert.deepEqual(types.terms[body.tir.completion], { kind: "primitive", primitive: "bool" });
  assert.equal(body.tir.params[0].tsonic.storage, body.tir.completion);
  assert.deepEqual(body.mir.constants, []);
  const [entry] = body.mir.blocks;
  assert.deepEqual(entry.statements, []);
  assert.equal(entry.terminator.kind, "return");
  assert.equal(entry.terminator.value.kind, "place");
  assert.equal(body.mir.places[entry.terminator.value.place].base.kind, "local");
});

test("failed declaration types refuse with the original checker cause, including nested authored nodes", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  for (const [source, code] of [
    ["export type Broken = Missing;", 2304],
    ["export type Broken = (Missing);", 2304],
    ['export type Broken = true extends boolean ? "selected" : Missing;', 2304],
    ["export type Broken = unique symbol;", 1335],
    ["export interface Broken { field: unique symbol; }", 1330],
    ["export type Broken = readonly number;", 1354],
    ["export type Broken = ((readonly number));", 1354],
    ["export type Broken = [boolean?, string];", 1257],
    ["export type Broken = (([boolean?, string]));", 1257],
    ["export type Broken = readonly [boolean?, string];", 1257],
    ["export type First = (Broken); export type Broken = readonly [boolean?, string];", 1257],
    ["export type Base = boolean; export type Broken = ((Base</* λ */>));", 1099],
    ["export type Id<T> = T; export type Broken = Id<boolean,>;", 1009],
    ["export type Broken = (Broken);", 2456],
    ["export type First = Broken; export type Broken = (Broken);", 2456],
  ]) {
    const input = analysisInput(fixture, "sdk-minimal", source);
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok", source);
    const module = captured.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
    assert.equal(module.checkerDiagnostics.length, 1);
    const [original] = module.checkerDiagnostics;
    assert.equal(original.code.number, code);
    const typed = typeSourceBarrier(input, captured.value, createTypedAccount(input));
    assert.equal(typed.kind, "refused", source);
    assert.equal(typed.diagnostics.length, 1);
    assert.equal(typed.diagnostics[0] === original, true, "the type projection transports the actual published object");
    const published = analyzeHostProgram(input);
    assert.equal(published.kind, "refused");
    assert.deepEqual(published.diagnostics, [original]);
  }
});

test("an imported failed indexed type preserves the original document's UTF-16 diagnostic range", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const input = analysisInput(fixture, "sdk-minimal");
  const main = '\uFEFF// 🚁\r\nimport type {Root as Renamed} from "./foreign.js";\r\nexport type Seen = (Renamed);\r\n';
  const snapshot = text => fixture.projectSnapshot({ sourceFiles: { "main.ts": main, "foreign.ts": '\uFEFF// ✨ 😀\r\n' + text },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const foreign = fixture.moduleOf(fixture.packageOf("/project"), "src/foreign.ts");
  for (const [declarations, receiver, wrongKey, validKey, code] of [
    ["interface Model { ready: string; }\r\n", "Model", '"absent"', '"ready"', 2339],
    ["interface Tag { readonly token: unique symbol; }\r\ninterface Dictionary { [name: string]: string; }\r\n", "Dictionary",
      'Tag["token"]', "string", 2538],
  ]) {
    const text = key => declarations + `export type Root = ${receiver}[${key}];\r\n`;
    const failed = { ...input, snapshot: snapshot(text(wrongKey)) };
    const captured = captureSourceBarrier(failed);
    assert.equal(captured.kind, "ok");
    const entry = captured.value.modules.find(row => row.module.module === failed.snapshot.entryPoint).module;
    const original = captured.value.modules.find(row => row.module.module === foreign).module.checkerDiagnostics;
    assert.deepEqual(entry.checkerDiagnostics, []);
    assert.equal(original.length, 1);
    assert.deepEqual(original[0].code, { kind: "checker", number: code, rendered: `TS${code}` });
    assert.deepEqual(original[0].site, { kind: "source", origin: { module: foreign,
      start: ('\uFEFF// ✨ 😀\r\n' + text(wrongKey)).indexOf(wrongKey), length: wrongKey.length, derived: [] } });
    const typed = typeSourceBarrier(failed, captured.value, createTypedAccount(failed));
    assert.equal(typed.kind, "refused");
    assert.equal(typed.diagnostics.length, 1);
    assert.equal(typed.diagnostics[0], original[0]);
    const refused = analyzeHostProgram(failed);
    assert.equal(refused.kind, "refused");
    assert.equal(Object.hasOwn(refused, "value"), false);
    assert.deepEqual(refused.diagnostics, original);

    const ready = analyzeHostProgram({ ...input, snapshot: snapshot(text(validKey)) });
    assert.equal(ready.kind, "ok");
    assert.deepEqual(ready.diagnostics, []);
    const foreignTree = ready.value.modules.find(row => row.module === foreign).tree;
    const declaration = readyModuleStatements(readyModuleRoot(foreignTree)).at(-1);
    const [, read] = readyModuleStatements(readyModuleRoot(ready.value.modules.find(row => row.module === failed.snapshot.entryPoint).tree));
    assert.equal(declaration.type.kind, "IndexedAccessType");
    assert.equal(read.type.tsonic.type, declaration.type.tsonic.type);
    assert.deepEqual(ready.value.index.types.terms[read.type.tsonic.type], { kind: "string" });
  }
});

test("authored unique symbol fields and their indexed type queries preserve distinct declaration identities", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export interface Keys { readonly left: unique symbol; readonly right: unique symbol; broad: symbol; }
    export type Left = Keys["left"];
    export type Right = Keys["right"];
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [keys, left, right] = readyModuleStatements(readyModuleRoot(module.tree));
  const [first, second, general] = keys.members.nodes;
  const base = general.type.tsonic.type;
  assert.deepEqual(types.terms[base], { kind: "intrinsic", intrinsic: "symbol" });
  assert.notEqual(first.type.tsonic.type, second.type.tsonic.type);
  for (const [member, alias] of [[first, left], [second, right]]) {
    const annotation = member.type;
    assert.equal(annotation.kind, "TypeOperator");
    assert.equal(annotation.operator, "UniqueKeyword");
    assert.equal(annotation.type.kind, "SymbolKeyword");
    assert.equal(annotation.type.tsonic.type, base);
    assert.equal(annotation.tsonic.type, member.tsonic.storage);
    assert.equal(annotation.tsonic.type, alias.type.tsonic.type);
    assert.deepEqual(types.terms[annotation.tsonic.type], {
      kind: "literal", value: { kind: "unique-symbol", declaration: member.tsonic.definition }, base,
    });
  }
});

test("unlabelled tuple annotations keep slot omission distinct from a required slot carrying absence", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export type Mutable = [boolean, string?];
    export type Readonly = readonly [boolean, string?];
    export type Required = [boolean, string | undefined];
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const initializer = module.bodies.find(body => body.kind === "selected");
  assert.equal(initializer !== undefined && initializer.mir.constants.length === 0
    && initializer.mir.blocks.every(block => block.statements.length === 0), true,
    "The selected module initializer contains no work for type-only tuple syntax");
  const [mutable, readonly, required] = readyModuleStatements(readyModuleRoot(module.tree));
  const slots = [mutable.type, readonly.type.type, required.type];
  assert.deepEqual(slots.map(annotation => annotation.kind), ["TupleType", "TupleType", "TupleType"]);
  assert.equal(readonly.type.kind, "TypeOperator");
  assert.equal(readonly.type.tsonic.type, readonly.type.type.tsonic.type);
  const selected = slots.map(annotation => types.terms[annotation.tsonic.type]);
  assert.deepEqual(selected.map(tuple => [tuple.kind, tuple.readonly]), [["tuple", false], ["tuple", true], ["tuple", false]]);
  const optional = slots[0].elements.nodes[1];
  assert.equal(optional.kind, "OptionalType");
  assert.deepEqual(types.terms[optional.type.tsonic.type], { kind: "string" });
  const storedType = optional.tsonic.type;
  assert.deepEqual(types.terms[storedType], { kind: "optional", value: optional.type.tsonic.type });
  for (const [index, tuple] of selected.entries()) {
    assert.deepEqual(tuple.elements.map(slot => slot.kind), ["required", index === 2 ? "required" : "optional"]);
    assert.equal(tuple.elements.every(slot => slot.declaration === null), true);
    assert.equal(tuple.elements[1].type, storedType);
    assert.equal(slots[index].elements.nodes[1].tsonic.type, storedType);
  }
});

test("native local bitwise compound assignment keeps the pre-RHS value at its selected width", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const cases = [
    ["&", "AmpersandEqualsToken", 1n, 3n],
    ["|", "BarEqualsToken", 9007199254740995n, -9007199254740993n],
    ["^", "CaretEqualsToken", 9007199254740994n, -9007199254740996n],
  ];
  const source = cases.map(([operator], ordinal) =>
    `export function bits${ordinal}(left = 1, right = 1) { return left ${operator}= (left = right); }`).join("\n");
  const input = analysisInput(fixture, "sdk-minimal", source);
  const nativeFacts = { ...input.snapshot.nativeFacts, integerOverflow: [], invalidShiftCount: [] };
  const result = analyzeHostProgram({ ...input, snapshot: { ...input.snapshot, nativeFacts } });
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  for (const [ordinal, [operator, token, positive, negative]] of cases.entries()) {
    const declaration = readyModuleStatements(readyModuleRoot(module.tree))[ordinal];
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    const assignment = body.tir.root.statements.nodes[0].expression;
    const type = body.tir.completion;
    assert.equal(assignment.operatorToken.kind, token);
    assert.deepEqual(assignment.left.tsonic.access, { kind: "read-write", storage: type, read: type, narrowing: null, evidenceIndex: null });
    assert.deepEqual(assignment.tsonic.calculation.decision.decision, { kind: "selected",
      operation: { kind: "native-operator", operator, carrier: "int64" }, operands: [type, type], result: type, execution: { kind: "pure" } });
    const entry = body.mir.blocks[body.mir.entries.find(row => row.provided === body.tir.params.length).block];
    const reads = entry.statements.flatMap((row, index) =>
      row.kind === "assign" && row.tir.node === assignment.left.id && row.value.kind === "use" ? [index] : []);
    const inner = entry.statements.findIndex(row => row.kind === "assign" && row.tir.node === assignment.right.expression.id);
    const stores = entry.statements.flatMap((row, index) =>
      row.kind === "assign" && row.tir.node === assignment.id && row.value.kind === "use" ? [index] : []);
    assert.equal(reads.length, 1);
    assert.equal(stores.length, 1);
    assert.ok(reads[0] < inner && inner < stores[0]);
    const integer = numerator => ({ kind: "number", type, value: { numerator, denominator: 1n, negativeZero: false } });
    const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
      selectedNativeFacts: nativeFacts, limits: input.limits.evaluation };
    for (const [left, expected] of [[9007199254740993n, positive], [-9007199254740993n, negative]]) {
      const run = evaluate(deps, body.instance, body.mir, [integer(left), integer(3n)], "compile-time",
        { query: "constValue", key: [body.instance, "compile-time"] });
      assert.equal(run.kind, "done");
      assert.equal(run.value.kind, "ok");
      assert.deepEqual(run.value.value, { kind: "value", value: integer(expected) });
      assert.deepEqual(run.value.diagnostics, []);
    }
  }
});

for (const [family, cases] of [
  ["shift", [
    ["<<", "LessThanLessThanEqualsToken", [[9007199254740993n, 1n, 18014398509481986n],
      [1n, 63n, /integer overflow/u], [1n, 65n, /invalid integer shift count/u]]],
    [">>", "GreaterThanGreaterThanEqualsToken", [[-2n, 1n, -1n], [-2n, -1n, /invalid integer shift count/u]]],
    [">>>", "GreaterThanGreaterThanGreaterThanEqualsToken", [[-2n, 1n, 9223372036854775807n], [-2n, -1n, /invalid integer shift count/u]]],
  ]],
  ["division", [["/", "SlashEqualsToken", [[19n, 4n, 5n],
    [1n, 0n, /division by zero/u], [-9223372036854775808n, -1n, /integer overflow/u]]]]],
  ["remainder", [["%", "PercentEqualsToken", [[-5n, 3n, -2n], [1n, 0n, /remainder by zero/u]]]]],
])
test(`native local compound ${family} preserves its own faults and stores only on success`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const carrier = "int64";
  const zero = [{ carrier, law: "abort" }];
  for (const [operator, token, outcomes] of cases) {
    const input = analysisInput(fixture, "sdk-minimal", `export function compute(left = 1, right = 1) { return left ${operator}= (left = right); }`);
    const nativeFacts = { ...input.snapshot.nativeFacts,
      invalidShiftCount: family === "shift" ? [{ carrier, law: { kind: "fail", failure: "abort" } }] : [],
      integerOverflow: operator === "<<" ? [{ carrier, operation: "left-shift", result: carrier, law: "abort" }] : [],
      divisionByZero: family === "division" ? zero : [],
      divisionRounding: family === "division" ? [{ carrier, rounding: "ceiling" }] : [],
      signedQuotientOverflow: family === "division" ? [{ carrier, law: "abort" }] : [],
      remainderByZero: family === "remainder" ? zero : [],
      remainderSign: family === "remainder" ? [{ carrier, sign: "dividend" }] : [],
    };
    const program = analyzeHostProgram({ ...input, snapshot: { ...input.snapshot, nativeFacts } });
    assert.equal(program.kind, "ok", JSON.stringify(program.diagnostics));
    const { index: { types }, modules } = program.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    const [declaration] = readyModuleStatements(readyModuleRoot(module.tree));
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    const assignment = body.tir.root.statements.nodes[0].expression;
    const type = body.tir.completion;
    const entry = body.mir.blocks[body.mir.entries.find(row => row.provided === body.tir.params.length).block];
    const reading = entry.statements.findIndex(row => row.kind === "assign" && row.tir.node === assignment.left.id && row.value.kind === "use");
    const nested = entry.statements.findIndex(row => row.kind === "assign" && row.tir.node === assignment.right.expression.id);
    assert.ok(reading >= 0 && nested > reading);
    assert.equal(assignment.operatorToken.kind, token);
    assert.equal(entry.terminator.kind, "invoke");
    assert.equal(entry.terminator.tir.node, assignment.id);
    assert.deepEqual(entry.terminator.unwind, { kind: "abort" });
    assert.deepEqual(entry.terminator.operation.decision, { kind: "selected",
      operation: { kind: "native-operator", operator, carrier }, operands: [type, type], result: type,
      execution: { kind: "invocation", writesStorage: false, failure: "abort" } });
    const stores = body.mir.blocks.flatMap(block => block.statements.flatMap(row =>
      row.kind === "assign" && row.tir.node === assignment.id && row.value.kind === "use" ? [block.id] : []));
    assert.deepEqual(stores, [entry.terminator.next]);
    const integer = numerator => ({ kind: "number", type, value: { numerator, denominator: 1n, negativeZero: false } });
    const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
      selectedNativeFacts: nativeFacts, limits: input.limits.evaluation };
    for (const [left, right, expected] of outcomes) {
      const run = evaluate(deps, body.instance, body.mir, [integer(left), integer(right)], "compile-time",
        { query: "constValue", key: [body.instance, "compile-time"] });
      assert.equal(run.kind, "done");
      assert.equal(run.value.kind, "ok");
      if (typeof expected === "bigint") {
        assert.deepEqual(run.value.value, { kind: "value", value: integer(expected) });
        assert.deepEqual(run.value.diagnostics, []);
      } else {
        assert.deepEqual(run.value.value, { kind: "value", value: { kind: "error", type } });
        assert.equal(run.value.diagnostics.length, 1);
        assert.match(run.value.diagnostics[0].message, expected);
        assert.deepEqual(run.value.diagnostics[0].site, { kind: "source", origin: entry.terminator.origin });
      }
    }
  }
});

test("authored integer left shift keeps count and result overflow as separate selected laws", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export function shift(left = 1, count = 1) { return left << count; }");
  const mask = { kind: "mask", mask: 63n };
  const abort = { kind: "fail", failure: "abort" };
  const overflowRow = { carrier: "int64", operation: "left-shift", result: "int64" };
  const analyze = (count, overflow) => {
    const nativeFacts = { ...input.snapshot.nativeFacts,
      integerOverflow: overflow === null ? [] : [{ ...overflowRow, law: overflow }],
      invalidShiftCount: count === null ? [] : [{ carrier: "int64", law: count }] };
    return { nativeFacts, program: analyzeHostProgram({ ...input, snapshot: { ...input.snapshot, nativeFacts } }) };
  };
  for (const [count, overflow] of [[mask, "wrap"], [mask, "abort"], [abort, "wrap"], [abort, "abort"]]) {
    const { nativeFacts, program } = analyze(count, overflow);
    assert.equal(program.kind, "ok", JSON.stringify(program.diagnostics));
    const { index: { types }, modules } = program.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    const [declaration] = readyModuleStatements(readyModuleRoot(module.tree));
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    const type = body.tir.completion;
    const invokes = body.mir.blocks.map(row => row.terminator).filter(row => row.kind === "invoke");
    const fails = count.kind === "fail" || overflow === "abort";
    assert.equal(invokes.length, fails ? 1 : 0);
    const operation = fails ? invokes[0].operation : body.mir.blocks.flatMap(row => row.statements)
      .find(row => row.kind === "assign" && row.value.kind === "binary").value.operation;
    assert.deepEqual(operation.decision.operation, { kind: "native-operator", operator: "<<", carrier: "int64" });
    assert.deepEqual(types.terms[type], { kind: "primitive", primitive: "int64" });
    const normal = 18_014_398_509_481_986n;
    for (const [operands, expected, fault] of [
      [[9_007_199_254_740_993n, 1n], normal, null],
      [[1n, 63n], overflow === "wrap" ? -9_223_372_036_854_775_808n : null, "integer overflow"],
      [[9_007_199_254_740_993n, 65n], count.kind === "mask" ? normal : null, "invalid integer shift count"],
    ]) {
      const args = operands.map(numerator => ({ kind: "number", type, value: { numerator, denominator: 1n, negativeZero: false } }));
      const evaluated = evaluate({ types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
        selectedNativeFacts: nativeFacts, limits: input.limits.evaluation }, body.instance, body.mir, args,
        "compile-time", { query: "constValue", key: [body.instance, "compile-time"] });
      assert.equal(evaluated.kind, "done");
      assert.equal(evaluated.value.kind, "ok");
      assert.deepEqual(evaluated.value.value, { kind: "value", value: expected === null ? { kind: "error", type } : {
        kind: "number", type, value: { numerator: expected, denominator: 1n, negativeZero: false } } });
      if (expected === null) {
        assert.deepEqual(invokes[0].unwind, { kind: "abort" });
        assert.deepEqual(evaluated.value.diagnostics.map(row => row.message),
          [`A process-ending ${fault} occurred during constant evaluation.`]);
        assert.deepEqual(evaluated.value.diagnostics[0].site, { kind: "source", origin: invokes[0].origin });
      } else assert.deepEqual(evaluated.value.diagnostics, []);
    }
  }
  assert.throws(() => analyze(null, "wrap"), /actual selected native shift-count law/u);
  assert.throws(() => analyze(mask, null), /actual selected native left-shift overflow law/u);
  assert.throws(() => analyze({ kind: "fail", failure: "unwind" }, "abort"), /distinct native shift-count and left-shift overflow continuations/u);
});

test("authored integer division uses independently selected rounding, zero and quotient laws", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export function divide(left = 1, right = 1) { return left / right; } "
    + "export const observed = 19 / 4;");
  const base = { ...input.snapshot.nativeFacts, integerOverflow: [], remainderSign: [], remainderByZero: [],
    divisionByZero: [{ carrier: "int64", law: "abort" }] };
  const analyze = nativeFacts => analyzeHostProgram({ ...input, snapshot: { ...input.snapshot, nativeFacts } });
  assert.throws(() => analyze(input.snapshot.nativeFacts), /distinct native division-by-zero and signed quotient overflow continuations/u);
  for (const [absent, diagnostic] of [["divisionByZero", /division-by-zero law/u],
    ["divisionRounding", /division rounding law/u], ["signedQuotientOverflow", /signed quotient overflow law/u]])
    assert.throws(() => analyze({ ...base, [absent]: [] }), diagnostic);
  for (const [rounding, overflow, expected] of [["toward-zero", "wrap", 4n], ["ceiling", "abort", 5n]]) {
    const nativeFacts = { ...base, divisionRounding: [{ carrier: "int64", rounding }],
      signedQuotientOverflow: [{ carrier: "int64", law: overflow }] };
    const program = analyze(nativeFacts);
    assert.equal(program.kind, "ok", JSON.stringify(program.diagnostics));
    const { index, modules } = program.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    const [declaration, observed] = readyModuleStatements(readyModuleRoot(module.tree));
    const callable = declaration.tsonic.signatures[0].body;
    const initializer = observed.declarationList.declarations.nodes[0].tsonic.initializer;
    const types = index.types;
    for (const [bodyId, operands, value, failure] of [
      [initializer, [], expected, null], [callable, [1n, 0n], null, /division by zero/u],
      [callable, [-9223372036854775808n, -1n], overflow === "wrap" ? -9223372036854775808n : null, /integer overflow/u],
    ]) {
      const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === bodyId);
      const type = body.tir.completion;
      const [invoke] = body.mir.blocks.map(row => row.terminator).filter(row => row.kind === "invoke");
      assert.deepEqual(invoke.operation.decision, { kind: "selected", operation: { kind: "native-operator", operator: "/", carrier: "int64" },
        operands: [type, type], result: type, execution: { kind: "invocation", writesStorage: false, failure: "abort" } });
      assert.deepEqual(invoke.unwind, { kind: "abort" });
      const args = operands.map(numerator => ({ kind: "number", type, value: { numerator, denominator: 1n, negativeZero: false } }));
      const evaluated = evaluate({ types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
        selectedNativeFacts: nativeFacts, limits: input.limits.evaluation }, body.instance, body.mir, args,
      "compile-time", { query: "constValue", key: [body.instance, "compile-time"] });
      assert.equal(evaluated.kind, "done");
      assert.equal(evaluated.value.kind, "ok");
      assert.deepEqual(evaluated.value.value, { kind: "value", value: value === null ? { kind: "error", type } : {
        kind: "number", type, value: { numerator: value, denominator: 1n, negativeZero: false } } });
      if (value === null) assert.match(evaluated.value.diagnostics[0].message, failure);
    }
  }
});

test("authored integer remainder preserves its independent sign and zero-divisor laws", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const original = analysisInput(fixture, "sdk-minimal",
    "export function remainder(left = 5, right = 2) { return left % right; } export const observed = remainder();");
  const native = { ...original.snapshot.nativeFacts, integerOverflow: [], divisionRounding: [],
    divisionByZero: [{ carrier: "int64", law: "unwind" }], signedQuotientOverflow: [{ carrier: "int64", law: "unwind" }] };
  const run = (remainderSign, remainderByZero) => {
    const nativeFacts = { ...native, remainderSign, remainderByZero };
    const snapshot = { ...original.snapshot, nativeFacts };
    return { nativeFacts, result: analyzeHostProgram({ ...original, snapshot }) };
  };
  const zero = [{ carrier: "int64", law: "abort" }];
  const selectedSign = [{ carrier: "int64", sign: "dividend" }];
  assert.throws(() => run(selectedSign, []), /actual selected native remainder-by-zero law/u);
  assert.throws(() => run([], zero), /actual selected native remainder sign law/u);
  assert.throws(() => run([{ carrier: "uint64", sign: "dividend" }], zero), /actual selected native remainder sign law/u);
  for (const [sign, operands, expected] of [
    ["dividend", [-5n, 3n], -2n],
    ["divisor", [5n, -3n], -1n],
    ["nonnegative", [-5n, -3n], 1n],
  ]) {
    const { nativeFacts, result } = run([{ carrier: "int64", sign }], zero);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { index, modules } = result.value;
    const module = modules.find(row => row.module === original.snapshot.entryPoint);
    const [declaration] = readyModuleStatements(readyModuleRoot(module.tree));
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    const expression = body.tir.root.statements.nodes[0].expression;
    const type = body.tir.completion;
    assert.equal(expression.operatorToken.kind, "PercentToken");
    assert.equal(expression.tsonic.role, "arithmetic");
    assert.deepEqual(index.types.terms[type], { kind: "primitive", primitive: "int64" });
    const [invoke] = body.mir.blocks.map(row => row.terminator).filter(row => row.kind === "invoke");
    assert.deepEqual(invoke.unwind, { kind: "abort" });
    assert.deepEqual(invoke.operation.decision, { kind: "selected", operation: { kind: "native-operator", operator: "%", carrier: "int64" },
      operands: [type, type], result: type, execution: { kind: "invocation", writesStorage: false, failure: "abort" } });
    for (const [numbers, value] of [[operands, expected], [[9007199254740993n, 2n], 1n],
      [[-9223372036854775808n, -1n], 0n], [[1n, 0n], null]]) {
      const args = numbers.map(numerator => ({ kind: "number", type, value: { numerator, denominator: 1n, negativeZero: false } }));
      const types = index.types;
      const evaluated = evaluate({ types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
        selectedNativeFacts: nativeFacts, limits: original.limits.evaluation }, body.instance, body.mir, args,
      "compile-time", { query: "constValue", key: [body.instance, "compile-time"] });
      assert.equal(evaluated.kind, "done");
      assert.equal(evaluated.value.kind, "ok");
      assert.deepEqual(evaluated.value.value, { kind: "value", value: value === null ? { kind: "error", type } : { kind: "number", type,
        value: { numerator: value, denominator: 1n, negativeZero: false } } });
      if (value === null) {
        assert.equal(evaluated.value.diagnostics.length, 1);
        assert.equal(evaluated.value.diagnostics[0].code.name, "TSONIC_CONSTANT_EVALUATION_FAILED");
        assert.match(evaluated.value.diagnostics[0].message, /process-ending integer remainder by zero/u);
        assert.deepEqual(evaluated.value.diagnostics[0].site, { kind: "source", origin: invoke.origin });
      }
    }
  }
});

for (const [name, rows] of [
  ["equality", [["==", false, true], ["!=", true, false], ["===", false, true], ["!==", true, false]]],
  ["order", [["<", true, false], [">", false, false], ["<=", true, true], [">=", false, true]]],
])
test(`native integer ${name} compares adjacent exact integers without double rounding`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const source = rows.map(([operator], ordinal) =>
    `export function compare${ordinal}(left = 1, right = 2) { return left ${operator} right; }`).join(" ");
  const input = analysisInput(fixture, "sdk-minimal", source);
  const snapshot = { ...input.snapshot, nativeFacts: { ...input.snapshot.nativeFacts, integerOverflow: [] } };
  const result = analyzeHostProgram({ ...input, snapshot });
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === snapshot.entryPoint);
  const types = index.types;
  for (const [ordinal, [operator, adjacent, equal]] of rows.entries()) {
    const declaration = readyModuleStatements(readyModuleRoot(module.tree))[ordinal];
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    const [formal] = types.signatures[body.tir.signature].parameters;
    const type = body.tir.completion;
    assert.deepEqual(types.terms[formal.type], { kind: "primitive", primitive: "int64" });
    assert.deepEqual(types.terms[type], { kind: "primitive", primitive: "bool" });
    const binary = body.mir.blocks.flatMap(block => block.statements).find(row => row.kind === "assign" && row.value.kind === "binary");
    assert.deepEqual(binary.value.operation.decision, { kind: "selected", operation: { kind: "native-operator", operator, carrier: "int64" },
      operands: [formal.type, formal.type], result: type, execution: { kind: "pure" } });
    for (const [left, expected] of [[9007199254740992n, adjacent], [9007199254740993n, equal]]) {
      const args = [left, 9007199254740993n].map(numerator =>
        ({ kind: "number", type: formal.type, value: { numerator, denominator: 1n, negativeZero: false } }));
      const evaluated = evaluate({ types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
        selectedNativeFacts: snapshot.nativeFacts, limits: input.limits.evaluation }, body.instance, body.mir, args,
      "compile-time", { query: "constValue", key: [body.instance, "compile-time"] });
      assert.equal(evaluated.kind, "done");
      assert.equal(evaluated.value.kind, "ok");
      assert.deepEqual(evaluated.value.value, { kind: "value", value: { kind: "boolean", type, value: expected } });
    }
  }
  const [operator] = rows[0];
  const mixed = analysisInput(fixture, "sdk-minimal",
    `const left = 1; export function compare(right: number) { return left ${operator} right; }`);
  assert.throws(() => analyzeHostProgram(mixed), /binary operator .+ over int64 and float64/u);
});

test("two inferred callable groups verify the transitive initialization read at its original site", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { programLookup } = await import("../../packages/host/dist/ir-program/program-values.js");
  const { summaryKey } = await import("../../packages/host/dist/ir-facts/index.js");
  const calls = " function read() { return wide; } export function forward() { return read(); } export const observed = forward();";
  const source = "const wide = 9_007_199_254_740_993;" + calls;
  const input = analysisInput(fixture, "sdk-minimal", source);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [, read, forward, observed] = readyModuleStatements(readyModuleRoot(module.tree));
  const readBody = read.tsonic.signatures.find(row => row.role === "api-body").body;
  const forwardBody = forward.tsonic.signatures.find(row => row.role === "api-body").body;
  const initializer = observed.declarationList.declarations.nodes[0].tsonic;
  const bodies = module.bodies.filter(row => row.kind === "selected");
  const initializerBody = bodies.find(row => row.instance.body === initializer.initializer);
  const selectedRead = bodies.find(row => row.instance.body === readBody);
  const selectedForward = bodies.find(row => row.instance.body === forwardBody);
  assert.notEqual(selectedRead.tir.signature, selectedForward.tir.signature);
  for (const selected of [selectedRead, selectedForward, initializerBody]) {
    assert.equal(selected.tir.completion, initializer.storage);
    assert.deepEqual(index.types.terms[selected.tir.completion], { kind: "primitive", primitive: "int64" });
  }
  const lookup = programLookup(index);
  const summary = lookup.summaries.get(summaryKey({ kind: "body", execution: { instance: initializerBody.instance, provided: 0 } }));
  const needs = summary.initialization.points.filter(point => point.kind === "need");
  assert.equal(needs.length, 1);
  const { witness } = needs[0];
  assert.deepEqual(witness.read, { kind: "body", value: { body: readBody, node: selectedRead.tir.root.statements.nodes[0].expression.id } });
  assert.deepEqual(witness.via.map(link => link.key.execution.instance.body), [forwardBody, readBody]);
  for (const [position, link] of witness.via.entries()) {
    const upstream = lookup.summaries.get(summaryKey(link.key)).initialization;
    const point = upstream.points[upstream.rows[link.row].point];
    assert.equal(point.kind, "need");
    assert.deepEqual(point.witness, { read: witness.read, via: witness.via.slice(position + 1) });
  }

  const missing = "let wide: number;" + calls;
  const refused = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", missing));
  assert.equal(refused.kind, "refused");
  assert.equal(refused.diagnostics.length, 1);
  const [diagnostic] = refused.diagnostics;
  assert.equal(diagnostic.code.name, "TSONIC_STATIC_READ_BEFORE_INITIALIZATION");
  assert.equal(diagnostic.site.origin.start, missing.lastIndexOf("wide"));
});

test("module initialization credits only a called write on the exit that actually reaches the next initializer", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  const source = "import { state, update } from './provider.js'; "
    + "export const started: boolean = update(true, true); export const observed: boolean = state;";
  const run = (returned, unwound) => analyzeHostProgram({ ...input, snapshot: fixture.projectSnapshot({
    sourceFiles: { "main.ts": source,
      "provider.ts": "export let state: boolean; export let other: boolean; "
        + "export function update(flag: boolean, next: boolean): boolean { "
        + `if (flag) { ${returned} = next; return next; } ${unwound} = next; throw next; }` },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
  }) });
  assert.equal(run("state", "other").kind, "ok");
  const refused = run("other", "state");
  assert.equal(refused.kind, "refused");
  assert.equal(refused.diagnostics.length, 1);
  const [diagnostic] = refused.diagnostics;
  assert.equal(diagnostic.code.name, "TSONIC_STATIC_READ_BEFORE_INITIALIZATION");
  assert.equal(diagnostic.site.origin.start, source.lastIndexOf("state"));
  assert.equal(diagnostic.site.origin.module, fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
});

test("a re-exported initializer call establishes only its own module's same-spelled cell", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { programLookup } = await import("../../packages/host/dist/ir-program/program-values.js");
  const { summaryKey } = await import("../../packages/host/dist/ir-facts/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  const moduleOf = name => fixture.moduleOf(fixture.packageOf("/project"), `src/${name}.ts`);
  const main = owner => `import { pending as actual, prepare as writer } from './bridge.js';
    import './other.js';
    import { prepare as otherWriter } from './other.js';
    ${owner}(false);
    export const observed: boolean = actual;`;
  const run = name => analyzeHostProgram({ ...input, snapshot: fixture.projectSnapshot({ sourceFiles: {
    "main.ts": main(name),
    "bridge.ts": "export { state as pending, set as prepare } from './provider.js';",
    "provider.ts": "export let state: boolean; export function set(value: boolean): void { state = value; }",
    "other.ts": "export let state: boolean = true; export function prepare(value: boolean): void { state = value; }",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] }) });
  const result = run("writer");
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const entry = moduleOf("main");
  const provider = moduleOf("provider");
  const ownerOf = body => fixture.ids.decodeDefId(fixture.ids.decodeBodyId(body).value.owner).value.module;
  const executions = index.initialization.modules.map(execution => ownerOf(execution.instance.body));
  assert.deepEqual(executions, [provider, moduleOf("bridge"), moduleOf("other"), entry]);
  const published = modules.find(row => row.module === entry);
  const execution = index.initialization.modules.at(-1);
  const selected = published.bodies.find(row => row.kind === "selected" && row.instance.body === execution.instance.body);
  const first = selected.mir.blocks[selected.mir.entries[0].block].terminator;
  assert.equal(first.kind, "call");
  assert.equal(first.callee.kind, "direct");
  assert.equal(ownerOf(first.callee.resolution.activation.body), provider);
  const next = selected.mir.blocks[first.next].terminator;
  assert.equal(next.kind, "call");
  assert.equal(next.callee.kind, "body");
  assert.equal(ownerOf(next.callee.instance.body), entry);
  const lookup = programLookup(index);
  const summaryOf = execution => lookup.summaries.get(summaryKey({ kind: "body", execution }));
  const summary = summaryOf(execution);
  const read = summaryOf({ instance: next.callee.instance, provided: 0 });
  const needs = read.initialization.points.filter(row => row.kind === "need");
  assert.equal(needs.length, 1);
  const [need] = needs;
  const cell = read.arena.cells[need.cell];
  const { role } = cell;
  assert.equal(role.kind, "static");
  const definition = fixture.ids.decodeDefId(role.declaration.definition).value;
  assert.equal(definition.module, provider);
  assert.equal(definition.segments.at(-1).name, "state");
  const written = summary.arena.cells.find(row => row.role.kind === "static"
    && row.role.declaration.definition === role.declaration.definition);
  assert.deepEqual(written.occurrence, cell.occurrence);
  assert.equal(summary.contentsOnReturn.some(row => row.target === written.id), true);
  assert.equal(summary.initialization.points.some(row => row.kind === "need" && row.cell === written.id), false);

  const refused = run("otherWriter");
  assert.equal(refused.kind, "refused");
  assert.equal(refused.diagnostics.length, 1);
  const [diagnostic] = refused.diagnostics;
  assert.equal(diagnostic.code.name, "TSONIC_STATIC_READ_BEFORE_INITIALIZATION");
  assert.equal(diagnostic.site.origin.module, entry);
  assert.equal(diagnostic.site.origin.start, main("otherWriter").lastIndexOf("actual"));
  assert.equal(diagnostic.related.at(-1).site.origin.module, provider);
});

test("module initialization transports an imported static read through genuinely placed calls", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { programLookup } = await import("../../packages/host/dist/ir-program/program-values.js");
  const { summaryKey } = await import("../../packages/host/dist/ir-facts/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  const moduleOf = name => fixture.moduleOf(fixture.packageOf("/project"), `src/${name}.ts`);
  const imports = "import { value as selected } from './provider.js'; ";
  for (const [text, hops] of [
    [imports + "export const result: boolean = selected;", 1],
    [imports + "function read(): boolean { return selected; } export const result: boolean = read();", 2],
    [imports + "function read(): boolean | undefined { return selected; } export const result: boolean | undefined = read();", 2],
  ]) {
    const snapshot = declaration => fixture.projectSnapshot({ sourceFiles: {
      "main.ts": text, "provider.ts": `export const unrelated: boolean = true; ${declaration}`,
    }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
    const current = analyzeHostProgram({ ...input, snapshot: snapshot("export const value: boolean = true;") });
    assert.equal(current.kind, "ok", JSON.stringify(current.diagnostics));
    const { index } = current.value;
    const [provider, consumer] = index.initialization.modules;
    const lookup = programLookup(index);
    const summaryOf = execution => lookup.summaries.get(summaryKey({ kind: "body", execution }));
    const providerCells = summaryOf(provider).arena.cells;
    const summary = summaryOf(consumer);
    const [need] = summary.initialization.points.filter(point => point.kind === "need");
    const cell = summary.arena.cells[need.cell];
    assert.equal(cell.role.kind, "static");
    assert.equal(fixture.ids.decodeDefId(cell.role.declaration.definition).value.segments.at(-1).name, "value");
    assert.deepEqual(cell.role, providerCells.find(row => row.role.declaration.definition === cell.role.declaration.definition).role);
    assert.deepEqual(cell.occurrence, providerCells.find(row => row.role.declaration.definition === cell.role.declaration.definition).occurrence);
    assert.equal(summary.arena.cells.filter(row => row.role.declaration.definition === cell.role.declaration.definition).length, 1);
    assert.equal(need.witness.via.length, hops);
    assert.equal(need.witness.read.kind, "body");
    assert.equal(summary.contentsOnReturn.some(write => write.target === cell.id), false, "a transported read must not write the imported cell");
    const refused = analyzeHostProgram({ ...input, snapshot: snapshot("export let value: boolean;") });
    assert.equal(refused.kind, "refused");
    const [error] = refused.diagnostics;
    assert.equal(error.code.name, "TSONIC_STATIC_READ_BEFORE_INITIALIZATION");
    assert.equal(error.site.origin.start, text.lastIndexOf("selected"));
    assert.deepEqual(error.related.map(row => row.site.origin.module), [
      ...Array.from({ length: hops }, () => moduleOf("main")), moduleOf("provider"),
    ]);
  }
  const interrupted = analyzeHostProgram({ ...input, snapshot: fixture.projectSnapshot({ sourceFiles: {
    "main.ts": imports + "function stop(value: boolean): boolean { throw value; } "
      + "export const early: boolean = stop(true); export const later: boolean = selected;",
    "provider.ts": "export let value: boolean;",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] }) });
  assert.equal(interrupted.kind, "ok", JSON.stringify(interrupted.diagnostics));
  const index = interrupted.value.index;
  const consumer = index.initialization.modules.at(-1);
  const summary = programLookup(index).summaries.get(summaryKey({ kind: "body", execution: consumer }));
  assert.equal(summary.returns, false);
  assert.equal(summary.unwinds, true);
  assert.equal(summary.initialization.points.some(point => point.kind === "need"), false);
  assert.equal(summary.arena.cells.some(row => row.role.kind === "static"
    && fixture.ids.decodeDefId(row.role.declaration.definition).value.module === moduleOf("provider")), false);
});

test("re-exported static storage is exposed by its declaring module even when a consumer reads it during initialization", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { programLookup } = await import("../../packages/host/dist/ir-program/program-values.js");
  const { summaryKey } = await import("../../packages/host/dist/ir-facts/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  const moduleOf = name => fixture.moduleOf(fixture.packageOf("/project"), `src/${name}.ts`);
  const sourceFiles = {
    "main.ts": "import { exposed } from './bridge.js'; export const value: boolean = exposed;",
    "bridge.ts": "export { value as exposed } from './provider.js';",
    "provider.ts": "export const value: boolean = true;",
  };
  const libraries = [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }];
  const reExport = { module: moduleOf("bridge"), name: "exposed" };
  const localExport = { module: moduleOf("main"), name: "value" };
  const run = (externalEntries, sources = sourceFiles) => analyzeHostProgram({ ...input,
    snapshot: fixture.projectSnapshot({ sourceFiles: sources, libraries, externalEntries }) });
  const keyOf = execution => ({ kind: "body", execution });
  for (const requests of [[reExport], [localExport, reExport]]) {
    const result = run(requests);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { index } = result.value;
    const [provider, , consumer] = index.initialization.modules;
    assert.equal(index.initialization.modules.length, 3);
    const lookup = programLookup(index);
    const summaryOf = execution => lookup.summaries.get(summaryKey(keyOf(execution)));
    const exposureOf = (request, module, execution) => {
      const exposure = index.initialization.external.find(entry => entry.module === request.module && entry.name === request.name);
      assert.equal(exposure.definitions.length, 1);
      assert.equal(exposure.storage.length, 1);
      const [declaration] = exposure.definitions;
      const [reference] = exposure.storage;
      assert.equal(fixture.ids.decodeDefId(declaration).value.module, module);
      assert.deepEqual(reference.owner, { kind: "summary", key: keyOf(execution) });
      const cell = summaryOf(execution).arena.cells[reference.cell];
      assert.equal(cell.role.kind, "static");
      assert.equal(cell.role.declaration.definition, declaration);
      return declaration;
    };
    assert.equal(index.initialization.external.length, requests.length);
    const declaration = exposureOf(reExport, moduleOf("provider"), provider);
    if (requests.includes(localExport)) assert.notEqual(exposureOf(localExport, moduleOf("main"), consumer), declaration);
    const summary = summaryOf(consumer);
    const [need] = summary.initialization.points.filter(point => point.kind === "need");
    assert.equal(summary.arena.cells[need.cell].role.declaration.definition, declaration);
    assert.equal(summary.contentsOnReturn.some(row => row.target === need.cell), false);
  }
  const refused = run([reExport], { ...sourceFiles, "provider.ts": "export let value: boolean;" });
  assert.equal(refused.kind, "refused");
  assert.equal(refused.diagnostics.length, 1);
  const [diagnostic] = refused.diagnostics;
  assert.equal(diagnostic.code.name, "TSONIC_STATIC_READ_BEFORE_INITIALIZATION");
  assert.equal(diagnostic.site.origin.module, moduleOf("main"));
  assert.equal(diagnostic.site.origin.start, sourceFiles["main.ts"].lastIndexOf("exposed"));
});

test("checked dependency diagnostics follow exact required executions, not package capture", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const root = "/project/node_modules/dependency";
  const name = "dependency";
  const module = fixture.moduleOf(fixture.packageOf(root), "index.ts");
  for (const use of ["type", "eager", "call"]) for (const broken of [false, true]) {
    const link = use === "type" ? 'import type { Ready } from "dependency"; export type Result = Ready;'
      : use === "eager" ? 'import "dependency";' : 'import { take } from "dependency";';
    const source = link + " export function run(value:boolean):boolean { return " + (use === "call" ? "take(value)" : "value") + "; }";
    const dependency = "export type Ready = boolean; export let boot:boolean = true; "
      + "export function take(value:boolean):boolean { return " + (broken ? "missing" : "value") + "; } "
      + "export function unused():boolean { return unrelated; }";
    const input = analysisInput(fixture, "sdk-minimal", source);
    input.snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
      libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
      extraFiles: { [root + "/package.json"]: JSON.stringify({ name, version: "1.0.0", types: "index.ts" }) },
      otherPackages: [{ root, name, modules: { "index.ts": ["source", dependency, false] } }] });
    const result = analyzeHostProgram(input);
    if (use === "call" && broken) {
      assert.equal(result.kind, "refused");
      assert.deepEqual(result.diagnostics.map(row => row.code.rendered), ["TS2304"]);
      assert.match(result.diagnostics[0].message, /missing/u);
      continue;
    }
    assert.equal(result.kind, "ok", use);
    const chapter = result.value.modules.find(row => row.module === module);
    const checked = result.value.index.modules.find(row => row.module === module);
    assert.equal(checked.checkerDiagnostics.length, broken ? 2 : 1);
    assert.deepEqual(result.diagnostics, []);
    assert.equal(chapter.tree.kind, use === "type" ? "checked-root" : "ready-root");
    if (use === "type") assert.equal(chapter.bodies.length, 0);
    else {
      const functions = chapter.tree.root.statements.nodes.filter(slot => slot.node.kind === "FunctionDeclaration");
      assert.deepEqual(functions.map(slot => slot.kind), [use === "call" ? "ready-callable" : "checked-declaration", "checked-declaration"]);
      assert.equal(chapter.bodies.some(row => row.kind === "selected" && row.tir.owner === functions[1].node.tsonic.definition), false);
      assert.equal(result.value.index.initialization.modules.some(row => row.instance.body === chapter.tree.root.tsonic.template.body), true);
    }
  }
});

test("one dependency body publishes both selected generic binding vectors and converts the literal at the actual formal", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const root = "/project/node_modules/dependency";
  const name = "dependency";
  const module = fixture.moduleOf(fixture.packageOf(root), "index.ts");
  const dependency = "export function take<T>(value:T):T {return value;} export function dormant():boolean{return missing;}";
  const source = 'import {take} from "dependency"; export function run(flag:boolean):boolean { '
    + "const first = take<boolean>(flag); const second = take<number>(1); return first; }";
  const input = analysisInput(fixture, "sdk-minimal", source);
  input.snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
    extraFiles: { [root + "/package.json"]: JSON.stringify({ name, version: "1.0.0", types: "index.ts" }) },
    otherPackages: [{ root, name, modules: { "index.ts": ["source", dependency, false] } }] });
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  assert.deepEqual(result.diagnostics, []);
  const { index, modules } = result.value;
  const chapter = modules.find(row => row.module === module);
  const selected = chapter.bodies.filter(row => row.kind === "selected" && row.tir.params.length === 1);
  assert.equal(selected.length, 2);
  assert.equal(selected[0].instance.body, selected[1].instance.body);
  assert.notEqual(selected[0].tir.signature, selected[1].tir.signature);
  const primitives = new Map();
  for (const row of selected) {
    const { bindings } = row.instance;
    assert.equal(bindings.kind, "instantiated");
    assert.deepEqual([bindings.bindings.classBindings, bindings.bindings.capturedBindings, bindings.bindings.selfBindings], [[], [], []]);
    assert.equal(bindings.bindings.methodBindings.length, 1);
    const [bound] = bindings.bindings.methodBindings;
    assert.equal(bound.kind, "bound");
    assert.equal(bound.type, row.tir.completion);
    assert.equal(index.types.signatures[row.tir.signature].parameters[0].type, bound.type);
    const type = index.types.terms[bound.type];
    assert.equal(type.kind, "primitive");
    primitives.set(type.primitive, bound);
    const edges = index.dependencyInventory.dependencies.filter(edge => edge.reason === "call" && edge.target.kind === "body"
      && fixture.types.sameInstance(edge.target.execution.instance, row.instance));
    assert.equal(edges.length, 1);
    assert.equal(edges[0].target.execution.provided, 1);
  }
  assert.deepEqual([...primitives.keys()].sort(), ["bool", "float64"]);
  assert.equal(primitives.get("bool").parameter, primitives.get("float64").parameter);
  const caller = modules.find(row => row.module === input.snapshot.entryPoint);
  const selectedCaller = caller.bodies.filter(row => row.kind === "selected");
  const conversions = selectedCaller.flatMap(row => row.mir.blocks.flatMap(block => block.statements))
    .filter(row => row.kind === "assign" && row.value.kind === "convert");
  assert.equal(conversions.some(row => {
    const operation = row.value.operation.decision.operation;
    return operation.kind === "conversion" && operation.to === primitives.get("float64").type
      && operation.embedding.kind === "conversion" && operation.embedding.conversion === "literal-fit";
  }), true);
});

test("an unresolved eager link reports only when its owning dependency initializer is required", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const root = "/project/node_modules/dependency";
  const name = "dependency";
  const dependency = 'import "./missing.js"; export type Ready = boolean;';
  const module = fixture.moduleOf(fixture.packageOf(root), "index.ts");
  for (const eager of [false, true]) {
    const source = eager ? 'import "dependency";' : 'import type { Ready } from "dependency"; export type Result = Ready;';
    const input = analysisInput(fixture, "sdk-minimal", source);
    input.snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
      libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
      extraFiles: { [root + "/package.json"]: JSON.stringify({ name, version: "1.0.0", types: "index.ts" }) },
      otherPackages: [{ root, name, modules: { "index.ts": ["source", dependency, false] } }] });
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok");
    const [original] = captured.value.modules.find(row => row.module.module === module).module.checkerDiagnostics;
    assert.equal(original.code.rendered, "TS2882");
    const typed = typeSourceBarrier(input, captured.value, createTypedAccount(input));
    const result = analyzeHostProgram(input);
    if (eager) {
      assert.equal(typed.kind, "refused");
      assert.equal(typed.diagnostics.length, 1);
      assert.equal(typed.diagnostics[0], original);
      assert.equal(result.kind, "refused");
      assert.deepEqual(result.diagnostics, [original]);
    } else {
      assert.equal(typed.kind, "ok");
      assert.equal(result.kind, "ok");
      assert.deepEqual(result.diagnostics, []);
      const chapter = result.value.modules.find(row => row.module === module);
      assert.equal(chapter.tree.kind, "checked-root");
      assert.deepEqual(chapter.bodies, []);
    }
  }
});

test("dependency defaults are opened only by the selected provided counts", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const root = "/project/node_modules/dependency";
  const name = "dependency";
  const module = fixture.moduleOf(fixture.packageOf(root), "index.ts");
  for (const [calls, expected] of [["return take(true,false);", [2]], ["return take();", [0]],
    ["if (flag) return take(); return take(true,false);", [2, 0]]]) for (const broken of [false, true]) {
    const source = 'import {take} from "dependency"; export function run(flag:boolean):boolean {' + calls + "}";
    const dependency = "export function take(first:boolean=" + (broken ? "missingDefault" : "true")
      + ", second:boolean=false):boolean {return first;}";
    const input = analysisInput(fixture, "sdk-minimal", source);
    input.snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
      libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
      extraFiles: { [root + "/package.json"]: JSON.stringify({ name, version: "1.0.0", types: "index.ts" }) },
      otherPackages: [{ root, name, modules: { "index.ts": ["source", dependency, false] } }] });
    const result = analyzeHostProgram(input);
    if (broken && expected.includes(0)) {
      assert.equal(result.kind, "refused");
      assert.deepEqual(result.diagnostics.map(row => row.code.rendered), ["TS2304"]);
      assert.match(result.diagnostics[0].message, /missingDefault/u);
      continue;
    }
    assert.equal(result.kind, "ok");
    const chapter = result.value.modules.find(row => row.module === module);
    const selected = chapter.bodies.find(row => row.kind === "selected" && row.tir.params.length === 2);
    assert.deepEqual(selected.mir.entries.map(entry => entry.provided), expected);
    assert.deepEqual(selected.facts.map(row => row.execution.provided).sort((left, right) => right - left), expected);
    for (const formal of selected.tir.params) {
      const initializer = chapter.bodies.find(row => row.kind === "selected" && row.tir.body === formal.tsonic.initializer);
      assert.equal(formal.initializer.kind, expected.includes(0) ? "ready-default" : "checked-default");
      assert.equal(initializer !== undefined, expected.includes(0));
      if (initializer !== undefined) assert.equal(initializer.tir.root === formal.initializer.root, true);
    }
  }
});

test("initialization follows the runtime dependency graph, not the compilation roots", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { planModuleInitialization } = await import("../../packages/host/dist/pipeline/module-initialization.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const { parseProgramIndex, printProgramIndex } = await import("../../packages/host/dist/ir-program/index.js");
  const { verifyInitialization } = await import("../../packages/host/dist/ir-program/verify-initialization.js");
  const { programLookup } = await import("../../packages/host/dist/ir-program/program-values.js");
  const { createAccount, accountFailure } = await import("../../packages/host/dist/dataflow/index.js");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const { canonicalizeProgram, createProgramVerificationWork } = await import("../../packages/host/dist/ir-program/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  const moduleOf = name => fixture.moduleOf(fixture.packageOf("/project"), `src/${name}.ts`);
  input.snapshot = fixture.projectSnapshot({ sourceFiles: {
    "entry.ts": "import './zeta.js'; import type { Flag } from './types.js'; import './alpha.js'; import './declarations.js'; "
      + "export function run(value: Flag): boolean { return value; }",
    "declarations.d.ts": "export declare const ambient: boolean;",
    "zeta.ts": "import './common.js'; export function a(value: boolean): boolean { return value; }",
    "alpha.ts": "import './common.js'; export function b(value: boolean): boolean { return value; }",
    "common.ts": "import './zeta.js'; export function shared(value: boolean): boolean { return value; }",
    "types.ts": "export type Flag = boolean;",
    "unused.ts": "export function unused(value: boolean): boolean { return value; }",
    "later.ts": "import './auxiliary.js'; export {first as late} from './auxiliary.js';",
    "auxiliary.ts": "import './common.js'; export function first(value: boolean): boolean { return value; }",
    "earlier.ts": "export {first as early} from './auxiliary.js';",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
  externalEntries: [{ module: moduleOf("later"), name: "late" }, { module: moduleOf("earlier"), name: "early" }] });
  const declarative = input.snapshot.source.input.packages.modules.find(row => row.path === "/project/src/declarations.d.ts");
  declarative.role = "declaration";
  const expected = ["common", "zeta", "alpha", "entry", "auxiliary", "later", "earlier"].map(moduleOf);
  const prove = pipelineWiring.bodyAnalysis.proveInitialization;
  let applications = 0;
  const applied = [];
  pipelineWiring.bodyAnalysis.proveInitialization = (deps, initialization) => {
    applications += 1;
    applied.push(initialization);
    assert.deepEqual(initialization.modules.map(execution => {
      assert.equal(execution.provided, 0);
      const body = fixture.ids.decodeBodyId(execution.instance.body);
      assert.equal(body.kind, "decoded");
      assert.equal(body.value.role, "module");
      const owner = fixture.ids.decodeDefId(body.value.owner);
      assert.equal(owner.kind, "decoded");
      return owner.value.module;
    }), expected);
    assert.equal(initialization.entries.length, 1, "two authored names share one actual executable entry");
    return prove(deps, initialization);
  };
  try {
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok");
    assert.equal(applications, 1);
    const { index } = result.value;
    const { initialization } = index;
    assert.equal(initialization.entry, moduleOf("entry"));
    assert.deepEqual(initialization.modules, applied[0].modules);
    assert.deepEqual(initialization.entries, applied[0].entries);
    const { owner: callable } = fixture.ids.decodeBodyId(initialization.entries[0].instance.body).value;
    assert.deepEqual(initialization.external, [
      { module: moduleOf("later"), name: "late", definitions: [callable], storage: [] },
      { module: moduleOf("earlier"), name: "early", definitions: [callable], storage: [] },
    ]);
    const printed = printProgramIndex(index);
    const decoded = parseProgramIndex(printed);
    assert.equal(decoded.kind, "parsed");
    assert.deepEqual(decoded.value.initialization, initialization);
    assert.equal(printProgramIndex(decoded.value), printed);
    assert.equal(parseProgramIndex(printed.slice(0, printed.lastIndexOf(", initialization=")) + ")").kind, "invalid-text");
    const canonical = canonicalizeProgram(result.value, { table: index.types,
      types: index.types.terms.map((_row, position) => position), signatures: index.types.signatures.map((_row, position) => position) },
    createProgramVerificationWork(input.limits.instantiation, createAccount(input.limits.dataflow)), { kind: "data-only" });
    assert.equal(canonical.kind, "complete");
    assert.deepEqual(canonical.value.index.initialization, initialization);
    const checked = (candidate, limits = input.limits.dataflow) =>
      verifyInitialization(candidate, programLookup(index), initialization, createAccount(limits));
    assert.deepEqual(checked(decoded.value), { kind: "complete", value: [] });
    for (const [changes, rule] of [
      [{ entry: moduleOf("unused") }, "initialization-entry-exact"],
      [{ external: [...initialization.external].reverse() }, "initialization-exposure-exact"],
      [{ external: [{ ...initialization.external[0], definitions: [] }, initialization.external[1]] }, "initialization-exposure-exact"],
      [{ modules: [...initialization.modules].reverse() }, "initialization-executions-exact"],
      [{ modules: initialization.modules.slice(1) }, "initialization-executions-exact"],
      [{ modules: [initialization.modules[1], ...initialization.modules.slice(1)] }, "initialization-executions-exact"],
      [{ entries: [{ ...initialization.entries[0], provided: 0 }] }, "initialization-executions-exact"],
    ]) {
      const opposite = checked({ ...decoded.value, initialization: { ...initialization, ...changes } });
      assert.equal(opposite.kind, "complete");
      assert.equal(opposite.value.some(issue => issue.rule === rule), true);
    }
    const unread = { ...decoded.value, get initialization() { assert.fail("no plan read after account refusal"); } };
    assert.equal(checked(unread, { maximumWork: 0, maximumResultEntries: 10000 }).kind, "resource-limit");
    for (const name of ["unused", "types"])
      assert.equal(index.modules.some(module => module.module === moduleOf(name)), true, "compilation modules still publish");
    assert.equal(index.modules.some(module => module.module === declarative.id), true);
    assert.equal(index.bodies.some(body => body.module === declarative.id && body.kind === "selected"), false);

    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok");
    const source = captured.value;
    assert.equal(source.modules.find(row => row.module.module === declarative.id).role, "declaration");
    const plan = account => planModuleInitialization(initialization.entry, source, initialization.external, account);
    const allowance = input.limits.dataflow;
    const account = createAccount(allowance);
    const expectedRoots = expected.map(module => source.modules.find(row => row.module.module === module).module.tree);
    const checkPlan = result => {
      assert.equal(result.kind, "complete");
      assert.equal(result.value.length, expectedRoots.length);
      assert.equal(result.value.every((root, index) => root === expectedRoots[index]
        && root.tsonic.body === initialization.modules[index].instance.body), true);
    };
    checkPlan(plan(account));
    const { work, entries } = InvocationAccount.stateOf(account);
    for (const [field, dimension, exact] of [["maximumWork", "work", work], ["maximumResultEntries", "result-entries", entries]]) {
      for (let maximum = 0; maximum < exact; maximum += 1) {
        const limited = createAccount({ ...allowance, [field]: maximum });
        const stopped = plan(limited);
        assert.deepEqual(stopped, { kind: "resource-limit", dimension, maximum });
        assert.equal(stopped === accountFailure(limited), true);
      }
      checkPlan(plan(createAccount({ ...allowance, [field]: exact })));
    }
    const missing = { ...source, modules: source.modules.filter(row => row.module.module !== declarative.id) };
    assert.throws(() => planModuleInitialization(initialization.entry, missing, initialization.external,
      createAccount(allowance)), /An eager project dependency requires its actual checked module/u);
  } finally { pipelineWiring.bodyAnalysis.proveInitialization = prove; }
});

test("typed modules retain only their own ready templates and selected bodies in publication order", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { instanceKey } = await import("../../packages/host/dist/ir-types/index.js");
  const sourceFiles = { "main.ts": "export const value: boolean = true;" };
  for (let position = 0; position < 12; position += 1) {
    sourceFiles[`module${position}.ts`] = "export function value(first: boolean, second: boolean = !first): boolean { "
      + "const local: boolean = !second; return local; }";
  }
  const libraries = [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }];
  const input = { ...analysisInput(fixture, "sdk-minimal"), snapshot: fixture.projectSnapshot({ sourceFiles, libraries }) };
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const typed = typeSourceBarrier(input, captured.value, createTypedAccount(input));
  assert.equal(typed.kind, "ok", JSON.stringify(typed.diagnostics));
  const { bodies, modules } = typed.value;
  assert.equal(modules.size, captured.value.modules.length);
  const selected = [...bodies.values()].filter(body => body.bindings.kind === "instantiated");
  assert.ok(selected.length > Object.keys(sourceFiles).length * 2);
  for (const { module: checked, role } of captured.value.modules) {
    const published = modules.get(checked.module);
    const ownSelected = selected.filter(body => body.root.origin.module === checked.module);
    if (role === "declaration") {
      assert.equal(published.tree.kind, "checked-root");
      assert.equal(published.tree.root, checked.tree);
      assert.deepEqual(published.bodies, []);
      assert.deepEqual(ownSelected, []);
      continue;
    }
    const templates = checked.bodies.map(body => instanceKey({ body: body.body, bindings: { kind: "parametric" } }));
    const keyOf = body => instanceKey({ body: body.body, bindings: body.bindings });
    assert.deepEqual(published.bodies.map(keyOf), [...templates, ...ownSelected.map(keyOf)]);
    assert.equal(readyModuleRoot(published.tree) === published.bodies.find(body => body.root.kind === "SourceFile").root, true);
    assert.equal(published.bodies.every(body => body.root.origin.module === checked.module && body === bodies.get(keyOf(body))), true);
  }
});

test("actual checker session declarations survive all Host barriers without running as source modules", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { createModuleBindingViews, resolveModuleExport } = await import("../../packages/host/dist/ir-hir/index.js");
  const root = "/native-provider";
  const packageId = fixture.packageOf(root);
  const specifier = "native:thing";
  const providerModuleId = "native.thing";
  const reference = { package: packageId, moduleSpecifier: "./plugin.js", exportId: "provider", version: "1" };
  const provider = {
    identity: { id: "test.native", version: "1.0.0", extensionContractVersion: fixture.sdk.TstsSourceProviderContractVersion,
      diagnosticRange: { start: 9900000, end: 9900099 } },
    declarationMaterialization: "complete",
    ownsModule: name => name === specifier ? { kind: "owned" } : { kind: "unowned" },
    resolveModule: name => ({ kind: "virtual", moduleSpecifier: name, virtualFileName: "/provider/thing.d.ts", providerModuleId }),
    getDeclarationModel: () => ({ moduleSpecifier: specifier, providerModuleId,
      exports: [{ id: "Value", name: "Value", kind: "value", type: { kind: "number" } }] }),
  };
  const extensions = fixture.front.createCheckerExtensions([{ reference, value: { kind: "declaration-provider", value: provider } }]);
  const sourceFiles = { "main.ts": 'import type { Value } from "native:thing"; export type Ready = boolean; '
    + 'export const ready: boolean = true; export const other: boolean = false;' };
  const libraries = [{ name: "lib.es5.d.ts", text: ["Boolean", "Function", "CallableFunction", "NewableFunction", "IArguments",
    "Number", "Object", "RegExp", "String", "Array<T>"].map(name => `interface ${name} {}`).join("\n") }];
  const snapshotOf = sourceFiles => fixture.projectSnapshot({ sourceFiles, libraries, providerPackages: [{ root, name: "native-provider" }],
    declarationProviders: [reference] });
  const snapshot = snapshotOf(sourceFiles);
  const input = { ...analysisInput(fixture, "sdk-minimal"), snapshot, extensions };
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const checkedSource = captured.value.modules.find(row => row.module.module === snapshot.entryPoint);
  for (const statement of checkedSource.module.tree.statements.nodes.filter(node => node.kind === "VariableStatement")) {
    const literal = statement.declarationList.declarations.nodes[0].initializer;
    assert.deepEqual(literal.tsonic.value.observation, { kind: "available", value: null });
  }
  const providerModules = index.modules.filter(module => module.package === packageId);
  assert.equal(providerModules.length, 2);
  for (const module of providerModules) {
    assert.equal(snapshot.source.input.packages.modules.some(row => row.id === module.module), false);
    assert.equal(modules.find(row => row.module === module.module).bodies.every(body => body.kind === "template"), true);
  }
  const providerTrees = captured.value.modules.filter(row => providerModules.some(module => module.module === row.module.module))
    .map(row => {
      assert.equal(row.role, "declaration");
      return row.module;
    });
  const canonical = providerTrees.find(module => module.tree.statements.nodes[0].kind === "VariableStatement");
  const publicDocument = providerTrees.find(module => module.tree.statements.nodes[0].kind === "ImportDeclaration");
  const declaration = canonical.tree.statements.nodes[0].declarationList.declarations.nodes[0];
  const definition = declaration.tsonic.declaration.definition;
  assert.deepEqual(declaration.tsonic.core.provider, { kind: "available", value: definition });
  const registered = { providerId: provider.identity.id, providerVersion: provider.identity.version,
    providerModuleId, moduleSpecifier: specifier, exportId: "Value" };
  const layout = { fingerprint: "native-layout:v1", byteOrder: "big", addressWidth: 64 };
  const layoutSnapshot = snapshotOf({ "main.ts": 'import type { Value as NativeValue } from "native:thing"; '
    + "export type Ready = typeof NativeValue; export const Value: number = 1;" });
  const layoutInput = { ...input, snapshot: { ...layoutSnapshot,
    contributions: { ...layoutSnapshot.contributions, dataLayouts: [registered] },
    nativeFacts: { ...layoutSnapshot.nativeFacts, geometry: { layouts: [{ declaration: registered, layout }] } } } };
  const layoutSource = captureSourceBarrier(layoutInput);
  assert.equal(layoutSource.kind, "ok", JSON.stringify(layoutSource.diagnostics));
  const layoutOwner = layoutSource.value.modules.find(row => row.module.module === canonical.module).module;
  const layoutValue = layoutOwner.tree.statements.nodes[0].declarationList.declarations.nodes[0];
  assert.deepEqual(layoutValue.tsonic.memory, { kind: "available", value: {
    kind: "data-layout", occurrence: { kind: "item", value: { owner: definition, node: layoutValue.id } },
    bindings: { kind: "available", value: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } },
    declaration: { kind: "available", value: definition }, fingerprint: { kind: "available", value: layout.fingerprint },
    byteOrder: { kind: "available", value: layout.byteOrder }, addressWidth: { kind: "available", value: layout.addressWidth },
  } });
  const sameName = layoutSource.value.modules.find(row => row.module.module === layoutSnapshot.entryPoint).module
    .tree.statements.nodes.at(-1).declarationList.declarations.nodes[0];
  assert.equal(sameName.name.text, layoutValue.name.text);
  assert.equal(sameName.tsonic.memory.kind, "unavailable");
  const layoutProgram = analyzeHostProgram(layoutInput);
  assert.equal(layoutProgram.kind, "ok", JSON.stringify(layoutProgram.diagnostics));
  assert.deepEqual(layoutProgram.value.index.metadata, [], "an unopened registration is not a metadata demand");
  const layoutChapter = layoutProgram.value.modules.find(module => module.module === layoutOwner.module);
  assert.equal(layoutChapter.tree.kind, "checked-root");
  assert.deepEqual(layoutChapter.tree.root.statements.nodes[0].declarationList.declarations.nodes[0].tsonic.memory,
    layoutValue.tsonic.memory);
  const entry = providerModules.find(module => module.module === publicDocument.module).exports[0];
  const views = createModuleBindingViews(index.modules.map(module => module.bindings));
  const resolved = resolveModuleExport(views, entry);
  assert.deepEqual(resolved.target, { kind: "available", value: { kind: "declarations", definitions: [definition] } });
  assert.equal(resolved.aliases.length, 2);
  const owner = fixture.ids.decodeBodyId(index.initialization.modules[0].instance.body).value.owner;
  assert.equal(index.initialization.modules.length, 1);
  assert.equal(fixture.ids.decodeDefId(owner).value.module, snapshot.entryPoint);
  const refused = analyzeHostProgram({ ...input, snapshot: snapshotOf({ "main.ts": `${sourceFiles["main.ts"]} declare const wrong: number;` }) });
  assert.equal(refused.kind, "refused");
  assert.equal(refused.diagnostics.length, 1);
  assert.equal(refused.diagnostics[0].code.name, "TSONIC_SOURCE_FORM_UNSUPPORTED");
  assert.equal(refused.diagnostics[0].site.origin.module, snapshot.entryPoint);

  const overloaded = { ...provider, getDeclarationModel: () => ({ moduleSpecifier: specifier, providerModuleId,
    exports: [{ id: "Value", name: "Value", kind: "function", signatures: [
      { id: "Value.boolean", parameters: [], returnType: { kind: "boolean" } },
      { id: "Value.number", parameters: [], returnType: { kind: "number" } },
    ] }] }) };
  const overloadedInput = { ...input, snapshot: snapshotOf({ "main.ts": 'import type { Value } from "native:thing"; export type Ready = typeof Value;' }),
    extensions: fixture.front.createCheckerExtensions([{ reference, value: { kind: "declaration-provider", value: overloaded } }]) };
  const checkedOverloads = captureSourceBarrier(overloadedInput);
  assert.equal(checkedOverloads.kind, "ok");
  const overloadOwner = checkedOverloads.value.modules.find(row => fixture.ids.decodeModuleId(row.module.module).value.package === packageId
    && row.module.tree.statements.nodes[0].kind === "VariableStatement").module;
  const endpoints = overloadOwner.tree.statements.nodes[0].declarationList.declarations.nodes[0].type.members.nodes;
  assert.equal(endpoints.length, 2);
  const definitions = endpoints.map(endpoint => {
    assert.equal(endpoint.kind, "CallSignature");
    const { definition, signatures } = endpoint.tsonic;
    assert.deepEqual(endpoint.tsonic.core.provider, { kind: "available", value: definition });
    assert.equal(signatures.length, 1);
    assert.equal(signatures[0].declaration, definition);
    assert.equal(signatures[0].body, null);
    return definition;
  });
  assert.notEqual(definitions[0], definitions[1]);
  const published = analyzeHostProgram(overloadedInput);
  assert.equal(published.kind, "ok", JSON.stringify(published.diagnostics));
  const table = published.value.index.types;
  const results = definitions.map(definition => table.terms[table.signatures.find(signature => signature.declaration === definition).result]);
  assert.deepEqual(results, [{ kind: "primitive", primitive: "bool" }, { kind: "primitive", primitive: "float64" }]);
  assert.equal(published.value.index.initialization.modules.length, 1);

  const ordinaryInput = { ...overloadedInput, snapshot: snapshotOf({ "main.ts": 'import type { Value } from "native:thing"; '
    + "type Imported = typeof Value; function echo(flag: boolean): boolean { return flag; } "
    + "export function use(flag: boolean): boolean { return echo(flag); }" }) };
  const ordinary = captureSourceBarrier(ordinaryInput);
  assert.equal(ordinary.kind, "ok", JSON.stringify(ordinary.diagnostics));
  const ordinaryModule = ordinary.value.modules.find(row => row.module.module === ordinaryInput.snapshot.entryPoint).module;
  const ordinaryCall = ordinaryModule.tree.statements.nodes.at(-1).body.statements.nodes[0].expression;
  assert.deepEqual(ordinaryCall.tsonic.core.provider, { kind: "available", value: null });
  const ordinaryProgram = analyzeHostProgram(ordinaryInput);
  assert.equal(ordinaryProgram.kind, "ok", JSON.stringify(ordinaryProgram.diagnostics));

  const singleton = { ...provider, getDeclarationModel: () => ({ moduleSpecifier: specifier, providerModuleId,
    exports: [{ id: "Value", name: "Value", kind: "function", signatures: [
      { id: "Value.boolean", parameters: [], returnType: { kind: "boolean" } },
    ] }] }) };
  const nativeInput = { ...input, snapshot: snapshotOf({ "main.ts": 'import { Value } from "native:thing"; '
    + "export function use(): boolean { return Value(); }" }),
    extensions: fixture.front.createCheckerExtensions([{ reference, value: { kind: "declaration-provider", value: singleton } }]) };
  const native = captureSourceBarrier(nativeInput);
  assert.equal(native.kind, "ok", JSON.stringify(native.diagnostics));
  const nativeModule = native.value.modules.find(row => row.module.module === nativeInput.snapshot.entryPoint).module;
  const nativeCall = nativeModule.tree.statements.nodes.at(-1).body.statements.nodes[0].expression;
  assert.notDeepEqual(nativeCall.tsonic.core.provider, { kind: "available", value: null });
});

test("two imported overloads select their own bodyless endpoints in either declaration order or callee spelling", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const orders = [["boolean", "string"], ["string", "boolean"]];
  for (const [order, wrapped] of orders.flatMap(order => [false, true].map(wrapped => [order, wrapped]))) {
    const invocation = wrapped ? "((choose))" : "choose";
    const source = `import { pick as choose } from "./native.js";
      export function readBoolean(value: boolean): boolean { return ${invocation}(value); }
      export function readText(value: string): boolean { return ${invocation}(value); }`;
    const declarations = order.map(type => `export declare function pick(value: ${type}): boolean;`).join("\n");
    const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source, "native.d.ts": declarations },
      libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
    snapshot.source.input.packages.modules.find(row => row.path === "/project/src/native.d.ts").role = "declaration";
    const input = { ...analysisInput(fixture, "sdk-minimal"), snapshot };
    const checked = captureSourceBarrier(input);
    assert.equal(checked.kind, "ok", JSON.stringify(checked.diagnostics));
    const supplier = fixture.moduleOf(fixture.packageOf("/project"), "src/native.d.ts");
    const module = checked.value.modules.find(row => row.module.module === supplier).module;
    const definitions = module.tree.statements.nodes.map(node => node.tsonic.definition);
    assert.equal(new Set(definitions).size, 2);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { index, modules } = result.value;
    const chapter = modules.find(row => row.module === snapshot.entryPoint);
    const emitted = definitions.map(definition => index.types.signatures.find(row => row.declaration === definition).id);
    for (const [name, type] of [["readBoolean", "boolean"], ["readText", "string"]]) {
      const expected = definitions[order.indexOf(type)];
      const body = chapter.bodies.find(row => row.kind === "selected" && row.instance.body.includes(`;${name}];function;0]`));
      const call = body.tir.root.statements.nodes[0].expression;
      if (wrapped) {
        assert.equal(call.expression.kind, "ParenthesizedExpression");
        assert.equal(call.expression.expression.kind, "ParenthesizedExpression");
      }
      const callee = wrapped ? call.expression.expression.expression : call.expression;
      assert.equal(callee.kind, "Identifier");
      assert.equal(callee.tsonic.resolution.definition, expected);
      assert.equal(callee.tsonic.resolution.aliases.length > 0, true);
      const callable = index.types.terms[callee.tsonic.type];
      assert.equal(callable.kind, "callable");
      assert.deepEqual(new Set(callable.calls), new Set(emitted));
      const term = body.mir.blocks.find(row => row.terminator.kind === "call").terminator;
      assert.equal(term.callee.kind, "direct");
      const { resolution } = term.callee;
      assert.equal(resolution.activation, null);
      assert.deepEqual(resolution.decision.advertised, resolution.decision.api);
      assert.deepEqual(resolution.decision.api, { declaration: expected, role: "api-signature",
        signature: emitted[order.indexOf(type)], body: null });
      assert.equal(resolution.decision.completion.signature, resolution.decision.api.signature);
    }
  }
});

test("bodyless generic overloads retain each original binder and each selected nonempty application", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const snapshot = fixture.projectSnapshot({ sourceFiles: {
    "main.ts": `import { choose } from "./native.js";
      export function first(value: boolean): boolean { return choose(value); }
      export function second(value: string): string { return choose<string>(value, true); }
      export function third(value: string): string { return choose(value); }`,
    "native.d.ts": "export declare function choose<T>(value: T): T; export declare function choose<T>(value: T, other: boolean): T;",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  snapshot.source.input.packages.modules.find(row => row.path === "/project/src/native.d.ts").role = "declaration";
  const input = { ...analysisInput(fixture, "sdk-minimal"), snapshot };
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const chapter = modules.find(row => row.module === snapshot.entryPoint);
  const witnessed = [];
  for (const [name, count] of [["first", 1], ["second", 2], ["third", 1]]) {
    const body = chapter.bodies.find(row => row.kind === "selected" && row.instance.body.includes(`;${name}];function;0]`));
    const call = body.mir.blocks.find(row => row.terminator.kind === "call").terminator;
    assert.equal(call.callee.kind, "direct");
    assert.equal(call.callee.resolution.activation, null);
    const { advertised, api, bindings, implementationBindings, completion } = call.callee.resolution.decision;
    assert.deepEqual(api, advertised);
    assert.equal(api.role, "api-signature");
    assert.equal(api.body, null);
    const original = index.types.signatures[api.signature];
    const applied = index.types.signatures[completion.signature];
    assert.equal(original.parameters.length, count);
    assert.equal(original.typeParameters.length, 1);
    const [binder] = original.typeParameters;
    const actual = index.types.signatures[body.tir.signature].parameters[0].type;
    assert.deepEqual(bindings.methodBindings, [{ kind: "bound", parameter: binder.declaration, type: actual }]);
    assert.deepEqual(implementationBindings, bindings);
    assert.equal(applied.declaration, api.declaration);
    assert.deepEqual(applied.typeParameters, []);
    assert.equal(applied.parameters[0].type, actual);
    assert.equal(applied.result, actual);
    assert.equal(completion.completion, actual);
    witnessed.push({ original: original.id, binder: binder.declaration, applied: applied.id });
  }
  const [first, second, third] = witnessed;
  assert.notEqual(first.original, second.original);
  assert.notEqual(first.binder, second.binder);
  assert.equal(first.original, third.original);
  assert.equal(first.binder, third.binder);
  assert.equal(new Set(witnessed.map(row => row.applied)).size, 3);
});

test("parenthesizing a selected ordinary callable preserves the direct call and its sole activation", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const analyze = invocation => {
    const input = analysisInput(fixture, "sdk-minimal", `function pass(value: boolean): boolean { return value; }
      export function use(value: boolean): boolean { return ${invocation}(value); }`);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
    const body = chapter.bodies.find(row => row.kind === "selected" && row.instance.body.includes(";use];function;0]"));
    const call = body.mir.blocks.find(row => row.terminator.kind === "call").terminator;
    assert.equal(call.callee.kind, "direct");
    assert.equal(call.arguments.length, 1);
    assert.equal(body.facts[0].origins.activations.length, 1);
    return { api: call.callee.resolution.decision.api.declaration, activation: call.callee.resolution.activation };
  };
  const direct = analyze("pass");
  assert.notEqual(direct.activation, null);
  assert.deepEqual(analyze("((pass))"), direct);
});

test("a wrong-arity overload call returns the original checker diagnostic without selecting a candidate", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const declarations = "export declare function pick(value: boolean): boolean; export declare function pick(value: number): boolean;";
  const source = 'import { pick } from "./native.js"; export function run(): boolean { return pick(); }';
  const inputOf = text => {
    const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": text, "native.d.ts": declarations },
      libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
    snapshot.source.input.packages.modules.find(row => row.path === "/project/src/native.d.ts").role = "declaration";
    return { ...analysisInput(fixture, "sdk-minimal"), snapshot };
  };
  const input = inputOf(source);
  const checked = captureSourceBarrier(input);
  assert.equal(checked.kind, "ok");
  const module = checked.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
  const diagnostic = module.checkerDiagnostics.find(diagnostic => diagnostic.code.kind === "checker" && diagnostic.code.number === 2554);
  assert.ok(diagnostic);
  assert.equal(diagnostic.site.origin.module, input.snapshot.entryPoint);
  assert.equal(diagnostic.site.origin.start, source.lastIndexOf("pick"));
  const selected = typeSourceBarrier(input, checked.value, createTypedAccount(input));
  assert.equal(selected.kind, "refused");
  assert.equal(selected.diagnostics.length, 1);
  assert.equal(selected.diagnostics[0] === diagnostic, true);
  assert.deepEqual(analyzeHostProgram(input), { kind: "refused", diagnostics: [diagnostic] });
  const independent = inputOf(source.replace("pick()", "pick(missing, true)"));
  const independentSource = captureSourceBarrier(independent);
  assert.equal(independentSource.kind, "ok");
  const original = independentSource.value.modules.find(row => row.module.module === independent.snapshot.entryPoint).module.checkerDiagnostics;
  assert.deepEqual(original.map(row => row.code.rendered), ["TS2304", "TS2554"]);
  const independentResult = typeSourceBarrier(independent, independentSource.value, createTypedAccount(independent));
  assert.equal(independentResult.kind, "refused");
  assert.deepEqual(independentResult.diagnostics, original);
  assert.equal(independentResult.diagnostics.every((row, index) => row === original[index]), true);
  const repaired = analyzeHostProgram(inputOf(source.replace("return pick();", "return true;")));
  assert.equal(repaired.kind, "ok", JSON.stringify(repaired.diagnostics));
});

test("a rejected type-argument count retains authored types and independent original errors without a selection", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const prefix = "function pass(value: boolean): boolean { return value; } export function run(): boolean { return ";
  for (const [authored, argument, rejectedCodes] of [
    ["boolean", "true", ["TS2558"]],
    ["MissingType", "missingValue", ["TS2304", "TS2558", "TS2304"]],
  ]) {
    const input = analysisInput(fixture, "sdk-minimal", `${prefix}pass<${authored}>(${argument}); }`);
    const checked = captureSourceBarrier(input);
    assert.equal(checked.kind, "ok");
    const module = checked.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
    const bodyDeclaration = module.tree.statements.nodes[1];
    const call = bodyDeclaration.body.statements.nodes[0].expression;
    assert.equal(call.kind, "CallExpression");
    assert.equal(call.typeArguments.nodes.length, 1);
    assert.equal(call.typeArguments.nodes[0].tsonic.type.kind, authored === "boolean" ? "available" : "unavailable");
    assert.equal(call.tsonic.application.kind, "available");
    const application = call.tsonic.application.value;
    assert.equal(application.resolvedSignature.kind, "unavailable");
    assert.equal(application.resolvedSignature.reason, "checker-error");
    assert.deepEqual(application.typeArguments, []);
    assert.equal(application.candidates.kind, "available");
    assert.deepEqual(module.bodies.find(row => row.body === bodyDeclaration.tsonic.body).candidateLists[application.candidates.value].candidates, []);
    const originals = module.checkerDiagnostics;
    assert.deepEqual(originals.map(row => row.code.rendered), rejectedCodes);
    const originalIndex = originals.findIndex(row => row.code.rendered === "TS2558");
    assert.deepEqual(application.resolvedSignature.causes, [
      { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: module.module, index: originalIndex } } },
    ]);
    const typed = typeSourceBarrier(input, checked.value, createTypedAccount(input));
    assert.equal(typed.kind, "refused");
    assert.equal(typed.diagnostics.length, originals.length);
    assert.equal(typed.diagnostics.every((row, index) => row === originals[index]), true);
    assert.deepEqual(analyzeHostProgram(input), { kind: "refused", diagnostics: originals });
  }
  assert.equal(analyzeHostProgram(analysisInput(fixture, "sdk-minimal", `${prefix}pass(true); }`)).kind, "ok");
});

test("an authored type error survives a genuine checked generic recovery selection", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  for (const [type, argument, expected] of [
    ["MissingType", "true", ["MissingType"]],
    ["MissingType", "missingValue", ["MissingType", "missingValue"]],
    ["boolean", "true", []],
  ]) {
    const source = `import { choose } from './native.js'; export function run(): boolean { return choose<${type}>(${argument}); }`;
    const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source,
      "native.d.ts": "export declare function choose<Value extends boolean>(value: Value): boolean;" },
      libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
    snapshot.source.input.packages.modules.find(row => row.path === "/project/src/native.d.ts").role = "declaration";
    const input = { ...analysisInput(fixture, "sdk-minimal"), snapshot };
    const checked = captureSourceBarrier(input);
    assert.equal(checked.kind, "ok");
    const module = checked.value.modules.find(row => row.module.module === snapshot.entryPoint).module;
    const declaration = module.tree.statements.nodes[1];
    const call = declaration.body.statements.nodes[0].expression;
    const authored = call.typeArguments.nodes[0].tsonic.type;
    const application = call.tsonic.application.value;
    assert.equal(application.resolvedSignature.kind, "available");
    assert.equal(application.typeArguments.length, 1);
    const [candidate] = module.bodies.find(row => row.body === declaration.tsonic.body).candidateLists[application.candidates.value].candidates;
    assert.equal(candidate.bindings.value.methodBindings[0].type, application.typeArguments[0]);
    const originals = module.checkerDiagnostics;
    assert.deepEqual(originals.map(row => [row.code.rendered, source.slice(row.site.origin.start, row.site.origin.start + row.site.origin.length)]),
      expected.map(name => ["TS2304", name]));
    if (expected.length === 0) {
      assert.deepEqual(authored, { kind: "available", value: application.typeArguments[0] });
      continue;
    }
    assert.deepEqual(authored, { kind: "unavailable", reason: "checker-error", causes: [
      { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: module.module, index: 0 } } },
    ] });
    assert.deepEqual(fixture.types.readType(checked.value.types, application.typeArguments[0]), { kind: "intrinsic", intrinsic: "any" });
    const typed = typeSourceBarrier(input, checked.value, createTypedAccount(input));
    assert.equal(typed.kind, "refused");
    assert.equal(typed.diagnostics.length, originals.length);
    assert.equal(typed.diagnostics.every((row, index) => row === originals[index]), true);
    assert.deepEqual(analyzeHostProgram(input), { kind: "refused", diagnostics: originals });
  }
});

test("a binary result borrows only its actual failed operands and preserves independent errors", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  for (const [params, body, result, codes, sourceIndices] of [
    ["arg: { value: boolean }", "return arg.missing && true;", "boolean", [2339], [0]],
    ["flag: boolean", "return flag && missingRead;", "boolean", [2304], [0]],
    ["", "const fixed: number = 0; return fixed += 1;", "number", [2588], [0]],
    ["", "const fixed: boolean = true; return fixed &&= true;", "boolean", [2588], [0]],
    ["flag: boolean", "return flag = missingValue;", "boolean", [2304], [0]],
    ["", "return (missingFirst(), missingSecond);", "boolean", [2304, 2304], [1]],
    ["", "return missingFirst && missingSecond;", "boolean", [2304, 2304], [0, 1]],
    ["", "return missingFirst + missingSecond;", "number", [2304, 2304], [0, 1]],
  ]) {
    const input = analysisInput(fixture, "sdk-minimal", `export function run(${params}): ${result} { ${body} }`);
    const checked = captureSourceBarrier(input);
    assert.equal(checked.kind, "ok");
    const module = checked.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
    const originals = module.checkerDiagnostics;
    assert.deepEqual(originals.map(row => row.code.number), codes);
    const fn = module.tree.statements.nodes[0];
    let value = fn.body.statements.nodes.at(-1).expression;
    while (value.kind === "ParenthesizedExpression") value = value.expression;
    assert.equal(value.kind, "BinaryExpression");
    assert.deepEqual(value.tsonic.value.views.read, { kind: "unavailable", reason: "checker-error", causes: sourceIndices.map(index =>
      ({ kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: module.module, index } } })) });
    const typed = typeSourceBarrier(input, checked.value, createTypedAccount(input));
    assert.equal(typed.kind, "refused");
    assert.equal(typed.diagnostics.length, originals.length);
    assert.equal(typed.diagnostics.every((diagnostic, index) => diagnostic === originals[index]), true);
    assert.deepEqual(analyzeHostProgram(input), { kind: "refused", diagnostics: originals });
  }
});

test("a binary join retains a foreign original exactly once at all its uses", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const snapshot = fixture.projectSnapshot({ sourceFiles: {
    "main.ts": "import { rejected } from './bridge.js'; export function run():boolean{return (rejected && missing) && rejected;}",
    "bridge.ts": "export { absent as rejected } from './provider.js';",
    "provider.ts": "export const actual:boolean = true;",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const input = { ...analysisInput(fixture, "sdk-minimal"), snapshot };
  const checked = captureSourceBarrier(input);
  assert.equal(checked.kind, "ok");
  const module = checked.value.modules.find(row => row.module.module === snapshot.entryPoint).module;
  const bridgeId = snapshot.source.input.packages.modules.find(row => row.path.endsWith("/bridge.ts")).id;
  const bridge = checked.value.modules.find(row => row.module.module === bridgeId).module;
  const fn = module.tree.statements.nodes.find(node => node.kind === "FunctionDeclaration");
  const result = fn.body.statements.nodes[0].expression.tsonic.value.views.read;
  const ground = module => ({ kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module, index: 0 } } });
  assert.deepEqual(result, { kind: "unavailable", reason: "checker-error", causes: [ground(bridgeId), ground(module.module)] });
  const originals = [bridge.checkerDiagnostics[0], module.checkerDiagnostics[0]];
  assert.deepEqual(originals.map(row => row.code.number), [2305, 2304]);
  const typed = typeSourceBarrier(input, checked.value, createTypedAccount(input));
  assert.equal(typed.kind, "refused");
  assert.equal(typed.diagnostics.length, 2);
  assert.equal(originals.every(row => typed.diagnostics.includes(row)), true);
  assert.deepEqual(analyzeHostProgram(input), { kind: "refused", diagnostics: typed.diagnostics });
});

test("one rejected body keeps both independently grounded original checker diagnostics", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  for (const body of ["return (missingFirst) === (missingSecond);", "if (flag) return missingFirst; return missingSecond;"]) {
    const source = `export function run(flag: boolean): boolean { ${body} }`;
    const input = analysisInput(fixture, "sdk-minimal", source);
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok");
    const original = captured.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module.checkerDiagnostics;
    assert.deepEqual(original.map(row => [row.code.rendered, row.site.origin.start]), [
      ["TS2304", source.indexOf("missingFirst")], ["TS2304", source.indexOf("missingSecond")],
    ]);
    const typed = typeSourceBarrier(input, captured.value, createTypedAccount(input));
    assert.equal(typed.kind, "refused");
    assert.deepEqual(typed.diagnostics, original);
    assert.equal(typed.diagnostics.every((row, index) => row === original[index]), true);
    assert.deepEqual(analyzeHostProgram(input), { kind: "refused", diagnostics: original });
    const repaired = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", source.replace("missingFirst", "true").replace("missingSecond", "false")));
    assert.equal(repaired.kind, "ok", JSON.stringify(repaired.diagnostics));
  }
  const nestedSource = "export function run(): boolean { missingFirst; function inside(): boolean { return missingInner; } return missingLast; }";
  const nested = analysisInput(fixture, "sdk-minimal", nestedSource);
  const captured = captureSourceBarrier(nested);
  assert.equal(captured.kind, "ok");
  const original = captured.value.modules.find(row => row.module.module === nested.snapshot.entryPoint).module.checkerDiagnostics;
  assert.deepEqual(original.map(row => [row.code.rendered, row.site.origin.start]),
    ["missingFirst", "missingInner", "missingLast"].map(name => ["TS2304", nestedSource.indexOf(name)]));
  assert.deepEqual(analyzeHostProgram(nested), { kind: "refused", diagnostics: original });
});

test("checked body node ranges preserve actual header, initializer, and lexical-body ownership", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { checkedSourceViews } = await import("../../packages/host/dist/pipeline/checked-inputs.js");
  const input = analysisInput(fixture, "sdk-minimal", `
export function read(first: boolean, second: boolean = !first): boolean {
  const selected: boolean = !second;
  return selected;
}
export function readLater(value: boolean): boolean { return value; }`);
  const source = captureSourceBarrier(input);
  assert.equal(source.kind, "ok");
  const observed = new Map();
  const views = checkedSourceViews(source.value.modules, (body, range) => {
    const nodes = observed.get(body) ?? [];
    for (let position = range.start; position < range.end; position += 1) nodes.push(range.nodes[position]);
    observed.set(body, nodes);
  });
  const checked = source.value.modules.find(row => row.module.module === input.snapshot.entryPoint);
  const defaulting = checked.module.tree.statements.nodes[0];
  const parameters = defaulting.parameters.nodes;
  for (const body of checked.module.bodies) {
    const expected = checked.nodes.filter(node => views.nodeOf({ kind: "body", value: { body: body.body, node: node.id } }) === node);
    const actual = observed.get(body.body);
    assert.equal(actual?.length, expected.length);
    assert.equal(actual.every((node, position) => node === expected[position]), true);
  }
  const owner = observed.get(defaulting.tsonic.body);
  assert.equal(owner.includes(parameters[0]) && owner.includes(parameters[1]), true);
  const initializer = observed.get(parameters[1].tsonic.initializer);
  assert.equal(initializer.includes(parameters[1].initializer) && !owner.includes(parameters[1].initializer), true);
});

test("checked export inversion retains every actual alias under the declaring module", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const aliases = Array.from({ length: 128 }, (_, index) => `alias${String(index).padStart(3, "0")}`);
  const input = analysisInput(fixture, "sdk-minimal");
  input.snapshot = fixture.projectSnapshot({ sourceFiles: {
    "main.ts": `export { ${[...aliases].reverse().map(name => `value as ${name}`).join(", ")} } from './leaf.js';`,
    "leaf.ts": "export function value(input: boolean): boolean { return input; }",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const source = captureSourceBarrier(input);
  assert.equal(source.kind, "ok");
  const main = input.snapshot.entryPoint;
  const leaf = fixture.moduleOf(fixture.packageOf("/project"), "src/leaf.ts");
  const declaration = source.value.modules.find(entry => entry.module.module === leaf).module.tree.statements.nodes[0];
  const { definition } = declaration.tsonic;
  assert.equal(source.value.definitionPaths.get(definition).module, leaf);
  assert.deepEqual(source.value.descriptions.get(definition).exports,
    [{ module: leaf, name: "value" }, ...aliases.map(name => ({ module: main, name }))]);
  const resolved = [...source.value.descriptions.values()].filter(row => row.exports.some(entry => entry.module === main));
  assert.deepEqual(resolved.map(row => row.definition), [definition]);
});

test("actual named callable inference requires the supplied qualified B1 row rather than a checked type shortcut", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const input = analysisInput(fixture, "sdk-minimal");
  input.snapshot = fixture.projectSnapshot({ sourceFiles: {
    "main.ts": "import { value as renamed } from './leaf.js'; export function read(input: boolean): boolean { return renamed(!input); }",
    "leaf.ts": "export function value(input: boolean): boolean { return input; }",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  for (const kind of ["missing", "unavailable", "cycle", "foreign"]) {
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok");
    const source = captured.value;
    const bindingOf = occurrence => {
      const actual = source.bindingOf(occurrence);
      assert.equal(actual !== null, true);
      if (kind === "missing") return null;
      if (kind === "unavailable") return { ...actual, target: { kind: "unavailable", reason: "not-provided", causes: [] } };
      if (kind === "cycle") return { ...actual, target: { kind: "available", value: { kind: "binding", occurrence } } };
      return { ...actual, occurrence: { ...occurrence, value: { ...occurrence.value, node: occurrence.value.node + 1 } } };
    };
    const account = createTypedAccount(input);
    assert.throws(() => typeSourceBarrier(input, { ...source, bindingOf }, account), kind === "missing" ? /actual ready nearest-target row/
      : kind === "foreign" ? /exact requested qualified occurrence/ : /actual nearest target is unavailable/);
  }
});

test("typed dependencies retain the exact call entry and default even when the native branch omits the call", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  for (const taken of [false, true]) for (const omitted of [false, true]) {
    const text = "function leaf(input: boolean = true): boolean { return input; } "
      + `export function run(input: boolean): boolean { if (${taken}) return leaf(${omitted ? "" : "input"}); return input; }`;
    const input = analysisInput(fixture, "sdk-minimal", text);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { index, modules } = result.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    const selected = name => {
      const declaration = readyModuleStatements(readyModuleRoot(module.tree)).find(node => node.kind === "FunctionDeclaration" && node.name.text === name);
      return module.bodies.find(row => row.kind === "selected" && row.tir.owner === declaration.tsonic.definition);
    };
    const leaf = selected("leaf");
    const run = selected("run");
    const call = run.tir.root.statements.nodes[0].thenStatement.expression;
    const provided = omitted ? 0 : 1;
    assert.deepEqual(index.dependencyInventory.dependencies.filter(row => row.dependent.instance.body === run.instance.body
      && row.at.node === call.id).map(row => [row.reason, row.target]), [
      ["call", { kind: "body", execution: { instance: leaf.instance, provided } }],
      ...(omitted ? [["initializer", { kind: "body", execution: {
        instance: { body: leaf.tir.params[0].tsonic.initializer, bindings: leaf.instance.bindings }, provided: 0,
      } }]] : []),
    ]);
    const calls = run.mir.blocks.filter(block => block.terminator.kind === "call" && block.terminator.tir.node === call.id);
    const [facts] = run.facts;
    assert.equal(calls.length, taken ? 1 : 0);
    assert.equal(facts.origins.invocations.filter(row => row.node === call.id).length, taken ? 1 : 0);
  }
});

test("external entries use the selected qualified declaration without activating unopened siblings", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const shapes = [
    ...Array.from({ length: 8 }, (_, position) => [`leaf${position}`, "input: boolean", "input"]),
    ["optional", "input: boolean, tail?: boolean", "input"],
    ["target", "input: boolean, first: boolean = input, second: boolean = first", "second"],
  ];
  const text = shapes.map(([name, parameters, body]) =>
    `function ${name}(${parameters}): boolean { return ${body}; }`).join("\n") + "\nexport { target as selected };";
  const input = analysisInput(fixture, "sdk-minimal", text);
  input.snapshot = fixture.projectSnapshot({
    sourceFiles: { "main.ts": text, "shadow.ts": "export function target(input: boolean): boolean { return input; }" },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
    externalEntries: [{ module: input.snapshot.entryPoint, name: "selected" }],
  });
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const root = module.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "SourceFile");
  assert.equal(index.initialization.modules.some(row => row.instance.body === root.instance.body), true);
  assert.deepEqual(index.dependencyInventory.dependencies.filter(row => row.reason === "activation"), []);
  for (const [name] of shapes) {
    const declaration = readyModuleStatements(readyModuleRoot(module.tree)).find(node => node.kind === "FunctionDeclaration" && node.name.text === name);
    const offered = index.initialization.entries.filter(entry => entry.instance.body === declaration.tsonic.signatures[0].body);
    if (name === "target") {
      const selected = module.bodies.find(row => row.kind === "selected" && row.tir.owner === declaration.tsonic.definition);
      assert.deepEqual(offered, index.initialization.entries);
      assert.deepEqual(offered.toSorted((left, right) => left.provided - right.provided),
        [1, 2, 3].map(provided => ({ instance: selected.instance, provided })));
    } else assert.deepEqual(offered, [], name);
  }
  const shadow = modules.find(row => row.module === fixture.moduleOf(fixture.packageOf("/project"), "src/shadow.ts"));
  const shadowDeclaration = readyModuleStatements(readyModuleRoot(shadow.tree)).find(row => row.kind === "FunctionDeclaration");
  assert.equal(index.initialization.entries.some(entry => entry.instance.body === shadowDeclaration.tsonic.signatures[0].body), false);
});

test("the actual selected-call analysis admits its indices before growth and retains the original account refusal", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeTypedSource } = await import("../../packages/host/dist/pipeline/analysis-barrier.js");
  const { accountFailure, createAccount, refuseAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "type Described = boolean; export function value(): boolean { return true; } export function read(): boolean { return value(); }\n");
  const ready = () => {
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok");
    const typed = typeSourceBarrier(input, captured.value, createAccount(input.limits.dataflow));
    assert.equal(typed.kind, "ok");
    return typed.value;
  };
  const fresh = (limits = {}) => createAccount({ maximumWork: 1000000, maximumResultEntries: 1000000, ...limits });
  const completeAccount = fresh();
  const typed = ready();
  const complete = analyzeTypedSource(input, typed, completeAccount);
  assert.equal(complete.kind, "ok");
  const checked = typed.source.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
  const [described, callable] = checked.tree.statements.nodes;
  assert.equal(complete.value.verification.bindingDependentOf(described.tsonic.definition), null);
  assert.equal(complete.value.verification.bindingDependentOf(callable.tsonic.definition), false);
  const { entries, work } = InvocationAccount.stateOf(completeAccount);
  assert.equal(analyzeTypedSource(input, ready(), fresh({ maximumWork: work, maximumResultEntries: entries })).kind, "ok",
    "both exact cumulative admissions are sufficient");
  for (const [field, required] of [["maximumWork", work], ["maximumResultEntries", entries]]) {
    for (const maximum of [0, 1, 2, 8, 32, required - 1]) {
      const account = fresh({ [field]: maximum });
      const result = analyzeTypedSource(input, ready(), account);
      assert.equal(result.kind, "refused", `actual selected call ${field} ${maximum}`);
      assert.notEqual(accountFailure(account), null);
      assert.equal(Object.hasOwn(result, "value"), false);
      const unread = new Proxy({}, { get() { assert.fail("No typed source is read after the original analysis refusal."); } });
      assert.equal(analyzeTypedSource(input, unread, account).kind, "refused");
    }
  }
  const original = { kind: "refused", diagnostics: [] };
  const stopped = fresh();
  assert.equal(refuseAccount(stopped, original), original);
  const unread = new Proxy({}, { get() { assert.fail("An original caller refusal precedes every typed-source read."); } });
  assert.equal(analyzeTypedSource(input, unread, stopped), original);
});

test("the Summary iteration limit reports its own refusal, not the initialization condition limit", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  for (const maximumIterationsPerComponent of [0, 1]) {
    const input = analysisInput(fixture, "sdk-minimal",
      "function leaf(value: boolean): boolean { return value; } export function run(value: boolean): boolean { return leaf(value); }");
    const result = analyzeHostProgram({ ...input, limits: { ...input.limits,
      summaries: { ...input.limits.summaries, maximumIterationsPerComponent } } });
    if (maximumIterationsPerComponent === 1) {
      assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
      continue;
    }
    assert.equal(result.kind, "refused");
    assert.equal(Object.hasOwn(result, "value"), false);
    assert.equal(result.diagnostics.length, 1);
    const [diagnostic] = result.diagnostics;
    assert.equal(diagnostic.code.rendered, "TSONIC_COMPILER_RESOURCE_LIMIT");
    assert.equal(diagnostic.source, "pipeline");
    assert.deepEqual(diagnostic.arguments, [{ kind: "text", value: "component iterations" }, { kind: "number", value: 0 }]);
  }
});

for (const limit of ["work", "result-entries", "query.maximumRecords"])
test(`real public AnalyzeHostProgram refuses ${limit} exhaustion without publishing a partial program`, async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  if (limit === "work") input.limits.dataflow.maximumWork = 0;
  else if (limit === "result-entries") input.limits.dataflow.maximumResultEntries = 0;
  else input.limits.query.maximumRecords = 0;
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "refused");
  assert.equal(Object.hasOwn(result, "value"), false, "a refused invocation cannot expose a partial HostProgram");
  assert.equal(result.diagnostics.length, 1);
  const diagnostic = result.diagnostics[0];
  assert.equal(diagnostic.code.kind, "host");
  assert.equal(diagnostic.code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
  assert.equal(diagnostic.severity, "error");
  assert.equal(diagnostic.source, limit === "query.maximumRecords" ? "query" : "infer");
  const reportedLimit = limit === "query.maximumRecords" ? limit : `partition graph ${limit}`;
  assert.deepEqual(diagnostic.arguments, [{ kind: "text", value: reportedLimit }, { kind: "number", value: 0 }]);
});
