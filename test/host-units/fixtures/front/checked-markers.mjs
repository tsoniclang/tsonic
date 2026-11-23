import assert from "node:assert/strict";
import { loadFrontFixture } from "./checked-module.mjs";
import { analysisInput } from "./analysis-input.mjs";

export async function captureCheckedMarkers() {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../../../packages/host/dist/pipeline/source-barrier.js");
  const source = 'import { struct, field } from "marker-fixture";\n'
    + 'export interface Layout { flag: boolean }\n'
    + 'export const Shape: Layout = struct({ flag: field<boolean>() });\n'
    + 'export const Plain: Layout = { flag: true };';
  const root = "/project/node_modules/marker-fixture";
  const registration = { package: fixture.packageOf("/semantics"), version: "1", moduleSpecifier: "./plugin.js", exportId: "semantics" };
  const extensions = fixture.front.createCheckerExtensions([{ reference: registration, value: { kind: "semantics-module", value: {
    moduleSpecifier: "marker-fixture", packageName: "marker-fixture", packageVersion: "1.0.0", capabilities: ["call-marker"],
    exports: [{ kind: "call-marker", exportName: "struct", marker: "struct" }, { kind: "call-marker", exportName: "field", marker: "field" }],
  } } }]);
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
    providerPackages: [{ root: "/semantics", name: "semantics" }], semanticModules: [registration],
    extraFiles: { [root + "/package.json"]: '{"name":"marker-fixture","version":"1.0.0","types":"index.d.ts"}' },
    otherPackages: [{ root, name: "marker-fixture", modules: {
      "index.d.ts": ["declaration", "export declare function struct<T>(value: T): T; export declare function field<T>(): T;", true],
    } }] });
  const result = captureSourceBarrier({ ...analysisInput(fixture, "sdk-minimal", source), snapshot, extensions });
  assert.equal(result.kind, "ok");
  const module = result.value.modules.find(entry => entry.module.module === snapshot.entryPoint).module;
  const [marked, plain] = module.tree.statements.nodes.filter(node => node.kind === "VariableStatement")
    .map(statement => statement.declarationList.declarations.nodes[0]);
  const call = marked.initializer;
  const fieldCall = call.arguments.nodes[0].properties.nodes[0].initializer;
  return { fixture, result, module, marked, plain, call, fieldCall };
}
