import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../source-semantics/target-source-program.js";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../source-storage/model/resource-budget.js";
import { analyzeSourceGenericAdoption } from "./generic-adoption.js";

function fixture(text: string, projectRoot = "/src") {
  const checked = createCompilerSessionFromFiles({ currentDirectory: projectRoot, files: { [`${projectRoot}/index.ts`]: text },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics
    .filter((diagnostic): diagnostic is NonNullable<typeof diagnostic> => diagnostic !== undefined).slice(0, 3)).slice(0, 2048));
  const source = createTargetSourceProgram(checked);
  const nodes: Node[] = [];
  const visit = (node: Node): void => {
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  for (const file of source.sourceFiles) if (!source.ast.isDeclarationFile(file)) visit(file);
  const query = (maximumSteps = defaultSourceStorageLimits.maximumSteps, exemptTypeParameter?: (node: Node) => boolean) =>
    analyzeSourceGenericAdoption({ source, projectRoot, nodes, budget: createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps }),
      ...(exemptTypeParameter === undefined ? {} : { exemptTypeParameter }) });
  const textFor = (node: Node): string => source.ast.getSourceText(source.ast.getSourceFile(node)!)
    .slice(source.ast.pos(node), source.ast.end(node)).trim();
  return { source, nodes, query, textFor };
}

function sourcePosition(source: TargetSourceProgram, node: Node, finish = false) {
  const bytes = Buffer.from(source.ast.getSourceText(source.ast.getSourceFile(node)!));
  const leading = /^[\t\n\v\f\r ]*/u.exec(bytes.subarray(source.ast.pos(node), source.ast.end(node)).toString("utf8"))![0];
  const position = finish ? source.ast.end(node) : source.ast.pos(node) + Buffer.byteLength(leading);
  const lines = bytes.subarray(0, position).toString("utf8").split(/\r\n|\r|\n/u);
  return { line: lines.length, column: [...lines[lines.length - 1]!].length + 1 };
}

function sourceSpan(source: TargetSourceProgram, node: Node) {
  const start = sourcePosition(source, node);
  const finish = sourcePosition(source, node, true);
  return { fileName: "index.ts", ...start, endLine: finish.line, endColumn: finish.column };
}

const identity = "async function identity<T>(value: T) { return value; }";
const declarations = [
  ["direct return", identity, "identity"],
  ["await forwarding", `${identity}\nasync function outer<V>(value: V) { await identity(value); }`, "outer"],
  ["local await forwarding", `${identity}\nasync function outer2<V>(value: V) { const result = await identity(value); return 0; }`, "outer2"],
  ["synchronous forwarding", `${identity}\nfunction sync<V>(value: V): void { void identity(value); }`, "sync"],
  ["pending forwarding", `async function later<T>(value: T, pending: Promise<void>) { await pending; return value; }
    async function outer3<V>(value: V) { await later(value, Promise.resolve(undefined)); }`, "outer3"],
  ["generic resolving call", "function wrap<T>(value: T): void { void Promise.resolve(value); }", "wrap"],
  ["nested async arrow", "function nested<T>(value: T) { return async () => value; }", "nested"],
  ["reaction return", "function reaction<T>(value: T) { void Promise.resolve(0).then(() => value); }", "reaction"],
  ["reaction catch", "function caught<T>(value: T) { void Promise.resolve(0).catch(() => value); }", "caught"],
  ["reaction finally", "function final<T>(value: T) { void Promise.resolve(0).finally(() => value); }", "final"],
  ["PromiseLike reaction", `function likeReaction<T>(value: T): void {
    const pending: PromiseLike<number> = Promise.resolve(0); void pending.then(() => value);
  }`, "likeReaction"],
  ["named reaction", "function named<T>(value: T) { function read(): T { return value; } void Promise.resolve(0).then(read); }", "named"],
  ["resolve callback", "function resolving<T>(value: T) { return new Promise<T>(resolve => { resolve(value); }); }", "resolving"],
  ["aliased resolver", "function aliased<T>(value: T) { return new Promise<T>(resolve => { const done = resolve; done(value); }); }", "aliased"],
  ["named executor", `function namedExecutor<T>(value: T) {
    function execute(resolve: (value: T | PromiseLike<T>) => void): void { resolve(value); }
    return new Promise<T>(execute);
  }`, "namedExecutor"],
  ["generic callable body unknown", `function unknown<Value>(callback: <T>(value: T) => Promise<T>, value: Value): void {
    void callback(value);
  }\nfunction unknownRoot<Value>(value: Value): void { unknown(identity, value); }\n${identity}`, "unknownRoot"],
] as const;

