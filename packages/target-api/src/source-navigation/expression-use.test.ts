import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { sourceCallableDefinitionIsDiscarded, sourceExpressionResultDisposition, sourceExpressionResultUse,
  sourceConstructValueInputs, sourceExpressionValueInputs } from "./expression-use.js";
import { sourceTransparentExpressionOperand } from "./ast.js";

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
        results.set(source.ast.text(name), sourceCallableDefinitionIsDiscarded(initializer, source.ast, source.navigation));
      }
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file!);
  assert.deepEqual([...results], [
    ["erased", true], ["asyncErased", true], ["retained", false], ["retainedNested", false],
    ["invokedNested", false], ["selected", false],
  ]);
  assert.equal(sourceCallableDefinitionIsDiscarded(file!, source.ast, source.navigation), false);
  assert.throws(() => sourceCallableDefinitionIsDiscarded(file!, { ...source.ast, parent: () => file! }, source.navigation),
    /finite acyclic source boundary/u);
});

function callableDemandFixture(sourceText: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": sourceText,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0,
    formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)).slice(0, 1024));
  const source = createTargetSourceProgram(checked);
  const definitions = new Map<string, { readonly declaration: Node; readonly expression: Node }>();
  const pending: Node[] = [checked.getSourceFile("/src/index.ts")!];
  while (pending.length !== 0) {
    const node = pending.pop()!;
    if (source.ast.is.IsVariableDeclaration(node)) {
      const name = source.ast.name(node);
      let expression = source.ast.as.AsVariableDeclaration(node)?.Initializer;
      while (expression !== undefined) {
        const operand = sourceTransparentExpressionOperand(source.ast, expression);
        if (operand === undefined) break;
        expression = operand;
      }
      if (name !== undefined && expression !== undefined &&
        (source.ast.is.IsArrowFunction(expression) || source.ast.is.IsFunctionExpression(expression))) {
        definitions.set(source.ast.text(name), { declaration: node, expression });
      }
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  const definition = (name: string) => {
    const selected = definitions.get(name);
    assert.equal(selected !== undefined, true, `${name}: the actual checked callable definition exists`);
    return selected!;
  };
  return { source, definition };
}

for (const [form, literal] of [["arrow", "() => 1"], ["function expression", "function() { return 1; }"]]) {
  for (const [use, statements] of [
    ["no reads", ""],
    ["discarded read", "selected;"],
    ["void read", "void (selected);"],
    ["immutable alias", "const alias = selected; alias;"],
    ["forwarded immutable alias", "const alias = selected; const forwarded = alias; void forwarded;"],
    ["type query only", "type Selected = typeof selected;"],
  ]) {
    test(`stored ${form} creation is discarded through its exact ${use}`, () => {
      const { source, definition } = callableDemandFixture(`export function run() {
        const selected = ${literal}; ${statements} return 3;
      }`);
      assert.equal(sourceCallableDefinitionIsDiscarded(definition("selected").expression, source.ast, source.navigation), true,
        "every actual immutable source alias has only checked, unobserved reads");
    });
  }
  for (const [use, statements] of [
    ["direct invocation", "selected();"],
    ["aliased invocation", "const alias = selected; alias();"],
    ["return", "return selected;"],
    ["argument", "observe(selected);"],
    ["captured reference", "const capture = () => selected; void capture;"],
    ["field storage", "const holder: { callback?: () => number } = {}; holder.callback = selected;"],
    ["identity comparison", "selected === selected;"],
    ["mutable alias", "let alias = selected; alias = () => 2; void alias;"],
  ]) {
    test(`stored ${form} creation retains its actual ${use} obligation`, () => {
      const { source, definition } = callableDemandFixture(`declare function observe(value: () => number): void;
        export function run() { const selected = ${literal}; ${statements} }
      `);
      assert.equal(sourceCallableDefinitionIsDiscarded(definition("selected").expression, source.ast, source.navigation), false,
        "observed, escaping or mutable source evidence never proves callable-body erasure");
    });
  }
  test(`an exported ${form} retains its checked callable definition`, () => {
    const { source, definition } = callableDemandFixture(`export const selected = ${literal};`);
    assert.equal(sourceCallableDefinitionIsDiscarded(definition("selected").expression, source.ast, source.navigation), false,
      "a real module export is an observed source value");
  });
}

test("discarded stored callable values keep their canonical assertion and satisfaction wrappers", () => {
  for (const initializer of ["(() => 1) as (() => number)", "(function() { return 1; }) satisfies (() => number)"]) {
    const { source, definition } = callableDemandFixture(`export function run() {
      const selected = ${initializer}; const alias = selected; void alias;
    }`);
    assert.equal(sourceCallableDefinitionIsDiscarded(definition("selected").expression, source.ast, source.navigation), true,
      "the original checked value selector reaches the same unobserved immutable binding");
  }
});

test("stored callable erasure follows original bindings rather than shadowed source names", () => {
  const { source, definition } = callableDemandFixture(`export function run() {
    const selected = () => 1;
    { const invoked = () => 2; const selected = invoked; selected(); }
    void selected;
  }`);
  assert.equal(sourceCallableDefinitionIsDiscarded(definition("selected").expression, source.ast, source.navigation), true,
    "a same-spelling foreign binding cannot invent an invocation of the original value");
  assert.equal(sourceCallableDefinitionIsDiscarded(definition("invoked").expression, source.ast, source.navigation), false,
    "the inner binding's real aliased invocation still retains its body");
});

test("discarded callable creation rejects foreign, incomplete and unresolved checked navigation", () => {
  const sourceText = `export function run() { const selected = () => 1; const other = () => 2; selected; other(); }`;
  const current = callableDemandFixture(sourceText);
  const foreign = callableDemandFixture(sourceText);
  const { source, definition } = current;
  const selected = definition("selected");
  const other = definition("other");
  const flow = source.navigation.expressionValueFlow(selected.expression);
  const summary = source.navigation.declarationUseSummary(selected.declaration);
  assert.equal(sourceCallableDefinitionIsDiscarded(selected.expression, source.ast, source.navigation), true,
    "the unchanged exact checked owner proves the positive before inverse checks");
  assert.equal(sourceCallableDefinitionIsDiscarded(foreign.definition("selected").expression,
    foreign.source.ast, source.navigation), false, "a same-file-name foreign source is not this checked owner");
  for (const [label, navigation] of [
    ["missing source root", { ...source.navigation, sourceFiles: [] }],
    ["foreign flow expression", { ...source.navigation, expressionValueFlow: () => ({ ...flow, expression: other.expression }) }],
    ["foreign alias root", { ...source.navigation, expressionValueFlow: () => ({ ...flow, aliasDeclarations: [other.declaration] }) }],
    ["duplicate alias", { ...source.navigation, expressionValueFlow: () => ({ ...flow,
      aliasDeclarations: [selected.declaration, selected.declaration] }) }],
    ["missing source use", { ...source.navigation, expressionValueFlow: () => ({ ...flow, uses: [] }) }],
    ["foreign declaration summary", { ...source.navigation, declarationUseSummary: () => ({ ...summary, declaration: other.declaration }) }],
    ["unresolved binding", { ...source.navigation, sourceReferenceFor: () => undefined }],
    ["unresolved symbol", { ...source.navigation, declarationSymbol: () => undefined }],
    ["foreign binding", { ...source.navigation, sourceReferenceFor: () => source.navigation.sourceReferenceFor(source.ast.name(other.declaration)) }],
    ["actual binding write", { ...source.navigation, declarationUseSummary: () => ({ ...summary, bindingWritten: true }) }],
  ] as const) {
    assert.equal(sourceCallableDefinitionIsDiscarded(selected.expression, source.ast, navigation), false,
      `${label}: absence or foreign evidence cannot become an erasure proof`);
  }
  assert.throws(() => Reflect.apply(sourceCallableDefinitionIsDiscarded, undefined, [selected.expression, source.ast]),
    /requires its checked source navigation/u, "the replaced two-argument API is rejected, not retained as a fallback");
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

test("transparent operand selection has one exact checked syntax owner", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": "function read(value: number) { return (((<number>value) as number) satisfies number)!; }",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts")!;
  const expected = new Set(["KindParenthesizedExpression", "KindAsExpression", "KindTypeAssertionExpression",
    "KindSatisfiesExpression", "KindNonNullExpression"]);
  const seen = new Set<string>();
  const visit = (node: Node): void => {
    const kind = source.ast.kindName(node);
    const operand = sourceTransparentExpressionOperand(source.ast, node);
    assert.equal(operand !== undefined, expected.has(kind), kind);
    if (operand !== undefined) {
      assert.equal(source.ast.parent(operand) === node, true, kind + ": exact child");
      seen.add(kind);
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.deepEqual([...seen].sort(), [...expected].sort());
});

test("shared construct inputs retain original owners, defaults, for order and switch case indexes", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `
      declare function step(): number;
      export function run(value = 1): number {
        for (step(); value < 3; step()) { if (value === 2) break; }
        for (let index = 0; index < value; index++) { value += index; }
        switch (value) { case 1: return 1; default: break; case 3: return 3; }
        return value;
      }
    `,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "shared construct source is checked");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts")!;
  const loops: Node[] = [];
  let switchNode: Node | undefined;
  let parameter: Node | undefined;
  const visit = (node: Node): void => {
    if (source.ast.is.IsForStatement(node)) loops.push(node);
    if (source.ast.is.IsSwitchStatement(node)) switchNode = node;
    if (source.ast.is.IsParameterDeclaration(node)) parameter = node;
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.equal(loops.length, 2, "both original loops exist");
  const first = sourceConstructValueInputs(source.ast, loops[0]!);
  assert.deepEqual(first.map(input => input.slot.kind), ["initializer", "condition", "effect"]);
  for (const input of first) assert.equal(input.owner === loops[0], true, "for input keeps its original construct owner");
  assert.deepEqual(sourceConstructValueInputs(source.ast, loops[1]!).map(input => input.slot.kind), ["condition", "effect"],
    "a declaration initializer remains a construct, not an expression");
  assert.equal(switchNode !== undefined, true, "checked switch exists");
  const switchInputs = sourceConstructValueInputs(source.ast, switchNode!);
  assert.deepEqual(switchInputs.map(input => input.slot.kind === "case" ? `case:${input.slot.index}` : input.slot.kind),
    ["condition", "case:0", "case:2"], "default clauses still occupy their source index");
  for (const input of switchInputs) assert.equal(input.owner === switchNode, true, "case expressions retain the switch owner");
  assert.equal(parameter !== undefined, true, "checked parameter exists");
  const defaults = sourceConstructValueInputs(source.ast, parameter!);
  assert.equal(defaults.length, 1, "one source default");
  assert.equal(defaults[0]!.owner === parameter && defaults[0]!.slot.kind === "default", true, "target absence guards do not replace the original default owner");
});

test("shared expression inputs retain holes, spreads, spans and branch roles without executing callable bodies", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `
      export function run(value: number) {
        const array = [, value, ...[value + 1]];
        const text = \`value=\${value}:\${array.length}\`;
        const callback = () => value + 2;
        return value > 0 ? (text as string) : "none";
      }
    `,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "shared expression source is checked");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts")!;
  const declarations = new Map<string, Node>();
  let conditional: Node | undefined;
  const visit = (node: Node): void => {
    if (source.ast.is.IsVariableDeclaration(node)) declarations.set(source.ast.text(source.ast.name(node)), node);
    if (source.ast.is.IsConditionalExpression(node)) conditional = node;
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  const initializer = (name: string) => source.ast.as.AsVariableDeclaration(declarations.get(name))!.Initializer!;
  const array = initializer("array");
  const elements = sourceExpressionValueInputs(source.ast, array)!;
  assert.deepEqual(elements.map(input => input.slot.kind === "element" ? input.slot.index : -1), [1, 2], "omitted elements do not renumber later source slots");
  assert.equal(elements[1]!.expression === source.ast.as.AsSpreadElement(source.ast.children(array)[2])?.Expression, true,
    "spread uses its original underlying expression");
  assert.deepEqual(sourceExpressionValueInputs(source.ast, initializer("text"))!.map(input => input.slot.kind === "span" ? input.slot.index : -1), [0, 1]);
  assert.equal(conditional !== undefined, true, "checked conditional exists");
  assert.deepEqual(sourceExpressionValueInputs(source.ast, conditional!)!.map(input => input.slot.kind === "branch" ? input.slot.branch : input.slot.kind),
    ["condition", "true", "false"]);
  const callback = initializer("callback");
  assert.equal(sourceExpressionValueInputs(source.ast, callback)!.length, 0, "creating a callable does not execute its body");
  const body = sourceConstructValueInputs(source.ast, callback);
  assert.equal(body.length, 1, "the admitted callable construct separately owns its concise return");
  assert.equal(body[0]!.owner === callback && body[0]!.expression === source.ast.body(callback), true, "same original body and owner");
  for (const input of elements) assert.equal(Object.isFrozen(input) && Object.isFrozen(input.slot), true, "source occurrence rows are immutable");
});

test("shared value inputs never turn type queries or signature syntax into runtime operands", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `
      declare function unused(value: number): number;
      type Callback = typeof unused;
      interface Contract { invoke(value: number): number; }
      export function run(value: Callback): number { return value(1); }
    `,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "type metadata source is checked");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts")!;
  let typeQuery: Node | undefined;
  let signature: Node | undefined;
  const visit = (node: Node): void => {
    if (source.ast.is.IsTypeQueryNode(node)) typeQuery = node;
    if (source.ast.is.IsMethodSignatureDeclaration(node)) signature = node;
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.equal(typeQuery !== undefined && signature !== undefined, true, "both original metadata nodes exist");
  for (const node of [typeQuery!, signature!]) {
    assert.equal(sourceExpressionValueInputs(source.ast, node) === undefined, true, "metadata has no runtime expression inputs");
    assert.equal(sourceConstructValueInputs(source.ast, node).length, 0, "metadata is not an executable construct root");
  }
});
