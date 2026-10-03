import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../public/source.js";

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
