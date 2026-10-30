import assert from "node:assert/strict";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../source-semantics/target-source-program.js";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import { createSourceDeclarationOwnershipBudget, defaultSourceDeclarationOwnershipLimits,
  sourceDeclarationOwnershipUnresolved } from "./contracts.js";
import { analyzeSourceDeclarationGenericAdoption } from "./generic-adoption.js";

export function nativeEntryFixture(text: string, timing?: "synchronous" | "deferred") {
  const current = fixture(text);
  const declaration = current.nodes.find(node => current.source.ast.is.IsFunctionDeclaration(node) &&
    current.source.ast.text(current.source.ast.name(node)) === "nativeInvoke");
  assert.equal(declaration !== undefined && current.source.ast.body(declaration) === undefined, true,
    "one exact checked ambient declaration owns this unit fixture's native contract");
  assert.equal(timing === undefined || timing === "synchronous" || timing === "deferred", true,
    "the retained timing controls never choose a different checked native signature");
  return current;
}

export const nativePayloadContinuationCases = [
  {
    "name": "source-helper",
    "declarations": "function send<Part>(done: (value: Part) => void, value: Part): void { done(value); } function make<Part>(done: (value: Part) => void, value: Part): () => void { return () => { send(done, value); }; }",
    "ordinary": "send(resolve, 7);",
    "adopter": "send((actual: number): void => { void actual; }, 7);",
    "expression": "done(value)"
  },
  {
    "name": "source-helper-chain",
    "declarations": "function send<Part>(done: (value: Part) => void, value: Part): void { done(value); } function forward<Part>(done: (value: Part) => void, value: Part): void { send(done, value); } function make<Part>(done: (value: Part) => void, value: Part): () => void { return () => { forward(done, value); }; }",
    "ordinary": "send(resolve, 7);",
    "adopter": "send((actual: number): void => { void actual; }, 7);",
    "expression": "done(value)"
  },
  {
    "name": "native-forwarded-helper",
    "declarations": "function send<Part>(done: (value: Part) => void, value: Part): void { done(value); } function make<Part>(done: (value: Part) => void, value: Part): () => void { return () => { send(done, value); }; }",
    "ordinary": "send(resolve, 7);",
    "adopter": "send((actual: number): void => { void actual; }, 7);",
    "expression": "done(value)"
  },
  {
    "name": "default-helper",
    "declarations": "function send<Part>(done: (value: Part) => void, value: Part, actual: Part = value): void { done(actual); } function make<Part>(done: (value: Part) => void, value: Part): () => void { return () => { send(done, value); }; }",
    "ordinary": "send(resolve, 7);",
    "adopter": "send((actual: number): void => { void actual; }, 7);",
    "expression": "done(actual)"
  },
  {
    "name": "component-helper",
    "declarations": "function send<Part>(done: (value: Part) => void, input: { payload: Part }): void { done(input.payload); } function make<Part>(done: (value: Part) => void, value: Part): () => void { return () => { send(done, { payload: value }); }; }",
    "ordinary": "send(resolve, { payload: 7 });",
    "adopter": "send((actual: number): void => { void actual; }, { payload: 7 });",
    "expression": "done(input.payload)"
  },
  {
    "name": "recursive-helper",
    "declarations": "function send<Part>(done: (value: Part) => void, value: Part, depth: number): void { if (depth > 0) send(done, value, depth - 1); else done(value); } function make<Part>(done: (value: Part) => void, value: Part): () => void { return () => { send(done, value, 1); }; }",
    "ordinary": "send(resolve, 7, 1);",
    "adopter": "send((actual: number): void => { void actual; }, 7, 1);",
    "expression": "done(value)"
  },
  {
    "name": "receiver-helper",
    "declarations": "class Relay<Part> { constructor(readonly done: (value: Part) => void, readonly value: Part) {} run(): void { this.done(this.value); } } function make<Part>(done: (value: Part) => void, value: Part): () => void { const relay = new Relay(done, value); return () => { relay.run(); }; }",
    "ordinary": "new Relay(resolve, 7).run();",
    "adopter": "new Relay((actual: number): void => { void actual; }, 7).run();",
    "expression": "this.done(this.value)"
  }
] as const;

