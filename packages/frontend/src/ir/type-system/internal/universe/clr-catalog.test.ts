import { expect } from "chai";
import * as fs from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { loadClrCatalog } from "./clr-catalog.js";

describe("loadClrCatalog", () => {
  it("loads only explicitly participating CLR packages", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-clr-catalog-")
    );

    try {
      const nodeModulesRoot = path.join(tempDir, "node_modules");
      const loadedRoot = path.join(nodeModulesRoot, "@tsonic", "loaded");
      const skippedRoot = path.join(nodeModulesRoot, "@tsonic", "skipped");

      fs.mkdirSync(path.join(loadedRoot, "Loaded.Namespace", "internal"), {
        recursive: true,
      });
      fs.mkdirSync(path.join(skippedRoot, "Skipped.Namespace", "internal"), {
        recursive: true,
      });

      fs.writeFileSync(
        path.join(loadedRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/loaded", version: "0.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(skippedRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/skipped", version: "0.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(loadedRoot, "Loaded.Namespace", "bindings.json"),
        JSON.stringify(
          {
            namespace: "Loaded.Namespace",
            types: [
              {
                stableId: "Loaded.Namespace:Loaded.Namespace.Console",
                clrName: "Loaded.Namespace.Console",
                kind: "class",
                accessibility: "public",
                isAbstract: false,
                isSealed: true,
                isStatic: true,
                arity: 0,
                methods: [],
                properties: [],
                fields: [],
                constructors: [],
                assemblyName: "Loaded.Assembly",
              },
            ],
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(skippedRoot, "Skipped.Namespace", "bindings.json"),
        JSON.stringify(
          {
            namespace: "Skipped.Namespace",
            types: [
              {
                stableId: "Skipped.Namespace:Skipped.Namespace.Console",
                clrName: "Skipped.Namespace.Console",
                kind: "class",
                accessibility: "public",
                isAbstract: false,
                isSealed: true,
                isStatic: true,
                arity: 0,
                methods: [],
                properties: [],
                fields: [],
                constructors: [],
                assemblyName: "Skipped.Assembly",
              },
            ],
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(loadedRoot, "Loaded.Namespace", "internal", "index.d.ts"),
        "export declare class Console {}\n"
      );
      fs.writeFileSync(
        path.join(skippedRoot, "Skipped.Namespace", "internal", "index.d.ts"),
        "export declare class Console {}\n"
      );

      const catalog = loadClrCatalog(nodeModulesRoot, [loadedRoot]);
      expect(
        catalog.entries.has("Loaded.Namespace:Loaded.Namespace.Console")
      ).to.equal(true);
      expect(
        catalog.entries.has("Skipped.Namespace:Skipped.Namespace.Console")
      ).to.equal(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("ignores surface binding manifests that do not carry CLR types", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-clr-catalog-")
    );

    try {
      const nodeModulesRoot = path.join(tempDir, "node_modules");
      const jsRoot = path.join(nodeModulesRoot, "@tsonic", "js");
      const runtimeNsRoot = path.join(jsRoot, "js");
      const runtimeInternalRoot = path.join(runtimeNsRoot, "internal");

      fs.mkdirSync(runtimeInternalRoot, { recursive: true });
      fs.writeFileSync(
        path.join(jsRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/js", version: "0.0.0", type: "module" },
          null,
          2
        )
      );

      fs.writeFileSync(
        path.join(jsRoot, "bindings.json"),
        JSON.stringify(
          {
            bindings: {
              console: {
                kind: "global",
                assembly: "js",
                type: "js.console",
              },
            },
          },
          null,
          2
        )
      );

      fs.writeFileSync(
        path.join(runtimeNsRoot, "bindings.json"),
        JSON.stringify(
          {
            namespace: "js",
            types: [
              {
                stableId: "js:js.console",
                clrName: "js.console",
                kind: "class",
                accessibility: "public",
                isAbstract: false,
                isSealed: false,
                isStatic: true,
                arity: 0,
                methods: [],
                properties: [],
                fields: [],
                constructors: [],
                assemblyName: "js",
              },
            ],
          },
          null,
          2
        )
      );

      fs.writeFileSync(
        path.join(runtimeInternalRoot, "index.d.ts"),
        "export {};\n"
      );

      const catalog = loadClrCatalog(nodeModulesRoot, [jsRoot]);
      expect(catalog.entries.size).to.equal(1);
      expect(
        catalog.entries.has("js:js.console")
      ).to.equal(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("enriches CLR type parameters from top-level tsbindgen declarations", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-clr-catalog-")
    );

    try {
      const nodeModulesRoot = path.join(tempDir, "node_modules");
      const efcoreRoot = path.join(nodeModulesRoot, "@tsonic", "efcore");
      const efcoreNsRoot = path.join(
        efcoreRoot,
        "Microsoft.EntityFrameworkCore"
      );

      fs.mkdirSync(efcoreNsRoot, { recursive: true });
      fs.writeFileSync(
        path.join(efcoreRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/efcore", version: "0.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(efcoreNsRoot, "bindings.json"),
        JSON.stringify(
          {
            namespace: "Microsoft.EntityFrameworkCore",
            types: [
              {
                stableId:
                  "Microsoft.EntityFrameworkCore:Microsoft.EntityFrameworkCore.DbSet`1",
                clrName: "Microsoft.EntityFrameworkCore.DbSet`1",
                kind: "class",
                accessibility: "public",
                isAbstract: false,
                isSealed: false,
                isStatic: false,
                arity: 1,
                methods: [],
                properties: [],
                fields: [],
                constructors: [],
                assemblyName: "Microsoft.EntityFrameworkCore",
              },
            ],
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(efcoreRoot, "Microsoft.EntityFrameworkCore.d.ts"),
        [
          "export interface DbSet_1$instance<TEntity> {",
          "  readonly __tsonic_type_Microsoft_EntityFrameworkCore_DbSet_1: never;",
          "}",
          "export type DbSet_1<TEntity> = DbSet_1$instance<TEntity>;",
          "",
        ].join("\n")
      );

      const catalog = loadClrCatalog(nodeModulesRoot, [efcoreRoot]);
      const typeId = catalog.tsNameToTypeId.get("DbSet_1");
      expect(typeId).to.not.equal(undefined);
      if (!typeId) {
        return;
      }

      expect(catalog.entries.get(typeId.stableId)?.typeParameters).to.deep.equal(
        [{ name: "TEntity" }]
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("hydrates generic-owning CLR method signatures from companion d.ts surfaces", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-clr-catalog-")
    );

    try {
      const nodeModulesRoot = path.join(tempDir, "node_modules");
      const dotnetRoot = path.join(nodeModulesRoot, "@tsonic", "dotnet");
      const systemRoot = path.join(dotnetRoot, "System");

      fs.mkdirSync(systemRoot, { recursive: true });
      fs.writeFileSync(
        path.join(dotnetRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/dotnet", version: "0.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(systemRoot, "bindings.json"),
        JSON.stringify(
          {
            namespace: "System",
            types: [
              {
                stableId: "System.Private.CoreLib:System.Span`1",
                clrName: "System.Span`1",
                assemblyName: "System.Private.CoreLib",
                kind: "Struct",
                accessibility: "Public",
                isAbstract: false,
                isSealed: true,
                isStatic: false,
                arity: 1,
                methods: [
                  {
                    stableId:
                      "System.Private.CoreLib:System.Span`1::Slice(System.Int32):Span_1",
                    clrName: "Slice",
                    canonicalSignature: "(System.Int32):Span_1",
                    normalizedSignature:
                      "Slice|(System.Int32):Span_1|static=false",
                    arity: 0,
                    parameterCount: 1,
                    isStatic: false,
                    isAbstract: false,
                    isVirtual: false,
                    isOverride: false,
                    isSealed: false,
                    visibility: "Public",
                    declaringClrType: "System.Span`1",
                    declaringAssemblyName: "System.Private.CoreLib",
                    isExtensionMethod: false,
                  },
                  {
                    stableId:
                      "System.Private.CoreLib:System.Span`1::ToArray():T[]",
                    clrName: "ToArray",
                    canonicalSignature: "():T[]",
                    normalizedSignature: "ToArray|():T[]|static=false",
                    arity: 0,
                    parameterCount: 0,
                    isStatic: false,
                    isAbstract: false,
                    isVirtual: false,
                    isOverride: false,
                    isSealed: false,
                    visibility: "Public",
                    declaringClrType: "System.Span`1",
                    declaringAssemblyName: "System.Private.CoreLib",
                    isExtensionMethod: false,
                  },
                  {
                    stableId:
                      "System.Private.CoreLib:System.Span`1::GetEnumerator():Enumerator",
                    clrName: "GetEnumerator",
                    canonicalSignature: "():Enumerator",
                    normalizedSignature:
                      "GetEnumerator|():Enumerator|static=false",
                    arity: 0,
                    parameterCount: 0,
                    isStatic: false,
                    isAbstract: false,
                    isVirtual: false,
                    isOverride: false,
                    isSealed: false,
                    visibility: "Public",
                    declaringClrType: "System.Span`1",
                    declaringAssemblyName: "System.Private.CoreLib",
                    isExtensionMethod: false,
                  },
                ],
                properties: [],
                fields: [],
                constructors: [],
              },
            ],
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(dotnetRoot, "System.d.ts"),
        [
          "export interface Span_1$instance<T> {",
          "  readonly __tsonic_type_System_Span_1: never;",
          "  Slice(start: int): Span_1<T>;",
          "  ToArray(): T[];",
          "  GetEnumerator(): Span_1_Enumerator<T>;",
          "}",
          "export type Span_1<T> = Span_1$instance<T>;",
          "export interface Span_1_Enumerator$instance<T> {",
          "  readonly __tsonic_type_System_Span_1_Enumerator: never;",
          "  readonly Current: T;",
          "}",
          "export type Span_1_Enumerator<T> = Span_1_Enumerator$instance<T>;",
          "",
        ].join("\n")
      );

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
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("skips unreadable directories while scanning CLR bindings", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-clr-catalog-")
    );

    const unreadableDir = path.join(
      tempDir,
      "node_modules",
      "@tsonic",
      "dotnet",
      "secret"
    );

    try {
      const nodeModulesRoot = path.join(tempDir, "node_modules");
      const dotnetRoot = path.join(nodeModulesRoot, "@tsonic", "dotnet");
      const dotnetNsRoot = path.join(dotnetRoot, "System");
      const dotnetInternalRoot = path.join(dotnetNsRoot, "internal");

      fs.mkdirSync(dotnetInternalRoot, { recursive: true });
      fs.writeFileSync(
        path.join(dotnetRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/dotnet", version: "0.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(dotnetNsRoot, "bindings.json"),
        JSON.stringify(
          {
            namespace: "System",
            types: [
              {
                stableId: "System:System.Console",
                clrName: "System.Console",
                kind: "class",
                accessibility: "public",
                isAbstract: false,
                isSealed: true,
                isStatic: true,
                arity: 0,
                methods: [],
                properties: [],
                fields: [],
                constructors: [],
                assemblyName: "System.Console",
              },
            ],
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(dotnetInternalRoot, "index.d.ts"),
        "export {};\n"
      );

      fs.mkdirSync(unreadableDir, { recursive: true });
      fs.chmodSync(unreadableDir, 0);

      const catalog = loadClrCatalog(nodeModulesRoot, [dotnetRoot]);
      expect(catalog.entries.has("System:System.Console")).to.equal(true);
    } finally {
      if (fs.existsSync(unreadableDir)) {
        fs.chmodSync(unreadableDir, 0o755);
      }
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("canonicalizes symlinked CLR metadata paths before reading them", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-clr-catalog-")
    );

    try {
      const nodeModulesRoot = path.join(tempDir, "node_modules");
      const realPackagesRoot = path.join(tempDir, ".tsonic", "bindings");
      const jsRoot = path.join(realPackagesRoot, "@tsonic", "js");
      const runtimeNsRoot = path.join(jsRoot, "js");
      const runtimeInternalRoot = path.join(runtimeNsRoot, "internal");
      const symlinkedJsRoot = path.join(nodeModulesRoot, "@tsonic", "js");

      fs.mkdirSync(runtimeInternalRoot, { recursive: true });
      fs.writeFileSync(
        path.join(jsRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/js", version: "0.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(runtimeNsRoot, "bindings.json"),
        JSON.stringify(
          {
            namespace: "js",
            types: [
              {
                stableId: "js:js.console",
                clrName: "js.console",
                kind: "class",
                accessibility: "public",
                isAbstract: false,
                isSealed: false,
                isStatic: true,
                arity: 0,
                methods: [],
                properties: [],
                fields: [],
                constructors: [],
                assemblyName: "js",
              },
            ],
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(runtimeInternalRoot, "index.d.ts"),
        "export declare class console {}\n"
      );
      fs.mkdirSync(path.dirname(symlinkedJsRoot), { recursive: true });
      fs.symlinkSync(jsRoot, symlinkedJsRoot, "dir");

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
        expect(catalog.entries.size).to.equal(1);
        expect(warnings).to.deep.equal([]);
      } finally {
        console.warn = originalWarn;
        fsBuiltin.readFileSync = originalReadFileSync;
        syncBuiltinESMExports();
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
