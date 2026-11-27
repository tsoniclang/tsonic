import { insertFixtureType } from "./fixtures/types-construction.mjs";
import assert from "node:assert/strict";
import { suppliedTirScopes, tirFixtureBodyVerifier, tirFixtureVerifier } from "./fixtures/typed-occurrence-witnesses.mjs";
import { before, test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";
import { checkedDomain } from "./fixtures/front/checked-domain.mjs";

let fixture;
let wiring;
let inferStep;
let inferenceStep;
let registration;
let query;
let checkedInputs;
let irInfer;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "the current aggregate guard owns this case");
  fixture = await loadFrontFixture();
  ({ pipelineWiring: wiring } = await import("../../packages/host/dist/pipeline/wiring.js"));
  inferStep = await import("../../packages/host/dist/pipeline/infer-deps-step.js");
  inferenceStep = await import("../../packages/host/dist/pipeline/inference-step.js");
  registration = await import("../../packages/host/dist/pipeline/semantic-queries.js");
  query = await import("../../packages/host/dist/query/index.js");
  checkedInputs = await import("../../packages/host/dist/pipeline/checked-inputs.js");
  irInfer = await import("../../packages/host/dist/ir-infer/index.js");
});

const EXPANSION = { maximumDepth: 64, maximumVisits: 4096, maximumUnionMembers: 64, maximumIntersectionMembers: 64 };

const visitBindingScopes = (module, bodyOf, scopeOf) => (target, subject, visit) => {
  const body = target.kind === "body" ? bodyOf(target.instance) : null;
  const actual = target.kind === "body" ? body : target.module === module.module ? module : null;
  if (subject !== actual) return { kind: "complete", scopes: null };
  assert.notEqual(visit, null);
  const scopes = [];
  const stop = visit(owner => {
    if (owner === null) assert.notEqual(body, null);
    scopes.push(scopeOf(owner ?? body.owner));
    return null;
  });
  return stop === null ? { kind: "complete", scopes } : { kind: "resource-stop", stop };
};
const LIMITS = { maximumVariablesPerGroup: 128, maximumAtomicContributionsPerGroup: 256 };
const GRAPH = { maximumWork: 65536, maximumResultEntries: 65536 };
const readyTyping = (constraints, solution, template = null) => ({ kind: "ready", constraints, solution, template });

test("a refused required child does not hide its module's independent authored annotation error", async () => {
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  const imported = "import { missing } from './library.js';";
  const child = "export function read(): boolean { return missing; }";
  const annotation = "export type Invalid = readonly number;";
  const healthy = "export function independent(value: boolean): boolean { return !value; }";
  for (const [main, expected] of [
    [[imported, child, annotation, healthy], [2305, 1354]],
    [[imported, annotation, child, healthy], [2305, 1354]],
    [[imported.replace("missing", "value as missing"), child, annotation, healthy], [1354]],
    [[imported, child, annotation.replace("readonly ", ""), healthy], [2305]],
    [[imported.replace("missing", "value as missing"), child, annotation.replace("readonly ", ""), healthy], []],
  ]) {
    const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": main.join("\n"), "library.ts": "export const value: boolean = true;" },
      libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
    const selected = { ...input, snapshot };
    const capture = captureSourceBarrier(selected);
    assert.equal(capture.kind, "ok");
    const module = capture.value.modules.find(row => row.module.module === snapshot.entryPoint).module;
    const originals = module.checkerDiagnostics;
    assert.deepEqual(originals.map(row => row.code.number), expected);
    const typed = typeSourceBarrier(selected, capture.value, createAccount(input.limits.dataflow));
    assert.equal(typed.kind, expected.length === 0 ? "ok" : "refused");
    assert.deepEqual(typed.diagnostics.map(row => row.code.number), expected);
    for (const [position, diagnostic] of typed.diagnostics.entries()) assert.strictEqual(diagnostic, originals[position]);
    assert.equal("value" in typed, expected.length === 0);
  }
});

test("the original Forms refusal and an independent checker error both survive either authored order", async () => {
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const denied = "export declare const absent: boolean;";
  const checker = "export function read(): boolean { return missing; }";
  const forms = "TSONIC_SOURCE_FORM_UNSUPPORTED";
  for (const [rows, codes] of [[[denied, checker], [forms, "TS2304"]], [[checker, denied], ["TS2304", forms]]]) {
    const input = analysisInput(fixture, "sdk-minimal", rows.join("\n"));
    const source = captureSourceBarrier(input);
    assert.equal(source.kind, "ok");
    const actual = source.value.modules.find(row => row.module.module === input.snapshot.entryPoint);
    const original = actual.module.checkerDiagnostics.find(row => row.code.rendered === "TS2304");
    const typed = typeSourceBarrier(input, source.value, createAccount(input.limits.dataflow));
    assert.equal(typed.kind, "refused");
    assert.equal("value" in typed, false);
    assert.deepEqual(typed.diagnostics.map(row => row.code.rendered), codes);
    assert.strictEqual(typed.diagnostics.find(row => row.code.rendered === "TS2304"), original);
  }
});

test("authored debugger statements reach Forms at their exact checked occurrences without hiding an independent error", async () => {
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const independent = "export function independent(): boolean { return missing; }";
  const nested = "export function nested(): boolean { debugger; return missing; }";
  const unsupported = "TSONIC_SOURCE_FORM_UNSUPPORTED";
  for (const [sourceText, codes] of [
    [`debugger;\n${independent}`, [unsupported, "TS2304"]],
    [`${independent}\ndebugger;`, ["TS2304", unsupported]],
    [nested, [unsupported, "TS2304"]],
    ["export function repeated(): boolean { debugger; debugger; return true; }", [unsupported, unsupported]],
  ]) {
    const input = analysisInput(fixture, "sdk-minimal", sourceText);
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok");
    const main = captured.value.modules.find(row => row.module.module === input.snapshot.entryPoint);
    const authored = main.nodes.filter(node => node.kind === "DebuggerStatement");
    assert.deepEqual(authored.map(node => [node.origin.start, node.origin.length, node.tsonic]),
      [...sourceText.matchAll(/debugger;/gu)].map(match => [match.index, "debugger;".length, null]));
    const originalChecker = main.module.checkerDiagnostics.find(row => row.code.rendered === "TS2304");
    const report = wiring.validate.formDiagnostics;
    const earned = new Map();
    wiring.validate.formDiagnostics = (deps, site, unit) => {
      assert.equal(site.report === site.cut && authored.includes(site.report), true);
      assert.equal(earned.has(site.report), false);
      const result = report(deps, site, unit);
      earned.set(site.report, result.diagnostics[0]);
      assert.deepEqual(result.value.report.position, { kind: "module-node", module: main.module.module, node: site.report.id });
      return result;
    };
    try {
      const typed = typeSourceBarrier(input, captured.value, createAccount(input.limits.dataflow));
      assert.equal(typed.kind, "refused");
      assert.equal(Object.hasOwn(typed, "value"), false);
      assert.deepEqual(typed.diagnostics.map(row => row.code.rendered), codes);
      const forms = typed.diagnostics.filter(row => row.code.rendered === unsupported);
      assert.equal(forms.length, authored.length);
      for (const [position, node] of authored.entries()) {
        assert.equal(forms[position] === earned.get(node) && forms[position].site.origin === node.origin, true);
        assert.deepEqual(forms[position].arguments, [{ kind: "text", value: "DebuggerStatement" }]);
      }
      assert.equal(typed.diagnostics.find(row => row.code.rendered === "TS2304") === originalChecker, true);
    } finally {
      wiring.validate.formDiagnostics = report;
    }
  }
  const denied = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", "debugger;"));
  assert.equal(denied.kind, "refused");
  assert.deepEqual(denied.diagnostics.map(row => row.code.rendered), [unsupported]);
  assert.equal(Object.hasOwn(denied, "value"), false);
  const quoted = analysisInput(fixture, "sdk-minimal", 'export function text(): string { return "debugger;"; }');
  const captured = captureSourceBarrier(quoted);
  assert.equal(captured.kind, "ok");
  const typed = typeSourceBarrier(quoted, captured.value, createAccount(quoted.limits.dataflow));
  assert.equal(typed.kind, "ok");
  assert.deepEqual(typed.diagnostics, []);
  const control = analyzeHostProgram(analysisInput(fixture, "sdk-minimal",
    "/* debugger; */ function debuggerValue(): boolean { return true; } export function read(): boolean { return debuggerValue(); }"));
  assert.equal(control.kind, "ok");
  assert.deepEqual(control.diagnostics, []);
});

test("excluded executable expressions report only their authored outer Forms occurrence", async () => {
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const unsupported = "TSONIC_SOURCE_FORM_UNSUPPORTED";
  const root = "/project/node_modules/dependency";
  const independent = "export function independent(): boolean { return missing; }";
  const libraries = [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }];
  for (const [file, form, expression] of [
    ["main.tsx", "JsxElement", "<div><span>{import('dependency')}</span></div>"],
    ["main.tsx", "JsxSelfClosingElement", "<div callback={() => { debugger; }} />"],
    ["main.tsx", "JsxFragment", "<><div /></>"],
    ["main.ts", "DynamicImport", "import('dependency')"],
    ["main.ts", "DynamicImport", "import('dependency', { with: { type: 'json' } })"],
    ["main.ts", "DynamicImport", "import(name)"],
  ]) {
    for (const earlier of [true, false]) {
      const containing = `export function choose(name: string): boolean { ${expression}; return true; }`;
      const authored = (earlier ? [containing, independent] : [independent, containing]).join("\n");
      const input = { ...analysisInput(fixture, "sdk-minimal", authored), snapshot: fixture.projectSnapshot({
        sourceFiles: { [file]: authored }, libraries,
        extraFiles: { [root + "/package.json"]: JSON.stringify({ name: "dependency", version: "1.0.0", types: "index.ts" }) },
        otherPackages: [{ root, name: "dependency", modules: { "index.ts": ["source", "export type Item = boolean;", false] } }],
      }) };
      const captured = captureSourceBarrier(input);
      assert.equal(captured.kind, "ok");
      const main = captured.value.modules.find(row => row.module.module === input.snapshot.entryPoint);
      const cut = main.nodes.find(row => row.kind === "ExcludedExpression");
      const start = authored.indexOf(expression);
      assert.deepEqual(cut.origin, { module: main.module.module, start, length: expression.length, derived: [] });
      assert.deepEqual([cut.form, cut.tsonic], [form, null]);
      assert.equal(main.nodes.filter(node => node.kind === "ExcludedExpression").length, 1);
      assert.equal(main.nodes.some(node => node.parent === cut.id), false, "excluded operands were not opened");
      assert.deepEqual(main.module.moduleLinks, []);
      const original = main.module.checkerDiagnostics.find(item => item.code.rendered === "TS2304");
      const typed = typeSourceBarrier(input, captured.value, createAccount(input.limits.dataflow));
      assert.equal(typed.kind, "refused");
      assert.equal(Object.hasOwn(typed, "value"), false);
      assert.deepEqual(typed.diagnostics.map(row => row.code.rendered), earlier ? [unsupported, "TS2304"] : ["TS2304", unsupported]);
      const reported = typed.diagnostics.find(row => row.code.rendered === unsupported);
      assert.equal(reported.site.origin === cut.origin, true);
      assert.deepEqual(reported.arguments, [{ kind: "text", value: form }]);
      assert.equal(typed.diagnostics.find(row => row.code.rendered === "TS2304") === original, true);
    }
  }
});

test("type-only import retains its actual declaration and leaves an excluded dependency unopened", async () => {
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { parseModuleBodies, printModuleBodies } = await import("../../packages/host/dist/ir-program/index.js");
  const { printHir, parseHir } = await import("../../packages/host/dist/ir-hir/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const root = "/project/node_modules/dependency";
  const dependency = fixture.moduleOf(fixture.packageOf(root), "index.ts");
  const make = source => ({
    ...analysisInput(fixture, "sdk-minimal", source),
    snapshot: fixture.projectSnapshot({
      sourceFiles: { "main.ts": source }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
      extraFiles: { [root + "/package.json"]: JSON.stringify({ name: "dependency", version: "1.0.0", types: "index.ts" }) },
      otherPackages: [{ root, name: "dependency", modules: { "index.ts": ["source",
        "export type Item = boolean; export function denied(): boolean { import('dependency'); return true; }", false] } }],
    }),
  });
  const input = make("export type Offered = import('dependency').Item; export function ordinary(): Offered { return true; }");
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const [upstream] = captured.value.modules.find(row => row.module.module === dependency).module.tree.statements.nodes;
  const checked = captured.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
  const annotation = checked.tree.statements.nodes[0].type;
  assert.equal(annotation.kind, "ImportType");
  assert.deepEqual(annotation.tsonic.referencedDefinitions, [upstream.tsonic.definition]);
  const checkedWire = printHir(checked);
  const decodedHir = parseHir(checkedWire);
  assert.equal(decodedHir.kind, "parsed");
  assert.equal(printHir(decodedHir.value), checkedWire);
  const good = analyzeHostProgram(input);
  assert.equal(good.kind, "ok", JSON.stringify(good.diagnostics));
  const { index, modules } = good.value;
  const chapter = modules.find(row => row.module === dependency);
  assert.equal(chapter.tree.kind, "checked-root");
  assert.equal(chapter.bodies.length, 0);
  assert.equal(index.initialization.modules.some(row => {
    const body = fixture.ids.decodeBodyId(row.instance.body);
    assert.equal(body.kind, "decoded");
    const owner = fixture.ids.decodeDefId(body.value.owner);
    assert.equal(owner.kind, "decoded");
    return owner.value.module === dependency;
  }), false);
  const wire = printModuleBodies(index, chapter);
  assert.equal(wire.includes("ExcludedExpression("), true);
  const decoded = parseModuleBodies(index, wire);
  assert.equal(decoded.kind, "parsed");
  assert.equal(printModuleBodies(index, decoded.value), wire);
  const invalidForm = wire.replace('form="DynamicImport"', 'form="CallExpression"');
  assert.equal(invalidForm !== wire, true);
  assert.equal(parseModuleBodies(index, invalidForm).kind, "invalid-text");
  const readyWire = printModuleBodies(index, modules.find(row => row.module === input.snapshot.entryPoint));
  const invalidTyped = readyWire.replace(/^(n:\d+=)TrueKeyword\(/m, "$1ExcludedExpression(");
  assert.equal(invalidTyped !== readyWire, true);
  assert.equal(parseModuleBodies(index, invalidTyped).kind, "invalid-text");
  const entered = analyzeHostProgram(make("import {denied} from 'dependency'; export function run(): boolean { return denied(); }"));
  assert.equal(entered.kind, "refused");
  assert.deepEqual(entered.diagnostics.map(row => [row.code.rendered, row.site.origin.module]),
    [["TSONIC_SOURCE_FORM_UNSUPPORTED", dependency]]);
  assert.equal(Object.hasOwn(entered, "value"), false);
});

test("selected throw refuses the immediate effect-only operand, keeping independent diagnostics in either source order", async () => {
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const effect = "function effect(): void { return; }";
  const checker = "export function independent(): boolean { return missing; }";
  const code = "TSONIC_EFFECT_ONLY_THROW_OPERAND";
  for (const operand of ["effect()", "(effect())", "((effect()))"]) {
    const consumer = `export function run(): void { throw ${operand}; }`;
    for (const [rows, ordered] of [
      [[effect, consumer], [code]], [[effect, consumer, checker], [code, "TS2304"]],
      [[effect, checker, consumer], ["TS2304", code]],
    ]) {
      const source = rows.join("\n");
      const input = analysisInput(fixture, "sdk-minimal", source);
      const captured = captureSourceBarrier(input);
      assert.equal(captured.kind, "ok");
      const original = captured.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
      const result = typeSourceBarrier(input, captured.value, createAccount(input.limits.dataflow));
      assert.equal(result.kind, "refused", operand);
      assert.equal("value" in result, false);
      assert.deepEqual(result.diagnostics.map(row => row.code.rendered), ordered);
      const diagnostic = result.diagnostics.find(row => row.code.rendered === code);
      assert.equal(diagnostic.source, "rules");
      assert.equal(diagnostic.site.kind, "source");
      assert.equal(diagnostic.site.origin.module, input.snapshot.entryPoint);
      assert.equal(source.slice(diagnostic.site.origin.start, diagnostic.site.origin.start + diagnostic.site.origin.length), operand);
      if (ordered.includes("TS2304")) assert.strictEqual(result.diagnostics.find(row => row.code.rendered === "TS2304"),
        original.checkerDiagnostics.find(row => row.code.rendered === "TS2304"));
      const published = analyzeHostProgram(input);
      assert.equal(published.kind, "refused");
      assert.equal("value" in published, false);
      assert.deepEqual(published.diagnostics, result.diagnostics);
    }
  }
  const literal = analysisInput(fixture, "sdk-minimal", 'export function run(): void { throw "message"; }');
  const captured = captureSourceBarrier(literal);
  assert.equal(captured.kind, "ok");
  assert.equal(typeSourceBarrier(literal, captured.value, createAccount(literal.limits.dataflow)).kind, "ok");
  for (const [parameters, operand] of [["message: string", "message"], ["", "void effect()"], ["", "(void effect())"]]) {
    const input = analysisInput(fixture, "sdk-minimal", `${effect} export function run(${parameters}): void { throw ${operand}; }`);
    assert.equal(analyzeHostProgram(input).kind, "ok", operand);
  }
});

test("Elaborate transports the selected throw Rules refusal by identity with its actual call decision", async () => {
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const elaborate = wiring.elaborate.elaborate;
  const reports = [];
  wiring.elaborate.elaborate = (deps, input) => {
    const statement = input.body.root.kind === "Block" ? input.body.root.statements.nodes[0] : null;
    if (statement?.kind !== "ThrowStatement" || input.typing.kind !== "ready") return elaborate(deps, input);
    const actual = input.typing.solution.constraints.find(row =>
      row.constraint.body === input.body.body && row.decision.kind === "call").decision.application;
    const original = deps.rules.checkThrowOperandUse;
    const refusals = [];
    const result = elaborate({ ...deps, rules: { ...deps.rules, checkThrowOperandUse: evidence => {
      assert.strictEqual(evidence.instance, input.instance);
      assert.deepEqual(evidence.statement, { body: input.body.body, node: statement.id });
      assert.deepEqual(evidence.operand, { body: input.body.body, node: statement.expression.id });
      assert.strictEqual(evidence.origin, statement.expression.origin);
      assert.equal(evidence.selected.kind, "application");
      assert.deepEqual(evidence.selected.producer, { body: input.body.body, node: statement.expression.expression.id });
      assert.strictEqual(evidence.selected.decision, actual);
      assert.deepEqual(deps.typeOf(actual.result), { kind: "intrinsic", intrinsic: "void" });
      const refusal = original(evidence);
      assert.equal(refusal.kind, "refused");
      refusals.push(refusal);
      return refusal;
    } } }, input);
    assert.equal(result.kind, "no-result");
    assert.equal("value" in result, false);
    assert.equal(refusals.length, 1);
    assert.equal(result.causes.length, 1);
    assert.equal(result.causes[0].kind, "producer");
    assert.strictEqual(result.causes[0].refusal, refusals[0]);
    assert.strictEqual(result.diagnostics[0], refusals[0].diagnostics[0]);
    reports.push(result.diagnostics[0]);
    return result;
  };
  try {
    const result = analyzeHostProgram(analysisInput(fixture, "sdk-minimal",
      "function effect(): void { return; } export function run(): void { throw (effect()); }"));
    assert.equal(result.kind, "refused");
    assert.equal(reports.length, 1);
    assert.strictEqual(result.diagnostics[0], reports[0]);
  } finally {
    wiring.elaborate.elaborate = elaborate;
  }
});

test("actual reads and call candidates cannot demand a Forms-refused producer", async () => {
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const constraints = wiring.infer.constraintsOf;
  const declared = wiring.decls.declaredSignatureOf;
  const resume = wiring.infer.resumeConstraintsOf;
  const reportForms = wiring.validate.formDiagnostics;
  try {
    for (const [producer, value] of [
      ["export declare const hidden = true;", "hidden"],
      ["export declare function hidden(value: boolean = true): boolean { return value; }", "hidden(true)"],
    ]) {
      const input = analysisInput(fixture, "sdk-minimal", `${producer}
export function read(): boolean { return ${value}; }
export function healthy(value: boolean): boolean { return !value; }`);
      const captured = captureSourceBarrier(input);
      assert.equal(captured.kind, "ok");
      const source = captured.value;
      const [denied, read, healthy] = source.modules.find(row => row.module.module === input.snapshot.entryPoint).module.tree.statements.nodes;
      const owner = denied.kind === "VariableStatement" ? denied.declarationList.declarations.nodes[0] : denied;
      const definition = owner.kind === "VariableDeclaration" ? owner.tsonic.declaration.definition : owner.tsonic.definition;
      let deniedGroup = null;
      let healthyGroups = 0;
      let denial = null;
      let actualReport = null;
      wiring.validate.formDiagnostics = (deps, site, unit) => {
        const result = reportForms(deps, site, unit);
        if (site.cut === denied) actualReport = result.value;
        return result;
      };
      wiring.infer.constraintsOf = (deps, group) => {
        const result = constraints(deps, group);
        if (group.bodies.includes(healthy.tsonic.body)) healthyGroups += 1;
        if (!group.bodies.includes(read.tsonic.body)) return result;
        assert.equal(result.kind, "paused");
        denial = result.requests.find(request => request.kind === "form-cut");
        assert.ok(denial);
        assert.equal(deps.structuralCuts.declaration(definition), true);
        assert.equal(denial.at.body, read.tsonic.body);
        assert.equal(typeof denial.at.node, "number");
        assert.equal(denial.definition, definition);
        assert.equal(result.requests.some(request => request.kind === "inferred-part" && request.part.definition === definition
          || request.kind === "declaredSignatureOf" && request.request.definition === definition), false);
        deniedGroup = group;
        return result;
      };
      wiring.decls.declaredSignatureOf = (deps, request, cuts) => {
        assert.notEqual(request.definition, definition, "a denied endpoint must not start");
        return declared(deps, request, cuts);
      };
      wiring.infer.resumeConstraintsOf = (deps, paused, answers) => {
        assert.notStrictEqual(paused.group, deniedGroup, "a denied demand cannot supply a fabricated answer");
        return resume(deps, paused, answers);
      };
      const typed = typeSourceBarrier(input, source, createAccount(input.limits.dataflow));
      assert.equal(typed.kind, "refused");
      assert.ok(denial);
      assert.equal(healthyGroups, 1);
      assert.equal(typed.diagnostics.length, 1);
      assert.ok(actualReport);
      assert.strictEqual(typed.diagnostics[0], actualReport.diagnostics[0]);
      assert.equal(typed.diagnostics[0].code.rendered, "TSONIC_SOURCE_FORM_UNSUPPORTED");
    }
  } finally {
    wiring.infer.constraintsOf = constraints;
    wiring.decls.declaredSignatureOf = declared;
    wiring.infer.resumeConstraintsOf = resume;
    wiring.validate.formDiagnostics = reportForms;
  }
});

test("enclosing typing stops before another root after the actual Query or Types owner exhausts", async () => {
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const { usedPublicationWork } = await import("../../packages/host/dist/ir-types/work.js");
  const input = analysisInput(fixture, "sdk-minimal", `export function first() { return 1; }
export function later(value: boolean): boolean { return !value; }`);
  const ample = captureSourceBarrier(input);
  assert.equal(ample.kind, "ok");
  const maximumWork = usedPublicationWork(ample.value.typeWork);
  const forms = wiring.validate.formDiagnostics;
  const constraints = wiring.infer.constraintsOf;
  const elaborate = wiring.elaborate.elaborate;
  try {
    for (const [maximumRecords, owner] of [[0, "query"], [7, "ir-types"]]) {
      const selected = { ...input, limits: { ...input.limits, query: { maximumRecords },
        instantiation: { ...input.limits.instantiation, maximumWork } } };
      const captured = captureSourceBarrier(selected);
      assert.equal(captured.kind, "ok");
      assert.equal(usedPublicationWork(captured.value.typeWork), maximumWork);
      let formsStarted = 0;
      let constraintsStarted = 0;
      wiring.validate.formDiagnostics = (...args) => {
        assert.notEqual(owner, "query", "the database stops before the first producer");
        formsStarted += 1;
        return forms(...args);
      };
      wiring.infer.constraintsOf = (deps, group) => {
        constraintsStarted += 1;
        assert.equal(owner, "ir-types");
        assert.equal(constraintsStarted, 1, "no next independent root after shared Types stops");
        assert.strictEqual(deps.typeWork, captured.value.typeWork);
        return constraints(deps, group);
      };
      wiring.elaborate.elaborate = () => assert.fail("shared exhaustion must not start elaboration");
      const stopped = typeSourceBarrier(selected, captured.value, createAccount(input.limits.dataflow));
      assert.equal(stopped.kind, "refused");
      assert.equal("value" in stopped, false);
      assert.deepEqual(stopped.diagnostics.map(row => row.source), [owner]);
      const actual = fixture.types.typePublicationRefusalOf(captured.value.typeWork);
      if (owner === "ir-types") {
        assert.equal(actual.kind, "refused");
        assert.strictEqual(stopped.diagnostics[0], actual.diagnostics[0]);
        assert.equal(stopped.diagnostics[0].arguments.some(row => row.kind === "number" && row.value === maximumWork), true);
        assert.equal(formsStarted, 0);
        assert.equal(constraintsStarted, 1);
      } else {
        assert.equal(actual, null);
        assert.equal(formsStarted, 0);
        assert.equal(constraintsStarted, 0);
      }
    }
  } finally {
    wiring.validate.formDiagnostics = forms;
    wiring.infer.constraintsOf = constraints;
    wiring.elaborate.elaborate = elaborate;
  }
});

test("the enclosing typed barrier retains the actual Types and Query completion stops for one selected endpoint", async () => {
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const { usedPublicationWork } = await import("../../packages/host/dist/ir-types/work.js");
  const input = analysisInput(fixture, "sdk-minimal", `export function first(value: boolean): boolean { return value; }
export function caller(value: boolean): boolean { return first(value); }
export function later(value: boolean): boolean { return !value; }`);
  const { signatureRequestData, typePublicationRefusalOf } = fixture.types;
  const declared = wiring.decls.declaredSignatureOf;
  const constraints = wiring.infer.constraintsOf;
  const elaborate = wiring.elaborate.elaborate;
  let prefix = null;
  let selectedRequest = null;
  try {
    wiring.decls.declaredSignatureOf = (deps, request, cuts) => {
      if (request.bindings.kind === "instantiated") {
        assert.equal(prefix, null);
        prefix = usedPublicationWork(deps.typeWork);
        selectedRequest = request;
      }
      return declared(deps, request, cuts);
    };
    const healthy = captureSourceBarrier(input);
    assert.equal(healthy.kind, "ok");
    assert.equal(typeSourceBarrier(input, healthy.value, createAccount(input.limits.dataflow)).kind, "ok");
    assert.ok(prefix > 0 && selectedRequest !== null);
    const selected = { ...input, limits: { ...input.limits, query: { maximumRecords: 9 },
      instantiation: { ...input.limits.instantiation, maximumWork: prefix } } };
    const captured = captureSourceBarrier(selected);
    assert.equal(captured.kind, "ok");
    const source = captured.value;
    const [first, caller] = source.modules.find(row => row.module.module === input.snapshot.entryPoint).module.tree.statements.nodes;
    assert.strictEqual(selectedRequest.definition, first.tsonic.definition);
    const groups = [];
    let producerStop = null;
    wiring.infer.constraintsOf = (deps, group) => {
      assert.equal(producerStop, null, "the next inference root must remain unread");
      groups.push(group);
      return constraints(deps, group);
    };
    wiring.decls.declaredSignatureOf = (deps, request, cuts) => {
      assert.equal(producerStop, null, "no later semantic endpoint or key may be demanded");
      const result = declared(deps, request, cuts);
      if (request.bindings.kind === "instantiated") {
        assert.deepEqual(request, selectedRequest);
        assert.equal(result.kind, "done");
        assert.equal(result.value.kind, "refused");
        producerStop = result.value;
      }
      return result;
    };
    wiring.elaborate.elaborate = () => assert.fail("no elaboration from an uncomputed group");
    const stopped = typeSourceBarrier(selected, source, createAccount(input.limits.dataflow));
    assert.equal(stopped.kind, "refused");
    assert.equal("value" in stopped, false);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].bodies.includes(caller.tsonic.body), true);
    assert.deepEqual(stopped.diagnostics.map(row => row.source), ["ir-types", "query"]);
    assert.strictEqual(typePublicationRefusalOf(source.typeWork), producerStop);
    assert.strictEqual(stopped.diagnostics[0], producerStop.diagnostics[0]);
    assert.deepEqual(stopped.diagnostics[1].evidence, ["query.maximumRecords", ...stopped.diagnostics[0].evidence.slice(1)]);
    assert.equal(stopped.diagnostics[1].arguments.some(row => row.kind === "number" && row.value === selected.limits.query.maximumRecords), true);
    const declarations = { modules: source.modules, types: source.types, typeWork: source.typeWork,
      typeExpansion: selected.limits.instantiation.typeExpansion };
    const { cuts } = checkedInputs.checkedSourceViews(source.modules);
    const database = query.createDatabase(declarations, { maximumRecords: 2 }, () => assert.fail("a stopped endpoint cannot recurse"), "off");
    const endpoint = { name: "declaredSignatureOf", keyData: signatureRequestData, answerPolicy: { kind: "refusal-only" },
      compute: ({ inputs }, request) => {
        const result = declared(inputs, request, cuts);
        assert.equal(result.kind, "done");
        assert.strictEqual(result.value, producerStop);
        return result.value;
      } };
    const repeated = database.run(endpoint, selectedRequest);
    assert.equal(database.isRecordLimitRefusal(repeated), true);
    const [originalTypes, originalQuery] = database.diagnostics();
    assert.strictEqual(originalTypes, producerStop.diagnostics[0]);
    assert.strictEqual(originalQuery, repeated.diagnostics[0]);
    assert.deepEqual(database.errorOf({ request: { query: endpoint.name, key: signatureRequestData(selectedRequest) },
      position: { kind: "result" } }), { kind: "uncomputed" });
  } finally {
    wiring.decls.declaredSignatureOf = declared;
    wiring.infer.constraintsOf = constraints;
    wiring.elaborate.elaborate = elaborate;
  }
});

