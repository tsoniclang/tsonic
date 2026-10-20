import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";

test("using a receiver field as an index does not transport the receiver", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    class Cursor {
      index = 0;
      values = ["a", "b"];
      read(): string { return this.values[this.index]; }
      nested(): string { return [this.values][0][this.index]; }
      retain(): Cursor { return this; }
      pass(): void { consume(this); }
      capture(): () => number { return () => this.index; }
    }
    function consume(value: Cursor): void { void value; }
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.deepEqual(checked.diagnostics, []);
  const source = createTargetSourceProgram(checked);
  const occurrences: { readonly owner: string; readonly node: Node }[] = [];
  const visit = (node: Node, owner = ""): void => {
    const next = source.ast.is.IsMethodDeclaration(node) ? source.ast.text(source.ast.name(node)) : owner;
    if (source.ast.kindName(node) === "KindThisKeyword" || source.ast.kindName(node) === "KindThisExpression") {
      occurrences.push({ owner: next, node });
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child, next); });
  };
  source.navigation.sourceFiles.filter(file => source.ast.getFileName(file) === "/src/index.ts").forEach(file => visit(file));
  assert.equal(occurrences.filter(value => value.owner === "read" || value.owner === "nested").length, 4);
  for (const occurrence of occurrences) {
    const flow = source.navigation.expressionValueFlow(occurrence.node);
    if (occurrence.owner === "read" || occurrence.owner === "nested") {
      assert.equal(flow.hasUnclassifiedUse, false, occurrence.owner);
      assert.equal(flow.escapes, false, occurrence.owner);
      assert.equal(flow.uses.every(use => use.role === "receiver" && use.throughMember), true);
    }
    if (occurrence.owner === "retain") assert.equal(flow.returned, true);
    if (occurrence.owner === "pass") assert.equal(flow.passedAsArgument, true);
  }
});
