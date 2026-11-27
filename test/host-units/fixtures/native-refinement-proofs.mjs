import assert from "node:assert/strict";
import { accountFailure, createAccount } from "../../../packages/host/dist/dataflow/index.js";

const limits = { maximumWork: 1000000, maximumResultEntries: 1000000 };

export async function checkNativeRefinementWalkthrough() {
  const { loadFrontFixture } = await import("./front/checked-module.mjs");
  const fixture = await loadFrontFixture();
  const { nativeInt32Input } = await import("./native-int32-input.mjs");
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  for (const [replace, work, records] of [[false, 115362, 20011], [true, 116270, 20272]]) {
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
}

export async function checkNativeCountedLoopProofs() {
  const { sourceOccurrences } = await import("../../../packages/host/dist/analyses/body/source.js");
  const { countedLoopsOf, parseFacts, printFacts } = await import("../../../packages/host/dist/ir-facts/index.js");
  const { InvocationAccount } = await import("../../../packages/host/dist/dataflow/account.js");
  const { analysisInput } = await import("./front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { pipelineWiring } = await import("../../../packages/host/dist/pipeline/wiring.js");
  const { loadFrontFixture } = await import("./front/checked-module.mjs");
  const fixture = await loadFrontFixture();
  for (const { start, write, tail = "", minimum, counted, audit, callee = "", declaration = null, nativeInvoke = false,
    step = "++i", bound = "3", receiver = "values", exit = null, afterLoop = false, proven = false } of [
    { start: 0, write: "", minimum: 0n, counted: true, audit: "integer" },
    { start: 0, write: "", minimum: 0n, counted: true, step: "i++" },
    { start: 0, write: "i = 3;", minimum: null, counted: false },
    { start: 0, write: "values = replacement;", minimum: 0n, counted: true },
    { start: 1, write: "", minimum: 1n, counted: true },
    { start: 3, write: "", minimum: null, counted: true },
    { start: 0, write: "", minimum: 0n, counted: true, bound: "values.length", proven: true, audit: "guard", step: "i++" },
    { start: 0, write: "values = replacement;", minimum: 0n, counted: true, bound: "values.length", audit: "receiver" },
    { start: 0, write: "", tail: "values = replacement;", minimum: 0n, counted: true, bound: "values.length", proven: true, audit: "guard" },
    { start: 0, write: "if (i < 1) values = replacement;", minimum: 0n, counted: true, bound: "values.length" },
    { start: 0, write: "if (i < 1) { values = replacement; continue; }", minimum: 0n, counted: true, bound: "values.length", proven: true },
    { start: 0, write: "if (i < 1) values = values;", minimum: 0n, counted: true, bound: "values.length", proven: true, audit: "self-copy" },
    { start: 0, write: "observe(values);", callee: "function observe(value: boolean[]): void {}", minimum: 0n,
      counted: true, bound: "values.length", proven: true, audit: "call" },
    { start: 0, write: "observe(values);", callee: 'import { observe } from "./native.js";',
      declaration: "export declare function observe(value: boolean[]): void;", minimum: 0n, counted: true, bound: "values.length" },
    { start: 0, write: "if (i + 1 < 0) return false;", nativeInvoke: true, minimum: 0n, counted: true, bound: "values.length", proven: true },
    { start: 0, write: "", exit: "if (i < 3) return values[i];", minimum: 0n, counted: true,
      bound: "values.length", proven: true, audit: "guard" },
    { start: 0, write: "", exit: "if (i < 3) { i = 42; return values[i]; }", minimum: null, counted: true, bound: "values.length" },
    { start: 0, write: "", exit: "if (values[i]) break;", afterLoop: true, minimum: 0n, counted: true,
      bound: "values.length", proven: true, audit: "bypass" },
    { start: 0, write: "", minimum: 0n, counted: true, bound: "values.length", receiver: "replacement" },
  ]) {
    const source = `${callee}
    export function read(values: boolean[], replacement: boolean[]): boolean {
      for (${afterLoop ? "var" : "let"} i = ${start}; i < ${bound}; ${step}) { ${write} ${exit ?? `if (${receiver}[i]) return true;`} ${tail} }
      return ${afterLoop ? "values[i]" : "false"};
    }`;
    const input = analysisInput(fixture, "sdk-minimal", source);
    const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source,
      ...(declaration === null ? {} : { "native.d.ts": declaration }) },
      libraries: fixture.sdk.getBundledLibraryClosure(["lib.es5.d.ts"]) });
    if (declaration !== null) snapshot.source.input.packages.modules.find(row => row.path.endsWith("/native.d.ts")).role = "declaration";
    const operands = { ...input, snapshot: { ...snapshot, nativeFacts: { ...snapshot.nativeFacts,
      integerOverflow: [...(nativeInvoke ? [{ carrier: "int64", operation: "add", result: "int64", law: "abort" }] : []),
        { carrier: "int64", operation: "increment", result: "int64", law: "wrap" }] } } };
    const result = analyzeHostProgram(operands);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const chapter = result.value.modules.find(row => row.module === snapshot.entryPoint);
    const selected = chapter.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "Block" && row.tir.params.length === 2);
    const checks = selected.mir.blocks.map(row => row.terminator).filter(row => row.kind === "check");
    assert.equal(checks.length, afterLoop ? 2 : 1);
    if (nativeInvoke) assert.deepEqual(selected.mir.blocks.map(row => row.terminator).filter(row => row.kind === "invoke")
      .map(row => row.operation.decision.execution), [{ kind: "invocation", writesStorage: false, failure: "abort" }]);
    const [facts] = selected.facts;
    if (!counted) {
      assert.deepEqual(facts.refinements.refinements, []);
      assert.deepEqual(facts.refinements.countedLoops, []);
      assert.equal(facts.refinements.integers.some(row => row.range !== null), false);
      continue;
    }
    const [loop] = selected.tir.root.statements.nodes;
    const [counter] = loop.initializer.declarations.nodes;
    const initializer = chapter.bodies.find(row => row.kind === "selected" && row.tir.body === counter.tsonic.initializer);
    assert.notEqual(initializer.tir.body, selected.tir.body);
    assert.deepEqual(facts.refinements.countedLoops, [{
      statement: loop.id, counterDeclaration: counter.id, start: { body: initializer.tir.body, node: initializer.tir.root.id },
      bound: loop.condition.right.id, body: loop.statement.id, direction: "ascending", comparison: "exclusive-upper-bound", step: 1,
    }]);
    const printed = printFacts(facts);
    const decoded = parseFacts(printed);
    assert.equal(decoded.kind, "parsed");
    assert.deepEqual(decoded.value.refinements.countedLoops, facts.refinements.countedLoops);
    const indexed = sourceOccurrences(selected.tir, createAccount(limits));
    assert.equal(indexed.kind, "complete");
    const [check, bypassed] = checks;
    const access = indexed.value.get(check.tir.node);
    const range = minimum === null ? null : { minimum, maximum: bound === "3" ? 2n : (1n << 63n) - 2n };
    assert.equal(access.kind, "ElementAccessExpression");
    const expectedRefinements = proven ? [{ kind: "proven", node: access.id, guards: [loop.condition.id] }] : [];
    assert.deepEqual(facts.refinements.refinements, expectedRefinements);
    assert.deepEqual(decoded.value.refinements.refinements, expectedRefinements);
    assert.deepEqual(facts.refinements.integers.filter(row => row.range !== null),
      range === null ? [] : [{ node: access.argumentExpression.id, range, nonnegative: true }]);
    assert.deepEqual(decoded.value.refinements.integers, facts.refinements.integers);
    if (audit === "self-copy") {
      const receiver = selected.tir.params[0].tsonic.local;
      const stores = selected.mir.blocks.flatMap(block => block.statements).filter(row => {
        if (row.kind !== "assign") return false;
        const target = selected.mir.places[row.place].base;
        if (target.kind !== "local") return false;
        const source = selected.mir.locals[target.local].source;
        return source?.body === receiver.body && source.local === receiver.local;
      });
      assert.equal(stores.length, 1);
      assert.equal(stores[0].step, null);
      assert.deepEqual(stores[0].value, { kind: "use", operand: { kind: "place", place: stores[0].place } });
    }
    if (!audit) continue;
    const summaryAt = (block, operation) => {
      assert.equal(audit, "call");
      assert.equal(operation === selected.mir.blocks[block].terminator, true);
      assert.equal(operation.callee.kind, "direct");
      const activation = operation.callee.resolution.activation;
      const summary = result.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === activation.body
        && row.key.execution.provided === 1);
      assert.ok(summary);
      assert.equal(summary.parameters.length, 1);
      return { kind: "complete", value: summary };
    };
    const proofInput = { nativeFacts: operands.snapshot.nativeFacts, sourceOf: node => indexed.value.get(node), summaryAt, mirBody: instance => {
      assert.deepEqual(instance, initializer.instance);
      return initializer.mir;
    } };
    const probe = createAccount(limits);
    const replay = countedLoopsOf(probe, selected.mir, facts.execution.provided, proofInput);
    assert.equal(replay.kind, "complete");
    assert.deepEqual(replay.value, {
      loops: facts.refinements.countedLoops, ranges: [{ node: access.argumentExpression.id, range }], refinements: expectedRefinements,
    });
    if (audit === "call") {
      const unavailable = countedLoopsOf(createAccount(limits), selected.mir, facts.execution.provided, {
        ...proofInput, summaryAt: () => ({ kind: "complete", value: null }),
      });
      assert.deepEqual(unavailable, { kind: "complete", value: { ...replay.value, refinements: [] } });
      let lookupWork = null;
      let lookups = 0;
      const observeLookup = account => countedLoopsOf(account, selected.mir, facts.execution.provided, { ...proofInput,
        summaryAt: (block, operation) => {
          lookups += 1;
          lookupWork = InvocationAccount.stateOf(account).work;
          return summaryAt(block, operation);
        } });
      assert.deepEqual(observeLookup(createAccount(limits)), replay);
      assert.equal(lookups, 1);
      assert.ok(lookupWork > 0);
      const firstLookup = lookupWork;
      for (const admitted of [false, true]) {
        lookups = 0;
        const account = createAccount({ ...limits, maximumWork: firstLookup - (admitted ? 0 : 1) });
        const stopped = observeLookup(account);
        assert.equal(stopped.kind, "resource-limit");
        assert.equal(stopped.dimension, "work");
        assert.equal(stopped === accountFailure(account), true);
        assert.equal(observeLookup(account) === stopped, true);
        assert.equal(lookups, admitted ? 1 : 0);
      }
    }
    for (const unavailable of [null, selected.mir]) {
      const unbacked = countedLoopsOf(createAccount(limits), selected.mir, facts.execution.provided, {
        ...proofInput, mirBody: () => unavailable,
      });
      assert.equal(unbacked.kind, "complete");
      assert.deepEqual(unbacked.value, { loops: facts.refinements.countedLoops, ranges: [], refinements: [] });
    }
    const round = pipelineWiring.bodyAnalysis.analyzeBodyRound;
    let submittedMaximum = 3n;
    try {
      pipelineWiring.bodyAnalysis.analyzeBodyRound = (deps, input) => {
        const outcome = round(deps, input);
        if (outcome.kind !== "complete" || outcome.value.kind !== "ok" || !("facts" in outcome.value.value)) return outcome;
        const pair = outcome.value.value;
        if (!pair.facts.refinements.integers.some(row => row.range !== null)) return outcome;
        const integers = audit !== "integer" ? pair.facts.refinements.integers
          : pair.facts.refinements.integers.map(row => row.range === null ? row
            : { ...row, range: { ...row.range, maximum: submittedMaximum } });
        const refinements = audit === "integer" ? pair.facts.refinements.refinements
          : audit === "bypass" ? [...pair.facts.refinements.refinements, { kind: "proven", node: bypassed.tir.node, guards: [loop.condition.id] }]
          : [{ kind: "proven", node: access.id, guards: [audit === "receiver" ? loop.condition.id : loop.condition.right.id] }];
        return { ...outcome, value: { ...outcome.value, value: { ...pair, facts: { ...pair.facts,
          refinements: { ...pair.facts.refinements, integers, refinements } } } } };
      };
      if (audit === "integer") {
        assert.throws(() => analyzeHostProgram(operands), /Facts handoff: integer-proof-exact/);
        submittedMaximum = 3;
        assert.throws(() => analyzeHostProgram(operands), /Facts handoff: integer-range-valid/);
      } else {
        assert.throws(() => analyzeHostProgram(operands), /Facts handoff: index-bound-proof-exact/);
      }
    } finally {
      pipelineWiring.bodyAnalysis.analyzeBodyRound = round;
    }
    const { work, entries } = InvocationAccount.stateOf(probe);
    const exact = countedLoopsOf(createAccount({ maximumWork: work, maximumResultEntries: entries }), selected.mir, facts.execution.provided, proofInput);
    assert.equal(exact.kind, "complete");
    const unreadInput = new Proxy({}, { get() { throw new Error("a stopped proof must not read another body"); } });
    const zero = createAccount({ ...limits, maximumWork: 0 });
    assert.equal(countedLoopsOf(zero, unreadInput, facts.execution.provided, proofInput) === accountFailure(zero), true);
    if (audit === "receiver" || audit === "call" || audit === "bypass") continue;
    for (const [dimension, total, key] of [["work", work, "maximumWork"], ["result-entries", entries, "maximumResultEntries"]]) {
      for (let cap = 0; cap < total; cap += 1) {
        const account = createAccount({ ...limits, [key]: cap });
        const stopped = countedLoopsOf(account, selected.mir, facts.execution.provided, proofInput);
        assert.equal(stopped.kind, "resource-limit");
        assert.equal(stopped.dimension, dimension);
        assert.equal(stopped === accountFailure(account), true);
        assert.equal(countedLoopsOf(account, unreadInput, facts.execution.provided, proofInput) === stopped, true);
      }
    }
  }
}

