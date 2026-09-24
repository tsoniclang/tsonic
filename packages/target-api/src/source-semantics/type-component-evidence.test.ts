import assert from "node:assert/strict";
import test from "node:test";
import {
  createCompilerSessionFromFiles,
  createSourceSemanticsExtension,
  formatDiagnostics,
  sourcePrimitive,
  sourcePrimitiveFactKey,
  type Node,
} from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";
import { sourceTransformedTypeFactEvidenceNodes } from "./type-component-evidence.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: {
      "/src/node_modules/@test/native/package.json": JSON.stringify({
        name: "@test/native", version: "1.0.0", type: "module", exports: { "./types.js": "./types.d.ts" },
      }),
      "/src/node_modules/@test/native/types.d.ts": "export type word = number;",
      "/src/index.ts": `
        import type { word } from "@test/native/types.js";
        type Floating = number;
        type Wide = bigint;
        type Callable = (first: Floating, second: Wide) => string;
        type Indirect = Callable;
        type Exact = word;
        type Mixed = [Exact, Floating];
        type Recursive = { next?: Recursive; value: word };
      `,
    },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
    extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: [{
      moduleSpecifier: "@test/native/types.js", packageName: "@test/native", subpath: "types.js",
      exports: [sourcePrimitive("word", "int32", "number", true, 32)],
    }] })] },
  }).checkSource();
  assert.equal(formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"), "");
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const semantics = source.semantics.forFile(file);
  const aliases = new Map<string, Node>();
  for (const declaration of source.ast.statements(file)) {
    if (declaration !== undefined && source.ast.is.IsTypeAliasDeclaration(declaration)) {
      const type = source.ast.typeNode(declaration);
      assert.ok(type);
      aliases.set(source.ast.text(source.ast.name(declaration)), type);
    }
  }
  const alias = (name: string) => {
    const node = aliases.get(name);
    assert.ok(node);
    return node;
  };
  const selected = (name: string) => {
    const type = semantics.types.authoredType(alias(name));
    assert.ok(type);
    return type;
  };
  return { source, semantics, alias, selected };
}

test("transformed components retain ordinary keyword evidence through exact aliases", () => {
  const { source, semantics, alias, selected } = fixture();
  for (const name of ["Floating", "Wide"]) {
    const nodes = sourceTransformedTypeFactEvidenceNodes(source.ast, semantics, alias("Indirect"), selected(name));
    assert.deepEqual(nodes, [alias(name)]);
    assert.ok(Object.isFrozen(nodes));
  }
});

test("native primitive aliases never expose their erased implementation keyword", () => {
  const { source, semantics, alias, selected } = fixture();
  const nodes = sourceTransformedTypeFactEvidenceNodes(source.ast, semantics, alias("Exact"), selected("Floating"));
  assert.equal(nodes.length, 1);
  assert.equal(source.sourceFacts.getFact(nodes[0]!, sourcePrimitiveFactKey)?.kind, "int32");
  assert.equal(source.ast.is.IsKeywordTypeNode(nodes[0]!), false);
});

test("mixed native and ordinary component evidence remains distinguishable", () => {
  const { source, semantics, alias, selected } = fixture();
  const nodes = sourceTransformedTypeFactEvidenceNodes(source.ast, semantics, alias("Mixed"), selected("Floating"));
  assert.equal(nodes.length, 2);
  assert.equal(nodes.filter(node => source.sourceFacts.getFact(node, sourcePrimitiveFactKey)?.kind === "int32").length, 1);
  assert.equal(nodes.filter(node => source.ast.is.IsKeywordTypeNode(node)).length, 1);
});

test("recursive authored closures terminate and return each evidence node once", () => {
  const { semantics, alias } = fixture();
  const nodes = semantics.facts.authoredTypeNodes(alias("Recursive"));
  assert.ok(nodes.length > 0 && nodes.length < 10);
  assert.equal(new Set(nodes).size, nodes.length);
  assert.ok(Object.isFrozen(nodes));
});
