import assert from "node:assert/strict";
import test from "node:test";
import { isDeepStrictEqual } from "node:util";
import { createCompilerSessionFromFiles, createSourceSemanticsExtension, sourcePrimitive, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../target-source-program.js";
import { createSourceTypeFlowAnalysisContext } from "./defaults.js";
import { sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure } from "./terms.js";
import { sourceTypeFlowDiscardedSelection } from "./value-syntax.js";

function fixture(text: string, noImplicitAny = true) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/node_modules/@test/words/package.json": JSON.stringify({ name: "@test/words", version: "1.0.0", type: "module", exports: { ".": "./index.d.ts" } }),
    "/src/node_modules/@test/words/index.d.ts": "export type int32 = number; export type float32 = number;",
    "/src/index.ts": `import type { int32, float32 } from "@test/words"; ${text}`,
  }, compilerOptions: { strict: true, noImplicitAny, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: [{ moduleSpecifier: "@test/words", packageName: "@test/words",
    exports: [sourcePrimitive("int32", "int32", "number", true, 32), sourcePrimitive("float32", "float32", "number", true, 32)] }] })] } }).checkSource();
  assert.equal(checked.diagnostics.length, 0);
  const source = createTargetSourceProgram(checked);
  const defaults = createSourceTypeFlowAnalysisContext(source);
  const declaration = (name: string): Node => {
    const selected = defaults.nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === name);
    if (selected === undefined) throw new Error(`The original declaration ${name} is required.`);
    return selected;
  };
  return { source, defaults, declaration };
}


test("C2446 narrowed callable reads retain their original authored branch without retargeting union storage", () => {
  const current = fixture(`function run(values: int32[]): void {
    const mapper: ((value: int32) => int32) | string = (value: int32): int32 => value;
    const alias = mapper; const second = alias; const mapped = values.map(alias);
    void mapper; void alias; void second; void mapped;
  }`);
  const { ast } = current.source;
  const declaration = current.declaration("mapper");
  const stored = current.source.effectiveTypes.get(declaration);
  assert.equal(stored !== undefined && stored.kind !== "refused" && stored.type.kind === "union" &&
    stored.type.types.length === 2, true, "the original declaration keeps its complete authored storage union");
  const reads = current.defaults.values.filter(node => ast.is.IsIdentifier(node) &&
    current.source.facts.navigation.sourceReferenceFor(node)?.declaration === declaration);
  assert.equal(reads.length, 2, "both actual mapper reads are retained");
  const alias = current.declaration("alias");
  const aliasReads = current.defaults.values.filter(node => ast.is.IsIdentifier(node) &&
    current.source.facts.navigation.sourceReferenceFor(node)?.declaration === alias);
  assert.equal(aliasReads.length, 3, "each original alias read, including the actual map argument, is retained");
  for (const node of [...reads, ...aliasReads, alias, current.declaration("second")]) {
    const described = current.defaults.context.describe(node);
    const outcome = current.source.effectiveTypes.get(node);
    const callable = described === undefined ? undefined : sourceTypeDescriptorStructure(described);
    const published = outcome === undefined || outcome.kind === "refused" ? undefined : sourceTypeDescriptorStructure(outcome.type);
    for (const selected of [callable, published]) {
      const signature = selected?.kind === "callable" ? selected.calls[0] : undefined;
      assert.equal(signature?.parameters[0]?.type.kind === "primitive" &&
        signature.parameters[0].type.primitive === "int32" && signature.result.kind === "primitive" &&
        signature.result.primitive === "int32" && signature.declaration !== undefined &&
        ast.is.IsFunctionTypeNode(signature.declaration), true,
      "the selected original callable syntax, parameter width and result width survive each alias/read");
    }
  }
  assert.equal(current.source.facts.refusals().length, 0);
});