test("a cut executable declaration leaves its same-body sibling roles eligible", async () => {
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const elaborate = wiring.elaborate.elaborate;
  try {
    for (const [returned, unavailable] of [["allowed", false], ["missing", true]]) {
      const input = analysisInput(fixture, "sdk-minimal", `export function live(flag: boolean): boolean {
  declare const denied = true;
  const allowed = !flag;
  return ${returned};
}`);
      const capture = captureSourceBarrier(input);
      assert.equal(capture.kind, "ok");
      const ready = capture.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
      const [callable] = ready.tree.statements.nodes;
      const [denied, allowed] = callable.body.statements.nodes;
      const deniedValue = denied.declarationList.declarations.nodes[0].initializer;
      const allowedValue = allowed.declarationList.declarations.nodes[0].initializer;
      const actual = allowedValue.tsonic;
      let visits = 0;
      Object.defineProperty(deniedValue, "tsonic", { get() { assert.fail("a cut initializer has no operand demand"); } });
      Object.defineProperty(allowedValue, "tsonic", { get() { visits += 1; return actual; } });
      let attempted = null;
      wiring.elaborate.elaborate = (deps, inputs) => {
        const result = elaborate(deps, inputs);
        if (inputs.body.body === callable.tsonic.body) attempted = result;
        return result;
      };
      const typed = typeSourceBarrier(input, capture.value, createAccount(input.limits.dataflow));
      assert.equal(typed.kind, "refused");
      assert.equal("value" in typed, false);
      assert.ok(visits > 0, "the same checked executable's independently ready unary is visited");
      const forms = typed.diagnostics.find(row => row.source === "validate");
      assert.equal(forms.code.rendered, "TSONIC_SOURCE_FORM_UNSUPPORTED");
      const remaining = typed.diagnostics.filter(row => row !== forms);
      if (unavailable) {
        const original = ready.checkerDiagnostics.find(row => row.code.number === 2304);
        assert.ok(original);
        assert.equal(remaining.length, 1);
        assert.strictEqual(remaining[0], original);
      } else {
        assert.deepEqual(remaining, []);
        assert.equal(attempted?.kind, "no-result");
        assert.equal(attempted.causes.some(cause => cause.kind === "form" && cause.cut.diagnostics[0] === forms), true);
      }
    }
  } finally {
    wiring.elaborate.elaborate = elaborate;
  }
});

test("a completed Forms report cannot cut a copied or foreign checked occurrence", async () => {
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export declare function hidden(): boolean { return true; }");
  const capture = captureSourceBarrier(input);
  assert.equal(capture.kind, "ok");
  const check = wiring.validate.formDiagnostics;
  const groups = wiring.infer.groupsOf;
  try {
    wiring.infer.groupsOf = () => assert.fail("no typing after a crossed Forms position");
    wiring.validate.formDiagnostics = (deps, site, unit) => {
      const result = check(deps, site, unit);
      const cut = result.value;
      assert.equal(cut.node.kind, "FunctionDeclaration");
      assert.equal(site.cut === cut.node, true, "the detector's actual original cut");
      return { ...result, value: { ...cut, node: { ...cut.node } } };
    };
    assert.throws(() => typeSourceBarrier(input, capture.value, createAccount(input.limits.dataflow)),
      error => error.cause?.owner === "pipeline" && error.message === "A Forms cut requires its actual checked syntax in the qualified module.");
  } finally {
    wiring.validate.formDiagnostics = check;
    wiring.infer.groupsOf = groups;
  }
});

test("actual import syntax retains qualified B1 occurrences without inventing a default clause binding", async () => {
  const { modules } = fixture.checkedModulesOf({
    "main.ts": "import defaultValue, { value as renamed, 'value' as quoted } from './leaf.js'; import * as space from './leaf.js'; import './leaf.js';",
    "leaf.ts": "export function value(input: boolean): boolean { return input; } export { value as default };",
  });
  const main = modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const { elaborateImport } = await import("../../packages/host/dist/elaborate/imports.js");
  for (const statement of main.tree.statements.nodes) {
    const typed = elaborateImport(statement);
    assert.equal(typed.id, statement.id);
    assert.equal(typed.moduleSpecifier.tsonic.target, statement.tsonic.target.value);
    assert.equal(typed.tsonic.target, statement.tsonic.target.value);
    assert.throws(() => elaborateImport({ ...statement, tsonic: { ...statement.tsonic,
      target: { kind: "unavailable", reason: "not-provided", causes: [] } } }), /actual checked module target/);
    const clause = statement.importClause;
    if (clause === null) assert.equal(typed.importClause, null);
    else if (clause.name === null) assert.equal(typed.importClause.tsonic, null);
    else {
      assert.deepEqual(typed.importClause.tsonic.binding, clause.tsonic.bindings[0]);
      const cloned = structuredClone(statement);
      assert.equal(elaborateImport(cloned).importClause.name.text, clause.name.text,
        "equal qualified occurrences are not required to share an allocated reference object");
      assert.throws(() => elaborateImport({ ...statement, importClause: { ...clause,
        tsonic: { ...clause.tsonic, bindings: [] } } }), /checked binding occurrence/);
      assert.throws(() => elaborateImport({ ...statement, importClause: { ...clause, name: { ...clause.name,
        tsonic: { ...clause.name.tsonic, binding: { ...clause.tsonic.bindings[0],
          value: { ...clause.tsonic.bindings[0].value, node: clause.id + 1 } } } } } }), /checked binding occurrence/);
    }
    const named = clause?.namedBindings;
    if (named?.kind === "NamedImports") {
      const selected = typed.importClause.namedBindings.elements.nodes;
      assert.deepEqual(selected.map(node => node.tsonic.binding), named.elements.nodes.map(node => node.tsonic.bindings[0]));
      const first = named.elements.nodes[0];
      assert.throws(() => elaborateImport({ ...statement, importClause: { ...clause, namedBindings: { ...named,
        elements: { ...named.elements, nodes: [{ ...first, tsonic: { ...first.tsonic, bindings: [] } }] } } } }), /one actual checked binding occurrence/);
      for (const selected of named.elements.nodes) {
        const property = selected.propertyName;
        if (property === null) continue;
        const bad = { ...selected, propertyName: { ...property, tsonic: { ...property.tsonic,
          binding: { ...selected.tsonic.bindings[0], value: { ...selected.tsonic.bindings[0].value, node: selected.id + 1 } } } } };
        assert.throws(() => elaborateImport({ ...statement, importClause: { ...clause,
          namedBindings: { ...named, elements: { ...named.elements, nodes: [bad] } } } }), /checked binding occurrence/);
      }
    } else if (named?.kind === "NamespaceImport") {
      assert.deepEqual(typed.importClause.namedBindings.tsonic.binding, named.tsonic.bindings[0]);
      assert.throws(() => elaborateImport({ ...statement, importClause: { ...clause,
        namedBindings: { ...named, tsonic: { ...named.tsonic, bindings: [] } } } }), /one actual checked binding occurrence/);
      assert.throws(() => elaborateImport({ ...statement, importClause: { ...clause, namedBindings: { ...named,
        name: { ...named.name, tsonic: { ...named.name.tsonic,
          binding: { kind: "body", value: { body: main.bodies[0].body, node: named.id } } } } } } }), /checked binding occurrence/);
    }
  }
});

test("actual named, quoted, local and namespace exports retain checked B1 names without runtime values", async () => {
  const { modules } = fixture.checkedModulesOf({
    "main.ts": "import { value } from './leaf.js'; export { value }; export { value as renamed, 'value' as 'quoted' } from './leaf.js'; export * as space from './leaf.js'; export * from './leaf.js';",
    "leaf.ts": "export function value(input: boolean): boolean { return input; }",
  });
  const main = modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const { elaborateExport } = await import("../../packages/host/dist/elaborate/imports.js");
  const statements = main.tree.statements.nodes.filter(node => node.kind === "ExportDeclaration");
  assert.equal(statements.length, 4);
  for (const statement of statements) {
    const typed = elaborateExport(statement);
    assert.equal(typed.id, statement.id);
    assert.equal(typed.tsonic.target, statement.tsonic.target.value);
    assert.equal(typed.moduleSpecifier === null, statement.moduleSpecifier === null);
    assert.throws(() => elaborateExport({ ...statement, tsonic: { ...statement.tsonic,
      target: { kind: "unavailable", reason: "not-provided", causes: [] } } }), /actual checked module target/u);
    if (statement.moduleSpecifier !== null)
      assert.throws(() => elaborateExport({ ...statement, tsonic: { ...statement.tsonic,
        target: { kind: "available", value: null } } }), /present exactly/u);
    const clause = statement.exportClause;
    if (clause === null) assert.equal(typed.exportClause, null);
    else if (clause.kind === "NamespaceExport") {
      assert.deepEqual(typed.exportClause.tsonic, { definition: clause.tsonic.definition, binding: clause.tsonic.binding });
      assert.equal(typed.exportClause.name.tsonic.role, "declaration-name");
      assert.throws(() => elaborateExport({ ...statement, exportClause: { ...clause, name: { ...clause.name,
        tsonic: { ...clause.name.tsonic, declaration: { kind: "definition", definition: main.tree.tsonic.definition } } } } }),
      /genuine checked same-node declaration/u);
    } else {
      for (const [index, original] of clause.elements.nodes.entries()) {
        const selected = typed.exportClause.elements.nodes[index];
        assert.equal(selected.tsonic.binding, original.tsonic.binding);
        assert.equal(selected.name.tsonic.binding, original.tsonic.binding);
        for (const field of ["name", "propertyName"]) {
          const name = original[field];
          if (name === null) continue;
          assert.equal(selected[field].id, name.id);
          const foreign = { ...original.tsonic.binding,
            value: { ...original.tsonic.binding.value, node: original.id + 1 } };
          const changed = { ...original, [field]: { ...name, tsonic: { ...name.tsonic, binding: foreign } } };
          assert.throws(() => elaborateExport({ ...statement, exportClause: { ...clause,
            elements: { ...clause.elements, nodes: [changed] } } }), /checked binding occurrence/u);
        }
      }
    }
  }
});

test("real bodyless call, method, construct and index formals retain definitions without execution locals", async () => {
  const program = ready('export function value(argument: boolean): boolean { return argument; } interface Callable { (value: number): number; method(value: boolean): boolean; new(value: string): Callable; [key: number]: number; [""]: number; [tag]: string; } declare const tag: symbol;');
  const { types } = fixture;
  const records = new Map();
  for (const group of program.inputs.groups) {
    const answer = program.database.run(program.queries.solutionOf, group.id);
    assert.equal(answer.kind, "completed");
    for (const set of answer.value.constraints.constraints) records.set(set.body, { constraints: set, solution: answer.value.solution });
  }
  const bodies = new Map();
  const deps = { cuts: program.domain.sources.cuts, types: program.interner, typeWork: program.base.declarations.typeWork, rules: program.inputs.inference.rules, nodeOf: program.domain.nodeOf, bindingOf: program.inputs.inference.bindingOf,
    nominalOf: program.scopes.nominalOf, bindingScopeOf: program.inputs.inference.bindingScopeOf,
    typeOf: type => types.readType(program.interner, type), signatureOf: signature => types.readSignature(program.interner, signature),
    staticStorageOf: () => null,
    enumValueTypeOf: () => assert.fail("This fixture has no enum value occurrence."),
    checkerDiagnosticsOf: () => program.checked.checkerDiagnostics };
  const orderedBodies = [...program.checked.bodies.filter(body => body.root.kind !== "SourceFile"),
    ...program.checked.bodies.filter(body => body.root.kind === "SourceFile")];
  for (const source of orderedBodies) {
    const record = records.get(source.body);
    const answer = wiring.elaborate.elaborate(deps, { instance: { body: source.body, bindings: { kind: "parametric" } },
      scope: program.descriptions.get(source.owner).generics, body: source, layoutAlias: null, typing: readyTyping(record.constraints, record.solution),
      nestedBodies: source.nestedBodies.map(body => bodies.get(body)), initializers: [] });
    assert.equal(answer.kind, "ok");
    bodies.set(source.body, answer.value);
  }
  const module = [...bodies.values()].find(body => body.root.kind === "SourceFile");
  const publication = { module: program.checked.module, tree: { kind: "ready-root", root: module.root },
    bodies: program.checked.bodies.map(body => bodies.get(body.body)) };
  const { kind: role, node: declaration } = module.root.statements.nodes[1];
  assert.equal(role, "ready-statement");
  assert.equal(declaration.kind, "InterfaceDeclaration");
  assert.deepEqual(declaration.members.nodes.slice(0, 4).map(member => member.parameters.nodes[0].tsonic.local), [null, null, null, null]);
  assert.deepEqual(declaration.members.nodes.slice(0, 4).map(member => member.parameters.nodes[0].tsonic.passing), ["by-value", "by-value", "by-value", null]);
  const tir = await import("../../packages/host/dist/ir-tir/index.js");
  const verifyBody = await tirFixtureBodyVerifier(tir.verifyTir);
  const verifyChapter = await tirFixtureVerifier(tir.verifyTirModule);
  const bodyOf = instance => instance.bindings.kind === "parametric" ? bodies.get(instance.body) ?? null : null;
  const verifier = { source: program.checked, module: publication, types: types.viewTypes(program.interner),
    declarationOf: program.declarationOf, declarationSourceOf: program.domain.declarationSourceOf, nominalOf: program.scopes.nominalOf,
    staticStorageOf: () => null,
    memberTableOf: () => null, bodyOf,
    nodeOf: program.domain.nodeOf, localExists: program.domain.localExists, diagnostics: program.checked.checkerDiagnostics,
    layoutAliasOf: null,
    bindingScopesOf: visitBindingScopes(publication, bodyOf, owner => program.descriptions.get(owner).generics) };
  assert.equal(verifyChapter(verifier, publication).length, 0);
  assert.equal(verifyBody(verifier, module).length, 0);
  const decoded = tir.parseTir(tir.printTir(module));
  assert.equal(decoded.kind, "parsed");
  assert.deepEqual(decoded.value.root.statements.nodes[1].node.members.nodes.slice(0, 4).map(member => member.parameters.nodes[0].tsonic.local), [null, null, null, null]);
  for (let index = 0; index < 4; index++) {
    const parameter = declaration.members.nodes[index].parameters.nodes[0];
    const local = parameter.tsonic.local;
    parameter.tsonic.local = { body: module.body, local: 0 };
    assert.equal(verifyBody(verifier, module).some(violation => violation.rule === "parameter-order"), true);
    parameter.tsonic.local = local;
  }
  const key = declaration.members.nodes[3].parameters.nodes[0];
  key.tsonic.passing = "by-value";
  assert.equal(verifyBody(verifier, module).some(violation => violation.rule === "parameter-order"), true);
  key.tsonic.passing = null;
  const empty = declaration.members.nodes[4].name;
  const unresolved = declaration.members.nodes[5].name;
  assert.equal(empty.tsonic.kind, "declaration");
  assert.deepEqual(empty.tsonic.key, { kind: "available", value: { kind: "text", value: "" } });
  assert.equal(unresolved.tsonic.key.kind, "unavailable");
  assert.equal(empty.expression.tsonic.role, "declaration-name-expression");
  assert.equal(unresolved.expression.tsonic.role, "declaration-name-expression");
  assert.equal("type" in unresolved.expression.tsonic, false);
  assert.deepEqual(decoded.value.root.statements.nodes[1].node.members.nodes[5].name.tsonic, unresolved.tsonic);
  const original = unresolved.tsonic;
  unresolved.tsonic = { kind: "declaration", key: { kind: "available", value: { kind: "text", value: "fabricated" } } };
  assert.equal(verifyBody(verifier, module).some(violation => violation.rule === "occurrence-role"), true);
  unresolved.tsonic = original;
  const executing = [...bodies.values()].find(body => body.root.kind === "Block");
  const value = executing.root.statements.nodes[0].expression;
  const selected = value.tsonic;
  value.tsonic = { role: "declaration-name-expression" };
  assert.equal(verifyBody(verifier, executing).some(violation => violation.rule === "occurrence-role"), true);
  value.tsonic = selected;
  empty.expression.tsonic = selected;
  assert.equal(verifyBody(verifier, module).some(violation => violation.rule === "occurrence-role"), true);
  empty.expression.tsonic = { role: "declaration-name-expression" };
});

for (const annotation of ["boolean", null]) test(`real ${annotation ?? "inferred"} local retains its qualified declaration and separate initializer`, () => {
  const program = ready(`export function local(): boolean { const value${annotation === null ? "" : `: ${annotation}`} = true; return value; }`);
  const { types } = fixture;
  const records = new Map();
  for (const group of program.inputs.groups) {
    const answer = program.database.run(program.queries.solutionOf, group.id);
    assert.equal(answer.kind, "completed");
    assert.equal(answer.diagnostics.length, 0);
    for (const set of answer.value.constraints.constraints) records.set(set.body, { constraints: set, solution: answer.value.solution });
  }
  const deps = { cuts: program.domain.sources.cuts, types: program.interner, typeWork: program.base.declarations.typeWork, rules: program.inputs.inference.rules, nodeOf: program.domain.nodeOf, bindingOf: program.inputs.inference.bindingOf,
    nominalOf: program.scopes.nominalOf, bindingScopeOf: program.inputs.inference.bindingScopeOf,
    typeOf: type => types.readType(program.interner, type), signatureOf: signature => types.readSignature(program.interner, signature),
    staticStorageOf: () => null,
    enumValueTypeOf: () => assert.fail("This fixture has no enum value occurrence."),
    checkerDiagnosticsOf: () => program.checked.checkerDiagnostics };
  const inputOf = (body, nestedBodies) => ({ instance: { body: body.body, bindings: { kind: "parametric" } },
    scope: program.descriptions.get(body.owner).generics, body, layoutAlias: null,
    typing: readyTyping(records.get(body.body).constraints, records.get(body.body).solution), nestedBodies, initializers: [] });
  const initializer = program.checked.bodies.find(body => body.root.kind === "TrueKeyword");
  const initialized = wiring.elaborate.elaborate(deps, inputOf(initializer, []));
  assert.equal(initialized.kind, "ok");
  const source = program.checked.bodies.find(body => body.root.kind === "Block");
  const input = inputOf(source, [initialized.value]);
  const result = wiring.elaborate.elaborate(deps, input);
  assert.equal(result.kind, "ok");
  const declaration = result.value.root.statements.nodes[0].declarationList.declarations.nodes[0];
  const local = result.value.locals[0];
  assert.equal(declaration.initializer === initialized.value.root, true, "the actual child syntax has one semantic owner");
  assert.equal(declaration.tsonic.initializer, initializer.body);
  assert.deepEqual(declaration.tsonic.declaration, { kind: "local", local: { body: source.body, local: local.id } });
  assert.equal(local.storage, initialized.value.completion);
  assert.equal(local.declaration.kind, "item");
  assert.equal(local.declaration.value.owner, initializer.owner);
  assert.equal(local.declaration.value.node, declaration.id);
  assert.throws(() => wiring.elaborate.elaborate(deps, { ...input, nestedBodies: [] }), /actual direct body inventory/u);
  assert.throws(() => wiring.elaborate.elaborate(deps, { ...input, nestedBodies: [initialized.value, initialized.value] }), /unique completed body/u);
  assert.throws(() => wiring.elaborate.elaborate(deps, { ...input, nestedBodies: [{ ...initialized.value,
    bindings: { kind: "instantiated", bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } } }] }), /same actual bindings/u);
  assert.throws(() => wiring.elaborate.elaborate(deps, { ...input, nestedBodies: [{ ...initialized.value, owner: source.owner }] }), /actual declaration, expression and execution result/u);
  assert.throws(() => wiring.elaborate.elaborate(deps, { ...input, nestedBodies: [{ ...initialized.value,
    root: { ...initialized.value.root, parent: null } }] }), /actual declaration, expression and execution result/u);
  const checkedLocal = source.locals[0];
  const original = checkedLocal.declaration;
  checkedLocal.declaration = { kind: "body", value: { body: source.body, node: declaration.id } };
  assert.throws(() => wiring.elaborate.elaborate(deps, input), /actual checked declaration of a non-parameter local/u);
  checkedLocal.declaration = original;
  assert.equal(wiring.elaborate.elaborate(deps, input).kind, "ok");
});

