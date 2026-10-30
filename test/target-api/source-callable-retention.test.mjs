import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceDeclarationRetentionQuery, createSourceDeclarationOwnershipValues, createSourceDeclarationOwnershipBudget,
  defaultSourceDeclarationOwnershipLimits, createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";

function fixture(body, nativeAvailable = true) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `export {}; ${body}` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const storage = createSourceStorageQuery(source, [checked.getSourceFile("/src/index.ts")]);
  const nodes = source.navigation.nodes;
  const budget = createSourceDeclarationOwnershipBudget(nodes[0], defaultSourceDeclarationOwnershipLimits);
  const context = createSourceDeclarationOwnershipValues({ source, nodes, budget, limits: {} });
  const query = createSourceDeclarationRetentionQuery({ source, values: context.values, budget,
    premises: { retentionFor({ value }) {
      if (!nativeAvailable) return undefined;
      return { kind: "resolved", premises: [{ kind: "retained", reason: "owned-value", value,
        contract: { kind: "expression", expression: value.node, component: value.component } }] };
    } } });
  const declaration = name => storage.nodes.find(node => source.ast.is.IsFunctionDeclaration(node) &&
    source.ast.text(source.ast.name(node)) === name);
  const references = name => {
    const selected = declaration(name);
    const owner = source.ast.is.IsFunctionExpression(selected) || source.ast.is.IsArrowFunction(selected)
      ? source.ast.parent(selected) : selected;
    return nodes.filter(node => source.ast.is.IsIdentifier(node) && node !== source.ast.name(owner) &&
      source.navigation.sourceReferenceFor(node)?.declaration === owner);
  };
  const select = name => {
    const reference = references(name)[0];
    return reference === undefined ? { kind: "unresolved", at: declaration(name),
      reason: "A native callable contract requires its actual checked read, never an empty declaration-use set.",
      cause: { kind: "required-fact" } } : query.forReference(reference);
  };
  return { source, storage, nodes, budget, context, query, declaration, references, select };
}

test("a declared callback invoked only within source callers is scoped", () => {
  const current = fixture(`function child(): void {} child();`);
  const selected = current.select("child");
  assert.equal(selected.kind === "resolved", true, selected.reason ?? selected.kind);
  assert.equal(selected.premises[0]?.kind, "retained", "direct invocation is not an escaping value");
  assert.equal(selected.premises.length > 0, true, "the proof is nonempty");
});

test("forwarded checked formals and const aliases do not turn invocation into retention", () => {
  const current = fixture(`
    function child(): void {}
    function invoke(callback: () => void): void { callback(); }
    function forward(callback: () => void): void { const alias = callback; invoke(alias); }
    const original = child; forward(original);
  `);
  const selected = current.select("child");
  assert.equal(selected.kind === "resolved", true, selected.reason ?? selected.kind);
  assert.equal(selected.premises[0]?.kind, "retained", "all source formal paths end in ordinary calls");
});

test("a returned source callable has a real retaining witness", () => {
  const current = fixture(`function create(): () => void {
    function child(): void {} return child;
  } const stored = create(); stored();`);
  const selected = current.select("child");
  assert.equal(selected.kind === "resolved", true, selected.reason ?? selected.kind);
  assert.equal(selected.premises[0]?.kind, "retained", "returning the closure retains its environment");
  assert.equal(selected.premises.length > 0, true, "the original return is recorded");
});

test("a checked source formal storing its callback is retained", () => {
  const current = fixture(`let stored: () => void = () => {};
    function retain(callback: () => void): void { stored = callback; }
    function child(): void {} retain(child);`);
  const selected = current.select("child");
  assert.equal(selected.kind === "resolved", true, selected.reason ?? selected.kind);
  assert.equal(selected.premises[0]?.kind, "retained", "the actual formal's external store is not erased");
});

test("an opaque argument is open instead of being relabelled as borrowed or owned", () => {
  const current = fixture(`declare function opaque(callback: () => void): void;
    function child(): void {} opaque(child);`, false);
  assert.equal(current.select("child").kind, "unresolved", "a passed argument alone proves neither lifetime");
});

test("a locally invoked capturing source callback stays within the same activation", () => {
  const current = fixture(`function child(): void {}
    function invoke(callback: () => void): void { const nested = () => callback(); nested(); }
    invoke(child);`);
  const selected = current.select("child");
  assert.equal(selected.kind === "resolved", true, selected.reason ?? selected.kind);
  assert.equal(selected.premises[0]?.kind, "retained", "a capture is followed to its actual non-retaining uses");
});

