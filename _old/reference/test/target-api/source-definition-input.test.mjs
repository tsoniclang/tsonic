import assert from "node:assert/strict";
import test from "node:test";
import { sourceDescriptorInputFixture } from "../host/fixtures/source-descriptor-input.mjs";
import { produceSourceDefinitionParameters } from "../../packages/target-api/dist/source-semantics/local-type-flow/definition-parameters.js";

for (const unavailable of ["missing", "foreign"]) test(`a ${unavailable} checked this-owner binding vector cannot be reconstructed from syntax`, () => {
  const raw = sourceDescriptorInputFixture({
    "/src/index.ts": `export function wrap<Outer>(first: Outer) {
      class Local<Inner> { first: Outer; value: Inner;
        constructor(first: Outer, value: Inner) { this.first = first; this.value = value; } }
      return new Local<string>(first, "value"); }`,
  });
  const { checked } = raw;
  assert.equal(checked.diagnostics.length, 0, "the original Source fixture checks without diagnostics");
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true);
  const pending = [file];
  let owner;
  while (pending.length !== 0 && owner === undefined) {
    const node = pending.pop();
    if (checked.ast.is.IsClassDeclaration(node)) owner = node;
    else for (const child of checked.ast.children(node)) if (child !== undefined) pending.push(child);
  }
  assert.equal(owner !== undefined, true, "the original class declaration is required");
  const original = raw.input.syntax(owner);
  const originalFacts = raw.input.describe(original);
  assert.equal(originalFacts.definitionParameters?.length, 2, "the genuine factual owner retains both original binders");
  const baseline = produceSourceDefinitionParameters({ ast: checked.ast, input: raw.input }, owner);
  assert.equal(baseline.kind === "resolved" && baseline.value === originalFacts.definitionParameters, true);
  const duplicate = originalFacts.definitionParameters[1];
  const input = { ...raw.input, describe(component) {
    return component === original ? { ...originalFacts, definitionParameters: unavailable === "missing" ? undefined
      : originalFacts.definitionParameters.map((declaration, index) => index === 0 ? duplicate : declaration) }
      : raw.input.describe(component);
  } };
  if (unavailable === "missing") {
    const result = produceSourceDefinitionParameters({ ast: checked.ast, input }, owner);
    assert.equal(result.kind === "refused" && result.source === "tsonic" && result.code === "TSONIC_LOCAL_TYPE_GENERIC" && result.site === owner, true,
      "missing original owner facts cannot manufacture a lexical capture vector");
  } else assert.throws(() => produceSourceDefinitionParameters({ ast: checked.ast, input }, owner),
    /An original definition binder inventory cannot repeat a declaration\./u,
    "a duplicate authentic local binder cannot replace the missing outer binder");
});