function ready(source, scope = "post-forms owner") {
  const { checked, interner, typeWork, snapshot } = fixture.checkedModuleOf(source);
  const domain = checkedDomain(checked, fixture.hir);
  const items = new Map(checked.items.map(item => [item.definition, domain.nodes[item.node]]));
  items.set(checked.tree.tsonic.definition, checked.tree);
  const scopes = fixture.hir.deriveDeclarationScopes(checked, domain.nodes);
  assert.deepEqual(fixture.verifyChecked(checked, interner, [], scopes.bindingScopeOf), []);
  const formSites = scope === "source"
    ? wiring.validate.indexFormDiagnostics({ role: "source", scopeOf: domain.sources.formScopeOf }, checked) : [];
  const sources = checkedInputs.checkedSourceViews([{ module: checked, nodes: domain.nodes }], undefined, new Map([[checked.module, formSites]]));
  const descriptions = new Map(wiring.decls.describeDefinitions({ module: checked, nodes: domain.nodes }, scopes, []).definitions
    .map(description => [description.definition, description]));
  const declarations = { modules: [{ module: checked, nodes: domain.nodes }], types: interner, typeWork, typeExpansion: EXPANSION };
  const rulesDeps = { libraries: { sources: [], sourceRoles: [], guarantees: [] }, types: interner,
    selectedNativeFacts: snapshot.nativeFacts, typeExpansion: EXPANSION };
  const inference = inferStep.inferDepsOf({ typeWork, structuralCuts: sources.structuralCuts, cuts: sources.cuts, checkedNodeOf: sources.nodeOf, rules: rulesDeps,
    bindingScopeOf: definition => descriptions.get(definition)?.generics ?? assert.fail("actual checked scope required"),
    hirBody: body => domain.bodyOf.get(body) ?? assert.fail("actual checked body"),
    checkerDiagnosticsOf: module => module === checked.module ? checked.checkerDiagnostics : assert.fail("actual diagnostic module"),
    itemOf: definition => items.get(definition) ?? assert.fail("actual checked declaration"), bindings: [checked.bindings], ...fixture.hir.createModuleBindingViews([checked.bindings]), limits: LIMITS, graph: GRAPH });
  const grouped = wiring.infer.groupsOf(inference, checked.bodies.filter(body => !sources.structuralCuts.body(body.body)).map(body => body.body));
  assert.equal(grouped.kind, "ok");
  const types = fixture.types.viewTypes(interner);
  const declarationOf = definition => {
    const node = items.get(definition);
    const description = descriptions.get(definition);
    return node === undefined || description === undefined ? null : { scope: description.generics,
      parameterCount: "parameters" in node && "nodes" in node.parameters ? node.parameters.nodes.length : null,
      endpoints: "signatures" in node.tsonic ? node.tsonic.signatures : [] };
  };
  const verification = (group, constraints, result) => ({
    types, declarationOf, nominalOf: scopes.nominalOf, nodeExists: reference => domain.nodeOf(reference) !== null,
    localExists: domain.localExists,
    bindingScopes: irInfer.inferenceBindingSites({ group, constraints: constraints.constraints, solution: result === null ? null : result.solution }).map(binding => {
      const site = binding.site;
      const source = site.kind === "body" ? site.body : site.kind === "constraint" || site.kind === "proof" ? site.constraint.body
        : assert.fail("the selected case has no unrepresented binding occurrence owner");
      return descriptions.get(binding.definition ?? domain.bodyOf.get(source).owner).generics;
    }),
  });
  const base = { declarations, instantiation: { maximumWork: 65536, maximumCreatedRecords: 65536 } };
  const forms = registration.formDiagnosticsQuery(base, site => formSites.includes(site));
  const inputs = { inference, groups: grouped.value, sources, forms, projectForms: new Map(), groupForms: function* (group) {
    for (const body of group.bodies) for (const site of formSites) {
      const authored = domain.bodyOf.get(body);
      if (site.scope.kind === "execution" ? site.scope.body === body : site.scope.kind === "module-header" && authored.root === checked.tree)
        yield { kind: "forms-prerequisite", site, source: { kind: "body", value: { body, node: authored.root.id } } };
    }
  }, bindingScopeOf: scopes.bindingScopeOf, verification };
  const { queries } = registration.createSourceSemanticQueries(base, inputs);
  const noCycleInThisCase = () => assert.fail("these ready-group/declared-signature cases must not close an active key");
  const database = query.createDatabase(base, { maximumRecords: 65536 }, noCycleInThisCase, "recorded");
  const node = checked.tree.statements.nodes[0];
  const endpoint = node.tsonic.signatures.find(endpoint => endpoint.role === "api-body");
  assert.equal(endpoint !== undefined, true);
  const signature = { definition: endpoint.declaration, endpoint: endpoint.role, ordinal: 0, bindings: { kind: "parametric" } };
  return { checked, interner, snapshot, domain, scopes, descriptions, base, inputs, queries, database, signature, verification, declarationOf, rulesDeps };
}

test("two cold dependent body requests report one exact Forms detector without reading the denied endpoint or next operand", () => {
  const actual = ready(`export function first(flag: boolean): boolean { return hidden(flag); }
export function later(flag: boolean): boolean { return hidden(flag); }
export declare function hidden(flag: boolean): boolean { return flag; }
export declare function unopened(flag: boolean): boolean { return flag; }`, "source");
  const [first, later, hidden, unopened] = actual.checked.tree.statements.nodes;
  const original = wiring.validate.formDiagnostics;
  const reports = [];
  try {
    for (const caller of [first, later]) {
      const call = caller.body.statements.nodes[0].expression;
      Object.defineProperty(call, "arguments", { get: () => assert.fail("a blocked callee cannot pull its next authored operand") });
    }
    for (const owner of [hidden, unopened])
      Object.defineProperty(owner.tsonic, "signatures", { get: () => assert.fail("a denied checked endpoint cannot be read") });
    wiring.validate.formDiagnostics = (deps, site, unit) => {
      const result = original(deps, site, unit);
      assert.strictEqual(site.cut, hidden);
      assert.deepEqual(unit.key, [actual.checked.module, site.report.id]);
      reports.push(result.value);
      return result;
    };
    for (const caller of [first, later]) {
      const group = actual.inputs.groups.find(group => group.bodies.includes(caller.tsonic.body));
      const result = actual.database.run(actual.queries.solutionOf, group.id);
      assert.equal(result.kind, "refused");
      assert.equal("value" in result, false);
      assert.equal(result.diagnostics.length, 1);
      assert.strictEqual(result.diagnostics[0], reports[0].diagnostics[0]);
    }
    assert.equal(reports.length, 1);
    assert.deepEqual(actual.database.diagnostics(), reports[0].diagnostics);
    const completed = actual.database.errorOf(reports[0].report);
    assert.equal(completed.kind, "completed");
    assert.strictEqual(completed.error, reports[0].error);
  } finally {
    wiring.validate.formDiagnostics = original;
  }
});

test("a Forms producer rejects a crossed detector before reading the report payload", () => {
  const actual = ready(`export function healthy(flag: boolean): boolean { return flag; }
export declare function denied(flag: boolean): boolean { return flag; }`, "source");
  const sites = wiring.validate.indexFormDiagnostics({ role: "source", scopeOf: actual.domain.sources.formScopeOf }, actual.checked);
  const [site] = sites;
  assert.equal(sites.length, 1);
  const deps = { owns: offered => offered.module === site.module && offered.report.id === site.report.id && offered === site };
  const unit = { query: "formDiagnostics", key: [site.module, site.report.id] };
  const crossed = { module: site.module, report: { id: site.report.id,
    get origin() { return assert.fail("a crossed detector has no readable report origin"); } },
    get cut() { return assert.fail("a crossed detector has no readable cut payload"); },
    get kind() { return assert.fail("a crossed detector has no readable diagnostic role"); } };
  assert.throws(() => wiring.validate.formDiagnostics(deps, crossed, unit), /actual qualified detector/u);
  const accepted = wiring.validate.formDiagnostics(deps, site, unit);
  assert.equal(accepted.kind, "ok");
  assert.strictEqual(accepted.value.node, site.cut);
  assert.deepEqual(accepted.value.report.request, unit);
  assert.strictEqual(accepted.value.diagnostics[0].site.origin, site.report.origin);
});

for (const [mode, operand, extra] of [
  ["clean", "flag", ""],
  ["unrelated checker error", "flag", "\nexport function other(flag: boolean): boolean { return missingElsewhere; }"],
  ["nested checked call", "helper(flag)", "\nfunction helper(flag: boolean): boolean { return flag; }"],
]) test(`a checked call through an uncut alias stops at the denied actual candidate before semantic arguments: ${mode}`, () => {
  const actual = ready(`export function wanted(flag: boolean): boolean { return selected(${operand}); }
const selected = hidden;
export declare function hidden(value: boolean): boolean;${extra}`, "source");
  const [caller, alias, hidden, other] = actual.checked.tree.statements.nodes;
  const call = caller.body.statements.nodes[0].expression;
  const body = actual.domain.bodyOf.get(caller.tsonic.body);
  const selected = call.expression.tsonic.resolution;
  const aliasDefinition = alias.declarationList.declarations.nodes[0].tsonic.declaration.definition;
  assert.deepEqual(selected, { kind: "declarations", definitions: [aliasDefinition] });
  assert.equal(actual.inputs.sources.structuralCuts.declaration(aliasDefinition), false);
  const group = actual.inputs.groups.find(group => group.bodies.includes(body.body));
  assert.deepEqual(actual.checked.checkerDiagnostics.map(diagnostic => diagnostic.code.number), mode === "unrelated checker error" ? [2304] : []);
  if (mode === "unrelated checker error") {
    assert.equal(group.bodies.includes(other.tsonic.body), false);
    const otherUse = other.body.statements.nodes[0].expression;
    const otherRead = otherUse.tsonic.value.views.read;
    assert.equal(otherRead.kind, "unavailable");
    assert.equal(otherRead.reason, "checker-error");
    assert.equal(otherRead.causes[0].diagnostic.diagnostic.index, 0);
    actual.inputs.inference.checkerDiagnosticsOf = () => assert.fail("the unrelated body has no demanded checker witness");
  }
  if (mode === "nested checked call") {
    const nested = call.arguments.nodes[0];
    assert.equal(nested.tsonic.application.kind, "available");
    const nestedList = nested.tsonic.application.value.candidates;
    assert.equal(nestedList.kind, "available");
    const [nestedCandidate] = body.candidateLists[nestedList.value].candidates;
    assert.equal(nestedCandidate.declaration, other.tsonic.definition);
    Object.defineProperty(nestedCandidate, "declaration", { get: () => assert.fail("checker-only argument evidence cannot discover nested candidates") });
    Object.defineProperty(nested, "arguments", { get: () => assert.fail("nested checker evidence has its own verified argument reference") });
  }
  assert.equal(call.tsonic.application.kind, "available");
  const selectedList = call.tsonic.application.value.candidates;
  assert.equal(selectedList.kind, "available");
  const [candidate] = body.candidateLists[selectedList.value].candidates;
  assert.equal(candidate.declaration, hidden.tsonic.definition);
  assert.equal(actual.inputs.sources.structuralCuts.declaration(candidate.declaration), true);
  Object.defineProperty(call, "arguments", { get: () => assert.fail("the denied candidate's next argument must stay unread") });
  Object.defineProperty(candidate, "bindings", { get: () => assert.fail("the denied candidate's bindings must stay unread") });
  Object.defineProperty(hidden.tsonic, "signatures", { get: () => assert.fail("the denied candidate's endpoint must stay unread") });
  const report = wiring.validate.formDiagnostics;
  let original;
  try {
    wiring.validate.formDiagnostics = (deps, site, unit) => {
      assert.equal(site.cut === hidden, true, "the alias candidate's actual denied declaration");
      const result = report(deps, site, unit);
      [original] = result.diagnostics;
      return result;
    };
    const result = actual.database.run(actual.queries.solutionOf, group.id);
    assert.equal(result.kind, "refused");
    assert.equal("value" in result, false);
    assert.ok(original);
    assert.equal(result.diagnostics.length, 1);
    assert.strictEqual(result.diagnostics[0], original);
  } finally {
    wiring.validate.formDiagnostics = report;
  }
});

test("the actual original checker argument witness has priority over a candidate-only Forms cut", () => {
  const actual = ready(`export function wanted(flag: boolean): boolean { return selected(missing); }
const selected = hidden;
export declare function hidden(value: boolean): boolean;`, "source");
  const [caller, , hidden] = actual.checked.tree.statements.nodes;
  const call = caller.body.statements.nodes[0].expression;
  const body = actual.domain.bodyOf.get(caller.tsonic.body);
  assert.equal(call.tsonic.application.kind, "available");
  assert.equal(call.tsonic.application.value.resolvedSignature.kind, "available");
  const argument = call.arguments.nodes[0];
  const [argumentRole] = call.tsonic.application.value.arguments;
  assert.deepEqual(argumentRole, { kind: "value", expression: argument.id });
  const reference = { kind: "body", value: { body: body.body, node: argumentRole.expression } };
  assert.equal(actual.inputs.sources.nodeOf(reference) === argument, true);
  const read = argument.tsonic.value.views.read;
  assert.equal(read.kind, "unavailable");
  assert.equal(read.reason, "checker-error");
  assert.deepEqual(read.causes, [{ kind: "diagnostic", diagnostic: { kind: "checker",
    diagnostic: { module: actual.checked.module, index: 0 } } }]);
  const selected = call.tsonic.application.value.candidates;
  assert.equal(selected.kind, "available");
  const [candidate] = body.candidateLists[selected.value].candidates;
  assert.equal(candidate.declaration, hidden.tsonic.definition);
  assert.equal(actual.inputs.sources.structuralCuts.declaration(candidate.declaration), true);
  Object.defineProperty(call, "arguments", { get: () => assert.fail("checker evidence must use the verified argument reference") });
  Object.defineProperty(candidate, "bindings", { get: () => assert.fail("the checker witness must precede candidate bindings") });
  Object.defineProperty(hidden.tsonic, "signatures", { get: () => assert.fail("the checker witness must precede candidate endpoints") });
  const report = wiring.validate.formDiagnostics;
  try {
    wiring.validate.formDiagnostics = () => assert.fail("the original checker refusal does not demand the Forms producer");
    const group = actual.inputs.groups.find(group => group.bodies.includes(body.body));
    const result = actual.database.run(actual.queries.solutionOf, group.id);
    assert.equal(result.kind, "refused");
    assert.equal("value" in result, false);
    assert.deepEqual(result.diagnostics.map(diagnostic => diagnostic.code.number), [2304]);
    assert.strictEqual(result.diagnostics[0], actual.checked.checkerDiagnostics[0]);
  } finally {
    wiring.validate.formDiagnostics = report;
  }
});

test("Forms indexes a grouped module declaration header separately from a local execution role", () => {
  const actual = ready(`export function healthy(flag: boolean): boolean {
  declare const local = true;
  return flag;
}
export declare const first = true, second = false;`, "source");
  const [callable, top] = actual.checked.tree.statements.nodes;
  const [local] = callable.body.statements.nodes;
  const sites = wiring.validate.indexFormDiagnostics({ role: "source", scopeOf: actual.domain.sources.formScopeOf }, actual.checked);
  assert.equal(sites.length, 2);
  const [execution, header] = sites;
  assert.equal(execution.cut === local, true);
  assert.equal(execution.scope.kind, "execution");
  assert.equal(execution.scope.body, callable.tsonic.body);
  assert.equal(execution.scope.root === callable.body, true);
  assert.equal(header.cut === top, true);
  assert.equal(header.scope.kind, "declaration-header");
  assert.deepEqual(header.scope.declaration, { owner: actual.checked.tree.tsonic.definition, node: top.id });
  const moduleBody = actual.checked.bodies.find(body => body.root === actual.checked.tree);
  const moduleGroup = actual.inputs.groups.find(group => group.bodies.includes(moduleBody.body));
  assert.ok(moduleGroup);
  assert.deepEqual([...actual.inputs.groupForms(moduleGroup)].map(prerequisite => prerequisite.site.report.id), []);
  const callableGroup = actual.inputs.groups.find(group => group.bodies.includes(callable.tsonic.body));
  assert.ok(callableGroup);
  assert.deepEqual([...actual.inputs.groupForms(callableGroup)].map(prerequisite => prerequisite.site.report.id), [execution.report.id]);
  for (const declaration of top.declarationList.declarations.nodes) {
    const cut = actual.inputs.sources.formOfDeclaration(declaration.tsonic.declaration.definition);
    assert.equal(cut?.cut === top && cut.report === header.report, true);
  }
});

test("actual type production exposes its first qualified work and entry refusals without reading a producer", () => {
  const produce = wiring.decls.produceType;
  try {
    for (const [maximumWork, maximumCreatedRecords, dimension] of [[0, 100, "work"], [10000, 0, "result-entries"]]) {
      const program = ready("function healthy(): boolean { return true; } export type Keys<T> = keyof T;");
      const [, alias] = program.checked.tree.statements.nodes;
      const owner = alias.tsonic.definition;
      const request = { component: { root: { kind: "item", value: { owner, node: alias.type.id } }, path: [] },
        bindings: fixture.types.rigidBindings(program.inputs.bindingScopeOf(owner)) };
      const base = { ...program.base, instantiation: { maximumWork, maximumCreatedRecords } };
      let qualified = 0;
      const inputs = { ...program.inputs, sources: { ...program.inputs.sources,
        nodeOf: source => {
          qualified += 1;
          assert.deepEqual(source, request.component.root);
          return program.inputs.sources.nodeOf(source);
        } } };
      const { database, bind } = registration.createSourceSemanticDatabase(base, { maximumRecords: 65536 });
      const { queries, productionRefusalOf } = bind(inputs);
      wiring.decls.produceType = () => assert.fail("paid type production has not admitted its first producer");
      assert.equal(productionRefusalOf(), null);
      const refused = database.run(queries.produceType, request);
      assert.equal(refused.kind, "refused");
      const original = productionRefusalOf();
      assert.equal(original.kind, "refused");
      assert.equal(original.diagnostics.length, 1);
      assert.strictEqual(refused.diagnostics[0], original.diagnostics[0]);
      assert.equal(refused.diagnostics[0].arguments[0].value, `type production ${dimension}`);
      assert.deepEqual(refused.diagnostics[0].site, { kind: "source", origin: alias.type.origin });
      assert.strictEqual(database.run(queries.produceType, request).diagnostics[0], original.diagnostics[0]);
      assert.equal(qualified, 1);
    }
  } finally {
    wiring.decls.produceType = produce;
  }
});

test("constraint discovery refuses with each original cause of the actual group before requesting semantic work", () => {
  const program = ready("function read(): boolean { missingLeft; function inside(): boolean { return missingInner; } return missingRight; } "
    + "function separate(): boolean { return missingElsewhere; }");
  const outer = program.checked.tree.statements.nodes[0];
  const body = outer.tsonic.body;
  const group = program.inputs.groups.find(row => row.bodies.includes(body));
  const inner = outer.body.statements.nodes[1].tsonic.body;
  assert.equal(group.bodies.includes(inner), true);
  const step = wiring.infer.constraintsOf(program.inputs.inference, group);
  assert.equal(step.kind, "done");
  assert.equal(step.value.kind, "refused");
  const originals = program.checked.checkerDiagnostics;
  assert.deepEqual(originals.map(row => row.code.rendered), ["TS2304", "TS2304", "TS2304", "TS2304"]);
  const owned = group.bodies.flatMap(reference => reference === inner ? [originals[1]] : [originals[0], originals[2]]);
  assert.equal(step.value.diagnostics.length, 3);
  assert.equal(step.value.diagnostics.every((row, index) => row === owned[index]), true);
  const separate = program.checked.tree.statements.nodes[1].tsonic.body;
  const separateGroup = program.inputs.groups.find(row => row.bodies.includes(separate));
  assert.notEqual(group.id, separateGroup.id);
  const separateStep = wiring.infer.constraintsOf(program.inputs.inference, separateGroup);
  assert.equal(separateStep.kind, "done");
  assert.equal(separateStep.value.kind, "refused");
  assert.equal(separateStep.value.diagnostics.length === 1 && separateStep.value.diagnostics[0] === originals[3], true);
  const repaired = ready("function read(): boolean { return true === false; } "
    + "function separate(): boolean { return missingElsewhere; }");
  const repairedBody = repaired.checked.tree.statements.nodes[0].tsonic.body;
  const repairedGroup = repaired.inputs.groups.find(row => row.bodies.includes(repairedBody));
  const readyStep = wiring.infer.constraintsOf(repaired.inputs.inference, repairedGroup);
  assert.equal(readyStep.kind, "paused");
  assert.deepEqual(readyStep.requests, [{ kind: "declaredSignatureOf", request: repaired.signature }]);
});

test("a flow into closed storage reads the finalized call result and retains the authored conversion endpoints", () => {
  const program = ready("function next(): boolean { return false; } "
    + "export function choose(value: boolean | null = (next())): boolean | null { return value; }");
  const parameter = program.checked.tree.statements.nodes[1].parameters.nodes[0];
  const body = parameter.tsonic.initializer;
  const group = program.inputs.groups.find(row => row.bodies.includes(body));
  const answer = program.database.run(program.queries.solutionOf, group.id);
  assert.equal(answer.kind, "completed");
  const { constraints, solution, contributions } = answer.value;
  const system = constraints.constraints.find(row => row.body === body);
  const call = system.constraints.find(row => row.kind === "call");
  const flowIndex = system.constraints.findIndex(row => row.kind === "flow" && row.role === "initialization");
  const flow = system.constraints[flowIndex];
  assert.equal(flow.from, call.application.result);
  const open = fixture.types.readType(program.interner, flow.from);
  assert.equal(open.kind, "open");
  const contribution = contributions.find(row => row.constraint.body === body && row.constraint.index === flowIndex);
  assert.deepEqual(contribution.reads, [open.variable]);
  assert.deepEqual(contribution.bounds, []);
  const actual = solution.variables[open.variable].value.type;
  assert.deepEqual(fixture.types.readType(program.interner, actual), { kind: "primitive", primitive: "bool" });
  assert.notEqual(actual, flow.to);
  const { decision } = solution.constraints.find(row => row.constraint.body === body && row.constraint.index === flowIndex);
  assert.deepEqual(decision, { kind: "flow", embedding: { kind: "conversion", conversion: "union-injection", check: { kind: "none" },
    proof: { steps: [{ from: { root: { kind: "body", value: { body, node: parameter.initializer.id } }, path: [] },
      to: { root: { kind: "item", value: { owner: program.domain.bodyOf.get(body).owner, node: parameter.type.id } }, path: [] },
      rule: "union-injection", premises: [] }], conclusion: 0 } } });
});

test("a native callable value cannot substitute the checked endpoint signature for its placed signature", () => {
  const program = ready("function read() { return wide; } const wide = 9_007_199_254_740_993; export const observed = read();");
  const caller = program.checked.bodies.find(body => body.root.kind === "CallExpression");
  const group = program.inputs.groups.find(group => group.bodies.includes(caller.body));
  const answer = program.database.run(program.queries.solutionOf, group.id);
  assert.equal(answer.kind, "completed");
  const system = answer.value.constraints.constraints.find(set => set.body === caller.body);
  const constraint = system.constraints.find(row => row.kind === "call");
  const { application } = constraint;
  const [candidate] = system.candidates.find(list => list.id === application.candidates).candidates;
  const [callee] = system.evidence.filter(row => row.value.component.kind === "body"
    && row.value.component.value.node === caller.root.expression.id);
  const actual = candidate.endpoints.value;
  assert.notEqual(actual.api.signature, actual.apiSignature);
  assert.deepEqual(fixture.types.readType(program.interner, callee.value.type).calls, [actual.apiSignature]);
  const input = { kind: "call", context: { occurrence: constraint.occurrence, origin: caller.root.origin, bindings: candidate.bindings.value },
    callee: callee.value, receiver: null, typeArguments: [], arguments: [], candidates: [{ ordinal: candidate.ordinal,
      declaration: candidate.declaration, ...actual, bindings: candidate.bindings.value, conditionalFailure: null }] };
  const rules = program.inputs.inference.rules;
  const work = { typeWork: program.inputs.inference.typeWork, unit: { query: "solutionOf", key: group.id } };
  const chosen = rules.candidate(input, work);
  assert.equal(chosen.kind, "ok");
  assert.equal(chosen.value.decision.completion.signature, actual.apiSignature);
  const checkedOnly = insertFixtureType(fixture.types, program.interner, { kind: "callable", calls: [actual.api.signature], constructs: [] });
  assert.throws(() => rules.candidate({ ...input, callee: { ...input.callee, type: checkedOnly } }, work),
    error => error.cause?.owner === "rules" && error.message.includes("actual callable value signature"));
});

