import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../public/source.js";
import { sourceReferenceMeaning } from "./syntax.js";

for (const valueFirst of [false, true]) {
  test(`merged source symbols retain type and value meaning with value-first=${valueFirst}`, () => {
    const values = `export const runtime = Token; export type Runtime = typeof Token;`;
    const types = `export type Stored = Token<number>; export interface Extended extends Token<number> {}`;
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
      "/src/index.ts": `
export interface Token<Value> { readonly value: Value; }
export const Token = 7;
${valueFirst ? values + types : types + values}
`,
    }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)));
    const source = createTargetSourceProgram(checked);
    const file = checked.getSourceFile("/src/index.ts");
    assert.ok(file);
    const references: Node[] = [];
    let valueNode: Node | undefined;
    const visit = (node: Node): void => {
      if (source.ast.is.IsIdentifier(node) && source.ast.text(node) === "Token") references.push(node);
      if (source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "Token") valueNode = node;
      source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    visit(file);
    const interfaceNode = source.ast.statements(file).find(node => source.ast.is.IsInterfaceDeclaration(node));
    assert.ok(interfaceNode && valueNode);
    for (const reference of valueFirst ? [...references].reverse() : references) {
      const selected = source.navigation.sourceReferenceFor(reference);
      const expected: Node = sourceReferenceMeaning(source.ast, reference) === "type" ? interfaceNode : valueNode;
      assert.ok(selected);
      assert.equal(selected.declaration, expected);
      assert.ok(Object.isFrozen(selected));
      assert.equal(source.navigation.sourceReferenceFor(reference), selected);
    }
    for (const declaration of [interfaceNode, valueNode]) {
      const uses = references.filter(reference => source.ast.name(declaration) !== reference &&
        source.navigation.sourceReferenceFor(reference)?.declaration === declaration);
      const indexed = source.navigation.referencesToDeclaration(declaration);
      assert.equal(uses.length, 2);
      assert.equal(indexed.length, uses.length);
      for (const reference of uses) assert.ok(indexed.includes(reference));
      assert.ok(!indexed.includes(source.ast.name(declaration)!));
    }
  });
}

test("imported re-exported and qualified source types retain their exact declaration facet", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/library.ts": `export interface Token<Value> { readonly value: Value; } export const Token = 7;`,
    "/src/public.ts": `export { Token } from "./library.js";`,
    "/src/index.ts": `
import { Token as Imported } from "./public.js";
import * as Library from "./public.js";
export const value = Imported;
export type Queried = typeof Imported;
export type Direct = Imported<number>;
export type Qualified = Library.Token<string>;
export const qualified = Library.Token;
`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const references: Node[] = [];
  const visit = (node: Node): void => {
    if (source.ast.is.IsTypeReferenceNode(node) || source.ast.is.IsTypeQueryNode(node) ||
      source.ast.is.IsPropertyAccessExpression(node)) references.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.equal(references.length, 4);
  for (const reference of references) {
    const selected = source.navigation.sourceReferenceFor(reference);
    assert.ok(selected);
    assert.equal(source.ast.getFileName(selected.sourceFile), "/src/library.ts");
    assert.equal(source.ast.kindName(selected.declaration), source.ast.is.IsTypeReferenceNode(reference)
      ? "KindInterfaceDeclaration" : "KindVariableDeclaration");
  }
});

test("merged class and namespace declarations retain independent qualified type and runtime references", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `
export class Container {}
export namespace Container { export interface Item { readonly value: number; } }
export type Selected = Container.Item;
export const constructor = Container;
`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const references: Node[] = [];
  const visit = (node: Node): void => {
    if (source.ast.is.IsIdentifier(node) && source.ast.text(node) === "Container") references.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.equal(references.length, 4);
  for (const reference of references) {
    const selected = source.navigation.sourceReferenceFor(reference);
    assert.ok(selected);
    assert.equal(source.ast.kindName(selected.declaration), sourceReferenceMeaning(source.ast, reference) === "namespace"
      ? "KindModuleDeclaration" : "KindClassDeclaration");
  }
});
