import assert from "node:assert/strict";
import { test } from "node:test";
import {
  sourcePrimitive,
} from "@tsonic/tsts";
import type {
  ExtensionDiagnostic,
  ProviderDeclarationModel,
  ProviderModuleResolution,
  SourceSemanticsModule,
} from "@tsonic/tsts";
import {
  createSourceSemanticsVirtualModuleProvider,
} from "./semantics-virtual-modules.js";

const exampleModule = {
  moduleSpecifier: "@example/neutral/types.js",
  packageName: "@example/neutral",
  packageVersion: "1.2.3",
  subpath: "types.js",
  capabilities: ["primitive", "type-marker"],
  exports: [
    sourcePrimitive("word", "uint32", "number", false, 32),
    { kind: "type-marker", exportName: "Handle", marker: "pointer" },
  ],
} satisfies SourceSemanticsModule;

test("generic source-semantics providers resolve only exact declared modules", () => {
  const provider = exampleProvider([exampleModule]);

  assert.deepEqual(provider.ownsModule(exampleModule.moduleSpecifier, {}), {
    kind: "owned",
  });
  assert.deepEqual(provider.ownsModule("@example/neutral/missing.js", {}), {
    kind: "unowned",
  });

  const resolution = assertResolution(
    provider.resolveModule(exampleModule.moduleSpecifier, {}),
  );
  assert.deepEqual(resolution, {
    kind: "virtual",
    moduleSpecifier: exampleModule.moduleSpecifier,
    virtualFileName:
      "tsts-provider://example-neutral/%40example%2Fneutral%2Ftypes.js.d.ts",
    providerModuleId: exampleModule.moduleSpecifier,
    packageName: exampleModule.packageName,
    packageVersion: exampleModule.packageVersion,
    evidence: [{ message: "example neutral source semantics" }],
  });

  const model = assertDeclarationModel(
    provider.getDeclarationModel(resolution, {
      context: {},
      materialization: { kind: "complete" },
    }),
  );
  assert.equal(model.moduleSpecifier, exampleModule.moduleSpecifier);
  assert.equal(model.providerModuleId, exampleModule.moduleSpecifier);
  assert.deepEqual(
    model.exports.map((entry) => entry.name),
    ["word", "Handle"],
  );
});

test("generic source-semantics providers reject duplicate module ownership", () => {
  assert.throws(
    () => exampleProvider([exampleModule, { ...exampleModule }]),
    /Source-semantics module '@example\/neutral\/types\.js' is declared more than once\./u,
  );
});

test("generic source-semantics providers reject unsafe virtual directories", () => {
  assert.throws(
    () => createSourceSemanticsVirtualModuleProvider({
      id: "example.neutral",
      version: "1.0.0",
      displayName: "Example neutral source semantics",
      virtualDirectory: "../example-neutral",
      modules: [exampleModule],
      evidenceMessage: "example neutral source semantics",
    }),
    /must be one non-empty URI path segment/u,
  );
});

function exampleProvider(modules: readonly SourceSemanticsModule[]) {
  return createSourceSemanticsVirtualModuleProvider({
    id: "example.neutral",
    version: "1.0.0",
    displayName: "Example neutral source semantics",
    virtualDirectory: "example-neutral",
    modules,
    evidenceMessage: "example neutral source semantics",
  });
}

function assertResolution(
  result: ProviderModuleResolution | ExtensionDiagnostic,
): ProviderModuleResolution {
  if ("category" in result) {
    assert.fail(result.message);
  }
  return result;
}

function assertDeclarationModel(
  result: ProviderDeclarationModel | ExtensionDiagnostic,
): ProviderDeclarationModel {
  if ("category" in result) {
    assert.fail(result.message);
  }
  return result;
}