for (const [label, declarations, entry, expected] of [
  ["sibling order", `function left(value: number): void { if (value > 0) right(value - 1); }
    function right(value: number): void { if (value > 0) left(value - 1); }`, "left(2);", "retained"],
  ["reverse sibling order", `function right(value: number): void { if (value > 0) left(value - 1); }
    function left(value: number): void { if (value > 0) right(value - 1); }`, "right(2);", "retained"],
  ["self recursion", `function left(value: number): void { if (value > 0) left(value - 1); }`, "left(2);", "retained"],
  ["function-valued alias", `function left(value: number): void { if (value > 0) right(value - 1); }
    function right(value: number): void { if (value > 0) left(value - 1); }
    const original = left; const alias = original;`, "alias(2);", "retained"],
  ["returned cyclic closure", `function left(value: number): void { if (value > 0) right(value - 1); }
    function right(value: number): void { if (value > 0) left(value - 1); }`, "return left;", "retained"],
]) {
  test(`recursive callable retention preserves the actual lexical creator for ${label}`, () => {
    const current = fixture(`function outer() { function inner() { ${declarations} ${entry} } return inner(); }
      const first = outer(); const second = outer();`);
    const selected = current.select("left");
    assert.equal(selected.kind === "resolved", true, `${label}: ${selected.reason ?? ""}`);
    assert.equal(selected.premises[0]?.kind, expected, `${label}: sibling capture does not create another nested execution`);
    assert.equal(selected.premises.length > 0, true, "the original checked uses remain nonempty evidence");
    assert.equal(current.select("left") === selected, true, "one complete immutable owner selection is published");
  });
}

test("an opaque use in a sibling capture never becomes a scoped recursion proof", () => {
  const current = fixture(`declare function opaque(callback: () => void): void;
    function outer(): void {
      function left(): void { right(); }
      function right(): void { opaque(left); }
      left();
    } outer();`, false);
  assert.equal(current.select("left").kind, "unresolved", "a finite lexical context does not prove an opaque lifetime");
});

test("an unused declaration is not a vacuous closed lifetime proof", () => {
  const current = fixture(`function child(): void {}`);
  assert.equal(current.select("child").kind, "unresolved", "no actual use cannot prove a scoped activation");
});

test("one retaining source path keeps the same callable retained on every query", () => {
  const current = fixture(`let stored: () => void = () => {};
    function child(): void {}
    function invoke(callback: () => void): void { callback(); }
    invoke(child); stored = child;`);
  const first = current.select("child");
  assert.equal(first.kind === "resolved", true, first.reason ?? first.kind);
  assert.equal(first.premises[0]?.kind, "retained", "one actual escape prevents an all-use non-retention proof");
  assert.equal(current.select("child") === first, true, "the owner publishes one immutable selection");
  assert.equal(Object.isFrozen(first) && Object.isFrozen(first.premises), true, "source evidence cannot be rewritten by native consumers");
  const reads = current.references("child");
  assert.equal(reads.length === 2, true, "both original direct-call and later stored reads remain");
  const later = current.query.forReference(reads[1]);
  assert.equal(later.kind === "resolved" && later.premises[0].value.node === reads[1], true,
    "the retaining read has its own checked native descriptor");
  assert.equal(current.query.forReference(reads[0]) === first && first.premises[0].value.node === reads[0], true,
    "a later retaining read never retargets the earlier native contract or its cache identity");
});

const pendingReceiver = `declare const pending: Promise<void>;
  async function later(ready: Promise<void>, callback: () => void): Promise<void> { await ready; callback(); }`;

