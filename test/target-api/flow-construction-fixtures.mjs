import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { analyzeSourceResourceScopes, createSourceControlFlowDomain, createSourceDeclarationControlFlow } from "../../packages/target-api/dist/target-analysis/flow/index.js";
import { sourceStorageClassLineages } from "../../packages/target-api/dist/target-analysis/source-storage/model/construction.js";

const classes = `
  class Base {
    value = mark("base-field");
    constructor(input = mark("base-parameter")) { mark("base-body"); }
  }
  class Derived extends Base {
    other = mark("derived-field");
    constructor(input = mark("derived-parameter")) { super(); mark("derived-body"); }
  }
`;

function fixture(text) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `export {}; declare function mark(name: string): number; ${text}` },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "unannotated authored construction checks");
  const source = createTargetSourceProgram(checked);
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles);
  const ast = source.ast;
  const named = name => storage.nodes.find(node => (ast.is.IsClassDeclaration(node) || ast.is.IsVariableDeclaration(node)) &&
    ast.text(ast.name(node)) === name);
  const construct = name => storage.invocations.find(node => ast.is.IsNewExpression(node) &&
    ast.text(ast.as.AsNewExpression(node).Expression) === name);
  const constructor = name => ast.members(named(name)).find(ast.is.IsConstructorDeclaration);
  return { source, storage, ast, named, construct, constructor };
}

function flow(current, declaration) {
  const selected = createSourceDeclarationControlFlow(current.source, declaration, { domain: { kind: "source" } });
  assert.equal(selected.kind === "resolved", true, selected.kind === "unresolved" ? selected.reason : "checked graph");
  return selected.graph;
}

function declarationFlow(current, declaration, limits) {
  const selected = createSourceDeclarationControlFlow(current.source, declaration, { domain: { kind: "source" }, limits });
  assert.equal(selected.kind === "resolved", true, selected.kind === "unresolved" ? selected.reason : "declaration graph");
  return selected.graph;
}

function marked(current, graph, name) {
  const found = graph.points.filter(point => point.operation.kind === "evaluate" && point.source !== undefined &&
    current.ast.is.IsCallExpression(point.source) && current.ast.arguments(point.source).some(argument =>
      current.ast.is.IsStringLiteral(argument) && current.ast.text(argument).includes(name)));
  assert.equal(found.length, 1, `${name}: one original evaluation`);
  return found[0];
}

function reachable(graph, from, to, exceptions = false) {
  const pending = [from];
  const seen = new Set();
  while (pending.length !== 0) {
    const selected = pending.pop();
    if (selected === to) return true;
    if (seen.has(selected)) continue;
    seen.add(selected);
    for (const edge of graph.points[selected].successors) if (exceptions || edge.kind !== "exception") pending.push(edge.to);
  }
  return false;
}

function propertyField(current, className, fieldName) {
  const owner = current.storage.nodes.find(node => (current.ast.is.IsClassDeclaration(node) || current.ast.is.IsClassExpression(node)) &&
    current.ast.text(current.ast.name(node)) === className);
  const declaration = owner === undefined ? undefined : current.ast.members(owner).find(node => current.ast.is.IsPropertyDeclaration(node) &&
    current.ast.text(current.ast.name(node)) === fieldName);
  assert.equal(declaration !== undefined, true, `${className}.${fieldName}: original checked property`);
  return declaration;
}

function runtimeLayers(layers, depth) {
  const output = execFileSync(process.execPath, ["--input-type=module", "-e",
    `const order = []; class Root { root = 0; }
     function layer(Parent, value) { return class Layer extends Parent { field = (order.push(value), value); }; }
     ${layers}
     const instances = [${Array.from({ length: depth }, (_, index) => `new Layer${index}()`).join(",")}];
     order.length = 0; new Layer${depth - 1}();
     process.stdout.write(JSON.stringify({ values: instances.map(instance => instance.field), identities: new Set(instances).size, order }));`],
  { encoding: "utf8", timeout: 10000, maxBuffer: 65536 });
  return JSON.parse(output);
}

export { classes, fixture, flow, declarationFlow, marked, reachable, propertyField, runtimeLayers };
