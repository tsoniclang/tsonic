import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node, type Type } from "@tsonic/tsts";
import { createTargetSourceProgram, sourceTypeIsAuthoredEmptyObject, Node_Initializer } from "../public/source.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    function supply() { return {}; }
    const returned = supply();
    const literal = {};
    const populated = { count: 1 };
    const spread = { ...literal };
    const annotated: {} = {};
    function generic<T>(value: T): T { return value; }
  ` }, compilerOptions: { strictNullChecks: true, module: "esnext", target: "es2022" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const semantics = source.semantics.forFile(file);
  const types = new Map<string, Type>();
  const pending: Node[] = [file];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (source.ast.is.IsVariableDeclaration(node) || source.ast.is.IsParameterDeclaration(node)) {
      const name = source.ast.name(node);
      const selected = source.ast.is.IsVariableDeclaration(node)
        ? semantics.declarations.declaredValueType(node)
        : semantics.types.expressionType(node);
      if (name !== undefined && selected !== undefined) types.set(source.ast.text(name), selected);
      const initializer = Node_Initializer(source.ast, node);
      if (name !== undefined && initializer !== undefined) {
        const type = semantics.types.expressionType(initializer);
        if (type !== undefined) types.set(`${source.ast.text(name)}:initializer`, type);
      }
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  return { source, semantics, types };
}

test("exact empty literal evidence survives inferred function return widening", () => {
  const current = fixture();
  const returned = current.types.get("returned");
  assert.ok(returned);
  assert.equal(current.semantics.types.couldContainTypeVariables(returned), true);
  for (const name of ["returned", "literal", "literal:initializer"]) {
    const type = current.types.get(name);
    assert.ok(type, name);
    assert.equal(sourceTypeIsAuthoredEmptyObject(type, current.source.ast, current.semantics, current.source.navigation), true, name);
  }
  for (const name of ["populated", "spread", "annotated", "value"]) {
    const type = current.types.get(name);
    assert.ok(type, name);
    assert.equal(sourceTypeIsAuthoredEmptyObject(type, current.source.ast, current.semantics, current.source.navigation), false, name);
  }
});

test("empty literal evidence rejects foreign and missing declaration ownership", () => {
  const current = fixture();
  const type = current.types.get("returned");
  assert.ok(type);
  assert.equal(sourceTypeIsAuthoredEmptyObject(type, current.source.ast, current.semantics,
    { isProjectDeclaration: () => false }), false, "foreign declaration");
  for (const declarations of [[], [undefined]]) {
    const semantics = { ...current.semantics, declarations: { ...current.semantics.declarations,
      symbolDeclarations: () => declarations as unknown as readonly Node[] } };
    assert.equal(sourceTypeIsAuthoredEmptyObject(type, current.source.ast, semantics, current.source.navigation), false,
      "absent declaration");
  }
});