for (const [name, declaration, invoked] of declarations) {
  test(`generic adoption closes ${name} without refusing its ordinary actual`, () => {
    const current = fixture(`${declaration}\nconst promised = Promise.resolve(7); void ${invoked}(7); void ${invoked}(promised);`);
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : name);
    if (selected.kind !== "resolved") return;
    assert.equal(selected.issues.length, 1, `${name}: exactly one concrete adopting instantiation`);
    const issue = selected.issues[0]!;
    assert.equal(current.textFor(issue.site), `${invoked}(promised)`, `${name}: refusal is on the actual call, not the generic body`);
    assert.equal(current.source.ast.is.IsTypeParameterDeclaration(issue.parameter), true, `${name}: actual parameter identity`);
    assert.equal(current.nodes.includes(issue.declaration) && current.nodes.includes(issue.operation), true,
      `${name}: declaration and first operation are real checked related nodes`);
    assert.deepEqual(issue.evidence, [
      ["declaration", issue.declaration] as const, ["first-sensitive-operation", issue.operation] as const,
    ].map(([kind, node]) => `${kind} index.ts:${sourcePosition(current.source, node).line}:${sourcePosition(current.source, node).column}`),
    `${name}: one shared owner publishes exact related source coordinates for both targets`);
    assert.deepEqual(issue.sourceSpan, sourceSpan(current.source, issue.site), `${name}: actual instantiation site span`);
    assert.equal(Object.isFrozen(selected.issues) && Object.isFrozen(issue), true, `${name}: immutable completed summary`);
  });
}

test("a class parameter and captured structural method are summarized at their actual constructors", () => {
  const current = fixture(`
    class Holder<T> { constructor(readonly value: T) {} async get(): Promise<T> { return this.value; } }
    function make<T>(value: T): { read(): Promise<T> } { return { async read(): Promise<T> { return value; } }; }
    const promised = Promise.resolve(7);
    void new Holder(7); void new Holder(promised); void make(7); void make(promised);
  `);
  const selected = current.query();
  assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "complete class summary");
  if (selected.kind !== "resolved") return;
  assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)).sort(), ["make(promised)", "new Holder(promised)"]);
});

test("generic adoption provenance has one canonical Unicode/CRLF span and project-relative format", () => {
  const text = 'const marker = "界😀";\r\nasync function identity<Value>(value: Value) {\r\n\treturn value;\r\n}\r\n' +
    "export function reject(promised: Promise<number>): void {\r\n\tvoid identity(promised);\r\n}";
  const expectedSpan = { fileName: "index.ts", line: 6, column: 7, endLine: 6, endColumn: 25 };
  const expectedEvidence = ["declaration index.ts:2:1", "first-sensitive-operation index.ts:3:2"];
  const results = ["/checkout/rust/src", "/another/csharp/src"].map(root => {
    const current = fixture(text, root);
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "complete provenance");
    if (selected.kind !== "resolved") return undefined;
    assert.equal(selected.issues.length, 1, `${root}: one actual instantiation`);
    const issue = selected.issues[0]!;
    assert.equal(current.textFor(issue.site), "identity(promised)", `${root}: unchanged original site`);
    assert.deepEqual(issue.sourceSpan, expectedSpan, `${root}: UTF-8 offsets, scalar columns and CRLF lines`);
    assert.deepEqual(issue.evidence, expectedEvidence, `${root}: one fixed shared related-location format`);
    assert.equal(Object.isFrozen(issue.sourceSpan) && Object.isFrozen(issue.evidence), true, `${root}: immutable publication`);
    return { sourceSpan: issue.sourceSpan, evidence: issue.evidence };
  });
  assert.deepEqual(results[0], results[1], "a different target checkout cannot change diagnostic provenance bytes");
});

test("mutual generic forwarding uses one finite SCC and keeps exact actual instantiation sites", () => {
  const current = fixture(`
    async function left<T>(value: T, count: number): Promise<void> { if (count > 0) await right(value, count - 1); }
    async function right<U>(value: U, count: number): Promise<void> {
      if (count > 0) await left(value, count - 1); void Promise.resolve(value);
    }
    const promised = Promise.resolve(7); void left(7, 2); void left(promised, 2);
  `);
  for (let count = 0; count < 2; count++) {
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "finite mutually recursive summary");
    if (selected.kind !== "resolved") continue;
    assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)), ["left(promised, 2)"]);
  }
  const exhausted = current.query(1);
  assert.equal(exhausted.kind === "unresolved" && exhausted.reason.includes("budget"), true,
    "budget exhaustion publishes neither an empty safe summary nor a partial refusal set");
});