test("recursive generic inference defers the candidate with its distinct placed template and applied completion", () => {
  const program = ready("export function repeat<T>(value:T):T { return repeat(value); }");
  const declaration = program.checked.tree.statements.nodes[0];
  const body = program.domain.bodyOf.get(declaration.tsonic.body);
  const group = program.inputs.groups.find(row => row.bodies.includes(body.body));
  const result = program.database.run(program.queries.solutionOf, group.id);
  assert.equal(result.kind, "completed");
  const publication = result.value;
  const original = publication.solution.bodies.find(row => row.body === body.body);
  const selected = publication.solution.constraints.find(row => row.decision.kind === "deferred"
    && row.decision.deferred.invocation.rule === "candidate");
  const deferred = selected.decision.deferred;
  const application = deferred.invocation.input.candidates[0];
  const candidate = publication.constraints.constraints.find(row => row.body === body.body).candidates[0].candidates[0];
  assert.equal(application.api.body, original.body);
  assert.equal(application.api.signature, original.signature);
  assert.notEqual(application.apiSignature, original.signature);
  assert.equal(application.apiSignature, candidate.endpoints.value.apiSignature);
  assert.equal(deferred.result, fixture.types.readSignature(program.interner, application.apiSignature).result);
  const verify = changed => irInfer.verifyInference({ group, constraints: publication.constraints.constraints,
    contributions: publication.contributions, solution: { ...publication.solution,
      constraints: publication.solution.constraints.map(row => row !== selected ? row : {
        ...row, decision: { kind: "deferred", deferred: changed },
      }) },
    placedSignatureOf: identity => identity === original.body ? original.signature : null,
    ...program.verification(group, publication.constraints, publication) }).map(row => row.rule);
  assert.deepEqual(verify({ ...deferred, invocation: { ...deferred.invocation, input: { ...deferred.invocation.input,
    candidates: [{ ...application, apiSignature: original.signature }],
  } } }), ["deferred-invocation"]);
  const unrelated = fixture.types.internType(program.interner, { kind: "primitive", primitive: "bool" });
  assert.notEqual(unrelated, deferred.result);
  assert.deepEqual(verify({ ...deferred, result: unrelated }), ["deferred-invocation"]);
});

test("real explicit and inferred calls retain their original endpoint, applied completion and authored type arguments", async () => {
  const program = ready(`export function caller(value: boolean): boolean {
    project<boolean>(value);
    return project(value);
  }
  declare function project<T>(value: T): T;`);
  const [caller, project] = program.checked.tree.statements.nodes;
  const [endpoint] = project.tsonic.signatures;
  const body = program.domain.bodyOf.get(caller.tsonic.body);
  assert.equal(body.candidateLists.length, 2);
  const request = { definition: endpoint.declaration, endpoint: endpoint.role, ordinal: 0, bindings: { kind: "parametric" } };
  const original = program.database.run(program.queries.declaredSignatureOf, request);
  assert.equal(original.kind, "completed");
  assert.equal(original.value.id, endpoint.signature);
  assert.equal(original.value.typeParameters.length, 1);
  const [binder] = original.value.typeParameters;
  for (const { candidates } of body.candidateLists) {
    assert.equal(candidates.length, 1);
    const [candidate] = candidates;
    assert.equal(candidate.declaration, endpoint.declaration);
    assert.equal(candidate.bindings.kind, "available");
    assert.equal(candidate.appliedSignature.kind, "available");
    const [argument] = candidate.bindings.value.methodBindings;
    assert.equal(argument.kind, "bound");
    assert.equal(argument.parameter, binder.declaration);
    assert.deepEqual(fixture.types.readType(program.interner, argument.type), { kind: "primitive", primitive: "bool" });
    const applied = program.database.run(program.queries.declaredSignatureOf,
      { ...request, bindings: { kind: "instantiated", bindings: candidate.bindings.value } });
    assert.equal(applied.kind, "completed");
    assert.equal(applied.value.id, candidate.appliedSignature.value);
    assert.notEqual(applied.value.id, endpoint.signature);
    assert.deepEqual(applied.value.typeParameters, []);
    assert.equal(applied.value.parameters[0].type, argument.type);
    assert.equal(applied.value.result, argument.type);
  }
  assert.equal(program.database.run(program.queries.declaredSignatureOf, request).value.id, endpoint.signature);
  const group = program.inputs.groups.find(group => group.bodies.includes(body.body));
  const pending = wiring.infer.constraintsOf(program.inputs.inference, group);
  assert.equal(pending.kind, "paused");
  const requests = pending.requests.filter(asked => asked.kind === "declaredSignatureOf" && asked.request.definition === endpoint.declaration);
  assert.deepEqual(requests, [{ kind: "declaredSignatureOf", request: { ...request,
    bindings: { kind: "instantiated", bindings: body.candidateLists[0].candidates[0].bindings.value } } }]);
  const answers = pending.requests.map(asked => {
    assert.equal(asked.kind, "declaredSignatureOf");
    const resolved = program.database.run(program.queries.declaredSignatureOf, asked.request);
    assert.equal(resolved.kind, "completed");
    return { kind: asked.kind, value: resolved.value };
  });
  const wrongAnswer = pending.requests.map((asked, index) => asked.request.definition === endpoint.declaration
    ? { kind: asked.kind, value: original.value } : answers[index]);
  const table = fixture.types.viewTypes(program.interner);
  const arenaSize = [table.terms.length, table.signatures.length];
  assert.throws(() => wiring.infer.resumeConstraintsOf(program.inputs.inference, pending.paused, wrongAnswer),
    /authoritative applied signature differs/u);
  assert.deepEqual([table.terms.length, table.signatures.length], arenaSize);
  const completed = wiring.infer.resumeConstraintsOf(program.inputs.inference, pending.paused, answers);
  assert.equal(completed.kind, "done");
  assert.equal(completed.value.kind, "ok");
  const [constraints] = completed.value.value.constraints;
  for (const [index, { candidates }] of constraints.candidates.entries()) {
    const [candidate] = candidates;
    const signature = body.candidateLists[index].candidates[0].appliedSignature.value;
    assert.deepEqual(candidate.endpoints, { kind: "available", value: { advertised: endpoint, advertisedSignature: signature,
      api: endpoint, apiSignature: signature } });
  }
  const [authored, inferred] = constraints.constraints.filter(constraint => constraint.kind === "call");
  const typeNode = body.root.statements.nodes[0].expression.typeArguments.nodes[0];
  const [explicit] = authored.application.typeArguments;
  assert.equal(explicit, typeNode.tsonic.type.value);
  assert.deepEqual(inferred.application.typeArguments, []);
  assert.deepEqual(fixture.types.readType(program.interner, authored.application.callee).calls, [endpoint.signature]);
  assert.deepEqual(fixture.types.readType(program.interner, inferred.application.callee).calls, [endpoint.signature]);
  assert.deepEqual(constraints.evidence.find(evidence => evidence.value.component.value.node === typeNode.id).value.component,
    { kind: "body", value: { body: body.body, node: typeNode.id } });
  assert.deepEqual(irInfer.parseConstraints(irInfer.printConstraints(constraints)), { kind: "parsed", value: constraints });
  const solved = program.database.run(program.queries.solutionOf, group.id);
  assert.equal(solved.kind, "completed");
  const publication = solved.value;
  const decisions = publication.solution.constraints.filter(row => row.decision.kind === "call");
  assert.equal(decisions.length, 2);
  for (const [index, { decision }] of decisions.entries()) {
    const { application } = decision;
    const captured = body.candidateLists[index].candidates[0];
    assert.deepEqual(application.advertised, endpoint);
    assert.deepEqual(application.api, endpoint);
    assert.deepEqual(application.bindings, captured.bindings.value);
    assert.equal(application.completion.signature, captured.appliedSignature.value);
    assert.equal(application.result, explicit);
  }
  const crossed = { ...publication.solution, constraints: publication.solution.constraints.map(row => row !== decisions[0] ? row : {
    ...row, decision: { ...row.decision, application: { ...row.decision.application,
      completion: { ...row.decision.application.completion, signature: endpoint.signature } } },
  }) };
  const placed = new Map(publication.solution.bodies.map(body => [body.body, body.signature]));
  const invalid = irInfer.verifyInference({ group, constraints: publication.constraints.constraints, contributions: publication.contributions,
    solution: crossed, placedSignatureOf: body => placed.get(body) ?? null, ...program.verification(group, publication.constraints, publication) });
  assert.deepEqual(invalid.map(({ rule, detail }) => [rule, detail.map(part => part.value)]), [["endpoint-agreement", ["completion"]]]);
  const deps = { cuts: program.domain.sources.cuts, types: program.interner, typeWork: program.base.declarations.typeWork, rules: program.inputs.inference.rules, nodeOf: program.domain.nodeOf,
    nominalOf: program.scopes.nominalOf, bindingScopeOf: program.inputs.inference.bindingScopeOf,
    bindingOf: program.inputs.inference.bindingOf, typeOf: type => fixture.types.readType(program.interner, type),
    staticStorageOf: () => null,
    enumValueTypeOf: () => assert.fail("This fixture has no enum value occurrence."),
    signatureOf: signature => fixture.types.readSignature(program.interner, signature), checkerDiagnosticsOf: () => program.checked.checkerDiagnostics };
  const typed = wiring.elaborate.elaborate(deps, { instance: { body: body.body, bindings: { kind: "parametric" } },
    scope: program.descriptions.get(body.owner).generics, body, layoutAlias: null, typing: readyTyping(publication.constraints.constraints[0], publication.solution),
    nestedBodies: [], initializers: [] });
  assert.equal(typed.kind, "ok");
  const [ordinary, returned] = typed.value.root.statements.nodes;
  assert.equal(ordinary.expression.typeArguments.nodes[0].id, typeNode.id);
  assert.equal(ordinary.expression.typeArguments.nodes[0].tsonic.type, explicit);
  assert.equal(returned.expression.typeArguments, null);
  const tir = await import("../../packages/host/dist/ir-tir/index.js");
  const verifyBody = await tirFixtureBodyVerifier(tir.verifyTir);
  const verifyChapter = await tirFixtureVerifier(tir.verifyTirModule);
  assert.deepEqual(tir.parseTir(tir.printTir(typed.value)), { kind: "parsed", value: typed.value });
  const moduleSource = program.checked.bodies.find(candidate => candidate.root.kind === "SourceFile");
  const moduleGroup = program.inputs.groups.find(candidate => candidate.bodies.includes(moduleSource.body));
  const moduleSolved = program.database.run(program.queries.solutionOf, moduleGroup.id);
  assert.equal(moduleSolved.kind, "completed");
  const moduleTyped = wiring.elaborate.elaborate(deps, { instance: { body: moduleSource.body, bindings: { kind: "parametric" } },
    scope: program.descriptions.get(moduleSource.owner).generics, body: moduleSource, layoutAlias: null,
    typing: readyTyping(moduleSolved.value.constraints.constraints[0], moduleSolved.value.solution), nestedBodies: [typed.value], initializers: [] });
  assert.equal(moduleTyped.kind, "ok");
  const { kind: role, node: declaration } = moduleTyped.value.root.statements.nodes[1];
  assert.equal(role, "ready-statement");
  assert.equal(declaration.body, null);
  assert.equal(declaration.tsonic.template, null);
  assert.equal(declaration.parameters.nodes[0].tsonic.local, null);
  assert.deepEqual(declaration.tsonic.signatures, [endpoint]);
  const typedByBody = new Map([moduleTyped.value, typed.value].map(entry => [entry.body, entry]));
  const scope = program.descriptions.get(body.owner).generics;
  const bindings = { kind: "instantiated", bindings: fixture.types.rigidBindings(scope) };
  const selected = wiring.elaborate.elaborate(deps, { instance: { body: body.body, bindings }, scope, body, layoutAlias: null,
    typing: readyTyping(publication.constraints.constraints[0], publication.solution, typed.value), nestedBodies: [], initializers: [] });
  assert.equal(selected.kind, "ok");
  const typedModule = { module: program.checked.module, tree: { kind: "ready-root", root: moduleTyped.value.root },
    bodies: [...program.checked.bodies.map(source => typedByBody.get(source.body)), selected.value] };
  const bodyOf = instance => instance.bindings.kind === "parametric" ? typedByBody.get(instance.body) ?? null
    : instance.body === body.body && fixture.types.artifactBindingsKey(instance.bindings) === fixture.types.artifactBindingsKey(bindings) ? selected.value : null;
  const verifier = { source: program.checked, module: typedModule, types: table, declarationOf: program.declarationOf,
    declarationSourceOf: program.domain.declarationSourceOf,
    staticStorageOf: () => null,
    memberTableOf: () => null, nominalOf: () => null, bodyOf, nodeOf: program.domain.nodeOf, localExists: program.domain.localExists,
    diagnostics: program.checked.checkerDiagnostics,
    layoutAliasOf: null,
    bindingScopesOf: visitBindingScopes(typedModule, bodyOf, owner => program.descriptions.get(owner).generics) };
  assert.deepEqual(verifyChapter(verifier, typedModule), []);
  assert.deepEqual(verifyBody(verifier, typed.value), []);
  assert.deepEqual(verifyBody(verifier, selected.value), []);
  const lower = await import("../../packages/host/dist/pipeline/lower-mir-step.js");
  const irMir = await import("../../packages/host/dist/ir-mir/index.js");
  const run = { interner: program.interner, table, bodyOf, declarationOf: program.declarationOf,
    bodyOwner: identity => program.domain.bodyOf.get(identity)?.owner ?? null, selectedNativeFacts: program.snapshot.nativeFacts,
    defs: { completionSelector: insertFixtureType(fixture.types, program.interner, { kind: "primitive", primitive: "int32" }),
      exceptionStorage: insertFixtureType(fixture.types, program.interner, { kind: "intrinsic", intrinsic: "unknown" }) },
    lowering: { maximumRecords: 100000 }, verification: { maximumWork: 1000000 } };
  const unit = { request: { query: "mirBody", key: [body.body, fixture.types.artifactBindingsData(bindings)] }, position: { kind: "result" } };
  const lowered = wiring.lowerMir.lowerToMir(lower.lowerMirDeps(run, unit), selected.value, [], [selected.value.params.length]);
  assert.equal(lowered.kind, "ok");
  assert.deepEqual(irMir.verifyMir(lowered.value, lower.mirVerificationContext(run, selected.value, [selected.value.params.length])), { kind: "complete", violations: [] });
  const applications = lowered.value.blocks.map(block => block.terminator).filter(terminator => terminator.kind === "call");
  assert.deepEqual(applications.map(terminator => terminator.callee.resolution.decision.completion.signature),
    decisions.map(row => row.decision.application.completion.signature));
  for (const terminator of applications) {
    assert.equal(terminator.callee.kind, "direct");
    assert.deepEqual(terminator.callee.resolution.decision.api, endpoint);
  }
});

test("an actual failed assignment read returns its original published diagnostic without solving a poisoned type", () => {
  const program = ready("export function store():boolean{const a:boolean=true;a=false;return a;}");
  const body = program.checked.tree.statements.nodes[0].tsonic.body;
  const group = program.inputs.groups.find(group => group.bodies.includes(body));
  assert.notEqual(group, undefined);
  const result = program.database.run(program.queries.solutionOf, group.id);
  assert.equal(result.kind, "refused");
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0], program.checked.checkerDiagnostics.find(diagnostic => diagnostic.code.number === 2588));
});

for (const annotation of ["boolean", null]) test(`real ${annotation ?? "inferred"} module initializer completes its own registered solution and selected execution`, async () => {
  const program = ready(`export function value(): boolean { return true; } export const flag${annotation === null ? "" : `: ${annotation}`} = false;`);
  const { types } = fixture;
  const records = new Map();
  for (const group of program.inputs.groups) {
    const answer = program.database.run(program.queries.solutionOf, group.id);
    assert.equal(answer.kind, "completed");
    assert.deepEqual(answer.diagnostics, []);
    for (const set of answer.value.constraints.constraints) records.set(set.body, { ...answer.value, constraints: set });
  }
  const typed = new Map();
  const deps = { cuts: program.domain.sources.cuts, types: program.interner, typeWork: program.base.declarations.typeWork, rules: program.inputs.inference.rules, nodeOf: program.domain.nodeOf, bindingOf: program.inputs.inference.bindingOf,
    nominalOf: program.scopes.nominalOf, bindingScopeOf: program.inputs.inference.bindingScopeOf,
    typeOf: type => types.readType(program.interner, type), signatureOf: signature => types.readSignature(program.interner, signature),
    staticStorageOf: () => null,
    enumValueTypeOf: () => assert.fail("This fixture has no enum value occurrence."),
    checkerDiagnosticsOf: () => program.checked.checkerDiagnostics };
  const elaborate = source => {
    const record = records.get(source.body);
    const result = wiring.elaborate.elaborate(deps, { instance: { body: source.body, bindings: { kind: "parametric" } },
      scope: program.descriptions.get(source.owner).generics, body: source, layoutAlias: null, typing: readyTyping(record.constraints, record.solution),
      nestedBodies: source.nestedBodies.map(nested => typed.get(nested)), initializers: [] });
    assert.equal(result.kind, "ok");
    typed.set(source.body, result.value);
    return result.value;
  };
  for (const body of program.checked.bodies.filter(body => body.root.kind !== "SourceFile")) elaborate(body);
  const moduleSource = program.checked.bodies.find(body => body.root.kind === "SourceFile");
  const moduleBody = elaborate(moduleSource);
  const variable = program.checked.tree.statements.nodes[1].declarationList.declarations.nodes[0];
  const initializer = program.domain.bodyOf.get(variable.tsonic.initializer);
  const template = typed.get(initializer.body);
  const scope = program.descriptions.get(initializer.owner).generics;
  assert.deepEqual(scope, { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] });
  const bindings = { kind: "instantiated", bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } };
  const selected = wiring.elaborate.elaborate(deps, { instance: { body: initializer.body, bindings }, scope, body: initializer, layoutAlias: null,
    typing: readyTyping(records.get(initializer.body).constraints, records.get(initializer.body).solution, template),
    nestedBodies: [], initializers: [] });
  assert.equal(selected.kind, "ok");
  assert.equal(selected.value.root.id, variable.initializer.id);
  assert.equal(selected.value.root.kind, "FalseKeyword");
  assert.equal(types.readSignature(program.interner, selected.value.signature).result, selected.value.completion);
  const assembled = moduleBody.root.statements.nodes[1].node.declarationList.declarations.nodes[0];
  assert.equal(assembled.initializer === template.root, true);
  assert.equal(assembled.tsonic.initializer, selected.value.body);
  assert.equal(assembled.tsonic.storage, selected.value.completion);
  const selectedBodies = new Map([[initializer.body, selected.value]]);
  for (const source of program.checked.bodies) {
    if (selectedBodies.has(source.body)) continue;
    const actualScope = program.descriptions.get(source.owner).generics;
    assert.deepEqual(actualScope, { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] });
    const record = records.get(source.body);
    const replay = wiring.elaborate.elaborate(deps, { instance: { body: source.body, bindings }, scope: actualScope, body: source, layoutAlias: null,
      typing: readyTyping(record.constraints, record.solution, typed.get(source.body)),
      nestedBodies: source.nestedBodies.map(nested => selectedBodies.get(nested)), initializers: [] });
    assert.equal(replay.kind, "ok");
    selectedBodies.set(source.body, replay.value);
  }
  const selectedModule = selectedBodies.get(moduleSource.body);
  const selectedVariable = selectedModule.root.statements.nodes[1].node.declarationList.declarations.nodes[0];
  assert.equal(selectedVariable.initializer === selected.value.root, true);
  assert.equal(selectedVariable.tsonic.initializer, selected.value.body);
  assert.equal(types.artifactBindingsKey(selectedModule.bindings), types.artifactBindingsKey(selected.value.bindings));
  const publication = { module: program.checked.module, tree: { kind: "ready-root", root: moduleBody.root }, bodies: [...typed.values(), ...selectedBodies.values()] };
  const verifier = { source: program.checked, module: publication, types: types.viewTypes(program.interner),
    staticStorageOf: () => null,
    declarationOf: program.declarationOf, declarationSourceOf: program.domain.declarationSourceOf, memberTableOf: () => null, nominalOf: () => null,
    bodyOf: instance => instance.bindings.kind === "parametric" ? typed.get(instance.body) ?? null
      : types.artifactBindingsKey(instance.bindings) === types.artifactBindingsKey(bindings) ? selectedBodies.get(instance.body) ?? null : null,
    nodeOf: program.domain.nodeOf, localExists: program.domain.localExists, diagnostics: program.checked.checkerDiagnostics,
    layoutAliasOf: null,
    bindingScopesOf: suppliedTirScopes(target => {
      if (target.kind === "module") return target.module === program.checked.module ? [] : null;
      const source = program.domain.bodyOf.get(target.instance.body);
      const actual = program.descriptions.get(source?.owner)?.generics;
      if (actual === undefined) return null;
      if (source.root.kind === "SourceFile") return [actual, actual, program.descriptions.get(program.checked.tree.statements.nodes[0].tsonic.definition).generics,
        ...(target.instance.bindings.kind === "instantiated" ? [actual] : [])];
      return target.instance.bindings.kind === "parametric" ? [actual] : [actual, actual];
    }) };
  const tir = await import("../../packages/host/dist/ir-tir/index.js");
  const verifyBody = await tirFixtureBodyVerifier(tir.verifyTir);
  const verifyChapter = await tirFixtureVerifier(tir.verifyTirModule);
  assert.deepEqual(verifyChapter(verifier, publication), []);
  for (const body of publication.bodies) assert.deepEqual(verifyBody(verifier, body), []);
  const lower = await import("../../packages/host/dist/pipeline/lower-mir-step.js");
  const mir = await import("../../packages/host/dist/ir-mir/index.js");
  const run = { interner: program.interner, table: types.viewTypes(program.interner), selectedNativeFacts: program.snapshot.nativeFacts,
    defs: { completionSelector: insertFixtureType(types, program.interner, { kind: "primitive", primitive: "int32" }),
      exceptionStorage: insertFixtureType(types, program.interner, { kind: "intrinsic", intrinsic: "unknown" }) },
    lowering: { maximumRecords: 100000 }, verification: { maximumWork: 1000000 }, declarationOf: program.declarationOf,
    bodyOwner: body => program.domain.bodyOf.get(body)?.owner ?? null, bodyOf: verifier.bodyOf };
  const loweredBodies = new Map();
  for (const body of selectedBodies.values()) {
    const actualChildren = body.nestedBodies.map(nested => {
      const child = selectedBodies.get(nested);
      assert.equal(child !== undefined, true, "the selected child was genuinely elaborated and verified");
      return { instance: { body: child.body, bindings: child.bindings }, captures: child.captures, signature: child.signature };
    });
    const unit = { request: { query: "mirBody", key: [body.body, types.artifactBindingsData(body.bindings)] }, position: { kind: "result" } };
    const result = wiring.lowerMir.lowerToMir(lower.lowerMirDeps(run, unit), body, actualChildren, [body.params.length]);
    assert.equal(result.kind, "ok");
    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(mir.verifyMir(result.value, lower.mirVerificationContext(run, body, [body.params.length])), { kind: "complete", violations: [] });
    assert.deepEqual(mir.parseMir(mir.printMir(result.value)), { kind: "parsed", value: result.value });
    loweredBodies.set(body.body, result.value);
  }
  const moduleMir = loweredBodies.get(moduleSource.body);
  const initializerCalls = moduleMir.blocks.filter(block => block.terminator.kind === "call");
  assert.equal(initializerCalls.length, 1, "the initializer remains one separate executed body");
  assert.deepEqual(initializerCalls[0].terminator.callee, { kind: "body", instance: { body: selected.value.body, bindings }, captures: selected.value.captures });
  assert.equal(moduleMir.places.some(place => place.base.kind === "static" && place.base.definition === initializer.owner), true,
    "module storage belongs to the actual variable definition, not a fabricated local");
  assert.equal(program.database.trace().some(event => event.kind === "dependency" && event.state === "active"), false);
});

