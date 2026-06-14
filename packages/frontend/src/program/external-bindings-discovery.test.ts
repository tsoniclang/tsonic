import { describe, it } from "mocha";
import { expect } from "chai";
import { discoverAndLoadExternalBindings } from "./external-bindings-discovery.js";
import { BindingRegistry } from "./bindings.js";
import { createProgramContext } from "../ir/program-context.js";
import { extractImports } from "../ir/builder/imports.js";
import { createTstsTestProgramFromFiles } from "../testing/tsts-test-program.js";

describe("external bindings discovery (entrypoint re-exports)", () => {
  it("loads bindings.json for re-exported external namespaces and resolves flattened value exports", () => {
    const bindings = new BindingRegistry();
    const tsonicProgram = createTstsTestProgramFromFiles(
      {
        "package.json": JSON.stringify({
          name: "test-project",
          private: true,
          type: "module",
        }),
        "node_modules/@test/pkg/package.json": JSON.stringify({
          name: "@test/pkg",
          version: "0.0.0",
          type: "module",
          exports: {
            "./*.js": {
              types: "./dist/tsonic/bindings/*.d.ts",
              default: "./dist/tsonic/bindings/*.js",
            },
          },
        }),
        "node_modules/@test/pkg/dist/tsonic/bindings/Root/bindings.json":
          JSON.stringify({
            schema: "tsonic.bindings",
            provider: { namespace: "Root" },
            targetSurface: { types: [] },
          }),
        "node_modules/@test/pkg/dist/tsonic/bindings/Root.d.ts":
          'export { foo } from "./Other.js";\n',
        "node_modules/@test/pkg/dist/tsonic/bindings/Root.js":
          'throw new Error("stub");\n',
        "node_modules/@test/pkg/dist/tsonic/bindings/Other/bindings.json":
          JSON.stringify({
            schema: "tsonic.bindings",
            provider: { namespace: "Other" },
            targetSurface: {
              types: [],
              exports: {
                foo: {
                  kind: "method",
                  targetName: "foo",
                  ownerQualifiedName: "Other.Container",
                  ownerIdentity: "TestAssembly",
                },
              },
            },
          }),
        "node_modules/@test/pkg/dist/tsonic/bindings/Other.d.ts":
          'export { foo } from "./Other/internal/index.js";\n',
        "node_modules/@test/pkg/dist/tsonic/bindings/Other.js":
          'throw new Error("stub");\n',
        "node_modules/@test/pkg/dist/tsonic/bindings/Other/internal/index.d.ts":
          "export declare function foo(): void;\n",
        "node_modules/@test/pkg/dist/tsonic/bindings/Other/internal/index.js":
          'throw new Error("stub");\n',
        "src/main.ts":
          'import { foo } from "@test/pkg/Root.js";\nexport function main(): void { foo(); }\n',
      },
      "src/main.ts",
      { bindings }
    );

    discoverAndLoadExternalBindings(tsonicProgram);

    expect(bindings.getTsbindgenExport("Other", "foo")).to.not.equal(undefined);

    const ctx = createProgramContext(tsonicProgram, {
      sourceRoot: tsonicProgram.options.sourceRoot,
      rootNamespace: "TestApp",
    });

    const irImports = extractImports(tsonicProgram.sourceFile, ctx);
    expect(ctx.diagnostics.length).to.equal(0);

    const imp = irImports.find(
      (i) => i.kind === "import" && i.source === "@test/pkg/Root.js"
    );
    expect(imp, "expected import to be extracted").to.not.equal(undefined);
    if (!imp || imp.kind !== "import") return;

    const fooSpec = imp.specifiers.find(
      (s) => s.kind === "named" && s.name === "foo"
    );
    expect(fooSpec, "expected named import foo").to.not.equal(undefined);
    if (!fooSpec || fooSpec.kind !== "named") return;

    expect(fooSpec.providerValue?.ownerQualifiedName).to.equal(
      "Other.Container"
    );
    expect(fooSpec.providerValue?.memberName).to.equal("foo");
  });

  it("loads external bindings referenced only from declaration files", () => {
    const bindings = new BindingRegistry();
    const tsonicProgram = createTstsTestProgramFromFiles(
      {
        "package.json": JSON.stringify({
          name: "test-project",
          private: true,
          type: "module",
        }),
        "node_modules/@test/ef/package.json": JSON.stringify({
          name: "@test/ef",
          version: "0.0.0",
          type: "module",
          exports: {
            "./*.js": {
              types: "./dist/tsonic/bindings/*.d.ts",
              default: "./dist/tsonic/bindings/*.js",
            },
          },
        }),
        "node_modules/@test/ef/dist/tsonic/bindings/Foo/bindings.json":
          JSON.stringify({
            schema: "tsonic.bindings",
            provider: { namespace: "Foo" },
            targetSurface: {
              types: [],
              exports: {
                mark: {
                  kind: "method",
                  targetName: "mark",
                  ownerQualifiedName: "Foo.Container",
                  ownerIdentity: "TestAssembly",
                },
              },
            },
          }),
        "node_modules/@test/ef/dist/tsonic/bindings/Foo.d.ts":
          "export interface Marker { ok: true; }\nexport declare function mark(): void;\n",
        "node_modules/@test/ef/dist/tsonic/bindings/Foo.js":
          'throw new Error("stub");\n',
        "node_modules/@test/pkg/package.json": JSON.stringify({
          name: "@test/pkg",
          version: "0.0.0",
          type: "module",
          exports: {
            "./*.js": {
              types: "./dist/tsonic/bindings/*.d.ts",
              default: "./dist/tsonic/bindings/*.js",
            },
          },
        }),
        "node_modules/@test/pkg/dist/tsonic/bindings/Root/bindings.json":
          JSON.stringify({
            schema: "tsonic.bindings",
            provider: { namespace: "Root" },
            targetSurface: { types: [] },
          }),
        "node_modules/@test/pkg/dist/tsonic/bindings/Root.d.ts": [
          'import type { Marker } from "@test/ef/Foo.js";',
          "",
          "export interface NeedsMarker {",
          "  readonly value: Marker;",
          "}",
          "",
        ].join("\n"),
        "node_modules/@test/pkg/dist/tsonic/bindings/Root.js":
          'throw new Error("stub");\n',
        "src/main.ts":
          'import type { NeedsMarker } from "@test/pkg/Root.js";\nexport type Check = NeedsMarker;\n',
      },
      "src/main.ts",
      { bindings }
    );

    discoverAndLoadExternalBindings(tsonicProgram);

    expect(bindings.getTsbindgenExport("Foo", "mark")).to.not.equal(undefined);
  });
});
