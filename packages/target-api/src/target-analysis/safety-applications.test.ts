import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { Node_Expression } from "../source-navigation/ast.js";
import { createTargetSafetyApplicationIndex, type TargetSafetyApplicationFact, type TargetSafetyApplicationPlacement } from "./safety-applications.js";

type TestBuilderFact =
  | (TargetSafetyApplicationFact & { readonly contract: string })
  | { readonly kind: "builder-state"; readonly label?: string };

function guarded<T extends object>(value: T, sealed: () => boolean, path: string, accesses: Map<string, number>): T {
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const member: unknown = Reflect.get(value, key);
    copy[key] = typeof member === "function"
      ? (...parameters: unknown[]) => {
          if (sealed()) throw new Error(`${path}.${key} was called after index construction`);
          accesses.set(`${path}.${key}`, (accesses.get(`${path}.${key}`) ?? 0) + 1);
          return Reflect.apply(member, value, parameters);
        }
      : member !== null && typeof member === "object" &&
          Object.keys(member).length > 0 &&
          Object.keys(member).every(name => typeof Reflect.get(member, name) === "function")
        ? guarded(member, sealed, `${path}.${key}`, accesses)
        : member;
  }
  return copy as T;
}

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
((mark("nested")));
(mark("wrapped-exact"));
mark("unregistered");
(1 + 2);
export {};
`;

function fixture(text = sourceText) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": text,
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
    ["nested", { kind: "builder-state", label: "nested" }],
    ["wrapped-exact", { kind: "builder-state", label: "inner" }],
  ]);
  const wrapperFact: TestBuilderFact = { kind: "builder-state", label: "wrapper" };
  const calls = new Map<string, Node>();
  for (const node of nodes) {
    const text = label(node);
    if (text !== undefined) calls.set(text, node);
  }
  let sealed = false;
  const isSealed = () => sealed;
  const constructionReads = new Map<string, number>();
  const guardedAst = guarded(ast, isSealed, "ast", constructionReads);
  const index = createTargetSafetyApplicationIndex<{ readonly kind: "remaining-block" }, TestBuilderFact>({
    ast: guardedAst,
    sourceFiles: [file!],
    navigation: guarded(source.navigation, isSealed, "navigation", constructionReads),
    readUnsafeContext: () => {
      if (sealed) throw new Error("readUnsafeContext was called after index construction");
      return undefined;
    },
    readSafetyBuilder: node => {
      if (sealed) throw new Error("readSafetyBuilder was called after index construction");
      if (ast.is.IsParenthesizedExpression(node) && Node_Expression(ast, node) === calls.get("wrapped-exact")) return wrapperFact;
      const text = label(node);
      return text === undefined ? undefined : facts.get(text);
    },
  });
  const seal = () => { sealed = true; };
  const call = (text: string): Node => {
    const found = calls.get(text);
    assert.equal(found !== undefined, true, text);
    return found!;
  };
  return { ast, guardedAst, index, call, seal, constructionReads, wrapperFact, getter, setter, field, value, constructor: constructor!, indexSignature: indexSignature!, nodes };
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

test("parenthesis-transparent lookups are stored at construction, with exact-node precedence", () => {
  const { ast, index, call, nodes, wrapperFact } = fixture();
  const wrappersOf = (inner: Node): Node[] => {
    const found: Node[] = [];
    for (let parent = ast.parent(inner); parent !== undefined && ast.is.IsParenthesizedExpression(parent); parent = ast.parent(parent)) {
      found.push(parent);
    }
    return found;
  };
  const nested = wrappersOf(call("nested"));
  assert.equal(nested.length, 2);
  for (const wrapper of nested) {
    assert.equal(index.operationForSubject(wrapper), undefined);
    assert.equal(index.operationForExpression(wrapper), index.operationForSubject(call("nested")));
  }
  const [wrapped] = wrappersOf(call("wrapped-exact"));
  assert.equal(index.operationForSubject(wrapped!)?.fact, wrapperFact);
  assert.equal(index.operationForExpression(wrapped!)?.fact, wrapperFact, "the wrapper's own fact takes precedence");
  assert.equal(index.operationForExpression(call("wrapped-exact"))?.fact, index.operationForSubject(call("wrapped-exact"))?.fact);
  assert.notEqual(index.operationForExpression(call("wrapped-exact"))?.fact, wrapperFact);
  assert.equal(index.operationForExpression(call("unregistered")), undefined);
  const arithmetic = nodes.find(node => ast.is.IsParenthesizedExpression(node) && ast.is.IsBinaryExpression(Node_Expression(ast, node)!));
  assert.equal(arithmetic !== undefined, true);
  assert.equal(index.operationForExpression(arithmetic!), undefined);
});

test("no index query reads the AST, navigation or fact readers after construction", () => {
  const { ast, guardedAst, index, call, seal, getter, setter, nodes } = fixture();
  const inside = ast.arguments(call("getter"))[0]!;
  const nestedWrapper = nodes.find(node => ast.is.IsParenthesizedExpression(node) &&
    ast.is.IsParenthesizedExpression(Node_Expression(ast, node)!) &&
    Node_Expression(ast, Node_Expression(ast, node)!) === call("nested"));
  assert.equal(nestedWrapper !== undefined, true);
  const sourceFile = index.all[0]!.sourceFile;
  seal();
  assert.throws(() => guardedAst.is.IsParenthesizedExpression(inside), /after index construction/u);
  assert.throws(() => guardedAst.parent(inside), /after index construction/u);
  assert.equal(index.forDeclaration(getter).length, 3);
  assert.equal(index.forDeclaration(setter).length, 2);
  assert.equal(index.forSourceFile(sourceFile).length, 7);
  assert.equal(index.isCompileTimeApplicationReference(getter, inside), true);
  assert.equal(index.isCompileTimeApplicationReference(setter, inside), false);
  assert.equal(index.operationForExpression(nestedWrapper!)?.kind, "safety-builder");
  for (const node of nodes) {
    index.operationForSubject(node);
    index.operationForExpression(node);
    index.isCompileTimeApplicationReference(getter, node);
  }
});

test("published safety memberships and operation wrappers are immutable", () => {
  const { index, getter, call } = fixture();
  const applications = index.forDeclaration(getter);
  assert.equal(Object.isFrozen(applications), true);
  assert.equal(Object.isFrozen(index.forSourceFile(applications[0]!.sourceFile)), true);
  assert.equal(Object.isFrozen(index.operationForSubject(call("getter"))), true);
  assert.equal(Reflect.set(applications, "length", 0), false);
  assert.equal(index.forDeclaration(getter).length, 3);
});

test("nested application membership inherits outer declarations without crossing siblings", () => {
  const { ast, index, call, getter, setter } = fixture(sourceText
    .replace("declare function mark(label: string): void;", "declare function mark(label: string, ...values: unknown[]): void;")
    .replace('mark("getter");', 'mark("getter", mark("setter"));'));
  const outer = call("getter");
  const inner = ast.arguments(outer)[1];
  assert.equal(inner !== undefined, true);
  assert.equal(index.isCompileTimeApplicationReference(getter, inner!), true);
  assert.equal(index.isCompileTimeApplicationReference(setter, inner!), true);
  assert.equal(index.isCompileTimeApplicationReference(setter, outer), false);
  assert.equal(index.isCompileTimeApplicationReference(getter, call("setter")), false);
});

test("each nested parenthesis operand is inspected exactly once during construction", () => {
  for (const depth of [8, 64, 128]) {
    const current = fixture(sourceText.replace('((mark("nested")));',
      `${"(".repeat(depth)}mark("nested")${")".repeat(depth)};`));
    const wrappers = current.nodes.filter(node => current.ast.is.IsParenthesizedExpression(node));
    assert.equal(current.constructionReads.get("ast.as.AsParenthesizedExpression"), wrappers.length,
      `${depth}: one stored operand read per wrapper, not repeated nested walks`);
    const before = current.constructionReads.get("ast.as.AsParenthesizedExpression");
    for (const wrapper of wrappers) current.index.operationForExpression(wrapper);
    assert.equal(current.constructionReads.get("ast.as.AsParenthesizedExpression"), before,
      "published queries never inspect an operand");
  }
});
