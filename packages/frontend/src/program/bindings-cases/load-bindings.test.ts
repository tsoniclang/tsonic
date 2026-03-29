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
            useStandardLib: false,
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
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
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
        path.join(tempDir, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            source: {
              namespace: "fixture.js",
              ambient: ["./globals.ts"],
              exports: {
                "./date-object.js": "./src/date-object.ts",
                "./Globals.js": "./src/Globals.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(tempDir, "globals.ts"),
        [
          "declare global {",
          '  const Date: typeof import("./src/date-object.js").Date;',
          "  function parseInt(value: string, radix?: number): number;",
          "}",
          "",
          "export {};",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(tempDir, "src/date-object.ts"),
        [
          "export class Date {",
          '  public toISOString(): string { return \"\"; }',
          "}",
          "",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(tempDir, "src/Globals.ts"),
        [
          "export const parseInt = (value: string, radix?: number): number => {",
          "  void value;",
          "  void radix;",
          "  return 0;",
          "};",
          "",
        ].join("\n")
      );

      const registry = loadBindings([tempDir]);

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
    });

    it("loads native source-package globals from static-import type queries", () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
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
        path.join(tempDir, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            source: {
              namespace: "fixture.js",
              ambient: ["./globals.ts"],
              exports: {
                "./date-object.js": "./src/date-object.ts",
                "./Globals.js": "./src/Globals.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(tempDir, "globals.ts"),
        [
          'import { Date as SourceDate } from "./src/date-object.js";',
          'import { parseInt as SourceParseInt } from "./src/Globals.js";',
          "",
          "declare global {",
          "  const Date: typeof SourceDate;",
          "  const parseInt: typeof SourceParseInt;",
          "}",
          "",
          "export {};",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(tempDir, "src/date-object.ts"),
        [
          "export class Date {",
          '  public toISOString(): string { return \"\"; }',
          "}",
          "",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(tempDir, "src/Globals.ts"),
        [
          "export const parseInt = (value: string, radix?: number): number => {",
          "  void value;",
          "  void radix;",
          "  return 0;",
          "};",
          "",
        ].join("\n")
      );

      const registry = loadBindings([tempDir]);

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
    });

    it("marks ambient constructor globals as type-identifying for source packages", () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
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
        path.join(tempDir, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            source: {
              namespace: "fixture.js",
              ambient: ["./globals.ts"],
              exports: {
                "./Widget.js": "./src/Widget.ts",
                "./parse.js": "./src/parse.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(tempDir, "globals.ts"),
        [
          'import { Widget as SourceWidget } from "./src/Widget.js";',
          'import { parse as SourceParse } from "./src/parse.js";',
          "",
          "declare global {",
          "  interface Widget extends SourceWidget {}",
          "  const Widget: typeof SourceWidget;",
          "  const parse: typeof SourceParse;",
          "}",
          "",
          "export {};",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(tempDir, "src/Widget.ts"),
        [
          "export class Widget {",
          "  public readonly ok = true;",
          "}",
          "",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(tempDir, "src/parse.ts"),
        [
          "export const parse = (value: string): string => value;",
          "",
        ].join("\n")
      );

      const registry = loadBindings([tempDir]);

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
    });

    it("loads wrapper member source origins from explicit export targets", () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
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
        path.join(tempDir, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            source: {
              namespace: "fixture.js",
              exports: {
                "./Number.js": "./src/number-object.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(tempDir, "src/number-object.ts"),
        [
          "export abstract class Number {",
          "  public static toString(value: number): string {",
          "    return String(value);",
          "  }",
          "}",
          "",
        ].join("\n")
      );

      const registry = loadBindings([tempDir]);
      const overload = registry
        .getClrMemberOverloads("fixture.js", "fixture.js.Number", "toString")
        ?.find((candidate) => candidate.sourceOrigin !== undefined);

      expect(overload?.sourceOrigin).to.deep.equal({
        filePath: path.join(tempDir, "src/number-object.ts"),
        exportName: "Number",
        memberName: "toString",
      });
    });

    it("maps ambient primitive wrapper instance members to static helper exports", () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
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
        path.join(tempDir, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            source: {
              namespace: "fixture.js",
              ambient: ["./globals.ts"],
              exports: {
                "./Number.js": "./src/number-object.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(tempDir, "globals.ts"),
        [
          "import { Number as SourceNumberStatics } from './src/number-object.js';",
          "declare global {",
          "  interface Number {",
          "    toString(): string;",
          "  }",
          "  const Number: typeof SourceNumberStatics;",
          "}",
          "export {};",
          "",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(tempDir, "src/number-object.ts"),
        [
          "export abstract class Number {",
          "  public static toString(value: number): string {",
          "    return String(value);",
          "  }",
          "}",
          "",
        ].join("\n")
      );

      const registry = loadBindings([tempDir]);
      const overloads = registry.getMemberOverloads("Number", "toString");

      expect(overloads).to.not.equal(undefined);
      expect(overloads?.[0]?.isExtensionMethod).to.equal(true);
      expect(overloads?.[0]?.binding).to.deep.equal({
        assembly: "fixture.js",
        type: "fixture.js.Number",
        member: "toString",
      });
      expect(overloads?.[0]?.parameterCount).to.equal(0);
    });

    it("splits source-package class members into instance and static binding views", () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
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
        path.join(tempDir, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            source: {
              namespace: "fixture.js",
              ambient: ["./globals.ts"],
              exports: {
                "./Date.js": "./src/date-object.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(tempDir, "globals.ts"),
        [
          'import { Date as SourceDate } from "./src/date-object.js";',
          "",
          "declare global {",
          "  interface Date extends SourceDate {}",
          "  const Date: typeof SourceDate;",
          "}",
          "",
          "export {};",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(tempDir, "src/date-object.ts"),
        [
          "export class Date {",
          "  public static now(): number {",
          "    return 0;",
          "  }",
          "",
          "  public getTime(): number {",
          "    return 1;",
          "  }",
          "}",
          "",
        ].join("\n")
      );

      const registry = loadBindings([tempDir]);
      const instanceType = registry.getType("Date");
      const staticType = registry.getType("Date$static");

      expect(instanceType?.members.map((member) => member.alias)).to.deep.equal([
        "getTime",
      ]);
      expect(
        instanceType?.members.some((member) => member.isExtensionMethod === true)
      ).to.equal(false);

      expect(staticType?.members.map((member) => member.alias)).to.deep.equal([
        "now",
      ]);
      expect(
        staticType?.members.some((member) => member.isExtensionMethod === true)
      ).to.equal(false);
    });

    it("derives ambient interface members from matching global value type queries", () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
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
        path.join(tempDir, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            source: {
              namespace: "fixture.js",
              ambient: ["./globals.ts"],
              exports: {
                "./Array.js": "./src/array-object.ts",
                "./String.js": "./src/String.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(tempDir, "globals.ts"),
        [
          'import { Array as SourceArray } from "./src/array-object.js";',
          'import { String as SourceString } from "./src/String.js";',
          "",
          "declare global {",
          "  interface Array<T> {",
          "    push(...items: T[]): number;",
          "  }",
          "  interface ArrayConstructor {}",
          "  const Array: ArrayConstructor & typeof SourceArray;",
          "",
          "  interface String {",
          "    trim(): string;",
          "  }",
          "  const String: typeof SourceString;",
          "}",
          "",
          "export {};",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(tempDir, "src/array-object.ts"),
        [
          "export class Array<T> {",
          "  public static from<TValue>(values: TValue[]): Array<TValue> {",
          "    return new Array<TValue>();",
          "  }",
          "",
          "  public push(...items: T[]): number {",
          "    return items.length;",
          "  }",
          "}",
          "",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(tempDir, "src/String.ts"),
        [
          "export const trim = (value: string): string => value;",
          "",
        ].join("\n")
      );

      const registry = loadBindings([tempDir]);

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
    });

    it("prefers explicit source exports for ambient interface instance members and excludes non-public class members", () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
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
        path.join(tempDir, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            source: {
              namespace: "fixture.js",
              ambient: ["./globals.ts"],
              exports: {
                "./Array.js": "./src/array-object.ts",
                "./Globals.js": "./src/Globals.ts",
                "./String.js": "./src/String.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(tempDir, "globals.ts"),
        [
          'import { Array as SourceArray } from "./src/array-object.js";',
          'import { String as SourceString } from "./src/Globals.js";',
          "",
          "declare global {",
          "  interface Array<T> {",
          "    push(...items: T[]): number;",
          "    slice(start?: number, end?: number): T[];",
          "  }",
          "  interface ArrayConstructor {}",
          "  const Array: ArrayConstructor & typeof SourceArray;",
          "",
          "  interface String {",
          "    trim(): string;",
          "    charCodeAt(index: number): number;",
          "  }",
          "  const String: typeof SourceString;",
          "}",
          "",
          "export {};",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(tempDir, "src/array-object.ts"),
        [
          "export class Array<T> {",
          "  private readonly valuesStore: T[] = [];",
          "",
          "  private createWrapped(values: readonly T[] | T[]): Array<T> {",
          "    void values;",
          "    return new Array<T>();",
          "  }",
          "",
          "  public push(...items: T[]): number {",
          "    return items.length;",
          "  }",
          "",
          "  public slice(start?: number, end?: number): T[] {",
          "    void start;",
          "    void end;",
          "    return [];",
          "  }",
          "}",
          "",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(tempDir, "src/Globals.ts"),
        [
          "export const parseInt = (value: string): number => {",
          "  void value;",
          "  return 0;",
          "};",
          "",
          "export const String = (value?: unknown): string => {",
          "  void value;",
          "  return \"\";",
          "};",
          "",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(tempDir, "src/String.ts"),
        [
          "export const trim = (value: string): string => value;",
          "export const charCodeAt = (value: string, index: number): number => {",
          "  void value;",
          "  return index;",
          "};",
          "export const fromCharCode = (...codes: number[]): string => {",
          "  void codes;",
          "  return \"\";",
          "};",
          "",
        ].join("\n")
      );

      const registry = loadBindings([tempDir]);

      expect(registry.getMemberOverloads("String", "parseInt")).to.equal(undefined);
      expect(registry.getMemberOverloads("Array", "valuesStore")).to.equal(undefined);
      expect(registry.getMemberOverloads("Array", "createWrapped")).to.equal(undefined);

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
        registry.getMemberOverloads("String", "charCodeAt")?.map((member) => ({
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
    });

    it("keeps source-package simple aliases authoritative regardless of load order", () => {
      fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
      const runtimeRoot = path.join(
        tempDir,
        "node_modules",
        "@fixture",
        "runtime"
      );
      fs.mkdirSync(runtimeRoot, { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          {
            name: "@fixture/js",
            version: "1.0.0",
            type: "module",
            dependencies: {
              "@fixture/runtime": "1.0.0",
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(tempDir, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            source: {
              namespace: "fixture.js",
              ambient: ["./globals.ts"],
              exports: {
                "./Array.js": "./src/array-object.ts",
                "./String.js": "./src/string-object.ts",
                "./Boolean.js": "./src/boolean-object.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(tempDir, "globals.ts"),
        [
          'import { Array as SourceArray } from "./src/array-object.js";',
          'import { String as SourceString } from "./src/string-object.js";',
          'import { Boolean as SourceBoolean } from "./src/boolean-object.js";',
          "",
          "declare global {",
          "  interface Array<T> {",
          "    push(...items: T[]): number;",
          "  }",
          "  interface ArrayConstructor {}",
          "  const Array: ArrayConstructor & typeof SourceArray;",
          "",
          "  interface String {",
          "    startsWith(search: string): boolean;",
          "  }",
          "  const String: typeof SourceString;",
          "",
          "  interface Boolean {",
          "    toString(): string;",
          "  }",
          "  const Boolean: typeof SourceBoolean;",
          "}",
          "",
          "export {};",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(tempDir, "src/array-object.ts"),
        [
          "export class Array<T> {",
          "  public push(...items: T[]): number {",
            "    return items.length;",
          "  }",
          "}",
          "",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(tempDir, "src/string-object.ts"),
        [
          "export class String {",
          "  public startsWith(search: string): boolean {",
          "    void search;",
          "    return true;",
          "  }",
          "}",
          "",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(tempDir, "src/boolean-object.ts"),
        [
          "export class Boolean {",
          "  public toString(): string {",
          "    return \"true\";",
          "  }",
          "}",
          "",
        ].join("\n")
      );

      fs.writeFileSync(
        path.join(runtimeRoot, "package.json"),
        JSON.stringify(
          {
            name: "@fixture/runtime",
            version: "1.0.0",
            type: "module",
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(runtimeRoot, "bindings.json"),
        JSON.stringify(
          {
            namespace: "System",
            types: [
              {
                clrName: "System.Array",
                assemblyName: "System.Runtime",
                kind: "Class",
                methods: [
                  {
                    clrName: "Resize",
                    declaringClrType: "System.Array",
                    declaringAssemblyName: "System.Runtime",
                  },
                ],
                properties: [],
                fields: [],
              },
              {
                clrName: "System.String",
                assemblyName: "System.Runtime",
                kind: "Class",
                methods: [
                  {
                    clrName: "StartsWith",
                    declaringClrType: "System.String",
                    declaringAssemblyName: "System.Runtime",
                  },
                ],
                properties: [],
                fields: [],
              },
              {
                clrName: "System.Boolean",
                assemblyName: "System.Runtime",
                kind: "Struct",
                methods: [
                  {
                    clrName: "ToString",
                    declaringClrType: "System.Boolean",
                    declaringAssemblyName: "System.Runtime",
                  },
                ],
                properties: [],
                fields: [],
              },
            ],
          },
          null,
          2
        )
      );

      for (const roots of [
        [tempDir],
        [runtimeRoot, tempDir],
        [tempDir, runtimeRoot],
      ]) {
        const registry = loadBindings(roots);

        expect(registry.getType("Array")?.name).to.equal("fixture.js.Array");
        expect(registry.getType("fixture.js.Array")?.alias).to.equal("Array");
        expect(
          registry.getMemberOverloads("Array", "push")?.[0]?.binding.type
        ).to.equal("fixture.js.Array");
        expect(registry.getType("String")?.name).to.equal("fixture.js.String");
        expect(registry.getType("fixture.js.String")?.alias).to.equal("String");
        expect(
          registry.getMemberOverloads("String", "startsWith")?.[0]?.binding.type
        ).to.equal("fixture.js.String");
        expect(registry.getType("Boolean")?.name).to.equal("fixture.js.Boolean");
        expect(registry.getType("fixture.js.Boolean")?.alias).to.equal("Boolean");
        expect(
          registry.getMemberOverloads("Boolean", "toString")?.[0]?.binding.type
        ).to.equal("fixture.js.Boolean");
        expect(registry.getType("System.Array")?.name).to.equal("System.Array");
        expect(registry.getType("System.Array")?.alias).to.equal("System.Array");
        expect(
          registry.getMemberOverloads("System.Array", "Resize")?.[0]?.binding.type
        ).to.equal("System.Array");
        expect(registry.getType("System.String")?.name).to.equal("System.String");
        expect(registry.getType("System.String")?.alias).to.equal("System.String");
        expect(
          registry.getMemberOverloads("System.String", "StartsWith")?.[0]
            ?.binding.type
        ).to.equal("System.String");
        expect(registry.getType("System.Boolean")?.name).to.equal("System.Boolean");
        expect(registry.getType("System.Boolean")?.alias).to.equal("System.Boolean");
        expect(
          registry.getMemberOverloads("System.Boolean", "ToString")?.[0]
            ?.binding.type
        ).to.equal("System.Boolean");
      }
    });

    it("should load transitive bindings from non-@tsonic dependencies", () => {
      const workspaceRoot = path.join(tempDir, "workspace");
      const surfaceRoot = path.join(
        workspaceRoot,
        "node_modules",
        "@acme",
        "surface-web"
      );
      const runtimeRoot = path.join(
        workspaceRoot,
        "node_modules",
        "@acme",
        "runtime"
      );

      fs.mkdirSync(surfaceRoot, { recursive: true });
      fs.mkdirSync(runtimeRoot, { recursive: true });

      fs.writeFileSync(
        path.join(surfaceRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/surface-web",
            version: "1.0.0",
            dependencies: {
              "@acme/runtime": "1.0.0",
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(surfaceRoot, "tsonic.surface.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            id: "web",
            extends: ["clr"],
          },
          null,
          2
        )
      );

      fs.writeFileSync(
        path.join(runtimeRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/runtime",
            version: "1.0.0",
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(runtimeRoot, "bindings.json"),
        JSON.stringify(
          {
            bindings: {
              runtimeLog: {
                kind: "global",
                assembly: "Acme.Runtime",
                type: "Acme.Runtime.Log",
              },
            },
          },
          null,
          2
        )
      );

      const registry = loadBindings([surfaceRoot]);
      const binding = registry.getBinding("runtimeLog");
      expect(binding).to.deep.equal({
        kind: "global",
        assembly: "Acme.Runtime",
        type: "Acme.Runtime.Log",
      });
    });

    it("should traverse top-level dependency graph even when the root package has no bindings", () => {
      const workspaceRoot = path.join(tempDir, "workspace-no-bindings-root");
      const rootPkg = path.join(workspaceRoot, "node_modules", "@acme", "root");
      const depPkg = path.join(workspaceRoot, "node_modules", "@acme", "dep");

      fs.mkdirSync(rootPkg, { recursive: true });
      fs.mkdirSync(depPkg, { recursive: true });

      fs.writeFileSync(
        path.join(rootPkg, "package.json"),
        JSON.stringify(
          {
            name: "@acme/root",
            version: "1.0.0",
            dependencies: {
              "@acme/dep": "1.0.0",
            },
          },
          null,
          2
        )
      );

      fs.writeFileSync(
        path.join(depPkg, "package.json"),
        JSON.stringify(
          {
            name: "@acme/dep",
            version: "1.0.0",
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(depPkg, "bindings.json"),
        JSON.stringify(
          {
            bindings: {
              depGlobal: {
                kind: "global",
                assembly: "Acme.Dep",
                type: "Acme.Dep.Global",
              },
            },
          },
          null,
          2
        )
      );

      const registry = loadBindings([rootPkg]);
      const binding = registry.getBinding("depGlobal");
      expect(binding).to.deep.equal({
        kind: "global",
        assembly: "Acme.Dep",
        type: "Acme.Dep.Global",
      });
    });

    it("should load transitive bindings from sibling workspace versioned packages", () => {
      const workspaceRoot = path.join(tempDir, "tsoniclang");
      const globalsRoot = path.join(workspaceRoot, "globals", "versions", "10");
      const dotnetRoot = path.join(workspaceRoot, "dotnet", "versions", "10");

      fs.mkdirSync(globalsRoot, { recursive: true });
      fs.mkdirSync(dotnetRoot, { recursive: true });

      fs.writeFileSync(
        path.join(globalsRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/globals",
            version: "1.0.0",
            dependencies: {
              "@tsonic/dotnet": "1.0.0",
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(globalsRoot, "tsonic.surface.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            id: "clr",
            extends: [],
            requiredTypeRoots: ["."],
          },
          null,
          2
        )
      );

      fs.writeFileSync(
        path.join(dotnetRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/dotnet",
            version: "1.0.0",
          },
          null,
          2
        )
      );
      fs.writeFileSync(path.join(dotnetRoot, "System.d.ts"), "export {};\n");
      fs.mkdirSync(path.join(dotnetRoot, "System"), { recursive: true });
      fs.writeFileSync(
        path.join(dotnetRoot, "System", "bindings.json"),
        JSON.stringify(
          {
            bindings: {
              SerializableAttribute: {
                kind: "global",
                assembly: "System.Runtime",
                type: "System.SerializableAttribute",
              },
            },
          },
          null,
          2
        )
      );

      const registry = loadBindings([globalsRoot]);
      const binding = registry.getBinding("SerializableAttribute");
      expect(binding).to.deep.equal({
        kind: "global",
        assembly: "System.Runtime",
        type: "System.SerializableAttribute",
      });
    });

    it("ignores local bindings files for source packages while still traversing dependencies", () => {
      const sourceRoot = path.join(tempDir, "node_modules/@tsonic/js");
      const dependencyRoot = path.join(tempDir, "node_modules/@tsonic/dotnet");
      fs.mkdirSync(sourceRoot, { recursive: true });
      fs.mkdirSync(dependencyRoot, { recursive: true });

      fs.writeFileSync(
        path.join(sourceRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/js",
            version: "1.0.0",
            type: "module",
            dependencies: {
              "@tsonic/dotnet": "1.0.0",
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(sourceRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              namespace: "js",
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(path.join(sourceRoot, "bindings.json"), JSON.stringify({
        bindings: {
          console: {
            kind: "global",
            assembly: "js",
            type: "js.console",
          },
        },
      }, null, 2));

      fs.writeFileSync(
        path.join(dependencyRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/dotnet",
            version: "1.0.0",
            type: "module",
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(dependencyRoot, "bindings.json"),
        JSON.stringify(
          {
            bindings: {
              Guid: {
                kind: "module",
                assembly: "System.Private.CoreLib",
                type: "System.Guid",
              },
            },
          },
          null,
          2
        )
      );

      const registry = loadBindings([sourceRoot]);

      expect(registry.getBinding("console")).to.equal(undefined);
      expect(registry.getBinding("Guid")).to.deep.equal({
        kind: "module",
        assembly: "System.Private.CoreLib",
        type: "System.Guid",
      });
    });
  });
});
