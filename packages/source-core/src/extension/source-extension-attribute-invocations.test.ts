import assert from "node:assert/strict";
import { test } from "node:test";
import type { Node } from "@tsonic/tsts";
import {
  checkSource,
  createCleanSourceCoreSession,
  createSourceCoreSession,
  definedDiagnostics,
  getSourceFact,
  propertyCallExpression,
  sourceAst,
  tsonicAttributeBuilderFactKey,
} from "./source-extension.fixtures.js";

const declarations = `
  import { attribute } from "@tsonic/core/lang.js";
  class Attribute {
    constructor(value: string, enabled?: boolean) {}
  }
  class Subject {
    value = "";
    constructor(id: string) {}
    run(input: string): string { return input; }
  }
`;

for (const [name, selector] of [
  ["declaration", "attribute<Subject>()"],
  ["constructor", "attribute<Subject>().constructor()"],
  ["constructor parameter", 'attribute<Subject>().constructor().parameter("id")'],
  ["field", "attribute<Subject>().property(target => target.value)"],
  ["method", "attribute<Subject>().method(target => target.run)"],
  ["method parameter", 'attribute<Subject>().method(target => target.run).parameter("input")'],
  ["return", 'attribute<Subject>().method(target => target.run).target("return")'],
] as const) {
  test(`source-core retains the exact checked attribute invocation for ${name}`, () => {
    const { session, sourceFile } = createCleanSourceCoreSession(`${declarations}
      ${selector}.add(() => new Attribute("label", true));
    `);
    const application = propertyCallExpression(session, sourceFile, "add");
    const fact = getSourceFact(session, application, tsonicAttributeBuilderFactKey);
    assert.equal(fact?.kind, "application");
    if (fact?.kind !== "application") throw new Error("Missing attribute application");
    const ast = sourceAst(session);
    const callback = ast.arguments(application)[0];
    const invocation = callback === undefined ? undefined : ast.body(callback);
    assert.equal(fact.invocation, invocation);
    assert.equal(ast.is.IsNewExpression(fact.invocation as Node), true);
    assert.equal(ast.arguments(fact.invocation as Node).length, 2);
    assert.equal(Object.isFrozen(fact), true);
    assert.equal("attributeType" in fact, false);
    assert.equal("arguments" in fact, false);
  });
}

test("source-core accepts parenthesized checked calls and inferred generic signatures", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`${declarations}
    function annotation<T>(value: T): T { return value; }
    attribute<Subject>().add((() => (annotation({ domain: 1, block: [256, 1, 1] }))));
    attribute<Subject>().add(() => new Attribute("optional"));
  `);
  for (const occurrence of [0, 1]) {
    const fact = getSourceFact(session,
      propertyCallExpression(session, sourceFile, "add", occurrence), tsonicAttributeBuilderFactKey);
    assert.equal(fact?.kind, "application");
    if (fact?.kind !== "application") throw new Error("Missing attribute application");
    assert.equal(sourceAst(session).is.IsParenthesizedExpression(fact.invocation as Node), false);
    assert.equal(sourceAst(session).arguments(fact.invocation as Node).length, 1);
  }
});

test("the module selector retains the exact authored SourceFile through an aliased import", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { attribute as annotate } from "@tsonic/core/lang.js";
    function mark(): void {}
    annotate.module().add(() => mark());
  `);
  const application = propertyCallExpression(session, sourceFile, "add");
  const fact = getSourceFact(session, application, tsonicAttributeBuilderFactKey);
  assert.equal(fact?.kind, "application");
  assert.equal(fact?.applicationPlacement, "module");
  assert.equal(fact?.applicationTarget, sourceFile);
  assert.equal(Object.isFrozen(fact), true);
});

for (const expression of ["attribute.module(1)", "attribute.module<string>()", "attribute.module().constructor()", "attribute.module().property(value => value)"]) {
  test(`module placement rejects invalid selector shape: ${expression}`, () => {
    const { session } = createSourceCoreSession(`import { attribute } from "@tsonic/core/lang.js"; ${expression};`);
    assert.ok(definedDiagnostics(checkSource(session).diagnostics).length > 0);
  });
}

for (const [name, argument] of [
  ["stored callback", "factory"],
  ["bare function", "annotation"],
  ["block lambda", '() => { return new Attribute("label"); }'],
  ["function expression", 'function () { return new Attribute("label"); }'],
  ["async lambda", 'async () => new Attribute("label")'],
  ["generic lambda", '<T>() => new Attribute("label")'],
  ["conditional body", '() => true ? new Attribute("first") : new Attribute("second")'],
  ["noncall body", "() => value"],
] as const) {
  test(`source-core rejects ${name} as attribute syntax`, () => {
    const { session, sourceFile } = createSourceCoreSession(`${declarations}
      function annotation(): void {}
      const factory = () => new Attribute("label");
      const value = new Attribute("label");
      attribute<Subject>().add(${argument});
    `);
    const checked = checkSource(session);
    assert.ok(checked.extensionDiagnostics.some(diagnostic =>
      diagnostic.extensionCode === "SOURCE_CORE_ATTRIBUTE_INVOCATION_NOT_PROVEN"));
    assert.equal(getSourceFact(session,
      propertyCallExpression(session, sourceFile, "add"), tsonicAttributeBuilderFactKey), undefined);
  });
}

for (const [name, application] of [
  ["removed flat arguments", 'Attribute, "label"'],
  ["bare constructor", "Attribute"],
  ["wrong constructor argument", "() => new Attribute(123)"],
  ["missing constructor argument", "() => new Attribute()"],
  ["extra constructor argument", '() => new Attribute("label", true, false)'],
  ["required lambda parameter", '(value: string) => new Attribute(value)'],
] as const) {
  test(`ordinary source checking rejects ${name}`, () => {
    const { session } = createSourceCoreSession(`${declarations}
      attribute<Subject>().add(${application});
    `);
    assert.ok(definedDiagnostics(checkSource(session).diagnostics).length > 0);
  });
}

test("attribute call arguments retain ordinary overload and generic constraint checking", () => {
  for (const call of ['annotation("text")', "annotation(2)"]) {
    const { session, sourceFile } = createCleanSourceCoreSession(`${declarations}
      function annotation(value: string): void;
      function annotation(value: number): void;
      function annotation(value: string | number): void {}
      attribute<Subject>().add(() => ${call});
    `);
    assert.equal(getSourceFact(session,
      propertyCallExpression(session, sourceFile, "add"), tsonicAttributeBuilderFactKey)?.kind, "application");
  }
  for (const call of ["annotation(true)", "constrained(1)"]) {
    const { session } = createSourceCoreSession(`${declarations}
      function annotation(value: string): void;
      function annotation(value: number): void;
      function annotation(value: string | number): void {}
      function constrained<T extends string>(value: T): void {}
      attribute<Subject>().add(() => ${call});
    `);
    assert.ok(definedDiagnostics(checkSource(session).diagnostics).length > 0);
  }
});