export async function checkNativeFieldRefinement() {
  const { sourceOccurrences } = await import("../../../packages/host/dist/analyses/body/source.js");
  const { InvocationAccount } = await import("../../../packages/host/dist/dataflow/account.js");
  const { fieldRefinementsOf, parseFacts, printFacts } = await import("../../../packages/host/dist/ir-facts/index.js");
  const { sameInstance } = await import("../../../packages/host/dist/ir-types/index.js");
  const { analysisInput } = await import("./front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../../packages/host/dist/pipeline/source-barrier.js");
  const { pipelineWiring } = await import("../../../packages/host/dist/pipeline/wiring.js");
  const { loadFrontFixture } = await import("./front/checked-module.mjs");
  const fixture = await loadFrontFixture();
  for (const writtenField of [null, "other", "flag"]) {
    const writes = writtenField === "flag";
    const branch = writtenField === "other"
      ? "if (undefined === box.flag) return false; else { inspect(box); return box.flag; }"
      : "if (box.flag !== undefined) { inspect(box); return box.flag; } return false;";
    const input = analysisInput(fixture, "sdk-minimal", `
      type Box = { flag: boolean | undefined; other: boolean | undefined };
      function inspect(box: Box): void { ${writtenField === null ? "" : `box.${writtenField} = undefined;`} }
      export function read(box: Box): boolean {
        ${branch}
      }
    `);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
    const selected = chapter.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "Block"
      && row.tir.root.statements.nodes[0]?.kind === "IfStatement");
    const conditional = selected.tir.root.statements.nodes[0];
    const iteration = writtenField === "other" ? conditional.elseStatement : conditional.thenStatement;
    const [call, returned] = iteration.statements.nodes;
    const access = returned.expression;
    const check = selected.mir.blocks.find(block => block.terminator.kind === "check" && block.terminator.tir.node === access.id)?.terminator;
    assert.equal(check?.kind, "check");
    assert.equal(selected.mir.places[check.place].base.projection.kind, "refined");
    const positions = { node: access.id, guards: [conditional.expression.id] };
    const expected = writes ? {
      ...positions, kind: "unproven", reason: {
        kind: "invalidated", sites: [{ kind: "call", at: { body: selected.tir.body, node: call.expression.id } }],
      },
    } : { ...positions, kind: "proven" };
    const [facts] = selected.facts;
    assert.deepEqual(facts.refinements.refinements, [expected]);
    const printed = parseFacts(printFacts(facts));
    assert.equal(printed.kind, "parsed");
    assert.deepEqual(printed.value.refinements.refinements, [expected], "the published check proof retains the exact qualified cause");
    if (!writes) continue;
    const round = pipelineWiring.bodyAnalysis.analyzeBodyRound;
    try {
      pipelineWiring.bodyAnalysis.analyzeBodyRound = (deps, roundInput) => {
        const result = round(deps, roundInput);
        if (result.kind !== "complete" || result.value.kind !== "ok" || !("facts" in result.value.value)) return result;
        const pair = result.value.value;
        if (!pair.facts.refinements.refinements.some(row => row.kind === "unproven" && row.reason.kind === "invalidated")) return result;
        const refinements = pair.facts.refinements.refinements.map(row => ({ kind: "proven", node: row.node, guards: row.guards }));
        return { ...result, value: { ...result.value, value: { ...pair, facts: { ...pair.facts,
          refinements: { ...pair.facts.refinements, refinements } } } } };
      };
      assert.throws(() => analyzeHostProgram(input), /Facts handoff: field-refinement-proof-exact/);
    } finally {
      pipelineWiring.bodyAnalysis.analyzeBodyRound = round;
    }
    const source = sourceOccurrences(selected.tir, createAccount(limits));
    assert.equal(source.kind, "complete");
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok");
    const proofInput = { sourceOf: node => source.value.get(node),
      callBindings: { lexical: selected.tir.lexicalBindings,
        scopeOf: definition => captured.value.descriptions.get(definition)?.generics ?? null }, summaryAt: (_block, operation) => {
      assert.equal(operation.callee.kind, "direct");
      const activation = operation.callee.resolution.activation;
      const summary = result.value.index.summaries.find(row => row.key.kind === "body"
        && row.key.execution.instance.body === activation.body && row.key.execution.provided === 1);
      assert.ok(summary);
      return { kind: "complete", value: summary };
    } };
    const run = account => fieldRefinementsOf(account, selected.mir, facts.execution.provided, proofInput);
    const probe = createAccount(limits);
    assert.deepEqual(run(probe), { kind: "complete", value: [expected] });
    const { work, entries } = InvocationAccount.stateOf(probe);
    assert.deepEqual(run(createAccount({ maximumWork: work, maximumResultEntries: entries })), { kind: "complete", value: [expected] });
    let callReadAt = null;
    let effectReads = 0;
    const observeCall = account => fieldRefinementsOf(account, selected.mir, facts.execution.provided, { ...proofInput,
      summaryAt: (block, operation) => {
        const offered = proofInput.summaryAt(block, operation);
        const summary = offered.value;
        assert.equal(summary.captures.length, 0);
        assert.equal(summary.parameters.length, 1);
        const [effect] = summary.parameters;
        const parameters = [effect];
        Object.defineProperty(parameters, 0, { get: () => { effectReads += 1; return effect; } });
        callReadAt = InvocationAccount.stateOf(account).work;
        return { ...offered, value: { ...summary, parameters } };
      } });
    const observed = createAccount({ maximumWork: work, maximumResultEntries: entries });
    assert.deepEqual(observeCall(observed), { kind: "complete", value: [expected] });
    assert.equal(effectReads, 1);
    assert.ok(callReadAt !== null);
    const callPrefix = callReadAt;
    for (const paidRow of [false, true]) {
      effectReads = 0;
      const account = createAccount({ maximumWork: callPrefix + (paidRow ? 2 : 1), maximumResultEntries: entries });
      const stopped = observeCall(account);
      assert.equal(callReadAt, callPrefix);
      assert.equal(stopped.kind, "resource-limit");
      assert.equal(stopped.dimension, "work");
      assert.equal(stopped === accountFailure(account), true);
      assert.equal(effectReads, paidRow ? 1 : 0);
      assert.equal(observeCall(account) === stopped, true);
      assert.equal(effectReads, paidRow ? 1 : 0);
    }
    for (const [dimension, caps] of [["work", { maximumWork: work - 1, maximumResultEntries: entries }],
      ["result-entries", { maximumWork: work, maximumResultEntries: entries - 1 }]]) {
      const account = createAccount(caps);
      const stopped = run(account);
      assert.equal(stopped.kind, "resource-limit");
      assert.equal(stopped.dimension, dimension);
      assert.equal(stopped === accountFailure(account), true);
      const unreadInput = new Proxy({}, { get() { throw new Error("a stopped field proof must not read MIR"); } });
      assert.equal(fieldRefinementsOf(account, unreadInput, facts.execution.provided, proofInput) === stopped, true);
    }
  }

  for (const [member, throughCall, proven] of [
    ["left.other", false, true], ["left.other", true, true],
    ["spare", false, true], ["spare", true, true],
    ["left.flag", true, false], ["right.flag", false, false], ["right.flag", true, false],
  ]) {
    const write = `box.${member} = undefined;`;
    const input = analysisInput(fixture, "sdk-minimal", `
      type Box = { left: { flag: boolean | undefined; other: boolean | undefined };
        right: { flag: boolean | undefined; other: boolean | undefined }; spare: boolean | undefined };
      ${throughCall ? `function inspect(box: Box): void { ${write} }` : ""}
      export function read(box: Box): boolean {
        if (box.left.flag !== undefined) { ${throughCall ? "inspect(box);" : write} return box.left.flag; }
        return false;
      }
    `);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", `${member}: ${JSON.stringify(result.diagnostics)}`);
    const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
    const selected = chapter.bodies.find(row => row.kind === "selected" && row.instance.body.includes(";read];function;0]"));
    const [conditional] = selected.tir.root.statements.nodes;
    const [intervention, returned] = conditional.thenStatement.statements.nodes;
    const at = { body: selected.tir.body, node: intervention.expression.id };
    const node = returned.expression.id;
    const checks = selected.mir.blocks.map(block => block.terminator).filter(row => row.kind === "check" && row.tir.node === node);
    assert.equal(checks.length, 1);
    assert.equal(selected.mir.places[checks[0].place].base.projection.kind, "refined");
    const position = { node, guards: [conditional.expression.id] };
    const expected = proven ? { kind: "proven", ...position } : { kind: "unproven", ...position,
      reason: { kind: "invalidated", sites: [{ kind: throughCall ? "call" : "write", at }] } };
    const [facts] = selected.facts;
    assert.deepEqual(facts.refinements.refinements, [expected], `${member}, via call = ${throughCall}`);
    const owner = throughCall ? ";inspect];function;0]" : ";read];function;0]";
    const summary = result.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body.includes(owner));
    const [path] = summary.parameters[0].writes.paths;
    const stored = summary.arena.projections[path];
    const writtenFields = stored.parent === null ? [stored] : [summary.arena.projections[stored.parent], stored];
    assert.equal(writtenFields.map(row => row.projection.member.decision.key.value).join("."), member);
    if (member !== "left.other" || !throughCall) continue;

    const source = sourceOccurrences(selected.tir, createAccount(limits));
    assert.equal(source.kind, "complete");
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok");
    const proofInput = { sourceOf: node => source.value.get(node), callBindings: { lexical: selected.tir.lexicalBindings,
      scopeOf: definition => captured.value.descriptions.get(definition)?.generics ?? null }, summaryAt: (block, operation) => {
      assert.equal(selected.mir.blocks[block].terminator === operation, true);
      assert.deepEqual(operation.tir, at);
      return { kind: "complete", value: summary };
    } };
    const run = account => fieldRefinementsOf(account, selected.mir, facts.execution.provided, proofInput);
    const probe = createAccount(limits);
    assert.deepEqual(run(probe), { kind: "complete", value: [expected] });
    const { work, entries } = InvocationAccount.stateOf(probe);
    assert.deepEqual(run(createAccount({ maximumWork: work, maximumResultEntries: entries })), { kind: "complete", value: [expected] });
    for (const [dimension, maximumWork, maximumResultEntries] of [["work", work - 1, entries], ["result-entries", work, entries - 1]]) {
      const account = createAccount({ maximumWork, maximumResultEntries });
      const stopped = run(account);
      assert.equal(stopped.kind, "resource-limit");
      assert.equal(stopped.dimension, dimension);
      assert.equal(stopped === accountFailure(account), true);
      assert.equal(run(account) === stopped, true);
    }
  }

  const ancestor = analysisInput(fixture, "sdk-minimal", `
    type Box = { left: { flag: boolean | undefined } | null };
    function clear(box: Box): void { box.left = null; }
    export function read(box: Box): boolean {
      if (box.left !== null) {
        if (box.left.flag !== undefined) { clear(box); return box.left.flag; }
      }
      return false;
    }
  `);
  const result = analyzeHostProgram(ancestor);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const chapter = result.value.modules.find(row => row.module === ancestor.snapshot.entryPoint);
  const selected = chapter.bodies.find(row => row.kind === "selected" && row.instance.body.includes(";read];function;0]"));
  const [outer] = selected.tir.root.statements.nodes;
  const [inner] = outer.thenStatement.statements.nodes;
  const [clear, returned] = inner.thenStatement.statements.nodes;
  const reason = { kind: "invalidated", sites: [{ kind: "call", at: { body: selected.tir.body, node: clear.expression.id } }] };
  const [facts] = selected.facts;
  assert.deepEqual(facts.refinements.refinements, [
    { kind: "proven", node: inner.expression.left.expression.id, guards: [outer.expression.id] },
    { kind: "unproven", node: returned.expression.id, guards: [inner.expression.id], reason },
    { kind: "unproven", node: returned.expression.expression.id, guards: [outer.expression.id], reason },
  ]);
  const checks = selected.mir.blocks.map(row => row.terminator).filter(row => row.kind === "check");
  assert.deepEqual(new Set(checks.map(check => check.tir.node)), new Set(facts.refinements.refinements.map(row => row.node)));

  for (const [name, statements, state] of [
    ["exit", "if (choose) { box = replacement; return false; } if (box.flag !== undefined) return box.flag;", "proven"],
    ["before", "box = replacement; if (box.flag !== undefined) return box.flag;", "proven"],
    ["join", "if (choose) box = replacement; if (box.flag !== undefined) return box.flag;", "proven"],
    ["saved", "const saved = box; box = replacement; if (saved.flag !== undefined) return saved.flag;", "proven"],
    ["alias", "const saved = box; box = replacement; if (saved.flag !== undefined) { clear(box); return saved.flag; }", "invalidated"],
    ["loop", "for (let i = 0; i < 2; ++i) { if (choose) box = replacement; if (box.flag !== undefined) return box.flag; }", "proven"],
    ["stale-field", "if (box.flag !== (clear(box), undefined)) return box.flag;", "stale"],
    ["pure", "if (box.flag !== (pure(), undefined)) return box.flag;", "proven"],
    ["stale-receiver", "if (box.flag !== (box = replacement, undefined)) return box.flag;", "stale"],
  ]) {
    const original = analysisInput(fixture, "sdk-minimal", `
      type Box = { flag: boolean | undefined };
      function clear(box: Box): void { box.flag = undefined; }
      function pure(): void {}
      export function read(box: Box, replacement: Box, choose: boolean): boolean {
        ${statements}
        return false;
      }
    `);
    const native = original.snapshot.nativeFacts;
    const input = { ...original, snapshot: { ...original.snapshot, nativeFacts: { ...native,
      integerOverflow: [{ carrier: "int64", operation: "increment", result: "int64", law: "wrap" }],
    } } };
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", `${name}: ${JSON.stringify(result.diagnostics)}`);
    const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
    const selected = chapter.bodies.find(row => row.kind === "selected" && row.instance.body.includes(";read];function;0]"));
    const root = selected.tir.root.statements.nodes;
    const rows = name === "loop" ? root[0].statement.statements.nodes : root;
    const conditional = rows.filter(row => row.kind === "IfStatement").at(-1);
    const returned = conditional.thenStatement.kind === "Block" ? conditional.thenStatement.statements.nodes.at(-1) : conditional.thenStatement;
    const node = returned.expression.id;
    assert.equal(selected.mir.blocks.some(row => row.terminator.kind === "check" && row.terminator.tir.node === node), true, name);
    const callBlock = selected.mir.blocks.find(row => row.terminator.kind === "call" && row.terminator.callee.kind === "direct");
    const guards = state === "stale" ? [] : [conditional.expression.id];
    const reason = state === "invalidated" ? { kind: "invalidated", sites: [{ kind: "call", at: callBlock.terminator.tir }] }
      : { kind: "guard-not-proven", detail: "No qualifying presence guard on every reaching path." };
    const [facts] = selected.facts;
    const expected = state === "proven" ? { kind: "proven", node, guards } : { kind: "unproven", node, guards, reason };
    assert.deepEqual(facts.refinements.refinements, [expected], name);
    if (name === "stale-field" || name === "pure") {
      const guard = conditional.expression;
      const sample = callBlock.statements.find(row => row.kind === "assign" && row.tir.node === guard.left.id);
      assert.equal(sample.value.kind, "use");
      assert.equal(selected.mir.places[sample.value.operand.place].base.tir.node, guard.left.id);
      const compared = selected.mir.blocks[callBlock.terminator.next].statements.find(row => row.kind === "assign" && row.tir.node === guard.id);
      assert.deepEqual(compared.value.left, { kind: "place", place: sample.place });
    } else if (name !== "saved") continue;

    const source = sourceOccurrences(selected.tir, createAccount(limits));
    assert.equal(source.kind, "complete");
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok");
    let firstLookup = null;
    const proofInput = { sourceOf: node => source.value.get(node), callBindings: { lexical: selected.tir.lexicalBindings,
      scopeOf: definition => captured.value.descriptions.get(definition)?.generics ?? null } };
    const run = account => fieldRefinementsOf(account, selected.mir, facts.execution.provided, { ...proofInput, summaryAt: (block, operation) => {
      assert.equal(operation === selected.mir.blocks[block].terminator, true);
      const callee = operation.callee.kind === "body" ? operation.callee.instance : operation.callee.resolution.activation;
      const summary = result.value.index.summaries.find(row => row.key.kind === "body" && sameInstance(row.key.execution.instance, callee));
      assert.ok(summary);
      firstLookup ??= InvocationAccount.stateOf(account).work;
      return { kind: "complete", value: summary };
    } });
    const probe = createAccount(limits);
    const meter = InvocationAccount.stateOf(probe);
    const charged = { work: [], entries: [] };
    const consumed = { work: 0, entries: 0 };
    for (const dimension of ["work", "entries"]) Object.defineProperty(meter, dimension, {
      get: () => consumed[dimension], set: next => {
        if (next > consumed[dimension]) charged[dimension].push(next);
        consumed[dimension] = next;
      },
    });
    assert.deepEqual(run(probe), { kind: "complete", value: [expected] });
    if (name === "stale-field") {
      assert.ok(firstLookup > 0);
      const cutoff = createAccount({ ...limits, maximumWork: firstLookup - 1 });
      firstLookup = null;
      const stopped = run(cutoff);
      assert.equal(stopped.kind, "resource-limit");
      assert.equal(stopped === accountFailure(cutoff), true);
      assert.equal(firstLookup, null);
      assert.equal(run(cutoff) === stopped, true);
      assert.equal(firstLookup, null);
    }
    assert.deepEqual(run(createAccount({ maximumWork: consumed.work, maximumResultEntries: consumed.entries })),
      { kind: "complete", value: [expected] });
    for (const [category, dimension] of [["work", "work"], ["entries", "result-entries"]]) {
      assert.ok(charged[category].length > 0, `${name}: ${dimension}`);
      for (const cut of charged[category]) {
        const account = createAccount({ maximumWork: category === "work" ? cut - 1 : consumed.work,
          maximumResultEntries: category === "entries" ? cut - 1 : consumed.entries });
        const stopped = run(account);
        assert.equal(stopped.kind, "resource-limit", `${name}: ${dimension} ${cut - 1}`);
        assert.equal(stopped.dimension, dimension);
        assert.equal(stopped === accountFailure(account), true);
        assert.equal(run(account) === stopped, true);
      }
    }
  }
}