test("C2446 union occurrence projection preserves subsets and refuses to guess erased numeric branches", () => {
  const current = fixture(`function run(value: int32 | float32 | string, input: ((value: int32) => int32) | string,
    partial: ((value: int32) => int32) | string | undefined): void {
    const unchanged = input;
    if (typeof input !== "string") { const callable = input; void callable; }
    if (typeof value !== "string") { const numeric = value; void numeric; }
    if (typeof partial !== "string") { const optional = partial; void optional; }
    void unchanged;
  }`);
  const unchanged = current.defaults.context.describe(current.declaration("unchanged"));
  assert.equal(unchanged?.kind === "union" && unchanged.types.length === 2, true,
    "an unrefined callable|string occurrence retains both original branches");
  const numeric = current.defaults.context.describe(current.declaration("numeric"));
  assert.equal(numeric?.kind === "union" && numeric.types.some(type => type.kind === "primitive" && type.primitive === "int32") &&
    numeric.types.some(type => type.kind === "primitive" && type.primitive === "float32") &&
    numeric.types.length === 3 && numeric.types.some(type => type.kind === "string"), true,
  "equal erased numeric backing types never choose a native width");
  const optional = current.defaults.context.describe(current.declaration("optional"));
  const present = optional === undefined ? undefined : sourceTypeDescriptorStructure(optional);
  const value = present?.kind === "optional" ? sourceTypeDescriptorStructure(present.value) : undefined;
  assert.equal(value?.kind === "callable" && value.calls[0]?.parameters[0]?.type.kind === "primitive" &&
    value.calls[0].parameters[0].type.primitive === "int32" && value.calls[0].result.kind === "primitive" &&
    value.calls[0].result.primitive === "int32", true,
  "a checked callable-and-absence subset retains its original callable and one absence state");
  const outcome = current.source.effectiveTypes.get(current.declaration("optional"));
  const published = outcome === undefined || outcome.kind === "refused" ? undefined : sourceTypeDescriptorStructure(outcome.type);
  const publishedValue = published?.kind === "optional" ? sourceTypeDescriptorStructure(published.value) : undefined;
  assert.equal(publishedValue?.kind === "callable" && value?.kind === "callable" &&
    sourceTypeDescriptorsEqual(publishedValue, value) && publishedValue.calls[0]?.declaration === value.calls[0]?.declaration, true,
    "the same optional subset, original callable and native widths reach the canonical value publication");
  const partial = current.defaults.nodes.find(node => current.source.ast.is.IsParameterDeclaration(node) &&
    current.source.ast.text(current.source.ast.name(node)) === "partial");
  const storage = partial === undefined ? undefined : current.source.effectiveTypes.get(partial);
  const stored = storage === undefined || storage.kind === "refused" ? undefined : sourceTypeDescriptorStructure(storage.type);
  const storedValue = stored?.kind === "optional" ? sourceTypeDescriptorStructure(stored.value) : undefined;
  assert.equal(storedValue?.kind === "union" && storedValue.types.length === 2 &&
    storedValue.types.some(member => member.kind === "string") && storedValue.types.some(member => member.kind === "callable"), true,
  "the original parameter remains absence-capable storage with both authored present branches");
});



test("an unresolved foreign conditional alias is not an identity-only nominal cut", () => {
  const current = fixture(`interface Local { read<Value>(value: Value): Awaited<Value>; }
    declare const local: Local;
    export function run(): void { const alias = local; void alias; const count: int32 = 1; void count; }`);
  assert.equal(current.defaults.context.describe(current.declaration("local")) === undefined, true,
    "an open conditional has no nominal identity and makes its project declaration inexpressible");
  const read = current.defaults.values.find(node => current.source.ast.is.IsIdentifier(node) && current.source.ast.text(node) === "local");
  const outcome = read === undefined ? undefined : current.source.effectiveTypes.get(read);
  assert.equal(outcome?.kind === "refused" && outcome.site === read && outcome.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED", true,
    "the original local read owns its one precise Source refusal");
  assert.equal(current.source.facts.refusals().filter(issue => issue.site === read).length, 1);
  const count = current.source.effectiveTypes.get(current.declaration("count"));
  assert.equal(count !== undefined && count.kind !== "refused" && count.type.kind === "primitive" && count.type.primitive === "int32", true,
    "an expressible sibling is independent of the unresolved alias");
});

