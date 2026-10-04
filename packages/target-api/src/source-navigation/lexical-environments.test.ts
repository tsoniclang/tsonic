import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { sourceLexicalEnvironment } from "./lexical-environments.js";
import { sourceLexicalFunctionValueOrder } from "./lexical-value-creation.js";
import { sourceBindingHasSingleCaptureOwner } from "./capture-ownership.js";

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
    return sourceLexicalEnvironment(declaration, [declaration], source.ast, source.navigation);
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
  assert.equal(sourceBindingHasSingleCaptureOwner(current.declarations.get("count")!, current.declarations.get("forward")!,
    selected.callableRoots, current.source.ast, current.source.navigation), true, "one exact direct-call environment");
  assert.equal(sourceBindingHasSingleCaptureOwner(current.declarations.get("count")!, current.declarations.get("forward")!,
    [...selected.callableRoots, selected.callableRoots[0]!], current.source.ast, current.source.navigation), false,
    "duplicate roots do not establish ownership");
  assert.equal(sourceBindingHasSingleCaptureOwner(current.declarations.get("count")!, current.declarations.get("forward")!,
    Array.from({ length: 65_537 }, () => selected.callableRoots[0]!), current.source.ast, current.source.navigation), false,
    "oversized roots reject before graph construction");
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
    [current.declarations.get("get")!, current.declarations.get("next")!], current.source.ast, current.source.navigation);
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
    } });
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
  assert.equal(sourceBindingHasSingleCaptureOwner(disconnected.declarations.get("count")!,
    disconnected.declarations.get("owner")!,
    ["owner", "left", "right"].map(name => disconnected.declarations.get(name)!),
    disconnected.source.ast, disconnected.source.navigation), false, "disconnected graph is not one retained owner");
  const independent = fixture(`let count = 0; function next() { return ++count; }
    function owner() { return () => next(); } return owner;`);
  assert.equal(sourceBindingHasSingleCaptureOwner(independent.declarations.get("count")!,
    independent.declarations.get("owner")!,
    ["owner", "next"].map(name => independent.declarations.get(name)!),
    independent.source.ast, independent.source.navigation), false, "nested independent callable is not a direct owner edge");
});
