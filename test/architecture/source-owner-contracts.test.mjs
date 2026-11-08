import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readSourceInventory } from "./tooling/file-inventory.mjs";
import { readArchitectureTypeScript } from "./tooling/typescript-source.mjs";
import { sourceMeaningSyntaxFindings } from "./tooling/source-argument-boundary.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("Native argument evaluation and binding consume Source publications rather than reconstructing syntax vectors", () => {
  const sources = new Map([...readSourceInventory(resolve(root, "../tsonic-csharp/src"), { extensions: [".ts"] })]
    .filter(([file]) => !file.endsWith(".test.ts")));
  assert.deepEqual(sourceMeaningSyntaxFindings(sources), []);
});

for (const [label, text] of [
  ["canonical typed reader", 'import type { AstReader } from "@tsonic/tsts"; function f(reader: AstReader) { return reader.arguments(call); }'],
  ["aliased reader type", 'import type { AstReader as Syntax } from "@tsonic/tsts"; function f(reader: Syntax) { return reader.arguments(call); }'],
  ["published reader", "const syntax = source.ast; const same = syntax; same.arguments(call);"],
  ["destructured reader", "const { ast: syntax } = source; syntax.arguments(call);"],
  ["argument reader alias", "const syntax = source.ast; const read = syntax.arguments; read(call);"],
  ["destructured argument reader", "const syntax = source.ast; const { arguments: read } = syntax; read(call);"],
  ["raw argument list", "return ast.as.AsCallExpression(call).Arguments.Nodes;"],
  ["computed argument reader", 'source.ast["arguments"](call);'],
  ["canonical argument accessor alias", 'import { CallExpression_Arguments as inputs } from "@tsonic/tsts"; inputs(call);'],
  ["canonical argument accessor namespace", 'import * as syntax from "@tsonic/tsts"; syntax.CallExpression_Arguments(call);'],
]) {
  test(`Source argument boundary rejects ${label}`, () => {
    assert.equal(sourceMeaningSyntaxFindings(new Map([["example.ts", text]])).length > 0, true);
  });
}

test("ordinary Native planned arguments and authored example text are not Source syntax readers", () => {
  assert.deepEqual(sourceMeaningSyntaxFindings(new Map([["example.ts", `
    const result = planned.arguments(values);
    const example = "source.ast.arguments(call)";
    function local() { const source = { values: [] }; return source.values; }
  `]])), []);
});

for (const [label, text] of [
  ["operator token", 'import { BinaryExpression_OperatorToken as token } from "@tsonic/target-api/source"; const selected = token(node); return { operator: selected };'],
  ["conditional disposition", 'import { ConditionalExpression_Condition as control } from "@tsonic/target-api/source"; const condition = control(node); return { disposition: condition ? "left" : "right" };'],
  ["presence", 'const syntax = source.ast; return { presence: syntax.is.IsNullKeyword(node) ? "absent" : "present" };'],
  ["category", 'const syntax = source.ast; const category = syntax.is.IsStringLiteral(node) ? "string" : "number"; return { category };'],
  ["typed category branch", 'import type { SourceCategory as Meaning } from "@tsonic/target-api/source"; function select(node): Meaning { if (source.ast.is.IsStringLiteral(node)) return "string"; return "number"; }'],
  ["typed category arrow", 'import type { SourceCategory } from "@tsonic/target-api/source"; const select = (node): SourceCategory => source.ast.is.IsStringLiteral(node) ? "string" : "number";'],
  ["meaning field write", 'const selected = source.ast.operatorKindName(node); output.operator = selected;'],
  ["namespace accessor", 'import * as syntax from "@tsonic/target-api/source"; return { disposition: syntax.ConditionalExpression_Condition(node) ? "left" : "right" };'],
]) test(`Source ownership rejects Native syntax-derived ${label}`, () => {
  const rows = sourceMeaningSyntaxFindings(new Map([["example.ts", text]]));
  assert.equal(rows.some(row => row.rule === "native-rechooses-source-meaning-from-syntax"), true);
});

test("Source AST accessors remain legal for emission structure and original-node fact queries", () => {
  assert.deepEqual(sourceMeaningSyntaxFindings(new Map([["example.ts", `
    import { BinaryExpression_Left as operand } from "@tsonic/target-api/source";
    import type { SourceCategory } from "@tsonic/target-api/source";
    const syntax = source.ast;
    const original = operand(node);
    emit(original);
    const view = source.facts.values;
    const publication = view.operation(original);
    const retained = { operator: publication.value.operator, disposition: publication.value.disposition };
    function category(node): SourceCategory { return source.facts.values.type(operand(node)).value.category.category; }
    const example = "return { category: source.ast.kindName(node) }";
  `]])), []);
});

