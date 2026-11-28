export async function nativeInt32Input(fixture, sourceText, selected, entries = []) {
  const { analysisInput } = await import("./front/analysis-input.mjs");
  const source = 'import type { int32 as Native } from "native-fixture";\n' + sourceText;
  const root = "/project/node_modules/native-fixture";
  const reference = { package: fixture.packageOf("/semantics"), version: "1", moduleSpecifier: "./plugin.js", exportId: "semantics" };
  const semantics = { moduleSpecifier: "native-fixture", packageName: "native-fixture", packageVersion: "1.0.0",
    capabilities: ["primitive"], exports: [fixture.sdk.sourcePrimitive("int32", "int32", "number", true, 32)] };
  const prepared = analysisInput(fixture, "sdk-minimal", source, entries);
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    externalEntries: prepared.snapshot.contributions.externalEntries,
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
    providerPackages: [{ root: "/semantics", name: "semantics" }], semanticModules: selected ? [reference] : [],
    otherPackages: [{ root, name: "native-fixture", modules: { "index.d.ts": ["declaration", "export type int32 = number;", true] } }],
    extraFiles: { [root + "/package.json"]: '{"name":"native-fixture","version":"1.0.0","types":"index.d.ts"}' } });
  const extensions = fixture.front.createCheckerExtensions(selected ? [{ reference, value: { kind: "semantics-module", value: semantics } }] : []);
  const carrierHolding = [...snapshot.nativeFacts.carrierHolding, { carrier: "int32", holding: "in-place" },
    { carrier: "tuple", holding: "in-place" }].sort((left, right) => left.carrier < right.carrier ? -1 : 1);
  return { ...prepared, extensions,
    snapshot: { ...snapshot, nativeFacts: { ...snapshot.nativeFacts, carrierHolding } } };
}