export function fixture(text: string, projectRoot = "/src") {
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
  const query = (maximumSteps = defaultSourceDeclarationOwnershipLimits.maximumSteps,
    exemptTypeParameter?: (node: Node) => boolean) =>
    analyzeSourceDeclarationGenericAdoption({ source, projectRoot, nodes,
      budget: createSourceDeclarationOwnershipBudget(nodes[0]!,
        { ...defaultSourceDeclarationOwnershipLimits, maximumSteps }),
      premises: { completionFor(call, selected) {
        const semantics = source.semantics.forNode(call);
        const declaration = semantics.declarations.signatureDeclaration(selected.selectedSignature);
        if (declaration === undefined)
          return sourceDeclarationOwnershipUnresolved(call, "The unit native contract requires its real selected declaration.");
        const awaited = semantics.types.awaitedType(selected.sourceResultType);
        if (awaited !== undefined && semantics.types.isIdentical(awaited, selected.sourceResultType)) return { kind: "not-async" };
        return { kind: "async", resultPolicy: "must-observe", contract: { kind: "declaration", declaration,
          component: { selectedType: selected.sourceResultType, contextualCall: selected } } };
      } },
      ...(exemptTypeParameter === undefined ? {} : { exemptTypeParameter }) });
  const textFor = (node: Node): string => Buffer.from(source.ast.getSourceText(source.ast.getSourceFile(node)!))
    .subarray(source.ast.pos(node), source.ast.end(node)).toString("utf8").trim();
  return { source, nodes, query, textFor };
}

export function sourcePosition(source: TargetSourceProgram, node: Node, finish = false) {
  const bytes = Buffer.from(source.ast.getSourceText(source.ast.getSourceFile(node)!));
  const leading = /^[\t\n\v\f\r ]*/u.exec(bytes.subarray(source.ast.pos(node), source.ast.end(node)).toString("utf8"))![0];
  const position = finish ? source.ast.end(node) : source.ast.pos(node) + Buffer.byteLength(leading);
  const lines = bytes.subarray(0, position).toString("utf8").split(/\r\n|\r|\n/u);
  return { line: lines.length, column: [...lines[lines.length - 1]!].length + 1 };
}

export function assertDeclaredAdoption(current: ReturnType<typeof fixture>, expected: 0 | 1, call: string): void {
  const selected = current.query();
  assert.equal(selected.kind, "resolved", "the checked declaration decides without callback execution history");
  if (selected.kind !== "resolved") return;
  assert.equal(selected.issues.length, expected, "only a declared native adoption at this instantiation is refused");
  if (expected === 0) return;
  const issue = selected.issues[0]!;
  assert.equal(current.textFor(issue.site), call, "the original checked instantiation owns the issue");
  assert.equal(current.source.ast.parent(issue.parameter) === issue.declaration, true,
    "the issue retains its exact original generic formal and declaration");
  assert.equal(issue.operation === issue.declaration, true,
    "the declared result contract, not a callback execution, owns sensitivity");
}

export function sourceSpan(source: TargetSourceProgram, node: Node) {
  const start = sourcePosition(source, node);
  const finish = sourcePosition(source, node, true);
  return { fileName: "index.ts", ...start, endLine: finish.line, endColumn: finish.column };
}

export const identity = "async function identity<T>(value: T) { return value; }";

export const declarations = [
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
  ["resolver helper", `function helper<T>(value: T) { return new Promise<T>(resolve => {
    function deliver(callback: (value: T) => void): void { callback(value); } deliver(resolve);
  }); }`, "helper"],
  ["generic resolver helper", `function deliver<V>(callback: (value: V) => void, value: V): void { callback(value); }
    function helper<T>(value: T) { return new Promise<T>(resolve => deliver(resolve, value)); }`, "helper"],
  ["member resolver", `function helper<T>(value: T) { return new Promise<T>(resolve => {
    const cell = { done: resolve }; const alias = cell.done; alias(value);
  }); }`, "helper"],
  ["typed returned executor", `type Executor<T> = (resolve: (value: T | PromiseLike<T>) => void) => void;
    function make<T>(value: T): Executor<T> { return resolve => resolve(value); }
    function helper<T>(value: T) { return new Promise<T>(make(value)); }`, "helper"],
  ["generic callable body unknown", `function unknown<Value>(callback: <T>(value: T) => Promise<T>, value: Value): void {
    void callback(value);
  }\nfunction unknownRoot<Value>(value: Value): void { unknown(identity, value); }\n${identity}`, "unknownRoot"],
] as const;
