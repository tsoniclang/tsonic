import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type AstReader, type Node } from "@tsonic/tsts";
import { Node_Expression, Node_Initializer } from "../source-navigation/ast.js";
import { selectSourceContextualValueType } from "./contextual-type-selection.js";
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
    assert.equal(selected.kind === "selected" && selected.type === contextual, true,
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
  assert.equal(selected.kind === "selected" && selected.type === retained[0], true,
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

for (const wrapper of ["parentheses", "const assertion", "initializer"] as const) {
  test(`a foreign ${wrapper} cannot make an annotated operand look like another pattern initializer`, () => {
    const { source, queries, literals, declarations } = fixture(`
const { key } = ((({ key: "value" }) as const));
const actual: { key: string } = { key: "other" };
`);
    const first = literals[0];
    const actual = literals[1];
    if (first === undefined || actual === undefined) throw new Error("Both actual checked operands are required.");
    let foreign = wrapper === "initializer" ? declarations[0] : source.ast.parent(first);
    if (wrapper !== "initializer") {
      while (foreign !== undefined && !(wrapper === "parentheses"
        ? source.ast.is.IsParenthesizedExpression(foreign) : source.ast.isConstAssertion(foreign))) {
        foreign = source.ast.parent(foreign);
      }
    }
    if (foreign === undefined) throw new Error("The actual foreign wrapper or binding owner is required.");
    assert.equal((wrapper === "initializer" ? Node_Initializer(source.ast, foreign) : Node_Expression(source.ast, foreign)) !== actual, true,
      `${wrapper}: the candidate owner belongs to a different checked operand`);
    const contextual = queries.checker.getContextualType(actual);
    assert.equal(contextual !== undefined, true, `${wrapper}: the real operand has a genuine contextual destination`);
    const foreignOwner = foreign;
    const ast: AstReader = { ...source.ast, parent: node => node === actual ? foreignOwner : source.ast.parent(node) };
    const selected = selectSourceContextualValueType(ast, queries.typeShape, queries.checker, actual);
    assert.equal(selected.kind === "selected" && selected.type === contextual, true,
      `${wrapper}: exact operand correspondence prevents crossing another initializer's parent chain`);
  });
}

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
const { value } = { [readKey()]: 7 } as const;
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
