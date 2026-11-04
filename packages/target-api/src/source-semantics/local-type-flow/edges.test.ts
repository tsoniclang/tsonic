import assert from "node:assert/strict";
import test from "node:test";
import {
  createCompilerSessionFromFiles, createSourceSemanticsExtension, formatDiagnostics,
  sourcePrimitive, type Node,
} from "@tsonic/tsts";
import { createTargetSourceProgram } from "../target-source-program.js";
import { createSourceTypeFlowAnalysisContext } from "./defaults.js";
import { collectSourceTypeFlowEdges } from "./edges.js";
import { createSourceTypeFlowTerms } from "./terms.js";
import type { SourceTypeFlowNode, SourceTypeFlowVariable } from "./types.js";

function lastPath(variable: SourceTypeFlowVariable) { return variable.path[variable.path.length - 1]; }

function fixture(program: string) {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: {
      "/src/node_modules/@test/native/package.json": JSON.stringify({
        name: "@test/native", version: "1.0.0", type: "module", exports: { "./types.js": "./types.d.ts" },
      }),
      "/src/node_modules/@test/native/types.d.ts": "export type word = number;",
      "/src/globals.d.ts": `
        import type { word } from "@test/native/types.js";
        declare global {
          interface Array<T> {
            transform<U>(mapper: (value: T, index: word, receiver: T[]) => U): U[];
            retain(predicate: (value: T, index: number) => boolean): T[];
            accumulate<U>(callback: (previous: U, current: T, index: word) => U, seed: U): U;
            insert(...items: T[]): number;
            lookup(values: readonly T[]): boolean;
          }
          interface PairStore<K, V> { put(key: K, value: V): void; }
          interface Receiver<K, V> { inspect(pair: readonly [K, V]): void; }
          interface PairFactory {
            new<K, V>(entries: readonly (readonly [K, V])[]): PairStore<K, V>;
          }
          const PairStore: PairFactory;
        }
      `,
      "/src/index.ts": `import type { word } from "@test/native/types.js";\n${program}`,
    },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
    extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: [{
      moduleSpecifier: "@test/native/types.js", packageName: "@test/native", subpath: "types.js",
      exports: [sourcePrimitive("word", "int32", "number", true, 32)],
    }] })] },
  }).checkSource();
  assert.equal(formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined), "/src"), "");
  assert.equal(checked.extensionDiagnostics.length, 0);
  const source = createTargetSourceProgram(checked);
  const context = createSourceTypeFlowAnalysisContext(source).context;
  const graph = collectSourceTypeFlowEdges(context);
  const terms = createSourceTypeFlowTerms(graph);
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true, "the checked program has its exact source file");
  const syntax: Node[] = [];
  const pending: Node[] = [file!];
  while (pending.length !== 0) {
    const node = pending.pop()!;
    syntax.push(node);
    const children = source.ast.children(node);
    for (let index = children.length - 1; index >= 0; index--) {
      const child = children[index];
      if (child !== undefined) pending.push(child);
    }
  }
  function text(node: Node): string {
    const range = source.ast.authoredRange(node);
    const selected = source.ast.getSourceFile(node);
    return range.kind === "authored" && selected !== undefined
      ? source.ast.getSourceText(selected).slice(range.start, range.end) : source.ast.text(node);
  }
  function node(text_: string, predicate: (node: Node) => boolean = () => true): Node {
    const selected = syntax.filter(candidate => text(candidate) === text_ && predicate(candidate));
    assert.equal(selected.length, 1, `one exact syntax node: ${text_}`);
    return selected[0]!;
  }
  function entry(node: Node): SourceTypeFlowNode {
    const selected = graph.nodes.find(candidate => candidate.node === node && candidate.publish);
    assert.equal(selected !== undefined, true, `one published occurrence: ${text(node)}`);
    return selected!;
  }
  function variable(node: Node): SourceTypeFlowVariable { return entry(node).variable; }
  function same(left: SourceTypeFlowVariable, right: SourceTypeFlowVariable): boolean {
    return terms.group(left).variable === terms.group(right).variable;
  }
  function declaration(name: string): Node {
    const selected = syntax.filter(candidate => source.ast.is.IsVariableDeclaration(candidate) &&
      source.ast.text(source.ast.name(candidate)) === name);
    assert.equal(selected.length, 1, `one exact binding: ${name}`);
    return selected[0]!;
  }
  return { source, context, graph, terms, syntax, text, node, entry, variable, same, declaration };
}

