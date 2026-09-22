import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../public/source.js";

test("class-expression public navigation preserves overloaded, inherited and accessor identities", () => {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: {
      "/src/base.ts": `
        export abstract class Base<T> {
          abstract value: T;
          abstract read(): T;
          select(value: string): string;
          select(value: number): number;
          select(value: string | number): string | number { return value; }
          inherited(): number { return 4; }
        }
        export class Unrelated { read(): number { return 0; } }
      `,
      "/src/index.ts": `
        import { Base as Parent } from "./base.js";
        export const Named = class Local extends Parent<string> {
          stored: string = "initial";
          get value(): string { return this.stored; }
          set value(value: string) { this.stored = value; }
          read(): string { return this.stored; }
        };
        export const Anonymous = class extends Parent<string> {
          value: string = "second";
          read(): string { return this.value; }
        };
      `,
    },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const baseFile = checked.getSourceFile("/src/base.ts");
  assert.ok(file && baseFile);
  const [base, unrelated] = source.ast.statements(baseFile);
  assert.ok(base && unrelated);
  const [value, read, firstOverload, secondOverload, implementation, inherited] = source.ast.members(base);
  const unrelatedMember = source.ast.members(unrelated)[0];
  assert.ok(value && read && firstOverload && secondOverload && implementation && inherited && unrelatedMember);
  const expressions: Node[] = [];
  const visit = (node: Node): void => {
    if (source.ast.is.IsClassExpression(node)) expressions.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.equal(expressions.length, 2);
  for (const expression of expressions) {
    const members = source.ast.members(expression);
    const localRead = members.find(member => member !== undefined && source.ast.is.IsMethodDeclaration(member));
    const localValue = members.find(member => member !== undefined && source.ast.is.IsGetAccessorDeclaration(member)) ?? members[0];
    assert.ok(localRead && localValue);
    const correspondences: readonly (readonly [Node, Node])[] = [[value, localValue], [read, localRead],
      [firstOverload, implementation], [secondOverload, implementation], [inherited, inherited]];
    for (const [contract, expected] of correspondences) {
      const selected = source.navigation.memberImplementation(expression, contract);
      assert.equal(selected.kind, "resolved");
      if (selected.kind !== "resolved") throw new Error("Missing public member implementation");
      assert.ok(selected.contractDeclaration === contract);
      assert.ok(selected.implementation.declaration === expected);
      assert.ok(Object.isFrozen(selected));
      assert.ok(Object.isFrozen(selected.implementation));
      assert.ok(source.navigation.memberImplementation(expression, contract) === selected);
    }
    assert.equal(source.navigation.memberImplementation(expression, unrelatedMember).kind, "unrelated");
    assert.equal(source.navigation.memberImplementation(localRead, read).kind, "unresolved");
  }
});
