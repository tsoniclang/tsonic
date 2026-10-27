import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

function fixture(body) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    files: { "/src/index.ts": `export {}; ${body}` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics, "/src"));
  assert.equal(checked.extensionDiagnostics.length, 0, "exact source facts admitted");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true, "checked source file");
  const storage = createSourceStorageQuery(source, [file]);
  const variable = name => namedVariable(source.ast, file, name);
  const initializer = name => Node_Initializer(source.ast, variable(name));
  const domain = name => {
    const selected = storage.subjectFor(variable(name));
    assert.equal(selected.kind, "resolved", `${name}: exact source subject`);
    return storage.closedOriginsFor(selected.subject);
  };
  return { source, storage, initializer, domain };
}

function exactOrigins(current, name, expected, excluded = []) {
  const domain = current.domain(name);
  assert.equal(domain.kind === "complete" || domain.kind === "open", true,
    `${name}: actual receiver domain; ${domain.reason ?? domain.kind}`);
  assert.equal(domain.origins.length === expected.length && expected.every(node => domain.origins.some(origin => origin.subject.kind === "value" &&
    origin.subject.node === node && origin.subject.projection.length === 0)), true,
  `${name}: every original allocation remains unprojected`);
  assert.equal(domain.origins.some(origin => excluded.includes(origin.subject.node)), false,
    `${name}: unrelated or enclosing allocations never become receiver origins`);
  assert.equal(current.storage.failureReason(), undefined, `${name}: finite shared owner remains valid`);
}

for (const [name, read] of [
  ["property", "value.child"],
  ["literal element", 'value["child"]'],
  ["constant element", "value[key]"],
  ["optional property", "value?.child"],
  ["optional element", 'value?.["child"]'],
]) test(`actual ${name} receiver retains the child allocation through a broad local and return`, () => {
  const current = fixture(`
    const child = { label: "ready" }; const untouched = { count: 1 };
    const original = { value: 1, child, untouched };
    export function leak(): unknown { return original; }
    const value: any = leak(); const key = "child";
    const receiver = ${read}; const selected = receiver.label;
  `);
  exactOrigins(current, "value", [current.initializer("original")], [current.initializer("child")]);
  exactOrigins(current, "receiver", [current.initializer("child")],
    [current.initializer("original"), current.initializer("untouched")]);
});

test("the unchanged chained-literal program exposes the actual nested receiver, not literal ancestry", () => {
  const current = fixture(`
    export function leak(): unknown { return { value: 1, child: { label: "ready" } }; }
    const value: any = leak(); const count = value.value;
    const receiver = value.child; const label = value.child.label;
  `);
  const literals = current.storage.nodes.filter(current.source.ast.is.IsObjectLiteralExpression);
  const child = literals.find(node => current.source.ast.properties(node).length === 1);
  const outer = literals.find(node => current.source.ast.properties(node).length === 2);
  assert.equal(child !== undefined && outer !== undefined, true, "the exact two authored allocation nodes");
  exactOrigins(current, "receiver", [child], [outer]);
});

test("dynamic reads retain every physical member write without mixing another allocation", () => {
  const current = fixture(`
    const initial = {}; const replacement = {}; const unrelated = {};
    const original = { child: initial }; const separate = { child: unrelated };
    original.child = replacement;
    const value: any = original; const receiver = value.child;
  `);
  exactOrigins(current, "receiver", [current.initializer("initial"), current.initializer("replacement")],
    [current.initializer("unrelated"), current.initializer("separate"), current.initializer("original")]);
});

test("selecting an outer dynamic receiver never selects its unaccessed contained literal", () => {
  const current = fixture(`
    const child = { count: 1 }; const original = { child };
    const value: any = original; const receiver = value; const selected = receiver.child;
  `);
  exactOrigins(current, "receiver", [current.initializer("original")], [current.initializer("child")]);
});

for (const value of ["null", "undefined"]) for (const read of ["value?.child", 'value?.["child"]']) {
  test(`an absent actual dynamic receiver retains canonical optional absence (${value}; ${read})`, () => {
    const current = fixture(`const value: any = ${value}; const selected = ${read};`);
    const selected = current.domain("selected");
    assert.equal(selected.kind === "complete" && selected.origins.length === 0, true,
      `an absent receiver needs no fabricated physical member; ${selected.reason ?? selected.kind}`);
    assert.equal(current.storage.failureReason(), undefined, "optional absence does not reject the checked source graph");
  });
}

for (const [name, body] of [
  ["external receiver", "declare const value: any; const selected = value.child;"],
  ["nonconstant key", 'declare const key: string; const value: any = { child: {} }; const selected = value[key];'],
  ["unproven dynamic write", "const value: any = { child: {} }; value.child = {}; const selected = value.child;"],
]) test(`${name} cannot become an invented complete dynamic member domain`, () => {
  const current = fixture(body);
  const domain = current.domain("selected");
  assert.equal(domain.kind !== "complete", true, `${name}: ${domain.reason ?? domain.kind}`);
});