test("actual plain local assignment retains the RHS embedding and writable target without a fabricated operator decision", () => {
  const program = ready("export function store(a:boolean,b:boolean):boolean{a=true;return a;}");
  const body = program.checked.bodies.find(candidate => candidate.root.kind === "Block");
  const group = program.inputs.groups.find(candidate => candidate.bodies.includes(body.body));
  const completed = program.database.run(program.queries.solutionOf, group.id);
  assert.equal(completed.kind, "completed");
  assert.equal(completed.diagnostics.length, 0);
  const constraints = completed.value.constraints.constraints.find(candidate => candidate.body === body.body);
  const checked = body.root.statements.nodes[0].expression;
  const flow = constraints.constraints.find(candidate => candidate.kind === "flow" && candidate.role === "assignment");
  assert.equal(flow.occurrence.node, checked.right.id);
  assert.equal(constraints.constraints.some(candidate => candidate.kind === "op" && candidate.occurrence.node === checked.id), false);
  const deps = { cuts: program.domain.sources.cuts, types: program.interner, typeWork: program.base.declarations.typeWork, rules: program.inputs.inference.rules, nodeOf: program.domain.nodeOf,
    nominalOf: program.scopes.nominalOf, bindingScopeOf: program.inputs.inference.bindingScopeOf,
    bindingOf: program.inputs.inference.bindingOf, typeOf: type => fixture.types.readType(program.interner, type),
    staticStorageOf: () => null,
    enumValueTypeOf: () => assert.fail("This fixture has no enum value occurrence."),
    signatureOf: signature => fixture.types.readSignature(program.interner, signature), checkerDiagnosticsOf: () => program.checked.checkerDiagnostics };
  const input = { instance: { body: body.body, bindings: { kind: "parametric" } }, scope: program.descriptions.get(body.owner).generics,
    body, layoutAlias: null, typing: readyTyping(constraints, completed.value.solution), nestedBodies: [], initializers: [] };
  const result = wiring.elaborate.elaborate(deps, input);
  assert.equal(result.kind, "ok");
  const actual = result.value.root.statements.nodes[0].expression;
  assert.equal(actual.tsonic.role, "assignment");
  assert.equal(actual.tsonic.calculation, null);
  assert.equal(actual.tsonic.selection, null);
  assert.equal(actual.tsonic.storage, result.value.locals[0].storage);
  assert.equal(actual.left.tsonic.role, "assignment-target");
  assert.equal("type" in actual.left.tsonic, false);
  assert.deepEqual(actual.left.tsonic.access, { kind: "write", storage: actual.tsonic.storage });
  assert.equal(actual.right.tsonic.convertedType, actual.tsonic.storage);
  assert.equal(actual.right.tsonic.conversion.kind, "convert");
  assert.equal(actual.right.tsonic.conversion.role, "assignment");
  const original = checked.left.tsonic;
  const pending = wiring.infer.constraintsOf(program.inputs.inference, group);
  assert.equal(pending.kind, "paused");
  const answers = pending.requests.map(request => {
    assert.equal(request.kind, "declaredSignatureOf");
    const answer = program.database.run(program.queries.declaredSignatureOf, request.request);
    assert.equal(answer.kind, "completed");
    return { kind: request.kind, value: answer.value };
  });
  const place = original.place.value;
  const foreign = program.checked.bodies.find(candidate => candidate.body !== body.body).body;
  for (const [changed, expected] of [
    [{ ...original, access: "read-write" }, /plain assignment without its checked writable root target/u],
    [{ ...original, place: { kind: "unavailable", reason: "not-provided", causes: [] } }, /plain assignment without its checked writable root target/u],
    [{ ...original, place: { kind: "available", value: { ...place, write: { kind: "available", value: null } } } }, /plain assignment without its checked writable root target/u],
    ...[{ ...original.resolution.local, body: foreign }, { ...original.resolution.local, local: original.resolution.local.local + 1 }]
      .map(local => [{ ...original, place: { kind: "available", value: { ...place,
        base: { kind: "root", resolution: { kind: "local", local } } } } }, /plain assignment without its checked writable root target/u]),
  ]) {
    checked.left.tsonic = changed;
    assert.throws(() => wiring.infer.resumeConstraintsOf(program.inputs.inference, pending.paused, answers),
      /actual qualified writable root storage/u);
    assert.throws(() => wiring.elaborate.elaborate(deps, input), expected);
  }
  checked.left.tsonic = original;
  const binary = checked.tsonic;
  const other = { body: body.body, local: body.params[1].local };
  for (const changed of [
    { ...place, base: { kind: "root", resolution: { kind: "local", local: other } } },
    { ...place, base: { kind: "root", resolution: { kind: "local", local: { ...other, body: foreign } } } },
    { ...place, base: { kind: "place", node: checked.left.id } },
    { ...place, step: { kind: "deref" } },
    { ...place, write: { kind: "available", value: null } },
    { ...place, write: { kind: "available", value: flow.from } },
    { ...place, write: { kind: "unavailable", reason: "not-provided", causes: [] } },
  ]) {
    checked.tsonic = { ...binary, target: { kind: "available", value: changed } };
    assert.throws(() => wiring.infer.resumeConstraintsOf(program.inputs.inference, pending.paused, answers),
      /actual writable root assignment target/u);
    assert.throws(() => wiring.elaborate.elaborate(deps, input), /plain assignment without its checked writable root target/u);
  }
  checked.tsonic = { ...binary, target: structuredClone(binary.target) };
  assert.equal(wiring.infer.resumeConstraintsOf(program.inputs.inference, pending.paused, answers).value.kind, "ok");
  assert.equal(wiring.elaborate.elaborate(deps, input).kind, "ok");
  checked.tsonic = binary;
  const generated = wiring.infer.resumeConstraintsOf({ ...program.inputs.inference,
    limits: { ...program.inputs.inference.limits, maximumVariablesPerGroup: 0 } }, pending.paused, answers);
  assert.equal(generated.kind, "done");
  assert.equal(generated.value.kind, "ok");
  assert.equal(generated.value.value.constraints.every(set => set.variables.length === 0), true);
  const retained = generated.value.value.constraints.find(set => set.body === body.body).constraints
    .find(candidate => candidate.kind === "flow" && candidate.role === "assignment");
  assert.deepEqual(retained, flow);
  assert.equal(wiring.elaborate.elaborate(deps, input).kind, "ok");
});

test("throwing an actual string formal retains the value channel without a return flow to never", async () => {
  const program = ready("export function escape(value:string):never{throw value;}");
  const body = program.checked.bodies.find(candidate => candidate.root.kind === "Block");
  const group = program.inputs.groups.find(candidate => candidate.bodies.includes(body.body));
  const completed = program.database.run(program.queries.solutionOf, group.id);
  assert.equal(completed.kind, "completed");
  assert.equal(completed.diagnostics.length, 0);
  const constraints = completed.value.constraints.constraints.find(candidate => candidate.body === body.body);
  assert.deepEqual(constraints.variables, []);
  assert.deepEqual(constraints.constraints, []);
  const deps = { cuts: program.domain.sources.cuts, types: program.interner, typeWork: program.base.declarations.typeWork, rules: program.inputs.inference.rules, nodeOf: program.domain.nodeOf,
    nominalOf: program.scopes.nominalOf, bindingScopeOf: program.inputs.inference.bindingScopeOf,
    bindingOf: program.inputs.inference.bindingOf, typeOf: type => fixture.types.readType(program.interner, type),
    staticStorageOf: () => null,
    enumValueTypeOf: () => assert.fail("This fixture has no enum value occurrence."),
    signatureOf: signature => fixture.types.readSignature(program.interner, signature), checkerDiagnosticsOf: () => program.checked.checkerDiagnostics };
  const input = { instance: { body: body.body, bindings: { kind: "parametric" } }, scope: program.descriptions.get(body.owner).generics,
    body, layoutAlias: null, typing: readyTyping(constraints, completed.value.solution), nestedBodies: [], initializers: [] };
  const result = wiring.elaborate.elaborate(deps, input);
  assert.equal(result.kind, "ok");
  const statement = result.value.root.statements.nodes[0];
  const checked = body.root.statements.nodes[0];
  assert.equal(statement.kind, "ThrowStatement");
  assert.equal(statement.id, checked.id);
  assert.deepEqual(statement.origin, checked.origin);
  assert.equal(statement.tsonic, null);
  assert.equal(statement.expression.id, checked.expression.id);
  assert.deepEqual(statement.expression.tsonic.resolution, { kind: "local", local: result.value.params[0].tsonic.local });
  assert.deepEqual(fixture.types.readType(program.interner, statement.expression.tsonic.type), { kind: "string" });
  assert.equal(statement.expression.tsonic.convertedType, statement.expression.tsonic.type);
  assert.deepEqual(statement.expression.tsonic.conversion, { kind: "identity" });
  assert.deepEqual(fixture.types.readType(program.interner, result.value.completion), { kind: "intrinsic", intrinsic: "never" });
  const tir = await import("../../packages/host/dist/ir-tir/index.js");
  const verifyBody = await tirFixtureBodyVerifier(tir.verifyTir);
  const verifyChapter = await tirFixtureVerifier(tir.verifyTirModule);
  assert.equal(isDeepStrictEqual(tir.parseTir(tir.printTir(result.value)), { kind: "parsed", value: result.value }), true);
});

test("a numeric assignment with an already matching base retains one literal-fit flow at its authored destination", () => {
  const program = ready("export function value(): number { let local: number; ((local)) = ((1.25)); return local; }");
  const body = program.checked.bodies.find(row => row.root.kind === "Block");
  const node = body.root.statements.nodes[1].expression;
  const target = node.left.expression.expression;
  const group = program.inputs.groups.find(candidate => candidate.bodies.includes(body.body));
  const answer = program.database.run(program.queries.solutionOf, group.id);
  assert.equal(answer.kind, "completed");
  assert.deepEqual(answer.diagnostics, []);
  const set = answer.value.constraints.constraints.find(candidate => candidate.body === body.body);
  assert.equal(set.constraints.some(row => row.kind === "literal"), false);
  const assignments = set.constraints.filter(row => row.kind === "flow" && row.role === "assignment");
  assert.equal(assignments.length, 1);
  const [assignment] = assignments;
  const source = fixture.types.readType(program.interner, assignment.from);
  const destination = fixture.types.readType(program.interner, assignment.to);
  assert.deepEqual(destination, { kind: "primitive", primitive: "float64" });
  assert.deepEqual(source, { kind: "literal", base: assignment.to,
    value: { kind: "number", value: { numerator: 5n, denominator: 4n, negativeZero: false } } });
  assert.deepEqual(assignment.occurrence, { body: body.body, node: node.right.id });
  const solved = answer.value.solution.constraints.find(row => row.constraint.body === body.body
    && row.constraint.index === set.constraints.indexOf(assignment));
  assert.deepEqual(solved.decision, { kind: "flow", embedding: { kind: "conversion", conversion: "literal-fit",
    check: { kind: "none" }, proof: { conclusion: 0, steps: [{
      from: { root: { kind: "body", value: { body: body.body, node: node.right.id } }, path: [] },
      to: { root: { kind: "body", value: { body: body.body, node: target.id } }, path: [] },
      rule: "literal-fit", premises: [],
    }] } } });
});

for (const [authored, annotation, kind, expected] of [
  ["true", "boolean", "boolean", true], ["false", "boolean", "boolean", false],
  ['""', "string", "string", ""], ['"a\\nΩ"', "string", "string", "a\nΩ"],
]) test(`real ${authored} return retains its literal type and actual annotation component through semantic rows and TIR`, async () => {
  const program = ready(`export function value(): ${annotation} { return ${authored}; }\n`);
  const { types } = fixture;
  const records = new Map();
  for (const group of program.inputs.groups) {
    const answer = program.database.run(program.queries.solutionOf, group.id);
    assert.equal(answer.kind, "completed");
    assert.equal(answer.diagnostics.length, 0);
    for (const set of answer.value.constraints.constraints) records.set(set.body, { ...answer.value, constraints: set });
  }
  const body = program.checked.bodies.find(body => body.root.kind === "Block");
  const owner = program.checked.tree.statements.nodes[0];
  const expression = body.root.statements.nodes[0].expression;
  const record = records.get(body.body);
  const [from, to] = record.constraints.evidence;
  const literal = types.readType(program.interner, from.value.type);
  assert.equal(literal.kind, "literal");
  assert.deepEqual(literal.value, { kind, value: expected });
  assert.equal(literal.base, to.value.type);
  assert.deepEqual(from.value.component, { kind: "body", value: { body: body.body, node: expression.id } });
  assert.deepEqual(to.value.component, { kind: "item", value: { owner: body.owner, node: owner.type.id } });
  assert.equal(program.domain.nodeOf(to.value.component) === owner.type, true);
  const embedding = record.solution.constraints[0].decision.embedding;
  assert.equal(embedding.kind, "conversion");
  assert.equal(embedding.conversion, "literal-fit");
  assert.deepEqual(embedding.proof.steps, [{ from: { root: from.value.component, path: [] },
    to: { root: to.value.component, path: [] }, rule: "literal-fit", premises: [] }]);
  const typed = new Map();
  const deps = { cuts: program.domain.sources.cuts, types: program.interner, typeWork: program.base.declarations.typeWork, rules: program.inputs.inference.rules, nodeOf: program.domain.nodeOf, bindingOf: program.inputs.inference.bindingOf,
    nominalOf: program.scopes.nominalOf, bindingScopeOf: program.inputs.inference.bindingScopeOf,
    typeOf: type => types.readType(program.interner, type), signatureOf: signature => types.readSignature(program.interner, signature),
    staticStorageOf: () => null,
    enumValueTypeOf: () => assert.fail("This fixture has no enum value occurrence."),
    checkerDiagnosticsOf: () => program.checked.checkerDiagnostics };
  const elaborate = body => {
    const record = records.get(body.body);
    const result = wiring.elaborate.elaborate(deps, { instance: { body: body.body, bindings: { kind: "parametric" } },
      scope: program.descriptions.get(body.owner).generics, body, layoutAlias: null, typing: readyTyping(record.constraints, record.solution),
      nestedBodies: body.nestedBodies.map(nested => typed.get(nested)), initializers: [] });
    assert.equal(result.kind, "ok");
    typed.set(body.body, result.value);
    return result.value;
  };
  const callable = elaborate(body);
  const moduleBody = program.checked.bodies.find(body => body.root.kind === "SourceFile");
  const module = elaborate(moduleBody);
  const selected = callable.root.statements.nodes[0].expression;
  assert.equal(selected.tsonic.type, from.value.type);
  assert.equal(selected.tsonic.convertedType, to.value.type);
  assert.equal(selected.tsonic.conversion.kind, "convert");
  assert.equal(selected.tsonic.conversion.operation.decision.operation.embedding === embedding, true);
  if (kind === "string") assert.equal(selected.tsonic.value, expected);
  const publication = { module: program.checked.module, tree: { kind: "ready-root", root: module.root }, bodies: [...typed.values()] };
  const verifier = { source: program.checked, module: publication, types: types.viewTypes(program.interner),
    staticStorageOf: () => null,
    declarationOf: program.declarationOf, declarationSourceOf: program.domain.declarationSourceOf, memberTableOf: () => null, nominalOf: () => null,
    bodyOf: instance => instance.bindings.kind === "parametric" ? typed.get(instance.body) ?? null : null,
    nodeOf: program.domain.nodeOf, localExists: program.domain.localExists, diagnostics: program.checked.checkerDiagnostics,
    layoutAliasOf: null,
    bindingScopesOf: suppliedTirScopes(target => {
      if (target.kind === "module") return target.module === program.checked.module ? [] : null;
      const body = program.domain.bodyOf.get(target.instance.body);
      const scope = program.descriptions.get(body?.owner)?.generics;
      return scope === undefined ? null : body.root.kind === "SourceFile" ? [scope, scope,
        program.descriptions.get(callable.owner).generics] : [scope];
    }) };
  const tir = await import("../../packages/host/dist/ir-tir/index.js");
  const verifyBody = await tirFixtureBodyVerifier(tir.verifyTir);
  const verifyChapter = await tirFixtureVerifier(tir.verifyTirModule);
  assert.deepEqual(verifyChapter(verifier, publication), []);
  for (const body of typed.values()) assert.deepEqual(verifyBody(verifier, body), []);
  assert.equal(program.database.trace().some(event => event.kind === "dependency" && event.state === "active"), false);
});


for (const [authored, annotation, expected] of [["true", "boolean", true], ["false", "boolean", false],
  ['""', "string", ""], ['"a\\nΩ"', "string", "a\nΩ"], ["null", null, null]])
test(`real ${annotation === null ? "inferred" : "annotated"} ${authored} default completes independently and the selected header reuses its one initializer expression`, async () => {
  const annotationText = annotation === null ? "" : `: ${annotation}`;
  const program = ready(`export function value(input${annotationText} = ${authored})${annotationText} { return input; }\n`);
  const { types } = fixture;
  const declared = program.database.run(program.queries.declaredSignatureOf, program.signature);
  assert.equal(declared.kind, "completed");
  const parameterType = declared.value.parameters[0].type;
  const records = new Map();
  for (const group of program.inputs.groups) {
    const answer = program.database.run(program.queries.solutionOf, group.id);
    assert.equal(answer.kind, "completed");
    assert.equal(answer.diagnostics.length, 0);
    assert.equal(answer.value.positions.every(position => position.error === null), true);
    for (const set of answer.value.constraints.constraints) records.set(set.body, { ...answer.value, constraints: set });
  }
  const owner = program.checked.tree.statements.nodes[0];
  const parameter = owner.parameters.nodes[0];
  const callableSource = program.checked.bodies.find(body => body.root.kind === "Block");
  const initializerSource = program.domain.bodyOf.get(parameter.tsonic.initializer);
  const initializerRecord = records.get(initializerSource.body);
  if (annotation === null) {
    assert.equal(parameter.type, null);
    assert.equal(initializerRecord.group.signatures.length, 1);
    assert.deepEqual(initializerRecord.group.signatures[0], { definition: callableSource.owner, part: { kind: "parameter-initializer", index: 0 } });
    assert.equal(initializerRecord.solution.variables.length, 1);
    assert.equal(initializerRecord.solution.variables[0].value.type, parameterType);
    assert.equal(initializerRecord.solution.variables[0].error, null);
    assert.deepEqual(types.readType(program.interner, parameterType), { kind: "intrinsic", intrinsic: "absence" });
    assert.equal(initializerRecord.solution.constraints[0].decision.embedding.kind, "identity");
  } else {
    assert.equal(initializerRecord.group.signatures.length, 0, "the explicit annotation has no fabricated inferred part");
    assert.deepEqual(initializerRecord.constraints.evidence[1].value.component,
      { kind: "item", value: { owner: initializerSource.owner, node: parameter.type.id } });
    assert.equal(initializerRecord.solution.variables.length, 0);
    assert.equal(initializerRecord.solution.constraints[0].decision.embedding.conversion, "literal-fit");
  }
  const typed = new Map();
  const deps = { cuts: program.domain.sources.cuts, types: program.interner, typeWork: program.base.declarations.typeWork, rules: program.inputs.inference.rules, nodeOf: program.domain.nodeOf, bindingOf: program.inputs.inference.bindingOf,
    nominalOf: program.scopes.nominalOf, bindingScopeOf: program.inputs.inference.bindingScopeOf,
    typeOf: type => types.readType(program.interner, type), signatureOf: signature => types.readSignature(program.interner, signature),
    staticStorageOf: () => null,
    enumValueTypeOf: () => assert.fail("This fixture has no enum value occurrence."),
    checkerDiagnosticsOf: () => program.checked.checkerDiagnostics };
  const inputOf = body => ({ instance: { body: body.body, bindings: { kind: "parametric" } },
    scope: program.descriptions.get(body.owner).generics, body, layoutAlias: null,
    typing: readyTyping(records.get(body.body).constraints, records.get(body.body).solution),
    nestedBodies: body.nestedBodies.map(nested => typed.get(nested)),
    initializers: body.params.filter(parameter => parameter.initializer !== null).map(parameter => typed.get(parameter.initializer)) });
  const elaborate = body => {
    const result = wiring.elaborate.elaborate(deps, inputOf(body));
    assert.equal(result.kind, "ok");
    typed.set(body.body, result.value);
    return result.value;
  };
  if (annotation === null) {
    const input = inputOf(initializerSource);
    const variable = input.typing.constraints.variables[0];
    for (const signature of [
      { ...variable.signature, part: { kind: "parameter-initializer", index: 1 } },
      { definition: initializerSource.owner, part: { kind: "return" } },
    ]) assert.throws(() => wiring.elaborate.elaborate(deps, { ...input,
      typing: { ...input.typing, constraints: { ...input.typing.constraints, variables: [{ ...variable, signature }] } } }), /inferred/u);
  }
  const initializer = elaborate(initializerSource);
  assert.equal(initializer.root.id, parameter.initializer.id);
  assert.equal(initializer.root.tsonic.convertedType, parameterType);
  assert.equal(types.readSignature(program.interner, initializer.signature).declaration, null);
  assert.equal(initializer.completion, parameterType);
  assert.throws(() => wiring.elaborate.elaborate(deps, { ...inputOf(callableSource), initializers: [] }), /exactly the actual selected/u);
  for (const wrong of [{ ...initializer, owner: callableSource.owner },
    { ...initializer, completion: insertFixtureType(types, program.interner, { kind: "intrinsic", intrinsic: "never" }) },
    { ...initializer, root: { ...initializer.root, id: callableSource.root.id } }])
    assert.throws(() => wiring.elaborate.elaborate(deps, { ...inputOf(callableSource), initializers: [wrong] }), /checked owner, expression and selected result/u);
  assert.throws(() => wiring.elaborate.elaborate(deps, { ...inputOf(callableSource), initializers: [initializer, initializer] }), /unique completed body/u);
  const callable = elaborate(callableSource);
  assert.equal(callable.params[0].initializer.kind, "ready-default");
  assert.equal(callable.params[0].initializer.root === initializer.root, true, "one initializer syntax node, never callable replay");
  assert.equal(callable.params[0].tsonic.initializer, initializer.body);
  assert.equal(callable.params[0].tsonic.role, "default");
  assert.equal("acceptsOmission" in callable.params[0].tsonic, false);
  const signature = types.readSignature(program.interner, callable.signature);
  assert.equal(signature.parameters[0].acceptsOmission, true);
  assert.equal(signature.parameters[0].initializer, initializer.body);
  const outer = elaborate(program.checked.bodies.find(body => body.root.kind === "SourceFile"));
  assert.equal(outer.root.statements.nodes[0].node.parameters.nodes[0] === callable.params[0], true);
  if (annotation === "string") assert.equal(initializer.root.tsonic.value, expected);
  const publication = { module: program.checked.module, tree: { kind: "ready-root", root: outer.root }, bodies: [...typed.values()] };
  const verifier = { source: program.checked, module: publication, types: types.viewTypes(program.interner),
    staticStorageOf: () => null,
    declarationOf: program.declarationOf, declarationSourceOf: program.domain.declarationSourceOf, memberTableOf: () => null, nominalOf: () => null,
    bodyOf: instance => instance.bindings.kind === "parametric" ? typed.get(instance.body) ?? null : null,
    nodeOf: program.domain.nodeOf, localExists: program.domain.localExists, diagnostics: program.checked.checkerDiagnostics,
    layoutAliasOf: null,
    bindingScopesOf: suppliedTirScopes(target => {
      if (target.kind === "module") return target.module === program.checked.module ? [] : null;
      const body = program.domain.bodyOf.get(target.instance.body);
      const scope = program.descriptions.get(body?.owner)?.generics;
      return scope === undefined ? null : body.root.kind === "SourceFile" ? [scope, scope,
        program.descriptions.get(callable.owner).generics] : [scope];
    }) };
  const tir = await import("../../packages/host/dist/ir-tir/index.js");
  const verifyBody = await tirFixtureBodyVerifier(tir.verifyTir);
  const verifyChapter = await tirFixtureVerifier(tir.verifyTirModule);
  assert.deepEqual(verifyChapter(verifier, publication), []);
  for (const body of typed.values()) assert.deepEqual(verifyBody(verifier, body), []);
  const bindings = { kind: "instantiated", bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } };
  for (const body of [initializerSource, callableSource]) {
    const scope = program.descriptions.get(body.owner).generics;
    assert.deepEqual([scope.classParameters.length, scope.methodParameters.length, scope.capturedParameters.length, scope.selfOwners.length], [0, 0, 0, 0]);
  }
  const select = (body, initializers) => {
    const actual = inputOf(body);
    const selected = wiring.elaborate.elaborate(deps, { ...actual,
      instance: { body: body.body, bindings }, typing: { ...actual.typing, template: typed.get(body.body) }, initializers });
    assert.equal(selected.kind, "ok");
    return selected.value;
  };
  const selectedInitializer = select(initializerSource, []);
  assert.equal(selectedInitializer.root === initializer.root, false, "selected default replays its own checked input, not the callable syntax");
  assert.throws(() => select(callableSource, [initializer]), /same actual bindings/u);
  const selectedCallable = select(callableSource, [selectedInitializer]);
  assert.equal(selectedCallable.params[0].initializer.kind, "ready-default");
  assert.equal(selectedCallable.params[0].initializer.root === selectedInitializer.root, true);
  const selectedPublication = { ...publication, bodies: [...publication.bodies, selectedInitializer, selectedCallable] };
  const selectedVerifier = { ...verifier, module: selectedPublication,
    bodyOf: instance => instance.bindings.kind === "parametric" ? verifier.bodyOf(instance)
      : types.artifactBindingsKey(instance.bindings) !== types.artifactBindingsKey(bindings) ? null
      : instance.body === selectedInitializer.body ? selectedInitializer : instance.body === selectedCallable.body ? selectedCallable : null,
    requiredEntriesOf: instance => [selectedInitializer, selectedCallable].some(actual => actual.body === instance.body &&
      types.artifactBindingsKey(actual.bindings) === types.artifactBindingsKey(instance.bindings)) ? [0] : null,
    layoutAliasOf: null,
    bindingScopesOf: (target, subject, visit) => target.kind === "body" && target.instance.bindings.kind === "instantiated"
      ? { kind: "complete", scopes: [program.descriptions.get(program.domain.bodyOf.get(target.instance.body).owner).generics,
        program.descriptions.get(program.domain.bodyOf.get(target.instance.body).owner).generics] }
      : verifier.bindingScopesOf(target, subject, visit) };
  assert.deepEqual(verifyChapter(selectedVerifier, selectedPublication), []);
  assert.deepEqual(verifyBody(selectedVerifier, selectedInitializer), []);
  assert.deepEqual(verifyBody(selectedVerifier, selectedCallable), []);
  assert.equal(program.database.trace().some(event => event.kind === "dependency" && event.state === "active"), false);
});

