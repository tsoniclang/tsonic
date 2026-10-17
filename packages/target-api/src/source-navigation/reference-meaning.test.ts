import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../public/source.js";
import { referenceQueryNode, sourceReferenceMeaning } from "./syntax.js";

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

test("checked overload, merged and accessor definitions remain selectable but never become reverse uses", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `
export function exercise(): number {
  function pass(value: number): number;
  function pass(value: string): string;
  function pass(value: number | string): number | string { return value; }
  interface Token { readonly count: number; }
  const Token = 7;
  class Holder {
    private stored = 0;
    get value(): number { return this.stored; }
    set value(next: number) { this.stored = next; }
  }
  const holder = new Holder();
  const token: Token = { count: 1 };
  holder.value = pass(Token);
  const alias = pass;
  function recurse(count: number): number { return count === 0 ? pass(2) : recurse(count - 1); }
  { function pass(value: boolean): boolean { return value; } if (pass(true)) holder.value = token.count; }
  return holder.value + alias(3) + recurse(0);
}
`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const checker = checked.getSourceFileQueries(file).checker;
  const definitions = new Map<string, Node[]>();
  const uses = new Map<string, Node[]>();
  const visit = (node: Node): void => {
    if (source.ast.is.IsIdentifier(node) && ["pass", "Token", "value", "recurse"].includes(source.ast.text(node))) {
      const selected = source.navigation.sourceReferenceFor(node);
      assert.equal(selected !== undefined && selected.symbol !== undefined, true, "each actual checked definition and use keeps its source fact");
      const owner = source.ast.parent(node);
      const definition = owner !== undefined && source.ast.name(owner) === node &&
        checker.getSymbolDeclarations(selected!.symbol).includes(owner);
      const reverse = source.navigation.referencesWithin(selected!.symbol!, file);
      assert.equal(reverse.includes(referenceQueryNode(source.ast, node)!), !definition, definition
        ? "an exact native declaration name never becomes a runtime source use"
        : "an actual property, recursive, escape, shadow or ordinary use remains indexed");
      const entries = definition ? definitions : uses;
      const name = source.ast.text(node);
      entries.set(name, [...entries.get(name) ?? [], node]);
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.equal(definitions.get("pass")?.length, 4, "all overload definitions and the distinct shadow declaration retain by-reference facts");
  assert.equal(definitions.get("Token")?.length, 2, "both native type and value declarations retain their original facts");
  assert.equal(definitions.get("value")?.length, 2, "both accessor definitions are definitions of the same checked property");
  assert.equal(uses.get("pass")?.length, 4, "direct calls, the escaping value and the distinct shadow call remain real uses");
  assert.equal(uses.get("Token")?.length, 2, "both ordinary value and type uses remain indexed");
  assert.equal(uses.get("value")?.length, 3, "both property writes and the property read remain real uses");
  assert.equal(uses.get("recurse")?.length, 2, "self-recursion and the outer invocation remain separate original uses");
});

test("ordinary import and export linkage keep their original reverse uses across canonical declarations", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/library.ts": `export function read(value: number): number { return value; }`,
    "/src/public.ts": `export { read as forwarded } from "./library.js";`,
    "/src/index.ts": `
import { forwarded } from "./public.js";
import * as Library from "./library.js";
export { forwarded };
export const value = forwarded(1) + Library.read(2);
`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)));
  const source = createTargetSourceProgram(checked);
  const library = checked.getSourceFile("/src/library.ts");
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(library && file);
  const declaration = source.ast.statements(library).find(node => source.ast.is.IsFunctionDeclaration(node));
  assert.ok(declaration);
  const symbol = source.navigation.declarationSymbol(declaration, library);
  assert.ok(symbol);
  const references: Node[] = [];
  const visit = (node: Node): void => {
    if (source.ast.is.IsIdentifier(node) && ["forwarded", "read"].includes(source.ast.text(node))) references.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.equal(references.length, 4, "the ordinary import, export, direct call and member call all remain source linkage");
  for (const reference of references) {
    assert.equal(source.navigation.sourceReferenceFor(reference)?.declaration === declaration, true,
      "a linkage or member use keeps its actual imported original declaration");
    assert.equal(source.navigation.referencesWithin(symbol, file).includes(referenceQueryNode(source.ast, reference)!), true,
      "an import/export/property name is not mistaken for the imported symbol's own declaration name");
  }
  assert.equal(source.navigation.referencesWithin(symbol, library).includes(source.ast.name(declaration)!), false,
    "the actual remote function definition remains indexed only as a definition");
});
