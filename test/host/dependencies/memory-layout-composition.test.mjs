import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceCompilerComposition } from "../../../packages/host/dist/target/extensions.js";
import { createSourceSemanticsVirtualModuleProvider } from "@tsonic/source-core/extension";
import { tsonicMemoryLayoutFactKey } from "@tsonic/source-core/facts";

function registration(moduleSpecifier, addressWidth = 64) {
  return {
    providerDeclaration: {
      providerId: "test.layout-provider", providerVersion: "1", providerModuleId: moduleSpecifier,
      moduleSpecifier, exportId: "exact-token",
    },
    descriptor: { fingerprint: `test-${addressWidth}`, byteOrder: "little", addressWidth },
  };
}

function composition(targetLayouts = [], capabilityLayouts = [], surfaceLayouts = []) {
  return createTargetSourceCompilerComposition({
    project: {}, projectDirectory: "/src", target: { id: "test" }, targetPack: {},
    targetContributions: { dataLayouts: targetLayouts },
    selectedCapabilities: [{ id: "test.capability", sourceCompilerContributions: () => ({ dataLayouts: capabilityLayouts }) }],
    selectedSurfaces: [{ id: "test.surface", sourceCompilerContributions: () => ({ dataLayouts: surfaceLayouts }) }],
  });
}

test("host supplies target, capability and surface ABI registrations to its single source-core owner", () => {
  const registrations = ["target:abi", "capability:abi", "surface:abi"].map((moduleSpecifier) => registration(moduleSpecifier));
  const composed = composition([registrations[0]], [registrations[1]], [registrations[2]]);
  assert.equal(composed.extensions.filter((extension) => extension.identity.id === "tsonic.source-core").length, 1);
  const provider = createSourceSemanticsVirtualModuleProvider({
    id: "test.layout-provider", version: "1", displayName: "Layout composition test", virtualDirectory: "layout-composition",
    modules: registrations.map((entry) => ({ moduleSpecifier: entry.providerDeclaration.moduleSpecifier, exports: [] })),
    evidenceMessage: "Explicit ABI token",
    importsForModule: () => [{ moduleSpecifier: "@tsonic/core/types.js", typeOnly: true, namedImports: [{ exportedName: "DataLayout", kind: "type" }] }],
    exportsForModule: () => [{ id: "exact-token", name: "abi", kind: "value", type: { kind: "provider-ref", moduleSpecifier: "@tsonic/core/types.js", exportName: "DataLayout" } }],
  });
  const source = `
    import type { uint32 } from "@tsonic/core/types.js";
    import { memoryLayout } from "@tsonic/core/lang.js";
    ${registrations.map((entry, index) => `import { abi as abi${index} } from "${entry.providerDeclaration.moduleSpecifier}";`).join("\n")}
    ${registrations.map((_, index) => `const layout${index} = memoryLayout<uint32>(abi${index}, 4, 4, 4);`).join("\n")}
  `;
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src", files: { "/src/index.ts": source },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
    extensionHostOptions: { extensions: [...composed.extensions, {
      identity: { id: "test.layout-provider", version: "1" },
      initialize(context) { context.registerSourceDeclarationProvider(provider); },
    }] },
  }).checkSource();
  assert.equal(checked.extensionDiagnostics.length, 0, checked.extensionDiagnostics.map((entry) => `${entry.extensionCode}: ${entry.message}`).join("\n"));
  assert.equal(checked.diagnostics.length, 0);
  const layouts = [];
  const visit = (node) => {
    const fact = checked.sourceFacts.getFact(node, tsonicMemoryLayoutFactKey);
    if (fact !== undefined) layouts.push(fact.dataLayout.providerDeclaration.moduleSpecifier);
    for (const child of checked.ast.children(node)) if (child !== undefined) visit(child);
  };
  visit(checked.getSourceFile("/src/index.ts"));
  assert.deepEqual(layouts.sort(), registrations.map((entry) => entry.providerDeclaration.moduleSpecifier).sort());
});

test("host rejects conflicting ABI registrations across composition owners", () => {
  assert.throws(() => composition([registration("test:abi", 64)], [registration("test:abi", 32)]), /Conflicting data-layout registration/u);
});

test("host deduplicates identical ABI registrations without multiple source-core extensions", () => {
  const descriptor = registration("test:abi");
  const composed = composition([descriptor], [descriptor], [descriptor]);
  assert.equal(composed.extensions.filter((extension) => extension.identity.id === "tsonic.source-core").length, 1);
});
