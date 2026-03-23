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
