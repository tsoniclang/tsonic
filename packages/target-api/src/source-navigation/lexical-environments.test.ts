import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { sourceLexicalEnvironment } from "./lexical-environments.js";
import { sourceLexicalFunctionValueOrder } from "./lexical-value-creation.js";
import { sourceBindingScope, sourceLexicalCaptures } from "./lexical-captures.js";

function fixture(body: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `export function outer() { ${body} }`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined)));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true);
  const declarations = new Map<string, Node>();
  const visit = (node: Node): void => {
    const name = source.ast.name(node);
    if (name !== undefined && (source.ast.is.IsFunctionDeclaration(node) || source.ast.is.IsVariableDeclaration(node))) {
      declarations.set(source.ast.text(name), node);
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file!);
  return { source, declarations, select(name: string) {
    const declaration = declarations.get(name)!;
    return sourceLexicalEnvironment(declaration, [declaration], source.ast, source.navigation, "source");
  } };
}

test("direct lexical calls retain transitive environments, not first-class callable handles", () => {
  const current = fixture(`let count = 0; function next() { return ++count; }
    function forward() { return next(); } return forward;`);
  const selected = current.select("forward");
  assert.equal(selected.kind, "resolved");
  if (selected.kind !== "resolved") return;
  assert.equal(selected.captures.length, 1);
  assert.equal(selected.captures[0]?.declaration === current.declarations.get("count"), true, "exact shared binding");
  assert.equal(selected.callableRoots.includes(current.declarations.get("next")!), true, "exact native callee root");
  assert.equal(sourceBindingScope(current.declarations.get("count")!, current.source.ast) ===
    sourceBindingScope(current.declarations.get("forward")!, current.source.ast), true,
  "approved C-1388: checked captures retain the original mutable binding and lexical scope");
  assert.equal(sourceLexicalFunctionValueOrder([...selected.callableRoots, selected.callableRoots[0]!],
    current.source.ast, current.source.navigation, "source").kind, "unresolved",
    "duplicate roots do not establish ownership");
  assert.equal(sourceLexicalFunctionValueOrder(Array.from({ length: 65_537 }, () => selected.callableRoots[0]!),
    current.source.ast, current.source.navigation, "source").kind, "unresolved",
    "oversized roots reject before graph construction");
});

test("parameter-property member names are not lexical parameter captures", () => {
  const current = fixture(`class Value {
    constructor(public value: number) {
      const read = () => this.value;
      const input = () => value;
      const indexed = () => this[key];
      const key = "value";
    }
  } return Value;`);
  const select = (name: string) => {
    const declaration = current.declarations.get(name)!;
    assert.equal(current.source.ast.is.IsVariableDeclaration(declaration), true);
    const expression = current.source.ast.as.AsVariableDeclaration(declaration)?.Initializer;
    assert.equal(expression !== undefined, true);
    return sourceLexicalEnvironment(expression!, [expression!], current.source.ast, current.source.navigation, "source");
  };
  const read = select("read");
  const input = select("input");
  const indexed = select("indexed");
  assert.equal(read.kind, "resolved");
  assert.equal(input.kind, "resolved");
  assert.equal(indexed.kind, "resolved");
  if (read.kind !== "resolved" || input.kind !== "resolved" || indexed.kind !== "resolved") return;
  assert.equal(read.captures.length, 0, "member selection does not capture the constructor's lexical parameter");
  assert.equal(read.receivers.length, 1, "the native receiver remains exact");
  assert.equal(input.captures.length, 1, "an authored lexical parameter reference remains captured");
  assert.equal(current.source.ast.is.IsParameterDeclaration(input.captures[0]!.declaration), true);
  assert.equal(indexed.captures.length, 1, "computed key expressions retain lexical captures");
  assert.equal(indexed.captures[0]!.declaration === current.declarations.get("key"), true);
});

test("first-class lexical captures retain callable identity without duplicating its environment", () => {
  const current = fixture(`let count = 0; function get() { return next; }
    function next() { return ++count; } return get;`);
  const selected = current.select("get");
  assert.equal(selected.kind, "resolved");
  if (selected.kind !== "resolved") return;
  assert.equal(selected.captures.length, 1);
  assert.equal(selected.captures[0]?.declaration === current.declarations.get("next"), true, "exact retained callable");
  assert.equal(selected.callableRoots.length, 1);
  const ordered = sourceLexicalFunctionValueOrder(
    [current.declarations.get("get")!, current.declarations.get("next")!], current.source.ast, current.source.navigation, "source");
  assert.equal(ordered.kind, "resolved");
  if (ordered.kind !== "resolved") return;
  assert.equal(ordered.declarations[0] === current.declarations.get("next"), true, "dependency initializes first");
});

test("recursive direct-call graphs are finite and lost callable evidence fails closed", () => {
  const current = fixture(`let count = 0; function left(depth: number): number {
    return depth === 0 ? count : right(depth - 1);
  } function right(depth: number): number { return left(depth); } return left;`);
  const selected = current.select("left");
  assert.equal(selected.kind, "resolved");
  if (selected.kind !== "resolved") return;
  assert.equal(selected.captures.length, 1);
  assert.equal(selected.callableRoots.length, 2);
  const invalid = sourceLexicalEnvironment(current.declarations.get("left")!, [current.declarations.get("left")!],
    current.source.ast, { ...current.source.navigation, declarationUseSummary(declaration) {
      return { ...current.source.navigation.declarationUseSummary(declaration), uses: [] };
    } }, "source");
  assert.equal(invalid.kind, "unresolved");
});

