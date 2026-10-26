import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { Node_Initializer, Node_Type } from "../source-navigation/ast.js";
import { createTargetSourceProgram } from "./target-source-program.js";

function fixture(sourceText: string) {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": sourceText },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  }).checkSource();
  assert.equal(checked.diagnostics.length, 0,
    formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)).slice(0, 2048));
  assert.equal(checked.extensionDiagnostics.length, 0, "the actual source has no extension rejection");
  const file = checked.getSourceFile("/src/index.ts");
  if (file === undefined) throw new Error("The checked fixture source file is required.");
  const source = createTargetSourceProgram(checked);
  const queries = checked.getSourceFileQueries(file);
  const literals: Node[] = [];
  const declarations: Node[] = [];
  const visit = (node: Node): void => {
    if (source.ast.is.IsObjectLiteralExpression(node) || source.ast.is.IsArrayLiteralExpression(node)) literals.push(node);
    if (source.ast.is.IsVariableDeclaration(node) || source.ast.is.IsParameterDeclaration(node)) declarations.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  const literal = literals[0];
  if (literal === undefined) throw new Error("The checked fixture requires an actual object or array literal.");
  return { checked, file, source, queries, literals, literal, declarations };
}

const unannotated = [
  ["object", 'const { key } = { key: "value" };'],
  ["parenthesized object", 'const { key } = (({ key: "value" }));'],
  ["const-asserted object", 'const { key } = { key: "value" } as const;'],
  ["parenthesized const-asserted object", 'const { key } = ((({ key: "value" }) as const));'],
  ["angle const-asserted object", 'const { key } = <const>{ key: "value" };'],
  ["parenthesized angle const-asserted object", 'const { key } = ((<const>({ key: "value" })));'],
  ["array", 'const [key] = ["value"];'],
  ["parenthesized array", 'const [key] = ((["value"]));'],
  ["const-asserted array", 'const [key] = ["value"] as const;'],
  ["parenthesized const-asserted array", 'const [key] = (((["value"]) as const));'],
  ["angle const-asserted array", 'const [key] = <const>["value"];'],
  ["parenthesized angle const-asserted array", 'const [key] = ((<const>(["value"])));'],
  ["object parameter", 'export function read({ key } = ({ key: "value" } as const)): string { return key; }'],
  ["array parameter", 'export function read([key] = (["value"] as const)): string { return key; }'],
] as const;

