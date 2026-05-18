import { expect } from "chai";
import * as fs from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import * as path from "node:path";
import { loadExternalCatalog } from "./external-catalog.js";
import { materializeFrontendFixture } from "../../../../testing/filesystem-fixtures.js";

describe("loadExternalCatalog", () => {
  it("loads only explicitly participating native target packages", () => {
    const fixture = materializeFrontendFixture(
      "ir/external-catalog/explicit-packages"
    );

    try {
      const nodeModulesRoot = fixture.path("node_modules");
      const loadedRoot = fixture.path("node_modules/@tsonic/loaded");

      const catalog = loadExternalCatalog(nodeModulesRoot, [loadedRoot]);
      expect(
        catalog.entries.has("Loaded.Namespace:Loaded.Namespace.Console")
      ).to.equal(true);
      expect(
        catalog.entries.has("Skipped.Namespace:Skipped.Namespace.Console")
      ).to.equal(false);
    } finally {
      fixture.cleanup();
    }
  });

  it("traverses source-package dependencies to load participating native target packages", () => {
    const fixture = materializeFrontendFixture(
      "ir/external-catalog/source-package-dependency"
    );

    try {
      const nodeModulesRoot = fixture.path("node_modules");
      const globalsRoot = fixture.path("node_modules/@tsonic/globals");

      const catalog = loadExternalCatalog(nodeModulesRoot, [globalsRoot]);
      const stringId = catalog.tsNameToTypeId.get("String");
      expect(stringId).to.not.equal(undefined);
      if (!stringId) {
        return;
      }

      expect(stringId.stableId).to.equal(
        "System.Private.CoreLib:System.String"
      );
      const stringEntry = catalog.entries.get(stringId.stableId);
      expect(stringEntry).to.not.equal(undefined);
      expect(stringEntry?.sourcePrimitiveName).to.equal("string");
    } finally {
      fixture.cleanup();
    }
  });

  it("ignores surface binding manifests that do not carry native target types", () => {
    const fixture = materializeFrontendFixture(
      "ir/external-catalog/surface-bindings-ignore"
    );

    try {
      const nodeModulesRoot = fixture.path("node_modules");
      const jsRoot = fixture.path("node_modules/@tsonic/js");

      const catalog = loadExternalCatalog(nodeModulesRoot, [jsRoot]);
      expect(catalog.entries.size).to.equal(2);
      expect(catalog.entries.has("js:js.console")).to.equal(true);
      expect(catalog.entries.has("tsonic.core:Array")).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("enriches native target type parameters from top-level tsbindgen declarations", () => {
    const fixture = materializeFrontendFixture(
      "ir/external-catalog/tsbindgen-top-level-types"
    );

    try {
      const nodeModulesRoot = fixture.path("node_modules");
      const efcoreRoot = fixture.path("node_modules/@tsonic/efcore");

      const catalog = loadExternalCatalog(nodeModulesRoot, [efcoreRoot]);
      const typeId = catalog.tsNameToTypeId.get("DbSet_1");
      expect(typeId).to.not.equal(undefined);
      if (!typeId) {
        return;
      }

      expect(
        catalog.entries.get(typeId.stableId)?.typeParameters
      ).to.deep.equal([{ name: "TEntity" }]);
    } finally {
      fixture.cleanup();
    }
  });

  it("hydrates generic-owning native target method signatures from companion d.ts surfaces", () => {
    const fixture = materializeFrontendFixture(
      "ir/external-catalog/generic-owning-signatures"
    );

    try {
      const nodeModulesRoot = fixture.path("node_modules");
      const dotnetRoot = fixture.path("node_modules/@tsonic/dotnet");

      const catalog = loadExternalCatalog(nodeModulesRoot, [dotnetRoot]);
      const typeId = catalog.tsNameToTypeId.get("Span_1");
      expect(typeId).to.not.equal(undefined);
      if (!typeId) {
        return;
      }

      const entry = catalog.entries.get(typeId.stableId);
      const slice = entry?.members.get("Slice");
      const toArray = entry?.members.get("ToArray");
      const getEnumerator = entry?.members.get("GetEnumerator");
      expect(slice?.signatures).to.have.length(1);
      expect(toArray?.signatures).to.have.length(1);
      expect(getEnumerator?.signatures).to.have.length(1);

      const sliceReturn = slice?.signatures?.[0]?.returnType;
      expect(sliceReturn).to.deep.equal({
        kind: "referenceType",
        name: "Span_1",
        typeArguments: [{ kind: "typeParameterType", name: "T" }],
      });

      const toArrayReturn = toArray?.signatures?.[0]?.returnType;
      expect(toArrayReturn).to.deep.equal({
        kind: "arrayType",
        elementType: { kind: "typeParameterType", name: "T" },
      });

      const enumeratorReturn = getEnumerator?.signatures?.[0]?.returnType;
      expect(enumeratorReturn).to.deep.equal({
        kind: "referenceType",
        name: "Span_1_Enumerator",
        typeArguments: [{ kind: "typeParameterType", name: "T" }],
      });
    } finally {
      fixture.cleanup();
    }
  });

  it("hydrates null-bearing method returns from companion d.ts surfaces", () => {
    const fixture = materializeFrontendFixture(
      "ir/external-catalog/null-bearing-returns"
    );

    try {
      const nodeModulesRoot = fixture.path("node_modules");
      const jsonRoot = fixture.path("node_modules/@tsonic/json");

      const catalog = loadExternalCatalog(nodeModulesRoot, [jsonRoot]);
      const typeId = catalog.tsNameToTypeId.get("JsonElement");
      expect(typeId).to.not.equal(undefined);
      if (!typeId) {
        return;
      }

      const entry = catalog.entries.get(typeId.stableId);
      const getString = entry?.members.get("GetString");
      expect(getString?.signatures).to.have.length(1);
      expect(getString?.signatures?.[0]?.returnType).to.deep.equal({
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "null" },
        ],
      });
    } finally {
      fixture.cleanup();
    }
  });

  it("skips unreadable directories while scanning external bindings", () => {
    const fixture = materializeFrontendFixture("ir/external-catalog/unreadable-dir");
    const unreadableDir = fixture.path("node_modules/@tsonic/dotnet/secret");

    try {
      fs.chmodSync(unreadableDir, 0);

      const nodeModulesRoot = fixture.path("node_modules");
      const dotnetRoot = fixture.path("node_modules/@tsonic/dotnet");
      const catalog = loadExternalCatalog(nodeModulesRoot, [dotnetRoot]);
      expect(catalog.entries.has("System:System.Console")).to.equal(true);
    } finally {
      if (fs.existsSync(unreadableDir)) {
        fs.chmodSync(unreadableDir, 0o755);
      }
      fixture.cleanup();
    }
  });

  it("canonicalizes symlinked native target metadata paths before reading them", () => {
    const fixture = materializeFrontendFixture(
      "ir/external-catalog/symlinked-metadata"
    );

    try {
      const nodeModulesRoot = fixture.path("node_modules");
      const symlinkedJsRoot = fixture.path("node_modules/@tsonic/js");

      const warnings: string[] = [];
      const originalWarn = console.warn;
      const require = createRequire(import.meta.url);
      const fsBuiltin: typeof fs = require("node:fs");
      const originalReadFileSync = fsBuiltin.readFileSync;
      let removedSymlink = false;
      try {
        console.warn = (...parts: unknown[]) => {
          warnings.push(parts.map((part) => String(part)).join(" "));
        };
        fsBuiltin.readFileSync = ((filePath: unknown, ...args: unknown[]) => {
          if (
            !removedSymlink &&
            typeof filePath === "string" &&
            filePath.endsWith(path.join("js", "bindings.json"))
          ) {
            fs.rmSync(symlinkedJsRoot, { recursive: true, force: true });
            removedSymlink = true;
          }

          return (originalReadFileSync as (...innerArgs: unknown[]) => unknown)(
            filePath,
            ...args
          );
        }) as typeof fs.readFileSync;
        syncBuiltinESMExports();

        const catalog = loadExternalCatalog(nodeModulesRoot, [symlinkedJsRoot]);
        expect(
          [...catalog.entries.keys()].filter((key) => key === "js:js.console")
        ).to.have.length(1);
        expect(warnings).to.deep.equal([]);
      } finally {
        console.warn = originalWarn;
        fsBuiltin.readFileSync = originalReadFileSync;
        syncBuiltinESMExports();
      }
    } finally {
      fixture.cleanup();
    }
  });
});
