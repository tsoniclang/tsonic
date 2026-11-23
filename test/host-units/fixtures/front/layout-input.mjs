import { analysisInput } from "./analysis-input.mjs";

export function layoutInput(fixture) {
  const root = "/layout-provider";
  const specifier = "native:layout";
  const providerModuleId = "native.layout";
  const reference = exportId => ({ package: fixture.packageOf(root), moduleSpecifier: "./plugin.js", exportId, version: "1" });
  const provider = {
    identity: { id: "test.layout", version: "1.0.0", extensionContractVersion: fixture.sdk.TstsSourceProviderContractVersion,
      diagnosticRange: { start: 9_900_000, end: 9_900_099 } },
    declarationMaterialization: "complete",
    ownsModule: requested => requested === specifier ? { kind: "owned" } : { kind: "unowned" },
    resolveModule: requested => ({ kind: "virtual", moduleSpecifier: requested, virtualFileName: "/provider/native/layout.d.ts", providerModuleId }),
    getDeclarationModel: () => ({ moduleSpecifier: specifier, providerModuleId, exports: [
      { id: "Abi", name: "Abi", kind: "value", type: { kind: "boolean" } },
      { id: "layout", name: "layout", kind: "function", signatures: [{ id: "layout.call", typeParameters: [{ name: "T" }],
        parameters: [{ name: "abi", type: { kind: "boolean" } }, ...["size", "alignment", "stride"].map(name => ({ name, type: { kind: "number" } }))],
        returnType: { kind: "boolean" } }] },
      { id: "size", name: "size", kind: "function", signatures: [{ id: "size.call",
        parameters: [{ name: "descriptor", type: { kind: "boolean" } }], returnType: { kind: "number" } }] },
    ] }),
  };
  const registration = { reference: reference("provider"), value: { kind: "declaration-provider", value: provider } };
  const roles = { reference: reference("roles"), value: { kind: "semantics-module", value: { moduleSpecifier: specifier,
    exports: [{ kind: "call-marker", exportName: "layout", marker: "memory-value-layout" },
      { kind: "call-marker", exportName: "size", marker: "memory-size" }] } } };
  const declaration = { providerId: provider.identity.id, providerVersion: provider.identity.version,
    providerModuleId, moduleSpecifier: specifier, exportId: "Abi" };
  const native = { fingerprint: "selected-layout", byteOrder: "big", addressWidth: 64 };
  const baseline = analysisInput(fixture, "sdk-minimal");
  const create = (text, input = baseline) => {
    const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": 'import { Abi, layout as make, size as measure } from "native:layout"; ' + text },
      libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }], providerPackages: [{ root, name: "layout-provider" }],
      declarationProviders: [registration.reference], semanticModules: [roles.reference] });
    return { ...input, extensions: fixture.front.createCheckerExtensions([registration, roles]), snapshot: { ...snapshot,
      contributions: { ...snapshot.contributions, dataLayouts: [declaration] },
      nativeFacts: { ...snapshot.nativeFacts, geometry: { layouts: [{ declaration, layout: native }] } } } };
  };
  return { create, native, baseline };
}
