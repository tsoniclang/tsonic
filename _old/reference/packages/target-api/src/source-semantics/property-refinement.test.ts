import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node, type ResolvedSourcePropertyAccessInfo } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";
import { selectRefinedSourcePropertyAccess } from "./property-refinement.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    interface Values { count: number; item: string; }
    interface Alternative { count: number; other: boolean; }
    declare function hasExtra(value: unknown): value is { count: number; extra: boolean; };
    declare function hasOne(value: unknown): value is { count: 1; extra: boolean; };
    function read(value: number | Values): number {
      if (typeof value === "number") return 0;
      if (hasExtra(value)) return value.count;
      return 0;
    }
    function ambiguous(value: number | Values | Alternative): number {
      if (typeof value === "number") return 0;
      if (hasExtra(value)) return value.count;
      return 0;
    }
    function additional(value: number | Values): boolean {
      if (typeof value === "number") return false;
      if (hasExtra(value)) return value.extra;
      return false;
    }
    function literal(value: number | Values): number {
      if (typeof value === "number") return 0;
      if (hasOne(value)) return value.count;
      return 0;
    }
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.deepEqual(checked.diagnostics, []);
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const queries = checked.getSourceFileQueries(file);
  const nodes = new Map<string, Node>();
  const visit = (node: Node, owner: string): void => {
    if (source.ast.is.IsFunctionDeclaration(node)) owner = source.ast.text(source.ast.name(node));
    if (source.ast.is.IsPropertyAccessExpression(node)) nodes.set(owner, node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child, owner); });
  };
  visit(file, "");
  const selection = (name: string) => {
    const node = nodes.get(name);
    assert.ok(node);
    const raw = queries.checker.getResolvedPropertyAccessInfo(node);
    assert.ok(raw);
    const refinement = source.semantics.selectValueTypeRefinement(raw.receiver.expression);
    return { node, raw, refinement, selected: source.semantics.forNode(node).operations.propertyAccess(node) };
  };
  return { source, queries, selection };
}

test("public property reads retain one checked refined declaration without replacing their original evidence", () => {
  const { queries, selection } = fixture();
  const { raw, selected } = selection("read");
  assert.equal(raw.selectedDeclaration, undefined);
  assert.ok(selected?.selectedDeclaration);
  assert.equal(selected.selectedReadDeclaration, selected.selectedDeclaration);
  assert.equal(selected.receiver, raw.receiver);
  assert.equal(selected.selectedSymbol, raw.selectedSymbol);
  assert.equal(selected.sourceReadType, raw.sourceReadType);
  assert.equal(selected.writable, raw.writable);
  const retained = queries.checker.getSymbolDeclarations(raw.selectedSymbol);
  assert.ok(retained.includes(selected.selectedDeclaration));
  assert.ok(Object.isFrozen(selected));
});

test("ambiguous, additional and incompatible refined properties retain the original checker selection", () => {
  const { selection } = fixture();
  for (const name of ["ambiguous", "additional", "literal"]) {
    const { raw, selected } = selection(name);
    assert.equal(selected, raw, name);
  }
});

test("refined property correspondence rejects stale types, missing declarations and wrong read types", () => {
  const { source, queries, selection } = fixture();
  const { raw, refinement } = selection("read");
  assert.ok(raw.accessMode === "read" && refinement.kind === "resolved" && refinement.refinement.kind === "members");
  const stale = { ...refinement, declaredType: refinement.selectedType };
  assert.equal(selectRefinedSourcePropertyAccess(raw, stale, queries.checker, queries.typeShape, source.sourceFacts, source.ast), raw);
  const missing = { ...queries.checker, getRootSymbols: () => [],
    getSymbolDeclarations: (symbol: Parameters<typeof queries.checker.getSymbolDeclarations>[0]) =>
      symbol === raw.selectedSymbol ? [] : queries.checker.getSymbolDeclarations(symbol) };
  assert.equal(selectRefinedSourcePropertyAccess(raw, refinement, missing, queries.typeShape, source.sourceFacts, source.ast), raw);
  const item = queries.checker.getPropertyOfType(refinement.refinement.types[0], "item");
  const itemType = queries.checker.getTypeOfSymbol(item);
  assert.ok(itemType);
  const wrong = { ...raw, sourceReadType: itemType };
  assert.equal(selectRefinedSourcePropertyAccess(wrong, refinement, queries.checker, queries.typeShape, source.sourceFacts, source.ast), wrong);
});

