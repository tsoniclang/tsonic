import assert from "node:assert/strict";
import test from "node:test";
import { createSourceTypeFlowTestProgram } from "./type-flow-test-program.js";
import { createSourceHostInput } from "../../host-input/index.js";
import {
  createCompilerSessionFromFiles, createSourceSemanticsExtension, formatDiagnostics,
  sourcePrimitive, type Node, type SourceFile,
} from "@tsonic/tsts";
import { createSourceTypeFlowAnalysisContext } from "./defaults.js";
import { collectSourceTypeFlowEdges, sourceTypeFlowObjectLiteralReceiver } from "./edges.js";
import { createSourceTypeDescriptorUnions, createSourceTypeFlowTerms, sourceTypeDescriptorStructure } from "./terms.js";
import { sourceTypeFlowDiscardedValue } from "./value-syntax.js";
import type { SourceTypeFlowNode, SourceTypeFlowVariable } from "./types.js";

function lastPath(variable: SourceTypeFlowVariable) { return variable.path[variable.path.length - 1]; }

function fixture(program: string, excludedFiles: Readonly<Record<string, string>> = {}) {
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
      ...excludedFiles,
    },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
    extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: [{
      moduleSpecifier: "@test/native/types.js", packageName: "@test/native", subpath: "types.js",
      exports: [sourcePrimitive("word", "int32", "number", true, 32)],
    }] })] },
  }).checkSource();
  assert.equal(formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined), "/src"), "");
  assert.equal(checked.extensionDiagnostics.length, 0);
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true, "the checked program has its exact source file");
  const source = createSourceTypeFlowTestProgram(Object.keys(excludedFiles).length === 0 ? checked : {
    ...checked, sourceFiles: Object.freeze([file!]),
    getSourceFileQueries(sourceFile: SourceFile | undefined) {
      assert.equal(sourceFile === file, true, "excluded declarations retain the included checked consumer query context");
      return checked.getSourceFileQueries(sourceFile);
    },
  });
  const context = createSourceTypeFlowAnalysisContext(source, createSourceTypeDescriptorUnions(checked.ast, checked.programSourceFiles), createSourceHostInput(source)).context;
  const graph = collectSourceTypeFlowEdges(context);
  const terms = createSourceTypeFlowTerms(source.ast, graph);
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
  return { checked, file: file!, source, context, graph, terms, syntax, text, node, entry, variable, same, declaration };
}

test("for-of scalar and destructured heads retain the same principal element producer", () => {
  const current = fixture(`function run(values: word[], tuples: [word, word][], objects: { field: word }[]): void {
    for (const value of values) void value;
    for (const [left, right] of tuples) { void left; void right; }
    for (const { field } of objects) void field;
  }`);
  const ast = current.source.ast;
  const loops = current.syntax.filter(node => ast.is.IsForOfStatement(node));
  assert.equal(loops.length, 3);
  for (const loop of loops) {
    const iteration = ast.as.AsForInOrOfStatement(loop)!;
    const head = ast.as.AsVariableDeclarationList(iteration.Initializer!)?.Declarations?.Nodes[0];
    assert.equal(head !== undefined, true, "one exact loop declaration");
    const principal = current.entry(head!);
    assert.equal(principal.publish && principal.variable.node === head, true, "all head forms publish their principal declaration");
    assert.equal(current.graph.links.some(link => link.site === loop &&
      lastPath(link.source)?.kind === "element" && current.same(link.target, principal.variable)), true,
    "the principal comes from the retained iterable element, not a checked read");
    const name = ast.name(head!);
    if (name === undefined || ast.is.IsIdentifier(name)) continue;
    for (const element of ast.elements(name)) {
      if (element === undefined) continue;
      const binding = current.entry(element);
      assert.equal(current.graph.links.some(link => link.site === loop && link.source.node === head &&
        link.source.path.length === principal.variable.path.length + 1 && current.same(link.target, binding.variable)), true,
      "destructured bindings project the same principal declaration");
    }
  }
  assert.equal(current.graph.refusals.length, 0);
});

test("excluded declaration owners retain the included consumer query context", () => {
  const current = fixture(`import { Native } from "./native.js";
    export function read(value: Native): number { return value.field; }`, {
    "/src/native.ts": "export class Native { field: number = 7; }",
  });
  const native = current.checked.getSourceFile("/src/native.ts")!;
  const declaration = current.source.ast.statements(native).find(node => node !== undefined && current.source.ast.is.IsClassDeclaration(node))!;
  const checker = current.checked.getSourceFileQueries(current.file).checker;
  const expected = checker.getSymbolAtLocation(current.source.ast.name(declaration));
  assert.equal(expected !== undefined, true);
  const semantics = current.source.semantics.forFile(current.file);
  assert.equal(semantics.declarations.declaredValueType(declaration) === checker.getTypeOfSymbol(expected), true);
  assert.equal(semantics.declarations.declaredType(declaration) === checker.getDeclaredTypeOfSymbol(expected), true);
  assert.equal(current.source.sourceFiles.length, 1);
  assert.equal(current.source.sourceFiles[0] === current.file, true);
  assert.equal(current.source.semantics.includes(native), false);
  assert.equal(current.source.navigation.isProjectDeclaration(declaration), false);
  assert.equal(current.graph.roots.includes(native), false);
  assert.equal(current.graph.nodes.every(entry => current.source.ast.getSourceFile(entry.node) === current.file), true);
  assert.equal(current.graph.refusals.length, 0);
});

