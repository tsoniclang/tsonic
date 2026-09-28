import assert from "node:assert/strict";
import test from "node:test";
import {
  createCompilerSessionFromFiles,
  createSourceSemanticsExtension,
  defineExtensionFactKey,
  formatDiagnostics,
  sourcePrimitive,
  sourcePrimitiveFactKey,
  sourceSemanticsExtensionId,
  TstsSourceProviderContractVersion,
  type CompilerExtension,
  type Node,
  type SourceElaborationContext,
  type SourceFile,
  type Type,
} from "@tsonic/tsts";
import { createSourceReferenceNavigation } from "../source-navigation/references.js";
import { sourceProjectFiles } from "../source-navigation/navigation.js";
import { createSourceProgramSemantics } from "./program-queries.js";
import { createTargetSourceProgram } from "./target-source-program.js";
import { sourceTransformedTypeFactEvidenceNodes } from "./type-component-evidence.js";
import type { SourceProgramSemantics } from "./types.js";

const nativeModule = "@test/query-primitives.js";
const primitiveProvider: CompilerExtension = {
  identity: { id: "test.query-primitives", version: "1" },
  initialize(context) {
    context.registerSourceDeclarationProvider({
      identity: { id: "test.query-primitives.provider", version: "1", extensionContractVersion: TstsSourceProviderContractVersion },
      declarationMaterialization: "complete",
      ownsModule: name => name === nativeModule ? { kind: "owned" } : { kind: "unowned" },
      resolveModule: name => ({ kind: "virtual", moduleSpecifier: name, virtualFileName: "/provider/primitives.d.ts", providerModuleId: "Query.Primitives" }),
      getDeclarationModel: () => ({ moduleSpecifier: nativeModule, providerModuleId: "Query.Primitives", exports: [
        { id: "Word", name: "word", kind: "type", type: { kind: "number" } },
        { id: "Pointer", name: "Pointer", kind: "class", typeParameters: [{ name: "T" }] },
        { id: "RawPointer", name: "RawPointer", kind: "type", type: { kind: "number" } },
        { id: "FunctionPointer", name: "FunctionPointer", kind: "class", typeParameters: [{ name: "Parameters" }, { name: "Result" }] },
        { id: "FixedArray", name: "FixedArray", kind: "class", typeParameters: [{ name: "Element" }, { name: "Length" }] },
        { id: "JsString", name: "JsString", kind: "type", type: { kind: "string" } },
      ] }),
    });
  },
};
const primitives = createSourceSemanticsExtension({ modules: [{ moduleSpecifier: nativeModule,
  exports: [sourcePrimitive("word", "int32", "number", true, 32),
    { kind: "type-marker", exportName: "Pointer", marker: "pointer" },
    { kind: "type-marker", exportName: "RawPointer", marker: "raw-pointer" },
    { kind: "type-marker", exportName: "FunctionPointer", marker: "function-pointer" },
    { kind: "type-marker", exportName: "FixedArray", marker: "fixed-array" },
    { kind: "type-marker", exportName: "JsString", marker: "js-string" },
  ],
}] });

function currentSemantics(context: SourceElaborationContext): SourceProgramSemantics {
  return createSourceProgramSemantics(context.source, {
    getFact: (subject, key) => subject === undefined ? undefined : context.factResolver.resolve(subject, key),
    hasFacts: context.factResolver.hasFacts,
    getVirtualDeclarationDocument: context.factResolver.getVirtualDeclarationDocument,
  }, createSourceReferenceNavigation(context.source, sourceProjectFiles(context.source)));
}

test("current and final source semantics use the same exact types and authored primitive evidence", () => {
  let observed: { readonly file: SourceFile; readonly node: Node; readonly type: Type; readonly nodes: readonly Node[] } | undefined;
  const compiler = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `
      import type { word } from "${nativeModule}";
      type Floating = number;
      type Exact = word;
      type Combined = [Exact, Floating];
      type Recursive = { next?: Recursive; value: word };
      function identity(value: word): word { return value; }
      export const result = identity(3);
    ` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
    extensionHostOptions: { extensions: [primitiveProvider, primitives, {
      identity: { id: "test.current-semantics", version: "1" },
      dependencies: { dependsOn: [sourceSemanticsExtensionId] },
      elaborateSource(context) {
        const program = currentSemantics(context);
        const file = context.source.getSourceFile("/src/index.ts");
        assert.ok(file);
        const semantics = program.forFile(file);
        assert.equal(program.forFile(file), semantics);
        assert.equal(program.includes(file), true);
        const ast = context.source.ast;
        const aliases = new Map(ast.statements(file).filter(node => ast.is.IsTypeAliasDeclaration(node))
          .map(node => [ast.text(ast.name(node)), ast.typeNode(node)]));
        const floating = aliases.get("Floating");
        const combined = aliases.get("Combined");
        const exact = aliases.get("Exact");
        const recursive = aliases.get("Recursive");
        assert.ok(floating && combined && exact && recursive);
        const selected = semantics.types.authoredType(floating);
        assert.ok(selected);
        const nodes = sourceTransformedTypeFactEvidenceNodes(ast, semantics, combined, selected);
        assert.equal(nodes.length, 2);
        assert.equal(nodes.filter(node => ast.is.IsKeywordTypeNode(node)).length, 1);
        const native = nodes.filter(node => context.factResolver.resolve(node, sourcePrimitiveFactKey)?.kind === "int32");
        assert.deepEqual(native, [exact]);
        assert.equal(Object.isFrozen(nodes), true);
        const dependencies = semantics.facts.authoredTypeNodes(recursive);
        assert.ok(dependencies.length > 0 && dependencies.length < 10);
        assert.equal(new Set(dependencies).size, dependencies.length);
        const result = ast.statements(file).find(node => ast.is.IsVariableStatement(node));
        const declarationList = ast.as.AsVariableStatement(result)?.DeclarationList;
        const declaration = ast.children(declarationList).find(node => ast.is.IsVariableDeclaration(node));
        assert.ok(declaration);
        const call = ast.as.AsVariableDeclaration(declaration)?.Initializer;
        assert.ok(call);
        assert.equal(semantics.operations.call(call)?.outcome, "applicable");
        observed = { file, node: combined, type: selected, nodes };
      },
    }] },
  });
  const checked = compiler.checkSource();
  assert.equal(formatDiagnostics(checked.diagnostics.filter(value => value !== undefined)), "");
  assert.deepEqual(checked.extensionDiagnostics, []);
  assert.ok(observed);
  const final = createTargetSourceProgram(checked).semantics.forFile(observed.file);
  assert.deepEqual(sourceTransformedTypeFactEvidenceNodes(checked.ast, final, observed.node, observed.type), observed.nodes);
});