test("declaration aliases and nested member reads keep the same structural variables", () => {
  const current = fixture(`function run() {
    const original = [{ count: 1 }]; const alias = original;
    const item = alias[0]; const count = item.count; return count;
  }`);
  const literal = current.node("1", node => current.source.ast.is.IsNumericLiteral(node));
  assert.equal(current.same(current.variable(literal), current.variable(current.declaration("count"))), true,
    "the member keeps its actual element/member position through both aliases");
  assert.equal(current.graph.refusals.length, 0);
  assert.equal(Object.isFrozen(current.graph) && Object.isFrozen(current.graph.links), true);
});

test("conditional and nullish initializers link values without treating conditions as values", () => {
  const current = fixture(`function run(flag: boolean) {
    const first = [1]; const second = [2];
    const selected = flag ? first : second; const copy = selected ?? second; return copy;
  }`);
  assert.equal(current.same(current.variable(current.declaration("first")), current.variable(current.declaration("second"))), true);
  assert.equal(current.same(current.variable(current.declaration("selected")), current.variable(current.declaration("copy"))), true);
  const flag = current.syntax.find(node => current.source.ast.is.IsParameterDeclaration(node));
  assert.equal(flag !== undefined && current.graph.links.some(link => link.source.node === flag || link.target.node === flag), false,
    "the conditional test contributes no equality");
});

test("writes and plain reassignment keep target paths but create no value equality", () => {
  const current = fixture(`function run() {
    const values = [1]; const record = { count: 2 }; let first = 3; const other = 4;
    values[0] = other; record.count = other; first = other; return first;
  }`);
  const target = current.node("values[0]", node => current.source.ast.is.IsElementAccessExpression(node));
  const member = current.node("record.count", node => current.source.ast.is.IsPropertyAccessExpression(node));
  assert.equal(lastPath(current.entry(target).variable)?.kind, "element");
  assert.equal(lastPath(current.entry(member).variable)?.kind, "member");
  assert.equal(current.same(current.variable(current.declaration("first")), current.variable(current.declaration("other"))), false);
  assert.equal(current.same(current.variable(target), current.variable(current.declaration("other"))), false);
  assert.equal(current.same(current.variable(member), current.variable(current.declaration("other"))), false);
});

test("iteration, destructuring, rest and spreads retain original element and member positions", () => {
  const current = fixture(`function run() {
    const values = [1, 2]; const [first, ...tail] = values; const copy = [...tail, first];
    const original = { count: first }; const { count } = original; const record = { ...original, extra: 3 };
    for (const value of copy) { consume(value); } return record.count + count;
  }
  function consume(value: number): void { void value; }`);
  const count = current.node("record.count", node => current.source.ast.is.IsPropertyAccessExpression(node));
  const original = current.node("1", node => current.source.ast.is.IsNumericLiteral(node));
  assert.equal(current.same(current.variable(original), current.variable(count)), true);
  const loop = current.syntax.find(node => current.source.ast.is.IsForOfStatement(node));
  assert.equal(loop !== undefined && current.graph.links.some(link => link.site === loop), true);
  assert.equal(current.graph.refusals.length, 0);
});

test("object spread overwrites keep only the final creation-time member", () => {
  const current = fixture(`function run() { const first = { value: 1 }; const copy = { ...first, value: 2 }; return copy.value; }`);
  const first = current.node("1", node => current.source.ast.is.IsNumericLiteral(node));
  const second = current.node("2", node => current.source.ast.is.IsNumericLiteral(node));
  const result = current.node("copy.value", node => current.source.ast.is.IsPropertyAccessExpression(node));
  assert.equal(current.same(current.variable(second), current.variable(result)), true);
  assert.equal(current.same(current.variable(first), current.variable(result)), false);
});