test("foreign generic formals keep the caller queries and exact selected binder associations", () => {
  const current = fixture(`import { Native } from "./native.js";
    function run(receiver: Native<word>) {
      const constructor = Native;
      const seed = [1];
      const result = receiver.apply(2, seed, (value, index) => seed);
      const pairs = new PairStore([[1, "value"]]);
      return result;
    }`, {
    "/src/native.ts": `import type { word } from "@test/native/types.js";
      export class Native<T> {
        apply<U extends { readonly length: word }>(value: T, seed: U, callback: (value: T, index: word) => U): U {
          return callback(value, 0 as word);
        }
      }`,
  });
  const native = current.checked.getSourceFile("/src/native.ts")!;
  const selected = current.graph.calls.find(call => current.text(call.node).startsWith("receiver.apply("));
  assert.equal(selected?.receiver.length, 1);
  assert.equal(selected?.method.length, 1);
  assert.equal(selected?.argumentPlaces.length, 2);
  assert.equal(selected !== undefined && selected.receiver[0]!.declaration !== selected.method[0]!.declaration, true);
  assert.equal(selected !== undefined && current.source.ast.getSourceFile(selected.receiver[0]!.declaration) === native, true);
  assert.equal(selected !== undefined && current.source.ast.getSourceFile(selected.method[0]!.declaration) === native, true);
  assert.equal(selected?.method[0]?.constraint !== undefined, true);
  assert.equal(selected !== undefined && selected.argumentPlaces.every(place =>
    selected.source.sourceArgumentBindings.includes(place.binding) && selected.source.sourceSelectedSignatureParameters.includes(place.parameter)), true);
  assert.equal(selected !== undefined && !current.same(selected.argumentPlaces[0]!.value, selected.receiver[0]!.variable), true);
  assert.equal(selected !== undefined && current.same(selected.argumentPlaces[1]!.value, selected.method[0]!.variable), true);
  const index = current.graph.nodes.find(entry => entry.kind === "parameter" && current.source.ast.text(current.source.ast.name(entry.node)) === "index");
  assert.equal(index?.term?.kind === "fixed" && index.term.type.kind === "primitive" && index.term.type.primitive === "int32", true);
  const pair = current.graph.calls.find(call => current.source.ast.is.IsNewExpression(call.node));
  assert.equal(pair?.method.length, 2);
  assert.equal(pair?.argumentPlaces.length, 2);
  const constructor = current.graph.nodes.find(entry => entry.node === current.declaration("constructor"));
  assert.equal(constructor?.kind, "fixed");
  assert.equal(current.graph.roots.includes(native), false);
  assert.equal(current.graph.nodes.every(entry => current.source.ast.getSourceFile(entry.node) === current.file), true);
  assert.equal(current.graph.refusals.length, 0);
});

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

test("computed and numeric binding paths consume the exact completed Source property names", () => {
  const current = fixture(`function run() {
    const values = { 16: 1, 0: 2, name: 3 }; const key = "name";
    const { 0x10: numbered, [-0]: zero, [key]: named } = values;
    return numbered;
  }`);
  for (const [name, expected] of [["numbered", "16"], ["zero", "0"], ["named", "name"]]) {
    const binding = current.syntax.find(node => current.source.ast.is.IsBindingElement(node) &&
      current.source.ast.text(current.source.ast.name(node)) === name);
    assert.equal(binding !== undefined, true);
    const property = current.source.ast.as.AsBindingElement(binding!)?.PropertyName;
    const selection = property === undefined ? undefined : current.source.semantics.forNode(binding!).propertyNames.get(property);
    assert.equal(selection?.kind === "resolved" && selection.name === expected, true);
    const link = current.graph.links.find(link => link.target === current.variable(binding!));
    const part = link === undefined ? undefined : lastPath(link.source);
    assert.equal(part?.kind === "member" && part.name === expected, true);
  }
  assert.equal(current.graph.refusals.length, 0);
});

