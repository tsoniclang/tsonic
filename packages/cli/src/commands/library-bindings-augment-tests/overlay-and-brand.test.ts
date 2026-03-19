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
import {
  augmentLibraryBindingsFromSource,
  overlayDependencyBindings,
  patchInternalIndexBrandMarkersOptional,
  resolveDependencyBindingsDirForDll,
} from "../library-bindings-augment.js";

describe("library-bindings-augment", function () {
  this.timeout(30000);
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


});
