import assert from "node:assert/strict";
import { test } from "node:test";
import {
  callExpression,
  checkSource,
  createCleanSourceCoreSession,
  createSourceCoreSession,
  definedDiagnostics,
  getSourceFact,
  sourceAst,
} from "./source-extension.fixtures.js";
import {
  tsonicCompileTimeFactKey,
  type TsonicCompileTimeFact,
} from "../public/facts.js";

test("source-core records exact compile-time facts for direct, aliased, namespace, and parenthesized calls", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { comptime as compile, comptimeIf as compileIf, unroll as expand } from "@tsonic/core/lang.js";
    import * as core from "@tsonic/core/lang.js";

    const width = compile(4);
    const typed = compile<16>();
    const namespaceValue = core.comptime("value");
    const parenthesized = (compile)(true);
    if ((compileIf(width > 1))) {
      for (const lane of (expand([0, 1]))) {
        void lane;
      }
    }
    const selected = core.comptimeIf(true) ? 1 : 0;
  `);

  const value = getSourceFact(session, callExpression(session, sourceFile, "compile", 0), tsonicCompileTimeFactKey);
  assert.equal(value?.kind, "value");
  const type = getSourceFact(session, callExpression(session, sourceFile, "compile", 1), tsonicCompileTimeFactKey);
  assert.equal(type?.kind, "type");
  if (type?.kind === "type") {
    assert.equal(sourceAst(session).text(type.explicitTypeNode), "16");
  }
  assert.equal(
    getSourceFact(session, callExpression(session, sourceFile, "core.comptime"), tsonicCompileTimeFactKey)?.kind,
    "value",
  );
  assert.equal(
    getSourceFact(session, callExpression(session, sourceFile, "compile", 2), tsonicCompileTimeFactKey)?.kind,
    "value",
  );
  assert.equal(
    getSourceFact(session, callExpression(session, sourceFile, "compileIf"), tsonicCompileTimeFactKey)?.kind,
    "condition",
  );
  assert.equal(
    getSourceFact(session, callExpression(session, sourceFile, "expand"), tsonicCompileTimeFactKey)?.kind,
    "iteration",
  );
  assert.equal(
    getSourceFact(session, callExpression(session, sourceFile, "core.comptimeIf"), tsonicCompileTimeFactKey)?.kind,
    "condition",
  );
});

test("source-core compile-time facts are provider-identity exact and shadow safe", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { comptime as sourceComptime } from "@tsonic/core/lang.js";
    import { comptime as localComptime } from "./local.js";

    const selected = sourceComptime(1);
    const local = localComptime(2);
    function comptime<T>(value: T): T { return value; }
    const shadow = comptime(3);
  `, {
    "/src/local.ts": "export function comptime<T>(value: T): T { return value; }",
  });

  assert.equal(
    getSourceFact(session, callExpression(session, sourceFile, "sourceComptime"), tsonicCompileTimeFactKey)?.kind,
    "value",
  );
  assert.equal(
    getSourceFact(session, callExpression(session, sourceFile, "localComptime"), tsonicCompileTimeFactKey),
    undefined,
  );
  assert.equal(
    getSourceFact(session, callExpression(session, sourceFile, "comptime"), tsonicCompileTimeFactKey),
    undefined,
  );
});

test("source-core rejects compile-time condition and iteration markers outside their exact owning syntax", () => {
  const { session } = createSourceCoreSession(`
    import { comptimeIf, unroll } from "@tsonic/core/lang.js";

    const condition = comptimeIf(true);
    const values = unroll([1, 2]);
    if (comptimeIf(true) && condition) {}
    for (const value of [...unroll(values)]) { void value; }
  `);
  const checked = checkSource(session);
  assert.deepEqual(definedDiagnostics(checked.diagnostics), []);
  assert.deepEqual(
    checked.extensionDiagnostics.map((diagnostic) => diagnostic.extensionCode),
    [
      "SOURCE_CORE_COMPTIME_CONDITION_POSITION_INVALID",
      "SOURCE_CORE_UNROLL_POSITION_INVALID",
      "SOURCE_CORE_COMPTIME_CONDITION_POSITION_INVALID",
      "SOURCE_CORE_UNROLL_POSITION_INVALID",
    ],
  );
});

test("source-core rejects re-exporting compile-time intrinsics through a local barrel", () => {
  const { session } = createSourceCoreSession(`
    export { comptime, comptimeIf, unroll } from "@tsonic/core/lang.js";
  `);
  const checked = checkSource(session);
  assert.deepEqual(definedDiagnostics(checked.diagnostics), []);
  assert.deepEqual(
    checked.extensionDiagnostics.map((diagnostic) => diagnostic.extensionCode),
    ["SOURCE_SEMANTICS_CORE_REEXPORT_UNSUPPORTED"],
  );
});

