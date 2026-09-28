import assert from "node:assert/strict";
import { test } from "node:test";
import { createCompilerSessionFromFiles, createSourceSemanticsExtension, TstsSourceProviderContractVersion } from "@tsonic/tsts";
import type { CompilerExtension, Node, SourceElaborationContext } from "@tsonic/tsts";
import { createTsonicCoreSourceExtension } from "../extension/source-extension.js";
import { tsonicCoreSourceSemanticsModules } from "../extension/source-modules.js";
import { tsonicCoreSourceExtensionId } from "../identity.js";
import { tsonicAttributeBuilderFactKey } from "./facts.js";
import type { TsonicAttributeBuilderFact } from "./facts.js";

function checkWithDemand(source: string, observe: (context: SourceElaborationContext) => void,
  initialize?: CompilerExtension["initialize"]) {
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
          ...(initialize === undefined ? {} : { initialize }),
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

const intrinsicModule = "@test/native/attributes.js";
const initializeIntrinsics: NonNullable<CompilerExtension["initialize"]> = context => {
  context.registerSourceDeclarationProvider({
    identity: { id: "test.attribute-intrinsics", version: "1", extensionContractVersion: TstsSourceProviderContractVersion },
    declarationMaterialization: "complete",
    ownsModule: specifier => ({ kind: specifier === intrinsicModule ? "owned" : "unowned" }),
    resolveModule: specifier => ({ kind: "virtual", moduleSpecifier: specifier,
      providerModuleId: "Native.Attributes", virtualFileName: "/provider/native-attributes.d.ts" }),
    getDeclarationModel: () => ({ moduleSpecifier: intrinsicModule, providerModuleId: "Native.Attributes", exports: [
      { id: "Native.Attribute", name: "annotate", kind: "intrinsic" },
      { id: "Native.Mixed", intrinsicId: "Native.Mixed.Macro", name: "mixed", kind: "function", signatures: [
        { id: "Native.Mixed.call", parameters: [{ name: "value", type: { kind: "number" } }], returnType: { kind: "void" } },
      ] },
    ] }),
  });
};

for (const [imports, invocation] of [
  [`import { annotate } from "${intrinsicModule}";`, "annotate(missingToken)"],
  [`import { annotate as native } from "${intrinsicModule}";`, "native(missingToken)"],
  [`import * as native from "${intrinsicModule}";`, "native.annotate(missingToken)"],
  [`import * as native from "${intrinsicModule}";`, 'native["annotate"](missingToken)'],
  [`import { annotate } from "${intrinsicModule}"; const native = annotate;`, "((native(missingToken)))"],
] as const) {
  test(`attribute elaboration retains exact intrinsic input without a callable signature: ${invocation}`, () => {
    const demanded = new Map<Node, TsonicAttributeBuilderFact>();
    const checked = checkWithDemand(`
      import { attribute } from "@tsonic/core/lang.js";
      ${imports}
      class Subject {}
      attribute<Subject>().add(() => ${invocation});
    `, context => {
      const calls = applicationCalls(context);
      assert.equal(calls.length, 1);
      const call = calls[0]!;
      const fact = context.factResolver.resolve(call, tsonicAttributeBuilderFactKey);
      assert.ok(fact?.kind === "application");
      const node = fact.invocation as Node;
      const queries = context.source.getSourceFileQueries(context.source.ast.getSourceFile(node));
      const selection = queries.checker.getResolvedCallInfo(node);
      assert.ok(selection?.outcome === "intrinsic");
      assert.equal(selection.reference.intrinsic.exportId, "Native.Attribute");
      assert.equal("selectedSignature" in selection, false);
      assert.equal("sourceResultType" in selection, false);
      assert.equal(queries.ast.text(queries.ast.arguments(node)[0]), "missingToken");
      assert.equal(Object.isFrozen(fact), true);
      demanded.set(call, fact);
    }, initializeIntrinsics);
    assert.ok(checked.diagnostics.some(diagnostic => diagnostic?.code === 2349));
    assert.ok(checked.diagnostics.some(diagnostic => diagnostic?.code === 2304));
    assert.equal(checked.extensionDiagnostics.some(diagnostic =>
      diagnostic.extensionCode === "SOURCE_CORE_ATTRIBUTE_INVOCATION_NOT_PROVEN"), false);
    for (const [call, fact] of demanded) assert.equal(checked.sourceFacts.getFact(call, tsonicAttributeBuilderFactKey), fact);
  });
}

for (const [declarations, argument] of [
  ["", "annotate(1)"],
  ["", "async () => annotate(1)"],
  ["", "() => { annotate(1); }"],
  ["", "() => new annotate(1)"],
  ["", "() => annotate?.(1)"],
  ["let mutable = annotate;", "() => mutable(1)"],
  ["const asserted = annotate as typeof annotate;", "() => asserted(1)"],
] as const) {
  test(`intrinsic attribute input still rejects invalid quotation or identity: ${argument}`, () => {
    const checked = checkWithDemand(`
      import { attribute } from "@tsonic/core/lang.js";
      import { annotate } from "${intrinsicModule}";
      class Subject {}
      ${declarations}
      attribute<Subject>().add(${argument});
    `, context => {
      const calls = applicationCalls(context);
      assert.equal(calls.length, 1);
      assert.equal(context.factResolver.resolve(calls[0]!, tsonicAttributeBuilderFactKey), undefined);
    }, initializeIntrinsics);
    assert.ok(checked.diagnostics.length > 0 || checked.extensionDiagnostics.length > 0);
  });
}

test("intrinsic attribute selection does not bypass a real ordinary overload", () => {
  const checked = checkWithDemand(`
    import { attribute } from "@tsonic/core/lang.js";
    import { mixed } from "${intrinsicModule}";
    class Subject {}
    attribute<Subject>().add(() => mixed("wrong"));
    attribute<Subject>().add(() => mixed(4));
  `, context => {
    const calls = applicationCalls(context);
    assert.equal(calls.length, 2);
    assert.equal(context.factResolver.resolve(calls[0]!, tsonicAttributeBuilderFactKey), undefined);
    assert.equal(context.factResolver.resolve(calls[1]!, tsonicAttributeBuilderFactKey)?.kind, "application");
  }, initializeIntrinsics);
  assert.ok(checked.diagnostics.some(diagnostic => diagnostic?.code === 2345));
  assert.ok(checked.extensionDiagnostics.some(diagnostic => diagnostic.extensionCode === "SOURCE_CORE_ATTRIBUTE_INVOCATION_NOT_PROVEN"));
});