test("called declarations inside the current lexical function retain exact transitive mutation roots", () => {
  const current = fixture(`let count = 0; function read() {
    function inner() { return ++count; } return inner();
  } return read;`);
  const selected = current.select("read");
  assert.equal(selected.kind, "resolved");
  if (selected.kind !== "resolved") return;
  assert.equal(selected.captures.length, 1);
  assert.equal(selected.callableRoots.includes(current.declarations.get("inner")!), true, "exact called inner declaration");
});

test("single-owner evidence rejects disconnected direct-call cycles and independently retained callers", () => {
  const disconnected = fixture(`let count = 0; function owner() { return 1; }
    function left(depth: number): number { return depth === 0 ? count : right(depth - 1); }
    function right(depth: number): number { return left(depth); } return owner;`);
  const disconnectedOwner = disconnected.select("owner");
  assert.equal(disconnectedOwner.kind === "resolved" && disconnectedOwner.captures.length === 0 &&
    disconnectedOwner.callableRoots.length === 1 && disconnectedOwner.callableRoots[0] === disconnected.declarations.get("owner"), true,
  "approved C-1388: a disconnected graph never supplies the declaration's native capture authority");
  const independent = fixture(`let count = 0; function next() { return ++count; }
    function owner() { return () => next(); } return owner;`);
  const owner = independent.declarations.get("owner")!;
  const next = independent.declarations.get("next")!;
  const ownerCaptures = sourceLexicalCaptures(owner, [owner], independent.source.ast, independent.source.navigation, "source");
  const nextCaptures = sourceLexicalCaptures(next, [next], independent.source.ast, independent.source.navigation, "source");
  assert.equal(ownerCaptures.captures.some(capture => capture.declaration === next) &&
    nextCaptures.captures.some(capture => capture.declaration === independent.declarations.get("count")), true,
  "the nested callable and original mutable capture retain distinct checked owners");
});

test("single-owner admission requires exact target evidence without rewriting source-use classification", () => {
  const current = fixture(`let count = 0; function owner() { count = count + 1; return count; } return owner;`);
  const declaration = current.declarations.get("count")!;
  const owner = current.declarations.get("owner")!;
  const summary = current.source.navigation.declarationUseSummary(declaration);
  assert.equal(summary.hasUnclassifiedValueUse, true, "source arithmetic is not native ownership evidence");
  const selected = sourceLexicalCaptures(owner, [owner], current.source.ast, current.source.navigation, "source");
  assert.equal(selected.captures.length === 1 && selected.captures[0]?.declaration === declaration &&
    selected.captures[0].references.every(reference => summary.uses.some(use => use.reference === reference)), true,
  "approved C-1388: exact source references are capture facts, never target ownership admission");
  assert.equal("ownership" in selected || "singleOwner" in selected, false, "no native ownership is inferred from arithmetic");
  assert.throws(() => sourceLexicalCaptures(owner, [owner], current.source.ast, current.source.navigation, new Set()),
    /scope must belong/, "a missing checked scope never becomes native ownership evidence");
  for (const admission of [undefined, null, false, 1, () => false, () => 1])
    assert.throws(() => Reflect.apply(sourceLexicalCaptures, undefined,
      [owner, [owner], current.source.ast, current.source.navigation, admission]), /explicit source-node domain/,
    "missing, malformed or non-Boolean admission cannot substitute for a checked source domain");
  assert.equal(current.source.navigation.declarationUseSummary(declaration) === summary, true,
    "immutable source evidence remains canonical");
});

test("admitted arithmetic retains repeated activation and independent-owner rejection", () => {
  const repeated = fixture(`let count = 0; for (let index = 0; index < 2; index++) {
    const owner = () => { count = count + 1; return count; }; owner(); } return count;`);
  const variable = repeated.declarations.get("owner")!;
  assert.equal(repeated.source.ast.is.IsVariableDeclaration(variable), true);
  const owner = repeated.source.ast.as.AsVariableDeclaration(variable)?.Initializer;
  assert.equal(owner !== undefined, true, "exact repeated closure owner");
  const repeatedCaptures = sourceLexicalCaptures(owner!, [owner!], repeated.source.ast, repeated.source.navigation, "source");
  assert.equal(repeatedCaptures.captures.some(capture => capture.declaration === repeated.declarations.get("count")), true,
    "approved C-1388: the original repeated callable captures the same mutable binding, not a merged activation");
  const independent = fixture(`let count = 0; function owner() { count = count + 1; return count; }
    function second() { return count; } return [owner, second];`);
  const independentOwners = [independent.declarations.get("owner")!, independent.declarations.get("second")!];
  assert.equal(independentOwners[0] === independentOwners[1], false, "distinct original checked callable owners");
  for (const selectedOwner of independentOwners) {
    const selected = sourceLexicalCaptures(selectedOwner, [selectedOwner], independent.source.ast, independent.source.navigation, "source");
    assert.equal(selected.captures.some(capture => capture.declaration === independent.declarations.get("count")), true,
      "independent owners retain the SAME original mutable place without source-only native ownership");
  }
});