for (const [name, initializer] of [
  ["direct", "const typed: Callback<number> = value => value;"],
  ["parenthesized", "const typed: Callback<number> = ((value => value));"],
  ["asserted", "const typed = ((value => value) as Callback<number>);"],
  ["satisfies", "const typed = ((value => value) satisfies Callback<number>);"],
] as const) test(`contextual ${name} callable retains its exact authored destination occurrence`, () => {
  const { source, declarations } = fixture(`type Callback<Input, Output = Input> = (value: Input) => Output;
    const sentinel = {}; ${initializer}`);
  const declaration = declarations.find(node => source.ast.text(source.ast.name(node)) === "typed");
  assert.equal(declaration !== undefined, true, "the typed initializer is an original checked declaration");
  const arrows: Node[] = [];
  const visit = (node: Node): void => {
    if (source.ast.is.IsArrowFunction(node)) arrows.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(declaration!);
  assert.equal(arrows.length, 1, "one actual contextual callable occurrence");
  const arrow = arrows[0]!;
  const semantics = source.semantics.forNode(arrow);
  const component = semantics.types.contextualType(arrow);
  assert.equal(component !== undefined && component.authoredTypeNode !== undefined, true,
    "context includes the actual native source occurrence, not only a checker Type");
  assert.equal(source.ast.text(component!.authoredTypeNode), "Callback<number>",
    "the exact authored alias and omitted default are retained");
  assert.equal(Node_Type(source.ast, component!.declaration) === component!.authoredTypeNode, true,
    "the source component retains its own real annotation owner");
  const selected = semantics.types.contextualValueSelection(arrow);
  assert.equal(selected.kind === "selected" && selected.component.authoredTypeNode === component!.authoredTypeNode, true,
    "raw and non-nullish contextual selection share the identical authored occurrence");
  assert.equal(selected.kind === "selected" && selected.component.selectedType === component!.selectedType, true,
    "the original checker identity is unchanged");
  if (name === "direct" || name === "parenthesized")
    assert.equal(component!.declaration === declaration, true, "parentheses do not invent an annotation owner");
});

test("contextual nested callables do not borrow an enclosing declaration's annotation", () => {
  const { source, declarations } = fixture("const sentinel = {}; const typed: () => () => number = () => () => 1;");
  const declaration = declarations.find(node => source.ast.text(source.ast.name(node)) === "typed");
  const outer = Node_Initializer(source.ast, declaration);
  assert.equal(outer !== undefined && source.ast.is.IsArrowFunction(outer), true, "the outer callable is exact");
  const inner = source.ast.as.AsArrowFunction(outer!)?.Body;
  assert.equal(inner !== undefined && source.ast.is.IsArrowFunction(inner), true, "the inner callable is a distinct source occurrence");
  const context = source.semantics.forNode(inner!).types.contextualType(inner!);
  assert.equal(context !== undefined, true, "the actual checked return context remains available");
  assert.equal(context!.authoredTypeNode, undefined, "an enclosing declaration is not the inner callable's direct annotation");
  assert.equal(context!.declaration, undefined, "no unrelated source owner is manufactured");
});

for (const [name, sourceText] of unannotated) {
  test(`unannotated ${name} keeps its actual initializer rather than a synthetic contextual destination`, () => {
    const { source, literal, declarations } = fixture(sourceText);
    const declaration = declarations[0];
    if (declaration === undefined) throw new Error("An actual binding owner is required.");
    const initializer = Node_Initializer(source.ast, declaration);
    const selection = source.semantics.forNode(literal).types.contextualValueSelection(literal);
    assert.equal(selection.kind, "unavailable", `${name}: the unannotated pattern is not an authored destination`);
    assert.equal(Node_Initializer(source.ast, declaration) === initializer, true,
      `${name}: contextual classification does not replace or erase its actual initializer`);
    assert.equal(initializer !== undefined, true, `${name}: the initializer remains present`);
  });
}

const authoredDestinations = [
  ["annotated object", 'const { key }: { readonly key: string } = { key: "value" } as const;'],
  ["annotated array", 'const [key]: readonly [string] = ["value"] as const;'],
  ["typed object assertion", 'const { key } = ({ key: "value" } as { key: string });'],
  ["typed array assertion", 'const [key] = (["value"] as [string]);'],
  ["angle typed object assertion", 'const { key } = <{ key: string }>{ key: "value" };'],
  ["angle typed array assertion", 'const [key] = <[string]>["value"];'],
  ["satisfies object", 'const { key } = ({ key: "value" } satisfies { key: string });'],
  ["satisfies array", 'const [key] = (["value"] satisfies [string]);'],
  ["annotated object parameter", 'export function read({ key }: { readonly key: string } = { key: "value" } as const): string { return key; }'],
  ["annotated array parameter", 'export function read([key]: readonly [string] = ["value"] as const): string { return key; }'],
] as const;

for (const [name, sourceText] of authoredDestinations) {
  test(`${name} retains its actual checked contextual destination`, () => {
    const { source, queries, literal } = fixture(sourceText);
    const contextual = queries.checker.getContextualType(literal);
    assert.equal(contextual !== undefined, true, `${name}: the real checker supplies the authored destination`);
    const selected = source.semantics.forNode(literal).types.contextualValueSelection(literal);
    assert.equal(selected.kind === "selected" && selected.component.selectedType === contextual, true,
      `${name}: const transparency cannot discard a real annotation or typed assertion`);
  });
}

test("unavailable contexts do not fabricate a destination", () => {
  const { source, queries, literal } = fixture('export const value = { key: "value" };');
  assert.equal(queries.checker.getContextualType(literal) === undefined, true, "the checked initializer has no authored contextual target");
  assert.equal(source.semantics.forNode(literal).types.contextualValueSelection(literal).kind, "unavailable",
    "the existing unavailable result is retained");
});

test("one non-nullish candidate retains its exact checked type identity", () => {
  const { source, queries, literal } = fixture(`
declare function consume(value: { key: string } | null | undefined): void;
consume({ key: "value" });
`);
  const contextual = queries.checker.getContextualType(literal);
  if (contextual === undefined) throw new Error("The nullable authored destination is required.");
  const candidates = queries.typeShape.isUnion(contextual)
    ? queries.typeShape.getUnionOrIntersectionTypes(contextual) : [contextual];
  const retained = candidates.filter(candidate => candidate !== undefined && !queries.typeShape.isNullish(candidate));
  const selected = source.semantics.forNode(literal).types.contextualValueSelection(literal);
  assert.equal(retained.length, 1, "the authored nullable union has exactly one native value candidate");
  assert.equal(selected.kind === "selected" && selected.component.selectedType === retained[0], true,
    "filtering source absence preserves the exact candidate, not a reconstructed object type");
});

test("multiple non-nullish candidates remain ambiguous with every checked identity", () => {
  const { source, queries, literal } = fixture(`
declare function consume(value: { key: string } | { key: number }): void;
consume({ key: "value" });
`);
  const contextual = queries.checker.getContextualType(literal);
  if (contextual === undefined) throw new Error("The ambiguous authored destination is required.");
  const candidates = queries.typeShape.getUnionOrIntersectionTypes(contextual);
  const selected = source.semantics.forNode(literal).types.contextualValueSelection(literal);
  assert.equal(selected.kind === "ambiguous" && selected.types.length === 2, true,
    "two genuine contextual destinations are not collapsed to the first one");
  assert.equal(selected.kind === "ambiguous" && selected.types.every((candidate, index) => candidate === candidates[index]), true,
    "every checked contextual candidate retains its original order and identity");
  assert.equal(selected.kind === "ambiguous" && Object.isFrozen(selected.types), true, "the ambiguous candidate list remains immutable");
});

const propagatedPatterns = [
  ["object conditional true branch", 'declare const flag: boolean; const { key } = flag ? { key: "a" } : { key: "b" };', 0],
  ["object conditional false branch", 'declare const flag: boolean; const { key } = flag ? { key: "a" } : { key: "b" };', 1],
  ["array conditional true branch", 'declare const flag: boolean; const [key] = flag ? ["a"] : ["b"];', 0],
  ["array conditional false branch", 'declare const flag: boolean; const [key] = flag ? ["a"] : ["b"];', 1],
  ["object logical-and right operand", 'declare const flag: true; const { key } = flag && { key: "a" };', 0],
  ["array logical-and right operand", 'declare const flag: true; const [key] = flag && ["a"];', 0],
  ["object comma right operand", 'declare function tick(): void; const { key } = (tick(), { key: "a" });', 0],
  ["array comma right operand", 'declare function tick(): void; const [key] = (tick(), ["a"]);', 0],
  ["object logical-or left operand", 'declare const flag: boolean; const { key } = (flag ? { key: "a" } : undefined) || { key: "b" };', 0],
  ["array logical-or left operand", 'declare const flag: boolean; const [key] = (flag ? ["a"] : undefined) || ["b"];', 0],
  ["object nullish left operand", 'declare const flag: boolean; const { key } = (flag ? { key: "a" } : undefined) ?? { key: "b" };', 0],
  ["array nullish left operand", 'declare const flag: boolean; const [key] = (flag ? ["a"] : undefined) ?? ["b"];', 0],
  ["object non-null operand", 'const { key } = { key: "a" }!;', 0],
  ["array non-null operand", 'const [key] = ["a"]!;', 0],
  ["nested object binding default", 'const { inner: { key } = { key: "a" } } = {};', 0],
  ["nested array binding default", 'const [[key] = ["a"]] = [];', 0],
  ["nested object property", 'const { inner: { key } } = { inner: { key: "a" } };', 1],
  ["nested array element", 'const [[key]] = [["a"]];', 1],
  ["object spread operand", 'const { key } = { ...{ key: "a" } };', 1],
  ["composed object contexts", 'declare const flag: boolean; declare function tick(): void; const { key } = (tick(), (flag ? ({ key: "a" } as const) : ({ key: "b" } as const)))!;', 0],
  ["composed array contexts", 'declare const flag: boolean; declare function tick(): void; const [key] = (tick(), (flag ? (["a"] as const) : (["b"] as const)))!;', 1],
] as const;

for (const [name, sourceText, literalIndex] of propagatedPatterns) {
  test(`${name} does not select a synthetic pattern destination`, () => {
    const { source, literals } = fixture(sourceText);
    const literal = literals[literalIndex];
    if (literal === undefined) throw new Error("The actual contextual operand is required.");
    const parent = source.ast.parent(literal);
    assert.equal(source.semantics.forNode(literal).types.contextualValueSelection(literal).kind, "unavailable",
      `${name}: only the checker owns propagation and suppression of synthetic binding-pattern context`);
    assert.equal(source.ast.parent(literal) === parent && parent !== undefined, true,
      `${name}: classification does not rewrite the actual checked source operand or its initializer`);
  });
}

const propagatedDestinations = [
  ["annotated object conditional true branch", 'declare const flag: boolean; const { key }: { key: string } = flag ? { key: "a" } : { key: "b" };', 0],
  ["annotated object conditional false branch", 'declare const flag: boolean; const { key }: { key: string } = flag ? { key: "a" } : { key: "b" };', 1],
  ["annotated array conditional true branch", 'declare const flag: boolean; const [key]: readonly [string] = flag ? ["a"] : ["b"];', 0],
  ["annotated array conditional false branch", 'declare const flag: boolean; const [key]: readonly [string] = flag ? ["a"] : ["b"];', 1],
  ["annotated object logical-and right operand", 'declare const flag: true; const { key }: { key: string } = flag && { key: "a" };', 0],
  ["annotated array logical-and right operand", 'declare const flag: true; const [key]: readonly [string] = flag && ["a"];', 0],
  ["annotated object comma right operand", 'declare function tick(): void; const { key }: { key: string } = (tick(), { key: "a" });', 0],
  ["annotated array comma right operand", 'declare function tick(): void; const [key]: readonly [string] = (tick(), ["a"]);', 0],
  ["annotated object logical-or left operand", 'declare const flag: boolean; const { key }: { key: string } = (flag ? { key: "a" } : undefined) || { key: "b" };', 0],
  ["annotated array logical-or left operand", 'declare const flag: boolean; const [key]: readonly [string] = (flag ? ["a"] : undefined) || ["b"];', 0],
  ["annotated object nullish left operand", 'declare const flag: boolean; const { key }: { key: string } = (flag ? { key: "a" } : undefined) ?? { key: "b" };', 0],
  ["annotated array nullish left operand", 'declare const flag: boolean; const [key]: readonly [string] = (flag ? ["a"] : undefined) ?? ["b"];', 0],
  ["annotated object non-null operand", 'const { key }: { key: string } = { key: "a" }!;', 0],
  ["annotated array non-null operand", 'const [key]: readonly [string] = ["a"]!;', 0],
  ["typed nested object default", 'const { inner: { key } = { key: "a" } }: { inner?: { key: string } } = {};', 0],
  ["typed nested array default", 'const { inner: [key] = ["a"] }: { inner?: readonly [string] } = {};', 0],
  ["checked object binding default", 'const { inner: { key } = { key: "a" } } = {} as { inner?: { key: string } };', 0],
  ["checked array binding default", 'const { inner: [key] = ["a"] } = {} as { inner?: readonly [string] };', 0],
  ["logical-or right operand", 'declare const prior: { key: string } | undefined; const { key } = prior || { key: "a" };', 0],
  ["nullish right operand", 'declare const prior: readonly [string] | undefined; const [key] = prior ?? ["a"];', 0],
  ["contextual arrow object parameter default", 'declare function apply(callback: (value?: { key: string }) => void): void; apply(({ key } = { key: "a" }) => { void key; });', 0],
  ["contextual arrow array parameter default", 'declare function apply(callback: (value?: readonly [string]) => void): void; apply(([key] = ["a"]) => { void key; });', 0],
  ["contextual function object parameter default", 'declare function apply(callback: (value?: { key: string }) => void): void; apply(function ({ key } = { key: "a" }) { void key; });', 0],
  ["contextual function array parameter default", 'declare function apply(callback: (value?: readonly [string]) => void): void; apply(function ([key] = ["a"]) { void key; });', 0],
  ["contextual array callback parameter default", 'declare const values: readonly { key: string }[]; values.forEach(({ key } = { key: "a" }) => { void key; });', 0],
  ["authored callback return object", 'const build: () => { key: string } = () => ({ key: "a" });', 0],
  ["authored callback return array", 'const build: () => readonly [string] = () => ["a"];', 0],
] as const;

for (const [name, sourceText, literalIndex] of propagatedDestinations) {
  test(`${name} retains its genuine checked destination`, () => {
    const { source, queries, literals } = fixture(sourceText);
    const literal = literals[literalIndex];
    if (literal === undefined) throw new Error("The actual authored contextual operand is required.");
    const contextual = queries.checker.getContextualType(literal);
    if (contextual === undefined) throw new Error(`${name}: the actual checker must supply a contextual destination.`);
    const candidates = queries.typeShape.isUnion(contextual)
      ? queries.typeShape.getUnionOrIntersectionTypes(contextual) : [contextual];
    const retained = candidates.filter(candidate => candidate !== undefined && !queries.typeShape.isNullish(candidate));
    const selection = source.semantics.forNode(literal).types.contextualValueSelection(literal);
    assert.equal(retained.length, 1, `${name}: one genuine non-nullish contextual destination is checked`);
    assert.equal(selection.kind === "selected" && selection.component.selectedType === retained[0], true,
      `${name}: skipping synthetic binding patterns preserves the actual destination identity`);
  });
}

test("a genuine ambiguous contextual callback default retains every checked destination", () => {
  const { source, queries, literal } = fixture(`
declare function apply(callback: (value?: { key: string } | { key: number }) => void): void;
apply(({ key } = { key: "a" }) => { void key; });
`);
  const contextual = queries.checker.getContextualType(literal);
  if (contextual === undefined) throw new Error("The actual callback parameter context is required.");
  const candidates = queries.typeShape.getUnionOrIntersectionTypes(contextual)
    .filter(candidate => candidate !== undefined && !queries.typeShape.isNullish(candidate));
  const selection = source.semantics.forNode(literal).types.contextualValueSelection(literal);
  assert.equal(candidates.length, 2, "the callback's actual optional parameter has two genuine value destinations");
  assert.equal(selection.kind === "ambiguous" && selection.types.length === candidates.length &&
    selection.types.every((candidate, index) => candidate === candidates[index]), true,
  "the checker flag does not discard contextual callback typing, reorder destinations or choose an arbitrary arm");
  assert.equal(selection.kind === "ambiguous" && Object.isFrozen(selection.types), true,
    "the actual ambiguous callback destination inventory is immutable");
});

test("const-asserted initializer fields keep their actual checked source declaration identity", () => {
  const { source, queries, literal } = fixture('const { key } = { key: "value" } as const;');
  const semantics = source.semantics.forNode(literal);
  const valueType = semantics.types.expressionType(literal);
  if (valueType === undefined) throw new Error("The actual checked initializer type is required.");
  const property = queries.checker.getPropertyOfType(valueType, "key");
  const declaration = source.ast.properties(literal)[0];
  if (property === undefined || declaration === undefined) throw new Error("The actual checked field and declaration are required.");
  assert.equal(semantics.types.contextualValueSelection(literal).kind, "unavailable", "the synthetic destructuring context is not selected");
  assert.equal(queries.checker.getSymbolDeclarations(property).includes(declaration), true,
    "the value field remains associated with its real authored property, not declaration-free contextual metadata");
});

test("context selection preserves the real initializer and effectful key refusal", () => {
  const { source, literal, declarations } = fixture(`
declare function readKey(): "value";
const { ...value } = { [readKey()]: 7 } as const;
`);
  const declaration = declarations.find(candidate => source.ast.is.IsVariableDeclaration(candidate));
  if (declaration === undefined) throw new Error("The actual initializer owner is required.");
  const initializer = Node_Initializer(source.ast, declaration);
  const semantics = source.semantics.forNode(literal);
  assert.equal(semantics.types.contextualValueSelection(literal).kind, "unavailable", "a const wrapper does not create a contextual field destination");
  assert.equal(Node_Initializer(source.ast, declaration) === initializer && initializer !== undefined, true,
    "no literal-type inference replaces or skips the actual source initializer");
  const property = source.ast.properties(literal)[0];
  const name = source.ast.name(property);
  if (name === undefined) throw new Error("The original computed property name is required.");
  const selected = semantics.propertyNames.get(name);
  assert.equal(selected?.kind === "rejected" && selected.reason.includes("retain its effects"), true,
    "a singleton return type cannot erase the real computed-key call");
});

test("const-asserted array context preserves exact source key metadata beyond 53 bits", () => {
  const { source, literal } = fixture(`
const [key] = [9007199254740994] as const;
export const value = { [key]: 7 };
`);
  const semantics = source.semantics.forNode(literal);
  assert.equal(semantics.types.contextualValueSelection(literal).kind, "unavailable", "the array pattern has no authored contextual target");
  const entry = semantics.propertyNames.entries.find(candidate => source.ast.is.IsComputedPropertyName(candidate.node));
  assert.equal(entry?.selection.kind === "resolved" && entry.selection.constant.kind === "numeric" &&
    entry.selection.constant.token.coefficient === 9007199254740994n, true,
  "the same canonical key owner retains the actual exact numeric token without a 53-bit cap or Number reconstruction");
});
