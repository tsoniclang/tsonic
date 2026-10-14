import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { sourceDeclarationIsModuleScoped, sourceLexicalCaptures } from "./lexical-captures.js";

function fixture(extraSource = "") {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/project", files: {
    "/project/index.ts": `
      class Base { value = 7; read(): number { return this.value; } }
      export class Derived extends Base {
        create() {
          const direct = () => super.read();
          const indexed = () => super["read"]();
          const deferred = () => () => super.read();
          const receiver = () => this.value;
          const staticValue = () => 7;
          const independent = () => function (this: Base): number { return this.value; };
          return { direct, indexed, deferred, receiver, staticValue, independent };
        }
      }
      export const recursive = function self(count: number): number { return count === 0 ? 1 : self(count - 1); };
      ${extraSource}
    `,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0,
    formatDiagnostics(checked.diagnostics.filter(value => value !== undefined).slice(0, 4)).slice(0, 1024));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/project/index.ts");
  assert.equal(file !== undefined, true, "exact checked source");
  const values = new Map<string, Node>();
  let method: Node | undefined;
  const visit = (node: Node): void => {
    if (source.ast.is.IsMethodDeclaration(node) && source.ast.text(source.ast.name(node)) === "create") method = node;
    if (source.ast.is.IsVariableDeclaration(node)) {
      const initializer = source.ast.as.AsVariableDeclaration(node)?.Initializer;
      const name = source.ast.name(node);
      if (initializer !== undefined && name !== undefined) values.set(source.ast.text(name), initializer);
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file!);
  assert.equal(method !== undefined, true, "exact derived method receiver owner");
  return { source, method, values, select(name: string) {
    const scope = values.get(name);
    assert.equal(scope !== undefined, true, "exact authored callable");
    return sourceLexicalCaptures(scope!, [scope!], source.ast, source.navigation);
  } };
}

test("super and this retain the exact derived-method receiver through deferred lexical callbacks", () => {
  const input = fixture();
  for (const name of ["direct", "indexed", "deferred", "receiver"]) {
    const selected = input.select(name);
    assert.equal(selected.captures.length, 0, name);
    assert.equal(selected.receivers.length, 1, name);
    assert.equal(selected.receivers[0]?.owner === input.method, true, "exact enclosing native receiver");
    assert.equal(selected.receivers[0]?.references.length, 1, "exact receiver occurrence");
    assert.equal(Object.isFrozen(selected.receivers), true);
    assert.equal(Object.isFrozen(selected.receivers[0]), true);
    assert.equal(Object.isFrozen(selected.receivers[0]?.references), true);
  }
});

test("stateless, independent-this and named-self definitions acquire no outer receiver", () => {
  const input = fixture();
  for (const name of ["staticValue", "independent", "recursive"]) {
    const selected = input.select(name);
    assert.equal(selected.receivers.length, 0, name);
    assert.equal(selected.captures.length, 0, name);
    assert.equal(selected.selfReferences.length, name === "recursive" ? 1 : 0, name);
  }
});

test("lexical capture roots cannot cross their exact authored scope", () => {
  const input = fixture();
  assert.throws(() => sourceLexicalCaptures(input.values.get("staticValue")!, [input.values.get("direct")!],
    input.source.ast, input.source.navigation), /exact source scope/u);
});

test("lexical capture traversal charges capture-free syntax and propagates budget exhaustion unchanged", () => {
  const input = fixture(`export const wide = () => { ${"0;".repeat(256)} return 0; };`);
  const scope = input.values.get("wide")!;
  const failure = new Error("test work exhausted");
  let steps = 0;
  assert.throws(() => sourceLexicalCaptures(scope, [scope], input.source.ast, input.source.navigation, () => {
    steps += 1;
    if (steps > 16) throw failure;
  }), error => error === failure);
  assert.equal(steps, 17, "capture-free scanning is interrupted by the same work owner");
  assert.equal(input.select("wide").captures.length, 0);
});

test("lexical capture root containment consumes the caller's work budget", () => {
  const input = fixture();
  const scope = input.values.get("deferred")!;
  const nested = input.source.ast.body(scope)!;
  const failure = new Error("test containment exhausted");
  let steps = 0;
  assert.throws(() => sourceLexicalCaptures(scope, [nested], input.source.ast, input.source.navigation, () => {
    steps += 1;
    if (steps > 1) throw failure;
  }), error => error === failure);
  assert.equal(steps, 2, "ancestor lookup is interrupted before a false foreign-root result");
});

test("receiver ancestry charges the shared work owner without losing its exact receiver", () => {
  const input = fixture();
  const scope = input.values.get("receiver")!;
  const failure = new Error("test receiver ancestry exhausted");
  let receiverSteps = 0;
  assert.throws(() => sourceLexicalCaptures(scope, [scope], input.source.ast, input.source.navigation, node => {
    if (node !== undefined && input.source.ast.kindName(node) === "KindThisKeyword") {
      receiverSteps += 1;
      if (receiverSteps === 3) throw failure;
    }
  }), error => error === failure);
  assert.equal(receiverSteps, 3, "the existing receiver-owner hook charges its inspected ancestry");
  assert.equal(input.select("receiver").receivers[0]?.owner === input.method, true);
});

test("module-scope ancestry consumes the caller's work budget and keeps native binding classification", () => {
  const input = fixture("export const moduleValue = 7;");
  const declaration = input.source.ast.parent(input.values.get("moduleValue"))!;
  const local = input.source.ast.parent(input.values.get("staticValue"))!;
  const failure = new Error("test module ancestry exhausted");
  assert.throws(() => sourceDeclarationIsModuleScoped(declaration, input.source.ast, () => { throw failure; }), error => error === failure);
  let steps = 0;
  assert.equal(sourceDeclarationIsModuleScoped(declaration, input.source.ast, () => { steps += 1; }), true);
  assert.equal(steps > 1, true, "the module binding walks more than one charged ancestor");
  assert.equal(sourceDeclarationIsModuleScoped(local, input.source.ast), false);
});