test("source-core compile-time facts retain exact selected operands, types, and result identities", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { comptime, comptimeIf, unroll } from "@tsonic/core/lang.js";

    function project<const Width extends number>(): Width {
      return comptime<Width>();
    }
    const nested = comptime(comptime("value"));
    if (comptimeIf(true)) {
      for (const value of unroll([1, 2] as const)) { void value; }
    }
  `);
  const checked = checkSource(session);
  const queries = checked.getSourceFileQueries(sourceFile);
  const calls = [
    callExpression(session, sourceFile, "comptime", 0),
    callExpression(session, sourceFile, "comptime", 1),
    callExpression(session, sourceFile, "comptime", 2),
    callExpression(session, sourceFile, "comptimeIf"),
    callExpression(session, sourceFile, "unroll"),
  ];

  for (const call of calls) {
    const selection = queries.checker.getResolvedCallInfo(call);
    assert.ok(selection?.outcome === "applicable");
    const fact = getSourceFact(session, call, tsonicCompileTimeFactKey);
    assert.ok(fact !== undefined);
    assert.equal(Object.isFrozen(fact), true);
    assert.equal(fact.resultType, selection.sourceResultType);
    if (fact.kind === "type") {
      const selectedType = selection.sourceSelectedMethodTypeArguments?.[0];
      assert.ok(selectedType !== undefined);
      assert.equal(fact.selectedType, selectedType.selectedType);
      assert.equal(fact.typeParameter, selectedType.typeParameter);
      assert.equal(fact.explicitTypeNode, selectedType.explicitTypeNode);
    } else {
      const argument = selection.sourceArguments[0];
      assert.ok(argument !== undefined);
      assert.equal(fact.sourceType, argument.type);
      const operand = fact.kind === "value" ? fact.expression
        : fact.kind === "condition" ? fact.condition : fact.iterable;
      assert.equal(operand, argument.expression);
    }
  }

  const repeated = session.checkSource();
  assert.deepEqual(repeated.extensionDiagnostics, []);
  for (const call of calls) {
    assert.equal(
      repeated.sourceFacts.getFact(call, tsonicCompileTimeFactKey),
      checked.sourceFacts.getFact(call, tsonicCompileTimeFactKey),
    );
  }
});

for (const source of [
  "for (const value of unroll(values)) { void value; }",
  "for (const value of (((unroll(values))))) { void value; }",
  "for (const value of unroll('text')) { void value; }",
]) {
  test(`source-core accepts the exact unroll for-of iterable: ${source}`, () => {
    const { session, sourceFile } = createCleanSourceCoreSession(`
      import { unroll } from "@tsonic/core/lang.js";
      const values = [1, 2];
      ${source}
    `);
    assert.equal(
      getSourceFact(session, callExpression(session, sourceFile, "unroll"), tsonicCompileTimeFactKey)?.kind,
      "iteration",
    );
  });
}

for (const [marker, source, diagnosticCode] of [
  ["unroll", "for (const key in unroll(values)) { void key; }", "SOURCE_CORE_UNROLL_POSITION_INVALID"],
  ["unroll", "for (const value of [...unroll(values)]) { void value; }", "SOURCE_CORE_UNROLL_POSITION_INVALID"],
  ["unroll", "for (const value of values) { unroll(values); void value; }", "SOURCE_CORE_UNROLL_POSITION_INVALID"],
  ["unroll", "for (let value = unroll(values); false;) { void value; }", "SOURCE_CORE_UNROLL_POSITION_INVALID"],
  ["comptimeIf", "while (comptimeIf(false)) {}", "SOURCE_CORE_COMPTIME_CONDITION_POSITION_INVALID"],
  ["comptimeIf", "do {} while (comptimeIf(false));", "SOURCE_CORE_COMPTIME_CONDITION_POSITION_INVALID"],
  ["comptimeIf", "for (; comptimeIf(false);) {}", "SOURCE_CORE_COMPTIME_CONDITION_POSITION_INVALID"],
  ["comptimeIf", "const choice = true ? comptimeIf(true) : false;", "SOURCE_CORE_COMPTIME_CONDITION_POSITION_INVALID"],
] as const) {
  test(`source-core rejects an unowned compile-time position without publishing a fact: ${source}`, () => {
    const { session, sourceFile } = createSourceCoreSession(`
      import { comptimeIf, unroll } from "@tsonic/core/lang.js";
      const values = [1, 2];
      ${source}
    `);
    const checked = checkSource(session);
    assert.deepEqual(definedDiagnostics(checked.diagnostics), []);
    assert.deepEqual(
      checked.extensionDiagnostics.map((diagnostic) => diagnostic.extensionCode),
      [diagnosticCode],
    );
    assert.equal(
      getSourceFact(session, callExpression(session, sourceFile, marker), tsonicCompileTimeFactKey),
      undefined,
    );
  });
}

test("source-core retains separate nested and same-line compile-time occurrences", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { comptime } from "@tsonic/core/lang.js";
    const nested = comptime(comptime(1)); const sibling = comptime(1);
  `);
  const outerCall = callExpression(session, sourceFile, "comptime", 0);
  const innerCall = callExpression(session, sourceFile, "comptime", 1);
  const siblingCall = callExpression(session, sourceFile, "comptime", 2);
  const outer = getSourceFact(session, outerCall, tsonicCompileTimeFactKey);
  const inner = getSourceFact(session, innerCall, tsonicCompileTimeFactKey);
  const sibling = getSourceFact(session, siblingCall, tsonicCompileTimeFactKey);
  assert.ok(outer?.kind === "value");
  assert.ok(inner?.kind === "value");
  assert.ok(sibling?.kind === "value");
  assert.equal(outer.expression, innerCall);
  assert.notEqual(inner.expression, sibling.expression);
  assert.equal(tsonicCompileTimeFactKey.equals(inner, sibling), false);
});