test("constructing current source semantics does not check unrelated expressions or weaken diagnostics", () => {
  let constructions = 0;
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `import type { word } from "${nativeModule}"; const value: word = "wrong"; missing();` },
    compilerOptions: { strict: true, module: "esnext", moduleResolution: "bundler" },
    extensionHostOptions: { extensions: [primitiveProvider, primitives, {
      identity: { id: "test.current-semantics-errors", version: "1" },
      dependencies: { dependsOn: [sourceSemanticsExtensionId] },
      elaborateSource(context) {
        const file = context.source.getSourceFile("/src/index.ts");
        assert.ok(file);
        assert.equal(currentSemantics(context).forFile(file).sourceFile, file);
        constructions += 1;
      },
    }] },
  }).checkSource();
  assert.equal(constructions, 1);
  const diagnostics = formatDiagnostics(checked.diagnostics.filter(value => value !== undefined));
  assert.match(diagnostics, /not assignable/);
  assert.match(diagnostics, /Cannot find name 'missing'/);
  assert.deepEqual(checked.extensionDiagnostics, []);
});

test("current source semantics demand native type annotations without following erased implementations", () => {
  const observations = new Map<Node, readonly Node[]>();
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `
      import type { word, Pointer, RawPointer, FunctionPointer, FixedArray, JsString } from "${nativeModule}";
      type Typed = Pointer<word>;
      type Raw = RawPointer;
      type Callback = FunctionPointer<[word], word>;
      type Array = FixedArray<word, 4>;
      type Text = JsString;
    ` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
    extensionHostOptions: { extensions: [primitiveProvider, primitives, {
      identity: { id: "test.current-native-types", version: "1" },
      dependencies: { dependsOn: [sourceSemanticsExtensionId] },
      elaborateSource(context) {
        const file = context.source.getSourceFile("/src/index.ts");
        assert.ok(file);
        const { ast } = context.source;
        const semantics = currentSemantics(context).forFile(file);
        for (const declaration of ast.statements(file)) {
          if (!ast.is.IsTypeAliasDeclaration(declaration)) continue;
          const root = ast.typeNode(declaration);
          assert.ok(root);
          const nodes = semantics.facts.authoredTypeNodes(root);
          assert.ok(nodes.includes(root));
          assert.equal(nodes.some(node => ast.is.IsKeywordTypeNode(node)), false,
            "A native marker must not expose its erased provider implementation as authored source evidence.");
          observations.set(root, nodes.filter(node => ast.is.IsTypeReferenceNode(node)));
        }
      },
    }] },
  }).checkSource();
  assert.equal(formatDiagnostics(checked.diagnostics.filter(value => value !== undefined)), "");
  assert.deepEqual(checked.extensionDiagnostics, []);
  assert.equal(observations.size, 5);
  const final = createTargetSourceProgram(checked).semantics;
  for (const [root, nodes] of observations) {
    assert.deepEqual(final.forNode(root).facts.authoredTypeNodes(root)
      .filter(node => checked.ast.is.IsTypeReferenceNode(node)), nodes);
  }
});

test("cached current source semantics reject foreign files and retired source epochs", () => {
  const identity = "test.current-semantics-replay";
  const prerequisite = defineExtensionFactKey<number>({ extensionId: identity, name: "prerequisite", snapshot: value => value });
  const dependent = defineExtensionFactKey<number>({ extensionId: identity, name: "dependent", snapshot: value => value });
  const observations: { readonly program: SourceProgramSemantics; readonly file: SourceFile }[] = [];
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": "export const value = 1;" },
    extensionHostOptions: { extensions: [{
      identity: { id: identity, version: "1" },
      initialize(context) {
        context.registerSourceElaborator(prerequisite, () => 3);
        context.registerSourceElaborator(dependent, context => context.require(context.node, prerequisite) + 1);
      },
      elaborateSource(context) {
        const program = currentSemantics(context);
        const file = context.source.getSourceFile("/src/index.ts");
        assert.ok(file);
        assert.equal(program.forFile(file).sourceFile, file);
        observations.push({ program, file });
        context.request(file, dependent);
      },
    }] },
  }).checkSource();
  assert.deepEqual(checked.diagnostics, []);
  assert.deepEqual(checked.extensionDiagnostics, []);
  assert.ok(observations.length > 1);
  const first = observations[0]!;
  const current = observations[observations.length - 1]!;
  assert.throws(() => first.program.forFile(first.file), /retired compiler program or epoch/);
  assert.throws(() => first.program.includes(first.file), /retired compiler program or epoch/);
  assert.throws(() => current.program.forFile(first.file), /exact source file/);
  assert.equal(checked.sourceFacts.getFact(current.file, dependent), 4);
});
