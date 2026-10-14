import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { sourceCallableDefinitionIsDiscarded, sourceExpressionResultDisposition, sourceExpressionResultUse } from "./expression-use.js";

test("discarded callable creation includes nested definitions but not invoked or retained bodies", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `
      export function run() {
        (() => { const erased = () => 1; return erased; });
        void (async () => { const asyncErased = () => 2; return asyncErased; });
        const retained = () => { const retainedNested = () => 3; return retainedNested; };
        (() => { const invokedNested = () => 4; return invokedNested(); })();
        const { selected = () => 5 } = { selected: undefined };
        return retained()() + selected();
      }
    `,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  const diagnostics = checked.diagnostics.filter(diagnostic => diagnostic !== undefined);
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics).slice(0, 1024));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true, "exact checked file");
  const results = new Map<string, boolean>();
  const visit = (node: Node): void => {
    if (source.ast.is.IsVariableDeclaration(node) || source.ast.is.IsBindingElement(node)) {
      const name = source.ast.name(node);
      const initializer = source.ast.is.IsVariableDeclaration(node)
        ? source.ast.as.AsVariableDeclaration(node)?.Initializer
        : source.ast.as.AsBindingElement(node)?.Initializer;
      if (name !== undefined && initializer !== undefined && source.ast.is.IsArrowFunction(initializer)) {
        results.set(source.ast.text(name), sourceCallableDefinitionIsDiscarded(initializer, source.ast));
      }
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file!);
  assert.deepEqual([...results], [
    ["erased", true], ["asyncErased", true], ["retained", false], ["retainedNested", false],
    ["invokedNested", false], ["selected", false],
  ]);
  assert.equal(sourceCallableDefinitionIsDiscarded(file!, source.ast), false);
  assert.throws(() => sourceCallableDefinitionIsDiscarded(file!, { ...source.ast, parent: () => file! }),
    /finite acyclic source boundary/u);
});

test("async result dispositions preserve selected values and distinguish storage from scoped observation", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `
      declare function value(label: string): Promise<number>;
      declare function maybeValue(label: string): Promise<number> | undefined;
      declare function consume(value: Promise<number>): void;
      declare const flag: boolean;
      declare let optional: Promise<number> | undefined;
      export async function run() {
        value("statement");
        void (value("void") as Promise<number>);
        (value("comma-left"), value("comma-right"));
        for (value("for-start"); flag; value("for-step")) break;
        const stored = value("stored");
        const alias = stored;
        await alias;
        optional = value("assignment");
        consume(value("passed"));
        await (value("assertion") satisfies Promise<number>)!;
        await <Promise<number>>value("type-assertion");
        await (flag ? value("conditional-left") : value("conditional-right"));
        await (optional ?? value("coalesced"));
        await (flag && value("and-right"));
        await (flag || value("or-right"));
        maybeValue("and-left") && value("and-discarded");
        const array = [value("array")];
        const object = { pending: value("object") };
        const arrow = () => value("implicit-return");
        return (await value("returned-completion"));
      }
      function forward() { return value("returned"); }
    `,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0,
    formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)).slice(0, 1024));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts")!;
  const selected = new Map<string, { readonly kind: string; readonly completionReturned?: boolean }>();
  const visit = (node: Node): void => {
    if (source.ast.is.IsCallExpression(node)) {
      const argument = source.ast.arguments(node)[0];
      if (argument !== undefined && source.ast.is.IsStringLiteral(argument)) {
        const label = source.ast.text(argument);
        const disposition = sourceExpressionResultDisposition(source.ast, node);
        assert.equal(Object.isFrozen(disposition), true, label);
        assert.equal(sourceExpressionResultUse(source.ast, node) === "discarded", disposition.kind === "discarded", label);
        selected.set(label, { kind: disposition.kind,
          ...(disposition.kind === "awaited-in-scope" ? { completionReturned: disposition.completionReturned } : {}) });
      }
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.deepEqual([...selected], [
    ["statement", { kind: "discarded" }], ["void", { kind: "discarded" }],
    ["comma-left", { kind: "discarded" }], ["comma-right", { kind: "discarded" }],
    ["for-start", { kind: "discarded" }], ["for-step", { kind: "discarded" }],
    ["stored", { kind: "stored" }], ["assignment", { kind: "stored" }], ["passed", { kind: "passed" }],
    ...["assertion", "type-assertion", "conditional-left", "conditional-right", "coalesced", "and-right", "or-right"]
      .map(label => [label, { kind: "awaited-in-scope", completionReturned: false }]),
    ["and-left", { kind: "consumed" }], ["and-discarded", { kind: "discarded" }],
    ["array", { kind: "stored" }], ["object", { kind: "stored" }], ["implicit-return", { kind: "returned" }],
    ["returned-completion", { kind: "awaited-in-scope", completionReturned: true }], ["returned", { kind: "returned" }],
  ]);
  const wrappers: Node[] = [];
  const findWrapper = (node: Node): void => {
    if (source.ast.is.IsParenthesizedExpression(node)) wrappers.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) findWrapper(child); });
  };
  findWrapper(file);
  assert.equal(wrappers.length > 0, true, "checked transparent wrapper for the cyclic-boundary proof");
  const wrapper = wrappers[0]!;
  const wrapperData = source.ast.as.AsParenthesizedExpression(wrapper)!;
  assert.throws(() => sourceExpressionResultDisposition({ ...source.ast, parent: () => wrapper,
    as: { ...source.ast.as, AsParenthesizedExpression: () => ({ ...wrapperData, Expression: wrapper }) } }, wrapper),
  /finite acyclic source boundary/u);
});