test("an actual null return completes its inferred declaration and selected body with the one native absence type", async () => {
  const program = ready("export function absent() { return (null); }\n");
  const { types } = fixture;
  const declared = program.database.run(program.queries.declaredSignatureOf, program.signature);
  assert.equal(declared.kind, "completed");
  assert.deepEqual(types.readType(program.interner, declared.value.result), { kind: "intrinsic", intrinsic: "absence" });
  assert.equal(declared.diagnostics.length, 0);
  const records = new Map();
  for (const group of program.inputs.groups) {
    const answer = program.database.run(program.queries.solutionOf, group.id);
    assert.equal(answer.kind, "completed");
    assert.equal(answer.diagnostics.length, 0);
    assert.equal(answer.value.positions.every(position => position.error === null), true);
    for (const set of answer.value.constraints.constraints) records.set(set.body, { ...answer.value, constraints: set });
  }
  const typed = new Map();
  const deps = { cuts: program.domain.sources.cuts, types: program.interner, typeWork: program.base.declarations.typeWork, rules: program.inputs.inference.rules, nodeOf: program.domain.nodeOf, bindingOf: program.inputs.inference.bindingOf,
    nominalOf: program.scopes.nominalOf, bindingScopeOf: program.inputs.inference.bindingScopeOf,
    typeOf: type => types.readType(program.interner, type), signatureOf: signature => types.readSignature(program.interner, signature),
    staticStorageOf: () => null,
    enumValueTypeOf: () => assert.fail("This fixture has no enum value occurrence."),
    checkerDiagnosticsOf: () => program.checked.checkerDiagnostics };
  const inputOf = body => ({ instance: { body: body.body, bindings: { kind: "parametric" } },
    scope: program.descriptions.get(body.owner).generics, body, layoutAlias: null,
    typing: readyTyping(records.get(body.body).constraints, records.get(body.body).solution),
    nestedBodies: body.nestedBodies.map(nested => typed.get(nested)), initializers: [] });
  const callableSource = program.checked.bodies.find(body => body.root.kind === "Block");
  const moduleSource = program.checked.bodies.find(body => body.root.kind === "SourceFile");
  const original = inputOf(callableSource);
  const variable = original.typing.constraints.variables.find(variable => variable.kind === "signature");
  assert.equal(variable.signature.part.kind, "return");
  for (const changed of [
    { ...original, typing: { ...original.typing, constraints: { ...original.typing.constraints, variables: [{ ...variable,
      signature: { ...variable.signature, definition: moduleSource.owner } }] } } },
    { ...original, typing: { ...original.typing, constraints: { ...original.typing.constraints, variables: [{ ...variable,
      signature: { ...variable.signature, part: { kind: "yield" } } }] } } },
    { ...original, typing: { ...original.typing, constraints: { ...original.typing.constraints, variables: [{ ...variable,
      occurrence: { ...variable.occurrence, node: callableSource.root.statements.nodes[0].id } }] } } },
    { ...original, typing: { ...original.typing, solution: { ...original.typing.solution, variables: [] } } },
  ]) assert.throws(() => wiring.elaborate.elaborate(deps, changed), /inferred|unfinalized/u);
  const foreign = insertFixtureType(types, program.interner, { kind: "open", group: records.get(moduleSource.body).group.id, variable: variable.id });
  assert.throws(() => wiring.elaborate.elaborate(deps, { ...original, typing: { ...original.typing, constraints: { ...original.typing.constraints,
    constraints: original.typing.constraints.constraints.map(constraint => ({ ...constraint, to: foreign })) } } }), /another group/u);
  for (const body of [callableSource, moduleSource]) {
    const answer = wiring.elaborate.elaborate(deps, inputOf(body));
    assert.equal(answer.kind, "ok");
    typed.set(body.body, answer.value);
  }
  const callable = typed.get(callableSource.body);
  assert.equal(callable.completion, declared.value.result);
  const returned = callable.root.statements.nodes[0].expression;
  assert.equal(returned.expression.kind, "NullKeyword");
  assert.equal(returned.expression.tsonic.type, declared.value.result);
  assert.equal(returned.expression.tsonic.convertedType, declared.value.result);
  const scope = program.descriptions.get(callable.owner).generics;
  assert.deepEqual([scope.classParameters, scope.methodParameters, scope.capturedParameters, scope.selfOwners], [[], [], [], []]);
  const bindings = { kind: "instantiated", bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } };
  const selected = wiring.elaborate.elaborate(deps, { ...inputOf(callableSource),
    instance: { body: callable.body, bindings }, typing: { ...original.typing, template: callable } });
  assert.equal(selected.kind, "ok");
  const publication = { module: program.checked.module, tree: { kind: "ready-root", root: typed.get(moduleSource.body).root },
    bodies: [...typed.values(), selected.value] };
  const verifier = { source: program.checked, module: publication, types: types.viewTypes(program.interner),
    staticStorageOf: () => null,
    declarationOf: program.declarationOf, declarationSourceOf: program.domain.declarationSourceOf, memberTableOf: () => null, nominalOf: () => null,
    bodyOf: instance => instance.bindings.kind === "parametric" ? typed.get(instance.body) ?? null
      : instance.body === callable.body && types.artifactBindingsKey(instance.bindings) === types.artifactBindingsKey(bindings) ? selected.value : null,
    nodeOf: program.domain.nodeOf, localExists: program.domain.localExists, diagnostics: program.checked.checkerDiagnostics,
    layoutAliasOf: null,
    bindingScopesOf: suppliedTirScopes(target => target.kind === "module" ? target.module === program.checked.module ? [] : null
      : target.instance.body === callable.body ? target.instance.bindings.kind === "parametric" ? [scope] : [scope, scope]
      : target.instance.body === moduleSource.body && target.instance.bindings.kind === "parametric"
        ? [program.descriptions.get(moduleSource.owner).generics, program.descriptions.get(moduleSource.owner).generics, scope] : null) };
  const tir = await import("../../packages/host/dist/ir-tir/index.js");
  const verifyBody = await tirFixtureBodyVerifier(tir.verifyTir);
  const verifyChapter = await tirFixtureVerifier(tir.verifyTirModule);
  assert.deepEqual(verifyChapter(verifier, publication), []);
  for (const body of publication.bodies) assert.deepEqual(verifyBody(verifier, body), []);
  assert.equal(program.database.trace().some(event => event.kind === "dependency" && event.state === "active"), false);
});

test("the production checked namespace retains exact body/item membership and declaration sources without global-node fallback", () => {
  const program = ready("export function add(a: number, b: number): number { return a + b; }\n");
  const views = checkedInputs.checkedSourceViews(program.base.declarations.modules);
  const module = program.checked;
  const body = module.bodies.find(body => body.root.kind === "Block");
  const outer = module.bodies.find(body => body.root.kind === "SourceFile");
  const definition = views.declarationSourceOf(body.owner);
  assert.equal(definition.kind, "item");
  assert.equal(definition.value.owner, body.owner);
  assert.equal(views.nodeOf(definition) === module.tree.statements.nodes[0], true);
  assert.equal(views.bodies.get(body.body) === body, true);
  assert.equal(views.nodeOf({ kind: "body", value: { body: body.body, node: body.root.id } }) === body.root, true);
  assert.equal(views.nodeOf({ kind: "body", value: { body: body.body, node: outer.root.id } }), null);
  assert.equal(views.nodeOf({ kind: "body", value: { body: outer.body, node: body.root.id } }), null);
  assert.equal(views.nodeOf({ kind: "item", value: { owner: body.owner, node: body.root.id } }), null);
  assert.equal(views.nodeOf({ kind: "item", value: { owner: outer.owner, node: definition.value.node } }), null);
  assert.equal(views.nodeOf({ kind: "body", value: { body: "missing", node: body.root.id } }), null);
  assert.equal(views.nodeOf({ kind: "item", value: { owner: "missing", node: definition.value.node } }), null);
  assert.equal(views.declarationSourceOf("missing"), null);
  assert.equal(views.localExists({ body: body.body, local: body.params[0].local }), true);
  assert.equal(views.localExists({ body: outer.body, local: body.params[0].local }), false);
  for (const local of [-1, -0, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(views.localExists({ body: body.body, local }), false);
  for (const node of [-1, -0, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(views.nodeOf({ kind: "body", value: { body: body.body, node } }), null);
  for (const [index, actual] of body.locals.entries())
    assert.equal(views.localExists({ body: body.body, local: index }), actual.id === index);
  const parameter = module.tree.statements.nodes[0].parameters.nodes[0];
  const parameterSource = views.declarationSourceOf(module.items.find(item => item.node === parameter.id).definition);
  assert.equal(views.nodeOf(parameterSource) === parameter, true);
  assert.equal(views.nodeOf({ kind: "body", value: { body: body.body, node: parameter.id } }) === parameter, true);
  assert.equal(views.nodeOf({ kind: "body", value: { body: outer.body, node: parameter.id } }), null);
  assert.equal(views.nodeOf({ kind: "body", value: { body: body.body, node: parameter.name.id } }) === parameter.name, true);
  assert.equal(views.nodeOf({ kind: "item", value: { owner: body.owner, node: parameter.id } }), null);
});

test("checked execution headers retain their genuine body/item join without absorbing the separately placed default", () => {
  const program = ready("export function value(argument: boolean = true): boolean { return argument; }\n");
  const modules = program.base.declarations.modules;
  const module = program.checked;
  const callable = module.tree.statements.nodes[0];
  const header = callable.parameters.nodes[0];
  const body = module.bodies.find(body => body.body === callable.tsonic.body);
  const child = module.bodies.find(body => body.body === header.tsonic.initializer);
  const views = checkedInputs.checkedSourceViews(modules);
  assert.equal(views.nodeOf({ kind: "body", value: { body: body.body, node: header.id } }) === header, true);
  assert.equal(views.nodeOf({ kind: "body", value: { body: child.body, node: child.root.id } }) === child.root, true);
  assert.equal(views.nodeOf({ kind: "body", value: { body: body.body, node: child.root.id } }), null);
  assert.equal(views.nodeOf({ kind: "body", value: { body: child.body, node: header.id } }), null);
  const local = body.locals[body.params[0].local];
  assert.equal(local.declaration.kind, "item");
  assert.equal(views.nodeOf(local.declaration) === header, true);
  for (const changes of [{ role: "binding" }, { declaration: { kind: "item", value: { owner: body.owner, node: header.id } } },
    { declaration: { kind: "item", value: { owner: local.declaration.value.owner, node: child.root.id } } }]) {
    const changed = { ...body, locals: body.locals.map(row => row === local ? { ...row, ...changes } : row) };
    assert.throws(() => checkedInputs.checkedSourceViews(modules.map(entry => ({ ...entry, module: { ...entry.module,
      bodies: entry.module.bodies.map(row => row === body ? changed : row) } }))), /checked parameter domain/u);
  }
});

test("the checked namespace rejects duplicated identities and foreign/extra syntax rows rather than publishing a partial source view", () => {
  const program = ready("export function add(a: number, b: number) { return a + b; }\n");
  const module = program.base.declarations.modules[0];
  assert.throws(() => checkedInputs.checkedSourceViews([module, module]), /unique body identities/u);
  assert.throws(() => checkedInputs.checkedSourceViews([{ ...module,
    module: { ...module.module, bodies: [...module.module.bodies, module.module.bodies[0]] } }]), /unique body identities/u);
  assert.throws(() => checkedInputs.checkedSourceViews([{ ...module,
    module: { ...module.module, items: [...module.module.items, module.module.items[0]] } }]), /unique identities/u);
  assert.throws(() => checkedInputs.checkedSourceViews([{ ...module, nodes: [...module.nodes, module.nodes[0]] }]), /outside its actual tree/u);
  assert.throws(() => checkedInputs.checkedSourceViews([{ ...module, nodes: module.nodes.map((node, index) => index === 0 ? { ...node } : node) }]), /actual dense canonical/u);
});

test("the actual annotated declaration row retains its typed request and a verified whole-group solution uses unmemoised placement", () => {
  const program = ready("export function add(a: number, b: number): number { return a + b; }\n");
  const signature = program.database.run(program.queries.declaredSignatureOf, program.signature);
  assert.equal(signature.kind, "completed");
  assert.equal(signature.diagnostics.length, 0);
  const scope = program.descriptions.get(program.signature.definition).generics;
  assert.deepEqual([scope.classParameters.length, scope.methodParameters.length, scope.capturedParameters.length, scope.selfOwners.length], [0, 0, 0, 0]);
  for (const group of program.inputs.groups) {
    const outcome = program.database.run(program.queries.solutionOf, group.id);
    assert.equal(outcome.kind, "completed");
    assert.equal(outcome.value.group === group, true);
    assert.equal(outcome.value.constraints.constraints.length, group.bodies.length);
    assert.equal(outcome.value.positions.every(position => position.error === null), true);
    assert.equal(program.database.errorOf({ request: { query: program.queries.solutionOf.name, key: group.id },
      position: { kind: "result" } }).kind, "completed");
  }
  const cached = program.database.run(program.queries.declaredSignatureOf, { ...program.signature });
  assert.equal(cached.kind, "completed");
  assert.equal(cached.value === signature.value, true);
  assert.equal(program.database.trace().some(event => event.kind === "dependency" && event.state === "active"), false);
  assert.deepEqual(program.database.stats().map(stat => stat.name).sort(), ["declaredSignatureOf", "solutionOf"]);
});

test("a real omitted return demands its one canonical group and projects its actual verified completed variable", () => {
  const program = ready("export function add(a: number, b: number) { return a + b; }\n");
  const outcome = program.database.run(program.queries.declaredSignatureOf, program.signature);
  assert.equal(outcome.kind, "completed");
  assert.deepEqual(fixture.types.readType(program.interner, outcome.value.result), { kind: "primitive", primitive: "float64" });
  const group = program.inputs.groups.find(group => group.signatures.some(part => part.part.kind === "return"));
  const solved = program.database.run(program.queries.solutionOf, group.id);
  assert.equal(solved.kind, "completed");
  const part = group.signatures.find(part => part.part.kind === "return");
  const unit = { query: program.queries.solutionOf.name, key: group.id };
  const projected = inferenceStep.projectInferredPart(unit, solved.value, { kind: "inferred-part", part }, program.database.errorOf);
  assert.equal(projected.type, outcome.value.result);
  assert.equal(projected.error, null);
  assert.deepEqual(projected.origin, { request: unit, position: { kind: "inference-variable", group: group.id, variable: 0 } });
  assert.equal(program.database.trace().some(event => event.kind === "dependency" && event.state === "active"), false);
  assert.equal(program.database.trace().some(event => event.kind === "dependency" && event.from?.query === "solutionOf"
    && event.to.query === "declaredSignatureOf" && event.to.encodedKey === fixture.ids.encodeKey(fixture.types.signatureRequestData(program.signature))), false,
    "the current group never requests its own completed declaration");
});

test("real select default G1 completes before G2 and both declaration slots use the same projected origins", () => {
  const program = ready("export function select(a: number, b = a) { return b; }\n");
  const outcome = program.database.run(program.queries.declaredSignatureOf, program.signature);
  assert.equal(outcome.kind, "completed");
  assert.deepEqual(fixture.types.readType(program.interner, outcome.value.parameters[1].type), { kind: "primitive", primitive: "float64" });
  assert.equal(outcome.value.parameters[1].type, outcome.value.result);
  const initializer = program.inputs.groups.find(group => group.signatures.some(part => part.part.kind === "parameter-initializer"));
  const returned = program.inputs.groups.find(group => group.signatures.some(part => part.part.kind === "return"));
  const completions = program.database.trace().filter(event => event.kind === "completion" && event.fact.query === "solutionOf");
  assert.equal(completions.findIndex(event => event.fact.key === initializer.id) < completions.findIndex(event => event.fact.key === returned.id), true);
  for (const group of [initializer, returned]) {
    const solved = program.database.run(program.queries.solutionOf, group.id);
    assert.equal(solved.kind, "completed");
    for (const part of group.signatures) {
      const answer = inferenceStep.projectInferredPart({ query: "solutionOf", key: group.id }, solved.value,
        { kind: "inferred-part", part }, program.database.errorOf);
      assert.equal(answer.error, null);
      assert.equal(program.database.errorOf(answer.origin).kind, "completed");
    }
  }
  assert.equal(program.database.stats().find(stat => stat.name === "solutionOf").computed, 2);
  assert.equal(program.database.trace().some(event => event.kind === "dependency" && event.state === "active"), false);
});

test("ready annotated recursive endpoints do not turn declared recursion into an active complete-key cycle", () => {
  const program = ready("export function first(value: number): number { return second(value); }\nfunction second(value: number): number { return first(value); }\n");
  for (const node of program.checked.tree.statements.nodes) {
    const endpoint = node.tsonic.signatures.find(endpoint => endpoint.role === "api-body");
    const result = program.database.run(program.queries.declaredSignatureOf, { definition: endpoint.declaration,
      endpoint: endpoint.role, ordinal: 0, bindings: { kind: "parametric" } });
    assert.equal(result.kind, "completed");
    assert.equal(result.diagnostics.length, 0);
  }
  assert.equal(program.database.trace().filter(event => event.kind === "dependency" && event.from !== null).length, 0);
});

test("unknown partition ownership and malformed projection inputs never become a known-null part", () => {
  const program = ready("export function add(a: number, b: number) { return a + b; }\n");
  const group = program.inputs.groups.find(group => group.signatures.length !== 0);
  const outcome = program.database.run(program.queries.solutionOf, group.id);
  assert.equal(outcome.kind, "completed");
  const request = { kind: "inferred-part", part: group.signatures[0] };
  const unit = { query: "solutionOf", key: group.id };
  assert.throws(() => inferenceStep.projectInferredPart({ ...unit, key: "another-group" }, outcome.value, request, program.database.errorOf), /actual completed solution group/u);
  assert.throws(() => inferenceStep.projectInferredPart(unit, outcome.value,
    { ...request, part: { ...request.part, part: { kind: "yield" } } }, program.database.errorOf), /actual owned signature variable/u);
  assert.throws(() => inferenceStep.projectInferredPart(unit, outcome.value, request, () => ({ kind: "uncomputed" })), /verified completed variable/u);
  assert.throws(() => inferenceStep.projectInferredPart(unit, outcome.value, request, () => ({ kind: "completed", error: { kind: "error", causes: [] } })), /original finalized error/u);
  assert.throws(() => program.database.run(program.queries.solutionOf, "unknown-group"), /absent from the ready checked partition/u);
  assert.throws(() => registration.createSourceSemanticQueries(program.base, { ...program.inputs, groups: [...program.inputs.groups, group] }), /each nonempty group once/u);
  assert.throws(() => registration.createSourceSemanticQueries(program.base, { ...program.inputs,
    groups: program.inputs.groups.map(candidate => candidate === group ? { ...candidate, bodies: [] } : candidate) }), /each nonempty group once/u);
});

test("the actual solution resource refusal retains its original diagnostic without a completed partial answer", () => {
  const program = ready("export function add(a: number, b: number) { return a + b; }\n");
  const inputs = { ...program.inputs, inference: { ...program.inputs.inference,
    limits: { ...LIMITS, maximumVariablesPerGroup: 0 } } };
  const { queries } = registration.createSourceSemanticQueries(program.base, inputs);
  const database = query.createDatabase(program.base, { maximumRecords: 65536 }, () => assert.fail("no cycle in this refusal case"), "recorded");
  const group = inputs.groups.find(group => group.signatures.length !== 0);
  const result = database.run(queries.solutionOf, group.id);
  assert.equal(result.kind, "refused");
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
  assert.equal(database.errorOf({ request: { query: queries.solutionOf.name, key: group.id }, position: { kind: "result" } }).kind, "refused");
  assert.equal(database.trace().some(event => event.kind === "completion" && event.outcome === "ok"), false);
  assert.equal(database.diagnostics()[0] === result.diagnostics[0], true);
});

test("actual demand witnesses retain checked source and borrow the real pause prefix only while unresolved", () => {
  const program = ready("export function select(a: number, b = a) { return b; }\n");
  const observe = (program, registered, key, samples) => {
    const data = registered.keyData(key);
    const context = { inputs: program.base, fact: { query: registered.name, key: data, encodedKey: fixture.ids.encodeKey(data) },
      errorOf: program.database.errorOf,
      get: (dependency, request, pending, resume) => ({ kind: "dependency",
        schedule: scheduler => scheduler.request(dependency, request, pending, resume) }) };
    let step = registered.compute(context, key);
    while (step.kind === "dependency") {
      let next;
      step.schedule({ request: (dependency, key, pending, resume) => {
        const witness = pending.witness;
        samples.push({ kind: witness.kind, source: witness.source, count: witness.ready.length,
          original: witness.kind === "declared-signature" ? witness.state.request : null,
          target: witness.target.kind });
        const actual = program.database.run(dependency, key);
        assert.equal(actual.kind, "completed");
        next = resume(actual.value);
      } });
      assert.equal(next !== undefined, true);
      step = next;
    }
    return step;
  };
  const signatures = [];
  const result = observe(program, program.queries.declaredSignatureOf, program.signature, signatures);
  assert.equal(result.kind, "ok");
  assert.deepEqual(signatures.map(sample => sample.count), [0, 1]);
  const source = program.domain.declarationSourceOf(program.signature.definition);
  assert.equal(signatures.every(sample => sample.original === program.signature), true);
  for (const sample of signatures) {
    assert.deepEqual(sample.source, source);
    assert.equal(sample.target, "inference-solution");
    assert.equal(program.domain.nodeOf(sample.source) !== null, true);
  }
  const other = ready("export function select(a: number, b = a) { return b; }\n");
  const group = other.inputs.groups.find(group => group.signatures.some(part => part.part.kind === "return"));
  const inference = [];
  assert.equal(observe(other, other.queries.solutionOf, group.id, inference).kind, "ok");
  assert.equal(inference.length, 1);
  assert.equal(inference[0].kind, "inference");
  assert.equal(inference[0].source.kind, "body");
  assert.equal(inference[0].source.value.body, group.bodies[0]);
  assert.equal(inference[0].source.value.node, other.domain.bodyOf.get(group.bodies[0]).root.id);
  assert.equal(inference[0].count, 0);
});

for (const annotation of [": {a:boolean; z:boolean}", ""]) test(`an actual object literal retains authored part order ${annotation ? "with" : "without"} contextual destination`, () => {
  const program = ready(`export function build(first:boolean,second:boolean)${annotation} { return {z:first,a:second}; }`);
  const body = program.checked.bodies.find(row => row.root.kind === "Block");
  const group = program.inputs.groups.find(row => row.bodies.includes(body.body));
  const prepare = () => {
    const pending = wiring.infer.constraintsOf(program.inputs.inference, group);
    if (pending.kind === "done") return pending.value;
    const answers = pending.requests.map(asked => {
      assert.equal(asked.kind, "declaredSignatureOf");
      const answer = program.database.run(program.queries.declaredSignatureOf, asked.request);
      assert.equal(answer.kind, "completed");
      return { kind: asked.kind, value: answer.value };
    });
    const generated = wiring.infer.resumeConstraintsOf(program.inputs.inference, pending.paused, answers);
    assert.equal(generated.kind, "done");
    return generated.value;
  };
  const literal = body.root.statements.nodes[0].expression;
  const { read, contextual } = literal.tsonic.value.views;
  assert.equal(read.kind, "available");
  assert.equal(contextual.kind, "available");
  assert.equal(contextual.value === null, annotation === "");
  const generated = prepare();
  assert.equal(generated.kind, "ok");
  const set = generated.value.constraints.find(row => row.body === body.body);
  const [construction, resultFlow] = set.constraints;
  const authored = literal.properties.nodes;
  const nodeRef = node => ({ body: body.body, node: node.id });
  assert.deepEqual(authored.map(property => property.name.text), ["z", "a"]);
  assert.deepEqual(construction, { kind: "construct-literal", occurrence: nodeRef(literal), construction: "object",
    parts: authored.map(property => ({ kind: "property", occurrence: nodeRef(property),
      key: property.tsonic.key.value, type: property.initializer.tsonic.value.views.read.value })),
    destination: contextual.value, result: read.value, inferredResult: null });
  assert.equal(resultFlow.kind, "flow");
  assert.equal(resultFlow.from, read.value);
  assert.deepEqual(set.evidence.slice(0, authored.length).map(row => row.value.component),
    authored.map(property => ({ kind: "body", value: nodeRef(property.initializer) })));
  assert.deepEqual(irInfer.parseConstraints(irInfer.printConstraints(set)), { kind: "parsed", value: set });
  const origins = authored[0].tsonic.origins;
  authored[0].tsonic.origins = authored[1].tsonic.origins;
  assert.throws(prepare, /its actual checked source property/u);
  authored[0].tsonic.origins = origins;
  assert.equal(prepare().kind, "ok");
});

test("an empty source object has a checked zero-part construction, not an empty callable", () => {
  const program = ready("export function build() { return {}; } export type Empty = {}; export interface Nominal {} export type Reference = Nominal;");
  const source = program.checked.bodies.find(body => body.root.kind === "Block");
  const literal = source.root.statements.nodes[0].expression;
  const checked = literal.tsonic.value.views;
  assert.equal(checked.read.kind, "available");
  const shape = { kind: "shape", calls: [], constructs: [], members: [], indexes: [] };
  assert.deepEqual(fixture.types.readType(program.interner, checked.read.value), shape);
  assert.deepEqual(checked.contextual, { kind: "available", value: null });
  const [, alias, declared, reference] = program.checked.tree.statements.nodes;
  assert.deepEqual(fixture.types.readType(program.interner, alias.type.tsonic.type.value), shape);
  const nominal = fixture.types.readType(program.interner, reference.type.tsonic.type.value);
  assert.equal(nominal.kind, "declared");
  assert.equal(nominal.definition, declared.tsonic.definition);
  const group = program.inputs.groups.find(row => row.bodies.includes(source.body));
  const generated = wiring.infer.constraintsOf(program.inputs.inference, group);
  assert.equal(generated.kind, "done");
  assert.equal(generated.value.kind, "ok");
  const set = generated.value.value.constraints.find(row => row.body === source.body);
  const occurrence = { body: source.body, node: literal.id };
  assert.deepEqual(set.constraints[0], { kind: "construct-literal", occurrence, construction: "object", parts: [], destination: null,
    result: checked.read.value, inferredResult: null });
  assert.equal(set.evidence[0].value.type, checked.read.value);
  assert.deepEqual(set.evidence[0].value.component, { kind: "body", value: occurrence });
  assert.deepEqual(irInfer.parseConstraints(irInfer.printConstraints(set)), { kind: "parsed", value: set });
});

async function nativeInt32Input(sourceText, selected) {
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const source = 'import type { int32 as Native } from "native-fixture";\n' + sourceText;
  const root = "/project/node_modules/native-fixture";
  const reference = { package: fixture.packageOf("/semantics"), version: "1", moduleSpecifier: "./plugin.js", exportId: "semantics" };
  const semantics = { moduleSpecifier: "native-fixture", packageName: "native-fixture", packageVersion: "1.0.0",
    capabilities: ["primitive"], exports: [fixture.sdk.sourcePrimitive("int32", "int32", "number", true, 32)] };
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
    providerPackages: [{ root: "/semantics", name: "semantics" }], semanticModules: selected ? [reference] : [],
    otherPackages: [{ root, name: "native-fixture", modules: { "index.d.ts": ["declaration", "export type int32 = number;", true] } }],
    extraFiles: { [root + "/package.json"]: '{"name":"native-fixture","version":"1.0.0","types":"index.d.ts"}' } });
  const extensions = fixture.front.createCheckerExtensions(selected ? [{ reference, value: { kind: "semantics-module", value: semantics } }] : []);
  const carrierHolding = [...snapshot.nativeFacts.carrierHolding, { carrier: "int32", holding: "in-place" },
    { carrier: "tuple", holding: "in-place" }].sort((left, right) => left.carrier < right.carrier ? -1 : 1);
  return { ...analysisInput(fixture, "sdk-minimal", source), extensions,
    snapshot: { ...snapshot, nativeFacts: { ...snapshot.nativeFacts, carrierHolding } } };
}

test("checked primitive annotations retain their selected provider carrier, not the shared checker number", async () => {
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const sourceText = `
type int32 = number;
export type Qualified = Native;
export type Shadowed = int32;
export type Ordinary = number;
export type Bracketed = Native[];
export type Named = Array<Native>;
export type Optional = Native | undefined;
export function identity(value: Native): Native { return value; }`;
  for (const selected of [true, false]) {
    const inputs = await nativeInt32Input(sourceText, selected);
    const captured = captureSourceBarrier(inputs);
    assert.equal(captured.kind, "ok");
    const checked = captured.value.modules.find(row => row.module.module === inputs.snapshot.entryPoint).module;
    assert.deepEqual(checked.checkerDiagnostics, []);
    const [, qualified, shadowed, ordinary, bracketed, named, optional] = checked.tree.statements.nodes.filter(node => node.kind === "TypeAliasDeclaration");
    const carrier = declaration => {
      const answer = declaration.type.tsonic.type;
      assert.equal(answer.kind, "available");
      return fixture.types.readType(captured.value.types, answer.value);
    };
    assert.deepEqual([carrier(qualified), carrier(shadowed), carrier(ordinary)],
      [selected ? "int32" : "float64", "float64", "float64"].map(primitive => ({ kind: "primitive", primitive })));
    for (const declaration of [bracketed, named, optional]) {
      const term = carrier(declaration);
      assert.equal(term.kind, declaration === optional ? "optional" : "array");
      const element = fixture.types.readType(captured.value.types, term.kind === "optional" ? term.value : term.element);
      assert.deepEqual(element, carrier(qualified));
    }
    const identity = checked.tree.statements.nodes.find(node => node.kind === "FunctionDeclaration");
    const endpoint = identity.tsonic.signatures.find(row => row.role === "api-body");
    const signature = fixture.types.readSignature(captured.value.types, endpoint.signature);
    assert.equal(signature.result, identity.type.tsonic.type.value);
    assert.equal(signature.parameters[0].type, identity.parameters.nodes[0].type.tsonic.type.value);
    assert.deepEqual(fixture.types.readType(captured.value.types, signature.result), carrier(qualified));
  }
});

test("native tuple construction materializes exact integer constants without a floating conversion", async () => {
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const pair = value => `export function pair(): [Native, Native] { return [${value}, 2]; }`;
  const input = await nativeInt32Input(pair("2147483647"), true);
  const program = analyzeHostProgram(input);
  assert.equal(program.kind, "ok");
  const chapter = program.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const body = chapter.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "Block"
    && row.tir.root.statements.nodes[0]?.expression?.kind === "ArrayLiteralExpression");
  assert.ok(body);
  const statements = body.mir.blocks.flatMap(block => block.statements);
  assert.equal(statements.some(row => row.kind === "assign" && row.value.kind === "convert"), false);
  const aggregate = statements.find(row => row.kind === "assign" && row.value.kind === "aggregate");
  assert.equal(aggregate.value.aggregate.kind, "tuple");
  const integers = aggregate.value.aggregate.elements.map(operand => {
    assert.equal(operand.kind, "constant");
    const { type, value } = body.mir.constants[operand.constant];
    assert.deepEqual(program.value.index.types.terms[type], { kind: "primitive", primitive: "int32" });
    assert.equal(value.kind, "literal");
    assert.equal(value.value.kind, "number");
    assert.equal(value.value.value.denominator, 1n);
    return value.value.value.numerator;
  });
  assert.deepEqual(integers, [2147483647n, 2n]);
  for (const value of ["2147483648", "1.5"]) {
    const refused = analyzeHostProgram(await nativeInt32Input(pair(value), true));
    assert.equal(refused.kind, "refused", value);
    assert.deepEqual(refused.diagnostics.map(row => row.code.rendered), ["TSONIC_CONSTRUCTION_PART_FIT"]);
  }
});

test("a primitive-only registration preserves the ordinary object binding and its default", async () => {
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = await nativeInt32Input(`
export function select(o: { flag?: boolean }): boolean {
  const { flag = false } = o;
  return flag;
}`, true);
  const program = analyzeHostProgram(input);
  assert.equal(program.kind, "ok");
  const chapter = program.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const selected = chapter.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "Block"
    && row.tir.root.statements.nodes[0]?.kind === "VariableStatement");
  assert.ok(selected);
  const { mir } = selected;
  assert.equal(mir.places.filter(row => row.base.kind === "place" && row.base.projection.kind === "field").length, 1);
  assert.equal(mir.blocks.filter(row => row.terminator.kind === "switch").length, 1);
  assert.equal(mir.blocks.filter(row => row.terminator.kind === "call" && row.terminator.callee.kind === "body").length, 1);
});

