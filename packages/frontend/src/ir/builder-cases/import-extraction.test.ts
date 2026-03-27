/**
 * IR Builder tests: Import Extraction
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildIrModule } from "../builder.js";
import {
  createProgram,
  createProgramContext,
  createFilesystemTestProgram,
  createTestProgram,
} from "./_test-helpers.js";

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

      const tempRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-system-console-")
      );
      const declPath = path.join(
        tempRoot,
        "Internal",
        "internal",
        "index.d.ts"
      );
      const internalBindingsPath = path.join(
        tempRoot,
        "Internal",
        "bindings.json"
      );
      const systemBindingsPath = path.join(tempRoot, "System", "bindings.json");

      fs.mkdirSync(path.dirname(declPath), { recursive: true });
      fs.mkdirSync(path.dirname(internalBindingsPath), { recursive: true });
      fs.mkdirSync(path.dirname(systemBindingsPath), { recursive: true });
      fs.writeFileSync(
        declPath,
        "export declare const Console: { WriteLine(value: string): void };\n",
        "utf-8"
      );
      fs.writeFileSync(
        internalBindingsPath,
        JSON.stringify({ namespace: "Internal" }),
        "utf-8"
      );
      fs.writeFileSync(
        systemBindingsPath,
        JSON.stringify({ namespace: "System" }),
        "utf-8"
      );

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
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    });

    it("attaches CLR identities for installed declaration-package facade imports", () => {
      const {
        tempDir,
        sourceFile,
        testProgram,
        ctx,
        options,
        cleanup,
      } = createFilesystemTestProgram(
        {
          "src/test.ts": `
            import { Console as DotnetConsole, DateTimeOffset } from "@tsonic/dotnet/System.js";
            void DotnetConsole;
            void DateTimeOffset;
          `,
          "node_modules/@tsonic/dotnet/package.json": JSON.stringify(
            {
              name: "@tsonic/dotnet",
              type: "module",
            },
            null,
            2
          ),
          "node_modules/@tsonic/dotnet/System.js": "export {};\n",
          "node_modules/@tsonic/dotnet/System.d.ts": `
            export { Console$instance as Console, DateTimeOffset } from "./System/internal/index.js";
          `,
          "node_modules/@tsonic/dotnet/System/internal/index.d.ts": `
            export declare const Console$instance: { WriteLine(value: string): void };
            export declare class DateTimeOffset {}
          `,
          "node_modules/@tsonic/dotnet/System/bindings.json": JSON.stringify(
            {
              namespace: "System",
              types: [
                {
                  alias: "Console",
                  stableId: "System.Console:System.Console",
                  clrName: "System.Console",
                  assemblyName: "System.Console",
                  kind: "Class",
                  accessibility: "Public",
                  isAbstract: false,
                  isSealed: false,
                  isStatic: true,
                  arity: 0,
                  methods: [],
                  properties: [],
                  fields: [],
                  constructors: [],
                },
                {
                  alias: "DateTimeOffset",
                  stableId: "System.Runtime:System.DateTimeOffset",
                  clrName: "System.DateTimeOffset",
                  assemblyName: "System.Runtime",
                  kind: "Class",
                  accessibility: "Public",
                  isAbstract: false,
                  isSealed: true,
                  isStatic: false,
                  arity: 0,
                  methods: [],
                  properties: [],
                  fields: [],
                  constructors: [],
                },
              ],
            },
            null,
            2
          ),
        },
        "src/test.ts"
      );

      const systemBindingsPath = path.join(
        tempDir,
        "node_modules/@tsonic/dotnet/System/bindings.json"
      );
      ctx.bindings.addBindings(
        systemBindingsPath,
        {
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
        } as any
      );

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
        cleanup();
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
      const project = createFilesystemTestProgram(
        {
          "src/test.ts": `
            import { process } from "@tsonic/nodejs/process.js";
            void process.version;
          `,
          "node_modules/@tsonic/nodejs/package.json": JSON.stringify(
            {
              name: "@tsonic/nodejs",
              version: "1.0.0",
              type: "module",
            },
            null,
            2
          ),
          "node_modules/@tsonic/nodejs/tsonic.package.json": JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@tsonic/js"],
              source: {
                namespace: "nodejs",
                exports: {
                  "./process.js": "./src/process-module.ts",
                },
              },
            },
            null,
            2
          ),
          "node_modules/@tsonic/nodejs/src/process-module.ts": `
            export const process = {
              version: "v1.0.0-tsonic",
            };
          `,
        },
        "src/test.ts"
      );

      try {
        const options = {
          ...project.options,
          surface: "@tsonic/js" as const,
        };
        (project.ctx as { surface: "@tsonic/js" }).surface = "@tsonic/js";
        (
          project.ctx as unknown as {
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

        const result = buildIrModule(
          project.sourceFile,
          project.testProgram,
          options,
          project.ctx
        );

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
          path.join(
            project.tempDir,
            "node_modules",
            "@tsonic",
            "nodejs",
            "src",
            "process-module.ts"
          )
        );
      } finally {
        project.cleanup();
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

      const tempRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-node-http-")
      );
      const declPath = path.join(
        tempRoot,
        "nodejs.Http",
        "internal",
        "index.d.ts"
      );
      const bindingsPath = path.join(tempRoot, "nodejs.Http", "bindings.json");
      fs.mkdirSync(path.dirname(declPath), { recursive: true });
      fs.writeFileSync(declPath, "export type IncomingMessage = unknown;\n");
      fs.writeFileSync(
        bindingsPath,
        JSON.stringify({ namespace: "nodejs.Http" }),
        "utf-8"
      );

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
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    });

    it("preserves installed source-package redirect metadata without CLR bindings", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-import-source-redirect-")
      );

      try {
        const authoritativeJsRoot = path.resolve(
          process.cwd(),
          "../../../js/versions/10"
        );
        expect(
          fs.existsSync(path.join(authoritativeJsRoot, "package.json"))
        ).to.equal(true);

        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });
        const entryPath = path.join(srcDir, "test.ts");
        fs.writeFileSync(
          entryPath,
          [
            'import type { IncomingMessage, ServerResponse } from "node:http";',
            "let req: IncomingMessage | undefined;",
            "let res: ServerResponse | undefined;",
            "void req;",
            "void res;",
          ].join("\n")
        );

        const nodejsRoot = path.join(tempDir, "node_modules", "@tsonic", "nodejs");
        fs.mkdirSync(path.join(nodejsRoot, "src", "http"), { recursive: true });
        fs.writeFileSync(
          path.join(nodejsRoot, "package.json"),
          JSON.stringify(
            {
              name: "@tsonic/nodejs",
              version: "1.0.0",
              type: "module",
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(nodejsRoot, "tsonic.package.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@tsonic/js"],
              source: {
                namespace: "nodejs",
                moduleAliases: {
                  "node:http": "./http.js",
                },
                exports: {
                  "./http.js": "./src/http/index.ts",
                },
              },
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(nodejsRoot, "src", "http", "index.ts"),
          [
            "export interface IncomingMessage {}",
            "export interface ServerResponse {}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
          typeRoots: [authoritativeJsRoot, nodejsRoot],
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
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });
        const options = {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        };

        const result = buildIrModule(
          sourceFile,
          program,
          options,
          ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const imp = result.value.imports[0];
        if (!imp) throw new Error("Missing import");
        expect(imp.isLocal).to.equal(true);
        expect(imp.isClr).to.equal(false);
        expect(imp.resolvedClrType).to.equal(undefined);
        expect(imp.resolvedNamespace).to.equal(undefined);
        expect(imp.resolvedPath).to.equal(
          path.join(
            tempDir,
            "node_modules",
            "@tsonic",
            "nodejs",
            "src",
            "http",
            "index.ts"
          )
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
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("preserves node alias source-package redirect metadata without CLR bindings", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-import-node-alias-source-redirect-")
      );

      try {
        const authoritativeJsRoot = path.resolve(
          process.cwd(),
          "../../../js/versions/10"
        );
        expect(
          fs.existsSync(path.join(authoritativeJsRoot, "package.json"))
        ).to.equal(true);

        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });
        const entryPath = path.join(srcDir, "test.ts");
        fs.writeFileSync(
          entryPath,
          [
            'import { resolve } from "node:path";',
            'import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";',
            "",
            "let req: IncomingMessage | undefined;",
            "let server: Server | undefined;",
            "let res: ServerResponse | undefined;",
            "const handler = (req: IncomingMessage, res: ServerResponse) => {",
            "  void req;",
            "  void res;",
            "};",
            "void resolve;",
            "void createServer;",
            "void handler;",
            "void req;",
            "void server;",
            "void res;",
          ].join("\n")
        );

        const nodejsRoot = path.join(tempDir, "node_modules", "@tsonic", "nodejs");
        fs.mkdirSync(path.join(nodejsRoot, "src", "http"), { recursive: true });
        fs.writeFileSync(
          path.join(nodejsRoot, "package.json"),
          JSON.stringify(
            {
              name: "@tsonic/nodejs",
              version: "1.0.0",
              type: "module",
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(nodejsRoot, "tsonic.package.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@tsonic/js"],
              source: {
                namespace: "nodejs",
                moduleAliases: {
                  "node:http": "./http.js",
                  "node:path": "./path.js",
                },
                exports: {
                  "./http.js": "./src/http/index.ts",
                  "./path.js": "./src/path-module.ts",
                },
              },
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(nodejsRoot, "src", "http", "index.ts"),
          [
            "export interface IncomingMessage {}",
            "export interface Server {}",
            "export interface ServerResponse {}",
            "export const createServer = (): void => {};",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(nodejsRoot, "src", "path-module.ts"),
          'export const resolve = (...parts: string[]): string => parts.join("/");\n'
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
          typeRoots: [authoritativeJsRoot, nodejsRoot],
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
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });
        const options = {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        };

        const result = buildIrModule(
          sourceFile,
          program,
          options,
          ctx
        );

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
          path.join(
            tempDir,
            "node_modules",
            "@tsonic",
            "nodejs",
            "src",
            "path-module.ts"
          )
        );

        expect(httpImport.source).to.equal("node:http");
        expect(httpImport.isLocal).to.equal(true);
        expect(httpImport.isClr).to.equal(false);
        expect(httpImport.resolvedClrType).to.equal(undefined);
        expect(httpImport.resolvedNamespace).to.equal(undefined);
        expect(httpImport.resolvedPath).to.equal(
          path.join(
            tempDir,
            "node_modules",
            "@tsonic",
            "nodejs",
            "src",
            "http",
            "index.ts"
          )
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
          (stmt): stmt is Extract<typeof stmt, { kind: "variableDeclaration" }> =>
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
          (stmt): stmt is Extract<typeof stmt, { kind: "variableDeclaration" }> =>
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
        fs.rmSync(tempDir, { recursive: true, force: true });
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
  });
});
