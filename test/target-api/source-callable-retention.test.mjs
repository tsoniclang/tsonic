import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceCallableRetentionQuery, createSourceStorageQuery, createSourceStorageBudget,
  defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";

function fixture(body) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `export {}; ${body}` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const storage = createSourceStorageQuery(source, [checked.getSourceFile("/src/index.ts")]);
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const query = createSourceCallableRetentionQuery({ source, storage, budget });
  const declaration = name => storage.nodes.find(node => source.ast.is.IsFunctionDeclaration(node) &&
    source.ast.text(source.ast.name(node)) === name);
  return { select: name => query.forDeclaration(declaration(name)), source, storage, budget };
}

test("a declared callback invoked only within source callers is scoped", () => {
  const current = fixture(`function child(): void {} child();`);
  const selected = current.select("child");
  assert.equal(selected.kind === "resolved", true, selected.reason ?? selected.kind);
  assert.equal(selected.retention, "scoped", "direct invocation is not an escaping value");
  assert.equal(selected.witnesses.length > 0, true, "the proof is nonempty");
});

test("forwarded checked formals and const aliases do not turn invocation into retention", () => {
  const current = fixture(`
    function child(): void {}
    function invoke(callback: () => void): void { callback(); }
    function forward(callback: () => void): void { const alias = callback; invoke(alias); }
    const original = child; forward(original);
  `);
  const selected = current.select("child");
  assert.equal(selected.kind === "resolved", true, selected.reason ?? selected.kind);
  assert.equal(selected.retention, "scoped", "all source formal paths end in ordinary calls");
});

test("a returned source callable has a real retaining witness", () => {
  const current = fixture(`function create(): () => void {
    function child(): void {} return child;
  } const stored = create(); stored();`);
  const selected = current.select("child");
  assert.equal(selected.kind === "resolved", true, selected.reason ?? selected.kind);
  assert.equal(selected.retention, "retained", "returning the closure retains its environment");
  assert.equal(selected.witnesses.length > 0, true, "the original return is recorded");
});

test("a checked source formal storing its callback is retained", () => {
  const current = fixture(`let stored: () => void = () => {};
    function retain(callback: () => void): void { stored = callback; }
    function child(): void {} retain(child);`);
  const selected = current.select("child");
  assert.equal(selected.kind === "resolved", true, selected.reason ?? selected.kind);
  assert.equal(selected.retention, "retained", "the actual formal's external store is not erased");
});

test("an opaque argument is open instead of being relabelled as borrowed or owned", () => {
  const current = fixture(`declare function opaque(callback: () => void): void;
    function child(): void {} opaque(child);`);
  assert.equal(current.select("child").kind, "unresolved", "a passed argument alone proves neither lifetime");
});

test("a locally invoked capturing source callback stays within the same activation", () => {
  const current = fixture(`function child(): void {}
    function invoke(callback: () => void): void { const nested = () => callback(); nested(); }
    invoke(child);`);
  const selected = current.select("child");
  assert.equal(selected.kind === "resolved", true, selected.reason ?? selected.kind);
  assert.equal(selected.retention, "scoped", "a capture is followed to its actual non-retaining uses");
});

test("an unused declaration is not a vacuous closed lifetime proof", () => {
  const current = fixture(`function child(): void {}`);
  assert.equal(current.select("child").kind, "unresolved", "no actual use cannot prove a scoped activation");
});

test("one retaining source path keeps the same callable retained on every query", () => {
  const current = fixture(`let stored: () => void = () => {};
    function child(): void {}
    function invoke(callback: () => void): void { callback(); }
    invoke(child); stored = child;`);
  const first = current.select("child");
  assert.equal(first.kind === "resolved", true, first.reason ?? first.kind);
  assert.equal(first.retention, "retained", "one actual escape prevents an all-use non-retention proof");
  assert.equal(current.select("child") === first, true, "the owner publishes one immutable selection");
  assert.equal(Object.isFrozen(first) && Object.isFrozen(first.witnesses), true, "source evidence cannot be rewritten by native consumers");
});
