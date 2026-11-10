import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";

function fixture(text) {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src", compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `export {}; ${text}` },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true, "the actual checked source file exists");
  const nodes = [];
  const pending = [file];
  while (pending.length !== 0) {
    const node = pending.pop();
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  const initializer = name => Node_Initializer(source.ast, nodes.find(node =>
    source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === name));
  const storage = createSourceStorageQuery(source, [file], defaultSourceStorageLimits);
  const select = name => {
    const subject = storage.subjectFor(initializer(name));
    assert.equal(subject.kind === "resolved", true, "the original expression has a checked source subject");
    return storage.closedOriginsFor(subject.subject);
  };
  return { source, nodes, storage, initializer, select };
}

test("an exact checked indexed write preserves its original container without inventing indexed value storage", () => {
  const current = fixture(`
    interface Dictionary { [key: string]: object; }
    const original = {};
    const alias: Dictionary = original;
    const replacement = {};
    alias["token"] = replacement;
    const selected = original;
    const observed = alias["token"];
  `);
  const access = current.nodes.find(node => current.source.ast.is.IsElementAccessExpression(node) &&
    current.source.semantics.forNode(node).operations.elementAccess(node)?.accessMode === "write");
  assert.equal(access !== undefined, true, "the original checked indexed write is retained");
  const evidence = current.source.semantics.forNode(access).operations.elementAccess(access);
  assert.equal(evidence?.selectedDeclaration !== undefined &&
    current.source.ast.is.IsIndexSignatureDeclaration(evidence.selectedDeclaration) && evidence.writable === true, true,
    "the actual checked index contract, not a fabricated named field, admits the write");
  const selected = current.select("selected");
  assert.equal(selected.kind === "complete" && selected.origins.length === 1 &&
    selected.origins[0].subject.node === current.initializer("original"), true,
    "a contained write cannot replace the container's original allocation");
  const observed = current.select("observed");
  assert.equal(observed.kind === "unresolved", true, "the removed indexed-value alternative is not reintroduced");
  assert.equal(current.storage.failureReason() === undefined, true, "local slot uncertainty is not a global resource failure");
});

test("an unmodelled indexed destination cannot certify a possibly overwritten named callable", () => {
  const current = fixture(`
    const original = { read: () => ({}) };
    const alias: { [key: string]: () => object } = original;
    declare const key: string;
    alias[key] = () => ({});
    const observed = original.read();
  `);
  assert.equal(current.select("observed").kind === "unresolved", true,
    "existing physical member uncertainty remains attached to every potentially overwritten field");
});
