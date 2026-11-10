import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { sourceDeclarationUses } from "../../packages/target-api/dist/source-navigation/declaration-uses.js";
import { sourceCallableValueParameters } from "../../packages/target-api/dist/source-navigation/callable-parameters.js";
import { sourceStorageFormalOwner } from "../../packages/target-api/dist/target-analysis/source-storage/model/subjects.js";
import { createSourceDeclarationRetentionQuery, createSourceDeclarationOwnershipValues, createSourceDeclarationOwnershipBudget,
  defaultSourceDeclarationOwnershipLimits, createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";

function fixture(text, nativeAvailable = true) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `export {}; ${text}`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const storage = createSourceStorageQuery(source, source.sourceFiles);
  const nodes = source.navigation.nodes;
  const budget = createSourceDeclarationOwnershipBudget(nodes[0], defaultSourceDeclarationOwnershipLimits);
  const context = createSourceDeclarationOwnershipValues({ source, sourceNodes: nodes, nodes, budget, limits: {} });
  const query = createSourceDeclarationRetentionQuery({ source, values: context.values, budget,
    premises: { retentionFor({ value }) {
      if (!nativeAvailable) return undefined;
      return { kind: "resolved", premises: [{ kind: "retained", reason: "owned-value", value,
        contract: { kind: "expression", expression: value.node, component: value.component } }] };
    } } });
  const declaration = name => {
    const selected = storage.nodes.find(node => source.ast.is.IsFunctionDeclaration(node) &&
      source.ast.text(source.ast.name(node)) === name);
    if (selected !== undefined) return selected;
    const binding = storage.nodes.find(node => source.ast.is.IsVariableDeclaration(node) &&
      source.ast.text(source.ast.name(node)) === name);
    const initializer = binding === undefined ? undefined : source.ast.as.AsVariableDeclaration(binding)?.Initializer;
    assert.equal(initializer !== undefined, true, `${name}: checked callable initializer`);
    return initializer;
  };
  const references = name => {
    const selected = declaration(name);
    const owner = source.ast.is.IsFunctionExpression(selected) || source.ast.is.IsArrowFunction(selected)
      ? source.ast.parent(selected) : selected;
    return nodes.filter(node => source.ast.is.IsIdentifier(node) && node !== source.ast.name(owner) &&
      source.navigation.sourceReferenceFor(node)?.declaration === owner);
  };
  const select = name => {
    const reference = references(name)[0];
    return reference === undefined ? { kind: "unresolved", at: declaration(name),
      reason: "A native callable contract requires its actual checked read, never an empty declaration-use set.",
      cause: { kind: "required-fact" } } : query.forReference(reference);
  };
  return { source, storage, nodes, budget, context, query, declaration, references, select };
}

const deferred = `declare const pending: Promise<void>;
  async function later(ready: Promise<void>, callback: () => void): Promise<void> { await ready; callback(); }
  function forward(ready: Promise<void>, callback: () => void): Promise<void> { return later(ready, callback); }`;

export { fixture, deferred };
