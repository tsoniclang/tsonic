import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { sourceDeclarationUses } from "../../packages/target-api/dist/source-navigation/declaration-uses.js";
import { sourceCallableValueParameters } from "../../packages/target-api/dist/source-navigation/callable-parameters.js";
import { sourceStorageFormalOwner } from "../../packages/target-api/dist/target-analysis/source-storage/model/subjects.js";
import { createSourceDeclarationRetentionQuery, createSourceDeclarationOwnershipValues, createSourceDeclarationOwnershipBudget,
  defaultSourceDeclarationOwnershipLimits, createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { fixture, deferred } from "./source-storage-retention-case-map-fixtures.mjs";

for (const [label, body] of [
  ["declared this parameter", `function select(this: void, value: object): object { return value; }
    const original = {}; const result = select(original);`],
  ["arrow parameter", `const select = (value: object): object => value;
    const original = {}; const result = select(original);`],
  ["function expression parameter", `const select = function named(value: object): object { return value; };
    const original = {}; const result = select(original);`],
  ["method parameter", `const owner = { select(value: object): object { return value; } };
    const original = {}; const result = owner.select(original);`],
  ["constructor parameter property", `class Box { constructor(readonly value: object) {} }
    const original = {}; const result = new Box(original).value;`],
]){
test(`checked value parameters preserve the original selected storage: ${label}`, () => {
    const current = fixture(body);
    const initialized = name => {
      const declaration = current.storage.nodes.find(node => current.source.ast.is.IsVariableDeclaration(node) &&
        current.source.ast.text(current.source.ast.name(node)) === name);
      assert.equal(declaration !== undefined, true, `${label}: exact ${name} declaration`);
      const expression = current.source.ast.as.AsVariableDeclaration(declaration).Initializer;
      const selected = current.storage.subjectFor(expression);
      assert.equal(selected.kind === "resolved", true, `${label}: exact ${name} storage`);
      return selected.subject;
    };
    const origins = current.storage.closedOriginsFor(initialized("result"));
    assert.equal(origins.kind === "complete", true, `${label}: ${origins.reason ?? origins.kind}`);
    assert.equal(origins.origins.length === 1 && origins.origins[0].subject === initialized("original"), true,
      `${label}: only the exact selected caller's input survives`);
    assert.equal(current.storage.failureReason() === undefined, true, `${label}: completed checked input correspondence`);
  });
}

test("a checked type-only this parameter never becomes a runtime formal port", () => {
  const current = fixture(`function select(this: void, value: object): object { return value; }
    const original = {}; select(original);`);
  const owner = current.declaration("select");
  const parameters = sourceCallableValueParameters(current.source.ast, owner, current.source.semantics.forNode(owner),
    { kind: "declaration" });
  assert.equal(parameters?.length === 1, true, "the checked signature has exactly one runtime value parameter");
  const subject = current.storage.subject(parameters[0], "input");
  assert.equal(subject.kind === "resolved" && sourceStorageFormalOwner(subject.subject, current.source) === owner, true,
    "the actual checked value parameter retains its original declaration owner");
  const marker = current.storage.nodes.find(node => current.source.ast.is.IsParameterDeclaration(node) &&
    current.source.ast.parent(node) === owner && current.source.ast.text(current.source.ast.name(node)) === "this");
  assert.equal(marker !== undefined, true, "the authored type-only receiver declaration is still present in source");
  const receiver = current.storage.subject(marker, "input");
  assert.equal(receiver.kind === "resolved" && sourceStorageFormalOwner(receiver.subject, current.source) === undefined, true,
    "the type-only receiver cannot acquire an invented value-parameter activation");
});

for (const [label, body] of [
  ["module function", "function child(): void {} child();"],
  ["nested function", "function start(): void { function child(): void {} child(); } start();"],
  ["module arrow", "const child = (): void => {}; child();"],
  ["nested arrow", "function start(): void { const child = (): void => {}; child(); } start();"],
  ["module function expression", "const child = function named(): void {}; child();"],
  ["nested function expression", "function start(): void { const child = function named(): void {}; child(); } start();"],
  ["capturing parameterized arrow", `function start(value: number): void {
    const child = (argument: number): void => { void value; void argument; }; child(value);
  } start(7);`],
  ["capturing parameterized function expression", `function start(value: number): void {
    const child = function named(argument: number): void { void value; void argument; }; child(value);
  } start(7);`],
  ["const callable aliases", "function child(): void {} const first = child; const second = first; second();"],
  ["checked formal forwarding", "function child(): void {} function invoke(callback: () => void): void { callback(); } invoke(child);"],
  ["self recursive declaration", "function child(repeat: boolean): void { if (repeat) child(false); } child(true);"],
  ["mutual declarations", "function child(repeat: boolean): void { if (repeat) other(false); } function other(repeat: boolean): void { if (repeat) child(false); } child(true);"],
]){
test(`callable creation and execution case map: ${label}`, () => {
    const current = fixture(body);
    const selected = current.select("child");
    assert.equal(selected.kind === "resolved", true, `${label}: ${selected.reason ?? selected.kind}`);
    assert.equal(selected.premises[0]?.kind, "retained", `${label}: nonescaping checked calls`);
    assert.equal(selected.premises.length > 0, true, `${label}: nonempty original use proof`);
    assert.equal(current.budget.failure() === undefined, true, `${label}: finite completed query`);
  });
}

test("declaration capture facts distinguish an enclosing binding from its invoked body", () => {
  const current = fixture(`
    function moduleValue(): void {}
    function start(): void {
      function child(repeat: boolean): void { if (repeat) child(false); }
      function sibling(): void { child(false); moduleValue(); }
      child(true);
      sibling();
    }
    moduleValue();
    start();
  `);
  const { ast } = current.source;
  const moduleUses = current.source.navigation.declarationUses(current.declaration("moduleValue"));
  assert.equal(moduleUses.filter(use => use.kind === "direct-call").length, 2, "two exact module references");
  assert.equal(moduleUses.every(use => !use.captured), true, "a nested use does not allocate module capture storage");
  const child = current.declaration("child");
  const definitions = sourceDeclarationUses(ast, child, [child, ast.name(child)]);
  assert.equal(definitions.every(use => !use.captured), true, "definition and its name are not runtime captures");
  const uses = current.source.navigation.declarationUses(child).filter(use => use.kind === "direct-call");
  assert.equal(uses.length, 3, "direct, recursive and sibling references retained");
  for (const use of uses) {
    let owner = ast.parent(use.reference);
    while (owner !== undefined && !ast.is.IsFunctionDeclaration(owner)) owner = ast.parent(owner);
    const name = owner === undefined ? undefined : ast.text(ast.name(owner));
    assert.equal(use.captured, name === "sibling", `${name}: only the sibling captures the enclosing child binding`);
  }
});
