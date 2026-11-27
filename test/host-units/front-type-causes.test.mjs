import assert from "node:assert/strict";
import { test } from "node:test";
import { lowerSingleCheckedModule, captureSingleModule, identifySingleModule, loadFrontFixture } from "./fixtures/front/checked-module.mjs";

async function captured(source) {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const opened = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const result = captureSingleModule(fixture.front, opened.deps, opened.program, module);
  assert.equal(result.kind, "ok");
  const raw = result.value;
  const definitions = identifySingleModule(fixture.front, { module: raw,
    componentRoots: raw.types.components.map(component => component.root).filter(root => root.module === module) });
  assert.equal(definitions.kind, "ok");
  const types = fixture.types.createTypeInterner();
  const deps = fixture.lowerDepsFor(definitions.value, types, source);
  return { fixture, raw, types, deps, opened, lower() {
    const exports = fixture.front.lowerModuleExports(deps, raw);
    assert.equal(exports.kind, "ok");
    return lowerSingleCheckedModule(fixture.front, { ...deps, exportsOf: owner => owner === module ? exports.value : null }, raw);
  } };
}

test("authored failed type answers retain their original checker roots while actual any stays available", async () => {
  const actual = await captured("export type First=Missing;export type Second=OtherMissing;export type Open=any;");
  const failures = actual.raw.tree.statements.nodes.slice(0, 2).map(node => {
    const row = actual.raw.types.types.find(type => type.authoredTypeNode?.node === node.type.id);
    assert.equal(row.form.kind, "unavailable");
    assert.equal(row.form.reason, "checker-error");
    const reference = row.form.causes[0].diagnostic.diagnostic;
    assert.equal(reference.module, actual.raw.module);
    assert.equal(actual.raw.checkerDiagnostics[reference.index].code.number, 2304);
    return row.form;
  });
  assert.notDeepEqual(failures[0].causes, failures[1].causes);
  const checked = actual.lower();
  assert.equal(checked.kind, "ok");
  for (const [index, failure] of failures.entries()) {
    const node = checked.value.tree.statements.nodes[index];
    assert.deepEqual(node.type.tsonic.type, failure);
    assert.deepEqual(node.tsonic.type, failure);
  }
  assert.equal(checked.value.tree.statements.nodes[2].type.tsonic.type.kind, "available");
  assert.deepEqual(actual.fixture.verifyChecked(checked.value, actual.types), []);
});

test("type-operator grammar failures keep each actual original cause apart from legal symbol types", async () => {
  const { raw } = await captured("export type Invalid = unique symbol; export type Other = readonly number;"
    + "export interface Keys { readonly uniqueKey: unique symbol; broadKey: symbol; }");
  const [invalid, other, keys] = raw.tree.statements.nodes;
  const causes = [];
  for (const [declaration, code] of [[invalid, 1335], [other, 1354]]) {
    const row = raw.types.types.find(type => type.authoredTypeNode?.node === declaration.type.id);
    assert.equal(row.form.kind, "unavailable");
    assert.equal(row.form.reason, "checker-error");
    assert.equal(row.form.causes.length, 1);
    const [cause] = row.form.causes;
    assert.equal(cause.kind, "diagnostic");
    assert.equal(cause.diagnostic.kind, "checker");
    const reference = cause.diagnostic.diagnostic;
    assert.equal(reference.module, raw.module);
    assert.equal(raw.checkerDiagnostics[reference.index].code.number, code);
    causes.push(reference.index);
  }
  assert.notEqual(causes[0], causes[1]);
  const [unique, broad] = keys.members.nodes;
  const row = declaration => raw.types.types.find(type => type.authoredTypeNode?.node === declaration.type.id);
  assert.deepEqual(row(unique).literal, { kind: "available", value: { kind: "symbol", declaration: { module: raw.module, node: unique.id } } });
  assert.deepEqual(row(broad).literal, { kind: "available", value: null });
  for (const member of [unique, broad]) assert.deepEqual(row(member).form, { kind: "available", value: { kind: "scalar", scalar: "symbol" } });
});

