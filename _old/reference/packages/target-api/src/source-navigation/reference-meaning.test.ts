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

test("shorthand values retain exact parameter, shadowed local and outer binding identities", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `
export const extra = 1;
export function parameter(extra: number) { return { extra }; }
export function local() { const extra = 2; return { extra }; }
export const outer = { extra };
export const ordinary = { extra: 3 };
export const selected = ordinary.extra;
`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "the original shorthand bindings check successfully");
  const source = createTargetSourceProgram(checked);
  const nodes = source.navigation.nodes;
  const parameter = nodes.find(node => source.ast.is.IsParameterDeclaration(node) && source.ast.text(source.ast.name(node)) === "extra");
  const variables = nodes.filter(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "extra");
  const shorthands = nodes.filter(node => source.ast.is.IsShorthandPropertyAssignment(node));
  assert.equal(parameter !== undefined && variables.length === 2 && shorthands.length === 3, true,
    "all three distinct lexical bindings and shorthand reads are present");
  const expected = [parameter, variables[1], variables[0]];
  for (const [index, shorthand] of shorthands.entries()) {
    const name = source.ast.name(shorthand);
    assert.equal(name !== undefined, true, `shorthand ${index}: the exact own name exists`);
    if (name === undefined) throw new Error("Expected the shorthand's own name.");
    const reference = source.navigation.sourceReferenceFor(name);
    assert.equal(reference !== undefined && reference.declaration === expected[index], true,
      `shorthand ${index}: the selected value is its lexical declaration, not the property`);
    assert.equal(Object.isFrozen(reference), true, `shorthand ${index}: the selected reference is immutable`);
    assert.equal(source.navigation.sourceReferenceFor(name) === reference, true,
      `shorthand ${index}: repeated reads retain the canonical reference`);
    assert.equal(source.navigation.referencesToDeclaration(expected[index]!).includes(name), true,
      `shorthand ${index}: the reverse index belongs to the same value binding`);
  }
  const property = nodes.find(node => source.ast.is.IsPropertyAssignment(node));
  const access = nodes.find(node => source.ast.is.IsPropertyAccessExpression(node));
  assert.equal(property !== undefined && access !== undefined, true, "ordinary property and access controls exist");
  if (property === undefined || access === undefined) throw new Error("Expected the ordinary property controls.");
  assert.equal(source.navigation.sourceReferenceFor(source.ast.name(property)!)?.declaration === property, true,
    "a nonshorthand property name retains its own declaration role");
  assert.equal(source.navigation.sourceReferenceFor(access)?.declaration === property, true,
    "a member read retains its selected property, not a same-spelled lexical value");
});

test("shorthand imported aliases retain their checked value facet across re-exports", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/library.ts": "export interface Token { readonly value: number; } export const Token = 7;",
    "/src/public.ts": 'export { Token as PublicToken } from "./library.js";',
    "/src/index.ts": `
import { PublicToken as Imported } from "./public.js";
export type Stored = Imported;
export const value = { Imported };
export const ordinary = Imported;
`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "the merged re-exported shorthand alias checks successfully");
  const source = createTargetSourceProgram(checked);
  const nodes = source.navigation.nodes;
  const value = nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "Token");
  const type = nodes.find(node => source.ast.is.IsInterfaceDeclaration(node) && source.ast.text(source.ast.name(node)) === "Token");
  const shorthand = nodes.find(node => source.ast.is.IsShorthandPropertyAssignment(node));
  const typeUse = nodes.find(node => source.ast.is.IsTypeReferenceNode(node));
  const ordinary = nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "ordinary");
  const ordinaryRead = nodes.find(node => source.ast.is.IsIdentifier(node) && source.ast.parent(node) === ordinary &&
    source.ast.text(node) === "Imported");
  assert.equal(value !== undefined && type !== undefined && shorthand !== undefined && typeUse !== undefined && ordinaryRead !== undefined,
    true, "the original distinct library facets and all consumer forms are present");
  if (shorthand === undefined || typeUse === undefined || ordinaryRead === undefined) throw new Error("Expected imported reference controls.");
  const name = source.ast.name(shorthand)!;
  const selected = source.navigation.sourceReferenceFor(name);
  assert.equal(selected !== undefined && selected.declaration === value, true,
    "the lexical alias follows checked re-exports to the exact value declaration");
  assert.equal(source.navigation.sourceReferenceFor(typeUse)?.declaration === type, true,
    "the same imported alias still has an independent type declaration facet");
  assert.equal(source.navigation.sourceReferenceFor(ordinaryRead)?.declaration === value, true,
    "ordinary nonshorthand values retain their existing alias selection");
  assert.equal(source.navigation.referencesToDeclaration(value!).includes(name), true,
    "the shorthand occurrence is indexed against the actual imported value");
});

