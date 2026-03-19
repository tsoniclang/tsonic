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