test("a present object construction retains canonical member correspondence into nullable storage", () => {
  const current = fixture(`interface Row { user: int32; system?: int32; }
    function run(other: Row): void { let value: Row | null | undefined = { user: 1 }; value = other; void value; }`);
  const { ast } = current.source;
  const literal = current.defaults.nodes.find(node => ast.is.IsObjectLiteralExpression(node));
  const property = literal === undefined ? undefined : ast.properties(literal)[0];
  const outcome = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
  const storage = current.source.effectiveTypes.get(current.declaration("value"));
  assert.equal(storage !== undefined && storage.kind !== "refused" && storage.type.kind === "optional", true,
    "the declaration retains its exact absence-capable storage");
  assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "declared" &&
    outcome.memberCorrespondence?.length === 1 && outcome.memberCorrespondence[0]?.property === property, true,
    "the present literal selects its one actual authored property");
  if (outcome === undefined || outcome.kind === "refused") throw new Error("The present literal publication is required.");
  const structure = sourceTypeDescriptorStructure(outcome.type);
  const user = structure.kind === "shape" ? structure.members.find(member => member.name === "user") : undefined;
  assert.equal(user !== undefined && outcome.memberCorrespondence?.[0]?.origin === user.origin, true,
    "the correspondence retains the identical member origin of the published present contract");
  assert.equal(current.source.facts.refusals().length, 0);
});









test("an inferred call result preserves an unavailable body's original Source refusal", () => {
  const current = fixture(`interface Local { read<Value>(value: Value): Awaited<Value>; }
    declare const local: Local;
    function read() { return local; }
    const result = read(); void result;`);
  const { ast } = current.source;
  const call = current.defaults.nodes.find(node => ast.is.IsCallExpression(node) &&
    ast.text(ast.as.AsCallExpression(node)?.Expression) === "read");
  const returned = current.defaults.nodes.find(node => ast.is.IsReturnStatement(node));
  const value = returned === undefined ? undefined : ast.as.AsReturnStatement(returned)?.Expression;
  const outcome = call === undefined ? undefined : current.source.effectiveTypes.get(call);
  assert.equal(value !== undefined && outcome?.kind === "refused" && outcome.site === value &&
    outcome.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED", true,
    "an unrepresented body never re-enters a checked return-type reconstruction");
  assert.equal(call !== undefined && current.source.effectiveTypes.callInstantiation(call)?.result === undefined, true);
});



test("discarded selections leave the result-publication domain without dropping their operands", () => {
  const current = fixture(`function run(flag: boolean, optional?: () => number): number {
    flag && (() => 1); flag || (() => 2); optional ?? (() => 3); flag ? (() => 4) : (() => 5);
    const selected = flag && true; return selected ? 1 : 0;
  }`);
  const selections = current.defaults.nodes.filter(node => sourceTypeFlowDiscardedSelection(current.source, node));
  assert.equal(selections.length, 4, "only the three discarded logical forms and discarded conditional are excluded");
  for (const selection of selections) {
    assert.equal(current.defaults.values.includes(selection), false, "an effect selection publishes no result");
    const condition = current.source.ast.is.IsConditionalExpression(selection)
      ? current.source.ast.as.AsConditionalExpression(selection)?.Condition
      : current.source.ast.as.AsBinaryExpression(selection)?.Left;
    assert.equal(condition !== undefined && current.defaults.values.includes(condition), true,
      "the actual condition or presence operand remains in its own value domain");
  }
  const initializer = current.source.ast.as.AsVariableDeclaration(current.declaration("selected"))?.Initializer;
  assert.equal(initializer !== undefined && !sourceTypeFlowDiscardedSelection(current.source, initializer) &&
    current.defaults.values.includes(initializer), true, "a consumed logical expression still requires a Source result");
});

