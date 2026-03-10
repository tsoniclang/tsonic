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
import type { ResolvedConfig } from "../types.js";
import {
  augmentLibraryBindingsFromSource,
  overlayDependencyBindings,
  patchInternalIndexBrandMarkersOptional,
  resolveDependencyBindingsDirForDll,
} from "./library-bindings-augment.js";

describe("library-bindings-augment", function () {
  this.timeout(10000);
  it("resolves dependency bindings dir for generated/bin DLL paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-overlay-path-"));
    try {
      const depRoot = join(dir, "packages", "core");
      const dllPath = join(
        depRoot,
        "generated",
        "bin",
        "Release",
        "net10.0",
        "Acme.Core.dll"
      );
      const bindingsDir = join(depRoot, "dist", "tsonic", "bindings");
      mkdirSync(join(depRoot, "generated", "bin", "Release", "net10.0"), {
        recursive: true,
      });
      mkdirSync(bindingsDir, { recursive: true });
      writeFileSync(dllPath, "", "utf-8");

      const actual = resolveDependencyBindingsDirForDll(dllPath);
      expect(actual).to.equal(bindingsDir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("overlays dependency bindings for generated/bin DLL references", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-overlay-"));
    try {
      const depRoot = join(dir, "packages", "core");
      const depDll = join(
        depRoot,
        "generated",
        "bin",
        "Release",
        "net10.0",
        "Acme.Core.dll"
      );
      const depBindings = join(depRoot, "dist", "tsonic", "bindings");
      const depInternal = join(
        depBindings,
        "Acme.Core",
        "internal",
        "index.d.ts"
      );
      const depFacade = join(depBindings, "Acme.Core.d.ts");
      mkdirSync(join(depRoot, "generated", "bin", "Release", "net10.0"), {
        recursive: true,
      });
      mkdirSync(join(depBindings, "Acme.Core", "internal"), {
        recursive: true,
      });
      writeFileSync(depDll, "", "utf-8");
      writeFileSync(
        depInternal,
        "// Assembly: Acme.Core\nexport interface User$instance { readonly id: string; }\n",
        "utf-8"
      );
      writeFileSync(
        depFacade,
        "export interface User { id: string; }\n",
        "utf-8"
      );

      const outDir = join(dir, "packages", "app", "dist", "tsonic", "bindings");
      const outInternal = join(outDir, "Acme.Core", "internal", "index.d.ts");
      const outFacade = join(outDir, "Acme.Core.d.ts");
      mkdirSync(join(outDir, "Acme.Core", "internal"), { recursive: true });
      writeFileSync(
        outInternal,
        "// Assembly: Acme.Core\nexport interface User$instance { readonly stale: boolean; }\n",
        "utf-8"
      );
      writeFileSync(
        outFacade,
        "export interface User { stale: boolean; }\n",
        "utf-8"
      );

      const config = {
        outputName: "Acme.App",
        libraries: [depDll],
      } as unknown as ResolvedConfig;

      const result = overlayDependencyBindings(config, outDir);
      expect(result.ok).to.equal(true);
      expect(readFileSync(outInternal, "utf-8")).to.equal(
        readFileSync(depInternal, "utf-8")
      );
      expect(readFileSync(outFacade, "utf-8")).to.equal(
        readFileSync(depFacade, "utf-8")
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("patches all brand markers in a target interface", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-brand-patch-"));
    try {
      const internalIndex = join(dir, "index.d.ts");
      writeFileSync(
        internalIndex,
        [
          "export interface Foo$instance {",
          "  readonly __tsonic_type_Foo: never;",
          "  readonly __tsonic_type_External_Foo: never;",
          "  readonly name: string;",
          "}",
          "",
        ].join("\n"),
        "utf-8"
      );

      const result = patchInternalIndexBrandMarkersOptional(internalIndex, [
        "Foo",
      ]);
      expect(result.ok).to.equal(true);

      const content = readFileSync(internalIndex, "utf-8");
      expect(content).to.include("readonly __tsonic_type_Foo?: never;");
      expect(content).to.include(
        "readonly __tsonic_type_External_Foo?: never;"
      );
      expect(content).to.not.include("readonly __tsonic_type_Foo: never;");
      expect(content).to.not.include(
        "readonly __tsonic_type_External_Foo: never;"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rewrites const Func exports using source parameter types with nested commas", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-facade-const-func-"));
    try {
      const srcDir = join(dir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(
        join(srcDir, "index.ts"),
        [
          "export const updateSettings = async (",
          "  tenantId: string,",
          "  settings: Record<string, unknown>",
          "): Promise<boolean> => {",
          "  void tenantId;",
          "  void settings;",
          "  return true;",
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
          "import type { Func } from '@tsonic/dotnet/System.js';",
          "import type { Dictionary } from '@tsonic/dotnet/System.Collections.Generic.js';",
          "import type { Task } from '@tsonic/dotnet/System.Threading.Tasks.js';",
          "import type { Union_2 } from './Tsonic.Runtime/internal/index.js';",
          "import type { Err__Alias_1, Ok__Alias_1 } from './Acme.Core/internal/index.js';",
          "",
          "export declare const updateSettings: Func<string, Dictionary<string, unknown | undefined>, Task<Union_2<Ok__Alias_1<boolean>, Err__Alias_1<string>>>>;",
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
        "export declare function updateSettings(tenantId: string, settings: Record<string, unknown>): Task<(Ok__Alias_1<boolean> | Err__Alias_1<string>)>;"
      );
      expect(patched).to.not.include("export declare const updateSettings:");
      expect(patched).to.not.include("Dictionary<string, unknown | undefined>");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

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

  it("preserves optional interface members as optional properties", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-source-interface-augment-"));
    try {
      const srcDir = join(dir, "src");
      mkdirSync(srcDir, { recursive: true });
      const entry = join(srcDir, "index.ts");
      writeFileSync(
        entry,
        [
          "export interface DomainEvent {",
          "  type: string;",
          "  op?: string;",
          "  data: Record<string, unknown>;",
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
          "export interface DomainEvent$instance {",
          "  readonly __tsonic_type_TestApp_DomainEvent: never;",
          "  get op(): string | undefined;",
          "  set op(value: string | undefined);",
          "  type: string;",
          "  data: Record<string, unknown>;",
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
      expect(patched).to.include("op?: string;");
      expect(patched).to.not.include("get op():");
      expect(patched).to.not.include("set op(");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("adds internal type imports for flattened facade signatures", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-facade-type-imports-"));
    try {
      const srcDir = join(dir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(
        join(srcDir, "index.ts"),
        [
          "export function ping(input: string): string { return input; }",
          "",
        ].join("\n"),
        "utf-8"
      );

      const bindingsOutDir = join(dir, "dist", "tsonic", "bindings");
      const rootInternalDir = join(bindingsOutDir, "internal");
      mkdirSync(rootInternalDir, { recursive: true });
      writeFileSync(join(rootInternalDir, "index.d.ts"), "", "utf-8");
      const namespaceInternalDir = join(
        bindingsOutDir,
        "Acme.Events",
        "internal"
      );
      mkdirSync(namespaceInternalDir, { recursive: true });
      writeFileSync(
        join(namespaceInternalDir, "index.d.ts"),
        [
          "export interface DomainEvent { type: string; data: Record<string, unknown>; }",
          "export interface RegisterParams { eventTypes?: string[]; }",
          "export declare const registry: unknown;",
          "",
        ].join("\n"),
        "utf-8"
      );
      const facadePath = join(bindingsOutDir, "Acme.Events.d.ts");
      writeFileSync(
        facadePath,
        [
          "import * as Internal from './Acme.Events/internal/index.js';",
          "",
          "export { DomainEvent as DomainEvent } from './Acme.Events/internal/index.js';",
          "export { RegisterParams as RegisterParams } from './Acme.Events/internal/index.js';",
          "export { registry as registry } from './Acme.Events/internal/index.js';",
          "",
          "export declare function dispatchEventToTenant(tenantId: string, event: DomainEvent): void;",
          "export declare function registerQueue(params: RegisterParams): string;",
          "",
        ].join("\n"),
        "utf-8"
      );

      const config = {
        workspaceRoot: dir,
        projectRoot: dir,
        sourceRoot: "src",
        rootNamespace: "Acme.Events",
        entryPoint: "src/index.ts",
        typeRoots: [],
        libraries: [],
      } as unknown as ResolvedConfig;

      const result = augmentLibraryBindingsFromSource(config, bindingsOutDir);
      expect(result.ok).to.equal(true);

      const patched = readFileSync(facadePath, "utf-8");
      expect(patched).to.include(
        "import type { DomainEvent, RegisterParams, registry } from './Acme.Events/internal/index.js';"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("merges existing internal type imports and preserves aliases", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-facade-type-aliases-"));
    try {
      const srcDir = join(dir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(
        join(srcDir, "index.ts"),
        [
          "export function ping(input: string): string { return input; }",
          "",
        ].join("\n"),
        "utf-8"
      );

      const bindingsOutDir = join(dir, "dist", "tsonic", "bindings");
      const rootInternalDir = join(bindingsOutDir, "internal");
      mkdirSync(rootInternalDir, { recursive: true });
      writeFileSync(join(rootInternalDir, "index.d.ts"), "", "utf-8");
      const namespaceInternalDir = join(
        bindingsOutDir,
        "Acme.Events",
        "internal"
      );
      mkdirSync(namespaceInternalDir, { recursive: true });
      writeFileSync(
        join(namespaceInternalDir, "index.d.ts"),
        [
          "export interface DomainEvent { type: string; data: Record<string, unknown>; }",
          "export interface ExistingType { ok: boolean; }",
          "export interface RegisterParams { eventTypes?: string[]; }",
          "",
        ].join("\n"),
        "utf-8"
      );
      const facadePath = join(bindingsOutDir, "Acme.Events.d.ts");
      writeFileSync(
        facadePath,
        [
          "import * as Internal from './Acme.Events/internal/index.js';",
          "import type { ExistingType } from './Acme.Events/internal/index.js';",
          "",
          "export { type DomainEvent as DomainEvent } from './Acme.Events/internal/index.js';",
          "export { type RegisterParams as Params } from './Acme.Events/internal/index.js';",
          "",
          "export declare function dispatchEventToTenant(tenantId: string, event: DomainEvent): void;",
          "export declare function registerQueue(params: Params): ExistingType;",
          "",
        ].join("\n"),
        "utf-8"
      );

      const config = {
        workspaceRoot: dir,
        projectRoot: dir,
        sourceRoot: "src",
        rootNamespace: "Acme.Events",
        entryPoint: "src/index.ts",
        typeRoots: [],
        libraries: [],
      } as unknown as ResolvedConfig;

      const result = augmentLibraryBindingsFromSource(config, bindingsOutDir);
      expect(result.ok).to.equal(true);

      const patched = readFileSync(facadePath, "utf-8");
      expect(patched).to.include(
        "import type { DomainEvent, ExistingType, RegisterParams as Params } from './Acme.Events/internal/index.js';"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