test("Raw capture distinguishes a directive-filtered cause from an equal published checker report", async () => {
  const { raw } = await captured("// @ts-expect-error\nexport type Suppressed = readonly number;\n"
    + "export type Reported = readonly number;");
  const [suppressed, reported] = raw.tree.statements.nodes;
  const form = node => raw.types.types.find(type => type.authoredTypeNode?.node === node.type.id).form;
  assert.deepEqual(form(suppressed), { kind: "available", value: { kind: "scalar", scalar: "number" } });
  assert.equal(raw.checkerDiagnostics.length, 1);
  const [original] = raw.checkerDiagnostics;
  assert.equal(original.code.number, 1354);
  assert.equal(original.site.origin.start, reported.type.origin.start);
  assert.deepEqual(form(reported), { kind: "unavailable", reason: "checker-error", causes: [
    { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: raw.module, index: 0 } } },
  ] });
});

test("Raw capture receives one original binder root and its distinct declaration grammar report", async () => {
  const text = "export function read(input: boolean): boolean { if (input) nested: type Invalid = boolean; return input; }";
  const { raw } = await captured(text);
  assert.deepEqual(raw.checkerDiagnostics.map(diagnostic => diagnostic.code.number), [1344, 1156]);
  for (const [index, spelling] of ["nested", "Invalid"].entries()) {
    const { module, start, length } = raw.checkerDiagnostics[index].site.origin;
    assert.equal(module, raw.module);
    assert.equal(text.slice(start, start + length), spelling);
  }
  const ready = await captured("export function read(input: boolean): boolean { if (input) { type Ready = boolean; } return input; }");
  assert.deepEqual(ready.raw.checkerDiagnostics, []);
});

test("tuple ordering errors reach Raw capture rather than publishing the checker's recovered tuple", async () => {
  const { raw } = await captured("export type Broken = [boolean?, string]; export type Grouped = (([boolean?, string]));"
    + "export type Readonly = readonly [boolean?, string]; export type Ready = readonly [boolean, string];");
  const [broken, grouped, readonly, ready] = raw.tree.statements.nodes;
  const authored = node => raw.types.types.find(type => type.authoredTypeNode?.node === node.type.id);
  const originals = new Set();
  for (const [outer, tuple] of [[broken, broken.type], [grouped, grouped.type.type.type], [readonly, readonly.type.type]]) {
    const failure = authored(outer).form;
    assert.equal(failure.kind, "unavailable");
    assert.equal(failure.reason, "checker-error");
    assert.equal(failure.causes.length, 1);
    const [cause] = failure.causes;
    const reference = cause.diagnostic.diagnostic;
    assert.equal(reference.module, raw.module);
    const original = raw.checkerDiagnostics[reference.index];
    assert.equal(original.code.number, 1257);
    assert.deepEqual(original.site.origin, tuple.elements.nodes[1].origin, "the diagnostic still points at the actual required child");
    originals.add(reference.index);
  }
  assert.equal(originals.size, 3);
  const available = authored(ready).form;
  assert.equal(available.kind, "available");
  assert.equal(available.value.kind, "tuple");
  assert.deepEqual(available.value.elements.map(slot => slot.kind), ["required", "required"]);
});

test("a failed captured dependency stops graph publication without poisoning a populated arena or its maps", async () => {
  const actual = await captured("export type Failed=Missing;export type Pair={first:boolean;second:string};");
  const conversion = await import("../../packages/host/dist/front/type-conversion.js");
  const failed = actual.raw.types.types.find(row => row.authoredTypeNode?.node === actual.raw.tree.statements.nodes[0].type.id);
  const pair = actual.raw.types.types.find(row => row.authoredTypeNode?.node === actual.raw.tree.statements.nodes[1].type.id);
  const inventory = actual.raw.types.members[pair.form.value.inventory];
  const child = inventory.members[0].read.value;
  const rows = [...actual.raw.types.types];
  rows[child] = { ...rows[child], form: failed.form };
  actual.fixture.types.internType(actual.types, { kind: "string" });
  const before = actual.fixture.types.viewTypes(actual.types);
  const prefix = [...before.terms];
  const signatures = [...before.signatures];
  const graph = conversion.createTypeConversion(actual.deps, { ...actual.raw, types: { ...actual.raw.types, types: rows } });
  assert.deepEqual(conversion.convertRawType(graph, pair.id), failed.form);
  assert.equal(graph.convertedTypes.size, 0);
  assert.equal(graph.convertedSignatures.size, 0);
  const after = actual.fixture.types.viewTypes(actual.types);
  assert.deepEqual(after.terms, prefix);
  assert.equal(after.terms.every((row, index) => row === prefix[index]), true);
  assert.deepEqual(after.signatures, signatures);
  assert.deepEqual(conversion.convertRawType(graph, failed.id), failed.form);
  const missing = [...rows];
  missing[failed.id] = { ...failed, form: { ...failed.form, causes: [] } };
  const malformed = conversion.createTypeConversion(actual.deps, { ...actual.raw, types: { ...actual.raw.types, types: missing } });
  assert.throws(() => conversion.convertRawType(malformed, failed.id), /actual captured component\/error association \(checker-error\)/u);
});