test("direct callable values retain their instantiated owner bindings without a property receiver", () => {
  for (const primitive of ["float32", "int32"] as const) {
    const current = fixture(`interface Transform<Value> { (value: Value): Value; }
      function apply(callback: Transform<${primitive}>, value: ${primitive}): ${primitive} {
        const selected = callback(value); return selected;
      }`);
    const descriptor = current.defaults.context.describe(current.declaration("selected"));
    assert.equal(descriptor?.kind === "primitive" && descriptor.primitive === primitive, true,
      `${primitive}: the callable's authored argument owns its formal result`);
    const initializer = current.source.ast.as.AsVariableDeclaration(current.declaration("selected"))?.Initializer;
    if (initializer === undefined) throw new Error("The original checked call is required.");
    const call = current.source.semantics.forNode(initializer).operations.call(initializer);
    assert.equal(call !== undefined && call.sourceReceiver === undefined, true,
      "this is the direct callable binding path, not a property receiver");
    assert.equal(current.source.facts.refusals().length, 0);
  }
});

test("literal defaults select checked member symbols only from their own retained element tuple", () => {
  const current = fixture(`function run() {
    const selected = { value: 1, "quoted-value": true, 7: { width: 2 } }; return selected;
  }`);
  const descriptor = current.defaults.context.describe(current.declaration("selected"));
  assert.equal(descriptor?.kind === "shape" && descriptor.members.length === 3, true);
  if (descriptor?.kind !== "shape") throw new Error("The complete literal shape is required.");
  const literal = current.source.ast.as.AsVariableDeclaration(current.declaration("selected"))?.Initializer;
  if (literal === undefined) throw new Error("The original object literal is required.");
  const properties = current.source.ast.properties(literal);
  const queries = current.source.semantics.forNode(literal);
  for (const [index, member] of descriptor.members.entries()) {
    const property = properties[index];
    if (property === undefined) throw new Error("The original member declaration is required.");
    const element = queries.operations.objectLiteralElement(property);
    const checked = element === undefined ? undefined : queries.types.propertyInfos(element.objectLiteralType)
      .find(selected => selected.symbol === element.sourceElementSymbol);
    assert.equal(checked !== undefined && checked.name === member.name && member.origin.kind === "declared" &&
      member.origin.declaration === property, true, `member ${index}: one checked tuple and original declaration`);
  }
  const integer = descriptor.members[0]?.type;
  const boolean = descriptor.members[1]?.type;
  const nested = descriptor.members[2]?.type;
  assert.equal(integer?.kind === "primitive" && integer.primitive === "int64", true);
  assert.equal(boolean?.kind === "primitive" && boolean.primitive === "bool", true);
  assert.equal(nested?.kind === "shape" && nested.members[0]?.type.kind === "primitive" &&
    nested.members[0].type.primitive === "int64", true);
});




test("an unannotated self-dependent callable has one precise return-annotation refusal", () => {
  const current = fixture("function recursive() { return recursive; }", false);
  const returned = current.defaults.nodes.find(node => current.source.ast.is.IsReturnStatement(node));
  const value = returned === undefined ? undefined : current.source.ast.as.AsReturnStatement(returned)?.Expression;
  const issues = current.source.facts.refusals();
  assert.equal(issues.length, 1);
  assert.equal(value !== undefined && issues[0]?.site === value && issues[0]?.code === "TSONIC_LOCAL_TYPE_SIGNATURE" &&
    issues[0].reason === "This unannotated callable return depends on itself. Annotate the return type.", true);
  assert.equal(value !== undefined && current.source.effectiveTypes.get(value) === issues[0], true,
    "the actual return expression carries the same canonical first cause");
});





