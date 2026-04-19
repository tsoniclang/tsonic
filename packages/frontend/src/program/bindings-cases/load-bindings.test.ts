/**
 * Tests for loadBindings() — filesystem-based manifest loading:
 * typeRoot scanning, .d.ts sibling manifests, multiple typeRoots,
 * malformed JSON handling, transitive dependency traversal.
 */

import { describe, it, beforeEach, afterEach } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadBindings } from "../bindings.js";
import { materializeFrontendFixture } from "../../testing/filesystem-fixtures.js";

const materializeLoadBindingsFixture = (fixtureName: string) =>
  materializeFrontendFixture(`program/load-bindings/${fixtureName}`);

describe("Binding System", () => {
  describe("loadBindings", () => {
    let tempDir: string;

    beforeEach(() => {
      // Create a temporary directory for test files
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tsonic-bindings-test-"));
    });

    afterEach(() => {
      // Clean up temporary directory
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should load bindings from a manifest file in typeRoot", () => {
      // Create a test binding manifest
      const manifestPath = path.join(tempDir, "bindings.json");
      const manifest = {
        bindings: {
          console: {
            kind: "global",
            assembly: "Tsonic.Runtime",
            type: "Tsonic.Runtime.console",
          },
        },
      };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      const registry = loadBindings([tempDir]);

      const binding = registry.getBinding("console");
      expect(binding).to.deep.equal({
        kind: "global",
        assembly: "Tsonic.Runtime",
        type: "Tsonic.Runtime.console",
      });
    });

    it("should load root-level global function bindings with csharpName", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          {
            name: "@fixture/js",
            version: "1.0.0",
            type: "module",
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(tempDir, "tsonic.surface.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            id: "@fixture/js",
            extends: [],
            requiredTypeRoots: ["."],
          },
          null,
          2
        )
      );
      fs.writeFileSync(path.join(tempDir, "index.d.ts"), "export {};\n");
      fs.writeFileSync(
        path.join(tempDir, "bindings.json"),
        JSON.stringify(
          {
            bindings: {
              setInterval: {
                kind: "global",
                assembly: "js",
                type: "js.Timers",
                csharpName: "Timers.setInterval",
              },
              clearInterval: {
                kind: "global",
                assembly: "js",
                type: "js.Timers",
                csharpName: "Timers.clearInterval",
              },
            },
          },
          null,
          2
        )
      );

      const registry = loadBindings([tempDir]);

      expect(registry.getBinding("setInterval")).to.deep.equal({
        kind: "global",
        assembly: "js",
        type: "js.Timers",
        csharpName: "Timers.setInterval",
      });
      expect(registry.getBinding("clearInterval")).to.deep.equal({
        kind: "global",
        assembly: "js",
        type: "js.Timers",
        csharpName: "Timers.clearInterval",
      });
    });

    it("should load bindings from manifest next to .d.ts file", () => {
      // Create a facade + namespace directory structure
      // `Runtime.d.ts` at root, with `Runtime/bindings.json` next to it.
      fs.writeFileSync(path.join(tempDir, "Runtime.d.ts"), "");

      const namespaceDir = path.join(tempDir, "Runtime");
      fs.mkdirSync(namespaceDir, { recursive: true });
      const manifest = {
        bindings: {
          Math: {
            kind: "global",
            assembly: "Tsonic.Runtime",
            type: "Tsonic.Runtime.Math",
          },
        },
      };
      fs.writeFileSync(
        path.join(namespaceDir, "bindings.json"),
        JSON.stringify(manifest, null, 2)
      );

      const registry = loadBindings([tempDir]);

      const binding = registry.getBinding("Math");
      expect(binding).to.deep.equal({
        kind: "global",
        assembly: "Tsonic.Runtime",
        type: "Tsonic.Runtime.Math",
      });
    });

    it("should handle non-existent typeRoots gracefully", () => {
      const registry = loadBindings(["/nonexistent/path"]);
      expect(registry.getAllBindings()).to.have.lengthOf(0);
    });

    it("should load from multiple typeRoots", () => {
      // Create two separate directories
      const dir1 = path.join(tempDir, "dir1");
      const dir2 = path.join(tempDir, "dir2");
      fs.mkdirSync(dir1);
      fs.mkdirSync(dir2);

      // Create manifest in first directory
      const manifest1 = {
        bindings: {
          console: {
            kind: "global",
            assembly: "Tsonic.Runtime",
            type: "Tsonic.Runtime.console",
          },
        },
      };
      fs.writeFileSync(
        path.join(dir1, "bindings.json"),
        JSON.stringify(manifest1, null, 2)
      );

      // Create manifest in second directory
      const manifest2 = {
        bindings: {
          fs: {
            kind: "module",
            assembly: "Tsonic.NodeApi",
            type: "Tsonic.NodeApi.fs",
          },
        },
      };
      fs.writeFileSync(
        path.join(dir2, "bindings.json"),
        JSON.stringify(manifest2, null, 2)
      );

      const registry = loadBindings([dir1, dir2]);

      expect(registry.getAllBindings()).to.have.lengthOf(2);
      expect(registry.getBinding("console")).not.to.equal(undefined);
      expect(registry.getBinding("fs")).not.to.equal(undefined);
    });

    it("should handle malformed JSON gracefully", () => {
      const manifestPath = path.join(tempDir, "bindings.json");
      fs.writeFileSync(manifestPath, "{ invalid json }");

      // Should not throw, just skip the bad file
      const registry = loadBindings([tempDir]);
      expect(registry.getAllBindings()).to.have.lengthOf(0);
    });

    it("should distinguish between global and module bindings", () => {
      const manifest = {
        bindings: {
          console: {
            kind: "global",
            assembly: "Tsonic.Runtime",
            type: "Tsonic.Runtime.console",
          },
          fs: {
            kind: "module",
            assembly: "Tsonic.NodeApi",
            type: "Tsonic.NodeApi.fs",
          },
        },
      };
      fs.writeFileSync(
        path.join(tempDir, "bindings.json"),
        JSON.stringify(manifest, null, 2)
      );

      const registry = loadBindings([tempDir]);

      const consoleBinding = registry.getBinding("console");
      expect(consoleBinding?.kind).to.equal("global");

      const fsBinding = registry.getBinding("fs");
      expect(fsBinding?.kind).to.equal("module");
    });

    it("loads native source-package globals from ambient globals.ts declarations", () => {
      const fixture = materializeLoadBindingsFixture(
        "source-package-ambient-globals"
      );

      try {
        const registry = loadBindings([fixture.root]);

        expect(registry.getBinding("Date")).to.deep.equal({
          kind: "global",
          assembly: "fixture.js",
          type: "fixture.js.Date",
          staticType: "fixture.js.Date",
          sourceImport: "@fixture/js/date-object.js",
        });
        expect(registry.getBinding("parseInt")).to.deep.equal({
          kind: "global",
          assembly: "fixture.js",
          type: "fixture.js.Globals.parseInt",
          staticType: "fixture.js.Globals.parseInt",
          sourceImport: "@fixture/js/Globals.js",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("loads source-owned globals from first-party source package metadata only", () => {
      const jsRoot = path.join(tempDir, "js-next");
      const jsSrcRoot = path.join(jsRoot, "src");
      fs.mkdirSync(jsSrcRoot, { recursive: true });
      fs.writeFileSync(
        path.join(jsRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/js",
            version: "10.0.49-next.0",
            type: "module",
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              namespace: "js",
              ambient: ["./globals.ts"],
              exports: {
                "./console.js": "./src/console.ts",
                "./Globals.js": "./src/Globals.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsRoot, "globals.ts"),
        [
          "declare global {",
          '  const console: typeof import("./src/console.js").console;',
          '  const String: typeof import("./src/Globals.js").String;',
          '  const Number: typeof import("./src/Globals.js").Number;',
          "}",
          "export {};",
          "",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(jsSrcRoot, "console.ts"),
        "export function console(..._args: unknown[]): void {}\n"
      );
      fs.writeFileSync(
        path.join(jsSrcRoot, "Globals.ts"),
        [
          "export function String(_value: unknown): string {",
          '  return "";',
          "}",
          "",
          "export function Number(_value: unknown): number {",
          "  return 0;",
          "}",
          "",
        ].join("\n")
      );

      const registry = loadBindings([jsRoot]);

      expect(registry.getBinding("console")).to.deep.equal({
        kind: "global",
        assembly: "js",
        type: "js.console.console",
        staticType: "js.console.console",
        sourceImport: "@tsonic/js/console.js",
      });
      expect(registry.getBinding("String")).to.deep.equal({
        kind: "global",
        assembly: "js",
        type: "js.Globals.String",
        staticType: "js.Globals.String",
        sourceImport: "@tsonic/js/Globals.js",
      });
      expect(registry.getBinding("Number")).to.deep.equal({
        kind: "global",
        assembly: "js",
        type: "js.Globals.Number",
        staticType: "js.Globals.Number",
        sourceImport: "@tsonic/js/Globals.js",
      });
    });

    it("loads native source-package globals from static-import type queries", () => {
      const fixture = materializeLoadBindingsFixture(
        "source-package-static-type-query"
      );

      try {
        const registry = loadBindings([fixture.root]);

        expect(registry.getBinding("Date")).to.deep.equal({
          kind: "global",
          assembly: "fixture.js",
          type: "fixture.js.Date",
          staticType: "fixture.js.Date",
          sourceImport: "@fixture/js/date-object.js",
        });
        expect(registry.getBinding("parseInt")).to.deep.equal({
          kind: "global",
          assembly: "fixture.js",
          type: "fixture.js.Globals.parseInt",
          staticType: "fixture.js.Globals.parseInt",
          sourceImport: "@fixture/js/Globals.js",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("marks ambient constructor globals as type-identifying for source packages", () => {
      const fixture = materializeLoadBindingsFixture(
        "ambient-constructor-type-identity"
      );

      try {
        const registry = loadBindings([fixture.root]);

        expect(registry.getBinding("Widget")).to.deep.equal({
          kind: "global",
          assembly: "fixture.js",
          type: "fixture.js.Widget",
          staticType: "fixture.js.Widget",
          sourceImport: "@fixture/js/Widget.js",
          typeSemantics: { contributesTypeIdentity: true },
        });
        expect(registry.getBinding("parse")).to.deep.equal({
          kind: "global",
          assembly: "fixture.js",
          type: "fixture.js.parse.parse",
          staticType: "fixture.js.parse.parse",
          sourceImport: "@fixture/js/parse.js",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("loads wrapper member source origins from explicit export targets", () => {
      const fixture = materializeLoadBindingsFixture(
        "wrapper-member-source-origin"
      );

      try {
        const registry = loadBindings([fixture.root]);
        const overload = registry
          .getClrMemberOverloads("fixture.js", "fixture.js.Number", "toString")
          ?.find((candidate) => candidate.sourceOrigin !== undefined);

        expect(overload?.sourceOrigin).to.deep.equal({
          filePath: fixture.path("src/number-object.ts"),
          exportName: "Number",
          memberName: "toString",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("maps ambient primitive wrapper instance members to static helper exports", () => {
      const fixture = materializeLoadBindingsFixture(
        "primitive-wrapper-helper"
      );

      try {
        const registry = loadBindings([fixture.root]);
        const overloads = registry.getMemberOverloads("Number", "toString");

        expect(overloads).to.not.equal(undefined);
        expect(overloads?.[0]?.isExtensionMethod).to.equal(true);
        expect(overloads?.[0]?.binding).to.deep.equal({
          assembly: "fixture.js",
          type: "fixture.js.Number",
          member: "toString",
        });
        expect(overloads?.[0]?.parameterCount).to.equal(0);
      } finally {
        fixture.cleanup();
      }
    });

    it("splits source-package class members into instance and static binding views", () => {
      const fixture = materializeLoadBindingsFixture("class-split-views");

      try {
        const registry = loadBindings([fixture.root]);
        const instanceType = registry.getType("Date");
        const staticType = registry.getType("Date$static");

        expect(
          instanceType?.members.map((member) => member.alias)
        ).to.deep.equal(["getTime"]);
        expect(
          instanceType?.members.some(
            (member) => member.isExtensionMethod === true
          )
        ).to.equal(false);

        expect(staticType?.members.map((member) => member.alias)).to.deep.equal(
          ["now"]
        );
        expect(
          staticType?.members.some(
            (member) => member.isExtensionMethod === true
          )
        ).to.equal(false);
      } finally {
        fixture.cleanup();
      }
    });

    it("derives ambient interface members from matching global value type queries", () => {
      const fixture = materializeLoadBindingsFixture(
        "ambient-interface-members"
      );

      try {
        const registry = loadBindings([fixture.root]);

        expect(
          registry.getMemberOverloads("Array", "push")?.map((member) => ({
            type: member.binding.type,
            member: member.binding.member,
            isExtensionMethod: member.isExtensionMethod,
          }))
        ).to.deep.equal([
          {
            type: "fixture.js.Array",
            member: "push",
            isExtensionMethod: undefined,
          },
        ]);

        expect(
          registry.getMemberOverloads("String", "trim")?.map((member) => ({
            type: member.binding.type,
            member: member.binding.member,
            isExtensionMethod: member.isExtensionMethod,
          }))
        ).to.deep.equal([
          {
            type: "fixture.js.String",
            member: "trim",
            isExtensionMethod: true,
          },
        ]);
      } finally {
        fixture.cleanup();
      }
    });

    it("prefers explicit source exports for ambient interface instance members and excludes non-public class members", () => {
      const fixture = materializeLoadBindingsFixture("explicit-source-exports");

      try {
        const registry = loadBindings([fixture.root]);

        expect(registry.getMemberOverloads("String", "parseInt")).to.equal(
          undefined
        );
        expect(registry.getMemberOverloads("Array", "valuesStore")).to.equal(
          undefined
        );
        expect(registry.getMemberOverloads("Array", "createWrapped")).to.equal(
          undefined
        );

        expect(
          registry.getMemberOverloads("String", "trim")?.map((member) => ({
            type: member.binding.type,
            member: member.binding.member,
            parameterCount: member.parameterCount,
          }))
        ).to.deep.equal([
          {
            type: "fixture.js.String",
            member: "trim",
            parameterCount: 0,
          },
        ]);

        expect(
          registry
            .getMemberOverloads("String", "charCodeAt")
            ?.map((member) => ({
              type: member.binding.type,
              member: member.binding.member,
              parameterCount: member.parameterCount,
            }))
        ).to.deep.equal([
          {
            type: "fixture.js.String",
            member: "charCodeAt",
            parameterCount: 1,
          },
        ]);

        expect(
          registry.getMemberOverloads("Array", "slice")?.map((member) => ({
            type: member.binding.type,
            member: member.binding.member,
          }))
        ).to.deep.equal([
          {
            type: "fixture.js.Array",
            member: "slice",
          },
        ]);
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps source-package simple aliases authoritative regardless of load order", () => {
      const fixture = materializeLoadBindingsFixture(
        "authoritative-simple-aliases"
      );

      try {
        const runtimeRoot = fixture.path("node_modules/@fixture/runtime");

        for (const roots of [
          [fixture.root],
          [runtimeRoot, fixture.root],
          [fixture.root, runtimeRoot],
        ]) {
          const registry = loadBindings(roots);

          expect(registry.getType("Array")?.name).to.equal("fixture.js.Array");
          expect(registry.getType("fixture.js.Array")?.alias).to.equal("Array");
          expect(
            registry.getMemberOverloads("Array", "push")?.[0]?.binding.type
          ).to.equal("fixture.js.Array");
          expect(registry.getType("String")?.name).to.equal(
            "fixture.js.String"
          );
          expect(registry.getType("fixture.js.String")?.alias).to.equal(
            "String"
          );
          expect(
            registry.getMemberOverloads("String", "startsWith")?.[0]?.binding
              .type
          ).to.equal("fixture.js.String");
          expect(registry.getType("Boolean")?.name).to.equal(
            "fixture.js.Boolean"
          );
          expect(registry.getType("fixture.js.Boolean")?.alias).to.equal(
            "Boolean"
          );
          expect(
            registry.getMemberOverloads("Boolean", "toString")?.[0]?.binding
              .type
          ).to.equal("fixture.js.Boolean");
          expect(registry.getType("System.Array")?.name).to.equal(
            "System.Array"
          );
          expect(registry.getType("System.Array")?.alias).to.equal(
            "System.Array"
          );
          expect(
            registry.getMemberOverloads("System.Array", "Resize")?.[0]?.binding
              .type
          ).to.equal("System.Array");
          expect(registry.getType("System.String")?.name).to.equal(
            "System.String"
          );
          expect(registry.getType("System.String")?.alias).to.equal(
            "System.String"
          );
          expect(
            registry.getMemberOverloads("System.String", "StartsWith")?.[0]
              ?.binding.type
          ).to.equal("System.String");
          expect(registry.getType("System.Boolean")?.name).to.equal(
            "System.Boolean"
          );
          expect(registry.getType("System.Boolean")?.alias).to.equal(
            "System.Boolean"
          );
          expect(
            registry.getMemberOverloads("System.Boolean", "ToString")?.[0]
              ?.binding.type
          ).to.equal("System.Boolean");
        }
      } finally {
        fixture.cleanup();
      }
    });

    it("should load transitive bindings from non-@tsonic dependencies", () => {
      const fixture = materializeFrontendFixture(
        "program/load-bindings/transitive-non-tsonic-dependency"
      );

      try {
        const surfaceRoot = fixture.path(
          "workspace/node_modules/@acme/surface-web"
        );

        const registry = loadBindings([surfaceRoot]);
        const binding = registry.getBinding("runtimeLog");
        expect(binding).to.deep.equal({
          kind: "global",
          assembly: "Acme.Runtime",
          type: "Acme.Runtime.Log",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("should traverse top-level dependency graph even when the root package has no bindings", () => {
      const fixture = materializeFrontendFixture(
        "program/load-bindings/root-without-bindings-dependency"
      );

      try {
        const rootPkg = fixture.path(
          "workspace-no-bindings-root/node_modules/@acme/root"
        );

        const registry = loadBindings([rootPkg]);
        const binding = registry.getBinding("depGlobal");
        expect(binding).to.deep.equal({
          kind: "global",
          assembly: "Acme.Dep",
          type: "Acme.Dep.Global",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("should load transitive bindings from sibling workspace versioned packages", () => {
      const fixture = materializeFrontendFixture(
        "program/load-bindings/sibling-versioned-packages"
      );

      try {
        const globalsRoot = fixture.path("workspace/globals/versions/10");

        const registry = loadBindings([globalsRoot]);
        const binding = registry.getBinding("SerializableAttribute");
        expect(binding).to.deep.equal({
          kind: "global",
          assembly: "System.Runtime",
          type: "System.SerializableAttribute",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("ignores local bindings files for source packages while still traversing dependencies", () => {
      const fixture = materializeFrontendFixture(
        "program/load-bindings/ignore-local-source-bindings"
      );

      try {
        const sourceRoot = fixture.path("workspace/node_modules/@tsonic/js");

        const registry = loadBindings([sourceRoot]);

        expect(registry.getBinding("console")).to.equal(undefined);
        expect(registry.getBinding("Guid")).to.deep.equal({
          kind: "module",
          assembly: "System.Private.CoreLib",
          type: "System.Guid",
        });
      } finally {
        fixture.cleanup();
      }
    });
  });
});