test("source-core compile-time fact snapshots preserve exact identity and detect conflicting fields", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { comptime, comptimeIf, unroll } from "@tsonic/core/lang.js";
    const first = comptime(1); const second = comptime("two");
    const firstType = comptime<4>(); const secondType = comptime<8>();
    if (comptimeIf(true)) {} if (comptimeIf(false)) {}
    for (const value of unroll([1])) { void value; }
    for (const value of unroll(["two"])) { void value; }
  `);
  const facts = [
    ["comptime", 0, 1],
    ["comptime", 2, 3],
    ["comptimeIf", 0, 1],
    ["unroll", 0, 1],
  ] as const;
  const numberFact = getSourceFact(session, callExpression(session, sourceFile, "comptime", 0), tsonicCompileTimeFactKey);
  const stringFact = getSourceFact(session, callExpression(session, sourceFile, "comptime", 1), tsonicCompileTimeFactKey);
  assert.ok(numberFact !== undefined && stringFact !== undefined);
  for (const [name, firstIndex, secondIndex] of facts) {
    const first = getSourceFact(session, callExpression(session, sourceFile, name, firstIndex), tsonicCompileTimeFactKey);
    const second = getSourceFact(session, callExpression(session, sourceFile, name, secondIndex), tsonicCompileTimeFactKey);
    assert.ok(first !== undefined && second !== undefined);
    const snapshot = tsonicCompileTimeFactKey.snapshot(first);
    assert.notEqual(snapshot, first);
    assert.equal(Object.isFrozen(snapshot), true);
    assert.equal(tsonicCompileTimeFactKey.equals(first, snapshot), true);
    assert.equal(tsonicCompileTimeFactKey.equals(first, second), false);

    const fields = first.kind === "type"
      ? ["selectedType", "typeParameter", "explicitTypeNode", "resultType"]
      : first.kind === "value" ? ["expression", "sourceType", "resultType"]
      : first.kind === "condition" ? ["condition", "sourceType", "resultType"]
      : ["iterable", "sourceType", "resultType"];
    const replacementType = first.resultType === numberFact.resultType
      ? stringFact.resultType : numberFact.resultType;
    for (const field of fields) {
      const altered = { ...first, [field]: replacementType } as TsonicCompileTimeFact;
      assert.equal(tsonicCompileTimeFactKey.equals(first, altered), false, `${first.kind}.${field}`);
    }
    assert.throws(() => Object.assign(snapshot, { resultType: second.resultType }), TypeError);
  }
});

test("source-core leaves compile-time representability to the target without evaluating runtime operands", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { comptime } from "@tsonic/core/lang.js";
    export function requireCompileTime(runtimeValue: number): number {
      return comptime(runtimeValue);
    }
  `);
  const fact = getSourceFact(session, callExpression(session, sourceFile, "comptime"), tsonicCompileTimeFactKey);
  assert.ok(fact?.kind === "value");
  assert.equal(sourceAst(session).text(fact.expression), "runtimeValue");
});

test("source-core does not publish compile-time facts for inapplicable calls", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import { comptime, comptimeIf, unroll } from "@tsonic/core/lang.js";
    const value = comptime(1, 2);
    if (comptimeIf("not a boolean")) {}
    for (const value of unroll()) { void value; }
  `);
  const checked = checkSource(session);
  assert.ok(definedDiagnostics(checked.diagnostics).length >= 3);
  assert.deepEqual(checked.extensionDiagnostics, []);
  for (const marker of ["comptime", "comptimeIf", "unroll"]) {
    assert.equal(
      getSourceFact(session, callExpression(session, sourceFile, marker), tsonicCompileTimeFactKey),
      undefined,
    );
  }
});
