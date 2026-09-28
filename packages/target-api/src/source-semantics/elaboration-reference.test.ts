import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, defineExtensionFactKey, type SourceElaborationNodeReference } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../public/source.js";
import { targetSourceSyntaxProgram } from "../public/analysis.js";

function fixture() {
  const extensionId = "test.target.elaboration-reference";
  const key = defineExtensionFactKey<readonly SourceElaborationNodeReference[]>({
    extensionId, name: "declarations", snapshot: value => Object.freeze(value.map(reference => Object.freeze({ ...reference }))),
  });
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: {
      "/src/left.ts": "export function identity<Value>(value: Value): Value { return value; }",
      "/src/right.ts": "export function identity<Value>(value: Value): Value { return value; }",
    },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    extensionHostOptions: { extensions: [{
      identity: { id: extensionId, version: "1.0.0" },
      initialize(context) {
        context.registerSourceElaborator(key, context => ["/src/left.ts", "/src/right.ts"].map(fileName => {
          const file = context.source.getSourceFile(fileName)!;
          const callable = context.source.ast.statements(file).find(node =>
            node !== undefined && context.source.ast.is.IsFunctionDeclaration(node));
          assert.ok(callable);
          const parameter = context.source.ast.typeParameters(callable)[0];
          assert.ok(parameter);
          return context.reference(parameter);
        }));
      },
      elaborateSource(context) { context.request(context.source.getSourceFile("/src/left.ts")!, key); },
    }] },
  }).checkSource();
  assert.deepEqual(checked.diagnostics, []);
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createTargetSourceProgram(checked);
  const references = source.sourceFacts.getFact(checked.getSourceFile("/src/left.ts"), key);
  assert.ok(references);
  return { checked, source, references };
}

test("target analysis resolves accepted source references without recreating source identities", () => {
  const { checked, source, references } = fixture();
  const nodes = references.map(reference => source.semantics.resolveElaborationReference(reference));
  assert.notEqual(nodes[0], nodes[1]);
  for (const [index, node] of nodes.entries()) {
    assert.equal(node, checked.resolveElaborationReference(references[index]!));
    assert.equal(source.ast.is.IsTypeParameterDeclaration(node), true);
    assert.ok(source.semantics.forNode(node).declarations.declaredType(node));
  }
  const syntax = targetSourceSyntaxProgram(source);
  assert.equal(Object.prototype.hasOwnProperty.call(syntax, "semantics"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(syntax, "resolveElaborationReference"), false);
});

test("target reference queries reject the same source identity from a different compiler session", () => {
  const current = fixture();
  const foreign = fixture();
  assert.throws(() => current.source.semantics.resolveElaborationReference(foreign.references[0]!),
    /different session or input revision/);
});