for (const [label, text] of [
  ["named alias", 'import { sourceOperatorFromKindName as choose } from "./target-model/syntax/operators.js"; choose(source.ast.operatorKindName(node));'],
  ["namespace alias", 'import * as original from "./target-model/syntax/operators.js"; const same = original; same.sourceOperatorFromKindName(source.ast.operatorKindName(node));'],
  ["namespace destructure", 'import * as original from "./target-model/syntax/operators.js"; const { sourceOperatorFromKindName: choose } = original; choose(kind);'],
  ["computed namespace member", 'import * as original from "./target-model/syntax/operators.js"; original["sourceOperatorFromKindName"](kind);'],
]) test(`Native cannot retain the replaced Source operator chooser through a ${label}`, () => {
  assert.equal(sourceMeaningSyntaxFindings(new Map([["example.ts", text]])).some(row =>
    row.rule === "native-rechooses-source-meaning-from-syntax"), true);
});

test("the replaced operator producer is absent and Native spelling maps consume published Source operators", () => {
  const path = "target-model/syntax/operators.ts";
  const replaced = "export function sourceOperatorFromKindName(kind: string) { return kind === 'KindPlusToken' ? '+' : '-'; }";
  assert.equal(sourceMeaningSyntaxFindings(new Map([[path, replaced]])).some(row =>
    row.rule === "native-rechooses-source-meaning-from-syntax"), true);
  assert.deepEqual(sourceMeaningSyntaxFindings(new Map([[path, `
    import type { SourcePrimitiveOperator } from '@tsonic/target-api/source';
    const tokens = { add: '+', subtract: '-' };
    export function spelling(operator: SourcePrimitiveOperator) { return tokens[operator]; }
    function sourceOperatorFromKindNameExample(value: string) { return value; }
  `]])), []);
  assert.deepEqual(sourceMeaningSyntaxFindings(new Map([["example.ts", `
    import { sourceOperatorFromKindName } from './unrelated.js';
    sourceOperatorFromKindName(value);
  `]])), [], "an unrelated original binding does not acquire the retired producer's identity by spelling");
});

test("Source families have one authenticated record constructor and join forwards to that same publisher", () => {
  const sources = new Map(["host", "target-api"].flatMap(name =>
    [...readSourceInventory(resolve(root, "packages", name, "src"), { extensions: [".ts"] })]
      .filter(([file]) => !file.endsWith(".test.ts") && !file.endsWith(".d.ts"))
      .map(([file, text]) => [`packages/${name}/src/${file}`, text])));
  const source = readArchitectureTypeScript(sources);
  const ast = source.ast;
  const constructors = [];
  const owner = source.getSourceFile("/architecture/packages/target-api/src/source-semantics/descriptor-owner.ts");
  const text = node => {
    const range = ast.authoredRange(node);
    return range.kind === "authored" ? ast.getSourceText(ast.getSourceFile(node)).slice(range.start, range.end) : undefined;
  };
  for (const file of source.sourceFiles) {
    const visit = node => {
      if (ast.is.IsObjectLiteralExpression(node)) {
        const fields = new Set(ast.properties(node).flatMap(property => {
          const name = ast.name(property);
          return name === undefined ? [] : [ast.text(name)];
        }));
        if (["origin", "component", "parameters", "roles"].every(name => fields.has(name))) {
          let current = ast.parent(node);
          while (current !== undefined && !ast.is.IsFunctionDeclaration(current)) current = ast.parent(current);
          constructors.push(`${ast.getFileName(file).slice("/architecture/".length)}:${current === undefined ? "<module>" : ast.text(ast.name(current))}`);
        }
      }
      ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    visit(file);
  }
  assert.deepEqual(constructors, ["packages/target-api/src/source-semantics/descriptor-families.ts:publish"]);
  const nodes = [];
  const visitOwner = node => {
    nodes.push(node);
    ast.forEachChild(node, child => { if (child !== undefined) visitOwner(child); });
  };
  visitOwner(owner);
  const joins = nodes.filter(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === "join");
  assert.equal(joins.length, 1, "one concrete descriptor join");
  const calls = [];
  const inspectJoin = node => {
    if (ast.is.IsCallExpression(node) && text(ast.as.AsCallExpression(node).Expression) === "families.publish") calls.push(node);
    ast.forEachChild(node, child => { if (child !== undefined) inspectJoin(child); });
  };
  inspectJoin(joins[0]);
  assert.equal(calls.length, 1, "join delegates original family creation once to the sole publisher");
  const publicForward = nodes.filter(node => ast.is.IsPropertyAssignment(node) && ast.text(ast.name(node)) === "publishFamily");
  assert.equal(publicForward.length, 1, "one builder publication member");
  assert.equal(text(ast.as.AsPropertyAssignment(publicForward[0]).Initializer), "families.publish", "builder publication is that identical function");
});