test("arithmetic records ordered dependencies and never propagates a use into operands", () => {
  const current = fixture(`function run() { const first = 1; const second = first * 2; take(second); return second; }
    function take(value: number): void { void value; }`);
  const arithmetic = current.node("first * 2", node => current.source.ast.is.IsBinaryExpression(node));
  const selected = current.graph.derived.find(operation => operation.node === arithmetic);
  assert.equal(selected?.operator, "multiply");
  assert.equal(selected?.required, true);
  assert.equal(selected?.operands.length, 2);
  assert.equal(current.same(current.variable(current.declaration("first")), current.variable(current.declaration("second"))), false);
  assert.equal(current.same(current.variable(arithmetic), current.variable(current.declaration("second"))), true);
});

test("integer folding keeps the actual literal receipt and excludes bigint leaves", () => {
  const current = fixture(`function run() { const folded = 8 / 2 + 1; const wide = 2n; return folded; }`);
  const expression = current.node("8 / 2 + 1", node => current.source.ast.is.IsBinaryExpression(node));
  const term = current.entry(expression).term;
  assert.equal(term?.kind, "numeric");
  assert.equal(term?.kind === "numeric" && term.literal.integerConstant === 5n, true);
  assert.equal(current.graph.derived.some(operation => operation.node === expression), false);
  const bigint = current.node("2n", node => current.source.ast.is.IsBigIntLiteral(node));
  assert.equal(current.graph.nodes.some(entry => entry.node === bigint && entry.kind === "open-local"), false);
});

test("receiver and method binders stay distinct and fresh for each pinned call", () => {
  const current = fixture(`function run() {
    const values = [1, 2]; const first = values.transform((value, index) => value * 2);
    const second = values.transform((value, index) => value + 0.5); return [first, second];
  }`);
  const calls = current.graph.calls.filter(call => current.text(call.node).includes(".transform("));
  assert.equal(calls.length, 2);
  assert.equal(calls.every(call => call.receiver.length === 1 && call.method.length === 1), true);
  assert.equal(calls.every(call => call.receiver[0]!.declaration !== call.method[0]!.declaration), true);
  assert.equal(calls[0]!.method[0]!.variable.node !== calls[1]!.method[0]!.variable.node, true,
    "the declaration is retained but never used as the per-call identity");
  assert.equal(current.same(calls[0]!.receiver[0]!.variable, calls[0]!.method[0]!.variable), false);
  assert.equal(calls.every(call => call.source === current.source.semantics.forNode(call.node).operations.call(call.node)), true);
});

test("callback widths come from their real source declarations rather than element binders", () => {
  const current = fixture(`function run(values: word[]) {
    const selected = values.transform((value, index) => value);
    const retained = values.retain((value, index) => index > 0); return selected;
  }`);
  const parameters = current.graph.nodes.filter(entry => entry.kind === "parameter" &&
    current.source.ast.text(current.source.ast.name(entry.node)) === "index");
  assert.equal(parameters.length, 2);
  assert.equal(parameters[0]?.term?.kind === "fixed" && parameters[0].term.type.kind === "primitive" && parameters[0].term.type.primitive === "int32", true);
  assert.equal(parameters[1]?.term?.kind === "fixed" && parameters[1].term.type.kind === "primitive" && parameters[1].term.type.primitive === "float64", true);
  assert.equal(parameters.every(parameter => parameter.association?.component?.declaration !== parameter.node), true,
    "the actual callback formal is retained, not the arrow's erased checker type");
  assert.equal(current.graph.refusals.length, 0);
});

