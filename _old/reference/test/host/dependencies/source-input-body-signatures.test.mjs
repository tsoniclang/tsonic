import assert from "node:assert/strict";
import test from "node:test";
import { sourceDescriptorInputFixture } from "../fixtures/source-descriptor-input.mjs";

function fixture() {
  const current = sourceDescriptorInputFixture({ "/src/index.ts": `
    export function choose(value: string): string;
    export function choose(value: string, extra?: string) { return extra ?? value; }
    export class Calls { run(value: string): string; run(value: string, extra?: string) { return extra ?? value; } }
    export const ordinary = 1;
    choose("value");
  ` });
  const declarations = current.inventory.nodes.filter(node =>
    (current.ast.is.IsFunctionDeclaration(node) || current.ast.is.IsMethodDeclaration(node)) && current.ast.body(node) !== undefined);
  assert.equal(declarations.length, 2);
  return { ...current, declarations };
}

test("original implementation signatures preserve the genuine API lifetime rather than the advertised overload", () => {
  const current = fixture();
  for (const declaration of current.declarations) {
    const body = current.input.signatureForDeclaration(declaration);
    assert.equal(body.kind, "present");
    assert.equal(body.value.declaration === declaration, true);
    assert.equal(current.input.signatureForDeclaration(declaration).value === body.value, true);
    const file = current.ast.getSourceFile(declaration);
    const original = current.checked.getSourceFileQueries(file).checker.getSignatureFromDeclaration(declaration);
    assert.equal(current.identities.checkedSignature(body.value) === original, true,
      "the opaque body handle is the existing API-domain witness, not a new signature producer");
    const shape = current.input.describeSignature(body.value);
    const parameters = current.ast.parameters(declaration);
    assert.equal(shape.parameters.length, 2);
    assert.equal(shape.parameters.every((parameter, index) => parameter.declaration === parameters[index]), true);
    for (const parameter of shape.parameters) {
      const component = current.input.signatureComponent(body.value, declaration, { kind: "parameter", index: parameter.index });
      current.input.assertComponent(component);
      assert.equal(current.identities.checkedComponent(component) === undefined, true,
        "an unobserved original formal remains unavailable without any checker fill");
    }
    const head = current.input.describe(current.input.syntax(declaration));
    assert.equal(head.kind, "structure");
    assert.equal(head.calls.length, 1);
    assert.equal(head.calls[0].parameters.length, 1);
    assert.equal(head.calls[0].identity !== body.value, true,
      "the implementation and the advertised original overload remain different genuine signatures");
  }
});

test("original implementation signature queries authenticate nodes and handles before lookup", () => {
  const current = fixture();
  const foreign = fixture();
  const declaration = current.declarations[0];
  const selected = current.input.signatureForDeclaration(declaration);
  assert.equal(selected.kind, "present");
  assert.throws(() => current.input.signatureForDeclaration(foreign.declarations[0]), /exact original/);
  assert.throws(() => foreign.input.assertSignature(selected.value), /exact input view/);
  assert.throws(() => current.input.assertSignature({ ...selected.value }), /exact input view/);
});

test("noncallable original declarations have genuine absent signature receipts", () => {
  const current = fixture();
  const declaration = current.inventory.nodes.find(node => current.ast.is.IsVariableDeclaration(node) &&
    current.ast.text(current.ast.name(node)) === "ordinary");
  assert.equal(declaration !== undefined, true);
  assert.equal(current.input.signatureForDeclaration(declaration).kind, "none");
});
