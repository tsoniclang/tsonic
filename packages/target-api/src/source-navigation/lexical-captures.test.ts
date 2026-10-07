import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { sourceLexicalCaptures } from "./lexical-captures.js";

function fixture() {
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