test("all argument places of a generic binder join while actual binding associations survive", () => {
  const current = fixture(`function choose<T>(left: T[], right: T[]): T[] { return left; }
    function run() { const first = [1]; const second = [2]; const chosen = choose(first, second); return chosen; }`);
  const call = current.graph.calls.find(call => current.text(call.node) === "choose(first, second)");
  assert.equal(call !== undefined, true);
  assert.equal(call?.argumentPlaces.length, 2);
  assert.equal(call?.argumentPlaces.every(place => call.source.sourceArgumentBindings.includes(place.binding) &&
    call.source.sourceSelectedSignatureParameters.includes(place.parameter) && lastPath(place.value)?.kind === "element"), true);
  assert.equal(current.same(current.variable(current.declaration("first")), current.variable(current.declaration("second"))), false,
    "only the actual element inference places join, not whole array identities");
  assert.equal(call !== undefined && call.argumentPlaces.every(place => current.same(place.value, call.method[0]!.variable)), true);
});

test("C28 receiver-only arguments are writes regardless of the selected member's name", () => {
  const current = fixture(`function run() {
    const values: number[] = []; const inserted = 1; const candidates = [2];
    values.insert(inserted); values.lookup(candidates); return values;
  }`);
  const calls = current.graph.calls.filter(call => current.text(call.node).startsWith("values."));
  assert.equal(calls.length, 2);
  assert.equal(calls.every(call => call.argumentPlaces.length === 1 && call.method.length === 0 && call.receiver.length === 1), true);
  assert.equal(calls.every(call => call.argumentPlaces.every(place =>
    !current.same(place.value, call.receiver[0]!.variable))), true, "neither insertion nor lookup fills the receiver");
  assert.equal(calls.every(call => call.argumentPlaces[0]!.binder === call.receiver[0]!.declaration), true);
});

test("same-shaped free generic functions still join their declared method binder", () => {
  const current = fixture(`function insert<T>(value: T): T { return value; }
    function run() { const original = 1; const copied = insert(original); return copied; }`);
  const call = current.graph.calls.find(call => current.text(call.node) === "insert(original)");
  assert.equal(call?.receiver.length, 0);
  assert.equal(call?.method.length, 1);
  assert.equal(call !== undefined && current.same(call.argumentPlaces[0]!.value, call.method[0]!.variable), true);
});

test("B7 pairs retain separate declared K and V positions through the real constructor", () => {
  const current = fixture(`function run() { const selected = new PairStore([[1, "first"], [2, "second"]]); return selected; }`);
  const call = current.graph.calls.find(call => current.source.ast.is.IsNewExpression(call.node));
  assert.equal(call !== undefined, true);
  assert.equal(call?.method.length, 2);
  const pairs = current.graph.nodes.filter(entry => entry.term?.kind === "tuple");
  assert.equal(pairs.length >= 2, true);
  assert.equal(call?.argumentPlaces.length, 2);
  assert.equal(call !== undefined && !current.same(call.method[0]!.variable, call.method[1]!.variable), true);
  assert.equal(call?.argumentPlaces.every(place => place.value.path.some(part => part.kind === "tuple")), true);
});

test("accumulator dependency keeps its non-cyclic seed distinct from receiver elements", () => {
  const current = fixture(`function run() { const values = [1, 2]; const total = values.accumulate((sum, value) => sum + value, 0); return total; }`);
  const call = current.graph.calls.find(call => current.text(call.node).includes(".accumulate("));
  const operation = current.graph.derived.find(operation => operation.operator === "add");
  assert.equal(call !== undefined && operation?.accumulator !== undefined && current.same(operation.accumulator, call.method[0]!.variable), true);
  assert.equal(call !== undefined && !current.same(call.receiver[0]!.variable, call.method[0]!.variable), true);
  assert.equal(call?.argumentPlaces.length, 1, "the seed is the one non-callback argument inference place");
});

