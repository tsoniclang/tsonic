import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { Node_Expression } from "../source-navigation/ast.js";
import {
  createTargetSafetyApplicationIndex,
  type TargetSafetyApplicationFact,
  type TargetSafetyApplicationPlacement,
} from "./safety-applications.js";

type TestBuilderFact =
  | (TargetSafetyApplicationFact & { readonly contract: string })
  | { readonly kind: "builder-state" };

const sourceText = `
class Value {
  private stored = 1;
  field = 2;
  constructor() {}
  get current(): number { return this.stored; }
  set current(value: number) { this.stored = value; }
}
interface Indexed { [key: string]: number; }
declare function mark(label: string): void;
mark("getter");
mark("setter");
mark("field");
mark("index");
mark("declaration");
mark("constructor");
(mark("parenthesized"));
mark("state");
export {};
`;

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": sourceText,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined)));
  const source = createTargetSourceProgram(checked);
  const { ast } = source;
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true);
  const nodes: Node[] = [];
  const visit = (node: Node): void => {
    nodes.push(node);
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file!);
  const named = (kind: string, name: string): Node => {
    const found = nodes.find(node => ast.kindName(node) === kind && ast.text(ast.name(node)) === name);
    assert.equal(found !== undefined, true, `${kind} ${name}`);
    return found!;
  };
  const getter = named("KindGetAccessor", "current");
  const setter = named("KindSetAccessor", "current");
  const field = named("KindPropertyDeclaration", "field");
  const value = named("KindClassDeclaration", "Value");
  const constructor = nodes.find(node => ast.is.IsConstructorDeclaration(node));
  const indexSignature = nodes.find(node => ast.is.IsIndexSignatureDeclaration(node));
  assert.equal(constructor !== undefined && indexSignature !== undefined, true);
  const label = (node: Node): string | undefined => {
    if (!ast.is.IsCallExpression(node)) return undefined;
    const argument = ast.arguments(node)[0];
    return argument !== undefined && ast.is.IsStringLiteral(argument) ? ast.text(argument) : undefined;
  };
  const application = (
    placement: TargetSafetyApplicationPlacement,
    selected: readonly Node[],
    applicationTarget: Node = value,
  ): TestBuilderFact => ({
    kind: "application", contract: "requires-unsafe", applicationTarget, applicationPlacement: placement,
    // The checked fact repeats the selected member, as source-core facts do for accessor pairs.
    selectedMemberDeclarations: selected, selectedMemberDeclaration: selected[0], selectedMember: selected[0],
  });
  const facts = new Map<string, TestBuilderFact>([
    ["getter", application("getter", [getter, setter])],
    ["setter", application("setter", [getter, setter])],
    ["field", application("getter", [field])],
    ["index", application("setter", [indexSignature!])],
    ["declaration", application("declaration", [getter, setter])],
    ["constructor", application("constructor", [], value)],
    ["parenthesized", application("getter", [getter, setter])],
    ["state", { kind: "builder-state" }],
  ]);
  const calls = new Map<string, Node>();
  for (const node of nodes) {
    const text = label(node);
    if (text !== undefined) calls.set(text, node);
  }
  const index = createTargetSafetyApplicationIndex<{ readonly kind: "remaining-block" }, TestBuilderFact>({
    ast,
    sourceFiles: [file!],
    navigation: source.navigation,
    readUnsafeContext: () => undefined,
    readSafetyBuilder: node => {
      const text = label(node);
      return text === undefined ? undefined : facts.get(text);
    },
  });
  const call = (text: string): Node => {
    const found = calls.get(text);
    assert.equal(found !== undefined, true, text);
    return found!;
  };
  return { ast, index, call, getter, setter, field, value, constructor: constructor!, indexSignature: indexSignature!, nodes };
}

test("getter and setter applications cover only the accessor their placement names, once", () => {
  const { index, call, getter, setter } = fixture();
  const byCall = (text: string) => index.all.find(application => application.sourceSubject === call(text));
  assert.deepEqual(byCall("getter")?.targetDeclarations, [getter]);
  assert.deepEqual(byCall("setter")?.targetDeclarations, [setter]);
  assert.deepEqual(byCall("parenthesized")?.targetDeclarations, [getter]);
  assert.deepEqual(index.forDeclaration(getter).map(application => application.applicationPlacement),
    ["getter", "declaration", "getter"]);
  assert.deepEqual(index.forDeclaration(setter).map(application => application.applicationPlacement),
    ["setter", "declaration"]);
});

test("property declarations and index signatures carry both accessor placements", () => {
  const { index, call, field, indexSignature } = fixture();
  const byCall = (text: string) => index.all.find(application => application.sourceSubject === call(text));
  assert.deepEqual(byCall("field")?.targetDeclarations, [field]);
  assert.deepEqual(byCall("index")?.targetDeclarations, [indexSignature]);
});

test("declaration and constructor applications keep their existing membership", () => {
  const { index, call, getter, setter, value, constructor } = fixture();
  const byCall = (text: string) => index.all.find(application => application.sourceSubject === call(text));
  assert.deepEqual(byCall("declaration")?.targetDeclarations, [getter, setter, value]);
  assert.deepEqual(byCall("constructor")?.targetDeclarations, [value, constructor]);
  assert.equal(byCall("constructor")?.resolvedRootDeclaration, value);
});

test("builder operations are found by exact subject, and through parentheses by expression", () => {
  const { ast, index, call, nodes } = fixture();
  const parenthesized = nodes.find(node =>
    ast.is.IsParenthesizedExpression(node) && Node_Expression(ast, node) === call("parenthesized"));
  assert.equal(parenthesized !== undefined, true);
  assert.equal(index.operationForSubject(parenthesized!), undefined);
  assert.equal(index.operationForExpression(parenthesized!)?.kind, "safety-builder");
  assert.equal(index.operationForSubject(call("state"))?.kind, "safety-builder");
  assert.equal(index.all.some(application => application.sourceSubject === call("state")), false,
    "a builder state is an operation, not an application");
  assert.equal(index.all.length, 7);
});

test("compile-time application references are the references inside an application subject", () => {
  const { ast, index, call, getter, nodes } = fixture();
  const inside = ast.arguments(call("getter"))[0];
  assert.equal(inside !== undefined, true);
  assert.equal(index.isCompileTimeApplicationReference(getter, inside!), true);
  const outside = nodes.find(node => ast.is.IsReturnStatement(node));
  assert.equal(outside !== undefined, true);
  assert.equal(index.isCompileTimeApplicationReference(getter, outside!), false);
});
