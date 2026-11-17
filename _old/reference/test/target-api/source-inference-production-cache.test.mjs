import assert from "node:assert/strict";
import test from "node:test";
import { createSourceProductionCache } from "../../packages/target-api/dist/source-semantics/local-type-flow/production-cache.js";
import { sourceTypeFlowFixture } from "./fixtures/source-type-flow-fixture.mjs";

function fixture() {
  const current = sourceTypeFlowFixture("declare function identity<T>(value: T): T; const first: number = 1; const second: number = 2;");
  const declaration = current.nodes.find(node => current.source.ast.is.IsTypeParameterDeclaration(node));
  assert.equal(declaration !== undefined, true, "the complete original generic binder domain contains T");
  const { descriptors } = current.source.facts;
  assert.equal(descriptors.typeParameter(declaration).declaration === declaration, true);
  const authenticate = (node, bindings) => {
    current.source.documents.forNode(node);
    for (const binding of bindings) {
      descriptors.typeParameter(binding.declaration);
      descriptors.assertEvidence(binding.value);
    }
  };
  return { ...current, authenticate, binder: declaration, first: current.slot("first"), second: current.slot("second") };
}

test("Source production caches authenticate original keys and full environments before every hot lookup and seed", () => {
  const current = fixture(), foreign = fixture();
  let productions = 0;
  const cache = createSourceProductionCache({ authenticate: current.authenticate,
    dependency: () => current.first.component,
    produce: (_node, bindings) => { productions++; return { kind: "resolved", value: bindings[0].value }; } });
  const node = current.declaration("first"), bindings = [{ declaration: current.binder, value: current.first }];
  const selected = cache.query(node, bindings);
  assert.equal(selected.kind === "resolved" && selected.value === current.first, true);
  assert.equal(cache.query(node, bindings) === selected && productions === 1 && cache.revision() === 1, true);
  assert.throws(() => cache.query(foreign.declaration("first"), bindings));
  assert.throws(() => cache.query(node, [{ declaration: foreign.binder, value: current.first }]));
  assert.throws(() => cache.query(node, [{ declaration: current.binder, value: foreign.first }]));
  assert.throws(() => cache.query(node, [...bindings, ...bindings]), /one value per original binder/u);
  assert.throws(() => cache.seed(foreign.declaration("first"), bindings, selected));
  assert.throws(() => cache.seed(node, [{ declaration: current.binder, value: foreign.first }], { kind: "pending", dependencies: [] }));
  assert.equal(productions === 1 && cache.revision() === 1, true, "rejected foreign or duplicate inputs never enter production or cache state");
});

test("Source production caches retain exact completion/refusal objects but never pending or thrown failures", () => {
  const current = fixture(), node = current.declaration("first");
  const refusal = { kind: "refused", source: "tsonic", code: "TSONIC_LOCAL_TYPE_SIGNATURE", site: node, message: "exact original refusal" };
  const failure = new Error("exact uncaught owner failure");
  let attempts = 0;
  let recursive;
  const cache = createSourceProductionCache({ authenticate: current.authenticate,
    dependency: () => current.first.component,
    produce: (original, bindings) => {
      attempts++;
      if (attempts === 1) {
        recursive = cache.query(original, bindings);
        return recursive;
      }
      if (attempts === 2) throw failure;
      return refusal;
    } });
  const first = cache.query(node, []);
  assert.equal(first === recursive && first.kind === "pending" && first.dependencies.length === 1 &&
    first.dependencies[0] === current.first.component && cache.revision() === 0, true);
  assert.throws(() => cache.query(node, []), selected => selected === failure);
  assert.equal(cache.revision(), 0);
  assert.equal(cache.query(node, []) === refusal && cache.query(node, []) === refusal && attempts === 3, true);
  assert.equal(cache.revision(), 1);
});