test("a required component overrides the occurrence's literal default", () => {
  const current = fixture("declare const required: number[]; export const literal = [1];");
  const declaration = current.declaration("required");
  const queries = current.source.semantics.forNode(declaration);
  const selectedType = queries.declarations.declaredValueType(declaration);
  if (selectedType === undefined) throw new Error("The checked required type is required.");
  const value = current.defaults.context.describe(current.declaration("literal"), { selectedType, declaration,
    authoredTypeNode: current.source.ast.typeNode(declaration) });
  assertSameValue(value, { kind: "array", readonly: false, element: { kind: "primitive", primitive: "float64" } });
});

test("excluded annotations and tuple aliases retain the included consumer's query", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/node_modules/@test/words/package.json": JSON.stringify({ name: "@test/words", version: "1.0.0", type: "module", exports: { ".": "./index.d.ts" } }),
    "/src/node_modules/@test/words/index.d.ts": "export type int32 = number; export type float32 = number;",
    "/src/index.ts": 'import { data } from "./native.js"; function run(): void { const retained = data; const pair = data.pair; }',
    "/src/native.ts": 'import type { int32, float32 } from "@test/words"; export type Pair = readonly [int32, float32]; export declare const data: { value: int32; pair: Pair };',
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: [{ moduleSpecifier: "@test/words", packageName: "@test/words",
    exports: [sourcePrimitive("int32", "int32", "number", true, 32), sourcePrimitive("float32", "float32", "number", true, 32)] }] })] } }).checkSource();
  assert.equal(checked.diagnostics.length, 0);
  const consumer = checked.getSourceFile("/src/index.ts");
  const native = checked.getSourceFile("/src/native.ts");
  if (consumer === undefined || native === undefined) throw new Error("The exact checked files are required.");
  const source = createTargetSourceProgram({ ...checked, sourceFiles: Object.freeze([consumer]), getSourceFileQueries(file) {
    assert.equal(file === consumer, true, "foreign metadata keeps the original consumer query");
    return checked.getSourceFileQueries(file);
  } });
  const defaults = createSourceTypeFlowAnalysisContext(source);
  const retained = defaults.nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "retained");
  const pair = defaults.nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "pair");
  if (retained === undefined || pair === undefined) throw new Error("The included declarations are required.");
  const type = defaults.context.describe(retained);
  assert.equal(type?.kind === "shape", true);
  if (type?.kind !== "shape") throw new Error("The exact checked structural type is required.");
  assertSameValue(type.members.find(member => member.name === "value")?.type, { kind: "primitive", primitive: "int32" });
  assertSameValue(defaults.context.describe(pair), { kind: "tuple", readonly: true,
    elements: [{ kind: "required", type: { kind: "primitive", primitive: "int32" } },
      { kind: "required", type: { kind: "primitive", primitive: "float32" } }] });
  assert.equal(source.semantics.includes(native), false);
  assert.equal(source.sourceFiles.length, 1);
  assert.equal(type.members.every(member => member.origin.kind === "declared" &&
    source.ast.getSourceFile(member.origin.declaration) === native), true);
});






