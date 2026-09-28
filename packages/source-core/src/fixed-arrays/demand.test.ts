import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createCompilerSessionFromFiles,
  createSourceSemanticsExtension,
  sourcePrimitiveFactKey,
  sourceSemanticsExtensionId,
} from "@tsonic/tsts";
import type { Node, SourceElaborationContext } from "@tsonic/tsts";
import { createTsonicCoreSourceExtension } from "../extension/source-extension.js";
import { tsonicCoreSourceSemanticsModules } from "../extension/source-modules.js";
import { tsonicCoreSourceExtensionId } from "../identity.js";
import { tsonicFixedArrayFactKey } from "./facts.js";
import type { TsonicFixedArrayFact } from "./facts.js";

for (const selected of [
  { prefix: 'import type { FixedArray, int64 } from "@tsonic/core/types.js";', type: "FixedArray<int64, 4>", length: 4n, base: "number" },
  { prefix: 'import type { FixedArray as Selected, int64 } from "@tsonic/core/types.js";', type: "Selected<int64, 0>", length: 0n, base: "number" },
  { prefix: 'import type * as native from "@tsonic/core/types.js";', type: "native.FixedArray<native.int64, 9007199254740993n>", length: 9007199254740993n, base: "bigint" },
] as const) {
  test(`fixed-array early demands retain exact extent and element carrier: ${selected.type}`, () => {
    let subject: Node | undefined;
    let early: TsonicFixedArrayFact | undefined;
    const checked = checkWithDemand(`${selected.prefix} export type Value = ${selected.type};`, (context, node) => {
      subject = node;
      assert.equal(context.facts.get(node, tsonicFixedArrayFactKey), undefined);
      early = context.factResolver.resolve(node, tsonicFixedArrayFactKey);
      assert.ok(early);
      assert.equal(early.length, selected.length);
      assert.equal(early.lengthRuntimeBase, selected.base);
      assert.equal(early.elementType, context.source.ast.typeArguments(node)[0]);
      assert.ok(early.elementType);
      assert.equal(context.factResolver.resolve(early.elementType, sourcePrimitiveFactKey)?.kind, "int64");
      const source = context.source.getSourceFileQueries(context.source.ast.getSourceFile(node));
      assert.equal(early.sourceType, source.checker.getTypeFromTypeNode(node));
      assert.equal(early.elementSourceType, source.checker.getTypeFromTypeNode(early.elementType));
      assert.equal(Object.isFrozen(early), true);
      assert.equal(context.factResolver.resolve(node, tsonicFixedArrayFactKey), early);
    });
    assert.ok(subject);
    assert.ok(early);
    assert.equal(checked.sourceFacts.getFact(subject, tsonicFixedArrayFactKey), early);
    const name = checked.ast.as.AsTypeReferenceNode(subject)?.TypeName;
    assert.ok(name);
    assert.deepEqual(checked.sourceFacts.getFact(name, tsonicFixedArrayFactKey), early);
    assert.deepEqual(checked.diagnostics, []);
    assert.deepEqual(checked.extensionDiagnostics, []);
  });
}

test("fixed-array nested demands preserve each exact array occurrence", () => {
  const checked = checkWithDemand(`
    import type { FixedArray, uint32 } from "@tsonic/core/types.js";
    export type Value = FixedArray<FixedArray<uint32, 3>, 2>;
  `, (context, node) => {
    const outer = context.factResolver.resolve(node, tsonicFixedArrayFactKey);
    assert.ok(outer?.elementType);
    const inner = context.factResolver.resolve(outer.elementType, tsonicFixedArrayFactKey);
    assert.ok(inner?.elementType);
    assert.equal(outer.length, 2n);
    assert.equal(inner.length, 3n);
    assert.equal(outer.elementSourceType, inner.sourceType);
    assert.notEqual(outer, inner);
    assert.equal(context.factResolver.resolve(inner.elementType, sourcePrimitiveFactKey)?.kind, "uint32");
  });
  assert.deepEqual(checked.diagnostics, []);
  assert.deepEqual(checked.extensionDiagnostics, []);
});

for (const extent of ["number", "bigint", "-1", "-1n", "1.5", "9007199254740993", "1 | 2"]) {
  test(`fixed-array early rejection retains the owning diagnostic once: ${extent}`, () => {
    const checked = checkWithDemand(`
      import type { FixedArray } from "@tsonic/core/types.js";
      export type Value = FixedArray<number, ${extent}>;
    `, (context, node) => {
      assert.equal(context.factResolver.resolve(node, tsonicFixedArrayFactKey), undefined);
      assert.equal(context.factResolver.resolve(node, tsonicFixedArrayFactKey), undefined);
    });
    assert.equal(checked.extensionDiagnostics.length, 1);
    assert.equal(checked.extensionDiagnostics[0]?.extensionCode, "SOURCE_CORE_FIXED_ARRAY_LENGTH_NOT_LITERAL");
  });
}

test("fixed-array demands do not recognize a structural lookalike", () => {
  const checked = checkWithDemand(`
    type FixedArray<Element, Count extends number> = ReadonlyArray<Element> & { readonly length: Count };
    export type Value = FixedArray<number, 2>;
  `, (context, node) => {
    assert.equal(context.factResolver.resolve(node, tsonicFixedArrayFactKey), undefined);
  });
  assert.deepEqual(checked.diagnostics, []);
  assert.deepEqual(checked.extensionDiagnostics, []);
});

test("fixed-array demand leaves unrelated ordinary source errors enabled", () => {
  const checked = checkWithDemand(`
    import type { FixedArray } from "@tsonic/core/types.js";
    export type Value = FixedArray<number, 2>;
    export const invalid: number = "text";
  `, (context, node) => {
    assert.ok(context.factResolver.resolve(node, tsonicFixedArrayFactKey));
  });
  assert.equal(checked.diagnostics.length, 1);
  assert.equal(checked.diagnostics[0]?.code, 2322);
  assert.deepEqual(checked.extensionDiagnostics, []);
});

function checkWithDemand(source: string, observe: (context: SourceElaborationContext, node: Node) => void) {
  return createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": source },
    compilerOptions: { module: "esnext", moduleResolution: "bundler", strict: true, target: "es2022" },
    extensionHostOptions: { extensions: [
      createSourceSemanticsExtension({ modules: tsonicCoreSourceSemanticsModules() }),
      createTsonicCoreSourceExtension(),
      {
        identity: { id: "test.fixed-array-demand", version: "1" },
        dependencies: { dependsOn: [tsonicCoreSourceExtensionId, sourceSemanticsExtensionId] },
        elaborateSource(context) {
          const file = context.source.getSourceFile("/src/index.ts");
          assert.ok(file);
          const { ast } = context.source;
          const declaration = ast.statements(file).find(node => node !== undefined &&
            ast.is.IsTypeAliasDeclaration(node) && ast.text(ast.name(node)) === "Value");
          assert.ok(declaration);
          const node = ast.as.AsTypeAliasDeclaration(declaration)?.Type;
          assert.ok(node);
          observe(context, node);
        },
      },
    ] },
  }).checkSource();
}
