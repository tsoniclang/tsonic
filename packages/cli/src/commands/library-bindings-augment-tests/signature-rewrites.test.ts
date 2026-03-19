import { describe, it } from "mocha";
import { expect } from "chai";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ResolvedConfig } from "../../types.js";
import { augmentLibraryBindingsFromSource } from "../library-bindings-augment.js";

describe("library-bindings-augment", function () {
  this.timeout(30000);
  it("rewrites const delegate exports to source signatures and injects required type imports", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-facade-const-delegate-"));
    try {
      const srcDir = join(dir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(
        join(srcDir, "index.ts"),
        [
          'import type { int } from "@tsonic/core/types.js";',
          "",
          "export const bulkUpdate = async (",
          "  settings: Record<string, unknown>",
          "): Promise<int> => {",
          "  void settings;",
          "  return 1;",
          "};",
          "",
        ].join("\n"),
        "utf-8"
      );

      const bindingsOutDir = join(dir, "dist", "tsonic", "bindings");
      const internalDir = join(bindingsOutDir, "TestApp", "internal");
      mkdirSync(internalDir, { recursive: true });
      writeFileSync(join(internalDir, "index.d.ts"), "", "utf-8");

      const facadePath = join(bindingsOutDir, "TestApp.d.ts");
      writeFileSync(
        facadePath,
        [
          "// Namespace: TestApp",
          "import * as Internal from './TestApp/internal/index.js';",
          "",
          "export type Service_bulkUpdate__Delegate = Internal.Service_bulkUpdate__Delegate;",
          "export declare const bulkUpdate: Internal.Service_bulkUpdate__Delegate;",
          "",
        ].join("\n"),
        "utf-8"
      );

      const config = {
        workspaceRoot: dir,
        projectRoot: dir,
        sourceRoot: "src",
        rootNamespace: "TestApp",
        entryPoint: "src/index.ts",
        typeRoots: [],
        libraries: [],
      } as unknown as ResolvedConfig;

      const result = augmentLibraryBindingsFromSource(config, bindingsOutDir);
      expect(result.ok, result.ok ? undefined : result.error).to.equal(true);

      const patched = readFileSync(facadePath, "utf-8");
      expect(patched).to.include(
        "export declare function bulkUpdate(settings: Record<string, unknown>): Promise<int>;"
      );
      expect(patched).to.not.include("export declare const bulkUpdate:");
      expect(patched).to.include(
        "import type { int } from '@tsonic/core/types.js';"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("injects required imports for value-imported source types in rewritten delegate signatures", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-facade-value-import-"));
    try {
      const srcDir = join(dir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(
        join(srcDir, "index.ts"),
        [
          'import { List } from "@tsonic/dotnet/System.Collections.Generic.js";',
          "",
          "export const createNames = (): List<string> => {",
          "  return new List<string>();",
          "};",
          "",
        ].join("\n"),
        "utf-8"
      );

      const bindingsOutDir = join(dir, "dist", "tsonic", "bindings");
      const internalDir = join(bindingsOutDir, "TestApp", "internal");
      mkdirSync(internalDir, { recursive: true });
      writeFileSync(join(internalDir, "index.d.ts"), "", "utf-8");

      const facadePath = join(bindingsOutDir, "TestApp.d.ts");
      writeFileSync(
        facadePath,
        [
          "// Namespace: TestApp",
          "import * as Internal from './TestApp/internal/index.js';",
          "",
          "export type Service_createNames__Delegate = Internal.Service_createNames__Delegate;",
          "export declare const createNames: Internal.Service_createNames__Delegate;",
          "",
        ].join("\n"),
        "utf-8"
      );

      const config = {
        workspaceRoot: dir,
        projectRoot: dir,
        sourceRoot: "src",
        rootNamespace: "TestApp",
        entryPoint: "src/index.ts",
        typeRoots: [],
        libraries: [],
      } as unknown as ResolvedConfig;

      const result = augmentLibraryBindingsFromSource(config, bindingsOutDir);
      expect(result.ok, result.ok ? undefined : result.error).to.equal(true);

      const patched = readFileSync(facadePath, "utf-8");
      expect(patched).to.include(
        "import type { List } from '@tsonic/dotnet/System.Collections.Generic.js';"
      );
      expect(patched).to.include(
        "export declare function createNames(): List<string>;"
      );
      expect(patched).to.not.include("export declare const createNames:");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rewrites delegate exports discovered through local source imports without needing the full frontend graph", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-facade-local-import-"));
    try {
      const srcDir = join(dir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(
        join(srcDir, "index.ts"),
        [
          'import { bulkUpdate } from "./service.js";',
          "",
          "export const run = () => bulkUpdate({});",
          "",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(srcDir, "service.ts"),
        [
          'import type { int } from "@tsonic/core/types.js";',
          "",
          "export const bulkUpdate = async (",
          "  settings: Record<string, unknown>",
          "): Promise<int> => {",
          "  void settings;",
          "  return 1;",
          "};",
          "",
        ].join("\n"),
        "utf-8"
      );

      const bindingsOutDir = join(dir, "dist", "tsonic", "bindings");
      const internalDir = join(bindingsOutDir, "TestApp", "internal");
      mkdirSync(internalDir, { recursive: true });
      writeFileSync(join(internalDir, "index.d.ts"), "", "utf-8");

      const facadePath = join(bindingsOutDir, "TestApp.d.ts");
      writeFileSync(
        facadePath,
        [
          "// Namespace: TestApp",
          "import * as Internal from './TestApp/internal/index.js';",
          "",
          "export type Service_bulkUpdate__Delegate = Internal.Service_bulkUpdate__Delegate;",
          "export declare const bulkUpdate: Internal.Service_bulkUpdate__Delegate;",
          "",
        ].join("\n"),
        "utf-8"
      );

      const config = {
        workspaceRoot: dir,
        projectRoot: dir,
        sourceRoot: "src",
        rootNamespace: "TestApp",
        entryPoint: "src/index.ts",
        typeRoots: [],
        libraries: [],
      } as unknown as ResolvedConfig;

      const result = augmentLibraryBindingsFromSource(config, bindingsOutDir);
      expect(result.ok, result.ok ? undefined : result.error).to.equal(true);

      const patched = readFileSync(facadePath, "utf-8");
      expect(patched).to.include(
        "export declare function bulkUpdate(settings: Record<string, unknown>): Promise<int>;"
      );
      expect(patched).to.not.include("export declare const bulkUpdate:");
      expect(patched).to.include(
        "import type { int } from '@tsonic/core/types.js';"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("optionalizes brand markers for non-exported source interfaces used in exported signatures", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-local-interface-brand-"));
    try {
      const srcDir = join(dir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(
        join(srcDir, "index.ts"),
        [
          "interface LocalInput {",
          "  value: string;",
          "}",
          "",
          "export const useLocalInput = async (",
          "  input: LocalInput",
          "): Promise<boolean> => {",
          "  void input;",
          "  return true;",
          "};",
          "",
        ].join("\n"),
        "utf-8"
      );

      const bindingsOutDir = join(dir, "dist", "tsonic", "bindings");
      const internalDir = join(bindingsOutDir, "TestApp", "internal");
      mkdirSync(internalDir, { recursive: true });
      const internalIndex = join(internalDir, "index.d.ts");
      writeFileSync(
        internalIndex,
        [
          "export interface LocalInput$instance {",
          "  readonly __tsonic_type_TestApp_LocalInput: never;",
          "  value: string;",
          "}",
          "",
        ].join("\n"),
        "utf-8"
      );

      const facadePath = join(bindingsOutDir, "TestApp.d.ts");
      writeFileSync(
        facadePath,
        [
          "// Namespace: TestApp",
          "import * as Internal from './TestApp/internal/index.js';",
          "",
          "export declare function useLocalInput(input: Internal.LocalInput): Promise<boolean>;",
          "",
        ].join("\n"),
        "utf-8"
      );

      const config = {
        workspaceRoot: dir,
        projectRoot: dir,
        sourceRoot: "src",
        rootNamespace: "TestApp",
        entryPoint: "src/index.ts",
        typeRoots: [],
        libraries: [],
      } as unknown as ResolvedConfig;

      const result = augmentLibraryBindingsFromSource(config, bindingsOutDir);
      expect(result.ok, result.ok ? undefined : result.error).to.equal(true);

      const patched = readFileSync(internalIndex, "utf-8");
      expect(patched).to.include(
        "readonly __tsonic_type_TestApp_LocalInput?: never;"
      );
      expect(patched).to.not.include(
        "readonly __tsonic_type_TestApp_LocalInput: never;"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("optionalizes brand markers for non-exported structural type aliases", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-local-alias-brand-"));
    try {
      const srcDir = join(dir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(
        join(srcDir, "index.ts"),
        [
          "type LocalPayload = {",
          "  id: string;",
          "};",
          "",
          "export const useLocalAlias = async (",
          "  payload: LocalPayload",
          "): Promise<boolean> => {",
          "  void payload;",
          "  return true;",
          "};",
          "",
        ].join("\n"),
        "utf-8"
      );

      const bindingsOutDir = join(dir, "dist", "tsonic", "bindings");
      const internalDir = join(bindingsOutDir, "TestApp", "internal");
      mkdirSync(internalDir, { recursive: true });
      const internalIndex = join(internalDir, "index.d.ts");
      writeFileSync(
        internalIndex,
        [
          "export interface LocalPayload__Alias$instance {",
          "  readonly __tsonic_type_TestApp_LocalPayload__Alias: never;",
          "  id: string;",
          "}",
          "",
        ].join("\n"),
        "utf-8"
      );

      const facadePath = join(bindingsOutDir, "TestApp.d.ts");
      writeFileSync(
        facadePath,
        [
          "// Namespace: TestApp",
          "import * as Internal from './TestApp/internal/index.js';",
          "",
          "export declare function useLocalAlias(payload: Internal.LocalPayload__Alias): Promise<boolean>;",
          "",
        ].join("\n"),
        "utf-8"
      );

      const config = {
        workspaceRoot: dir,
        projectRoot: dir,
        sourceRoot: "src",
        rootNamespace: "TestApp",
        entryPoint: "src/index.ts",
        typeRoots: [],
        libraries: [],
      } as unknown as ResolvedConfig;

      const result = augmentLibraryBindingsFromSource(config, bindingsOutDir);
      expect(result.ok, result.ok ? undefined : result.error).to.equal(true);

      const patched = readFileSync(internalIndex, "utf-8");
      expect(patched).to.include(
        "readonly __tsonic_type_TestApp_LocalPayload__Alias?: never;"
      );
      expect(patched).to.not.include(
        "readonly __tsonic_type_TestApp_LocalPayload__Alias: never;"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("overrides class getter/setter types from source for optional value-like members", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-source-class-augment-"));
    try {
      const srcDir = join(dir, "src");
      mkdirSync(srcDir, { recursive: true });
      const entry = join(srcDir, "index.ts");
      writeFileSync(
        entry,
        ["export class User {", "  Count?: number;", "}", ""].join("\n"),
        "utf-8"
      );

      const bindingsOutDir = join(dir, "dist", "tsonic", "bindings");
      const internalDir = join(bindingsOutDir, "internal");
      mkdirSync(internalDir, { recursive: true });
      const internalIndex = join(internalDir, "index.d.ts");
      writeFileSync(
        internalIndex,
        [
          "import * as System_Internal from '@tsonic/dotnet/System/internal/index.js';",
          "import type { Nullable_1 } from '@tsonic/dotnet/System/internal/index.js';",
          "",
          "export interface User$instance {",
          "  get Count(): Nullable_1<System_Internal.Int32> | undefined;",
          "  set Count(value: Nullable_1<System_Internal.Int32> | number | undefined);",
          "}",
          "",
        ].join("\n"),
        "utf-8"
      );

      const config = {
        workspaceRoot: dir,
        projectRoot: dir,
        sourceRoot: "src",
        rootNamespace: "TestApp",
        entryPoint: "src/index.ts",
        typeRoots: [],
        libraries: [],
      } as unknown as ResolvedConfig;

      const result = augmentLibraryBindingsFromSource(config, bindingsOutDir);
      expect(result.ok, result.ok ? undefined : result.error).to.equal(true);

      const patched = readFileSync(internalIndex, "utf-8");
      expect(patched).to.include("get Count(): number | undefined;");
      expect(patched).to.include("set Count(value: number | undefined);");
      expect(patched).to.not.include("Nullable_1<System_Internal.Int32>");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps @tsonic/core type aliases when overriding class getter/setter types", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-source-class-core-augment-")
    );
    try {
      const coreDir = join(dir, "node_modules", "@tsonic", "core");
      mkdirSync(coreDir, { recursive: true });
      writeFileSync(
        join(coreDir, "package.json"),
        JSON.stringify({ name: "@tsonic/core", type: "module" }, null, 2),
        "utf-8"
      );
      writeFileSync(
        join(coreDir, "types.d.ts"),
        "export type int = number;\n",
        "utf-8"
      );

      const srcDir = join(dir, "src");
      mkdirSync(srcDir, { recursive: true });
      const entry = join(srcDir, "index.ts");
      writeFileSync(
        entry,
        [
          'import type { int } from "@tsonic/core/types.js";',
          "",
          "export class User {",
          "  BotType?: int;",
          "}",
          "",
        ].join("\n"),
        "utf-8"
      );

      const bindingsOutDir = join(dir, "dist", "tsonic", "bindings");
      const internalDir = join(bindingsOutDir, "internal");
      mkdirSync(internalDir, { recursive: true });
      const internalIndex = join(internalDir, "index.d.ts");
      writeFileSync(
        internalIndex,
        [
          "import * as System_Internal from '@tsonic/dotnet/System/internal/index.js';",
          "import type { Nullable_1 } from '@tsonic/dotnet/System/internal/index.js';",
          "",
          "export interface User$instance {",
          "  get BotType(): Nullable_1<System_Internal.Int32> | undefined;",
          "  set BotType(value: Nullable_1<System_Internal.Int32> | int | undefined);",
          "}",
          "",
        ].join("\n"),
        "utf-8"
      );

      const config = {
        workspaceRoot: dir,
        projectRoot: dir,
        sourceRoot: "src",
        rootNamespace: "TestApp",
        entryPoint: "src/index.ts",
        typeRoots: [join(dir, "node_modules")],
        libraries: [],
      } as unknown as ResolvedConfig;

      const result = augmentLibraryBindingsFromSource(config, bindingsOutDir);
      expect(result.ok, result.ok ? undefined : result.error).to.equal(true);

      const patched = readFileSync(internalIndex, "utf-8");
      expect(patched).to.include("get BotType(): int | undefined;");
      expect(patched).to.include("set BotType(value: int | undefined);");
      expect(patched).to.not.include("Nullable_1<System_Internal.Int32>");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });


});