test("native payload containers, ordinary library generics and primitive constraints do not become generic adoption", () => {
  const current = fixture(`
    ${identity}
    async function primitive<T extends number>(value: T): Promise<T> { return value; }
    async function container<T>(value: T[]): Promise<T[]> { return value; }
    const promised = Promise.resolve(7);
    void identity(7); void identity("exact"); void primitive(7); void container([promised]);
    void [1, 2].map(async value => value); void Promise.all([promised]);
    async function library(): Promise<void> { await Promise.all([1, 2].map(async value => value)); }
  `);
  const selected = current.query();
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    selected.kind === "unresolved" ? selected.reason : "native payload containers and ambient generic binders are not adoption sites");
});

test("unknown and any actuals keep their checked non-thenable boundary", () => {
  const current = fixture(`${identity}\ndeclare const unknownValue: unknown; declare const anyValue: any;
    void identity(unknownValue); void identity(anyValue);`);
  const selected = current.query();
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    "the checker, not Promise-shaped spelling, owns the actual awaitable selection");
});

test("target-owned erased lifetime parameters use their exact declarations, never a parameter-name guess", () => {
  const current = fixture(`async function marker<Region>(value: Region) { return value; }
    const promised = Promise.resolve(7); void marker(promised);`);
  const parameter = current.nodes.find(node => current.source.ast.is.IsTypeParameterDeclaration(node));
  assert.equal(parameter !== undefined, true, "actual target-marked parameter");
  const selection = current.query(defaultSourceStorageLimits.maximumSteps, node => node === parameter);
  assert.equal(selection.kind === "resolved" && selection.issues.length === 0, true, "one explicit target-owned erased marker");
  const ordinary = current.query();
  assert.equal(ordinary.kind === "resolved" && ordinary.issues.length === 1, true, "the same name alone is never an exemption");
});

test("a project member named Promise.resolve is not a native Promise resolving owner", () => {
  const current = fixture(`export {};
    const local = { resolve<Value>(value: Value): Value { return value; } };
    function wrap<T>(value: T): void { void local.resolve(value); }
    const promised = Promise.resolve(7); void wrap(promised);
  `);
  const selected = current.query();
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    "only the actual checked configured-library/provider declaration owns Promise resolution");
});

for (const [name, body] of [
  ["unused-named", "async function unused() { return value; } return 1;"],
  ["discarded-arrow", "async () => value; return 1;"],
  ["type-only", "async function unused() { return value; } type OnlyType = typeof unused; return 1;"],
  ["erased-forwarding", "function unused() { return identity(value); } return 1;"],
]) {
  test(`generic adoption excludes only the canonical ${name} subtree`, () => {
    const current = fixture(`${identity}\nfunction consume<T>(value: T) { ${body} }
      const promised = Promise.resolve(1); void consume(promised);`);
    const selected = current.query();
    assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
      selected.kind === "unresolved" ? selected.reason : "an erased body has no runtime adoption operation");
  });
}

for (const [name, declaration, invoked] of [
  ["called-nested", "function consume<T>(value: T) { async function inner() { return value; } return inner(); }", "consume"],
  ["hoisted-call", "function consume<T>(value: T) { return inner(); async function inner() { return value; } }", "consume"],
  ["returned-arrow", "function consume<T>(value: T) { return async () => value; }", "consume"],
  ["stored-arrow", "function consume<T>(value: T) { const queue: (() => Promise<T>)[] = []; const later = async () => value; queue.push(later); }", "consume"],
  ["invoked-arrow", "function consume<T>(value: T) { return (async () => value)(); }", "consume"],
  ["overloaded", "function identity2<V>(value: V): Promise<V>; async function identity2<V>(value: V): Promise<V> { return value; }", "identity2"],
] as const) {
  test(`generic adoption retains the complete ${name} source domain`, () => {
    const current = fixture(`${declaration}\nconst promised = Promise.resolve(1); void ${invoked}(promised);`);
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : name);
    if (selected.kind !== "resolved") return;
    assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)), [`${invoked}(promised)`],
      "a runtime-reachable nested body or overload is never erased from adoption evidence");
  });
}

test("interface and abstract generic signatures stay fail-closed without a source implementation", () => {
  const current = fixture(`
    interface Contract { identity<Value>(value: Value): Promise<Value>; }
    abstract class Base { abstract identity<Value>(value: Value): Promise<Value>; }
    function reject(contract: Contract, base: Base, promised: Promise<number>): void {
      void contract.identity(promised); void base.identity(promised);
    }
  `);
  const selected = current.query();
  assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "two unknown source contracts");
  if (selected.kind !== "resolved") return;
  assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)).sort(),
    ["base.identity(promised)", "contract.identity(promised)"], "both actual generic signature instantiations require adoption");
});