test("declared definitions have one canonical member and signature inventory", () => {
  const current = fixture(`interface Factory { readonly prototype: object; new(): object; }
    interface CallableObject { readonly tag: string; (value: int32): int32; }
    declare const factory: Factory; declare const callableObject: CallableObject;
    declare const callback: (value: int32) => int32; declare const constructor: new() => object;
    declare const empty: {};`);
  for (const [name, members, calls, constructs] of [["factory", 1, 0, 1], ["callableObject", 1, 1, 0]] as const) {
    const type = current.defaults.context.describe(current.declaration(name));
    assert.equal(type?.kind === "declared" && type.definition?.kind === "shape", true, name);
    if (type?.kind !== "declared" || type.definition?.kind !== "shape") throw new Error("The complete declared definition is required.");
    assert.equal(type.definition.members.length, members, name);
    assert.equal(type.definition.indexes.length, 0, name);
    assert.equal(type.definition.calls.length, calls, name);
    assert.equal(type.definition.constructs.length, constructs, name);
    assert.equal(type.definition.members.every(member => member.origin.kind === "declared"), true, name);
    assert.equal("members" in type || "indexes" in type, false, "nominal references have no duplicate structural inventory");
  }
  for (const [name, calls, constructs] of [["callback", 1, 0], ["constructor", 0, 1]] as const) {
    const type = current.defaults.context.describe(current.declaration(name));
    assert.equal(type?.kind === "callable" && type.calls.length === calls && type.constructs.length === constructs, true, name);
  }
  const empty = current.defaults.context.describe(current.declaration("empty"));
  assert.equal(empty?.kind === "shape" && empty.members.length === 0 && empty.indexes.length === 0 &&
    empty.calls.length === 0 && empty.constructs.length === 0, true, "an empty structure is a shape, never a signature-only callable");
});

test("nominal definitions retain all structure once and cut recursive references by declaration and arguments", () => {
  const current = fixture(`interface Link<Value> { value: Value; next?: Link<Value>; }
    interface Empty {} declare const retained: Link<int32>; declare const empty: Empty;`);
  const type = current.defaults.context.describe(current.declaration("retained"));
  const empty = current.defaults.context.describe(current.declaration("empty"));
  assert.equal(type?.kind === "declared" && type.definition?.kind === "shape", true);
  if (type?.kind !== "declared" || type.definition?.kind !== "shape") throw new Error("The complete nominal structure is required.");
  assert.equal("members" in type || "indexes" in type, false, "a nominal reference never duplicates its definition's structure");
  assert.equal(type.typeArguments[0]?.kind === "primitive" && type.typeArguments[0].primitive === "int32", true);
  const value = type.definition.members.find(member => member.name === "value");
  assert.equal(value?.type.kind === "primitive" && value.type.primitive === "int32", true);
  const next = type.definition.members.find(member => member.name === "next");
  assert.equal(next?.optional === true && next.type.kind === "optional" && next.type.value.kind === "declared", true);
  if (next?.type.kind !== "optional" || next.type.value.kind !== "declared") throw new Error("The actual recursive reference is required.");
  assert.equal(next.type.value.declaration === type.declaration && next.type.value.definition === undefined, true);
  assertSameValue(next.type.value.typeArguments, type.typeArguments);
  assert.equal(empty?.kind === "declared" && empty.definition?.kind === "shape" &&
    empty.definition.members.length === 0 && empty.definition.indexes.length === 0, true,
    "an empty definition remains distinguishable from a recursive reference");
});

test("K-2446 an overloaded member merged across declarations is identified by its symbol's first declaration", () => {
  const current = fixture(`interface Merged { run(value: int32): int32; run(value: string): string; }
    interface Merged { run(value: boolean): boolean; }
    declare const merged: Merged;`);
  const { ast } = current.source;
  const type = current.defaults.context.describe(current.declaration("merged"));
  const structure = type?.kind === "declared" ? type.definition : type;
  assert.equal(structure?.kind === "shape", true);
  if (structure?.kind !== "shape") return;
  const member = structure.members.find(candidate => candidate.name === "run");
  const first = current.defaults.nodes.find(node => ast.is.IsMethodSignatureDeclaration(node) && ast.text(ast.name(node)) === "run");
  assert.equal(member?.origin.kind === "declared" && member.origin.declaration === first, true,
    "one checked logical member keeps the first entry of its own checker declaration vector");
});

test("K-2446 an intersection of distinct same-named members has no single declared origin and is not described", () => {
  const current = fixture(`declare const both: { a: int32 } & { a: string };`);
  assert.equal(current.defaults.context.describe(current.declaration("both")), undefined,
    "several root symbols are not one logical member; no root is chosen");
});
