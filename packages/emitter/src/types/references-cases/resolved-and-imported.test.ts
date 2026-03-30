import {
  baseContext,
  clrTypeNameToTypeAst,
  createModuleWithType,
  describe,
  emitModule,
  emitReferenceType,
  expect,
  it,
  printType,
} from "./helpers.js";
import type { IrModule } from "./helpers.js";
describe("Reference Type Emission", () => {
  describe("Pre-resolved CLR Types", () => {
    it("should use resolvedClrType when present", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Action",
        resolvedClrType: "global::System.Action",
      });

      const result = emitModule(module);

      expect(result).to.include("global::System.Action");
    });

    it("should use resolvedClrType with type arguments", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Func",
        resolvedClrType: "global::System.Func",
        typeArguments: [
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "number" },
        ],
      });

      const result = emitModule(module);

      expect(result).to.include("global::System.Func<string, double>");
    });

    it("should sanitize CLR metadata generic names in resolvedClrType", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Ok",
        resolvedClrType: "Jotster.Core.types.Ok__Alias`1",
        typeArguments: [{ kind: "primitiveType", name: "string" }],
      });

      const result = emitModule(module);

      expect(result).to.include("global::Jotster.Core.types.Ok__Alias<string>");
      expect(result).to.not.include("Ok__Alias`1");
    });

    it("keeps same-module local types unqualified even when resolvedClrType is present", () => {
      const [typeAst] = emitReferenceType(
        {
          kind: "referenceType",
          name: "Wrapper",
          resolvedClrType: "Test.Wrapper",
          typeArguments: [{ kind: "primitiveType", name: "string" }],
        },
        {
          ...baseContext,
          moduleNamespace: "Test",
          localTypes: new Map([
            [
              "Wrapper",
              {
                kind: "class",
                typeParameters: ["T"],
                members: [],
                implements: [],
              },
            ],
          ]),
        }
      );

      expect(printType(typeAst)).to.equal("Wrapper<string>");
    });
  });

  describe("Imported Type Identity", () => {
    it("should map Foo$instance to imported Foo CLR type", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "Test",
        isStaticContainer: true,
        imports: [
          {
            kind: "import",
            source: "@jotster/core/Jotster.Core.js",
            isLocal: false,
            isClr: true,
            resolvedNamespace: "Jotster.Core",
            specifiers: [
              {
                kind: "named",
                name: "Channel",
                localName: "Channel",
                isType: true,
                resolvedClrType: "Jotster.Core.db.entities.Channel",
              },
            ],
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
                name: { kind: "identifierPattern", name: "x" },
                type: {
                  kind: "referenceType",
                  name: "Channel$instance",
                },
                initializer: { kind: "literal", value: null },
              },
            ],
          },
        ],
        exports: [],
      };

      const result = emitModule(module);
      expect(result).to.include("global::Jotster.Core.db.entities.Channel x");
    });

    it("should sanitize imported CLR metadata generic names", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "Test",
        isStaticContainer: true,
        imports: [
          {
            kind: "import",
            source: "@jotster/core/Jotster.Core.types.js",
            isLocal: false,
            isClr: true,
            resolvedNamespace: "Jotster.Core.types",
            specifiers: [
              {
                kind: "named",
                name: "Ok",
                localName: "Ok",
                isType: true,
                resolvedClrType: "Jotster.Core.types.Ok__Alias`1",
              },
            ],
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
                name: { kind: "identifierPattern", name: "x" },
                type: {
                  kind: "referenceType",
                  name: "Ok",
                  typeArguments: [{ kind: "primitiveType", name: "string" }],
                },
                initializer: { kind: "literal", value: null },
              },
            ],
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      expect(result).to.include(
        "global::Jotster.Core.types.Ok__Alias<string> x"
      );
      expect(result).to.not.include("Ok__Alias`1");
    });

    it("should emit imported primitive aliases as C# primitives", () => {
      const [typeAst] = emitReferenceType(
        {
          kind: "referenceType",
          name: "MetricName",
        },
        {
          ...baseContext,
          importBindings: new Map([
            [
              "MetricName",
              {
                kind: "type",
                typeAst: clrTypeNameToTypeAst("string"),
              },
            ],
          ]),
        }
      );

      expect(printType(typeAst)).to.equal("string");
    });

    it("should emit arrays of imported primitive aliases without global qualification", () => {
      const [typeAst] = emitReferenceType(
        {
          kind: "referenceType",
          name: "Array",
          typeArguments: [
            {
              kind: "referenceType",
              name: "MetricName",
            },
          ],
        },
        {
          ...baseContext,
          importBindings: new Map([
            [
              "MetricName",
              {
                kind: "type",
                typeAst: clrTypeNameToTypeAst("string"),
              },
            ],
          ]),
        }
      );

      expect(printType(typeAst)).to.equal("string[]");
    });

    it("should use module-bound imported type FQNs instead of module container members", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "Test",
        isStaticContainer: true,
        imports: [
          {
            kind: "import",
            source: "node:http",
            isLocal: false,
            isClr: false,
            resolvedClrType: "nodejs.Http.http",
            specifiers: [
              {
                kind: "named",
                name: "IncomingMessage",
                localName: "IncomingMessage",
                isType: true,
                resolvedClrType: "nodejs.Http.IncomingMessage",
              },
            ],
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
            ],
          },
        ],
        exports: [],
      };

      const result = emitModule(module);
      expect(result).to.include("global::nodejs.Http.IncomingMessage req");
      expect(result).not.to.include("global::nodejs.Http.http.IncomingMessage");
    });

    it("should resolve aliased local type imports when IR normalizes to the exported name", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/http/index.ts",
        namespace: "nodejs.Http",
        className: "http",
        isStaticContainer: true,
        imports: [
          {
            kind: "import",
            source: "./incoming-message.ts",
            isLocal: true,
            isClr: false,
            resolvedPath: "/src/http/incoming-message.ts",
            specifiers: [
              {
                kind: "named",
                name: "IncomingMessage",
                localName: "IncomingMessageType",
                isType: true,
              },
            ],
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
            ],
          },
        ],
        exports: [],
      };

      const result = emitModule(module, {
        rootNamespace: "nodejs",
        moduleMap: new Map([
          [
            "src/http/incoming-message",
            {
              namespace: "nodejs.Http",
              className: "incoming_message",
              filePath: "src/http/incoming-message",
              hasRuntimeContainer: false,
              hasTypeCollision: false,
            },
          ],
        ]),
      });

      expect(result).to.include("global::nodejs.Http.IncomingMessage req");
    });

    it("prefers cross-module source aliases over imported resolved CLR names", () => {
      const [typeAst] = emitReferenceType(
        {
          kind: "referenceType",
          name: "RequestHandler",
          resolvedClrType: "demo.expresslike.RequestHandler",
        },
        {
          ...baseContext,
          moduleNamespace: "Acme.App",
          options: {
            ...baseContext.options,
            moduleMap: new Map([
              [
                "src/types",
                {
                  namespace: "demo.expresslike",
                  className: "types",
                  filePath: "src/types",
                  hasRuntimeContainer: false,
                  hasTypeCollision: false,
                  localTypes: new Map([
                    [
                      "RequestHandler",
                      {
                        kind: "typeAlias",
                        typeParameters: [],
                        type: { kind: "primitiveType", name: "string" },
                      },
                    ],
                  ]),
                },
              ],
            ]),
          },
        }
      );

      expect(printType(typeAst)).to.equal("string");
    });

    it("keeps explicit imported type bindings authoritative over stale resolvedClrType", () => {
      const [typeAst] = emitReferenceType(
        {
          kind: "referenceType",
          name: "Server",
          resolvedClrType: "nodejs.http.Server",
        },
        {
          ...baseContext,
          moduleNamespace: "nodejs.net",
          importBindings: new Map([
            [
              "Server",
              {
                kind: "type",
                typeAst: clrTypeNameToTypeAst("global::nodejs.net.Server"),
              },
            ],
          ]),
        }
      );

      expect(printType(typeAst)).to.equal("global::nodejs.net.Server");
    });

    it("uses class-valued import bindings in type positions when the import stays value-bound", () => {
      const [typeAst] = emitReferenceType(
        {
          kind: "referenceType",
          name: "Server",
          resolvedClrType: "nodejs.http.Server",
        },
        {
          ...baseContext,
          moduleNamespace: "nodejs.net",
          importBindings: new Map([
            [
              "Server",
              {
                kind: "value",
                clrName: "global::nodejs.net.server",
                member: "Server",
                typeAst: clrTypeNameToTypeAst("global::nodejs.net.Server"),
              },
            ],
          ]),
        }
      );

      expect(printType(typeAst)).to.equal("global::nodejs.net.Server");
    });

    it("keeps explicit imported type bindings authoritative over structural registry rebound", () => {
      const [typeAst] = emitReferenceType(
        {
          kind: "referenceType",
          name: "Server",
          typeId: {
            stableId: "nodejs:nodejs.net.Server",
            clrName: "nodejs.net.Server",
            assemblyName: "nodejs",
            tsName: "Server",
          },
        },
        {
          ...baseContext,
          moduleNamespace: "nodejs.net",
          importBindings: new Map([
            [
              "Server",
              {
                kind: "type",
                typeAst: clrTypeNameToTypeAst("global::nodejs.net.Server"),
              },
            ],
          ]),
          bindingsRegistry: new Map([
            [
              "Server",
              {
                alias: "Server",
                name: "nodejs.http.Server",
                kind: "class",
                members: [],
              },
            ],
          ]),
          options: {
            ...baseContext.options,
            moduleMap: new Map([
              [
                "net/server",
                {
                  namespace: "nodejs.net",
                  className: "server",
                  filePath: "net/server",
                  hasRuntimeContainer: false,
                  hasTypeCollision: false,
                  localTypes: new Map([
                    [
                      "Server",
                      {
                        kind: "class",
                        typeParameters: [],
                        members: [],
                        implements: [],
                      },
                    ],
                  ]),
                },
              ],
              [
                "http/server",
                {
                  namespace: "nodejs.http",
                  className: "server",
                  filePath: "http/server",
                  hasRuntimeContainer: false,
                  hasTypeCollision: false,
                  localTypes: new Map([
                    [
                      "Server",
                      {
                        kind: "class",
                        typeParameters: [],
                        members: [],
                        implements: [],
                      },
                    ],
                  ]),
                },
              ],
            ]),
          },
        }
      );

      expect(printType(typeAst)).to.equal("global::nodejs.net.Server");
    });

    it("ignores bare resolvedClrType names when a source-local type exists", () => {
      const [typeAst] = emitReferenceType(
        {
          kind: "referenceType",
          name: "ArrayBuffer",
          resolvedClrType: "ArrayBuffer",
        },
        {
          ...baseContext,
          moduleNamespace: "js",
          options: {
            ...baseContext.options,
            moduleMap: new Map([
              [
                "src/array-buffer-object",
                {
                  namespace: "js",
                  className: "array_buffer_object",
                  filePath: "src/array-buffer-object",
                  hasRuntimeContainer: false,
                  hasTypeCollision: false,
                  localTypes: new Map([
                    [
                      "ArrayBuffer",
                      {
                        kind: "class",
                        members: [],
                        typeParameters: [],
                        implements: [],
                      },
                    ],
                  ]),
                },
              ],
            ]),
          },
        }
      );

      expect(printType(typeAst)).to.equal("global::js.ArrayBuffer");
    });

    it("canonicalizes qualified cross-module local type names to the matched local symbol", () => {
      const [typeAst] = emitReferenceType(
        {
          kind: "referenceType",
          name: "js.TypedArrayBase",
          resolvedClrType: "js.TypedArrayBase",
        },
        {
          ...baseContext,
          moduleNamespace: "nodejs",
          options: {
            ...baseContext.options,
            moduleMap: new Map([
              [
                "src/typed-array-base",
                {
                  namespace: "js",
                  className: "typed_array_base",
                  filePath: "src/typed-array-base",
                  hasRuntimeContainer: false,
                  hasTypeCollision: false,
                  localTypes: new Map([
                    [
                      "TypedArrayBase",
                      {
                        kind: "class",
                        members: [],
                        typeParameters: [],
                        implements: [],
                      },
                    ],
                  ]),
                },
              ],
            ]),
          },
        }
      );

      expect(printType(typeAst)).to.equal("global::js.TypedArrayBase");
    });

    it("canonicalizes instance-suffixed cross-module local type lookups to the declaring local symbol", () => {
      const [typeAst] = emitReferenceType(
        {
          kind: "referenceType",
          name: "Object$instance",
          resolvedClrType: "System.Object",
        },
        {
          ...baseContext,
          moduleNamespace: "nodejs.assert",
          options: {
            ...baseContext.options,
            moduleMap: new Map([
              [
                "src/object",
                {
                  namespace: "System",
                  className: "object",
                  filePath: "src/object",
                  hasRuntimeContainer: false,
                  hasTypeCollision: false,
                  localTypes: new Map([
                    [
                      "Object",
                      {
                        kind: "class",
                        members: [],
                        typeParameters: [],
                        implements: [],
                      },
                    ],
                  ]),
                },
              ],
            ]),
          },
        }
      );

      expect(printType(typeAst)).to.equal("global::System.Object");
    });
  });
});
