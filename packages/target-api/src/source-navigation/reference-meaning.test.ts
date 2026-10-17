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

for (const valueFirst of [false, true]) {
  test(`qualified heritage preserves namespace, type and native value facets with value-first=${valueFirst}`, () => {
    const runtime = "export const runtime = Library.Token; export const constructor = Library.Native;";
    const heritage = `
export class Implemented implements Library.Token<number> { value = 2; }
export interface Extended extends Library.Token<number> {}
export class Derived extends Library.Native {}
export class Deep implements Library.Nested.Shape { value = 3; }
`;
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
      "/src/index.ts": `
export namespace Library {
  export interface Token<Value> { value: Value; }
  export const Token = 7;
  export class Native { value = 1; }
  export namespace Nested { export interface Shape { value: number; } }
}
${valueFirst ? runtime + heritage : heritage + runtime}
export function shadow(): number { const Library = { Token: 41 }; return Library.Token; }
`,
    }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)));
    const source = createTargetSourceProgram(checked);
    const file = checked.getSourceFile("/src/index.ts");
    assert.equal(file !== undefined, true, "the checked consumer belongs to the exact program");
    const nodes: Node[] = [];
    const visit = (node: Node): void => {
      nodes.push(node);
      source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    visit(file!);
    const declaration = (kind: string, name: string): Node => {
      const matches = nodes.filter(node => source.ast.kindName(node) === kind &&
        source.ast.text(source.ast.name(node)) === name);
      assert.equal(matches.length, 1, `one exact ${kind} declaration for ${name}`);
      return matches[0]!;
    };
    const tokenType = declaration("KindInterfaceDeclaration", "Token");
    const tokenValue = declaration("KindVariableDeclaration", "Token");
    const nativeClass = declaration("KindClassDeclaration", "Native");
    const deepType = declaration("KindInterfaceDeclaration", "Shape");
    const localProperty = declaration("KindPropertyAssignment", "Token");
    const library = declaration("KindModuleDeclaration", "Library");
    const nested = declaration("KindModuleDeclaration", "Nested");
    const accesses = nodes.filter(node => source.ast.is.IsPropertyAccessExpression(node));
    assert.equal(accesses.length, 8, "all type, nested qualifier, native extends and shadowed value accesses are checked");
    for (const access of accesses) {
      const name = source.ast.text(source.ast.name(access));
      const meaning = sourceReferenceMeaning(source.ast, access);
      const expected = name === "Token" ? meaning === "type" ? tokenType
        : source.ast.parent(access) !== undefined && source.ast.is.IsReturnStatement(source.ast.parent(access))
          ? localProperty : tokenValue
        : name === "Native" ? nativeClass
          : name === "Shape" ? deepType : nested;
      const selected = source.navigation.sourceReferenceFor(access);
      assert.equal(selected?.declaration === expected, true, `${name} preserves its actual ${meaning} declaration facet`);
      assert.equal(Object.isFrozen(selected), true, "the completed selected reference is immutable");
      assert.equal(source.navigation.sourceReferenceFor(access) === selected, true, "the query is one sealed lookup");
      assert.equal(source.navigation.referencesToDeclaration(expected).includes(access), true,
        "the same authored occurrence is present in the canonical reverse index");
    }
    for (const node of nodes.filter(node => source.ast.is.IsIdentifier(node) && source.ast.text(node) === "Library")) {
      const parent = source.ast.parent(node);
      if (parent === undefined || !source.ast.is.IsPropertyAccessExpression(parent) ||
        sourceReferenceMeaning(source.ast, parent) === "value") continue;
      assert.equal(sourceReferenceMeaning(source.ast, node), "namespace", "a type qualifier selects its namespace facet");
      assert.equal(source.navigation.sourceReferenceFor(node)?.declaration === library, true, "the namespace declaration is exact");
    }
    const summary = source.navigation.declarationUseSummary(tokenType);
    assert.equal(summary.uses.length, 2, "both qualified implements and interface-extends uses are nonvacuous");
    assert.equal(summary.uses.every(use => use.kind === "type-only"), true, "heritage type uses do not demand a value");
  });
}

test("qualified imported heritage keeps re-export, shadow and foreign identities exact", () => {
  const files = {
    "/src/first.ts": "export interface Shape { value: number; } export class Native { value = 1; }",
    "/src/second.ts": "export interface Shape { value: number; }",
    "/src/public.ts": 'export { Shape, Native } from "./first.js";',
    "/src/index.ts": `
import * as First from "./public.js";
import * as Second from "./second.js";
import { Shape as Named } from "./public.js";
export class Left implements First.Shape { value = 1; }
export class Right implements Second.Shape { value = 2; }
export class Direct implements Named { value = 3; }
export class Derived extends First.Native {}
export const constructor = First.Native;
`,
  };
  const create = () => createCompilerSessionFromFiles({ currentDirectory: "/src", files,
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
  const checked = create();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts")!;
  const references: Node[] = [];
  const visit = (node: Node): void => {
    if (source.ast.is.IsExpressionWithTypeArguments(node) || source.ast.is.IsPropertyAccessExpression(node)) references.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.equal(references.length, 8, "every named and qualified heritage and runtime constructor occurrence is exercised");
  for (const reference of references) {
    const selected = source.navigation.sourceReferenceFor(reference);
    const expression = source.ast.is.IsExpressionWithTypeArguments(reference)
      ? source.ast.as.AsExpressionWithTypeArguments(reference)?.Expression : reference;
    const property = expression === undefined ? undefined : source.ast.as.AsPropertyAccessExpression(expression);
    const native = property !== undefined && source.ast.text(source.ast.name(expression)) === "Native";
    assert.equal(selected !== undefined, true, "all supported checked references have one exact declaration");
    assert.equal(source.ast.getFileName(selected?.sourceFile), source.ast.text(property?.Expression) === "Second" ? "/src/second.ts" : "/src/first.ts",
      "same-spelled declarations and barrel exports retain actual module identity");
    assert.equal(source.ast.kindName(selected?.declaration), native ? "KindClassDeclaration" : "KindInterfaceDeclaration",
      "runtime class and source type facets never substitute for one another");
    assert.equal(Object.isFrozen(selected), true, "imported reference facts are immutable");
  }
  const foreign = create();
  const foreignFile = foreign.getSourceFile("/src/index.ts")!;
  const pending: Node[] = [foreignFile];
  let foreignAccess: Node | undefined;
  while (pending.length > 0 && foreignAccess === undefined) {
    const node = pending.pop()!;
    if (foreign.ast.is.IsPropertyAccessExpression(node)) foreignAccess = node;
    foreign.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  assert.equal(foreignAccess !== undefined, true, "the second checked program has the same actual source syntax");
  assert.equal(source.navigation.sourceReferenceFor(foreignAccess) === undefined, true, "foreign AST identity never enters the sealed index");
});
