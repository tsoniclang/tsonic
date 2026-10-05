import assert from "node:assert/strict";
import test from "node:test";
import { createSourceProgramNavigation, sourceBindingHasSingleCaptureOwner } from "../../packages/target-api/dist/public/source.js";
import { checkedSource, namedDeclaration, namedVariable, projectSourceFile, requiredNode } from "../fixtures/source-navigation.mjs";

const admitsClassifiedUse = use => use.role !== "value";

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
  for (const [name, expected] of [["unique", true], ["external", false], ["shared", false], ["repeated", false]]) {
    const declaration = namedDeclaration(ast, file, name);
    const closure = requiredNode(ast, declaration, node => ast.is.IsArrowFunction(node));
    assert.equal(sourceBindingHasSingleCaptureOwner(ast.parameters(declaration)[0], closure, [closure], ast, navigation,
      admitsClassifiedUse), expected, name);
  }
  const fresh = namedDeclaration(ast, file, "fresh");
  const closure = requiredNode(ast, fresh, node => ast.is.IsArrowFunction(node));
  assert.equal(sourceBindingHasSingleCaptureOwner(namedVariable(ast, fresh, "count"), closure, [closure], ast, navigation,
    admitsClassifiedUse), true);
  assert.equal(Reflect.apply(sourceBindingHasSingleCaptureOwner, undefined,
    [namedVariable(ast, fresh, "count"), closure, [closure], ast, navigation]), false,
    "the removed public form cannot assert native use admission");
  const nested = namedDeclaration(ast, file, "nested");
  const outer = requiredNode(ast, nested, node => ast.is.IsArrowFunction(node));
  const inner = ast.body(outer);
  assert.equal(sourceBindingHasSingleCaptureOwner(ast.parameters(nested)[0], inner, [inner], ast, navigation,
    admitsClassifiedUse), false);
  const moduleOwner = requiredNode(ast, namedDeclaration(ast, file, "moduleScope"), node => ast.is.IsArrowFunction(node));
  assert.equal(sourceBindingHasSingleCaptureOwner(namedVariable(ast, file, "global"), moduleOwner, [moduleOwner], ast, navigation,
    admitsClassifiedUse), false);
  const methods = namedDeclaration(ast, file, "methods");
  const object = requiredNode(ast, methods, node => ast.is.IsObjectLiteralExpression(node));
  assert.equal(sourceBindingHasSingleCaptureOwner(ast.parameters(methods)[0], object, ast.properties(object), ast, navigation,
    admitsClassifiedUse), true);
  assert.equal(sourceBindingHasSingleCaptureOwner(ast.parameters(methods)[0], object, [closure], ast, navigation,
    admitsClassifiedUse), false);
});