test("a native object binding preserves the field carrier on both the present and default edges", async () => {
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = await nativeInt32Input(`
export function select(o: { a: Native; plain: number; b?: Native }): Native {
  const { a, plain, b: chosen = 3 } = o;
  return chosen;
}`, true);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const { index, modules } = result.value;
  const chapter = modules.find(row => row.module === input.snapshot.entryPoint);
  const selected = chapter.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "Block"
    && row.tir.root.statements.nodes[0]?.kind === "VariableStatement");
  assert.ok(selected);
  const { tir, mir } = selected;
  const [required, plain, optional] = tir.root.statements.nodes[0].declarationList.declarations.nodes[0].name.elements.nodes;
  assert.equal(required.tsonic.field.decision.read, required.tsonic.storage);
  assert.equal(optional.tsonic.field.decision.key.value, "b");
  assert.equal(optional.name.text, "chosen");
  const integer = optional.tsonic.storage;
  assert.deepEqual(index.types.terms[integer], { kind: "primitive", primitive: "int32" });
  assert.equal(required.tsonic.storage, integer);
  assert.deepEqual(index.types.terms[plain.tsonic.storage], { kind: "primitive", primitive: "float64" });
  assert.equal(optional.tsonic.present, integer);
  assert.deepEqual(index.types.terms[optional.tsonic.field.decision.read], { kind: "optional", value: integer });
  const dispatch = mir.blocks.find(row => row.terminator.kind === "switch" && row.terminator.tir.node === optional.id).terminator;
  const [absent] = dispatch.targets;
  assert.equal(dispatch.targets.length, 1);
  assert.deepEqual(mir.constants[absent.constant].value, { kind: "literal", value: { kind: "absence" } });
  const call = mir.blocks[absent.target].terminator;
  assert.equal(call.kind, "call");
  assert.equal(call.callee.instance.body, optional.tsonic.initializer);
  assert.equal(mir.blocks[dispatch.otherwise].statements[0].place, call.destination);
  const initializer = chapter.bodies.find(row => row.kind === "selected" && row.tir.body === call.callee.instance.body);
  assert.ok(initializer);
  assert.equal(initializer.tir.completion, integer);
  assert.equal(initializer.mir.constants.some(row => row.type === integer && row.value.kind === "literal"
    && row.value.value.kind === "number" && row.value.value.value.numerator === 3n), true);
  assert.equal([...mir.blocks, ...initializer.mir.blocks].some(block => block.statements
    .some(row => row.kind === "assign" && row.value.kind === "convert")), false);
});

test("tuple binding carries only the selected native slots into their own leaf storage", async () => {
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = await nativeInt32Input(`
function pair(): [Native, number] { return [1, 2]; }
export function direct(): Native {
  const [native, ordinary] = pair();
  return native;
}
export function nested(value: [number, [Native, number]]): Native {
  const [, [native, ordinary]]: [number, [Native, number]] = value;
  return native;
}`, true);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const { index, modules } = result.value;
  const chapter = modules.find(row => row.module === input.snapshot.entryPoint);
  const bodies = chapter.bodies.filter(row => row.kind === "selected" && row.tir.root.kind === "Block"
    && row.tir.root.statements.nodes[0]?.kind === "VariableStatement");
  assert.equal(bodies.length, 2);
  for (const { tir, mir } of bodies) {
    const declaration = tir.root.statements.nodes[0].declarationList.declarations.nodes[0];
    const [first, second] = declaration.name.elements.nodes;
    const [native, ordinary] = first.name === null ? second.name.elements.nodes : [first, second];
    assert.deepEqual([native, ordinary].map(row => [row.name.text, index.types.terms[row.tsonic.storage]]), [
      ["native", { kind: "primitive", primitive: "int32" }],
      ["ordinary", { kind: "primitive", primitive: "float64" }],
    ]);
    assert.equal(mir.blocks.some(block => block.statements.some(row => row.kind === "assign" && row.value.kind === "convert")), false);
  }
});

test("written array context retains its own native element without rewriting the checker read", async () => {
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const input = await nativeInt32Input(`
export function ranged(source: Native[], value: Native): void {
  const inferred = [0, ...source, value];
  const selected: Native[] = [0, ...source, value];
  const ordinary: number[] = [0, ...source, value];
}`, true);
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const { types, modules } = captured.value;
  const chapter = modules.find(row => row.module.module === input.snapshot.entryPoint).module;
  const callable = chapter.tree.statements.nodes.find(row => row.kind === "FunctionDeclaration");
  const element = answer => {
    assert.equal(answer.kind, "available");
    if (answer.value === null) return null;
    const term = fixture.types.readType(types, answer.value);
    assert.equal(term.kind, "array");
    return fixture.types.readType(types, term.element).primitive;
  };
  const results = callable.body.statements.nodes.map(statement => {
    const declaration = statement.declarationList.declarations.nodes[0];
    const { read, contextual } = declaration.initializer.tsonic.value.views;
    return [declaration.name.text, element(read), element(contextual), element(declaration.tsonic.declaredType)];
  });
  assert.deepEqual(results, [
    ["inferred", "float64", null, null],
    ["selected", "float64", "int32", "int32"],
    ["ordinary", "float64", "float64", "float64"],
  ]);
});

test("inferred array construction retains its exact spread operand and authored scalar order", async () => {
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `export function build(xs: boolean[], value: boolean): boolean {
    const all = [false, ...xs, value];
    return value;
  }`);
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const { types, modules } = captured.value;
  const checked = modules.find(row => row.module.module === input.snapshot.entryPoint).module;
  const callable = checked.tree.statements.nodes[0];
  const declaration = callable.body.statements.nodes[0].declarationList.declarations.nodes[0];
  const literal = declaration.initializer;
  assert.equal(literal.kind, "ArrayLiteralExpression");
  assert.deepEqual(literal.tsonic.value.views.contextual, { kind: "available", value: null });
  const bodies = new Set(checked.bodies.filter(row => row.root === literal || row.root === callable.body).map(row => row.body));
  const start = wiring.infer.constraintsOf;
  const resume = wiring.infer.resumeConstraintsOf;
  const observed = new Error("observed the authored array constraint before selection");
  let construction = null;
  function observe(generated) {
    if (generated.kind !== "done" || generated.value.kind !== "ok") return generated;
    for (const set of generated.value.value.constraints) {
      if (!bodies.has(set.body)) continue;
      const match = set.constraints.find(row => row.kind === "construct-literal" && row.occurrence.node === literal.id);
      if (match !== undefined) {
        construction = match;
        throw observed;
      }
    }
    return generated;
  }
  try {
    wiring.infer.constraintsOf = (...args) => observe(start(...args));
    wiring.infer.resumeConstraintsOf = (...args) => observe(resume(...args));
    assert.throws(() => typeSourceBarrier(input, captured.value, createAccount(input.limits.dataflow)), error => error === observed);
  } finally {
    wiring.infer.constraintsOf = start;
    wiring.infer.resumeConstraintsOf = resume;
  }
  const [first, spread, last] = literal.elements.nodes;
  assert.equal(spread.kind, "SpreadElement");
  assert.ok(construction);
  assert.equal(construction.construction, "array");
  assert.equal(construction.result, literal.tsonic.value.views.read.value);
  assert.equal(construction.destination, null);
  const inferred = fixture.types.readType(types, construction.inferredResult);
  assert.equal(inferred.kind, "open");
  assert.notEqual(construction.inferredResult, construction.result);
  assert.deepEqual(construction.parts.map(row => [row.kind, row.occurrence]),
    [["element", first], ["spread", spread.expression], ["element", last]]
      .map(([role, operand]) => [role, { body: construction.occurrence.body, node: operand.id }]));
  assert.equal(fixture.types.readType(types, construction.parts[1].type).kind, "array");
});

test("native range construction has one inferred or contextual carrier and an ordered verified Typed plan", async () => {
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const { printTir, parseTir } = await import("../../packages/host/dist/ir-tir/index.js");
  const { verifyArrayConstruction } = await import("../../packages/host/dist/ir-tir/verify-occurrences.js");
  const run = async (annotation, expression, grant = true) => {
    const source = `export function ranged(xs: Native[], value: Native): Native {
  const all${annotation} = ${expression};
  return all.length;
}`;
    const input = await nativeInt32Input(source, true);
    const original = input.snapshot.nativeFacts;
    const native = { ...original,
      arrayConstruction: grant ? { kind: "exact-length", extentFailure: "abort", rangeCopy: "contiguous" } : null,
      arrayExtents: original.arrayExtents.map(row => row.carrier === "array" ? { ...row, result: "int32" } : row),
    };
    const selected = { ...input, snapshot: { ...input.snapshot, nativeFacts: native } };
    const checked = captureSourceBarrier(selected);
    assert.equal(checked.kind, "ok");
    const typed = typeSourceBarrier(selected, checked.value, createAccount(selected.limits.dataflow));
    return { typed, checked: checked.value, module: input.snapshot.entryPoint, native };
  };
  for (const annotation of ["", ": Native[]"]) {
    const { typed, checked, module, native } = await run(annotation, "[0, ...xs, value]");
    assert.deepEqual(typed.diagnostics, []);
    assert.equal(typed.kind, "ok");
    const owner = typed.value.modules.get(module);
    const body = owner.bodies.find(row => row.root.kind === "ArrayLiteralExpression" && row.bindings.kind === "instantiated");
    assert.ok(body);
    const plan = body.root.tsonic.construction.decision.decision;
    const table = fixture.types.viewTypes(checked.types);
    const result = table.terms[plan.result];
    assert.equal(result.kind, "array");
    assert.deepEqual(table.terms[result.element], { kind: "primitive", primitive: "int32" });
    assert.deepEqual([plan.operation.kind, plan.execution.kind, plan.operation.extent, plan.operation.holding,
      plan.operation.extentFailure, plan.operation.allocationFailure],
    ["exact-array-construction", "array-initialization", "int32", "by-reference", "abort", "unwind"]);
    const [first, range, last] = body.root.elements.nodes;
    assert.deepEqual(plan.operation.parts.map(row => [row.kind, row.source.body, row.source.node]),
      [["element", body.body, first.id], ["spread", body.body, range.expression.id], ["element", body.body, last.id]]);
    assert.equal(range.tsonic.role, "native-array-range");
    assert.equal(plan.operands[1], range.expression.tsonic.convertedType);
    assert.deepEqual([plan.operands[0], plan.operands[2]], [result.element, result.element]);
    assert.deepEqual(plan.operation.parts.map(row => row.embedding?.kind ?? null), ["conversion", null, "identity"]);
    const wire = printTir(body);
    const parsed = parseTir(wire);
    assert.equal(parsed.kind, "parsed");
    assert.equal(printTir(parsed.value), wire);
    const source = typed.value.sourceNodeOf({ kind: "body", value: { body: body.body, node: body.root.id } });
    const verify = (root, admit, facts = native) => {
      const found = [];
      const stopped = verifyArrayConstruction(root, source, body.body, table, facts, admit, (rule, _, detail) => found.push([rule, detail]));
      return { found, stopped };
    };
    let work = 0;
    assert.deepEqual(verify(body.root, () => (++work, null)), { found: [], stopped: null });
    const stopped = { kind: "native-array-proof-cut" };
    for (let limit = 0; limit < work; limit += 1) {
      let paid = 0;
      const answer = verify(body.root, () => paid++ < limit ? null : stopped);
      assert.equal(answer.stopped === stopped, true, String(limit));
      assert.deepEqual(answer.found, []);
    }
    assert.deepEqual(verify(body.root, () => null, { ...native, arrayConstruction: null }).found.map(row => row[0]), ["operation-type"]);
    const changed = { ...body.root, tsonic: { ...body.root.tsonic, construction: { kind: "decided",
      decision: { permissionScope: null, decision: { ...plan, operation: { ...plan.operation,
        parts: [plan.operation.parts[1], plan.operation.parts[0], plan.operation.parts[2]] } } } } } };
    assert.deepEqual(verify(changed, () => null).found.map(row => row[0]), ["operation-type", "operation-type"]);
  }
  for (const [annotation, expression, grant, expected] of [
    ["", "[0, ...xs, value]", false, "does not supply exact-length"],
    [": number[]", "[0, ...xs, value]", true, "must have identical element storage"],
    ["", "[...xs, ...xs]", true, "at most one reached native array range"],
  ]) {
    const { typed } = await run(annotation, expression, grant);
    assert.equal(typed.kind, "refused");
    assert.equal(Object.hasOwn(typed, "value"), false);
    assert.equal(typed.diagnostics[0].code.rendered, "TSONIC_ARRAY_CONSTRUCTION");
    assert.ok(typed.diagnostics[0].message.includes(expected));
  }
});

test("a checked binding default completes against its actual named storage without an enclosing signature request", () => {
  const program = ready(`export function start(first: boolean, source: { field?: boolean }): boolean {
    const { field = !first } = source;
    return field;
  }`);
  const callable = program.checked.tree.statements.nodes[0];
  const [binding] = callable.body.statements.nodes[0].declarationList.declarations.nodes[0].name.elements.nodes;
  const body = program.checked.bodies.find(row => row.root === binding.initializer);
  const group = program.inputs.groups.find(row => row.bodies.includes(body.body));
  assert.deepEqual(group.bodies, [body.body]);
  const deps = program.inputs.inference;
  const generated = wiring.infer.constraintsOf(deps, group);
  assert.equal(generated.kind, "done");
  assert.equal(generated.value.kind, "ok");
  const occurrence = { body: body.body, node: binding.initializer.id };
  const [set] = generated.value.value.constraints;
  const fit = set.constraints.find(row => row.kind === "flow");
  assert.equal(fit.role, "initialization");
  assert.deepEqual(fit.occurrence, occurrence);
  assert.equal(fit.to, binding.tsonic.declaredType.value);
  assert.deepEqual(set.evidence.at(-1).value.component, { kind: "item", value: { owner: body.owner, node: binding.id } });
  const answer = program.database.run(program.queries.solutionOf, group.id);
  assert.equal(answer.kind, "completed", JSON.stringify(answer.diagnostics));
  assert.deepEqual(answer.diagnostics, []);
  assert.equal(answer.value.solution.bodies[0].completion, fit.to);
});

