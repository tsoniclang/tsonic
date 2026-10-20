import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { getEffectiveSourceTypeArguments } from "./type-arguments.js";

test("effective arguments never replace missing class bindings with authored arity", () => {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `
      function make<T>(input: T) {
        class Pair<U> {
          left: T;
          right: U;
          constructor(left: T, right: U) { this.left = left; this.right = right; }
        }
        return new Pair<number>(input, 1);
      }
      const result = make("text");
      const tuple: [number, string] = [1, "text"];
    ` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.equal(checked.diagnostics.length, 0);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const queries = checked.getSourceFileQueries(file);
  const variables = new Map<string, Node>();
  const visit = (node: Node): void => {
    if (checked.ast.is.IsVariableDeclaration(node)) {
      variables.set(checked.ast.text(checked.ast.name(node)), node);
    }
    for (const child of checked.ast.children(node)) {
      if (child !== undefined) visit(child);
    }
  };
  visit(file);
  const typeOf = (name: string) => {
    const declaration = variables.get(name);
    assert.ok(declaration);
    const type = queries.checker.getTypeAtLocation(checked.ast.name(declaration));
    assert.ok(type);
    return type;
  };
  const type = typeOf("result");
  const selected = getEffectiveSourceTypeArguments(checked.ast, queries, type);
  assert.equal(selected?.length, 1);
  assert.equal(queries.typeShape.isNumberLike(selected?.[0]), true);
  const missingBindings = {
    ...queries,
    typeShape: { ...queries.typeShape, getTypeReferenceArgumentInfos: () => undefined },
  };
  assert.equal(getEffectiveSourceTypeArguments(checked.ast, missingBindings, type), undefined);
  const tuple = getEffectiveSourceTypeArguments(checked.ast, queries, typeOf("tuple"));
  assert.equal(tuple?.length, 2);
  assert.equal(queries.typeShape.isNumberLike(tuple?.[0]), true);
  assert.equal(queries.typeShape.isStringLike(tuple?.[1]), true);
  assert.equal(Object.isFrozen(tuple), true);
});
