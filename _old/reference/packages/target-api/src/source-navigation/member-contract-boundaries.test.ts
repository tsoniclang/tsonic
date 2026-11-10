import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";

test("inherited contract discovery never treats a constructor-valued property as a type declaration", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    export class Owner {
      Base = class { read() { return 1; } };
      create() { return class Inner extends this.Base { read() { return 2; } }; }
    }
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true,
    formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined).slice(0, 4)).slice(0, 1024));
  const source = createTargetSourceProgram(checked);
  const owner = source.ast.statements(checked.getSourceFile("/src/index.ts")!)[0]!;
  const create = source.ast.members(owner).find(member => member !== undefined && source.ast.text(source.ast.name(member)) === "create")!;
  const returned = source.ast.statements(source.ast.body(create)!)[0]!;
  assert.equal(source.ast.is.IsReturnStatement(returned), true, "the selected body statement is an exact return");
  const expression = source.ast.as.AsReturnStatement(returned)?.Expression;
  assert.equal(expression !== undefined && source.ast.is.IsClassExpression(expression), true);
  const method = source.ast.members(expression!)[0]!;
  const selected = source.navigation.memberContracts(method);
  assert.equal(selected.kind, "unresolved");
  assert.match(selected.reason, /exact class or interface declaration/u);
  assert.equal(selected.declaration === method, true);
});