test("malformed type argument lists retain their actual published diagnostics and authored ranges", async () => {
  const text = "export type Base=boolean; export type Id<T>=T;\n"
    + "export type Empty=((Base</* λ */>));\nexport type Trailing=Id<boolean,>;\nexport type Ready=Id<boolean>;";
  const { raw } = await captured(text);
  const [, , empty, trailing, ready] = raw.tree.statements.nodes;
  assert.deepEqual(raw.checkerDiagnostics.map(diagnostic => diagnostic.code.number), [1099, 1009]);
  const form = declaration => raw.types.types.find(row => row.authoredTypeNode?.node === declaration.type.id).form;
  for (const [index, declaration] of [empty, trailing].entries()) {
    const { start, length } = raw.checkerDiagnostics[index].site.origin;
    assert.equal(text.slice(start, start + length), index === 0 ? "</* λ */>" : ",");
    assert.deepEqual(form(declaration), { kind: "unavailable", reason: "checker-error", causes: [
      { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: raw.module, index } } },
    ] });
  }
  assert.deepEqual(form(ready), { kind: "available", value: { kind: "scalar", scalar: "boolean" } });
});

test("circular declarations and dependent uses retain their own exact original causes", async () => {
  const text = "export type One = Two; export type Two = (One); export type Later = One; export type Unrelated = Missing;";
  const { raw } = await captured(text);
  const [one, two, later, unrelated] = raw.tree.statements.nodes;
  assert.deepEqual(raw.checkerDiagnostics.map(diagnostic => diagnostic.code.number), [2456, 2456, 2304]);
  for (const [index, name] of ["One", "Two", "Missing"].entries()) {
    const { start, length } = raw.checkerDiagnostics[index].site.origin;
    assert.equal(text.slice(start, start + length), name);
  }
  for (const [declaration, index] of [[one, 0], [two, 1], [later, 0], [unrelated, 2]]) {
    const row = raw.types.types.find(type => type.authoredTypeNode?.node === declaration.type.id);
    assert.deepEqual(row.form, { kind: "unavailable", reason: "checker-error", causes: [
      { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: raw.module, index } } },
    ] });
  }
});

test("a direct imported alias and forward use retain the actual defining file diagnostic", async () => {
  const fixture = await loadFrontFixture();
  const opened = fixture.openAndCapture(fixture.projectSnapshot({ sourceFiles: {
    "main.ts": "import type {Broken as Imported} from './leaf.js'; export type First=(Second); export type Second=Imported;",
    "leaf.ts": "export type Broken=readonly [boolean?,string];",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] }));
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const leaf = fixture.moduleOf(fixture.packageOf("/project"), "src/leaf.ts");
  const use = captureSingleModule(fixture.front, opened.deps, opened.program, main);
  const definition = captureSingleModule(fixture.front, opened.deps, opened.program, leaf);
  assert.equal(use.kind, "ok");
  assert.equal(definition.kind, "ok");
  assert.equal(use.value.checkerDiagnostics.length, 0);
  assert.deepEqual(definition.value.checkerDiagnostics.map(diagnostic => diagnostic.code.number), [1257]);
  for (const alias of use.value.tree.statements.nodes.slice(1)) {
    const row = use.value.types.types.find(type => type.authoredTypeNode?.node === alias.type.id);
    assert.deepEqual(row.form, { kind: "unavailable", reason: "checker-error", causes: [
      { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: leaf, index: 0 } } },
    ] });
  }
});

