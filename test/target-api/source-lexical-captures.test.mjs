import assert from "node:assert/strict";
import test from "node:test";
import { createSourceProgramNavigation, sourceLexicalCaptures, sourceDeclarationIsModuleScoped, sourceBindingScope } from "../../packages/target-api/dist/public/source.js";
import { checkedSource, namedDeclaration, namedVariable, projectSourceFile, requiredNode } from "../fixtures/source-navigation.mjs";

test("lexical captures retain exact bindings, exclude types and modules, and include deferred uses", async () => {
  const source = await checkedSource("lexical-captures", { "src/index.ts": `
    const globalValue = 1;
    export function create<T>(seed: T) {
      let count = 0;
      const source = { count: 1 };
      return {
        apply<U>(item: U): U {
          const count = source.count;
          const later = () => seed;
          later();
          if (count === globalValue) return item;
          return item;
        },
        increment<V>(value: V): V { count++; return value; }
      };
    }
  ` });
  const ast = source.ast;
  const file = projectSourceFile(source, "src/index.ts");
  const navigation = createSourceProgramNavigation(source);
  const create = namedDeclaration(ast, file, "create");
  const literal = requiredNode(ast, create, node => ast.is.IsObjectLiteralExpression(node) &&
    ast.properties(node).some(property => ast.text(ast.name(property)) === "apply"));
  const selected = sourceLexicalCaptures(literal, ast.properties(literal), ast, navigation);
  const seed = ast.parameters(create)[0];
  const count = namedVariable(ast, create, "count");
  const input = namedVariable(ast, create, "source");
  assert.deepEqual(new Set(selected.captures.map(capture => capture.declaration)), new Set([seed, count, input]));
  for (const capture of selected.captures) {
    assert.ok(capture.references.length > 0);
    assert.ok(Object.isFrozen(capture.references));
    for (const reference of capture.references) assert.equal(navigation.sourceReferenceFor(reference).declaration, capture.declaration);
  }
  assert.deepEqual(selected.selfReferences, []);
  assert.ok(Object.isFrozen(selected.captures));
  assert.equal(sourceDeclarationIsModuleScoped(namedVariable(ast, file, "globalValue"), ast), true);
  assert.equal(sourceDeclarationIsModuleScoped(count, ast), false);
  assert.throws(() => sourceLexicalCaptures(literal, [file], ast, navigation), /exact source scope/);
});

test("named recursive functions distinguish self references from outer bindings", async () => {
  const source = await checkedSource("lexical-recursion", { "src/index.ts": `
    export function create(seed: number) {
      return function recursive(depth: number): number { return depth === 0 ? seed : recursive(depth - 1); };
    }
  ` });
  const ast = source.ast;
  const file = projectSourceFile(source, "src/index.ts");
  const create = namedDeclaration(ast, file, "create");
  const expression = requiredNode(ast, create, node => ast.is.IsFunctionExpression(node));
  const result = sourceLexicalCaptures(expression, [expression], ast, createSourceProgramNavigation(source));
  assert.deepEqual(result.captures.map(capture => capture.declaration), [ast.parameters(create)[0]]);
  assert.equal(result.selfReferences.length, 1);
});

test("captured binding scopes distinguish parameters, lexical blocks, loops and function-scoped vars", async () => {
  const source = await checkedSource("capture-binding-scopes", { "src/index.ts": `
    export function create(seed: number) {
      { let local = seed; var shared = 1; }
      for (let index = 0; index < 2; index++) { const { value } = { value: index }; }
      for (const item of [1, 2]) { item; }
      try { seed; } catch (error) { error; }
      return seed;
    }
  ` });
  const ast = source.ast;
  const file = projectSourceFile(source, "src/index.ts");
  const create = namedDeclaration(ast, file, "create");
  assert.equal(sourceBindingScope(ast.parameters(create)[0], ast), ast.body(create));
  assert.equal(sourceBindingScope(namedVariable(ast, create, "shared"), ast), ast.body(create));
  const local = namedVariable(ast, create, "local");
  const localScope = sourceBindingScope(local, ast);
  assert.equal(ast.kindName(localScope), "KindBlock");
  assert.notEqual(localScope, ast.body(create));
  assert.equal(ast.kindName(sourceBindingScope(namedVariable(ast, create, "index"), ast)), "KindForStatement");
  assert.equal(ast.kindName(sourceBindingScope(namedVariable(ast, create, "item"), ast)), "KindForOfStatement");
  const bound = requiredNode(ast, create, node => ast.is.IsBindingElement(node));
  assert.equal(ast.kindName(sourceBindingScope(bound, ast)), "KindBlock");
  const caught = namedVariable(ast, create, "error");
  assert.equal(sourceBindingScope(caught, ast), ast.as.AsCatchClause(ast.parent(caught)).Block);
});
