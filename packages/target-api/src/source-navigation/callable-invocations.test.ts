import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { createSourceSingleInvocationQuery, sourceEnclosingCallable, sourceLexicalFunctionIsUnused,
  sourceNodesOutsideErasedSubtrees } from "./callable-invocations.js";

function fixture(body: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `export function outer(): number { ${body} }`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined)));
  const source = createTargetSourceProgram(checked);
  const declarations = new Map<string, Node>();
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true);
  const visit = (node: Node): void => {
    if (source.ast.is.IsFunctionDeclaration(node)) declarations.set(source.ast.text(source.ast.name(node)), node);
    if (source.ast.is.IsArrowFunction(node)) {
      const binding = source.ast.parent(node);
      if (binding !== undefined && source.ast.is.IsVariableDeclaration(binding) && source.ast.is.IsIdentifier(source.ast.name(binding)))
        declarations.set(source.ast.text(source.ast.name(binding)), node);
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file!);
  const query = createSourceSingleInvocationQuery(source.ast, source.navigation);
  return { source, declaration(name: string) {
    const declaration = declarations.get(name);
    assert.equal(declaration !== undefined, true);
    return declaration!;
  }, unused(name: string) {
    const declaration = declarations.get(name);
    assert.equal(declaration !== undefined, true);
    return sourceLexicalFunctionIsUnused(declaration!, source.ast, source.navigation);
  }, select(name: string) {
    const declaration = declarations.get(name);
    assert.equal(declaration !== undefined, true);
    return query(declaration!);
  } };
}

test("single lexical invocation proof retains hoisting and exact transitive callers", () => {
  const current = fixture(`const value = through();
function read(): number { return 3; }
function through(): number { return read(); }
return value;`);
  assert.equal(current.select("read"), true);
  assert.equal(current.select("through"), true);
  assert.equal(current.select("outer"), false);
  assert.equal(current.select("read"), true);
});

test("a checked const-bound arrow shares the single-invocation owner with lexical declarations", () => {
  for (const body of [
    "const finish = () => 3; return finish();",
    "const finish = () => 3; const relay = () => finish(); return relay();",
    "function finish(): number { return 3; } const relay = () => finish(); return relay();",
    "const finish = () => 3; function relay(): number { return finish(); } return relay();",
  ]) {
    const current = fixture(body);
    assert.equal(current.select("finish"), true, "the original binding and its one checked direct execution are retained");
    assert.equal(current.select("finish"), true, "the completed owner selection remains stable");
  }
});

test("bound-arrow invocation proof retains alias, repetition, escape, recursion and deferred negatives", () => {
  for (const body of [
    "const finish = () => 3; return finish() + finish();",
    "const finish = () => 3; const alias = finish; return alias();",
    "const finish = () => 3; const values = [finish]; return values[0]!();",
    "const finish = () => 3; let result = 0; while (result < 3) result += finish(); return result;",
    "const finish = (): number => finish(); return finish();",
    "const finish = (): number => relay(); const relay = (): number => finish(); return relay();",
    "const finish = () => 3; const relay = () => finish(); return relay() + relay();",
    "const finish = () => 3; const relay = () => finish(); const alias = relay; return alias();",
    "let finish = () => 3; finish = () => 4; return finish();",
  ]) {
    assert.equal(fixture(body).select("finish"), false, body);
  }
});

