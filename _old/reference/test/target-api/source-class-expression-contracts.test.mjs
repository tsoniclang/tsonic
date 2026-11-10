import assert from "node:assert/strict";
import test from "node:test";
import { sourceTypeFlowFixture } from "./fixtures/source-type-flow-fixture.mjs";

test("class-expression public navigation preserves overloaded, inherited and accessor identities", () => {
  const { source, file } = sourceTypeFlowFixture("", { imports: "", files: {
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
    } });
  const baseFile = source.documents.all.find(document => document.fileName === "/src/base.ts")?.sourceFile;
  assert.ok(file && baseFile);
  const [base, unrelated] = source.ast.statements(baseFile);
  assert.ok(base && unrelated);
  const [value, read, firstOverload, secondOverload, implementation, inherited] = source.ast.members(base);
  const unrelatedMember = source.ast.members(unrelated)[0];
  assert.ok(value && read && firstOverload && secondOverload && implementation && inherited && unrelatedMember);
  const expressions = [];
  const visit = (node) => {
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
    const correspondences = [[value, localValue], [read, localRead],
      [firstOverload, implementation], [secondOverload, implementation], [inherited, inherited]];
    for (const [contract, expected] of correspondences) {
      const selected = source.facts.navigation.memberImplementation(expression, contract);
      assert.equal(selected.kind, "resolved");
      if (selected.kind !== "resolved") throw new Error("Missing public member implementation");
      assert.ok(selected.contractDeclaration === contract);
      assert.ok(selected.implementation.declaration === expected);
      assert.ok(Object.isFrozen(selected));
      assert.ok(Object.isFrozen(selected.implementation));
      assert.ok(source.facts.navigation.memberImplementation(expression, contract) === selected);
    }
    assert.equal(source.facts.navigation.memberImplementation(expression, unrelatedMember).kind, "unrelated");
    assert.equal(source.facts.navigation.memberImplementation(localRead, read).kind, "unresolved");
  }
});
