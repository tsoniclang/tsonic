import assert from "node:assert/strict";
import { test } from "node:test";
import { createCompilerSessionFromFiles, createSourceSemanticsExtension } from "@tsonic/tsts";
import type { Node, SourceElaborationContext } from "@tsonic/tsts";
import { createTsonicCoreSourceExtension } from "../extension/source-extension.js";
import { tsonicCoreSourceSemanticsModules } from "../extension/source-modules.js";
import { tsonicCoreSourceExtensionId } from "../identity.js";
import { tsonicAttributeBuilderFactKey } from "./facts.js";
import type { TsonicAttributeBuilderFact } from "./facts.js";

function checkWithDemand(source: string, observe: (context: SourceElaborationContext) => void) {
  const session = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": source },
    compilerOptions: { module: "esnext", moduleResolution: "bundler", strict: true, target: "es2022" },
    extensionHostOptions: {
      extensions: [
        createSourceSemanticsExtension({ modules: tsonicCoreSourceSemanticsModules() }),
        createTsonicCoreSourceExtension(),
        {
          identity: { id: "test.attribute-demand", version: "1" },
          dependencies: { dependsOn: [tsonicCoreSourceExtensionId] },
          elaborateSource: observe,
        },
      ],
    },
  });
  return session.checkSource();
}

function applicationCalls(context: SourceElaborationContext): readonly Node[] {
  const file = context.source.getSourceFile("/src/index.ts");
  assert.ok(file);
  const { ast } = context.source;
  const calls: Node[] = [];
  const visit = (node: Node): void => {
    if (ast.is.IsCallExpression(node)) {
      const callee = ast.as.AsCallExpression(node)?.Expression;
      if (callee !== undefined && ast.is.IsPropertyAccessExpression(callee)) {
        const name = ast.name(callee);
        if (name !== undefined && ast.text(name) === "add") calls.push(node);
      }
    }
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  return calls;
}

for (const [imported, selector] of [
  ['import { attribute } from "@tsonic/core/lang.js";', "attribute"],
  ['import { attribute as annotate } from "@tsonic/core/lang.js";', "annotate"],
  ['import * as core from "@tsonic/core/lang.js";', "core.attribute"],
] as const) {
  test(`attribute demand resolves nested selections before whole-program analysis: ${selector}`, () => {
    const demanded = new Map<Node, TsonicAttributeBuilderFact>();
    let visits = 0;
    const checked = checkWithDemand(`
      ${imported}
      class Annotation { constructor(value: string) {} }
      class Subject {
        value = "";
        constructor(id: string) {}
        run(input: string): string { return input; }
      }
      ${selector}<Subject>().add(() => new Annotation("type"));
      ${selector}<Subject>().property(target => target.value).add(() => new Annotation("field"));
      ${selector}<Subject>().constructor().parameter("id").add(() => new Annotation("id"));
      ${selector}<Subject>().method(target => target.run).parameter("input").add(() => new Annotation("input"));
      ${selector}.module().target("inner").add(() => new Annotation("inner"));
      ${selector}.module().target("outer").add(() => new Annotation("outer"));
      ${selector}.module().add(() => new Annotation("module"));
    `, context => {
      visits += 1;
      const calls = applicationCalls(context);
      assert.equal(calls.length, 7);
      for (const call of [...calls].reverse()) {
        assert.equal(context.facts.get(call, tsonicAttributeBuilderFactKey), undefined);
        const fact = context.factResolver.resolve(call, tsonicAttributeBuilderFactKey);
        assert.ok(fact?.kind === "application");
        assert.equal(Object.isFrozen(fact), true);
        assert.equal(context.factResolver.resolve(call, tsonicAttributeBuilderFactKey), fact);
        assert.equal(context.facts.get(call, tsonicAttributeBuilderFactKey), fact);
        demanded.set(call, fact);
      }
      const facts = calls.map(call => demanded.get(call)!);
      assert.equal(facts[1]!.applicationMemberKind, "property");
      assert.equal(facts[2]!.applicationPlacement, "constructor");
      assert.equal(facts[2]!.applicationParameterName, "id");
      assert.equal(facts[3]!.applicationMemberKind, "method");
      assert.equal(facts[3]!.applicationParameterName, "input");
      assert.deepEqual(facts.slice(4).map(fact => fact.applicationTargetSpecifier), ["inner", "outer", undefined]);
      for (const fact of facts.slice(4)) {
        assert.equal(fact.applicationPlacement, "module");
        assert.equal(fact.applicationTarget, context.source.getSourceFile("/src/index.ts"));
      }
    });
    assert.equal(visits, 1);
    assert.deepEqual(checked.diagnostics, []);
    assert.deepEqual(checked.extensionDiagnostics, []);
    for (const [call, fact] of demanded) assert.equal(checked.sourceFacts.getFact(call, tsonicAttributeBuilderFactKey), fact);
  });
}

test("early attribute demand does not confer identity on same-typed parameters", () => {
  const calls: Node[] = [];
  const checked = checkWithDemand(`
    import { attribute } from "@tsonic/core/lang.js";
    function mark(): void {}
    function apply(annotate: typeof attribute): void {
      annotate.module().target("inner").add(() => mark());
    }
  `, context => {
    calls.push(...applicationCalls(context));
    assert.equal(calls.length, 1);
    for (const call of calls) assert.equal(context.factResolver.resolve(call, tsonicAttributeBuilderFactKey), undefined);
  });
  assert.deepEqual(checked.diagnostics, []);
  assert.deepEqual(checked.extensionDiagnostics, []);
  for (const call of calls) assert.equal(checked.sourceFacts.getFact(call, tsonicAttributeBuilderFactKey), undefined);
});

test("early attribute queries preserve ordinary constructor and assignment errors", () => {
  const checked = checkWithDemand(`
    import { attribute } from "@tsonic/core/lang.js";
    class Annotation { constructor(value: string) {} }
    class Subject {}
    const wrong: number = "text";
    attribute<Subject>().add(() => new Annotation(123));
  `, context => {
    const calls = applicationCalls(context);
    assert.equal(calls.length, 1);
    assert.equal(context.factResolver.resolve(calls[0]!, tsonicAttributeBuilderFactKey), undefined);
  });
  assert.ok(checked.diagnostics.some(diagnostic => diagnostic?.code === 2322));
  assert.ok(checked.diagnostics.some(diagnostic => diagnostic?.code === 2345));
  assert.ok(checked.extensionDiagnostics.some(diagnostic => diagnostic.extensionCode === "SOURCE_CORE_ATTRIBUTE_INVOCATION_NOT_PROVEN"));
});