test("inline argument closures share a root while stored closures never acquire outer links", () => {
  const inline = fixture(`function run() { const values = [1]; return values.transform(value => value * 2); }`);
  const callable = inline.graph.calls.find(call => inline.text(call.node).includes(".transform("));
  const parameter = inline.graph.nodes.find(entry => entry.kind === "parameter");
  assert.equal(callable !== undefined && parameter !== undefined && inline.entry(callable.node).root === parameter.root, true);
  assert.equal(inline.graph.refusals.length, 0);
  const stored = fixture(`function run() { const values = [1]; const callback = () => values[0]; return callback; }`);
  assert.equal(stored.graph.refusals.some(refusal => refusal.code === "TSONIC_LOCAL_TYPE_SELF_REFERENCE"), true);
  assert.equal(stored.graph.links.every(link => {
    const first = stored.graph.nodes.find(entry => entry.node === link.source.node);
    const second = stored.graph.nodes.find(entry => entry.node === link.target.node);
    return first?.root === second?.root;
  }), true);
});

test("declared one-absence results keep their binder and open receiver unions are refused", () => {
  const fixed = fixture(`function run(values: word[]) { const selected = values.find(value => value > 0); return selected; }`);
  const call = fixed.graph.calls.find(call => fixed.text(call.node).includes(".find("));
  const result = call === undefined ? undefined : fixed.graph.nodes.find(entry => entry.node === call.node && entry.publish);
  assert.equal(result?.term?.kind, "optional");
  assert.equal(result?.term?.kind === "optional" && call !== undefined && fixed.same(result.term.value, call.receiver[0]!.variable), true);
  assert.equal(fixed.graph.refusals.some(refusal => refusal.code === "TSONIC_LOCAL_TYPE_UNION"), false);
  const open = fixture(`function run() { const values = [1, 2]; const selected = values.find(value => value > 0); return selected; }`);
  assert.equal(open.graph.refusals.some(refusal => refusal.code === "TSONIC_LOCAL_TYPE_UNION"), true);
});

test("narrowed declared optional terms read their exact underlying binder without rejoining absence", () => {
  const current = fixture(`function run(values: word[]) {
    const selected = values.find(value => value > 0);
    const before = selected;
    if (selected !== undefined) { const present = selected; return present; }
    return before;
  }`);
  const call = current.graph.calls.find(call => current.text(call.node).includes(".find("));
  const selected = current.variable(current.declaration("selected"));
  const before = current.variable(current.declaration("before"));
  const present = current.variable(current.declaration("present"));
  assert.equal(call !== undefined && current.same(present, call.receiver[0]!.variable), true);
  assert.equal(current.same(selected, before), true);
  assert.equal(current.same(selected, present), false, "narrowing projects the retained child, not the whole optional group");
  assert.equal(current.entry(current.declaration("present")).term?.kind, "fixed");
  assert.equal(current.graph.refusals.length, 0);
});

test("C28 nested pair arguments retain exact per-binder value paths without joins", () => {
  const current = fixture(`function run(receiver: Receiver<word, string>) { receiver.inspect([1, "value"]); }`);
  const call = current.graph.calls.find(call => current.text(call.node).startsWith("receiver.inspect("));
  assert.equal(call?.receiver.length, 2);
  assert.equal(call?.argumentPlaces.length, 2);
  assert.equal(call?.argumentPlaces.every((place, index) => {
    const part = lastPath(place.value);
    return part?.kind === "tuple" && part.index === index &&
      place.binder === call.receiver[index]!.declaration && !current.same(place.value, call.receiver[index]!.variable);
  }), true);
});

test("spread call bindings retain their original receipt while the value path uses the operand", () => {
  const current = fixture(`function run() { const values: number[] = []; const candidates = [1]; values.insert(...candidates); }`);
  const call = current.graph.calls.find(call => current.text(call.node).startsWith("values.insert("));
  const place = call?.argumentPlaces[0];
  assert.equal(place?.binding.sourceForm, "spread-sequence");
  assert.equal(place !== undefined && current.source.ast.is.IsSpreadElement(call!.source.sourceArguments[place.binding.sourceArgumentIndex]!.expression), true);
  assert.equal(place !== undefined && current.text(place.value.node) === "candidates", true);
  assert.equal(place !== undefined && lastPath(place.value)?.kind === "element", true);
  assert.equal(place !== undefined && !current.same(place.value, call!.receiver[0]!.variable), true);
});

