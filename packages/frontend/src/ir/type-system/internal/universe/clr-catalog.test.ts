import { expect } from "chai";
import * as fs from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import * as path from "node:path";
import { loadClrCatalog } from "./clr-catalog.js";
import { materializeFrontendFixture } from "../../../../testing/filesystem-fixtures.js";

describe("loadClrCatalog", () => {
  it("loads only explicitly participating CLR packages", () => {
    const fixture = materializeFrontendFixture(
      "ir/clr-catalog/explicit-packages"
    );

    try {
      const nodeModulesRoot = fixture.path("node_modules");
      const loadedRoot = fixture.path("node_modules/@tsonic/loaded");

      const catalog = loadClrCatalog(nodeModulesRoot, [loadedRoot]);
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

  it("traverses source-package dependencies to load participating CLR packages", () => {
    const fixture = materializeFrontendFixture(
      "ir/clr-catalog/source-package-dependency"
    );

    try {
      const nodeModulesRoot = fixture.path("node_modules");
      const globalsRoot = fixture.path("node_modules/@tsonic/globals");

      const catalog = loadClrCatalog(nodeModulesRoot, [globalsRoot]);
      const stringId = catalog.tsNameToTypeId.get("String");
      expect(stringId).to.not.equal(undefined);
      if (!stringId) {
        return;
      }

      expect(stringId.stableId).to.equal(
        "System.Private.CoreLib:System.String"
      );
      expect(catalog.entries.has(stringId.stableId)).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("ignores surface binding manifests that do not carry CLR types", () => {
    const fixture = materializeFrontendFixture(
      "ir/clr-catalog/surface-bindings-ignore"
    );

    try {
      const nodeModulesRoot = fixture.path("node_modules");
      const jsRoot = fixture.path("node_modules/@tsonic/js");

      const catalog = loadClrCatalog(nodeModulesRoot, [jsRoot]);
      expect(catalog.entries.size).to.equal(2);
      expect(catalog.entries.has("js:js.console")).to.equal(true);
      expect(
        catalog.entries.has("System.Private.CoreLib:System.Array")
      ).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("enriches CLR type parameters from top-level tsbindgen declarations", () => {
    const fixture = materializeFrontendFixture(
      "ir/clr-catalog/tsbindgen-top-level-types"
    );

    try {
      const nodeModulesRoot = fixture.path("node_modules");
      const efcoreRoot = fixture.path("node_modules/@tsonic/efcore");

      const catalog = loadClrCatalog(nodeModulesRoot, [efcoreRoot]);
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

  it("hydrates generic-owning CLR method signatures from companion d.ts surfaces", () => {
    const fixture = materializeFrontendFixture(
      "ir/clr-catalog/generic-owning-signatures"
    );

    try {
      const nodeModulesRoot = fixture.path("node_modules");
      const dotnetRoot = fixture.path("node_modules/@tsonic/dotnet");

      const catalog = loadClrCatalog(nodeModulesRoot, [dotnetRoot]);
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
      "ir/clr-catalog/null-bearing-returns"
    );

    try {
      const nodeModulesRoot = fixture.path("node_modules");
      const jsonRoot = fixture.path("node_modules/@tsonic/json");

      const catalog = loadClrCatalog(nodeModulesRoot, [jsonRoot]);
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

  it("skips unreadable directories while scanning CLR bindings", () => {
    const fixture = materializeFrontendFixture("ir/clr-catalog/unreadable-dir");
    const unreadableDir = fixture.path("node_modules/@tsonic/dotnet/secret");

    try {
      fs.chmodSync(unreadableDir, 0);

      const nodeModulesRoot = fixture.path("node_modules");
      const dotnetRoot = fixture.path("node_modules/@tsonic/dotnet");
      const catalog = loadClrCatalog(nodeModulesRoot, [dotnetRoot]);
      expect(catalog.entries.has("System:System.Console")).to.equal(true);
    } finally {
      if (fs.existsSync(unreadableDir)) {
        fs.chmodSync(unreadableDir, 0o755);
      }
      fixture.cleanup();
    }
  });

  it("canonicalizes symlinked CLR metadata paths before reading them", () => {
    const fixture = materializeFrontendFixture(
      "ir/clr-catalog/symlinked-metadata"
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

        const catalog = loadClrCatalog(nodeModulesRoot, [symlinkedJsRoot]);
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