test("property writes and read-write operations never acquire a read-only refinement", () => {
  const { source, queries, selection } = fixture();
  const { raw, refinement } = selection("read");
  assert.ok(raw.accessMode === "read");
  const write: ResolvedSourcePropertyAccessInfo = { ...raw, accessMode: "write", sourceReadType: undefined, sourceWriteType: raw.sourceReadType };
  const readWrite: ResolvedSourcePropertyAccessInfo = { ...raw, accessMode: "read-write", sourceWriteType: raw.sourceReadType };
  assert.equal(selectRefinedSourcePropertyAccess(write, refinement, queries.checker, queries.typeShape, source.sourceFacts, source.ast), write);
  assert.equal(selectRefinedSourcePropertyAccess(readWrite, refinement, queries.checker, queries.typeShape, source.sourceFacts, source.ast), readWrite);
});

function readonlyFixture(body: string, expectedDiagnosticCodes: readonly string[] = []) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": body },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.filter(value => value !== undefined).map(value => String(value.code)).join(","),
    expectedDiagnosticCodes.join(","), "source diagnostic codes");
  assert.equal(checked.extensionDiagnostics.length, 0, "source extension diagnostic count");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file !== undefined, "checked source file exists");
  const queries = checked.getSourceFileQueries(file);
  const selections: { readonly owner: string; readonly raw: ResolvedSourcePropertyAccessInfo;
    readonly selected: ResolvedSourcePropertyAccessInfo }[] = [];
  const visit = (node: Node, owner: string): void => {
    if (source.ast.is.IsFunctionDeclaration(node)) owner = source.ast.text(source.ast.name(node));
    if (source.ast.is.IsPropertyAccessExpression(node) && owner !== "") {
      const raw = queries.checker.getResolvedPropertyAccessInfo(node);
      const selected = source.semantics.forNode(node).operations.propertyAccess(node);
      assert.ok(raw !== undefined && selected !== undefined, "property has raw and published checked evidence");
      selections.push({ owner, raw, selected });
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child, owner); });
  };
  visit(file, "");
  const selection = (owner: string) => {
    const matches = selections.filter(value => value.owner === owner);
    assert.equal(matches.length, 1, owner + " exact property count");
    return matches[0]!;
  };
  return { source, queries, selection };
}

test("readonly mapped class fields preserve exact inherited generic declarations and checked access evidence", () => {
  const { source, queries, selection } = readonlyFixture([
    "class Base<Payload> { field!: Payload; }",
    "class Value extends Base<string> {}",
    "function readonlyField(value: Readonly<Value>) { return value.field; }",
    "function plainField(value: Value) { return value.field; }",
  ].join("\n"));
  const { raw, selected } = selection("readonlyField");
  assert.equal(raw.selectedDeclaration === undefined, true, "raw mapped field has no primary declaration");
  assert.equal(selected.selectedDeclaration !== undefined, true, "published mapped field has a declaration");
  assert.equal(selected.selectedReadDeclaration === selected.selectedDeclaration, true, "read role matches the primary");
  assert.equal(queries.checker.getRootSymbols(raw.selectedSymbol).filter(value => value !== undefined)
    .some(symbol => queries.checker.getSymbolDeclarations(symbol).includes(selected.selectedDeclaration)),
    true, "chosen declaration belongs to the exact checked roots");
  assert.equal(selected.receiver === raw.receiver && selected.selectedSymbol === raw.selectedSymbol &&
    selected.sourceReadType === raw.sourceReadType && selected.sourceWriteType === raw.sourceWriteType &&
    selected.accessMode === raw.accessMode && selected.optionalChain === raw.optionalChain,
    true, "all original selection and instantiated type evidence is retained");
  assert.equal(selected.writable, false, "readonly view remains nonwritable");
  assert.equal(source.semantics.forNode(selected.expression).types.isStringLike(selected.sourceReadType!), true,
    "inherited generic field keeps its instantiated string type");
  assert.equal(Object.isFrozen(selected), true, "published selection is immutable");
  const plain = selection("plainField");
  assert.equal(plain.selected === plain.raw, true, "ordinary nonmapped field selection is unchanged");
});

