import assert from "node:assert/strict";
import test from "node:test";
import * as sourceNavigation from "../../packages/target-api/dist/public/source.js";
import { createSourceProgramNavigation, sourceBindingScope, sourceDeclarationIsModuleScoped,
  sourceLexicalCaptures } from "../../packages/target-api/dist/public/source.js";
import { checkedSource, namedDeclaration, namedVariable, projectSourceFile, requiredNode } from "../fixtures/source-navigation.mjs";

test("single capture ownership follows exact lexical activations and all uses", async () => {
  const source = await checkedSource("single-capture-owner", { "src/index.ts": `
    export function unique(seed: number) { return () => ++seed; }
    export function external(seed: number) { const read = () => ++seed; seed++; return read; }
    export function shared(seed: number) { const first = () => ++seed; return [first, () => ++seed]; }
    export function repeated(seed: number) { const result = []; for (let index = 0; index < 2; index++) result.push(() => ++seed); return result; }
    export function fresh() { const result = []; for (let index = 0; index < 2; index++) { let count = 0; result.push(() => ++count); } return result; }
    export function nested(seed: number) { return () => () => ++seed; }
    let global = 0;
    export function moduleScope() { return () => ++global; }
    export function methods(seed: number) { return { first<T>(value: T): T { seed++; return value; }, second<T>(value: T): T { seed++; return value; } }; }
  ` });
  const { ast } = source;
  const file = projectSourceFile(source, "src/index.ts");
  const navigation = createSourceProgramNavigation(source);
  const domain = new Set();
  const visit = node => {
    domain.add(node);
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  for (const [name, expected] of [["unique", true], ["external", false], ["shared", false], ["repeated", false]]) {
    const declaration = namedDeclaration(ast, file, name);
    const closure = requiredNode(ast, declaration, node => ast.is.IsArrowFunction(node));
    const parameter = ast.parameters(declaration)[0];
    const selected = sourceLexicalCaptures(closure, [closure], ast, navigation, domain);
    assert.equal(selected.captures.length === 1 && selected.captures[0].declaration === parameter &&
      selected.captures[0].references.every(reference => navigation.sourceReferenceFor(reference)?.declaration === parameter), true,
    `${name}: approved C-1388 original binding/capture, former physical-owner result ${expected}`);
    assert.equal(sourceBindingScope(parameter, ast) === ast.body(declaration), true, `${name}: exact lexical parameter scope`);
    assert.equal("ownership" in selected || "singleOwner" in selected, false, "source captures do not certify native exclusivity");
    if (name === "shared") {
      const closures = [];
      const collect = node => {
        if (ast.is.IsArrowFunction(node)) closures.push(node);
        ast.forEachChild(node, child => { if (child !== undefined) collect(child); });
      };
      collect(declaration);
      assert.equal(closures.length === 2 && closures[0] !== closures[1], true, "distinct original closure declarations");
      for (const selectedOwner of closures)
        assert.equal(sourceLexicalCaptures(selectedOwner, [selectedOwner], ast, navigation, domain)
          .captures.some(capture => capture.declaration === parameter), true, "both original owners share the SAME mutable binding");
    }
  }
  const fresh = namedDeclaration(ast, file, "fresh");
  const closure = requiredNode(ast, fresh, node => ast.is.IsArrowFunction(node));
  const count = namedVariable(ast, fresh, "count");
  assert.equal(sourceLexicalCaptures(closure, [closure], ast, navigation, domain)
    .captures.some(capture => capture.declaration === count), true, "the fresh loop body retains its original mutable place");
  assert.equal(sourceBindingScope(count, ast) !== ast.body(fresh), true, "the original inner loop binding stays distinct");
  assert.equal("sourceBindingHasSingleCaptureOwner" in sourceNavigation, false,
    "the removed public form cannot assert native use admission");
  assert.throws(() => Reflect.apply(sourceLexicalCaptures, undefined, [closure, [closure], ast, navigation]),
    /explicit source-node domain/, "missing checked membership never supplies capture authority");
  const nested = namedDeclaration(ast, file, "nested");
  const outer = requiredNode(ast, nested, node => ast.is.IsArrowFunction(node));
  const inner = ast.body(outer);
  const nestedParameter = ast.parameters(nested)[0];
  assert.equal(inner !== outer && sourceLexicalCaptures(inner, [inner], ast, navigation, domain)
    .captures.some(capture => capture.declaration === nestedParameter), true,
  "the original nested owner is distinct and captures the SAME outer binding");
  const moduleOwner = requiredNode(ast, namedDeclaration(ast, file, "moduleScope"), node => ast.is.IsArrowFunction(node));
  assert.equal(sourceDeclarationIsModuleScoped(namedVariable(ast, file, "global"), ast), true,
    "a module binding is not a local capture-owner proof");
  assert.equal(sourceLexicalCaptures(moduleOwner, [moduleOwner], ast, navigation, domain).captures.length, 0,
    "module storage never becomes a source-local exclusive environment");
  const methods = namedDeclaration(ast, file, "methods");
  const object = requiredNode(ast, methods, node => ast.is.IsObjectLiteralExpression(node));
  const methodCaptures = sourceLexicalCaptures(object, ast.properties(object), ast, navigation, domain);
  assert.equal(methodCaptures.captures.length === 1 && methodCaptures.captures[0].declaration === ast.parameters(methods)[0], true,
    "the exact method owners share the original mutable parameter, not an invented frame");
  assert.throws(() => sourceLexicalCaptures(object, [closure], ast, navigation, domain), /exact source scope/,
    "a foreign capture root cannot join the current checked owner");
});
