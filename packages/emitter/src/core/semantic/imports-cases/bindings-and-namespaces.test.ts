/**
 * Tests for Import Handling
 * Tests emission of .NET and local imports
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../../../emitter.js";
import { IrModule } from "@tsonic/frontend";

describe("Import Handling", () => {
  it("should lower named imports from module bindings to static CLR members", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/app.ts",
      namespace: "MyApp",
      className: "app",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "node:fs",
          isLocal: false,
          isClr: false,
          resolvedClrType: "nodejs.fs",
          specifiers: [
            {
              kind: "named",
              name: "readFileSync",
              localName: "readFileSync",
              isType: false,
            },
          ],
        },
      ],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "identifier",
              name: "readFileSync",
            },
            arguments: [{ kind: "literal", value: "README.md" }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include('global::nodejs.fs.readFileSync("README.md")');
  });

  it("should resolve source-package redirects through the local source graph even when module bindings exist", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/app.ts",
      namespace: "MyApp",
      className: "app",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "node:http",
          isLocal: true,
          isClr: false,
          resolvedPath: "/node_modules/@tsonic/nodejs/src/http/index.ts",
          resolvedClrType: "nodejs.Http.http",
          resolvedNamespace: "nodejs.Http",
          specifiers: [
            {
              kind: "named",
              name: "createServer",
              localName: "createServer",
              isType: false,
            },
            {
              kind: "named",
              name: "IncomingMessage",
              localName: "IncomingMessage",
              isType: true,
              resolvedClrType: "nodejs.Http.IncomingMessage",
            },
            {
              kind: "named",
              name: "ServerResponse",
              localName: "ServerResponse",
              isType: true,
              resolvedClrType: "nodejs.Http.ServerResponse",
            },
          ],
        },
      ],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "identifier",
              name: "createServer",
            },
            arguments: [
              {
                kind: "arrowFunction",
                parameters: [
                  {
                    kind: "parameter",
                    pattern: { kind: "identifierPattern", name: "req" },
                    type: {
                      kind: "referenceType",
                      name: "IncomingMessage",
                      resolvedClrType: "nodejs.Http.IncomingMessage",
                    },
                    isOptional: false,
                    isRest: false,
                    passing: "value",
                  },
                  {
                    kind: "parameter",
                    pattern: { kind: "identifierPattern", name: "res" },
                    type: {
                      kind: "referenceType",
                      name: "ServerResponse",
                      resolvedClrType: "nodejs.Http.ServerResponse",
                    },
                    isOptional: false,
                    isRest: false,
                    passing: "value",
                  },
                ],
                body: {
                  kind: "blockStatement",
                  statements: [],
                },
                isAsync: false,
              },
            ],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module, {
      moduleMap: new Map([
        [
          "node_modules/@tsonic/nodejs/src/http/index",
          {
            namespace: "nodejs.Http",
            className: "http",
            filePath: "node_modules/@tsonic/nodejs/src/http/index",
            hasRuntimeContainer: true,
            hasTopLevelCode: false,
            imports: [],
            exports: [
              { name: "createServer", isDefault: false, kind: "function" },
            ],
            exportedValueKinds: new Map([["createServer", "function"]]),
            localTypes: new Map(),
            hasTypeCollision: false,
          },
        ],
        [
          "node_modules/@tsonic/nodejs/src/http/incoming-message",
          {
            namespace: "nodejs.Http",
            className: "IncomingMessage",
            filePath: "node_modules/@tsonic/nodejs/src/http/incoming-message",
            hasRuntimeContainer: false,
            hasTopLevelCode: false,
            imports: [],
            exports: [],
            exportedValueKinds: new Map(),
            localTypes: new Map(),
            hasTypeCollision: false,
          },
        ],
        [
          "node_modules/@tsonic/nodejs/src/http/server-response",
          {
            namespace: "nodejs.Http",
            className: "ServerResponse",
            filePath: "node_modules/@tsonic/nodejs/src/http/server-response",
            hasRuntimeContainer: false,
            hasTopLevelCode: false,
            imports: [],
            exports: [],
            exportedValueKinds: new Map(),
            localTypes: new Map(),
            hasTypeCollision: false,
          },
        ],
      ]),
      exportMap: new Map([
        [
          "node_modules/@tsonic/nodejs/src/http/index:IncomingMessage",
          {
            sourceFile: "node_modules/@tsonic/nodejs/src/http/incoming-message",
            sourceName: "IncomingMessage",
          },
        ],
        [
          "node_modules/@tsonic/nodejs/src/http/index:ServerResponse",
          {
            sourceFile: "node_modules/@tsonic/nodejs/src/http/server-response",
            sourceName: "ServerResponse",
          },
        ],
      ]),
    });
    expect(result).to.include("global::nodejs.Http.http.createServer");
    expect(result).to.include("global::nodejs.Http.IncomingMessage");
    expect(result).to.include("global::nodejs.Http.ServerResponse");
    expect(result).not.to.include("global::MyApp");
  });

  it("resolves source-package class re-exports to the generated declaring type instead of the coarse module binding root", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/app.ts",
      namespace: "MyApp",
      className: "app",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "@tsonic/nodejs/buffer.js",
          isLocal: true,
          isClr: false,
          resolvedPath: "/node_modules/@tsonic/nodejs/src/buffer/index.ts",
          resolvedClrType: "nodejs.buffer",
          resolvedNamespace: "nodejs",
          specifiers: [
            {
              kind: "named",
              name: "Buffer",
              localName: "Buffer",
              isType: true,
              resolvedClrType: "nodejs.Buffer",
            },
          ],
        },
      ],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: { kind: "identifier", name: "Buffer" },
              property: "alloc",
              isComputed: false,
              isOptional: false,
            },
            arguments: [{ kind: "literal", value: 8 }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module, {
      moduleMap: new Map([
        [
          "node_modules/@tsonic/nodejs/src/buffer/index",
          {
            namespace: "nodejs",
            className: "buffer",
            filePath: "node_modules/@tsonic/nodejs/src/buffer/index",
            hasRuntimeContainer: false,
            hasTopLevelCode: false,
            imports: [],
            exports: [],
            exportedValueKinds: new Map(),
            localTypes: new Map(),
            hasTypeCollision: false,
          },
        ],
        [
          "node_modules/@tsonic/nodejs/src/buffer/buffer",
          {
            namespace: "nodejs.Buffer",
            className: "Buffer",
            filePath: "node_modules/@tsonic/nodejs/src/buffer/buffer",
            hasRuntimeContainer: true,
            hasTopLevelCode: false,
            imports: [],
            exports: [],
            exportedValueKinds: new Map(),
            localTypes: new Map(),
            hasTypeCollision: false,
          },
        ],
      ]),
      exportMap: new Map([
        [
          "node_modules/@tsonic/nodejs/src/buffer/index:Buffer",
          {
            sourceFile: "node_modules/@tsonic/nodejs/src/buffer/buffer",
            sourceName: "Buffer",
          },
        ],
      ]),
    });

    expect(result).to.include("global::nodejs.Buffer.Buffer.alloc(8)");
    expect(result).not.to.include("global::nodejs.Buffer.alloc(8)");
  });

  it("resolves source-package value re-exports to the generated module container instead of the coarse module binding root", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/app.ts",
      namespace: "MyApp",
      className: "app",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "@tsonic/nodejs/zlib.js",
          isLocal: true,
          isClr: false,
          resolvedPath: "/node_modules/@tsonic/nodejs/src/zlib/index.ts",
          resolvedClrType: "nodejs.zlib",
          resolvedNamespace: "nodejs",
          specifiers: [
            {
              kind: "named",
              name: "gzipSync",
              localName: "gzipSync",
              isType: false,
            },
          ],
        },
      ],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: { kind: "identifier", name: "gzipSync" },
            arguments: [{ kind: "identifier", name: "bytes" }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module, {
      moduleMap: new Map([
        [
          "node_modules/@tsonic/nodejs/src/zlib/index",
          {
            namespace: "nodejs",
            className: "zlib",
            filePath: "node_modules/@tsonic/nodejs/src/zlib/index",
            hasRuntimeContainer: false,
            hasTopLevelCode: false,
            imports: [],
            exports: [],
            exportedValueKinds: new Map(),
            localTypes: new Map(),
            hasTypeCollision: false,
          },
        ],
        [
          "node_modules/@tsonic/nodejs/src/zlib/zlib",
          {
            namespace: "nodejs.Zlib",
            className: "zlib",
            filePath: "node_modules/@tsonic/nodejs/src/zlib/zlib",
            hasRuntimeContainer: true,
            hasTopLevelCode: false,
            imports: [],
            exports: [
              { name: "gzipSync", isDefault: false, kind: "function" },
            ],
            exportedValueKinds: new Map([["gzipSync", "function"]]),
            localTypes: new Map(),
            hasTypeCollision: false,
          },
        ],
      ]),
      exportMap: new Map([
        [
          "node_modules/@tsonic/nodejs/src/zlib/index:gzipSync",
          {
            sourceFile: "node_modules/@tsonic/nodejs/src/zlib/zlib",
            sourceName: "gzipSync",
          },
        ],
      ]),
    });

    expect(result).to.include("global::nodejs.Zlib.zlib.gzipSync(bytes)");
    expect(result).not.to.include("global::nodejs.zlib.gzipSync(bytes)");
  });

  it("should lower node module object imports to namespace bindings", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/app.ts",
      namespace: "MyApp",
      className: "app",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "node:fs",
          isLocal: false,
          isClr: false,
          resolvedClrType: "nodejs.fs",
          specifiers: [
            {
              kind: "named",
              name: "fs",
              localName: "fs",
              isType: false,
            },
          ],
        },
      ],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "fs",
              },
              property: "existsSync",
              isComputed: false,
              isOptional: false,
            },
            arguments: [{ kind: "literal", value: "." }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("global::nodejs.fs");
    expect(result).to.match(
      /global::nodejs\.fs\.[A-Za-z_][A-Za-z0-9_]*\("\."\)/
    );
  });

  it("should lower default imports from module bindings to namespace bindings", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/app.ts",
      namespace: "MyApp",
      className: "app",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "node:fs",
          isLocal: false,
          isClr: false,
          resolvedClrType: "nodejs.fs",
          specifiers: [
            {
              kind: "default",
              localName: "fs",
            },
          ],
        },
      ],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "fs",
              },
              property: "existsSync",
              isComputed: false,
              isOptional: false,
            },
            arguments: [{ kind: "literal", value: "." }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("global::nodejs.fs");
    expect(result).to.match(
      /global::nodejs\.fs\.[A-Za-z_][A-Za-z0-9_]*\("\."\)/
    );
  });

  it("should infer module-object namespace imports from resolvedClrType name (no hardcoded module list)", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/app.ts",
      namespace: "MyApp",
      className: "app",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "node:child_process",
          isLocal: false,
          isClr: false,
          resolvedClrType: "nodejs.child_process",
          specifiers: [
            {
              kind: "named",
              name: "child_process",
              localName: "cp",
              isType: false,
            },
          ],
        },
      ],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "cp",
              },
              property: "exec",
              isComputed: false,
              isOptional: false,
            },
            arguments: [{ kind: "literal", value: "echo hi" }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include('global::nodejs.child_process.exec("echo hi")');
  });

  it("should lower namespace imports from node aliases to module CLR namespaces", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/app.ts",
      namespace: "MyApp",
      className: "app",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "node:path",
          isLocal: false,
          isClr: false,
          resolvedClrType: "nodejs.path",
          specifiers: [
            {
              kind: "namespace",
              localName: "pathMod",
            },
          ],
        },
      ],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: {
                kind: "memberAccess",
                object: {
                  kind: "identifier",
                  name: "pathMod",
                },
                property: "posix",
                isComputed: false,
                isOptional: false,
              },
              property: "join",
              isComputed: false,
              isOptional: false,
            },
            arguments: [
              { kind: "literal", value: "a" },
              { kind: "literal", value: "b" },
            ],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("global::nodejs.path");
    expect(result).to.match(
      /global::nodejs\.path\.[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*\("a", "b"\)/
    );
  });

  it("prefers module binding lowering when import is both CLR-resolved and module-bound", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/app.ts",
      namespace: "MyApp",
      className: "app",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "node:path",
          isLocal: false,
          isClr: true,
          resolvedNamespace: "nodejs",
          resolvedClrType: "nodejs.path",
          specifiers: [
            {
              kind: "named",
              name: "join",
              localName: "join",
              isType: false,
            },
          ],
        },
      ],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: { kind: "identifier", name: "join" },
            arguments: [
              { kind: "literal", value: "a" },
              { kind: "literal", value: "b" },
            ],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include('global::nodejs.path.join("a", "b")');
    expect(result).not.to.include("ICE: Missing resolvedClrValue");
  });

  it("binds CLR named imports with only resolvedClrType as static type containers", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/app.ts",
      namespace: "MyApp",
      className: "app",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "@tsonic/dotnet/System.Threading.Tasks.js",
          isLocal: false,
          isClr: true,
          resolvedNamespace: "System.Threading.Tasks",
          specifiers: [
            {
              kind: "named",
              name: "Task",
              localName: "TaskValue",
              isType: false,
              resolvedClrType: "System.Threading.Tasks.Task",
            },
          ],
        },
      ],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "memberAccess",
            object: { kind: "identifier", name: "TaskValue" },
            property: "CompletedTask",
            isComputed: false,
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include(
      "global::System.Threading.Tasks.Task.CompletedTask"
    );
    expect(result).not.to.include("ICE: Missing resolvedClrValue");
  });

  it("binds module-bound named value imports with resolvedClrType as CLR type containers", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/app.ts",
      namespace: "MyApp",
      className: "app",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "@tsonic/nodejs/buffer.js",
          isLocal: false,
          isClr: false,
          resolvedClrType: "nodejs.buffer",
          resolvedNamespace: "nodejs",
          specifiers: [
            {
              kind: "named",
              name: "Buffer",
              localName: "Buffer",
              isType: false,
              resolvedClrType: "nodejs.Buffer",
            },
          ],
        },
      ],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: { kind: "identifier", name: "Buffer" },
              property: "alloc",
              isComputed: false,
              isOptional: false,
            },
            arguments: [{ kind: "literal", value: 8 }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("global::nodejs.Buffer.alloc(8)");
    expect(result).not.to.include("global::nodejs.buffer.Buffer");
  });

  it("falls back to module namespace for source-package type imports without per-spec CLR type metadata", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/app.ts",
      namespace: "MyApp",
      className: "app",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "node:http",
          isLocal: false,
          isClr: false,
          resolvedClrType: "nodejs.Http.http",
          resolvedNamespace: "nodejs.Http",
          specifiers: [
            {
              kind: "named",
              name: "IncomingMessage",
              localName: "IncomingMessage",
              isType: true,
            },
          ],
        },
      ],
      body: [],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.be.a("string");
  });
});
