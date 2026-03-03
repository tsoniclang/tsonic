/**
 * Tests for Import Handling
 * Tests emission of .NET and local imports
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../../emitter.js";
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
});
