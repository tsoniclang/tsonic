import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { createSourceDeclarationSymbolQuery } from "./declaration-symbol.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `export {}; declare const external: { readonly token: {} };
      declare const other: { readonly value: number }; const alias = external; const selected = alias.token; const unrelated = other.value;`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "valid exact indexed declarations");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const declarations = new Map<string, Node>();
  const pending: Node[] = [file];
  while (pending.length !== 0) {
    const node = pending.pop()!;
    if (source.ast.is.IsVariableDeclaration(node)) declarations.set(source.ast.text(source.ast.name(node)), node);
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  const external = declarations.get("external");
  const other = declarations.get("other");
  assert.ok(external && other);
  const checker = checked.getSourceFileQueries(file).checker;
  const expected = checker.getSymbolAtLocation(source.ast.name(external));
  assert.ok(expected);
  return { source, checked, checker, external, other, expected, file };
}

test("materialized declaration symbols come from the existing exact checked reverse index", () => {
  const current = fixture();
  let reads = 0;
  const select = createSourceDeclarationSymbolQuery({ ...current.checked, getSourceFileQueries(file) {
    return { ...current.checked.getSourceFileQueries(file), checker: { ...current.checker,
      getSymbolAtLocation(node) { return node === current.source.ast.name(current.external) ? undefined : current.checker.getSymbolAtLocation(node); },
    } };
  } }, { ...current.source.navigation, referencesToDeclaration(node) {
    reads += 1;
    return current.source.navigation.referencesToDeclaration(node);
  } });
  for (let repeat = 0; repeat < 32; repeat += 1) assert.equal(select(current.external, current.file) === current.expected, true);
  assert.equal(reads, 1, "one exact selection, no repeated source scan");
  const type = current.checker.getTypeOfSymbol(select(current.external, current.file));
  assert.equal(type === current.checker.getTypeOfSymbol(current.expected), true, "same checked type identity");
  assert.equal(select(current.other, current.file) === current.checker.getSymbolAtLocation(current.source.ast.name(current.other)), true);
  assert.equal(reads, 1, "ordinary declarations need no reverse lookup");
});

test("missing or foreign indexed references never invent a declaration symbol", () => {
  const current = fixture();
  const references = current.source.navigation.referencesToDeclaration(current.other);
  assert.equal(references.length > 0, true);
  for (const nodes of [[], references]) {
    let reads = 0;
    const select = createSourceDeclarationSymbolQuery({ ...current.checked, getSourceFileQueries(file) {
      return { ...current.checked.getSourceFileQueries(file), checker: { ...current.checker, getSymbolAtLocation: () => undefined } };
    } }, { ...current.source.navigation, referencesToDeclaration: () => { reads += 1; return nodes; } });
    assert.equal(select(current.external, current.file) === undefined, true, "exact declaration identity required");
    assert.equal(select(current.external, current.file) === undefined, true, "completed absence remains stable");
    assert.equal(reads, 1);
  }
});

test("declaration symbols preserve the included consumer query context for excluded native owners", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": 'import { Native } from "./native.js"; export function read(value: Native): number { return value.field; }',
    "/src/native.ts": "export class Native { field: number = 7; }",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "the source checker admits the native declaration and its consumer");
  const consumer = checked.getSourceFile("/src/index.ts")!;
  const native = checked.getSourceFile("/src/native.ts")!;
  const declaration = checked.ast.statements(native).find(node => node !== undefined && checked.ast.is.IsClassDeclaration(node))!;
  const checker = checked.getSourceFileQueries(consumer).checker;
  const expected = checker.getSymbolAtLocation(checked.ast.name(declaration));
  assert.equal(expected !== undefined, true, "the included consumer's checker knows the exact native declaration");
  let reads = 0;
  const source = createTargetSourceProgram({ ...checked, sourceFiles: Object.freeze([consumer]),
    getSourceFileQueries(file) {
      assert.equal(file === consumer, true, "this declaration-type query retains its explicit checked consumer context");
      reads += 1;
      return checked.getSourceFileQueries(file);
    } });
  const semantics = source.semantics.forFile(consumer);
  const before = reads;
  assert.equal(source.navigation.declarationSymbol(declaration, consumer) === expected, true, "navigation uses the explicit checked consumer context");
  assert.equal(semantics.declarations.declaredValueType(declaration) === checker.getTypeOfSymbol(expected), true,
    "native value types retain exact checked identity rather than returning undefined");
  assert.equal(semantics.declarations.declaredType(declaration) === checker.getDeclaredTypeOfSymbol(expected), true,
    "native instance types retain exact checked identity");
  assert.equal(reads, before + 1, "one canonical declaration-symbol query is shared by both semantic consumers");
});

test("declaration symbols refuse another program's same-spelled AST and an unchecked consumer context", () => {
  const current = fixture();
  const foreign = fixture();
  assert.equal(current.checked.containsSourceFile(foreign.file), false, "the checked source owner distinguishes the two actual programs");
  assert.equal(current.source.ast.getFileName(current.file), current.source.ast.getFileName(foreign.file), "file spelling is deliberately identical");
  assert.equal(current.source.navigation.declarationSymbol(current.external, current.file) === current.expected, true,
    "the positive local symbol is retained before the negative requests");
  assert.equal(current.source.navigation.declarationSymbol(foreign.external, current.file) === undefined, true,
    "a declaration from another checked program cannot supply a symbol");
  assert.equal(current.source.semantics.forFile(current.file).declarations.declaredValueType(foreign.external) === undefined, true,
    "foreign declaration types cannot leak through the semantic consumer");
  assert.throws(() => current.source.navigation.declarationSymbol(current.external, foreign.file), /actual checked consumer context/u,
    "a populated cache never bypasses the checked consumer boundary");
});

test("declaration symbols admit exact checked owner contexts without publishing their files", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": 'import { Native } from "./native.js"; export function read(value: Native): number { return value.field; }',
    "/src/native.ts": "export declare class Native { field: number; }",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "the actual source program checks before filtering exposure");
  const consumer = checked.getSourceFile("/src/index.ts")!;
  const native = checked.getSourceFile("/src/native.ts")!;
  const declaration = checked.ast.statements(native).find(node => node !== undefined && checked.ast.is.IsClassDeclaration(node))!;
  const checker = checked.getSourceFileQueries(native).checker;
  const expected = checker.getSymbolAtLocation(checked.ast.name(declaration));
  assert.equal(expected !== undefined, true, "the actual native query context owns its checked declaration symbol");
  const source = createTargetSourceProgram({ ...checked, sourceFiles: Object.freeze([consumer]) });
  assert.equal(source.navigation.declarationSymbol(declaration, native) === expected, true,
    "a checked native owner is a legitimate semantic context, not a guessed consumer file");
  assert.equal(source.navigation.declarationSymbol(declaration, native) === expected, true,
    "the exact owner-context cache retains the same symbol identity");
  assert.equal(source.semantics.forNode(declaration).declarations.declaredType(declaration) === checker.getDeclaredTypeOfSymbol(expected), true,
    "the semantic view and navigation retain one exact checked type");
  assert.equal(source.semantics.includes(native), false, "semantic queries do not broaden exposed source membership");
  assert.equal(source.navigation.isProjectDeclaration(declaration), false, "a queried native declaration is not a project implementation");
  assert.equal(source.sourceFiles.includes(native), false, "semantic queries do not publish the native owner file");
  assert.throws(() => source.documents.forFile(native), /exact source file/u,
    "semantic queries do not create an authored source document");
});
