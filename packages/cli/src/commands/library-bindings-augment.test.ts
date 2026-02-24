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
  overlayDependencyBindings,
  patchInternalIndexBrandMarkersOptional,
  resolveDependencyBindingsDirForDll,
} from "./library-bindings-augment.js";

describe("library-bindings-augment", () => {
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
});
