/**
 * IR Builder tests: Import Extraction
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import * as path from "node:path";
import { buildIrModule } from "../builder.js";
import type { BindingFile } from "../../program/binding-types.js";
import {
  createProgram,
  createProgramContext,
  createFilesystemTestProgram,
  createTestProgram,
} from "./_test-helpers.js";
import { materializeFrontendFixture } from "../../testing/filesystem-fixtures.js";

const materializeImportExtractionFixture = (
  fixtureNames: string | readonly string[]
) =>
  materializeFrontendFixture(
    (Array.isArray(fixtureNames) ? fixtureNames : [fixtureNames]).map(
      (fixtureName) =>
        fixtureName.startsWith("fragments/")
          ? fixtureName
          : `ir/import-extraction/${fixtureName}`
    )
  );

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Import Extraction", () => {
    it("should extract local imports", () => {
      const source = `
        import { User } from "./models/User.ts";
        import * as utils from "./utils.ts";
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const imports = result.value.imports;
        expect(imports).to.have.length(2);

        const firstImport = imports[0];
        const secondImport = imports[1];
        if (!firstImport || !secondImport) throw new Error("Missing imports");

        expect(firstImport.source).to.equal("./models/User.ts");
        expect(firstImport.isLocal).to.equal(true);
        expect(firstImport.isClr).to.equal(false);

        expect(secondImport.source).to.equal("./utils.ts");
        const firstSpec = secondImport.specifiers[0];
        if (!firstSpec) throw new Error("Missing specifier");
        expect(firstSpec.kind).to.equal("namespace");
      }
    });

    it("should attach resolvedClrValue for tsbindgen flattened named exports", () => {
      const source = `
        import { buildSite } from "@demo/pkg/Demo.js";
      `;

      const { testProgram, ctx, options } = createTestProgram(source);

      // Stub CLR resolution for this unit test (no filesystem / node resolution).
      (
        ctx as unknown as { clrResolver: { resolve: (s: string) => unknown } }
      ).clrResolver = {
        resolve: (s: string) =>
          s === "@demo/pkg/Demo.js"
            ? {
                isClr: true,
                packageName: "@demo/pkg",
                resolvedNamespace: "Demo",
                bindingsPath: "/x/bindings.json",
                assembly: "Demo",
              }
            : { isClr: false },
      };

      // Provide a minimal tsbindgen bindings.json excerpt with exports.
      ctx.bindings.addBindings("/x/bindings.json", {
        namespace: "Demo",
        types: [],
        exports: {
          buildSite: {
            kind: "method",
            clrName: "buildSite",
            declaringClrType: "Demo.BuildSite",
            declaringAssemblyName: "Demo",
          },
        },
      });

      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const imp = result.value.imports[0];
      if (!imp) throw new Error("Missing imports");
      expect(imp.isClr).to.equal(true);
      expect(imp.resolvedNamespace).to.equal("Demo");

      const spec = imp.specifiers[0];
      if (!spec || spec.kind !== "named")
        throw new Error("Missing named specifier");
      expect(spec.name).to.equal("buildSite");
      expect(spec.isType).to.not.equal(true);
      expect(spec.resolvedClrValue).to.deep.equal({
        declaringClrType: "Demo.BuildSite",
        declaringAssemblyName: "Demo",
        memberName: "buildSite",
      });
    });

    it("should attach resolvedClrType for CLR type imports used as values", () => {
      const source = `
        import { Task as TaskValue } from "@tsonic/dotnet/System.Threading.Tasks.js";
      `;

      const { testProgram, ctx, options } = createTestProgram(source);

      (
        ctx as unknown as { clrResolver: { resolve: (s: string) => unknown } }
      ).clrResolver = {
        resolve: (s: string) =>
          s === "@tsonic/dotnet/System.Threading.Tasks.js"
            ? {
                isClr: true,
                packageName: "@tsonic/dotnet",
                resolvedNamespace: "System.Threading.Tasks",
                bindingsPath: "/x/tasks.bindings.json",
                assembly: "System.Runtime",
              }
            : { isClr: false },
      };

      ctx.bindings.addBindings("/x/tasks.bindings.json", {
        namespace: "System.Threading.Tasks",
        types: [
          {
            alias: "Task",
            clrName: "System.Threading.Tasks.Task",
            assemblyName: "System.Runtime",
            kind: "Class",
            methods: [],
            properties: [],
            fields: [],
          },
        ],
        exports: {},
      });

      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const imp = result.value.imports[0];
      if (!imp) throw new Error("Missing imports");
      const spec = imp.specifiers[0];
      if (!spec || spec.kind !== "named") {
        throw new Error("Missing named specifier");
      }
      expect(spec.name).to.equal("Task");
      expect(spec.localName).to.equal("TaskValue");
      expect(spec.isType).to.not.equal(true);
      expect(spec.resolvedClrType).to.equal("System.Threading.Tasks.Task");
      expect(spec.resolvedClrValue).to.equal(undefined);
    });

    it("prefers the imported CLR facade namespace over internal re-export declaration owners", () => {
      const source = `
        import { Console } from "@tsonic/dotnet/System.js";
        void Console.WriteLine;
      `;

      const { testProgram, ctx, options } = createTestProgram(source);

      const fixture = materializeImportExtractionFixture(
        "facade-namespace-owner"
      );
      const declPath = fixture.path("Internal/internal/index.d.ts");
      const internalBindingsPath = fixture.path("Internal/bindings.json");
      const systemBindingsPath = fixture.path("System/bindings.json");

      (
        ctx as unknown as { clrResolver: { resolve: (s: string) => unknown } }
      ).clrResolver = {
        resolve: (s: string) =>
          s === "@tsonic/dotnet/System.js"
            ? {
                isClr: true,
                packageName: "@tsonic/dotnet",
                resolvedNamespace: "System",
                bindingsPath: systemBindingsPath,
                assembly: "System.Console",
              }
            : { isClr: false },
      };

      ctx.bindings.addBindings(systemBindingsPath, {
        namespace: "System",
        types: [
          {
            alias: "Console",
            clrName: "System.Console",
            assemblyName: "System.Console",
            kind: "Class",
            methods: [],
            properties: [],
            fields: [],
          },
        ],
      });
      ctx.bindings.addBindings(internalBindingsPath, {
        namespace: "Internal",
        types: [
          {
            alias: "Console",
            clrName: "Internal.Console",
            assemblyName: "System.Private.CoreLib",
            kind: "Class",
            methods: [],
            properties: [],
            fields: [],
          },
        ],
      });

      const bindingApi = ctx.binding as unknown as {
        resolveImport: (node: ts.ImportSpecifier) => number | undefined;
        getSourceFilePathOfDecl: (decl: number) => string | undefined;
      };
      bindingApi.resolveImport = () => 1;
      bindingApi.getSourceFilePathOfDecl = () => declPath;

      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      try {
        const result = buildIrModule(sourceFile, testProgram, options, ctx);

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const imp = result.value.imports[0];
        if (!imp) throw new Error("Missing import");
        expect(imp.resolvedNamespace).to.equal("System");

        const spec = imp.specifiers[0];
        if (!spec || spec.kind !== "named") {
          throw new Error("Missing named specifier");
        }

        expect(spec.name).to.equal("Console");
        expect(spec.isType).to.not.equal(true);
        expect(spec.resolvedClrType).to.equal("System.Console");
      } finally {
        fixture.cleanup();
      }
    });

    it("attaches CLR identities for installed declaration-package facade imports", () => {
      const fixture = materializeImportExtractionFixture([
        "fragments/surface-isolation/custom-clr-surface",
        "declaration-package-facade",
      ]);
      const tempDir = fixture.path("app");
      const entryPath = fixture.path("app/src/test.ts");
      const programResult = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: fixture.path("app/src"),
        rootNamespace: "TestApp",
        surface: "clr",
      });
      expect(programResult.ok).to.equal(true);
      if (!programResult.ok) {
        fixture.cleanup();
        return;
      }
      const testProgram = programResult.value;
      const sourceFile = testProgram.sourceFiles.find(
        (file) => path.resolve(file.fileName) === path.resolve(entryPath)
      );
      if (!sourceFile) {
        fixture.cleanup();
        throw new Error("Failed to create source file");
      }
      const options = {
        sourceRoot: fixture.path("app/src"),
        rootNamespace: "TestApp",
      };
      const ctx = createProgramContext(testProgram, options);

      const systemBindingsPath = path.join(
        tempDir,
        "node_modules/@tsonic/dotnet/System/bindings.json"
      );
      ctx.bindings.addBindings(systemBindingsPath, {
        namespace: "System",
        types: [
          {
            alias: "Console",
            clrName: "System.Console",
            assemblyName: "System.Console",
            kind: "Class",
            methods: [],
            properties: [],
            fields: [],
          },
          {
            alias: "DateTimeOffset",
            clrName: "System.DateTimeOffset",
            assemblyName: "System.Runtime",
            kind: "Class",
            methods: [],
            properties: [],
            fields: [],
          },
        ],
      } as BindingFile);

      try {
        const result = buildIrModule(sourceFile, testProgram, options, ctx);

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const imp = result.value.imports[0];
        if (!imp) throw new Error("Missing import");

        expect(imp.isLocal).to.equal(true);
        expect(imp.isClr).to.equal(false);
        expect(imp.resolvedNamespace).to.equal("System");

        const consoleImport = imp.specifiers[0];
        const dateImport = imp.specifiers[1];
        if (!consoleImport || consoleImport.kind !== "named") {
          throw new Error("Missing Console named import");
        }
        if (!dateImport || dateImport.kind !== "named") {
          throw new Error("Missing DateTimeOffset named import");
        }

        expect(consoleImport.localName).to.equal("DotnetConsole");
        expect(consoleImport.resolvedClrType).to.equal("System.Console");
        expect(consoleImport.resolvedClrValue).to.equal(undefined);
        expect(dateImport.resolvedClrType).to.equal("System.DateTimeOffset");
      } finally {
        fixture.cleanup();
      }
    });

    it("should error if a CLR namespace value import lacks tsbindgen exports mapping", () => {
      const source = `
        import { buildSite } from "@demo/pkg/Demo.js";
      `;

      const { testProgram, ctx, options } = createTestProgram(source);

      // Stub CLR resolution for this unit test (no filesystem / node resolution).
      (
        ctx as unknown as { clrResolver: { resolve: (s: string) => unknown } }
      ).clrResolver = {
        resolve: (s: string) =>
          s === "@demo/pkg/Demo.js"
            ? {
                isClr: true,
                packageName: "@demo/pkg",
                resolvedNamespace: "Demo",
                bindingsPath: "/x/bindings.json",
                assembly: "Demo",
              }
            : { isClr: false },
      };

      // Provide a minimal tsbindgen bindings.json excerpt WITHOUT exports.
      ctx.bindings.addBindings("/x/bindings.json", {
        namespace: "Demo",
        types: [],
      });

      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN4004")).to.equal(true);
    });

    it("treats node alias named imports as module-bound values without TSN4004", () => {
      const source = `
        import { join } from "node:path";
        void join;
      `;

      const {
        testProgram,
        ctx,
        options: baseOptions,
      } = createTestProgram(source);
      const options = { ...baseOptions, surface: "@tsonic/js" as const };
      (ctx as { surface: "@tsonic/js" }).surface = "@tsonic/js";

      (
        ctx as unknown as { clrResolver: { resolve: (s: string) => unknown } }
      ).clrResolver = {
        resolve: () => ({ isClr: false }),
      };
      ctx.bindings.addBindings("/x/node-modules.json", {
        bindings: {
          "node:path": {
            kind: "module",
            assembly: "nodejs",
            type: "nodejs.path",
          },
          path: {
            kind: "module",
            assembly: "nodejs",
            type: "nodejs.path",
          },
        },
      });
      ctx.bindings.addBindings("/x/node-types.json", {
        namespace: "nodejs",
        types: [
          {
            clrName: "nodejs.path",
            assemblyName: "nodejs",
            methods: [],
            properties: [],
            fields: [],
          },
        ],
      });

      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(ctx.diagnostics.some((d) => d.code === "TSN4004")).to.equal(false);
      const imp = result.value.imports[0];
      if (!imp) throw new Error("Missing import");
      expect(imp.source).to.equal("node:path");
      expect(imp.resolvedClrType).to.equal("nodejs.path");
      const spec = imp.specifiers[0];
      if (!spec || spec.kind !== "named") throw new Error("Missing named spec");
      expect(spec.name).to.equal("join");
      expect(spec.resolvedClrValue).to.equal(undefined);
    });

    it("treats source-package node subpath imports as module-bound values without TSN4004", () => {
      const source = `
        import { createServer } from "@tsonic/nodejs/http.js";
        void createServer;
      `;

      const {
        testProgram,
        ctx,
        options: baseOptions,
      } = createTestProgram(source);
      const options = { ...baseOptions, surface: "@tsonic/js" as const };
      (ctx as { surface: "@tsonic/js" }).surface = "@tsonic/js";

      (
        ctx as unknown as { clrResolver: { resolve: (s: string) => unknown } }
      ).clrResolver = {
        resolve: () => ({ isClr: false }),
      };
      ctx.bindings.addBindings("/x/node-modules.json", {
        bindings: {
          "node:http": {
            kind: "module",
            assembly: "nodejs",
            type: "nodejs.Http.http",
          },
          http: {
            kind: "module",
            assembly: "nodejs",
            type: "nodejs.Http.http",
          },
        },
      });
      ctx.bindings.addBindings("/x/node-types.json", {
        namespace: "nodejs.Http",
        types: [
          {
            clrName: "nodejs.Http.http",
            assemblyName: "nodejs",
            methods: [],
            properties: [],
            fields: [],
          },
        ],
      });

      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(ctx.diagnostics.some((d) => d.code === "TSN4004")).to.equal(false);
      const imp = result.value.imports[0];
      if (!imp) throw new Error("Missing import");
      expect(imp.source).to.equal("@tsonic/nodejs/http.js");
      expect(imp.resolvedClrType).to.equal("nodejs.Http.http");
      const spec = imp.specifiers[0];
      if (!spec || spec.kind !== "named") throw new Error("Missing named spec");
      expect(spec.name).to.equal("createServer");
      expect(spec.resolvedClrValue).to.equal(undefined);
    });

    it("does not globally hijack module-bound named value imports to unrelated CLR types", () => {
      const source = `
        import { Buffer } from "@tsonic/nodejs/buffer.js";
        void Buffer;
      `;

      const {
        testProgram,
        ctx,
        options: baseOptions,
      } = createTestProgram(source);
      const options = { ...baseOptions, surface: "@tsonic/js" as const };
      (ctx as { surface: "@tsonic/js" }).surface = "@tsonic/js";

      (
        ctx as unknown as { clrResolver: { resolve: (s: string) => unknown } }
      ).clrResolver = {
        resolve: () => ({ isClr: false }),
      };
      ctx.bindings.addBindings("/x/node-modules.json", {
        bindings: {
          "@tsonic/nodejs/buffer.js": {
            kind: "module",
            assembly: "nodejs",
            type: "nodejs.buffer",
            sourceImport: "@tsonic/nodejs/buffer.js",
          },
        },
      });
      ctx.bindings.addBindings("/x/unrelated-types.json", {
        namespace: "System",
        types: [
          {
            clrName: "System.Buffer",
            assemblyName: "System.Runtime",
            methods: [],
            properties: [],
            fields: [],
          },
        ],
      });

      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const imp = result.value.imports[0];
      if (!imp) throw new Error("Missing import");
      expect(imp.resolvedClrType).to.equal("nodejs.buffer");

      const spec = imp.specifiers[0];
      if (!spec || spec.kind !== "named") throw new Error("Missing named spec");
      expect(spec.name).to.equal("Buffer");
      expect(spec.resolvedClrType).to.equal(undefined);
      expect(spec.resolvedClrValue).to.equal(undefined);
    });

    it("prefers installed source-package imports over CLR resolution", () => {
      const fixture = materializeImportExtractionFixture([
        "fragments/minimal-surfaces/tsonic-js",
        "source-package-preferred-over-clr",
      ]);

      try {
        const entryPath = fixture.path("app/src/test.ts");
        const programResult = createProgram([entryPath], {
          projectRoot: fixture.path("app"),
          sourceRoot: fixture.path("app/src"),
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
        });
        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const testProgram = programResult.value;
        const sourceFile = testProgram.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const options = {
          sourceRoot: fixture.path("app/src"),
          rootNamespace: "TestApp",
          surface: "@tsonic/js" as const,
        };
        const ctx = createProgramContext(testProgram, options);
        (ctx as { surface: "@tsonic/js" }).surface = "@tsonic/js";
        (
          ctx as unknown as {
            clrResolver: { resolve: (specifier: string) => unknown };
          }
        ).clrResolver = {
          resolve: (specifier: string) =>
            specifier === "@tsonic/nodejs/process.js"
              ? {
                  isClr: true as const,
                  resolvedNamespace: "process",
                }
              : { isClr: false as const },
        };

        const result = buildIrModule(sourceFile, testProgram, options, ctx);

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const imp = result.value.imports[0];
        if (!imp) throw new Error("Missing import");
        expect(imp.source).to.equal("@tsonic/nodejs/process.js");
        expect(imp.isLocal).to.equal(true);
        expect(imp.isClr).to.equal(false);
        expect(imp.resolvedNamespace).to.equal(undefined);
        expect(imp.resolvedClrType).to.equal(undefined);
        expect(imp.resolvedPath).to.equal(
          fixture.path("app/node_modules/@tsonic/nodejs/src/process-module.ts")
        );
      } finally {
        fixture.cleanup();
      }
    });

    it("resolves module-bound import type clauses to owning CLR types", () => {
      const source = `
        import type { IncomingMessage, ServerResponse } from "node:http";
        let req: IncomingMessage | undefined;
        let res: ServerResponse | undefined;
        void req;
        void res;
      `;

      const {
        testProgram,
        ctx,
        options: baseOptions,
      } = createTestProgram(source);
      const options = {
        ...baseOptions,
        surface: "@tsonic/js" as const,
      };

      ctx.bindings.addBindings("/x/node-modules.json", {
        bindings: {
          "node:http": {
            kind: "module",
            assembly: "nodejs",
            type: "nodejs.Http.http",
          },
        },
      });

      const fixture = materializeImportExtractionFixture(
        "module-bound-type-clauses"
      );
      const declPath = fixture.path("nodejs.Http/internal/index.d.ts");

      const bindingApi = ctx.binding as unknown as {
        resolveImport: (node: ts.ImportSpecifier) => number | undefined;
        getSourceFilePathOfDecl: (decl: number) => string | undefined;
      };
      bindingApi.resolveImport = () => 1;
      bindingApi.getSourceFilePathOfDecl = () => declPath;

      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      try {
        const result = buildIrModule(sourceFile, testProgram, options, ctx);
        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const imp = result.value.imports[0];
        if (!imp) throw new Error("Missing import");
        expect(imp.resolvedNamespace).to.equal("nodejs.Http");

        const incoming = imp.specifiers[0];
        const response = imp.specifiers[1];
        if (
          !incoming ||
          incoming.kind !== "named" ||
          !response ||
          response.kind !== "named"
        ) {
          throw new Error("Missing named import specifiers");
        }

        expect(incoming.isType).to.equal(true);
        expect(incoming.resolvedClrType).to.equal(
          "nodejs.Http.IncomingMessage"
        );
        expect(response.isType).to.equal(true);
        expect(response.resolvedClrType).to.equal("nodejs.Http.ServerResponse");
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves installed source-package redirect metadata without CLR bindings", () => {
      const fixture = materializeImportExtractionFixture([
        "fragments/minimal-surfaces/tsonic-js",
        "source-package-redirect",
      ]);

      try {
        const entryPath = fixture.path("app/src/test.ts");
        const projectRoot = fixture.path("app");
        const sourceRoot = fixture.path("app/src");

        const programResult = createProgram([entryPath], {
          projectRoot,
          sourceRoot,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
        });
        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot,
          rootNamespace: "TestApp",
        });
        const options = {
          sourceRoot,
          rootNamespace: "TestApp",
        };
        (ctx as { surface: "@tsonic/js" }).surface = "@tsonic/js";

        const result = buildIrModule(sourceFile, program, options, ctx);

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const imp = result.value.imports[0];
        if (!imp) throw new Error("Missing import");
        expect(imp.isLocal).to.equal(true);
        expect(imp.isClr).to.equal(false);
        expect(imp.resolvedClrType).to.equal(undefined);
        expect(imp.resolvedNamespace).to.equal(undefined);
        expect(imp.resolvedPath).to.equal(
          fixture.path("app/node_modules/@tsonic/nodejs/src/http/index.ts")
        );

        const incoming = imp.specifiers[0];
        const response = imp.specifiers[1];
        if (
          !incoming ||
          incoming.kind !== "named" ||
          !response ||
          response.kind !== "named"
        ) {
          throw new Error("Missing named import specifiers");
        }

        expect(incoming.resolvedClrType).to.equal(undefined);
        expect(response.resolvedClrType).to.equal(undefined);
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves node alias source-package redirect metadata without CLR bindings", () => {
      const fixture = materializeImportExtractionFixture([
        "fragments/minimal-surfaces/tsonic-js",
        "node-alias-source-package-redirect",
      ]);

      try {
        const entryPath = fixture.path("app/src/test.ts");
        const projectRoot = fixture.path("app");
        const sourceRoot = fixture.path("app/src");

        const programResult = createProgram([entryPath], {
          projectRoot,
          sourceRoot,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
        });
        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot,
          rootNamespace: "TestApp",
        });
        const options = {
          sourceRoot,
          rootNamespace: "TestApp",
        };
        (ctx as { surface: "@tsonic/js" }).surface = "@tsonic/js";

        const result = buildIrModule(sourceFile, program, options, ctx);

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const pathImport = result.value.imports[0];
        const httpImport = result.value.imports[1];
        if (!pathImport || !httpImport) {
          throw new Error("Missing source-package node alias imports");
        }

        expect(pathImport.source).to.equal("node:path");
        expect(pathImport.isLocal).to.equal(true);
        expect(pathImport.isClr).to.equal(false);
        expect(pathImport.resolvedClrType).to.equal(undefined);
        expect(pathImport.resolvedNamespace).to.equal(undefined);
        expect(pathImport.resolvedPath).to.equal(
          fixture.path("app/node_modules/@tsonic/nodejs/src/path.ts")
        );

        expect(httpImport.source).to.equal("node:http");
        expect(httpImport.isLocal).to.equal(true);
        expect(httpImport.isClr).to.equal(false);
        expect(httpImport.resolvedClrType).to.equal(undefined);
        expect(httpImport.resolvedNamespace).to.equal(undefined);
        expect(httpImport.resolvedPath).to.equal(
          fixture.path("app/node_modules/@tsonic/nodejs/src/http/index.ts")
        );

        const createServer = httpImport.specifiers[0];
        const incoming = httpImport.specifiers[1];
        const server = httpImport.specifiers[2];
        const response = httpImport.specifiers[3];
        if (
          !createServer ||
          createServer.kind !== "named" ||
          !incoming ||
          incoming.kind !== "named" ||
          !server ||
          server.kind !== "named" ||
          !response ||
          response.kind !== "named"
        ) {
          throw new Error("Missing node:http named import specifiers");
        }

        expect(createServer.isType).to.equal(false);
        expect(createServer.resolvedClrValue).to.equal(undefined);
        expect(incoming.isType).to.equal(true);
        expect(incoming.resolvedClrType).to.equal(undefined);
        expect(server.isType).to.equal(true);
        expect(server.resolvedClrType).to.equal(undefined);
        expect(response.isType).to.equal(true);
        expect(response.resolvedClrType).to.equal(undefined);

        const serverDecl = result.value.body.find(
          (
            stmt
          ): stmt is Extract<typeof stmt, { kind: "variableDeclaration" }> =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0]?.name.name === "server"
        );
        expect(serverDecl).to.not.equal(undefined);
        if (!serverDecl) return;

        const serverType = serverDecl.declarations[0]?.type;
        expect(serverType?.kind).to.equal("unionType");
        if (!serverType || serverType.kind !== "unionType") return;

        const importedServerType = serverType.types.find(
          (part): part is Extract<typeof part, { kind: "referenceType" }> =>
            part.kind === "referenceType"
        );
        expect(importedServerType?.typeId?.assemblyName).to.equal(
          "@tsonic/nodejs"
        );

        const handlerDecl = result.value.body.find(
          (
            stmt
          ): stmt is Extract<typeof stmt, { kind: "variableDeclaration" }> =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0]?.name.name === "handler"
        );
        expect(handlerDecl).to.not.equal(undefined);
        if (!handlerDecl) return;

        const handlerType = handlerDecl.declarations[0]?.type;
        expect(handlerType?.kind).to.equal("functionType");
        if (!handlerType || handlerType.kind !== "functionType") return;

        const requestType = handlerType.parameters[0]?.type;
        const responseType = handlerType.parameters[1]?.type;
        if (
          !requestType ||
          requestType.kind !== "referenceType" ||
          !responseType ||
          responseType.kind !== "referenceType"
        ) {
          throw new Error("Expected source-package function parameter types");
        }

        expect(requestType.typeId?.assemblyName).to.equal("@tsonic/nodejs");
        expect(responseType.typeId?.assemblyName).to.equal("@tsonic/nodejs");
      } finally {
        fixture.cleanup();
      }
    });

    it("should not detect bare imports as .NET without package bindings", () => {
      // Import-driven resolution: bare imports like "System.IO" are only detected as .NET
      // if they come from a package with bindings.json. Without an actual package,
      // the import is not recognized as .NET.
      const source = `
        import { File } from "System.IO";
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const imports = result.value.imports;
        const firstImport = imports[0];
        if (!firstImport) throw new Error("Missing import");
        // Without an actual package with bindings.json, this is NOT detected as .NET
        expect(firstImport.isClr).to.equal(false);
        expect(firstImport.resolvedNamespace).to.equal(undefined);
      }
    });

    it("keeps exact imported source type identity in overload return syntax when sibling modules share a simple name", () => {
      const { sourceFile, testProgram, ctx, options, cleanup } =
        createFilesystemTestProgram(
          {
            "src/http/server.ts": `
              export class Server {
                public end(): Server {
                  return this;
                }
              }
            `,
            "src/net/server.ts": `
              export class Server {
                public close(): Server {
                  return this;
                }
              }
            `,
            "src/net/index.ts": `
              import { Server } from "./server.ts";

              export function createServer(): Server;
              export function createServer(seed: boolean): Server;
              export function createServer(seed?: boolean): Server {
                if (seed) {
                  return new Server().close();
                }
                return new Server();
              }
            `,
          },
          "src/net/index.ts"
        );

      try {
        const result = buildIrModule(sourceFile, testProgram, options, ctx);
        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const overloads = result.value.body.filter(
          (
            stmt
          ): stmt is Extract<typeof stmt, { kind: "functionDeclaration" }> =>
            stmt.kind === "functionDeclaration" && stmt.name === "createServer"
        );
        expect(overloads.length).to.be.greaterThan(0);

        for (const overload of overloads) {
          expect(overload.returnType?.kind).to.equal("referenceType");
          if (
            !overload.returnType ||
            overload.returnType.kind !== "referenceType"
          ) {
            throw new Error("Expected referenceType return");
          }

          expect(overload.returnType.typeId?.clrName).to.equal(
            "TestApp.net.Server"
          );
        }
      } finally {
        cleanup();
      }
    });
  });
});