test("bound-arrow invocation proof rejects foreign, missing and unresolved checked correspondence", () => {
  const current = fixture("const finish = () => 3; return finish();");
  const declaration = current.declaration("finish");
  const binding = current.source.ast.parent(declaration)!;
  const summary = current.source.navigation.declarationUseSummary(binding);
  for (const mutation of [{ exported: true }, { bindingWritten: true }, { hasUnclassifiedValueUse: true },
    { uses: summary.uses.map(use => ({ ...use, throughMember: true })) },
  ]) {
    const navigation = { ...current.source.navigation, declarationUseSummary: () => ({ ...summary, ...mutation }) };
    assert.equal(createSourceSingleInvocationQuery(current.source.ast, navigation)(declaration), false,
      "an unavailable or escaping original binding never proves one native execution");
  }
  for (const navigation of [
    { ...current.source.navigation, sourceReferenceFor: () => undefined },
    { ...current.source.navigation, declarationSymbol: () => undefined },
    { ...current.source.navigation, callableImplementation: () => ({ kind: "unresolved" as const, reason: "missing" }) },
    { ...current.source.navigation, sourceReferenceFor: (reference: Node) => {
      const selected = current.source.navigation.sourceReferenceFor(reference);
      return selected === undefined ? undefined : { ...selected, declaration };
    } },
  ]) {
    assert.equal(createSourceSingleInvocationQuery(current.source.ast, navigation)(declaration), false,
      "the exact original symbol, implementation, source file and binding are required");
  }
});

test("unused lexical declarations retain every runtime use and module declaration", () => {
  const current = fixture(`
function dormant(): number { throw 3; }
function typed(): number { return 3; }
type Signature = typeof typed;
const value: Signature | undefined = undefined;
function called(): number { return 3; }
function escaped(): number { return 3; }
const alias = escaped;
function captured(): number { return 3; }
const callback = () => captured();
function compared(): number { return 3; }
return called() + alias() + callback() + (compared === compared ? 0 : 1) + (value === undefined ? 0 : 1);`);
  for (const name of ["dormant", "typed"]) assert.equal(current.unused(name), true, name);
  for (const name of ["outer", "called", "escaped", "captured", "compared"]) {
    assert.equal(current.unused(name), false, name);
  }
});

test("unused lexical omission rejects unclassified, exported and written summaries", () => {
  const current = fixture(`function read(): number { return 3; } return 0;`);
  const declaration = current.declaration("read");
  const summary = current.source.navigation.declarationUseSummary(declaration);
  for (const mutation of [{ exported: true }, { bindingWritten: true }, { hasUnclassifiedValueUse: true },
    { uses: [{ reference: declaration, kind: "source-linkage" as const, role: "source-linkage" as const, captured: false, throughMember: false }] },
  ]) assert.equal(sourceLexicalFunctionIsUnused(declaration, current.source.ast,
    { ...current.source.navigation, declarationUseSummary: () => ({ ...summary, ...mutation }) }), false);
});

test("lexical overload uses keep their one checked implementation and original call identity", () => {
  for (const body of [
    `function pass<Value>(value: Value): Value;
function pass<Value>(value: Value): Value { return value; }
return pass<number>(3);`,
    `function pass(value: number): number;
function pass(value: string): string;
function pass(value: number | string): number | string { return value; }
return pass("used").length;`,
    `function pass<Value>(value: Value): Value;
function pass<Value>(value: Value): Value { return value; }
function generic<Value>(value: Value): Value { return pass(value); }
return generic(3);`,
  ]) {
    const current = fixture(body);
    assert.equal(current.unused("pass"), false, "an actual checked overload call retains its native implementation");
    assert.equal(current.select("pass"), true, "the one original checked call is retained in the canonical invocation proof");
    const declaration = current.declaration("pass");
    const file = current.source.ast.getSourceFile(declaration)!;
    const symbol = current.source.navigation.declarationSymbol(declaration, file);
    assert.equal(symbol !== undefined, true, "the implementation has its exact checked binding symbol");
    const references = current.source.navigation.referencesWithin(symbol!, file);
    assert.equal(references.some(reference => {
      const selected = current.source.navigation.sourceReferenceFor(reference);
      if (selected === undefined) return false;
      const implementation = current.source.navigation.callableImplementation(selected.declaration);
      return implementation.kind === "resolved" && implementation.implementation.declaration === declaration &&
        implementation.implementation.symbol === symbol;
    }), true, "the original signature-bound reference selects that same implementation by checked identity");
  }
});