test("declared source element widths survive ordinary fixed reads without generic calls", () => {
  const current = fixture(`function run(values: word[]) { const first = values[0]; return first; }`);
  const access = current.node("values[0]", node => current.source.ast.is.IsElementAccessExpression(node));
  const term = current.entry(access).term;
  assert.equal(term?.kind === "fixed" && term.type.kind === "primitive" && term.type.primitive === "int32", true);
  assert.equal(current.entry(access).kind, "fixed");
});

test("ordinary fixed array metadata is not published as an inferred group member", () => {
  const current = fixture(`function run() { const values = [1]; return values.length; }`);
  const access = current.node("values.length", node => current.source.ast.is.IsPropertyAccessExpression(node));
  assert.equal(current.graph.nodes.some(entry => entry.node === access && entry.publish), false,
    "a raw checker length type cannot replace an independently selected API result");
});

test("aliases of ordinary fixed metadata remain outside the effective publication domain", () => {
  const current = fixture(`function run() { const values = [1]; const count = values.length; const alias = count; return alias; }`);
  for (const name of ["count", "alias"]) {
    const declaration = current.declaration(name);
    const entry = current.graph.nodes.find(candidate => candidate.node === declaration);
    assert.equal(entry?.kind, "fixed");
    assert.equal(entry?.publish, false, name);
  }
  assert.equal(current.graph.refusals.length, 0);
});

test("independent receiver-call results stay fixed without losing their C28 argument places", () => {
  const current = fixture(`function run() { const values = [1]; const count = values.insert(2); return count; }`);
  const call = current.graph.calls.find(call => current.text(call.node) === "values.insert(2)");
  const result = call === undefined ? undefined : current.graph.nodes.find(candidate => candidate.node === call.node && candidate.variable.path.length === 0);
  assert.equal(call !== undefined, true);
  assert.equal(call?.result === undefined, true, "the declared number result has no receiver or method binder dependency");
  assert.equal(result?.kind, "fixed");
  assert.equal(result?.publish, false);
  assert.equal(call?.argumentPlaces.length, 1);
  assert.equal(call !== undefined && !current.same(call.argumentPlaces[0]!.value, call.receiver[0]!.variable), true);
  assert.equal(current.graph.nodes.some(entry => entry.node === current.declaration("count") && entry.publish), false);
});

test("explicit arguments join the actual declared binder without erasing authored width", () => {
  const current = fixture(`function identity<T>(value: T): T { return value; }
    function run() { const value = 1; const selected = identity<word>(value); return selected; }`);
  const call = current.graph.calls.find(call => current.text(call.node) === "identity<word>(value)");
  const explicit = call?.source.sourceSelectedMethodTypeArguments?.[0]?.explicitTypeNode;
  assert.equal(call !== undefined && explicit !== undefined, true);
  const term = current.graph.nodes.find(entry => entry.node === explicit)?.term;
  assert.equal(term?.kind === "fixed" && term.type.kind === "primitive" && term.type.primitive === "int32", true);
  assert.equal(call !== undefined && explicit !== undefined && current.same(current.variable(explicit), call.method[0]!.variable), true);
});

test("fixed declared captures remain fixed rather than being treated as open cross-root aliases", () => {
  const current = fixture(`function run(values: word[]) { const callback = () => values[0]; return callback; }`);
  assert.equal(current.graph.refusals.some(refusal => refusal.code === "TSONIC_LOCAL_TYPE_SELF_REFERENCE"), false);
  const access = current.node("values[0]", node => current.source.ast.is.IsElementAccessExpression(node));
  assert.equal(current.entry(access).term?.kind, "fixed");
});

test("term depth refuses deeper creation input without constructing an unbounded path", () => {
  const current = fixture(`function run() { const values = [[[[[[1]]]]]]; return values; }`);
  assert.equal(current.graph.refusals.some(refusal => refusal.code === "TSONIC_LOCAL_TYPE_LIMIT"), true);
});
