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
          "node_modules/@tsonic/nodejs/tsonic/package-manifest.json":
            JSON.stringify(
              {
                schemaVersion: 1,
                kind: "tsonic-source-package",
                surfaces: ["@tsonic/js"],
                source: {
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

    it("preserves module-bound CLR type metadata for installed source-package redirects", () => {
      const project = createFilesystemTestProgram(
        {
          "src/test.ts": `
            import type { IncomingMessage, ServerResponse } from "node:http";
            let req: IncomingMessage | undefined;
            let res: ServerResponse | undefined;
            void req;
            void res;
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
          "node_modules/@tsonic/nodejs/tsonic/package-manifest.json":
            JSON.stringify(
              {
                schemaVersion: 1,
                kind: "tsonic-source-package",
                surfaces: ["@tsonic/js"],
                source: {
                  exports: {
                    "./http.js": "./src/http/index.ts",
                  },
                },
              },
              null,
              2
            ),
          "node_modules/@tsonic/nodejs/src/http/index.ts": `
            export interface IncomingMessage {}
            export interface ServerResponse {}
          `,
        },
        "src/test.ts"
      );

      try {
        const options = { ...project.options, surface: "@tsonic/js" as const };
        (project.ctx as { surface: "@tsonic/js" }).surface = "@tsonic/js";
        project.ctx.bindings.addBindings(
          path.join(
            project.tempDir,
            "node_modules/@tsonic/nodejs/bindings.json"
          ),
          {
            bindings: {
              "node:http": {
                kind: "module",
                assembly: "nodejs",
                type: "nodejs.Http.http",
                sourceImport: "@tsonic/nodejs/http.js",
              },
            },
          }
        );

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
        expect(imp.isLocal).to.equal(true);
        expect(imp.resolvedClrType).to.equal("nodejs.Http.http");
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

        expect(incoming.resolvedClrType).to.equal(
          "nodejs.Http.IncomingMessage"
        );
        expect(response.resolvedClrType).to.equal("nodejs.Http.ServerResponse");
      } finally {
        project.cleanup();
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