test("checked accessor primary declarations follow their read, write and read-write roles", () => {
  const { source, selection } = readonlyFixture([
    "class Value { field = 1; get item(): number { return this.field; } set item(value: number) { this.field = value; } }",
    "function readonlyRead(value: Readonly<Value>) { return value.item; }",
    "function mutableWrite(value: Value) { value.item = 2; }",
    "function mutableReadWrite(value: Value) { value.item++; }",
  ].join("\n"));
  for (const name of ["readonlyRead", "mutableWrite", "mutableReadWrite"]) {
    const { raw, selected } = selection(name);
    const writes = selected.accessMode === "write";
    assert.equal(selected.selectedDeclaration !== undefined && (writes
      ? source.ast.is.IsSetAccessorDeclaration(selected.selectedDeclaration)
      : source.ast.is.IsGetAccessorDeclaration(selected.selectedDeclaration)),
    true, name + " exact primary accessor role");
    if (selected.accessMode !== "write") {
      assert.equal(selected.selectedReadDeclaration !== undefined &&
        source.ast.is.IsGetAccessorDeclaration(selected.selectedReadDeclaration), true, name + " getter evidence");
    }
    if (selected.accessMode !== "read") {
      assert.equal(selected.selectedWriteDeclaration !== undefined &&
        source.ast.is.IsSetAccessorDeclaration(selected.selectedWriteDeclaration), true, name + " setter evidence");
    }
    assert.equal(selected.receiver === raw.receiver && selected.selectedSymbol === raw.selectedSymbol &&
      selected.sourceReadType === raw.sourceReadType && selected.sourceWriteType === raw.sourceWriteType &&
      selected.writable === raw.writable, true, name + " checked types and permissions are unchanged");
  }
  assert.equal(selection("readonlyRead").selected.selectedWriteDeclaration === undefined, true,
    "readonly getter does not acquire the root setter");
});

test("canonical property publication preserves genuine ambiguity and mapped value transformations", () => {
  const { source, selection } = readonlyFixture([
    "interface Left { count: number; }",
    "interface Right { count: number; }",
    "interface Readable { get count(): number; }",
    "interface Writable { set count(value: number); }",
    "type Different<Value> = { readonly [Key in keyof Value]: boolean };",
    "function union(value: Left | Right) { return value.count; }",
    "function intersection(value: Left & Right) { return value.count; }",
    "function separateUnion(value: Readonly<Readable | Writable>) { return value.count; }",
    "function separateIntersection(value: Readonly<Readable & Writable>) { return value.count; }",
    "function changed(value: Different<Left>) { return value.count; }",
  ].join("\n"));
  for (const name of ["union", "intersection", "separateUnion", "separateIntersection"]) {
    const { raw, selected } = selection(name);
    assert.equal(selected.selectedDeclaration === undefined, true, name + " has no unique declaration");
    assert.equal(selected === raw, true, name + " ambiguity is not resolved by candidate order");
  }
  const { raw, selected } = selection("changed");
  assert.equal(selected.sourceReadType === raw.sourceReadType &&
    source.semantics.forNode(selected.expression).types.isBooleanLike(selected.sourceReadType!),
    true, "root provenance never replaces the mapped boolean value type");
  assert.equal(selected.writable, false, "mapped readonly state is retained");
});

test("readonly property writes remain checked source errors without writable escalation", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": [
    "class Value { field = 1; get item(): number { return this.field; } set item(value: number) { this.field = value; } }",
    "function invalid(value: Readonly<Value>) { value.field = 2; value.item = 3; }",
  ].join("\n") }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.filter(value => value !== undefined).map(value => String(value.code)).join(","),
    "2540,2540", "both readonly field and accessor writes retain TS2540");
  assert.equal(checked.extensionDiagnostics.length, 0, "no additional extension diagnostics");
});
