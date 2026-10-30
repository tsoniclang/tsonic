import assert from "node:assert/strict";

import { createCompilerSessionFromFiles, formatDiagnostics, type Node, type Type } from "@tsonic/tsts";

import { createTargetSourceProgram } from "../public/source.js";

function inspect(text: string, files: Record<string, string> = {}) {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { ...files, "/src/index.ts": text },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.deepEqual(checked.extensionDiagnostics, []);
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const semantics = source.semantics.forFile(file);
  const results = [];
  const argumentTypes: Type[] = [];
  for (const node of walk(file)) {
    if (!source.ast.is.IsCallExpression(node)) continue;
    const call = semantics.operations.call(node);
    if (call?.sourceArguments.length !== 1) continue;
    const actual = call.sourceArguments[0]?.type;
    const selected = call.sourceSelectedSignatureParameters[0]?.selectedType;
    assert.ok(actual && selected);
    argumentTypes.push(actual);
    const result = semantics.types.structuralMembers(actual, selected, "read");
    assert.equal(semantics.types.structuralMembers(actual, selected, "read"), result);
    assert.ok(Object.isFrozen(result));
    results.push(result);
  }
  return { results, source, semantics, argumentTypes, checked, file };
  function* walk(node: Node): Generator<Node> {
    yield node;
    for (const child of source.ast.children(node)) if (child !== undefined) yield* walk(child);
  }
}

function check(text: string, files?: Record<string, string>) {
  return inspect(text, files).results;
}

function memberDeclaration(current: ReturnType<typeof inspect>, type: Type, name: string): Node {
  const property = current.semantics.types.propertyInfos(type).find(property => property.name === name);
  assert.ok(property, name);
  const declarations = current.semantics.declarations.symbolDeclarations(property.symbol);
  assert.equal(declarations.length, 1, `${name}: one checked member declaration`);
  return declarations[0]!;
}

export { inspect, check, memberDeclaration };