test("an actual foreign constraint answer names the original foreign module's published run", async () => {
  const fixture = await loadFrontFixture();
  const opened = fixture.openAndCapture(fixture.projectSnapshot({ sourceFiles: {
    "main.ts": "import {make} from './leaf.js';export type Value=typeof make;",
    "leaf.ts": "export declare function make<T extends Missing=Missing>(value:T):T;",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] }));
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const leaf = fixture.moduleOf(fixture.packageOf("/project"), "src/leaf.ts");
  const capturedMain = captureSingleModule(fixture.front, opened.deps, opened.program, main);
  const capturedLeaf = captureSingleModule(fixture.front, opened.deps, opened.program, leaf);
  assert.equal(capturedMain.kind, "ok");
  assert.equal(capturedLeaf.kind, "ok");
  const failures = capturedMain.value.types.types.filter(row => row.authoredTypeNode?.module === leaf && row.form.reason === "checker-error");
  assert.equal(failures.length >= 2, true);
  for (const row of failures) {
    const reference = row.form.causes[0].diagnostic.diagnostic;
    assert.equal(reference.module, leaf);
    assert.equal(capturedLeaf.value.checkerDiagnostics[reference.index].code.number, 2304);
  }
});

test("direct backing evidence retains exactly the published roots, operand occurrences and checked types", async () => {
  for (const [text, kind, codes, operands] of [
    ["export function convert(input: string): boolean { return input; }", "write-fit", [2322], ["input", "boolean"]],
    ["export function convert(input: string): boolean { const output: boolean = input; return output; }", "write-fit", [2322], ["input", "boolean"]],
    ["export function convert(input: string): boolean { let output = false; output = input; return output; }", "write-fit", [2322], ["input", "output"]],
    ["export function compute(left: string, right: string): number { return left * right; }", "operator", [2362, 2363], ["left", "right"]],
    ["export function find(data: { [name: string]: boolean }, key: boolean): boolean { return data[key]; }", "index", [2538], ["data", "key"]],
  ]) {
    const { raw, fixture } = await captured(text);
    const syntax = fixture.hir.indexSyntaxTree(raw.tree);
    assert.deepEqual(raw.checkerDiagnostics.map(report => report.code.number), codes);
    assert.equal(raw.diagnosticCoverage.length, codes.length);
    for (const [index, coverage] of raw.diagnosticCoverage.entries()) {
      const root = { module: raw.module, index };
      assert.equal(coverage.kind, "complete", kind + " " + text);
      assert.deepEqual(coverage.root, root);
      assert.deepEqual(coverage.purpose, { kind: "other" });
      assert.equal(coverage.obligations.length, 1);
      const [proof] = coverage.obligations;
      assert.equal(proof.kind, kind);
      assert.deepEqual(proof.diagnostic, root);
      assert.deepEqual(proof.root, root);
      assert.equal(proof.application, null);
      const components = kind === "write-fit" ? [proof.source, proof.destination]
        : kind === "operator" ? [proof.left, proof.right] : [proof.receiver, proof.index];
      const rows = components.map(id => raw.types.components[id]);
      assert.deepEqual(rows.map(row => text.slice(syntax[row.root.node].origin.start,
        syntax[row.root.node].origin.start + syntax[row.root.node].origin.length)), operands);
      assert.equal(rows.every(row => row.root.module === raw.module && row.path === null), true);
      const types = rows.map(row => raw.types.types.find(type => type.component === row.id).form);
      assert.equal(types.every(row => row.kind === "available"), true);
      if (kind === "write-fit") {
        assert.deepEqual(types[0].value, { kind: "scalar", scalar: "string" });
        assert.deepEqual(types[1].value, { kind: "scalar", scalar: "boolean" });
      }
    }
  }
  const { raw } = await captured(`export function quiet(input: string): boolean {
    // @ts-expect-error
    return input;
  }
  export function missing(): boolean { return notDeclared; }`);
  assert.deepEqual(raw.checkerDiagnostics.map(report => report.code.number), [2304]);
  assert.deepEqual(raw.diagnosticCoverage, [{ kind: "unavailable", root: { module: raw.module, index: 0 } }]);
  const key = await captured('declare function pick(name: string): "picked"; export interface Shape { [pick(0)]: boolean; }');
  assert.deepEqual(key.raw.checkerDiagnostics.map(report => report.code.number), [1169, 2345]);
  assert.deepEqual(key.raw.diagnosticCoverage, [0, 1].map(index => ({ kind: "unavailable", root: { module: key.raw.module, index } })));
});