test("a discarded receiving future retains the original void-returning callback", () => {
  const current = fixture(`${pendingReceiver}
    function start(ready: Promise<void>): void {
      const text = "kept"; function child(): void { void text; } void later(ready, child);
    } start(pending);`);
  const selected = current.select("child");
  assert.equal(selected.kind === "resolved", true, selected.reason ?? selected.kind);
  assert.equal(selected.premises[0]?.kind, "retained", "the receiving future, not callback()'s void result, determines the lifetime");
  const { ast } = current.source;
  const receiving = current.storage.nodes.filter(node => {
    if (!ast.is.IsCallExpression(node)) return false;
    const expression = ast.as.AsCallExpression(node).Expression;
    if (!ast.is.IsIdentifier(expression) || ast.text(expression) !== "later") return false;
    const call = current.source.semantics.forNode(node).operations.call(node);
    return call !== undefined && call.sourceArguments.length === 2 &&
      call.sourceArguments.every((argument, index) => ast.is.IsIdentifier(argument.expression) &&
        ast.text(argument.expression) === ["ready", "child"][index]);
  });
  assert.equal(receiving.length, 1, "the fixture has one exact checked later(ready, child) invocation");
  assert.equal(selected.premises.some(premise => current.references("child").includes(premise.value.node) &&
    current.source.ast.is.IsCallExpression(current.source.ast.parent(premise.value.node))), true,
  "the exact original deferred receiving invocation witnesses retention");
});

for (const [label, invocation] of [
  ["direct await", "await later(ready, child);"],
  ["immediately awaited local", "const continuation = later(ready, child); await continuation;"],
]) {
  test(`the same deferred receiver stays scoped under ${label}`, () => {
    const current = fixture(`${pendingReceiver}
      async function start(ready: Promise<void>): Promise<void> {
        const text = "kept"; function child(): void { void text; } ${invocation}
      } void start(pending);`);
    const selected = current.select("child");
    assert.equal(selected.kind === "resolved", true, selected.reason ?? selected.kind);
    assert.equal(selected.premises[0]?.kind, "retained", "the original caller proves completion before its local callback region ends");
    assert.equal(selected.premises.length > 0, true, "scoped use is a nonempty source proof, not an async-wide ownership default");
  });
}

test("a returned receiving future follows its actual forwarding caller frame", () => {
  const current = fixture(`${pendingReceiver}
    function forward(ready: Promise<void>, callback: () => void): Promise<void> { return later(ready, callback); }
    async function start(ready: Promise<void>): Promise<void> {
      const text = "kept"; function child(): void { void text; } await forward(ready, child);
    } void start(pending);`);
  const selected = current.select("child");
  assert.equal(selected.kind === "resolved", true, selected.reason ?? selected.kind);
  assert.equal(selected.premises[0]?.kind, "retained", "the forwarding formal preserves the receiving invocation and original awaiting caller");
  assert.equal(selected.premises.every(premise => current.references("child").includes(premise.value.node) &&
      premise.value.region.owner !== undefined && premise.value.region.root !== undefined), true,
    "the original formal path is retained as evidence");
});

test("returning a future from the callback's own creator retains its local environment", () => {
  const current = fixture(`${pendingReceiver}
    function start(ready: Promise<void>): Promise<void> {
      const text = "kept"; function child(): void { void text; } return later(ready, child);
    } const continuation = start(pending);`);
  const selected = current.select("child");
  assert.equal(selected.kind === "resolved", true, selected.reason ?? selected.kind);
  assert.equal(selected.premises[0]?.kind, "retained", "a source factory's local region ends before its returned future");
});

test("one receiving owner is classified separately for each original call activation", () => {
  const current = fixture(`${pendingReceiver}
    async function start(ready: Promise<void>): Promise<void> {
      const text = "kept"; function child(): void { void text; }
      await later(ready, child); void later(ready, child);
    } void start(pending);`);
  const selected = current.select("child");
  assert.equal(selected.kind === "resolved", true, selected.reason ?? selected.kind);
  assert.equal(selected.premises[0]?.kind, "retained", "the awaited invocation cannot close the independent discarded invocation");
});

test("an externally checked deferred formal remains an open retention boundary", () => {
  const current = fixture(`declare function later(callback: () => void): Promise<void>;
    function child(): void {} void later(child);`, false);
  assert.equal(current.select("child").kind, "unresolved", "a Promise result does not invent a checked callback retaining body");
});

test("a returned source generator retains its actual original callback activation", () => {
  const current = fixture(`function* values(callback: () => void): Generator<number, void, unknown> { yield 1; callback(); }
    function start(): Generator<number, void, unknown> {
      const text = "kept"; function child(): void { void text; } return values(child);
    } const iterator = start();`);
  const selected = current.select("child");
  assert.equal(selected.kind === "resolved", true, selected.reason ?? selected.kind);
  assert.equal(selected.premises[0]?.kind, "retained", "the generator's actual deferred input frame outlives the source factory");
});