test("unused overload families remain erased without merging same-spelling foreign bindings", () => {
  for (const body of [
    `function pass<Value>(value: Value): Value;
function pass<Value>(value: Value): Value { return value; }
return 0;`,
    `function pass<Value>(value: Value): Value;
function pass<Value>(value: Value): Value { return value; }
type Signature = typeof pass;
const missing: Signature | undefined = undefined;
return missing === undefined ? 0 : 1;`,
    `function left(): number {
function pass(value: number): number;
function pass(value: number): number { return value; }
return pass(3);
}
function right(): number {
function pass(value: number): number;
function pass(value: number): number { return value; }
return 0;
}
return left() + right();`,
  ]) {
    const current = fixture(body);
    assert.equal(current.unused("pass"), true, "only the original unused checked binding is erased");
    assert.equal(current.select("pass"), false, "no empty source-use set invents a native invocation");
  }
});

test("overloaded lexical usage distinguishes repeated, escaped and exactly once closed deferred calls", () => {
  for (const [suffix, expected] of [
    ["return pass(1) + pass(2);", false],
    ["const alias = pass; return alias(3);", false],
    ["const deferred = () => pass(3); return deferred();", true],
    ["const deferred = () => pass(3); return deferred() + deferred();", false],
  ] as const) {
    const current = fixture(`function pass(value: number): number;
function pass(value: number): number { return value; }
${suffix}`);
    assert.equal(current.unused("pass"), false, "an original runtime use is never erased");
    assert.equal(current.select("pass"), expected, "only the original single closed deferred execution proves one invocation");
  }
  const current = fixture("function pass(): number { return 3; } return pass();");
  const declaration = current.declaration("pass");
  const foreign = { ...current.source.navigation, sourceReferenceFor: () => undefined };
  assert.equal(sourceLexicalFunctionIsUnused(declaration, current.source.ast, foreign), false,
    "a missing original checked reference never becomes an empty safe source summary");
  assert.equal(createSourceSingleInvocationQuery(current.source.ast, foreign)(declaration), false,
    "a missing checked use cannot prove one native invocation");
});

test("single lexical invocation rejects repeated, recursive, escaping and deferred activation", () => {
  for (const body of [
    `function read(): number { return 3; } return read() + read();`,
    `function read(): number { return 3; } for (let index = 0; index < 2; index++) { read(); } return 0;`,
    `function read(): number { return read(); } return read();`,
    `function read(): number { return through(); } function through(): number { return read(); } return 0;`,
    `function read(): number { return 3; } const callback = () => read(); return callback() + callback();`,
    `function read(): number { return 3; } const alias = read; return alias();`,
    `function read(): number { return 3; } function through(): number { return read(); } return through() + through();`,
  ]) assert.equal(fixture(body).select("read"), false, body);
});

test("enclosing callable navigation accepts finite deep ancestry and terminates cycles", () => {
  const node = {} as Node;
  const ast = { parent: () => node, kindName: () => "KindBlock" } as unknown as Parameters<typeof sourceEnclosingCallable>[1];
  assert.equal(sourceEnclosingCallable(node, ast) === undefined, true);
  const nodes = Array.from({ length: 4096 }, () => ({} as Node));
  const indexes = new Map(nodes.map((value, index) => [value, index]));
  const deep = { parent: (value: Node) => nodes[indexes.get(value)! + 1],
    kindName: (value: Node) => value === nodes[nodes.length - 1] ? "KindFunctionDeclaration" : "KindBlock" } as unknown as Parameters<typeof sourceEnclosingCallable>[1];
  assert.equal(sourceEnclosingCallable(nodes[0], deep) === nodes[nodes.length - 1], true,
    "finite lexical ancestry reaches its actual callable beyond an arbitrary depth");
  assert.equal(sourceEnclosingCallable(undefined, deep) === undefined, true, "an absent source has no callable");
  const cyclic = { parent: (value: Node) => nodes[(indexes.get(value)! + 1) % nodes.length],
    kindName: () => "KindBlock" } as unknown as Parameters<typeof sourceEnclosingCallable>[1];
  assert.equal(sourceEnclosingCallable(nodes[0], cyclic) === undefined, true,
    "a long malformed cycle cannot manufacture an enclosing callable");
});