test("an unavailable shorthand value never falls back to its property declaration", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": "export const value = { missing };",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length > 0, true, "the original missing lexical value remains a checked error");
  const source = createTargetSourceProgram(checked);
  const shorthand = source.navigation.nodes.find(node => source.ast.is.IsShorthandPropertyAssignment(node));
  assert.equal(shorthand !== undefined, true, "the checked unresolved shorthand still has a property declaration");
  if (shorthand === undefined) throw new Error("Expected the original unresolved shorthand.");
  const name = source.ast.name(shorthand)!;
  assert.equal(source.navigation.sourceReferenceFor(name) === undefined, true,
    "missing checked lexical evidence stays unresolved instead of selecting the shorthand property");
  assert.equal(source.navigation.referenceFor(name) === undefined, true,
    "the ordinary reference projection does not invent a property-based value binding");
});

test("iteration collections are exact receiver uses while their assigned binding remains a write", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", compilerOptions: {
    strict: true, target: "es2022", module: "esnext",
  }, files: { "/src/index.ts": `export {}; const rows = [1, 2]; let value = 0; for (value of rows) {}` } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "the ordinary iteration source is accepted");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true, "the original checked source file exists");
  if (file === undefined) throw new Error("Expected the checked iteration file.");
  const declarations = new Map<string, Node>();
  const visit = (node: Node): void => {
    const name = source.ast.name(node);
    if (source.ast.is.IsVariableDeclaration(node) && name !== undefined && source.ast.is.IsIdentifier(name))
      declarations.set(source.ast.text(name), node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  for (const [name, role] of [["rows", "receiver"], ["value", "write"]] as const) {
    const declaration = declarations.get(name);
    assert.equal(declaration !== undefined, true, `${name}: exact authored declaration`);
    if (declaration === undefined) throw new Error("Expected the authored iteration declaration.");
    const summary = source.navigation.declarationUseSummary(declaration);
    assert.equal(summary.uses.length === 1 && summary.uses[0]?.role === role, true,
      `${name}: iteration value consumption and binding write have distinct checked roles`);
    assert.equal(summary.hasUnclassifiedValueUse, false, `${name}: no invented unknown escape`);
  }
});

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
    const property = expression === undefined || !source.ast.is.IsPropertyAccessExpression(expression)
      ? undefined : source.ast.as.AsPropertyAccessExpression(expression);
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
      if (name !== "value" || checker.getSymbolDeclarations(selected!.symbol).some(declaration =>
        source.ast.is.IsGetAccessorDeclaration(declaration) || source.ast.is.IsSetAccessorDeclaration(declaration)))
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

for (const [label, parameterType, body, role, escapes] of [
  ["returned array spread", "uint8[]", "return [...values];", "receiver", false],
  ["local array spread", "uint8[]", "const copied = [...values]; return copied;", "receiver", false],
  ["returned object spread", "{ readonly item: number }", "return { ...values };", "receiver", false],
  ["returned container identity", "uint8[]", "return values;", "return", true],
  ["stored container identity", "uint8[]", "return [values];", "storage", true],
  ["call spread", "uint8[]", "forward(...values);", "receiver", false],
  ["construction spread", "uint8[]", "new Container(...values);", "receiver", false],
  ["wrapped array spread", "uint8[]", "return [...(values as uint8[])];", "receiver", false],
] as const) {
  test(`spread operand container identity: ${label}`, () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
      "/src/index.ts": `
type uint8 = number;
declare function forward(...items: uint8[]): void;
declare class Container { constructor(...items: uint8[]); }
export function inspect(values: ${parameterType}) { ${body} }
`,
    }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0,
      formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)));
    const source = createTargetSourceProgram(checked);
    const file = checked.getSourceFile("/src/index.ts");
    assert.ok(file !== undefined, label);
    const declaration = source.ast.statements(file).find(node => source.ast.is.IsFunctionDeclaration(node) &&
      source.ast.text(source.ast.name(node)) === "inspect");
    assert.ok(declaration !== undefined, label);
    const parameter = source.ast.parameters(declaration)[0];
    assert.ok(parameter !== undefined, label);
    const summary = source.navigation.parameterUseSummary(parameter);
    assert.ok(summary !== undefined, label);
    assert.equal(summary.uses.length, 1, label);
    const use = summary.uses[0]!;
    assert.equal(use.role, role, label);
    assert.equal(summary.hasUnclassifiedValueUse, false, `${label}: the exact consuming role is not unknown exposure`);
    assert.equal(use.throughMember, false, label);
    assert.equal(use.captured, false, label);
    const flow = source.navigation.expressionValueFlow(use.reference);
    assert.equal(flow.escapes, escapes, label);
    assert.equal(flow.storedOutsideBinding, role === "storage", label);
  });
}
