import assert from "node:assert/strict";
import { createAccount } from "../../../packages/host/dist/dataflow/index.js";
import { loadFrontFixture } from "./front/checked-module.mjs";
import { analysisInput } from "./front/analysis-input.mjs";

export async function tirFixtureAdmission() {
  const { tirReadyReadAdmission } = await import("../../../packages/host/dist/ir-program/index.js");
  return () => tirReadyReadAdmission(createAccount({ maximumWork: 1000000, maximumResultEntries: 1000000 }));
}

export async function tirFixtureVerifier(verify) {
  const admission = await tirFixtureAdmission();
  return (input, subject) => {
    const result = verify(input, subject, admission());
    assert.equal(result.kind, "complete");
    return result.violations;
  };
}

export const tirFixtureBodyVerifier = verify => tirFixtureVerifier((input, subject, admit) => verify(input, admit)(subject));

export const suppliedTirScopes = read => target => ({ kind: "complete", scopes: read(target) });

export function checkTirAdmissionCuts(freshAdmission, invoke) {
  const original = Object.freeze({ kind: "refused", diagnostics: [] });
  function run(maximum) {
    const admit = freshAdmission();
    const reads = [];
    let requests = 0;
    let refused = false;
    const stop = invoke(request => {
      assert.equal(refused, false, "no request follows the original admission refusal");
      if (requests++ === maximum) {
        refused = true;
        return original;
      }
      return admit(request);
    }, reader => {
      assert.equal(refused, false, `${reader} must stay unread after the original refusal`);
      reads.push(reader);
    });
    return { stop, requests, reads };
  }
  const complete = run(Infinity);
  assert.equal(complete.stop, null);
  assert.ok(complete.requests > 0);
  for (let maximum = 0; maximum < complete.requests; maximum += 1) {
    const cut = run(maximum);
    assert.equal(cut.stop === original, true, `original refusal at request ${maximum}`);
    assert.equal(cut.requests, maximum + 1);
    assert.deepEqual(cut.reads, complete.reads.slice(0, cut.reads.length));
  }
  return complete.reads;
}

export function checkTirVerifierAdmissionCuts(freshAdmission, verify, input, subject) {
  return checkTirAdmissionCuts(freshAdmission, (admit, read) => {
    const observed = { ...input,
      bodyOf: instance => { read("bodyOf"); return input.bodyOf(instance); },
      bindingScopesOf: (...request) => { read("bindingScopesOf"); return input.bindingScopesOf(...request); },
      staticStorageOf: declaration => { read("staticStorageOf"); return input.staticStorageOf(declaration); },
      memberTableOf: (...request) => { read("memberTableOf"); return input.memberTableOf(...request); },
    };
    const result = verify(observed, subject, admit);
    return result.kind === "resource-stop" ? result.stop : null;
  });
}

export const checkTirBodyAdmissionCuts = (freshAdmission, verify, input, subject) =>
  checkTirVerifierAdmissionCuts(freshAdmission, (observed, body, admit) => verify(observed, admit)(body), input, subject);