test("rejected computed binding keys preserve the Source selection without guessed member links", () => {
  const current = fixture(`function run() {
    const key = 9007199254740993; const values = { [key]: 1, 16: 2 };
    const { [key]: first, 0x10: second } = values; return second;
  }`);
  const binding = current.syntax.find(node => current.source.ast.is.IsBindingElement(node) &&
    current.source.ast.text(current.source.ast.name(node)) === "first");
  assert.equal(binding !== undefined, true);
  const property = current.source.ast.as.AsBindingElement(binding!)?.PropertyName;
  const selection = property === undefined ? undefined : current.source.semantics.forNode(binding!).propertyNames.get(property);
  assert.equal(selection?.kind, "rejected");
  assert.equal(current.graph.refusals.some(refusal => refusal.site === binding && refusal.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED"), true);
  assert.equal(current.graph.links.some(link => link.target.node === binding), false);
});

test("type-syntax literal tokens never become runtime value publications", () => {
  const current = fixture(`declare function hasOne(value: unknown): value is { count: 1; extra: boolean };
    type Shape = { count: 2 }; interface Contract { count: 3 }
    function run(value: 4): number { const actual = 5; return actual; }`);
  const typeLiterals = current.syntax.filter(node => current.source.ast.is.IsNumericLiteral(node) &&
    current.source.ast.is.IsLiteralTypeNode(current.source.ast.parent(node)));
  assert.equal(typeLiterals.length, 4);
  assert.equal(typeLiterals.every(node => current.context.literal(node) !== undefined), true,
    "the shared literal reader retains syntax evidence without declaring it a runtime value");
  assert.equal(typeLiterals.every(node => !current.graph.nodes.some(entry => entry.node === node)), true);
  const actual = current.node("5", node => current.source.ast.is.IsNumericLiteral(node));
  assert.equal(current.graph.nodes.some(entry => entry.node === actual && entry.publish), true);
  assert.equal(current.graph.refusals.length, 0);
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
  assert.equal(current.graph.derived.some(operation => operation.node === expression), true);
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

test("inline callback construction positions are internal while their parameter and return groups publish", () => {
  const current = fixture(`function run() {
    const values = [1, 2];
    const mapped = values.map(value => value * 2);
    const total = values.reduce((sum, value) => sum + value, 0);
    return mapped;
  }`);
  const calls = current.graph.calls.filter(call => current.text(call.node).startsWith("values."));
  assert.equal(calls.length, 2);
  for (const call of calls) {
    const callback = call.source.sourceArguments.find(argument => current.source.ast.is.IsArrowFunction(argument.expression))?.expression;
    assert.equal(callback !== undefined, true);
    const construction = current.graph.nodes.find(entry => entry.node === callback && entry.variable.path.length === 0);
    assert.equal(construction !== undefined, true);
    assert.equal(construction?.publish, true, "the callback construction position publishes its callable value (option A, C-2226)");
    assert.equal(construction?.term === undefined, true);
    for (const parameter of current.source.ast.parameters(callback!)) {
      assert.equal(parameter !== undefined && current.graph.nodes.some(entry => entry.node === parameter && entry.publish), true);
    }
    const returned = current.source.ast.body(callback!);
    assert.equal(returned !== undefined && current.graph.nodes.some(entry => entry.node === returned && entry.publish), true);
    assert.equal(call.source === current.source.semantics.forNode(call.node).operations.call(call.node), true);
  }
  assert.equal(current.graph.refusals.length, 0);
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
  assert.equal(current.graph.nodes.some(entry => entry.node === access && entry.publish), true,
    "the fixed length read is in the publication domain with its declared metadata type (option A, C-2226)");
});

test("aliases of ordinary fixed metadata remain outside the effective publication domain", () => {
  const current = fixture(`function run() { const values = [1]; const count = values.length; const alias = count; return alias; }`);
  for (const name of ["count", "alias"]) {
    const declaration = current.declaration(name);
    const entry = current.graph.nodes.find(candidate => candidate.node === declaration);
    assert.equal(entry?.kind, "fixed");
    assert.equal(entry?.publish, true, name);
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

test("annotated patterns retain fixed destination slots without retyping their physical initializer", () => {
  const current = fixture(`class View { value: word = 7; }
    function run(): number {
      const { value }: { value: number } = new View();
      const { a }: { a: number } = { a: 1 };
      const [first, second]: [number, number] = [2, 3];
      const { maybe }: { maybe?: number } = { maybe: 4 };
      return value + a + first + second + (maybe ?? 0);
    }`);
  const bindings = current.syntax.filter(node => current.source.ast.is.IsBindingElement(node));
  assert.equal(bindings.length, 5);
  for (const binding of bindings) {
    const entry = current.graph.nodes.find(entry => entry.node === binding);
    assert.equal(entry?.kind, "fixed");
    const type = entry?.term?.kind === "fixed" ? entry.term.type : undefined;
    const value = type?.kind === "optional" ? type.value : type;
    assert.equal(value?.kind === "primitive" && value.primitive === "float64", true);
    assert.equal(current.graph.links.some(link => link.source.node === binding || link.target.node === binding), false);
  }
  const initializer = current.node("new View()", node => current.source.ast.is.IsNewExpression(node));
  const entry = current.graph.nodes.find(entry => entry.node === initializer);
  assert.equal(entry?.term?.kind === "fixed" && entry.term.type.kind === "declared", true);
  const array = current.node("[2, 3]", node => current.source.ast.is.IsArrayLiteralExpression(node));
  assert.equal(current.graph.nodes.find(entry => entry.node === array)?.term?.kind, "array");
  assert.equal(current.graph.nodes.some(entry => entry.kind === "open-local"), false);
  assert.equal(current.graph.refusals.length, 0);
});

test("declared defaults, nested patterns and rest retain their original checked slots and effects", () => {
  const current = fixture(`function fallback(): word { return 5; }
    function run(input: { child?: word; nested: { value: word }; left: number; right: number }) {
      const { child = fallback(), nested: { value: renamed }, ...rest }:
        { child?: word; nested: { value: word }; left: number; right: number } = input;
      const [first, ...tail]: word[] = [1, 2, 3];
      return renamed;
    }`);
  for (const name of ["child", "renamed", "first"]) {
    const binding = current.syntax.find(node => current.source.ast.is.IsBindingElement(node) &&
      current.source.ast.is.IsIdentifier(current.source.ast.name(node)) &&
      current.source.ast.text(current.source.ast.name(node)) === name);
    const entry = current.graph.nodes.find(entry => entry.node === binding);
    assert.equal(entry?.kind, "fixed", name);
    assert.equal(entry?.term?.kind === "fixed" && entry.term.type.kind === "primitive" && entry.term.type.primitive === "int32", true, name);
    assert.equal(current.graph.links.some(link => link.target.node === binding), false, name);
  }
  const tail = current.syntax.find(node => current.source.ast.is.IsBindingElement(node) &&
    current.source.ast.is.IsIdentifier(current.source.ast.name(node)) &&
    current.source.ast.text(current.source.ast.name(node)) === "tail");
  const tailEntry = current.graph.nodes.find(entry => entry.node === tail);
  assert.equal(tailEntry?.term?.kind === "fixed" && tailEntry.term.type.kind === "array" &&
    tailEntry.term.type.element.kind === "primitive" && tailEntry.term.type.element.primitive === "int32", true);
  const rest = current.syntax.find(node => current.source.ast.is.IsBindingElement(node) &&
    current.source.ast.is.IsIdentifier(current.source.ast.name(node)) &&
    current.source.ast.text(current.source.ast.name(node)) === "rest");
  const restEntry = current.graph.nodes.find(entry => entry.node === rest);
  assert.equal(restEntry?.term?.kind === "fixed" && restEntry.term.type.kind === "shape" &&
    restEntry.term.type.members.map(member => member.name).join(",") === "left,right", true);
  const call = current.node("fallback()", node => current.source.ast.is.IsCallExpression(node));
  assert.equal(current.graph.nodes.some(entry => entry.node === call), true, "the actual default expression is still visited");
  assert.equal(current.graph.nodes.some(entry => entry.kind === "open-local"), false);
  assert.equal(current.graph.refusals.length, 0);
});

test("unannotated patterns over declared values keep declared widths without creating inference links", () => {
  const current = fixture(`function run(input: { value: word }) { const { value } = input; return value; }`);
  const binding = current.syntax.find(node => current.source.ast.is.IsBindingElement(node));
  const entry = current.graph.nodes.find(entry => entry.node === binding);
  assert.equal(entry?.kind, "fixed");
  assert.equal(entry?.term?.kind === "fixed" && entry.term.type.kind === "primitive" && entry.term.type.primitive === "int32", true);
  assert.equal(current.graph.links.some(link => link.source.node === binding || link.target.node === binding), false);
  assert.equal(current.graph.nodes.some(entry => entry.kind === "open-local"), false);
  assert.equal(current.graph.refusals.length, 0);
});

test("annotated parameter patterns retain fixed source facts in their reads", () => {
  const current = fixture(`function run({ value, other = 1 }: { value: word; other?: number }) { return value; }`);
  const binding = current.syntax.find(node => current.source.ast.is.IsBindingElement(node) &&
    current.source.ast.text(current.source.ast.name(node)) === "value");
  const entry = current.graph.nodes.find(entry => entry.node === binding);
  assert.equal(entry?.kind, "fixed");
  assert.equal(entry?.term?.kind === "fixed" && entry.term.type.kind === "primitive" && entry.term.type.primitive === "int32", true);
  const returned = current.syntax.find(node => current.source.ast.is.IsReturnStatement(node));
  const read = returned === undefined ? undefined : current.source.ast.as.AsReturnStatement(returned)?.Expression;
  const readEntry = current.graph.nodes.find(entry => entry.node === read);
  assert.equal(readEntry?.kind, "fixed");
  assert.equal(readEntry?.term?.kind === "fixed" && readEntry.term.type.kind === "primitive" && readEntry.term.type.primitive === "int32", true);
  assert.equal(current.graph.nodes.some(entry => entry.kind === "open-local"), false);
  assert.equal(current.graph.refusals.length, 0);
});

test("never-open module and var patterns keep the Host literal defaults without becoming local groups", () => {
  const current = fixture(`const { value } = { value: 1 };
    function run() { var [first] = [2]; return value + first; }`);
  for (const binding of current.syntax.filter(node => current.source.ast.is.IsBindingElement(node))) {
    const entry = current.graph.nodes.find(entry => entry.node === binding);
    assert.equal(entry?.kind, "fixed");
    assert.equal(entry?.term?.kind === "fixed" && entry.term.type.kind === "primitive" && entry.term.type.primitive === "int64", true);
  }
  assert.equal(current.graph.nodes.some(entry => entry.kind === "open-local"), false);
  assert.equal(current.graph.refusals.length, 0);
});

test("unexpressible declared unions never acquire empty published reference groups", () => {
  const current = fixture(`type Tree = number | readonly Tree[];
    function run(value: Tree): Tree { const alias: Tree = value; return alias; }`);
  const alias = current.declaration("alias");
  // Since C-2263 alias identity the recursive alias is expressible: the declared alias and its reads are fixed declared
  // facts in the publication domain (C-2226), still with no open group, no empty reference group and no refusal.
  const declared = (node: Node): boolean => current.graph.nodes.some(entry => entry.node === node && entry.publish &&
    entry.kind === "fixed" && entry.term?.kind === "fixed" && entry.term.type.kind === "declared");
  assert.equal(declared(alias), true);
  const reads = current.syntax.filter(node => current.source.ast.is.IsIdentifier(node) &&
    (current.text(node) === "value" || current.text(node) === "alias") &&
    current.source.ast.name(current.source.ast.parent(node)!) !== node);
  assert.equal(reads.length, 2);
  for (const reference of reads) assert.equal(declared(reference), true);
  assert.equal(current.graph.nodes.some(entry => entry.kind === "open-local"), false);
  assert.equal(current.graph.refusals.length, 0);
});

test("a new local container still supplies the open seed when its elements are declared values", () => {
  const current = fixture(`function run(value: word) { const values = [value, 1]; return values; }`);
  const declaration = current.declaration("values");
  assert.equal(current.entry(declaration).kind, "open-local");
  const literal = current.node("[value, 1]", node => current.source.ast.is.IsArrayLiteralExpression(node));
  assert.equal(current.entry(literal).term?.kind, "array");
  const parameter = current.syntax.find(node => current.source.ast.is.IsParameterDeclaration(node));
  const entry = current.graph.nodes.find(entry => entry.node === parameter);
  assert.equal(entry?.term?.kind === "fixed" && entry.term.type.kind === "primitive" && entry.term.type.primitive === "int32", true);
  assert.equal(current.same(current.variable(literal), current.variable(declaration)), true);
  assert.equal(current.graph.links.some(link => link.source.node === parameter || link.target.node === parameter), false);
  assert.equal(current.graph.refusals.length, 0);
});

test("LM literal data stay linked while methods and both accessor forms retain fixed declared members", () => {
  const current = fixture(`function run() {
    const value = { count: 1, read(input: word): word { return this.count + input; },
      get current(): word { return this.count; }, set current(next: word) { this.count = next; },
      set writeOnly(next: word) { this.count = next; } };
    return value;
  }`);
  const { ast } = current.source;
  const literal = current.syntax.find(node => ast.is.IsObjectLiteralExpression(node));
  assert.equal(literal !== undefined, true);
  if (literal === undefined) throw new Error("The actual literal is required.");
  const shape = current.entry(literal).term;
  assert.equal(shape?.kind === "shape", true);
  if (shape?.kind !== "shape") throw new Error("The literal retains a linked shape, not one fixed checker type.");
  assert.equal(shape.members.length, 4);
  const data = shape.members.find(member => member.name === "count");
  const numeric = current.syntax.find(node => ast.is.IsNumericLiteral(node));
  assert.equal(data !== undefined && numeric !== undefined && current.same(data.variable, current.variable(numeric)), true);
  for (const member of shape.members.filter(member => member !== data)) {
    const retained = current.graph.nodes.find(record => record.variable === member.variable)?.term;
    assert.equal(retained?.kind === "fixed", true, `${member.name}: one fixed member signature`);
    if (retained?.kind !== "fixed") throw new Error("The declared member term is required.");
    if (member.name === "read") {
      assert.equal(retained.type.kind === "callable" && retained.type.calls[0]?.declaration === member.declaration, true);
    } else {
      assert.equal(retained.type.kind === "primitive" && retained.type.primitive === "int32", true, member.name);
    }
  }
  const getter = ast.properties(literal).find(node => node !== undefined && ast.is.IsGetAccessorDeclaration(node));
  assert.equal(shape.members.find(member => member.name === "current")?.declaration === getter, true);
  const receivers = current.syntax.filter(node => sourceTypeFlowObjectLiteralReceiver(ast, node) === literal);
  assert.equal(receivers.length, 4);
  for (const receiver of receivers) {
    const record = current.entry(receiver);
    assert.equal(record.kind === "read" && record.term === undefined, true);
    assert.equal(record.root !== current.entry(literal).root, true);
    assert.equal(current.same(record.variable, current.variable(literal)), false);
  }
  for (const link of current.graph.links) {
    const first = current.graph.nodes.find(record => record.node === link.source.node);
    const second = current.graph.nodes.find(record => record.node === link.target.node);
    assert.equal(first !== undefined && second !== undefined && first.root === second.root, true,
      "LM never links a method or accessor root to its literal root");
  }
  assert.equal(current.graph.refusals.length, 0);
});

test("LM lexical arrows keep the literal receiver while ordinary functions and class methods keep their own this", () => {
  const current = fixture(`function run() { const value = { count: 1, read(): word {
    const capture = () => this.count;
    function separate(this: { count: number }): number { return this.count; }
    class Other { count = 2; read(): number { return this.count; } }
    void separate; void Other; return capture();
  } }; return value; }`);
  const { ast } = current.source;
  const literal = current.syntax.find(node => ast.is.IsObjectLiteralExpression(node));
  const receivers = current.syntax.filter(node => ast.kindName(node) === "KindThisKeyword");
  assert.equal(receivers.length, 3);
  const captured = receivers.filter(node => sourceTypeFlowObjectLiteralReceiver(ast, node) === literal);
  assert.equal(captured.length, 1);
  const root = captured[0] === undefined ? undefined : current.entry(captured[0]).root;
  assert.equal(root !== undefined && ast.is.IsArrowFunction(root), true);
  assert.equal(receivers.filter(node => sourceTypeFlowObjectLiteralReceiver(ast, node) === undefined).length, 2);
  assert.equal(current.graph.refusals.some(issue => issue.code === "TSONIC_LOCAL_TYPE_SELF_REFERENCE"), false);
});

test("C2330 object members resolve only against their retained element tuple inventory", () => {
  const current = fixture(`function run() { const value = { count: 1, read(next: word): word { return this.count + next; },
    get current(): word { return this.count; }, set current(next: word) { this.count = next; },
    set writeOnly(next: word) { this.count = next; } }; return value; }`);
  const { ast } = current.source;
  const literal = current.syntax.find(node => ast.is.IsObjectLiteralExpression(node));
  if (literal === undefined) throw new Error("The actual literal is required.");
  const shape = current.entry(literal).term;
  if (shape?.kind !== "shape") throw new Error("The linked literal shape is required.");
  for (const property of ast.properties(literal)) {
    if (property === undefined) throw new Error("The original member is required.");
    const query = current.source.semantics.forNode(property);
    const element = query.operations.objectLiteralElement(property);
    assert.equal(element?.objectLiteral === literal && element.element === property && element.sourceElementSymbol !== undefined, true);
    if (element === undefined) throw new Error("The checked member tuple is required.");
    const selected = query.types.propertyInfos(element.objectLiteralType).find(member => member.symbol === element.sourceElementSymbol);
    assert.equal(selected !== undefined && shape.members.some(member => member.name === selected.name), true,
      `member ${ast.pos(property)} belongs to the same checked tuple inventory`);
  }
  assert.equal(shape.members.length, 4);
  assert.equal(current.graph.refusals.length, 0);
});

test("C2330 a missing operation operand publishes one graph refusal without a partial term or derived record", () => {
  const current = fixture("function run() { const outer = 1; const saved = () => outer + 1; return saved; }");
  const expression = current.node("outer + 1", node => current.source.ast.is.IsBinaryExpression(node));
  const reference = current.source.ast.as.AsBinaryExpression(expression)?.Left;
  assert.equal(current.graph.refusals.length === 1 && current.graph.refusals[0]?.site === reference &&
    current.graph.refusals[0]!.code === "TSONIC_LOCAL_TYPE_SELF_REFERENCE" &&
    current.graph.refusals[0]!.related === current.declaration("outer"), true);
  assert.equal(current.graph.nodes.some(record => record.node === expression), false);
  assert.equal(current.graph.derived.some(operation => operation.node === expression), false);
});

test("C2332 discarded selections retain operand effects without creating a result graph record", () => {
  const current = fixture(`declare function effect(): word;
    function run(flag: boolean, optional: (() => word) | undefined): void {
      flag && effect(); flag || effect(); optional ?? effect(); flag ? effect() : effect();
    }`);
  const { ast } = current.source;
  const selections = current.syntax.filter(node => ast.is.IsConditionalExpression(node) || ast.is.IsBinaryExpression(node));
  assert.equal(selections.length, 4);
  for (const node of selections) {
    assert.equal(current.graph.nodes.some(record => record.node === node), false);
    assert.equal(current.graph.derived.some(derived => derived.node === node), false);
  }
  const effects = current.syntax.filter(node => ast.is.IsCallExpression(node));
  assert.equal(effects.length, 5);
  assert.equal(effects.every(node => current.graph.nodes.some(record => record.node === node)), true);
  assert.equal(current.graph.refusals.length, 0);
});

test("C2330 direct nominal callables retain the enclosing binder from the actual callee", () => {
  const current = fixture(`interface Transform<Value> { (value: Value): Value; }
    function run(callback: Transform<word>, value: word): word { return callback(value); }`);
  const call = current.graph.calls.find(call => current.text(call.node) === "callback(value)");
  assert.equal(call !== undefined && call.receiver.length === 1 && call.method.length === 0, true);
  const receiver = call?.receiver[0];
  const parameter = current.syntax.find(node => current.source.ast.is.IsTypeParameterDeclaration(node));
  assert.equal(receiver?.declaration === parameter, true);
  assert.equal(receiver !== undefined && current.graph.nodes.some(node => current.same(node.variable, receiver.variable) &&
    node.term?.kind === "fixed" && node.term.type.kind === "primitive" && node.term.type.primitive === "int32"), true);
  assert.equal(current.graph.refusals.length, 0);
});

test("C2330 a generic recursive alias joins matching declared arguments without choosing a union arm", () => {
  const current = fixture(`type Tree<Value> = Value | readonly Tree<Value>[];
    function keep<Value>(tree: Tree<Value>): Tree<Value> { return tree; }
    function run(tree: Tree<word>): Tree<word> { return keep<word>(tree); }`);
  const call = current.graph.calls.find(call => current.text(call.node) === "keep<word>(tree)");
  assert.equal(call !== undefined && call.method.length === 1, true);
  const alias = current.syntax.find(node => current.source.ast.is.IsTypeAliasDeclaration(node));
  const result = call === undefined ? undefined : current.graph.nodes.find(node => node.node === call.node);
  assert.equal(result?.term?.kind === "declared" && result.term.declaration === alias && result.term.typeArguments.length === 1, true);
  assert.equal(current.graph.refusals.length, 0);
});

test("C2337 heterogeneous assignment-pattern RHS reads all checked tuple elements before deciding whether to link them", () => {
  const current = fixture(`function run(): void { let first: string | number; [first] = ["marker", -1, 2]; void first; }`);
  const { ast } = current.source;
  const literal = current.syntax.find(node => ast.is.IsArrayLiteralExpression(node) &&
    ast.elements(node)[0] !== undefined && ast.is.IsStringLiteral(ast.elements(node)[0]));
  if (literal === undefined) throw new Error("The actual assignment RHS is required.");
  const selected = current.source.semantics.forNode(literal).types.expressionType(literal);
  assert.equal(selected !== undefined && current.source.semantics.forNode(literal).types.isTuple(selected), true);
  const term = current.entry(literal).term;
  assert.equal(term?.kind === "fixed" && term.type.kind === "tuple" && term.type.elements.length === 3, true);
  assert.equal(current.graph.refusals.length, 0);
});

test("C2342 discarded selector wrappers retain their dependencies without a reconstructed result record", () => {
  const current = fixture(`function run(flag: boolean): void {
    ((flag ? (() => 1) : undefined)) ?? (() => 2);
    const retained = (1 + 2); void retained;
  }`);
  const { ast } = current.source;
  const wrappers = current.syntax.filter(node => ast.is.IsParenthesizedExpression(node) &&
    sourceTypeFlowDiscardedValue(current.source, node));
  assert.equal(wrappers.length > 0, true);
  assert.equal(wrappers.every(node => !current.graph.nodes.some(record => record.node === node) &&
    !current.graph.derived.some(record => record.node === node)), true);
  const condition = current.syntax.find(node => ast.is.IsConditionalExpression(node));
  const flag = condition === undefined ? undefined : ast.as.AsConditionalExpression(condition)?.Condition;
  assert.equal(flag !== undefined && current.graph.nodes.some(record => record.node === flag), true);
  const retained = current.syntax.find(node => ast.is.IsParenthesizedExpression(node) && current.text(node) === "(1 + 2)");
  assert.equal(retained !== undefined && current.graph.nodes.some(record => record.node === retained), true);
  assert.equal(current.graph.refusals.length, 0);
});

test("C2351 structural array formal positions retain the exact constructor binder in either union order", () => {
  const forms = ["Choice[]", "readonly Choice[]", "Elements<Choice>"].flatMap((array, index) => [
    { name: `forward_${index}`, formal: `${array} | Readable<Choice>` },
    { name: `reverse_${index}`, formal: `Readable<Choice> | ${array}` },
  ]).concat([{ name: "alias_forward", formal: "Input<Choice>" }, { name: "alias_reverse", formal: "Reversed<Choice>" }]);
  const current = fixture(`interface Readable<Element> { read(): Element; }
    interface Published<Element> { readonly value: Element; }
    type Elements<Element> = readonly Element[];
    type Input<Element> = readonly Element[] | Readable<Element>;
    type Reversed<Element> = Readable<Element> | readonly Element[];
    ${forms.map(form => `declare const factory_${form.name}: {
      new<Choice>(values?: ${form.formal}): Published<Choice>;
    };`).join("\n")}
    function run(value: word): void { const input = [value];
      ${forms.map(form => `const selected_${form.name} = new factory_${form.name}(input); void selected_${form.name};`).join("\n")}
    }`);
  const { ast } = current.source;
  const input = current.entry(current.declaration("input")).term;
  assert.equal(input?.kind === "array", true);
  if (input?.kind !== "array") throw new Error("The retained array element position is required.");
  const calls = current.graph.calls.filter(call => ast.is.IsNewExpression(call.node));
  assert.equal(calls.length, forms.length);
  for (const call of calls) {
    const parameter = call.source.sourceSelectedSignatureParameters[0];
    const declaration = parameter?.parameterDeclaration;
    const original = ast.typeNode(declaration);
    const place = call.argumentPlaces[0];
    const binder = call.method[0];
    assert.equal(parameter !== undefined && declaration !== undefined && original !== undefined && parameter.authoredTypeNode === original &&
      binder !== undefined && call.method.length === 1 && ast.parent(binder.declaration) === ast.parent(declaration), true,
    "the exact selected parameter and constructor binder come from the same original signature");
    assert.equal(call.argumentPlaces.length === 1 && place !== undefined && place.parameter === parameter &&
      place.binding === call.source.sourceArgumentBindings[0] && place.binder === binder?.declaration &&
      current.same(place.value, input.element) && binder !== undefined && current.same(place.value, binder.variable), true,
    "formal array element unification retains the original binding without a checked-width fill");
    const retained = binder === undefined ? [] : current.terms.group(binder.variable).terms.filter(term => term.kind === "fixed");
    assert.equal(retained.length > 0 && retained.every(term => term.type.kind === "primitive" && term.type.primitive === "int32"), true,
      "the original declared argument width is retained; checked number never seeds a foreign float64 binder");
  }
  assert.equal(current.graph.refusals.length, 0);
});

test("C2351 array formal unification never chooses through a free, broad or competing aggregate arm", () => {
  const forms = [
    { name: "free", formal: "Choice | Choice[]", refused: true },
    { name: "alias_free", formal: "Identity<Choice> | Choice[]", refused: true },
    { name: "broad", formal: "object | Choice[]", refused: true },
    { name: "empty", formal: "{} | Choice[]", refused: true },
    { name: "arrays", formal: "Choice[] | readonly Choice[]", refused: true },
    { name: "tuple", formal: "readonly [Choice] | Choice[]", refused: true },
    { name: "unknown", formal: "unknown | Choice[]", refused: false },
    { name: "any", formal: "any | Choice[]", refused: false },
    { name: "numeric_arrays", formal: "number[] | string[]", refused: false },
  ];
  const current = fixture(`interface Published<Element> { readonly value: Element; }
    type Identity<Element> = Element;
    ${forms.map(form => `declare const factory_${form.name}: {
      new<Choice>(values: ${form.formal}): Published<Choice>;
    };`).join("\n")}
    function run(value: word): void {
      ${forms.map(form => `const input_${form.name} = [value];
        const selected_${form.name} = new factory_${form.name}(input_${form.name}); void selected_${form.name};`).join("\n")}
    }`);
  for (const form of forms) {
    const call = current.graph.calls.find(call => current.text(call.node) === `new factory_${form.name}(input_${form.name})`);
    assert.equal(call !== undefined && call.argumentPlaces.length === 0, true, form.name);
    if (form.refused) assert.equal(current.graph.refusals.some(refusal => refusal.code === "TSONIC_LOCAL_TYPE_GENERIC" &&
      current.text(refusal.site) === `input_${form.name}`), true, form.name);
  }
});

test("C2357 annotated array positions join the original selected formal without a literal-site requirement", () => {
  const inputs = [
    { name: "mutable", annotation: "word[]", readonly: false },
    { name: "readonly", annotation: "readonly word[]", readonly: true },
    { name: "alias", annotation: "Words", readonly: true },
    { name: "union", annotation: "(word | number)[]", readonly: false },
  ];
  const formals = ["Choice[] | Readable<Choice>", "Readable<Choice> | readonly Choice[]", "Input<Choice>"];
  const current = fixture(`interface Readable<Element> { read(): Element; }
    interface Published<Element> { readonly value: Element; }
    type Words = readonly word[];
    type Input<Element> = readonly Element[] | Readable<Element>;
    ${formals.map((formal, index) => `declare const factory_${index}: {
      new<Choice>(values?: ${formal}): Published<Choice>;
    };`).join("\n")}
    function run(value: word): void {
      ${inputs.map(input => `const input_${input.name}: ${input.annotation} = [value];
        ${formals.flatMap((_, index) => input.readonly && index === 0 ? [] : [`const selected_${input.name}_${index} = new factory_${index}(input_${input.name});
          void selected_${input.name}_${index};`]).join("\n")}`).join("\n")}
    }`);
  const { ast } = current.source;
  const calls = current.graph.calls.filter(call => ast.is.IsNewExpression(call.node));
  assert.equal(calls.length, 10);
  for (const input of inputs) {
    const term = current.entry(current.declaration(`input_${input.name}`)).term;
    const descriptor = term?.kind === "fixed" ? sourceTypeDescriptorStructure(term.type) : undefined;
    assert.equal(descriptor?.kind === "array", true, input.name + ": existing declared array contract");
    if (descriptor?.kind !== "array") throw new Error("The original annotated array contract is required.");
    for (const index of formals.keys()) {
      if (input.readonly && index === 0) continue;
      const call = calls.find(candidate => current.text(candidate.node) === `new factory_${index}(input_${input.name})`);
      const parameter = call?.source.sourceSelectedSignatureParameters[0];
      const binder = call?.method[0];
      const place = call?.argumentPlaces[0];
      assert.equal(call !== undefined && call.argumentPlaces.length === 1 && parameter !== undefined && binder !== undefined &&
        place !== undefined && place.parameter === parameter && place.binding === call.source.sourceArgumentBindings[0] &&
        place.binder === binder.declaration && place.value.node === call.source.sourceArguments[0]?.expression &&
        lastPath(place.value)?.kind === "element" && current.same(place.value, binder.variable), true,
      input.name + ": exact selected parameter, binder and original element position");
      const retained = binder === undefined ? [] : current.terms.group(binder.variable).terms.filter(candidate => candidate.kind === "fixed");
      assert.equal(retained.some(candidate => candidate.type === descriptor.element), true,
        input.name + ": the same authored element object, never a checked number replacement");
    }
  }
  assert.equal(current.graph.refusals.length, 0);
});

test("C2357 fixed array inputs do not resolve free, broad or competing formal alternatives", () => {
  const forms = ["Choice | readonly Choice[]", "Identity<Choice> | readonly Choice[]", "object | readonly Choice[]", "{} | readonly Choice[]",
    "Choice[] | readonly Choice[]", "readonly [Choice] | readonly Choice[]", "readonly number[] | readonly string[]"];
  const current = fixture(`interface Published<Element> { readonly value: Element; }
    type Identity<Element> = Element;
    ${forms.map((formal, index) => `declare const factory_${index}: {
      new<Choice>(values: ${formal}): Published<Choice>;
    };`).join("\n")}
    function run(value: word): void { const mutable: word[] = [value]; const readonly: readonly word[] = [value];
      ${forms.map((_, index) => `const mutable_${index} = new factory_${index}(mutable);
        const readonly_${index} = new factory_${index}(readonly); void mutable_${index}; void readonly_${index};`).join("\n")}
    }`);
  const calls = current.graph.calls.filter(call => current.source.ast.is.IsNewExpression(call.node));
  assert.equal(calls.length, forms.length * 2);
  assert.equal(calls.every(call => call.argumentPlaces.length === 0), true,
    "an existing array value does not prove an ambiguous generic formal position");
});

test("C2424 local constructor results retain enclosing binder identities independently of call inputs", () => {
  const current = fixture(`function wrap<Outer>(first: Outer) {
    class Local<Inner> { first: Outer; value: Inner;
      constructor(first: Outer, value: Inner) { this.first = first; this.value = value; } }
    return new Local<word>(first, 1);
  }
  function run(first: word): void { const result = wrap(first); void result.value; }`);
  const { ast } = current.source;
  const wrapper = current.syntax.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === "wrap");
  const outer = wrapper === undefined ? undefined : ast.typeParameters(wrapper)[0];
  const construction = current.graph.calls.find(call => ast.is.IsNewExpression(call.node));
  const result = construction?.result;
  const term = result === undefined ? undefined : current.terms.group(result).terms.find(term => term.kind === "declared");
  assert.equal(outer !== undefined && term?.kind === "declared" && term.typeArguments.length === 2, true,
    "the original class result keeps both its enclosing and own argument positions");
  if (outer === undefined || term?.kind !== "declared") throw new Error("The retained local class template is required.");
  const original = current.terms.group(term.typeArguments[0]!).terms;
  assert.equal(original.length === 1 && original[0]?.kind === "fixed" && original[0].type.kind === "declared" &&
    original[0].type.declaration === outer && original[0].type.typeArguments.length === 0, true,
  "the enclosing formal is its original declaration reference, never a checked numeric argument");
  const invocation = current.graph.calls.find(call => current.text(call.node) === "wrap(first)");
  assert.equal(invocation?.method.length === 1 && invocation.method[0]?.declaration === outer && invocation.result !== undefined &&
    !current.same(invocation.method[0].variable, invocation.result), true,
  "the actual call input binder is independent of the retained result");
  assert.equal(current.graph.refusals.length, 0);
});