test("object binding reads the actual ordered members and keeps optional absence distinct from the present fit", async () => {
  const { checkedSourceBindingFieldOf } = await import("../../packages/host/dist/ir-hir/index.js");
  const program = ready(`export function start(source: { first: boolean; second?: boolean }): boolean {
    const { first: left, second = !left } = source;
    return second;
  }`);
  const callable = program.checked.tree.statements.nodes[0];
  const decl = callable.body.statements.nodes[0].declarationList.declarations.nodes[0];
  const body = program.checked.bodies.find(row => row.root === callable.body);
  const group = program.inputs.groups.find(row => row.bodies.includes(body.body));
  const result = program.database.run(program.queries.solutionOf, group.id);
  assert.equal(result.kind, "completed", JSON.stringify(result.diagnostics));
  assert.deepEqual(result.diagnostics, []);
  const set = result.value.constraints.constraints.find(row => row.body === body.body);
  const slots = set.constraints.flatMap((constraint, index) => constraint.kind === "member" ? [{ constraint, index }] : []);
  assert.deepEqual(slots.map(row => row.constraint.key.value), ["first", "second"]);
  const [first, second] = slots;
  for (const [position, { constraint, index }] of slots.entries()) {
    const element = decl.name.elements.nodes[position];
    assert.deepEqual(constraint.occurrence, { body: body.body, node: element.id });
    assert.equal(constraint.receiver, decl.initializer.tsonic.value.views.read.value);
    const solved = result.value.solution.constraints.find(row => row.constraint.body === body.body && row.constraint.index === index).decision;
    assert.equal(solved.kind, "member");
    assert.equal(solved.member.read, constraint.result);
    assert.equal(solved.member.primary, constraint.origins[0].declaration);
    assert.equal(solved.refinement, null);
    const read = fixture.types.readType(program.interner, solved.member.read);
    assert.equal(read.kind, position === 0 ? "primitive" : "optional");
    const fit = set.constraints[index + 1];
    assert.equal(fit.kind, "flow");
    const input = read.kind === "optional" ? fixture.types.optionalValueDomainOf(read, type => fixture.types.readType(program.interner, type)).present
      : solved.member.read;
    assert.equal(fit.from, input);
    assert.equal(fit.to, element.tsonic.declaredType.value);
  }
  const check = (element, key, field, admit = () => true) => checkedSourceBindingFieldOf(body, element, key, field,
    program.domain.nodeOf, program.inputs.inference.itemOf, admit);
  const right = decl.name.elements.nodes[1];
  assert.equal(check(right, second.constraint.key, second.constraint.origins[0].declaration)?.field, second.constraint.origins[0].declaration);
  assert.equal(check(right, second.constraint.key, first.constraint.origins[0].declaration), null);
  assert.equal(check(right, first.constraint.key, first.constraint.origins[0].declaration), null);
  assert.equal(check(right, second.constraint.key, second.constraint.origins[0].declaration, () => false), null);
});

test("actual selected member constraints retain their checked origins and distinct receiver and open result evidence", async () => {
  const program = ready("export function read(box:Box):boolean{return box.flag;}export type Box={flag:boolean};\n");
  const source = program.checked.bodies.find(body => body.root.kind === "Block");
  const access = source.root.statements.nodes[0].expression;
  const group = program.inputs.groups.find(group => group.bodies.includes(source.body));
  const pending = wiring.infer.constraintsOf(program.inputs.inference, group);
  assert.equal(pending.kind, "paused");
  const answers = pending.requests.map(request => {
    assert.equal(request.kind, "declaredSignatureOf");
    const answer = program.database.run(program.queries.declaredSignatureOf, request.request);
    assert.equal(answer.kind, "completed");
    assert.deepEqual(answer.diagnostics, []);
    return { kind: request.kind, value: answer.value };
  });
  const generated = wiring.infer.resumeConstraintsOf(program.inputs.inference, pending.paused, answers);
  assert.equal(generated.kind, "done");
  assert.equal(generated.value.kind, "ok");
  const set = generated.value.value.constraints.find(set => set.body === source.body);
  const member = set.constraints.find(constraint => constraint.kind === "member");
  assert.equal(member !== undefined, true);
  assert.deepEqual(member.occurrence, { body: source.body, node: access.id });
  assert.equal(member.key, access.name.tsonic.key.value);
  assert.equal(member.origins, access.tsonic.origins.value);
  assert.equal(member.access, "read");
  assert.equal(fixture.types.readType(program.interner, member.receiver).kind, "shape");
  const result = fixture.types.readType(program.interner, member.result);
  assert.equal(result.kind, "open");
  assert.equal(result.group, group.id);
  assert.deepEqual(set.variables.find(variable => variable.id === result.variable), {
    kind: "local", local: null, id: result.variable, occurrence: member.occurrence,
  });
  assert.deepEqual(set.evidence.slice(0, 2).map(evidence => ({ type: evidence.value.type, component: evidence.value.component,
    category: evidence.value.category, error: evidence.error })), [
    { type: member.receiver, component: { kind: "body", value: { body: source.body, node: access.expression.id } },
      category: { kind: "dynamic" }, error: null },
    { type: member.result, component: { kind: "body", value: member.occurrence }, category: { kind: "dynamic" }, error: null },
  ]);
  assert.equal(set.constraints.find(constraint => constraint.kind === "flow").from, member.result);
  const inferIr = await import("../../packages/host/dist/ir-infer/index.js");
  assert.deepEqual(inferIr.parseConstraints(inferIr.printConstraints(set)), { kind: "parsed", value: set });
  const verification = program.verification(group, generated.value.value, null);
  assert.deepEqual(inferIr.verifyInference({ ...verification, group, constraints: generated.value.value.constraints, placedSignatureOf: () => null,
    contributions: [], solution: null, bindingScopes: set.constraints.filter(constraint => constraint.kind === "flow" || constraint.kind === "member")
      .map(() => program.descriptions.get(source.owner).generics) }), []);
  const scheme = program.inputs.inference.rules.constraints.member;
  const reference = { body: set.body, index: set.constraints.indexOf(member) };
  const evidence = set.evidence.slice(0, 2);
  const listing = { group: group.id, remainingContributions: 1, reference, variables: set.variables, candidates: set.candidates,
    constraint: member, evidence };
  const contribution = { key: { node: member.occurrence, candidate: null, role: { kind: "member" } },
    reads: [], bounds: [result.variable], constraint: reference };
  assert.deepEqual(scheme.enumerate(listing), { kind: "ok", diagnostics: [], value: [contribution] });
  assert.deepEqual(scheme.enumerate({ ...listing, constraint: { ...member, receiver: member.result } }).value,
    [{ ...contribution, reads: [result.variable] }]);
  const unit = { query: "solutionOf", key: group.id };
  const solveRefusal = wiring.infer.solveGroup({ ...program.inputs.inference,
    limits: { ...LIMITS, maximumAtomicContributionsPerGroup: 0 } }, group, generated.value.value, unit);
  assert.equal(solveRefusal.kind, "done");
  assert.equal(solveRefusal.value.kind, "refused");
  assert.equal(solveRefusal.value.diagnostics.length, 1);
  assert.deepEqual(solveRefusal.value.diagnostics[0].arguments,
    [{ kind: "text", value: "atomic contributions per group" }, { kind: "number", value: 0 }]);
  const { checkedSourceObjectFieldOf } = await import("../../packages/host/dist/ir-hir/index.js");
  const storage = checkedSourceObjectFieldOf(source, access, program.domain.nodeOf, program.inputs.inference.itemOf,
    () => assert.fail("a direct held reference has no alias edge"));
  assert.equal(storage?.receiver, member.receiver);
  const evaluation = { constraint: member, contribution, candidates: set.candidates, evidence, reads: [], origin: access.origin, storage };
  const awaitingInventory = scheme.evaluate(evaluation);
  assert.equal(awaitingInventory.kind, "paused");
  assert.deepEqual(awaitingInventory.requests, [{ kind: "membersOf", receiver: member.receiver }]);
  assert.deepEqual(awaitingInventory.earned, []);
  assert.throws(() => scheme.evaluate({ ...evaluation, evidence: [...evidence].reverse() }),
    /evidence of type position 0/);
  const errorType = insertFixtureType(fixture.types, program.interner, { kind: "error" });
  const error = { kind: "error", causes: [{ kind: "unit", unit: { request: { query: "fixture-receiver", key: source.body },
    position: { kind: "result" } } }] };
  const receiverError = { error, value: { ...evidence[0].value, type: errorType } };
  const propagated = scheme.evaluate({ ...evaluation, storage: null, constraint: { ...member, receiver: errorType }, evidence: [receiverError, evidence[1]] });
  assert.equal(propagated.kind, "done");
  assert.equal(propagated.value.kind, "ok");
  const completed = propagated.value.value;
  assert.equal(completed.kind, "contribution");
  assert.equal(completed.value.decision.error, error, "the isolated Rules owner borrows the supplied cause unchanged");
  assert.equal(completed.value.bounds[0].error, error);
  assert.equal(completed.value.bounds[0].variable, result.variable);
  assert.deepEqual(propagated.value.diagnostics, []);
  const checkedOrigins = access.tsonic.origins;
  const checkedKey = access.name.tsonic.key;
  for (const change of ["origins", "key"]) {
    if (change === "origins") access.tsonic.origins = { kind: "unavailable", reason: "not-provided", causes: [] };
    else access.name.tsonic.key = { kind: "unavailable", reason: "incomplete-association", causes: [] };
    assert.throws(() => wiring.infer.resumeConstraintsOf(program.inputs.inference, pending.paused, answers),
      /the actual checked member key and declaration origins/u);
    access.tsonic.origins = checkedOrigins;
    access.name.tsonic.key = checkedKey;
  }
  const expression = Object.getOwnPropertyDescriptor(access, "expression");
  Object.defineProperty(access, "expression", { configurable: true, get: () => assert.fail("a refused member allocation cannot enter its receiver") });
  const refused = wiring.infer.resumeConstraintsOf({ ...program.inputs.inference,
    limits: { ...program.inputs.inference.limits, maximumVariablesPerGroup: 0 } }, pending.paused, answers);
  assert.equal(refused.kind, "done");
  assert.equal(refused.value.kind, "refused");
  assert.equal(refused.value.diagnostics.length, 1);
  assert.equal(refused.value.diagnostics[0].code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
  Object.defineProperty(access, "expression", expression);
  const exact = wiring.infer.resumeConstraintsOf({ ...program.inputs.inference,
    limits: { ...program.inputs.inference.limits, maximumVariablesPerGroup: 1 } }, pending.paused, answers);
  assert.equal(exact.kind, "done");
  assert.equal(exact.value.kind, "ok");
  assert.deepEqual(exact.value.value.constraints, generated.value.value.constraints);
});

test("the real member contribution derives both declaration dependencies and keeps the actual selected receiver evidence separate", () => {
  const program = ready("export function read(box:Box):boolean{return box.flag;} export type Box={next:string;flag:boolean; other:string};");
  const body = program.checked.bodies.find(candidate => candidate.root.kind === "Block");
  const field = body.root.statements.nodes[0].expression;
  const group = program.inputs.groups.find(candidate => candidate.bodies.includes(body.body));
  const receiver = field.expression.tsonic.value.views.read.value;
  const expected = [receiver, 0, "read"];
  const solved = program.database.run(program.queries.solutionOf, group.id);
  assert.equal(solved.kind, "completed");
  const decisions = solved.value.solution.constraints.filter(row => row.constraint.body === body.body)
    .map(row => row.decision).filter(value => value.kind === "member");
  assert.equal(decisions.length, 1);
  const decision = decisions[0].member;
  assert.equal(decision.primary, field.tsonic.origins.value[0].declaration);
  assert.deepEqual(decision.location, { kind: "data", receiver: "by-reference", check: { kind: "none" } });
  const trace = program.database.trace();
  const starts = trace.filter(event => event.kind === "start" && (event.fact.query === "membersOf" || event.fact.query === "memberTypeOf"));
  assert.deepEqual(starts.map(event => [event.fact.query, event.fact.key]),
    [["membersOf", receiver], ["memberTypeOf", expected]]);
  const information = program.database.errorOf({ request: { query: "memberTypeOf", key: expected },
    position: { kind: "result" } });
  assert.deepEqual(information, { kind: "completed", error: null });
});

test("a real Query budget refusal abandons the member contribution without resuming its Rules continuation", () => {
  const program = ready("export function read(box:Box):boolean{return box.flag;} export type Box={flag:boolean};");
  const group = program.inputs.groups.find(candidate => program.domain.bodyOf.get(candidate.bodies[0]).root.kind === "Block");
  const original = program.inputs.inference.rules;
  let entered = 0;
  let resumed = 0;
  const member = { ...original.constraints.member, evaluate: input => {
    entered += 1;
    const first = original.constraints.member.evaluate(input);
    assert.equal(first.kind, "paused");
    assert.notEqual(typeof first.paused, "function");
    return first;
  } };
  const inputs = { ...program.inputs, inference: { ...program.inputs.inference,
    rules: { ...original, resumeMember: (state, answers) => {
      resumed += 1;
      return original.resumeMember(state, answers);
    }, constraints: { ...original.constraints, member } } } };
  const { queries } = registration.createSourceSemanticQueries(program.base, inputs);
  const proved = new Set();
  for (let maximumRecords = 1; maximumRecords <= 64 && proved.size < 2; maximumRecords += 1) {
    entered = 0;
    resumed = 0;
    const database = query.createDatabase(program.base, { maximumRecords }, () => assert.fail("no member cycle"), "off");
    const result = database.run(queries.solutionOf, group.id);
    assert.equal(result.kind, "refused");
    const stop = result.diagnostics[0];
    const blocked = stop.evidence[1];
    if (entered === 1 && (blocked === "membersOf" || blocked === "memberTypeOf")) {
      assert.equal(resumed, blocked === "membersOf" ? 0 : 1);
      assert.equal(stop.code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
      assert.equal(database.diagnostics()[0], stop);
      proved.add(blocked);
    }
  }
  assert.deepEqual([...proved], ["membersOf", "memberTypeOf"]);
});

test("the owning solve resumes the exact member contribution once and rejects crossed facts", () => {
  const program = ready("export function read(box:Box):boolean{return box.flag;} export type Box={earlier:string;flag:boolean};");
  const body = program.checked.bodies.find(candidate => candidate.root.kind === "Block");
  const group = program.inputs.groups.find(candidate => candidate.bodies.includes(body.body));
  const original = program.inputs.inference;
  const rules = original.rules;
  let rulesPause;
  const member = { ...rules.constraints.member, evaluate: input => {
    const step = rules.constraints.member.evaluate(input);
    assert.equal(step.kind, "paused");
    rulesPause = step.paused;
    return step;
  } };
  const inputs = { ...original, rules: { ...rules, constraints: { ...rules.constraints, member } } };
  const generation = wiring.infer.constraintsOf(inputs, group);
  assert.equal(generation.kind, "paused");
  const established = wiring.infer.resumeConstraintsOf(inputs, generation.paused, generation.requests.map(request => {
    assert.equal(request.kind, "declaredSignatureOf");
    const answer = program.database.run(program.queries.declaredSignatureOf, request.request);
    assert.equal(answer.kind, "completed");
    return { kind: request.kind, value: answer.value };
  }));
  const unit = { query: "solutionOf", key: group.id };
  const start = () => wiring.infer.solveGroup(inputs, group, established.value.value, unit);
  const first = start();
  assert.equal(first.kind, "paused");
  assert.equal(first.paused.kind, "member");
  assert.equal(first.requests[0].kind, "membersOf");
  const source = program.database.run(program.queries.membersOf, first.requests[0].receiver);
  assert.equal(source.kind, "completed");
  const supplied = { kind: "membersOf", value: source.value };
  const foreignRules = wiring.rules.createRuleTable(program.rulesDeps);
  assert.notEqual(typeof rulesPause, "function");
  assert.equal(Object.hasOwn(rulesPause, "state"), false);
  const unread = { get 0() { return assert.fail("an unowned phase must not read a supplied answer"); },
    get length() { return assert.fail("an unowned phase must not read the supplied answer vector"); } };
  const prototypeCopy = value => Object.assign(Object.create(Object.getPrototypeOf(value)), value);
  assert.throws(() => foreignRules.resumeMember(rulesPause, unread), /actual rule table/);
  assert.throws(() => rules.resumeMember({ ...rulesPause }, unread), /actual Rules suspension/);
  assert.throws(() => rules.resumeMember(prototypeCopy(rulesPause), unread), /actual Rules suspension/);
  assert.throws(() => new rulesPause.constructor({ owner: "rules" }, {}), /actual Rules suspension/);
  assert.equal("resume" in first.paused, false);
  assert.throws(() => wiring.infer.resumeSolveGroup({ ...inputs }, first.paused, unread), /actual solve/);
  assert.throws(() => wiring.infer.resumeSolveGroup(inputs, { ...first.paused }, unread), /actual solve/);
  assert.throws(() => wiring.infer.resumeSolveGroup(inputs, prototypeCopy(first.paused), unread), /actual solve/);
  assert.throws(() => wiring.infer.resumeSolveGroup(inputs,
    { ...first.paused, suspension: prototypeCopy(first.paused.suspension) }, unread), /actual solve/);
  assert.throws(() => new first.paused.suspension.constructor({ owner: "infer" }, {}), /actual solve/);
  assert.throws(() => first.paused.suspension.constructor.take({ owner: "infer" },
    first.paused.suspension, inputs, first.paused), /actual solve/);
  const second = wiring.infer.resumeSolveGroup(inputs, first.paused, [supplied]);
  rulesPause.state = { consumed: false };
  first.paused.suspension.state = { consumed: false };
  assert.throws(() => rules.resumeMember(rulesPause, unread), /actual rule table/);
  assert.throws(() => wiring.infer.resumeSolveGroup(inputs, first.paused, unread), /active member contribution once/);
  assert.deepEqual(second.requests, [{ kind: "memberTypeOf", request: { receiver: source.value.receiver, member: 1, access: "read" } }]);
  const wrong = start();
  const otherType = fixture.types.readType(program.interner, source.value.receiver).members[0].read;
  assert.notEqual(otherType, source.value.receiver);
  assert.throws(() => wiring.infer.resumeSolveGroup(inputs, wrong.paused, [{ ...supplied,
    value: { ...source.value, receiver: otherType } }]), /actual receiver inventory/);
  const typed = program.database.run(program.queries.memberTypeOf, second.requests[0].request);
  assert.equal(typed.kind, "completed");
  assert.deepEqual(fixture.types.readType(program.interner, typed.value.read), { kind: "primitive", primitive: "bool" });
  const origin = { request: { query: "memberTypeOf", key: [source.value.receiver, 1, "read"] }, position: { kind: "result" } };
  const answer = { kind: "memberTypeOf", request: second.requests[0].request, value: typed.value,
    origin, error: null };
  assert.throws(() => wiring.infer.resumeSolveGroup(inputs, second.paused, [{ ...answer,
    request: { ...answer.request, member: 0 } }]), /actual selected member type/);
  const writeRequest = { ...answer.request, access: "write" };
  const write = program.database.run(program.queries.memberTypeOf, writeRequest);
  assert.equal(write.kind, "completed");
  assert.deepEqual(write.value, { access: "write", write: typed.value.read });
  const writeOrigin = { request: { query: "memberTypeOf", key: [source.value.receiver, 1, "write"] }, position: { kind: "result" } };
  assert.deepEqual(program.database.errorOf(writeOrigin), { kind: "completed", error: null });
  for (const [crossed, cause] of [
    [{ ...answer, request: writeRequest, value: write.value, origin: writeOrigin }, /actual selected member type/],
    [{ ...answer, value: write.value }, /actual selected member type/],
    [{ ...answer, origin: writeOrigin }, /actual completed result position/],
  ]) {
    const inventory = start();
    const pending = wiring.infer.resumeSolveGroup(inputs, inventory.paused, [supplied]);
    assert.throws(() => wiring.infer.resumeSolveGroup(inputs, pending.paused, [crossed]), cause);
  }
});

test("successive checked member contributions resume the same solver cursor without replay, using isolated typed errors", () => {
  const program = ready("export function read(box:Box):boolean{box.first;return box.second;} export type Box={first:boolean;second:boolean};");
  const source = program.checked.bodies.find(candidate => candidate.root.kind === "Block");
  const group = program.inputs.groups.find(candidate => candidate.bodies.includes(source.body));
  const rules = program.inputs.inference.rules;
  const order = [];
  const member = { enumerate: input => {
    order.push(["enumerate", input.constraint.key.value]);
    return rules.constraints.member.enumerate(input);
  }, evaluate: input => {
    order.push(["evaluate", input.constraint.key.value]);
    return rules.constraints.member.evaluate(input);
  } };
  const inputs = { ...program.inputs.inference, rules: { ...rules, constraints: { ...rules.constraints, member },
    resumeMember: (state, answers) => {
      order.push(["resume", answers[0].kind]);
      return rules.resumeMember(state, answers);
    } } };
  const generation = wiring.infer.constraintsOf(inputs, group);
  assert.equal(generation.kind, "paused");
  const established = wiring.infer.resumeConstraintsOf(inputs, generation.paused, generation.requests.map(request => {
    assert.equal(request.kind, "declaredSignatureOf");
    const answer = program.database.run(program.queries.declaredSignatureOf, request.request);
    assert.equal(answer.kind, "completed");
    return { kind: request.kind, value: answer.value };
  }));
  assert.equal(established.value.kind, "ok");
  const unit = { query: "solutionOf", key: group.id };
  const errorType = insertFixtureType(fixture.types, program.interner, { kind: "error" });
  const origins = [];
  let step = wiring.infer.solveGroup(inputs, group, established.value.value, unit);
  for (const [ordinal, expression] of [source.root.statements.nodes[0].expression, source.root.statements.nodes[1].expression].entries()) {
    assert.equal(step.kind, "paused");
    assert.equal(step.paused.kind, "member");
    assert.deepEqual(step.paused.occurrence, { body: source.body, node: expression.id });
    assert.equal(step.requests[0].kind, "membersOf");
    const found = program.database.run(program.queries.membersOf, step.requests[0].receiver);
    assert.equal(found.kind, "completed");
    const inventoryPause = step.paused;
    step = wiring.infer.resumeSolveGroup(inputs, inventoryPause, [{ kind: "membersOf", value: found.value }]);
    assert.throws(() => wiring.infer.resumeSolveGroup(inputs, inventoryPause, []), /active member contribution once/);
    assert.equal(step.kind, "paused");
    const request = step.requests[0].request;
    assert.deepEqual(request, { receiver: found.value.receiver, member: ordinal, access: "read" });
    const original = program.database.run(program.queries.memberTypeOf, request);
    assert.equal(original.kind, "completed");
    const origin = { request: { query: "memberTypeOf", key: [request.receiver, request.member, request.access] }, position: { kind: "result" } };
    origins.push(origin);
    const error = { kind: "error", causes: [{ kind: "unit", unit: {
      request: { query: "isolated-member-owner", key: ordinal }, position: { kind: "result" },
    } }] };
    step = wiring.infer.resumeSolveGroup(inputs, step.paused, [{ kind: "memberTypeOf", request, origin, error,
      value: { ...original.value, read: errorType } }]);
  }
  assert.deepEqual(order, [
    ["enumerate", "first"], ["enumerate", "second"], ["evaluate", "first"],
    ["resume", "membersOf"], ["resume", "memberTypeOf"], ["evaluate", "second"], ["resume", "membersOf"], ["resume", "memberTypeOf"],
  ]);
  assert.equal(step.kind, "paused");
  assert.equal(step.paused.kind, "placement");
  const solved = step.paused.solved.filter(row => established.value.value.constraints[0].constraints[row.constraint.index].kind === "member");
  assert.deepEqual(solved.map(row => row.decision), origins.map(origin =>
    ({ kind: "error", error: { kind: "error", causes: [{ kind: "unit", unit: origin }] } })));
  assert.deepEqual(step.earned, []);
});

test("constraint pauses retain every actual request body and reject removed or foreign ownership metadata", () => {
  const program = ready("export function add(a: number, b: number): number { return a + b; }\n");
  const group = program.inputs.groups.find(group => program.domain.bodyOf.get(group.bodies[0]).root.kind === "Block");
  const generation = wiring.infer.constraintsOf(program.inputs.inference, group);
  assert.equal(generation.kind, "paused");
  assert.equal("signatureBodies" in generation.paused, false);
  assert.deepEqual(generation.paused.requestBodies, group.bodies);
  const signature = program.database.run(program.queries.declaredSignatureOf, generation.requests[0].request);
  assert.equal(signature.kind, "completed");
  const answers = [{ kind: "declaredSignatureOf", value: signature.value }];
  assert.throws(() => wiring.infer.resumeConstraintsOf(program.inputs.inference,
    { ...generation.paused, requestBodies: [] }, answers), /every pending semantic request/u);
  const module = program.checked.bodies.find(body => body.root.kind === "SourceFile");
  assert.throws(() => wiring.infer.resumeConstraintsOf(program.inputs.inference,
    { ...generation.paused, requestBodies: [module.body] }, answers), /outside its actual group/u);
  assert.throws(() => wiring.infer.resumeConstraintsOf(program.inputs.inference,
    { ...generation.paused, requests: [...generation.requests, ...generation.requests], requestBodies: [...group.bodies, ...group.bodies] },
    [...answers, ...answers]), /a complete signature request was repeated in one pause/u);
  assert.equal(wiring.infer.resumeConstraintsOf(program.inputs.inference, generation.paused, answers).value.kind, "ok");
});