test("incompatible tuple assertions borrow actual completed endpoints without replacing the checker reports", async () => {
  const { raw, lower } = await captured(`
    export function wrong(input: readonly [boolean, true]): readonly [boolean, true] {
      return input as readonly [string, true];
    }
  `);
  assert.deepEqual(raw.checkerDiagnostics.map(row => row.code.number), [2322, 2352]);
  const callable = raw.tree.statements.nodes[0];
  const assertion = callable.body.statements.nodes[0].expression;
  const source = raw.checkerViews.find(row => row.node.node === assertion.id).read;
  assert.equal(source.kind, "available");
  const destination = raw.annotations.find(row => row.node === callable.type.id).type;
  const [coverage, assertionFailure] = raw.diagnosticCoverage;
  assert.equal(coverage.kind, "complete");
  assert.deepEqual(coverage.root, { module: raw.module, index: 0 });
  const [proof] = coverage.obligations;
  assert.equal(proof.kind, "write-fit");
  assert.deepEqual([proof.source, proof.destination],
    [raw.types.types[source.value].component, raw.types.types[destination].component]);
  assert.deepEqual(assertionFailure, { kind: "unavailable", root: { module: raw.module, index: 1 } });
  const lowered = lower();
  assert.equal(lowered.kind, "ok");
  assert.equal(lowered.value.checkerDiagnostics === raw.checkerDiagnostics, true);
});

test("backing capture pays the SDK read and the complete evidence before publishing any raw group", async () => {
  const { fixture, opened, raw } = await captured("export function f(input:string):boolean { return input; }");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const original = OpenedProgram.checked(opened.program);
  const files = OpenedProgram.modules(opened.program).modules.map(entry =>
    OpenedProgram.file(opened.program, entry.kind === "snapshot" ? entry.module : entry.document.module));
  let reads = 0;
  let cross = false;
  const checked = { ...original, getSourceFileQueries(file) {
    const queries = original.getSourceFileQueries(file);
    return { ...queries, checker: { ...queries.checker, getBackingConstraints() {
      reads += 1;
      const constraints = queries.checker.getBackingConstraints();
      if (!cross) return constraints;
      const [fit] = constraints;
      assert.equal(fit.kind, "write-fit");
      const type = fit.destination.type;
      assert.equal(fit.source.type === type, false);
      return [{ ...fit, source: { ...fit.source, root: { ...fit.source.root, type }, type } }];
    } } };
  } };
  const program = OpenedProgram.create(checked, opened.deps.extensions, files, [], OpenedProgram.contributions(opened.program));
  for (const [dimension, beforeRead, exact] of [
    ["maximumCapturedFactsPerModule", 40, 42], ["maximumCapturedEdgesPerModule", 26, 40],
  ]) for (let maximum = beforeRead; maximum <= exact; maximum += 1) {
    reads = 0;
    const outcome = captureSingleModule(fixture.front, { ...opened.deps,
      navigationCapture: { ...opened.deps.navigationCapture, [dimension]: maximum } }, program, raw.module);
    assert.equal(reads, maximum === beforeRead ? 0 : 1, dimension + " " + maximum);
    if (maximum === exact) {
      assert.equal(outcome.kind, "ok");
      assert.deepEqual(outcome.value.diagnosticCoverage, raw.diagnosticCoverage);
      continue;
    }
    assert.equal(outcome.kind, "refused");
    assert.deepEqual(outcome.diagnostics.slice(0, -1), raw.checkerDiagnostics);
    assert.equal(outcome.diagnostics.at(-1).evidence[0], "front." + dimension);
  }
  cross = true;
  const crossed = captureSingleModule(fixture.front, opened.deps, program, raw.module);
  assert.equal(crossed.kind, "ok");
  assert.deepEqual(crossed.value.checkerDiagnostics, raw.checkerDiagnostics);
  assert.deepEqual(crossed.value.diagnosticCoverage, [{ kind: "unavailable", root: { module: raw.module, index: 0 } }]);
});