test("unused lexical admission uses actual checked ancestry beyond the optimization budget", () => {
  const current = fixture(`${"{".repeat(180)}
function dormant(): number { throw 3; }
function called(): number { return 1; }
called();
${"}".repeat(180)}
return 0;`);
  const dormant = current.declaration("dormant");
  assert.equal(sourceEnclosingCallable(current.source.ast.parent(dormant), current.source.ast) === current.declaration("outer"), true,
    "the checked declaration retains its exact enclosing owner");
  assert.equal(current.unused("dormant"), true, "an unused deep native body remains erased");
  assert.equal(current.unused("called"), false, "a real deep invocation still requires its native body");
  assert.equal(current.select("called"), false, "the separate conservative single-invocation optimization budget is unchanged");
});

test("finite source participation closes inherited erasure independently of input order", () => {
  const root = {} as Node;
  const erased = {} as Node;
  const nested = {} as Node;
  const included = {} as Node;
  const leaf = {} as Node;
  const parents = new Map([[erased, root], [nested, erased], [included, root], [leaf, included]]);
  const nodes = [root, erased, nested, included, leaf];
  for (const order of [nodes, [...nodes].reverse(), [nested, leaf, included, erased, root]]) {
    const selected: Node[] = [];
    const current = sourceNodesOutsideErasedSubtrees({ parent: node => node === undefined ? undefined : parents.get(node) }, order, node => {
      selected.push(node);
      return node === erased;
    });
    assert.equal(current.kind, "resolved", "the complete checked domain resolves");
    if (current.kind !== "resolved") continue;
    assert.equal(current.nodes.length, 3, "only the root and admitted branch participate");
    assert.equal(current.nodes.every(node => [root, included, leaf].includes(node)), true, "exact selected identities");
    assert.equal(current.nodes.every((node, index) => node === order.filter(value => [root, included, leaf].includes(value))[index]), true,
      "publication preserves the supplied finite node order");
    assert.equal(selected.includes(nested), false, "no classification occurs inside an erased subtree");
    assert.equal(new Set(selected).size, selected.length, "each reached classification runs once");
    assert.equal(Object.isFrozen(current), true, "the completed result is immutable");
    assert.equal(Object.isFrozen(current.nodes), true, "the selected node domain is immutable");
  }
});

test("finite source participation validates every parent before any classification is published", () => {
  const first = {} as Node;
  const second = {} as Node;
  let selections = 0;
  const classify = (): boolean => { selections += 1; return false; };
  for (const [nodes, parent, reason] of [
    [[first, second], (node: Node | undefined) => node === first ? second : node === second ? first : undefined, "acyclic"],
    [[first], () => second, "every checked parent"],
    [[first, first], () => undefined, "one occurrence"],
  ] as const) {
    const current = sourceNodesOutsideErasedSubtrees({ parent }, nodes, classify);
    assert.equal(current.kind, "unresolved", "malformed source domain is not partially admitted");
    assert.equal(current.kind === "unresolved" && current.reason.includes(reason), true, "the actual closure failure is explained");
    assert.equal(selections, 0, "no target classification/writer runs before complete structural closure");
  }
});

test("finite source participation has no arbitrary ancestor-depth limit or post-completion source reads", () => {
  const nodes = Array.from({ length: 1024 }, () => ({} as Node));
  const parents = new Map(nodes.slice(1).map((node, index) => [node, nodes[index]!]));
  let reads = 0;
  let selections = 0;
  const source = Proxy.revocable({ parent(node: Node | undefined) {
    reads += 1;
    return node === undefined ? undefined : parents.get(node);
  } }, {});
  const current = sourceNodesOutsideErasedSubtrees(source.proxy, [...nodes].reverse(), () => { selections += 1; return false; });
  assert.equal(current.kind, "resolved", "a finite deeply nested checked tree closes");
  assert.equal(reads, nodes.length, "each checked parent is read once");
  assert.equal(selections, nodes.length, "each admitted node is classified once");
  source.revoke();
  assert.equal(current.kind === "resolved" && current.nodes.length === nodes.length, true, "the completed domain is data only");
  assert.equal(current.kind === "resolved" && current.nodes[0] === nodes[nodes.length - 1], true, "exact identity survives source revocation");
});
