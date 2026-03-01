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
      expect(result.ok).to.equal(true);

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
      expect(result.ok).to.equal(true);

      const patched = readFileSync(internalIndex, "utf-8");
      expect(patched).to.include("get BotType(): int | undefined;");
      expect(patched).to.include("set BotType(value: int | undefined);");
      expect(patched).to.not.include("Nullable_1<System_Internal.Int32>");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