export async function checkCommaSequence() {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../../packages/host/dist/evaluate/index.js");
  const { captureSourceBarrier } = await import("../../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../../packages/host/dist/pipeline/typed-barrier.js");
  const { verifyTir: verifyTirOperation } = await import("../../../packages/host/dist/ir-tir/index.js");
  const verifyTir = await tirFixtureBodyVerifier(verifyTirOperation);
  const { instanceKey } = await import("../../../packages/host/dist/ir-types/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export function combine(first: boolean, next: boolean): boolean {
      return (first = next, (next = !first, next));
    }
    export function literal(input: boolean) { return (input = true, 3); }`);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [combine, literal] = module.tree.statements.nodes.map(declaration => module.bodies.find(row =>
    row.kind === "selected" && row.tir.body === declaration.tsonic.signatures[0].body));
  assert.ok(combine && literal);
  const expression = body => body.tir.root.statements.nodes[0].expression.expression;
  const sequence = expression(combine);
  const nested = sequence.right.expression;
  for (const term of [sequence, nested, expression(literal)]) {
    assert.equal(term.kind, "BinaryExpression");
    assert.equal(term.operatorToken.kind, "CommaToken");
    assert.equal(term.tsonic.role, "sequence");
    assert.equal(term.tsonic.type, term.right.tsonic.convertedType);
    assert.equal(Object.hasOwn(term.tsonic, "operation"), false);
  }
  const assignments = combine.mir.blocks.flatMap(block => block.statements).filter(row => row.kind === "assign");
  assert.deepEqual(assignments.filter(row => row.value.kind === "use").map(row => row.tir.node), [sequence.left.id, nested.left.id]);
  assert.equal(assignments.some(row => row.tir.node === sequence.id || row.tir.node === nested.id), false);
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  const run = (body, args) => {
    const outcome = evaluate(deps, body.instance, body.mir, args, "compile-time", { query: "constValue", key: [body.instance, "compile-time"] });
    assert.equal(outcome.kind, "done");
    assert.equal(outcome.value.kind, "ok");
    return outcome.value.value;
  };
  const bool = value => ({ kind: "boolean", type: combine.tir.completion, value });
  for (const first of [false, true]) for (const next of [false, true])
    assert.deepEqual(run(combine, [bool(first), bool(next)]), { kind: "value", value: bool(!next) });
  assert.deepEqual(types.terms[literal.tir.completion], { kind: "primitive", primitive: "int64" });
  assert.deepEqual(run(literal, [bool(false)]), { kind: "value", value: { kind: "number", type: literal.tir.completion,
    value: { numerator: 3n, denominator: 1n, negativeZero: false } } });

  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const typed = typeSourceBarrier(input, captured.value, createAccount(input.limits.dataflow));
  assert.equal(typed.kind, "ok");
  const exact = typed.value.bodies.get(instanceKey(literal.instance));
  const [returned] = exact.root.statements.nodes;
  const comma = returned.expression.expression;
  const type = comma.left.tsonic.convertedType;
  assert.notEqual(type, comma.right.tsonic.convertedType);
  const wrong = { ...comma, tsonic: { ...comma.tsonic, type, convertedType: type } };
  const changed = { ...exact, root: { ...exact.root, statements: { ...exact.root.statements,
    nodes: [{ ...returned, expression: { ...returned.expression, expression: wrong } }] } } };
  assert.equal(verifyTir(typed.value.verifierOf(module.module), changed).some(issue => issue.rule === "operation-type"), true);

  const control = `export let unset: boolean;
    export function stop(flag: boolean): boolean { throw flag; }
    export const output: boolean = (stop(false), unset);`;
  const blocked = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", control));
  assert.equal(blocked.kind, "ok", JSON.stringify(blocked.diagnostics));
  const returning = control.replace("throw flag", "return flag");
  const reached = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", returning));
  assert.equal(reached.kind, "refused");
  assert.equal(reached.diagnostics.length, 1);
  assert.equal(reached.diagnostics[0].code.name, "TSONIC_STATIC_READ_BEFORE_INITIALIZATION");
  assert.deepEqual(reached.diagnostics[0].site, { kind: "source", origin: {
    module: input.snapshot.entryPoint, start: returning.lastIndexOf("unset"), length: "unset".length, derived: [],
  } });

  for (const body of ["return ((value), flag);", "(value); return flag;"]) {
    const text = `export function sample(flag: boolean): boolean { let value: boolean; ${body} }`;
    const missing = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", text));
    assert.equal(missing.kind, "refused");
    assert.equal(missing.diagnostics.length, 1);
    assert.equal(missing.diagnostics[0].code.name, "TSONIC_READ_BEFORE_INITIALIZATION");
    assert.deepEqual(missing.diagnostics[0].site, { kind: "source", origin: {
      module: input.snapshot.entryPoint, start: text.lastIndexOf("value"), length: "value".length, derived: [],
    } });
    const initialized = text.replace("let value: boolean;", "let value: boolean = flag;");
    const ready = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", initialized));
    assert.equal(ready.kind, "ok", JSON.stringify(ready.diagnostics));
  }
}

export async function checkCoalescingAssignment() {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../../packages/host/dist/evaluate/index.js");
  const { verifyOccurrenceOperation } = await import("../../../packages/host/dist/ir-tir/verify-occurrences.js");
  for (const absent of ["null", "undefined"]) {
    const optional = `boolean | ${absent}`;
    const input = analysisInput(fixture, "sdk-minimal", `
      export function effect(left: ${optional}, right: ${optional}, observed: ${optional}): ${optional} {
        left ??= (observed = right);
        return observed;
      }
      export function result(left: ${optional}, right: ${optional}): ${optional} { return left ??= right; }
    `);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { index: { types }, modules } = result.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    for (const [ordinal, declaration] of module.tree.statements.nodes.entries()) {
      const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
      const assignment = body.tir.root.statements.nodes[0].expression;
      const type = body.tir.completion;
      assert.equal(types.terms[type].kind, "optional");
      assert.equal(assignment.tsonic.type, type);
      assert.equal(assignment.tsonic.storage, type);
      assert.equal(assignment.tsonic.calculation, null);
      assert.deepEqual(assignment.tsonic.selection, { kind: "coalesce", control: assignment.left.id, right: assignment.right.id, disposition: "dynamic" });
      assert.deepEqual(assignment.right.tsonic.demand, { kind: "selected", control: assignment.left.id, when: "absent" });
      const wrongRight = { ...assignment.right, tsonic: { ...assignment.right.tsonic, convertedType: types.terms[type].value } };
      const findings = [];
      verifyOccurrenceOperation({ ...assignment, right: wrongRight }, types,
        (rule, node, detail) => findings.push([rule, node.id, detail]));
      assert.deepEqual(findings, [["operation-type", assignment.id,
        "conditional assignment requires its read-write storage and only its selected RHS embedding"]]);
      const entry = body.mir.blocks[body.mir.entries.find(row => row.provided === body.tir.params.length).block];
      const snapshots = entry.statements.filter(row => row.kind === "assign" && row.tir.node === assignment.left.id);
      assert.equal(snapshots.length, 1);
      const [snapshot] = snapshots;
      assert.equal(entry.terminator.kind, "switch");
      assert.deepEqual(entry.terminator.operand, { kind: "place", place: snapshot.place });
      const [absence] = entry.terminator.targets;
      assert.deepEqual(body.mir.constants[absence.constant].value, { kind: "literal", value: { kind: "absence" } });
      const stores = body.mir.blocks.flatMap(block => block.statements.flatMap(row =>
        row.kind === "assign" && row.tir.node === assignment.id && row.place === snapshot.value.operand.place ? [block.id] : []));
      assert.deepEqual(stores, [absence.target]);
      const constant = value => value === null ? { kind: "absence", type } : { kind: "boolean", type, value };
      const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
        selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
      for (const left of [null, false, true]) for (const right of [null, false, true]) {
        const observed = right !== true;
        const operands = (ordinal === 0 ? [left, right, observed] : [left, right]).map(constant);
        const run = evaluate(deps, body.instance, body.mir, operands, "compile-time",
          { query: "constValue", key: [body.instance, "compile-time"] });
        assert.equal(run.kind, "done");
        assert.equal(run.value.kind, "ok");
        assert.deepEqual(run.value.value, { kind: "value", value: constant(left === null ? right : ordinal === 0 ? observed : left) });
        assert.deepEqual(run.value.diagnostics, []);
      }
    }
  }
}

export async function checkOptionalEmbedding() {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { evaluate } = await import("../../../packages/host/dist/evaluate/index.js");
  const { parseTir, printTir, verifyTir: verifyTirOperation } = await import("../../../packages/host/dist/ir-tir/index.js");
  const verifyTir = await tirFixtureBodyVerifier(verifyTirOperation);
  const { captureSourceBarrier } = await import("../../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../../packages/host/dist/pipeline/typed-barrier.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export function bool(value: boolean): boolean | null { return value; }
    export function literal(): boolean | null { return false; }
    export function text(value: string): string | null { return value; }
    export function numberValue(value: number): number | null { return value; }
    export function absentNull(): boolean | null { return null; }
    export function absentBoolUndefined(): boolean | undefined { return undefined; }
    export function absentUndefined(): string | undefined { return undefined; }
    export function absentNumber(): number | null { return null; }
    export function unavailableBits(): number | null { return 1.5; }
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index: { types }, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  const absenceEndpoints = [];
  for (const declaration of module.tree.statements.nodes) {
    const name = declaration.name.text;
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    const resultType = body.tir.completion;
    const [operation] = body.mir.blocks.flatMap(row => row.statements)
      .filter(row => row.kind === "assign" && row.value.kind === "convert").map(row => row.value.operation.decision.operation);
    assert.equal(types.terms[resultType].kind, "optional");
    assert.equal(operation.to, resultType);
    assert.equal(operation.embedding.conversion, name.startsWith("absent") ? "absence" : "union-injection");
    assert.deepEqual(operation.embedding.check, { kind: "none" });
    if (name === "absentNull" || name === "absentBoolUndefined") absenceEndpoints.push([operation.from, operation.to]);
    if (name === "absentBoolUndefined") {
      const [returned] = body.tir.root.statements.nodes;
      const read = returned.expression;
      const resolution = read.tsonic.resolution;
      assert.deepEqual(resolution, { kind: "intrinsic-value", intrinsic: "undefined" });
      const printed = printTir(body.tir);
      const decoded = parseTir(printed);
      assert.equal(decoded.kind, "parsed");
      assert.deepEqual(decoded.value.root.statements.nodes[0].expression.tsonic.resolution, resolution);
      assert.equal(printTir(decoded.value), printed);
      const captured = captureSourceBarrier(input);
      assert.equal(captured.kind, "ok");
      const typed = typeSourceBarrier(input, captured.value, createAccount(input.limits.dataflow));
      assert.equal(typed.kind, "ok");
      const context = typed.value.verifierOf(module.module);
      const present = types.terms[resultType].value;
      for (const phase of [
        { ...read.tsonic, type: present },
        { role: "assignment-target", resolution, access: { kind: "write", storage: operation.from } },
      ]) {
        const changed = { ...body.tir, root: { ...body.tir.root, statements: { ...body.tir.root.statements,
          nodes: [{ ...returned, expression: { ...read, tsonic: phase } }] } } };
        assert.equal(verifyTir(context, changed).some(issue => issue.rule === "intrinsic-value-use" && issue.site.node === read.id), true);
      }
    }
    const unit = { query: "constValue", key: [body.instance, "compile-time"] };
    if (name === "unavailableBits") {
      assert.throws(() => evaluate(deps, body.instance, body.mir, [], "compile-time", unit), /actual selected representation transformation/u);
      continue;
    }
    const payloads = name === "numberValue"
      ? [0n, 0x8000000000000000n, 0x7ff8000000001234n].map(bits => ({ kind: "floating", bits }))
      : name === "text" ? ["", "e\u0301\u0000λ"].map(value => ({ kind: "string", value }))
      : name === "bool" ? [false, true].map(value => ({ kind: "boolean", value }))
      : name === "literal" ? [{ kind: "boolean", value: false }] : [{ kind: "absence" }];
    for (const payload of payloads) {
      const args = body.tir.params.length === 0 ? [] : [{ ...payload, type: body.tir.params[0].tsonic.storage }];
      const outcome = evaluate(deps, body.instance, body.mir, args, "compile-time", unit);
      assert.equal(outcome.kind, "done", name);
      assert.equal(outcome.value.kind, "ok", name);
      assert.deepEqual(outcome.value.value, { kind: "value", value: { ...payload, type: resultType } }, name);
      assert.deepEqual(outcome.value.diagnostics, []);
    }
  }
  assert.equal(absenceEndpoints.length, 2);
  assert.deepEqual(absenceEndpoints[0], absenceEndpoints[1]);
}

export async function checkLabelledTransfers() {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../../packages/host/dist/pipeline/typed-barrier.js");
  const { evaluate } = await import("../../../packages/host/dist/evaluate/index.js");
  const { parseTir, printTir, verifyTir: verifyTirOperation } = await import("../../../packages/host/dist/ir-tir/index.js");
  const verifyTir = await tirFixtureBodyVerifier(verifyTirOperation);
  const input = analysisInput(fixture, "sdk-minimal", `
    export function advance(flag: boolean, again: boolean, keep: boolean): boolean {
      outer: for (; flag; flag = false) {
        inner: while (again) { keep = !keep; continue outer; }
        break outer;
      }
      return keep;
    }
    export function leave(flag: boolean, selected: boolean, keep: boolean): boolean {
      outer: {
        while (flag) {
          switch (selected) { case true: break outer; default: flag = false; }
        }
        keep = !keep;
      }
      return keep;
    }
    export function chain(flag: boolean, ignored: boolean, keep: boolean): boolean {
      outer: inner: do { flag = !flag; if (flag) continue outer; break inner; } while (false);
      return flag;
    }`);
  const output = analyzeHostProgram(input);
  assert.equal(output.kind, "ok", JSON.stringify(output.diagnostics));
  const { index: { types }, modules } = output.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  const source = captureSourceBarrier(input);
  assert.equal(source.kind, "ok");
  const typed = typeSourceBarrier(input, source.value, createAccount(input.limits.dataflow));
  assert.equal(typed.kind, "ok");
  const verifier = typed.value.verifierOf(module.module);
  const frontDeps = { extensions: input.extensions, navigationCapture: input.limits.navigationCapture };
  const opened = fixture.front.openCheckedProgram(frontDeps, input.snapshot);
  assert.equal(opened.kind, "ok");
  const captured = fixture.front.captureModule(frontDeps, opened.value, module.module);
  assert.equal(captured.kind, "ok");
  const routes = new Map([
    ["advance", (flag, second, keep) => flag && second ? !keep : keep],
    ["leave", (flag, second, keep) => flag && second ? keep : !keep],
    ["chain", flag => !flag],
  ]);
  const transferNodes = (root, name) => {
    const outer = root.statements.nodes[0];
    if (name === "advance") {
      const [inner, stop] = outer.statement.statement.statements.nodes;
      return { labels: [outer, inner], transfers: [[inner.statement.statement.statements.nodes[1], outer], [stop, outer]] };
    }
    if (name === "chain") {
      const inner = outer.statement;
      const [, next, stop] = inner.statement.statement.statements.nodes;
      return { labels: [outer, inner], transfers: [[next.thenStatement, outer], [stop, inner]] };
    }
    const choice = outer.statement.statements.nodes[0].statement.statements.nodes[0];
    return { labels: [outer], transfers: [[choice.caseBlock.clauses.nodes[0].statements.nodes[0], outer]] };
  };
  for (const declaration of module.tree.statements.nodes) {
    const name = declaration.name.text;
    const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body);
    const original = [...typed.value.bodies.values()].find(row => row.body === body.instance.body && row.bindings.kind === "instantiated");
    const parsed = parseTir(printTir(original));
    assert.equal(parsed.kind, "parsed");
    const decodedVerifier = { ...verifier, module: { ...verifier.module,
      bodies: verifier.module.bodies.map(row => row === original ? parsed.value : row) } };
    assert.deepEqual(verifyTir(decodedVerifier, parsed.value), []);
    const { labels, transfers } = transferNodes(parsed.value.root, name);
    for (const [occurrence, owner] of [...labels.map(label => [label, label]), ...transfers]) {
      const target = { body: body.instance.body, node: owner.id };
      assert.deepEqual(occurrence.tsonic.target, target);
      assert.deepEqual(occurrence.label.tsonic, { role: "label", target });
      assert.equal(captured.value.checkerViews.some(row => row.node.node === occurrence.label.id), false);
      assert.equal(captured.value.references.some(row => row.occurrence.node === occurrence.label.id), false);
    }
    if (labels.length > 1) {
      const [transfer, expected] = transfers[0];
      const crossed = { body: body.instance.body, node: labels.find(label => label !== expected).id };
      for (const fields of [[transfer], [transfer.label], [transfer, transfer.label]]) {
        const saved = fields.map(field => field.tsonic);
        for (const field of fields) field.tsonic = { ...field.tsonic, target: crossed };
        assert.equal(verifyTir(decodedVerifier, parsed.value).some(row => row.rule === "node-reference" && row.site.node === transfer.id), true);
        for (const [index, field] of fields.entries()) field.tsonic = saved[index];
      }
      const crossedSource = structuredClone(verifier.source);
      const sourceBody = crossedSource.bodies.find(row => row.body === body.instance.body);
      const [[checkedTransfer]] = transferNodes(sourceBody.root, name).transfers;
      const sourceCallable = crossedSource.tree.statements.nodes.find(row => row.kind === "FunctionDeclaration" && row.name.text === name);
      checkedTransfer.label.tsonic = sourceCallable.parameters.nodes[0].name.tsonic;
      const findings = verifyTir({ ...decodedVerifier, source: crossedSource }, parsed.value);
      assert.equal(findings.some(row => row.rule === "node-reference" && row.site.node === transfer.id), true);
    }
    const literal = value => ({ kind: "boolean", type: body.tir.completion, value });
    for (const flag of [false, true]) for (const second of [false, true]) for (const keep of [false, true]) {
      const run = evaluate(deps, body.instance, body.mir, [flag, second, keep].map(literal), "compile-time",
        { query: "constValue", key: [body.instance, "compile-time"] });
      assert.equal(run.kind, "done", name);
      assert.equal(run.value.kind, "ok", name);
      assert.deepEqual(run.value.value, { kind: "value", value: literal(routes.get(name)(flag, second, keep)) }, name);
      assert.deepEqual(run.value.diagnostics, []);
    }
  }
  for (const statements of ["outer: { while (flag) { continue outer; } }", "finished: {} break finished;",
    "outer: outer: while (flag) { break outer; }"]) {
    const invalid = analysisInput(fixture, "sdk-minimal", `export function invalid(flag: boolean): boolean { ${statements} return flag; }`);
    assert.throws(() => analyzeHostProgram(invalid), /label without its actual enclosing checked control target/);
  }
}

export async function checkVoidOperand() {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { evaluate, resumeEvaluate } = await import("../../../packages/host/dist/evaluate/index.js");
  const { verifyOccurrenceOperation } = await import("../../../packages/host/dist/ir-tir/verify-occurrences.js");
  const source = `
    function act(flag: boolean, message: string): boolean { if (flag) return flag; throw message; }
    function effect(flag: boolean, message: string): void { if (flag) return; throw message; }
    export function used(flag: boolean, message: string): undefined { return void act(flag, message); }
    export function discarded(flag: boolean, message: string): boolean { void act(flag, message); return flag; }
    export function usedEffect(flag: boolean, message: string, replacement: boolean): undefined {
      flag = replacement;
      return void effect(flag, message);
    }
    export function discardedEffect(flag: boolean, message: string): boolean { void effect(flag, message); return flag; }
    export function store(before: boolean, after: boolean): boolean { void (before = after); return before; }
    export function usedStore(before: boolean, after: boolean): undefined { return void (before = after); }
  `;
  const input = analysisInput(fixture, "sdk-minimal", source);
  const output = analyzeHostProgram(input);
  assert.equal(output.kind, "ok", JSON.stringify(output.diagnostics));
  const { index: { types }, modules } = output.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [act, effect, used, discarded, usedEffect, discardedEffect, store, usedStore] = module.tree.statements.nodes.map(declaration =>
    module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.tsonic.signatures[0].body));
  const deps = { types, typeOf: id => types.terms[id], signatureOf: id => types.signatures[id],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
  const verify = (body, arguments_) => evaluate(deps, body.instance, body.mir, arguments_, "compile-time",
    { query: "constValue", key: [body.instance, "compile-time"] });
  for (const [body, callee, consumed] of [
    [used, act, true], [discarded, act, false], [usedEffect, effect, true], [discardedEffect, effect, false],
  ]) {
    const statements = body.tir.root.statements.nodes;
    const expression = statements[body === usedEffect ? 1 : 0].expression;
    assert.equal(expression.kind, "VoidExpression");
    assert.deepEqual(types.terms[expression.tsonic.type], { kind: "intrinsic", intrinsic: "absence" });
    const selected = expression.tsonic.operation.decision.decision;
    assert.equal(selected.operation.kind, "discard");
    assert.deepEqual(selected.operands, [expression.expression.tsonic.convertedType]);
    assert.deepEqual(types.terms[selected.operands[0]], callee === effect
      ? { kind: "intrinsic", intrinsic: "void" } : { kind: "primitive", primitive: "bool" });
    for (const invalid of ["operation", "execution", "result", "operand"]) {
      const changed = structuredClone(expression);
      const decision = changed.tsonic.operation.decision.decision;
      if (invalid === "operation") decision.operation = { kind: "type-query" };
      if (invalid === "execution") decision.execution = { kind: "invocation", writesStorage: false, failure: "unwind" };
      if (invalid === "result") changed.tsonic.type = changed.tsonic.convertedType = decision.result = body.tir.params[0].tsonic.storage;
      if (invalid === "operand") decision.operands[0] = expression.tsonic.type;
      const findings = [];
      verifyOccurrenceOperation(changed, types, rule => findings.push(rule));
      assert.deepEqual(findings, ["operation-type"], invalid);
    }
    assert.equal(body.mir.blocks.length, 2);
    const [entry, continuation] = body.mir.blocks;
    const call = entry.terminator;
    assert.deepEqual([call.kind, call.tir.node, call.callee.kind, call.destination, call.next, call.unwind],
      ["call", expression.expression.id, "direct", null, continuation.id, { kind: "escape" }]);
    assert.deepEqual(entry.statements.map(row => [row.kind, row.tir.node]), body === usedEffect ? [["assign", statements[0].expression.id]] : []);
    assert.deepEqual(continuation.statements, []);
    assert.equal(continuation.terminator.kind, "return");
    assert.equal(body.mir.constants.length, consumed ? 1 : 0);
    if (consumed) {
      const [absence] = body.mir.constants;
      assert.deepEqual([absence.type, absence.value, continuation.terminator.value],
        [body.tir.completion, { kind: "literal", value: { kind: "absence" } }, { kind: "constant", constant: absence.id }]);
    }
    for (const flag of [false, true]) {
      const control = { kind: "boolean", type: body.tir.params[0].tsonic.storage, value: flag };
      const message = { kind: "string", type: body.tir.params[1].tsonic.storage, value: "original throw" };
      const pending = verify(body, body === usedEffect ? [{ ...control, value: !flag }, message, control] : [control, message]);
      assert.equal(pending.kind, "paused");
      assert.deepEqual(pending.requests, [{ kind: "mir-body", instance: callee.instance }]);
      const run = resumeEvaluate(deps, pending.paused, [{ kind: "mir-body", body: callee.mir }]);
      assert.equal(run.kind, "done");
      assert.equal(run.value.kind, "ok");
      const value = !flag ? { kind: "error", type: body.tir.completion } : consumed
        ? { kind: "absence", type: body.tir.completion } : control;
      assert.deepEqual(run.value.value, { kind: "value", value });
      if (flag) assert.deepEqual(run.value.diagnostics, []);
      else assert.deepEqual(run.value.diagnostics.map(row => row.site.origin), [callee.tir.root.statements.nodes[1].origin]);
    }
  }
  const before = { kind: "boolean", type: store.tir.completion, value: false };
  const after = { ...before, value: true };
  const stored = verify(store, [before, after]);
  assert.equal(stored.kind, "done");
  assert.equal(stored.value.kind, "ok");
  assert.deepEqual(stored.value.value, { kind: "value", value: after });
  assert.equal(usedStore.mir.blocks.length, 1);
  const [storeBlock] = usedStore.mir.blocks;
  assert.equal(storeBlock.statements.length, 1);
  const [assignment] = storeBlock.statements;
  const [destination, sourceLocal] = usedStore.mir.locals;
  assert.deepEqual([assignment.kind, assignment.value.kind, assignment.value.operand.kind,
    usedStore.mir.places[assignment.place].base, usedStore.mir.places[assignment.value.operand.place].base],
  ["assign", "use", "place", { kind: "local", local: destination.id }, { kind: "local", local: sourceLocal.id }]);
  const usedStored = verify(usedStore, [before, after]);
  assert.equal(usedStored.kind, "done");
  assert.equal(usedStored.value.kind, "ok");
  assert.deepEqual(usedStored.value.value, { kind: "value", value: { kind: "absence", type: usedStore.tir.completion } });
  const never = `function stop(message: string): never { throw message; }
    export function wrap(message: string): undefined { return void stop(message); }`;
  assert.throws(() => analyzeHostProgram(analysisInput(fixture, "sdk-minimal", never)),
    error => error.cause?.owner === "rules" && error.message === "not decided yet: a void operator without an actual operand value");
  const missing = "export function fail(flag: boolean): boolean { void missing; return flag; }";
  const refused = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", missing));
  assert.equal(refused.kind, "refused");
  assert.equal(refused.diagnostics.length, 1);
  assert.equal(refused.diagnostics[0].code.number, 2304);
  assert.deepEqual(refused.diagnostics[0].site.origin, { module: input.snapshot.entryPoint,
    start: missing.indexOf("missing"), length: "missing".length, derived: [] });
  const unwritten = "export function fail(flag: boolean): boolean { let unread: boolean; void unread; return flag; }";
  const uninitialized = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", unwritten));
  assert.equal(uninitialized.kind, "refused");
  assert.equal(uninitialized.diagnostics.length, 1);
  assert.equal(uninitialized.diagnostics[0].code.rendered, "TSONIC_READ_BEFORE_INITIALIZATION");
  assert.deepEqual(uninitialized.diagnostics[0].site.origin, { module: input.snapshot.entryPoint,
    start: unwritten.lastIndexOf("unread"), length: "unread".length, derived: [] });
}
