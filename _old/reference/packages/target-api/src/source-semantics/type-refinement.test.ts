import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node, type Type } from "@tsonic/tsts";
import { createTargetSourceProgram, sourceCallableValueParameters } from "../public/source.js";

function inspect(sourceText: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": sourceText },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"), "");
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const semantics = source.semantics.forFile(file);
  const results = [];
  const pending: Node[] = [file];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (source.ast.is.IsCallExpression(node)) {
      const call = semantics.operations.call(node);
      const argument = call?.sourceArguments[0];
      const declaration = argument === undefined ? undefined : source.navigation.referenceFor(argument.expression)?.declaration;
      const declared = declaration === undefined ? undefined : semantics.declarations.declaredValueType(declaration);
      if (declared !== undefined && argument?.type !== undefined) {
        results.push({ result: semantics.types.refinement(declared, argument.type), declared, selected: argument.type });
      }
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  return { results, semantics };
}

test("generic undefined exclusion retains the exact declared non-absent member", () => {
  const { results, semantics } = inspect(`
    declare function observe<T>(value: T): void;
    function read<T>(value: T | undefined): void { if (value !== undefined) observe(value); }
  `);
  assert.equal(results.length, 1);
  const entry = results[0]!;
  assert.equal(entry.result.kind, "members");
  if (entry.result.kind !== "members") return;
  const members = semantics.types.unionOrIntersectionTypes(entry.declared).filter(type => !semantics.types.isNullish(type));
  assert.deepEqual(entry.result.types, members);
  assert.ok(Object.isFrozen(entry.result.types));
});

test("numeric literals retain their declared primitive member, not a new carrier", () => {
  const { results, semantics } = inspect(`
    declare function observe(value: bigint): void;
    function read(value: bigint | undefined): void { if (value === 0n) observe(value); }
  `);
  assert.equal(results.length, 1);
  const entry = results[0]!;
  assert.equal(entry.result.kind, "members");
  if (entry.result.kind !== "members") return;
  assert.deepEqual(entry.result.types, semantics.types.unionOrIntersectionTypes(entry.declared).filter(type => !semantics.types.isNullish(type)));
});

test("literal refinements retain exact declared primitive members across union branches", () => {
  const { results, semantics } = inspect(`
    declare function observe<T>(value: T): void;
    function read(value: string | Error | undefined): void {
      if (value === "route" || value === "router") observe(value);
    }
    function flag(value: boolean | string): void { if (value === true) observe(value); }
    function text(value: string): void { if (value === "route") observe(value); }
    function numeric(value: number | undefined): void { if (value === 7) observe(value); }
  `);
  assert.equal(results.length, 4);
  for (const entry of results) {
    assert.equal(entry.result.kind === "members" || entry.result.kind === "exact", true);
    if (entry.result.kind === "members") {
      assert.equal(entry.result.types.length, 1);
      assert.equal(semantics.types.isStringLike(entry.result.types[0]!) ||
        semantics.types.isBooleanLike(entry.result.types[0]!) ||
        semantics.types.isNumberLike(entry.result.types[0]!), true);
      assert.equal(semantics.types.isNullish(entry.result.types[0]!), false);
    }
  }
  const text = results.find(entry => semantics.types.isStringLike(entry.declared));
  const numeric = results.find(entry => semantics.types.isNumberLike(entry.selected));
  assert.equal(text !== undefined && numeric !== undefined, true);
  assert.equal(semantics.types.refinement(text!.declared, numeric!.selected).kind, "unrelated");
  assert.equal(semantics.types.refinement(numeric!.declared, text!.selected).kind, "unrelated");
});

