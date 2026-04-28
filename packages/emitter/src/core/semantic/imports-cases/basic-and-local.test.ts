/**
 * Tests for Import Handling
 * Tests emission of .NET and local imports
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../../../emitter.js";
import { IrModule } from "@tsonic/frontend";

describe("Import Handling", () => {
  it("should NOT emit using directives for .NET imports", () => {
    // .NET imports are resolved to fully-qualified names with global:: prefix,
    // so we don't emit using directives
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "System.IO",
          isLocal: false,
          isClr: true,
          specifiers: [],
          resolvedNamespace: "System.IO",
        },
        {
          kind: "import",
          source: "System.Text.Json",
          isLocal: false,
          isClr: true,
          specifiers: [],
          resolvedNamespace: "System.Text.Json",
        },
      ],
      body: [],
      exports: [],
    };

    const result = emitModule(module);

    // Should NOT include using directives - all types use global:: FQN
    expect(result).to.not.include("using System.IO");
    expect(result).to.not.include("using System.Text.Json");
  });

  it("should NOT emit using directives for local imports", () => {
    // Local module imports are always emitted as fully-qualified references,
    // so we don't need using directives for them
    const module: IrModule = {
      kind: "module",
      filePath: "/src/services/api.ts",
      namespace: "MyApp.services",
      className: "api",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "./auth.ts",
          isLocal: true,
          isClr: false,
          specifiers: [],
        },
        {
          kind: "import",
          source: "../models/User.ts",
          isLocal: true,
          isClr: false,
          specifiers: [],
        },
      ],
      body: [],
      exports: [],
    };

    const result = emitModule(module, { rootNamespace: "MyApp" });

    // Should NOT include using directives for local modules
    // (identifiers from local imports are emitted fully-qualified)
    expect(result).to.not.include("using MyApp.services;");
    expect(result).to.not.include("using MyApp.models;");
  });

  it("should lower local imports even when resolvedPath is absolute", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "common/imports/local-caller/Caller.ts",
      namespace: "TestCases.common.imports.localcaller",
      className: "Caller",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "./Auth.js",
          isLocal: true,
          isClr: false,
          resolvedPath: "/tmp/tsonic/common/imports/local-caller/Auth.ts",
          specifiers: [
            {
              kind: "named",
              name: "getAuth",
              localName: "getAuth",
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
              name: "getAuth",
            },
            arguments: [{ kind: "literal", value: false }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module, {
      moduleMap: new Map([
        [
          "common/imports/local-caller/Auth",
          {
            namespace: "TestCases.common.imports.localcaller",
            className: "Auth",
            filePath: "common/imports/local-caller/Auth.ts",
            hasRuntimeContainer: true,
            hasTopLevelCode: false,
            imports: [],
            exports: [
              {
                name: "getAuth",
                isDefault: false,
                kind: "function",
              },
            ],
            exportedValueKinds: new Map([["getAuth", "function"]]),
            localTypes: new Map(),
            hasTypeCollision: false,
          },
        ],
      ]),
    });

    expect(result).to.include(
      "global::TestCases.common.imports.localcaller.Auth.getAuth(false)"
    );
  });

  it("should lower source-package imports when resolvedPath points into node_modules", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "src/index.ts",
      namespace: "SourcePackageBasic",
      className: "index",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "@acme/math",
          isLocal: true,
          isClr: false,
          resolvedPath: "/tmp/project/node_modules/@acme/math/src/index.ts",
          specifiers: [
            {
              kind: "named",
              name: "clamp",
              localName: "clamp",
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
              name: "clamp",
            },
            arguments: [
              { kind: "literal", value: 10 },
              { kind: "literal", value: 0 },
              { kind: "literal", value: 5 },
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
          "node_modules/@acme/math/src/index",
          {
            namespace: "Acme.Math",
            className: "index",
            filePath: "node_modules/@acme/math/src/index",
            hasRuntimeContainer: true,
            hasTopLevelCode: false,
            imports: [],
            exports: [
              {
                name: "clamp",
                isDefault: false,
                kind: "function",
              },
            ],
            exportedValueKinds: new Map([["clamp", "function"]]),
            localTypes: new Map(),
            hasTypeCollision: false,
          },
        ],
      ]),
    });

    expect(result).to.include("global::Acme.Math.index.clamp(10, 0, 5)");
  });

  it("should lower bare node alias source-package imports to their projected module containers and types", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "src/serve-site.ts",
      namespace: "Tsumo.Engine",
      className: "serve_site",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "node:path",
          isLocal: true,
          isClr: false,
          resolvedPath:
            "/tmp/project/node_modules/@tsonic/nodejs/src/path-module.ts",
          specifiers: [
            {
              kind: "named",
              name: "resolve",
              localName: "resolve",
              isType: false,
            },
          ],
          resolvedClrType: "nodejs.path",
          resolvedNamespace: "nodejs",
        },
        {
          kind: "import",
          source: "node:http",
          isLocal: true,
          isClr: false,
          resolvedPath:
            "/tmp/project/node_modules/@tsonic/nodejs/src/http/index.ts",
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
          resolvedClrType: "nodejs.Http.http",
          resolvedNamespace: "nodejs.Http",
        },
      ],
      body: [
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "req" },
              type: {
                kind: "referenceType",
                name: "IncomingMessage$instance",
              },
              initializer: { kind: "literal", value: null },
            },
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "res" },
              type: {
                kind: "referenceType",
                name: "ServerResponse$instance",
              },
              initializer: { kind: "literal", value: null },
            },
          ],
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: { kind: "identifier", name: "resolve" },
            arguments: [
              { kind: "literal", value: "a" },
              { kind: "literal", value: "b" },
            ],
            isOptional: false,
          },
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: { kind: "identifier", name: "createServer" },
            arguments: [],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module, {
      moduleMap: new Map([
        [
          "node_modules/@tsonic/nodejs/src/path-module",
          {
            namespace: "nodejs",
            className: "PathModule",
            filePath: "node_modules/@tsonic/nodejs/src/path-module",
            hasRuntimeContainer: true,
            exportedValueKinds: new Map([["resolve", "function"]]),
            localTypes: new Map(),
            hasTypeCollision: false,
          },
        ],
        [
          "node_modules/@tsonic/nodejs/src/http/index",
          {
            namespace: "nodejs.Http",
            className: "http",
            filePath: "node_modules/@tsonic/nodejs/src/http/index",
            hasRuntimeContainer: true,
            exportedValueKinds: new Map([["createServer", "function"]]),
            localTypes: new Map(),
            hasTypeCollision: false,
          },
        ],
      ]),
    });

    expect(result).to.include('global::nodejs.PathModule.resolve("a", "b")');
    expect(result).to.include("global::nodejs.Http.IncomingMessage req");
    expect(result).to.include("global::nodejs.Http.ServerResponse res");
    expect(result).to.include("global::nodejs.Http.http.createServer()");
    expect(result).not.to.include("global::Tsumo.Engine.index.resolve");
    expect(result).not.to.include("global::Tsumo.Engine.IncomingMessage");
    expect(result).not.to.include("global::Tsumo.Engine.ServerResponse");
  });

  it("should lower default imports from source-package local modules to namespace bindings", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "src/index.ts",
      namespace: "SourcePackageDefaultImport",
      className: "index",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "@tsonic/nodejs/fs.js",
          isLocal: true,
          isClr: false,
          resolvedPath:
            "/tmp/project/node_modules/@tsonic/nodejs/src/fs-module.ts",
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
              object: { kind: "identifier", name: "fs" },
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

    const result = emitModule(module, {
      moduleMap: new Map([
        [
          "node_modules/@tsonic/nodejs/src/fs-module",
          {
            namespace: "nodejs",
            className: "fs_module",
            filePath: "node_modules/@tsonic/nodejs/src/fs-module",
            hasRuntimeContainer: true,
            exportedValueKinds: new Map([
              ["fs", "variable"],
              ["existsSync", "function"],
            ]),
            localTypes: new Map(),
            hasTypeCollision: false,
          },
        ],
      ]),
    });

    expect(result).to.include("global::nodejs.fs_module");
    expect(result).to.match(
      /global::nodejs\.fs_module\.[A-Za-z_][A-Za-z0-9_]*\("\."\)/
    );
  });

  it("should lower source-package imports when resolvedPath points to a sibling checkout", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-emitter-source-package-")
    );

    try {
      const packageRoot = path.join(tempDir, "js-next", "versions", "10");
      const resolvedConsolePath = path.join(packageRoot, "src", "console.ts");

      fs.mkdirSync(path.join(packageRoot, "src"), { recursive: true });
      fs.mkdirSync(path.join(packageRoot, "tsonic"), { recursive: true });
      fs.writeFileSync(
        path.join(packageRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/js", version: "10.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            source: { exports: { ".": "./src/index.ts" } },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        resolvedConsolePath,
        "export const error = console.error;\n"
      );

      const module: IrModule = {
        kind: "module",
        filePath: "src/App.ts",
        namespace: "MyApp",
        className: "App",
        isStaticContainer: true,
        imports: [
          {
            kind: "import",
            source: "@tsonic/js/console.js",
            isLocal: true,
            isClr: false,
            resolvedPath: resolvedConsolePath,
            specifiers: [
              {
                kind: "named",
                name: "error",
                localName: "consoleError",
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
                name: "consoleError",
              },
              arguments: [{ kind: "literal", value: "x" }],
              isOptional: false,
            },
          },
        ],
        exports: [],
      };

      const result = emitModule(module, {
        moduleMap: new Map([
          [
            "node_modules/@tsonic/js/src/console",
            {
              namespace: "js",
              className: "console",
              filePath: "node_modules/@tsonic/js/src/console",
              hasRuntimeContainer: true,
              hasTopLevelCode: false,
              imports: [],
              exports: [{ name: "error", isDefault: false, kind: "function" }],
              exportedValueKinds: new Map([["error", "function"]]),
              localTypes: new Map(),
              hasTypeCollision: false,
            },
          ],
        ]),
      });

      expect(result).to.include('global::js.console.error("x")');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