test("class receiver instantiations retain their checked declaration across union refinements", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/models.ts": `
      export class Entry { value = 1; read(): number { return this.value; } }
      export class Other { value = 1; read(): number { return this.value; } }
    `,
    "/src/index.ts": `
      import { Entry } from "./models.js";
      export function read(value: Entry | string): number {
        if (value instanceof Entry) return value.value;
        return 0;
      }
    `,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"), "");
  const source = createTargetSourceProgram(checked);
  const models = checked.getSourceFile("/src/models.ts");
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(models && file);
  const receivers: Type[] = [];
  const visit = (node: Node): void => {
    if (source.ast.is.IsPropertyAccessExpression(node)) {
      const selected = source.semantics.forNode(node).operations.propertyAccess(node);
      assert.ok(selected);
      receivers.push(selected.receiver.type);
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(models);
  assert.equal(receivers.length, 2);
  const declaration = source.ast.statements(file).find(source.ast.is.IsFunctionDeclaration);
  assert.ok(declaration);
  const parameter = source.ast.parameters(declaration)[0];
  assert.ok(parameter);
  const semantics = source.semantics.forFile(file);
  const declared = semantics.declarations.declaredValueType(parameter);
  assert.ok(declared);
  const selected = semantics.types.refinement(declared, receivers[0]!);
  assert.equal(selected.kind, "members");
  if (selected.kind !== "members") return;
  assert.equal(selected.types.length, 1);
  assert.equal(semantics.types.relationship(selected.types[0]!, receivers[0]!), "same-declaration");
  assert.equal(semantics.types.refinement(declared, receivers[1]!).kind, "unrelated",
    "the same source spelling and complete structural shape do not identify another class declaration");
});

test("an intersection with two possible source members remains ambiguous", () => {
  const { results, semantics } = inspect(`
    interface Left { left: string; }
    interface Right { right: string; }
    declare function observe(value: Left | Right): void;
    function inspect(value: Left | Right, selected: Left & Right): void { observe(value); observe(selected); }
  `);
  const union = results.find(entry => semantics.types.isUnion(entry.declared));
  const intersection = results.find(entry => semantics.types.isIntersection(entry.declared));
  assert.ok(union && intersection);
  assert.deepEqual(semantics.types.refinement(union.declared, intersection.declared), { kind: "ambiguous" });
  const unrelated = semantics.types.propertyInfos(intersection.declared)[0]?.type;
  assert.ok(unrelated);
  assert.deepEqual(semantics.types.refinement(union.declared, unrelated), { kind: "unrelated" });
});

test("cross-file instantiated members retain declared and selected types in the reading query domain", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/values.ts": `
      export class Item { constructor(public count: number) {} }
      export class Collection<T> { constructor(public values: T[]) {} }
      export class Result { constructor(public values: Item[]) {} }
    `,
    "/src/left.ts": `
      import { Collection, Item, Result } from "./values.js";
      export function read(collection: Collection<Item>, result: Result): number {
        return collection.values[0].count + result.values[0].count;
      }
    `,
    "/src/right.ts": `
      import { Collection, Item, Result } from "./values.js";
      export function read(collection: Collection<Item>, result: Result): number {
        return result.values[0].count + collection.values[0].count;
      }
    `,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
  assert.equal(formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"), "");
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createTargetSourceProgram(checked);
  for (const path of ["/src/left.ts", "/src/right.ts"]) {
    const file = checked.getSourceFile(path);
    assert.ok(file);
    const semantics = source.semantics.forFile(file);
    const accesses: Node[] = [];
    const visit = (node: Node): void => {
      if (source.ast.is.IsElementAccessExpression(node)) accesses.push(node);
      source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    visit(file);
    assert.equal(accesses.length, 2);
    for (const access of accesses) {
      const operation = semantics.operations.elementAccess(access);
      assert.ok(operation);
      const refinement = source.semantics.selectValueTypeRefinement(operation.receiver.expression);
      assert.equal(refinement.kind, "resolved");
      if (refinement.kind !== "resolved") continue;
      assert.equal(source.ast.getFileName(refinement.reference.sourceFile), "/src/values.ts");
      assert.equal(refinement.declaredType, semantics.declarations.declaredValueType(refinement.reference.declaration));
      assert.equal(refinement.selectedType, semantics.types.expressionType(operation.receiver.expression));
      let owner = source.ast.parent(refinement.reference.declaration);
      while (owner !== undefined && !source.ast.is.IsClassDeclaration(owner)) owner = source.ast.parent(owner);
      assert.ok(owner);
      const generic = source.ast.text(source.ast.name(owner)) === "Collection";
      assert.equal(semantics.types.isIdentical(refinement.declaredType, operation.receiver.type), !generic);
      assert.equal(refinement.refinement.kind, "exact");
      assert.ok(Object.isFrozen(refinement));
    }
  }
});

test("cross-file refinements preserve exact narrowing and reject unrelated checked-program nodes", () => {
  const files = {
    "/src/values.ts": `
      export class Item { constructor(public count: number) {} }
      export class Result { constructor(public values: Item[] | undefined) {} }
    `,
    "/src/index.ts": `
      import { Result } from "./values.js";
      export function read(result: Result): number {
        if (result.values === undefined) return 0;
        return result.values[0].count;
      }
    `,
  };
  const create = () => createCompilerSessionFromFiles({ currentDirectory: "/src", files,
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
  const checked = create();
  assert.equal(formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"), "");
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  let access: Node | undefined;
  const visit = (node: Node): void => {
    if (source.ast.is.IsElementAccessExpression(node)) access = node;
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.ok(access);
  const semantics = source.semantics.forFile(file);
  const operation = semantics.operations.elementAccess(access);
  assert.ok(operation);
  const refinement = source.semantics.selectValueTypeRefinement(operation.receiver.expression);
  assert.ok(refinement.kind === "resolved" && refinement.refinement.kind === "members");
  assert.equal(refinement.refinement.types.length, 1);
  assert.ok(semantics.types.isIdentical(refinement.refinement.types[0]!, operation.receiver.type));
  assert.equal(source.semantics.selectValueTypeRefinement(access).kind, "not-project-reference");
  const foreignFile = create().getSourceFile("/src/index.ts");
  assert.ok(foreignFile);
  assert.throws(() => source.semantics.forNode(foreignFile), /exact source file/u);
});

test("checked declaration semantics preserve hidden native formals without exposing bodies or foreign programs", () => {
  const create = () => createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/native.ts": "export declare function read(value: number): number;",
    "/src/index.ts": 'import { read } from "./native.js"; export const value = read(1);',
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
  const checked = create();
  assert.equal(formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"), "");
  assert.equal(checked.extensionDiagnostics.length, 0, "the native declaration is actually checked");
  const consumer = checked.getSourceFile("/src/index.ts")!;
  const native = checked.getSourceFile("/src/native.ts")!;
  const declaration = checked.ast.statements(native).find(node => node !== undefined && checked.ast.is.IsFunctionDeclaration(node))!;
  const source = createTargetSourceProgram({ ...checked, sourceFiles: Object.freeze([consumer]) });
  const semantics = source.semantics.forNode(declaration);
  assert.equal(semantics.sourceFile === native, true, "the semantic context is the original checked declaration's own file");
  assert.equal(source.semantics.forFile(native) === semantics, true, "file and node queries share the exact cached semantic owner");
  const signature = semantics.declarations.declarationSignature(declaration);
  assert.ok(signature);
  assert.equal(semantics.declarations.signatureDeclaration(signature) === declaration, true, "the raw checked signature retains declaration identity");
  const parameters = sourceCallableValueParameters(source.ast, declaration, semantics, { kind: "declaration" });
  assert.equal(parameters?.length, 1, "the canonical declaration query retains its complete input-only vector");
  assert.equal(parameters?.[0] === source.ast.parameters(declaration)[0], true, "the original authored parameter Node is retained");
  assert.equal(source.ast.body(declaration) === undefined, true, "a checked native signature never fabricates a source body");
  assert.equal(source.sourceFiles.length, 1, "semantic access never expands the exposed source vector");
  assert.equal(source.sourceFiles[0] === consumer, true, "the actual exposed file remains unchanged");
  assert.equal(source.navigation.sourceFiles.includes(native), false, "semantic access never expands navigation traversal");
  assert.equal(source.semantics.includes(native), false, "storage ownership keeps its original exposed membership boundary");
  assert.equal(source.documents.all.some(document => document.sourceFile === native), false, "semantic access creates no emitted source document");
  assert.throws(() => source.documents.forNode(declaration), /exact source file/u, "a hidden declaration remains outside authored documents");
  const foreign = create();
  const foreignNative = foreign.getSourceFile("/src/native.ts")!;
  const foreignDeclaration = foreign.ast.statements(foreignNative).find(node => node !== undefined && foreign.ast.is.IsFunctionDeclaration(node))!;
  assert.equal(source.ast.getFileName(foreignNative), source.ast.getFileName(native), "the foreign owner deliberately has the same file name");
  assert.throws(() => source.semantics.forFile(foreignNative), /exact source file/u, "file semantics reject a foreign same-URI owner");
  assert.throws(() => source.semantics.forNode(foreignDeclaration), /exact source file/u, "node semantics reject a foreign same-URI declaration");
  assert.equal(semantics.declarations.declarationSignature(foreignDeclaration) === undefined, true,
    "a valid local query context does not admit another program's raw signature");
});
