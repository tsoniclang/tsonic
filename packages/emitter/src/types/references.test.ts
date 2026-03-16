/**
 * Tests for Reference Type Emission
 *
 * Tests:
 * - bindingsRegistry lookup for CLR types
 * - C# primitive type passthrough
 * - Local type passthrough
 * - Hard failure for unresolved external types
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitCSharpFiles, emitModule } from "../emitter.js";
import { IrModule, IrType } from "@tsonic/frontend";
import type { TypeBinding as FrontendTypeBinding } from "@tsonic/frontend";
import { emitReferenceType } from "./references.js";
import { emitTypeAst } from "./emitter.js";
import type { EmitterContext } from "../types.js";
import { clrTypeNameToTypeAst } from "../core/format/backend-ast/utils.js";
import { printType } from "../core/format/backend-ast/printer.js";

/**
 * Helper to create a minimal module with a variable declaration of a given type
 */
const createModuleWithType = (varType: IrType): IrModule => ({
  kind: "module",
  filePath: "/src/test.ts",
  namespace: "Test",
  className: "Test",
  isStaticContainer: true,
  imports: [],
  body: [
    {
      kind: "variableDeclaration",
      declarationKind: "const",
      isExported: false,
      declarations: [
        {
          kind: "variableDeclarator",
          name: { kind: "identifierPattern", name: "x" },
          type: varType,
          initializer: { kind: "literal", value: null },
        },
      ],
    },
  ],
  exports: [],
});

describe("Reference Type Emission", () => {
  const baseContext: EmitterContext = {
    indentLevel: 0,
    isStatic: false,
    isAsync: false,
    options: { rootNamespace: "Test" },
    usings: new Set<string>(),
  };

  describe("C# Primitive Types", () => {
    it("should emit every real C# predefined reference keyword without qualification", () => {
      const keywords = [
        "bool",
        "byte",
        "sbyte",
        "short",
        "ushort",
        "int",
        "uint",
        "long",
        "ulong",
        "nint",
        "nuint",
        "char",
        "float",
        "double",
        "decimal",
        "string",
        "object",
      ] as const;

      for (const keyword of keywords) {
        const module = createModuleWithType({
          kind: "referenceType",
          name: keyword,
        });

        const result = emitModule(module);
        expect(result).to.include(`${keyword} x`);
      }
    });

    it("should emit exact BCL numeric aliases as System value types", () => {
      const cases = [
        ["half", "global::System.Half"],
        ["int128", "global::System.Int128"],
        ["uint128", "global::System.UInt128"],
      ] as const;

      for (const [typeName, expected] of cases) {
        const [typeAst] = emitReferenceType(
          {
            kind: "referenceType",
            name: typeName,
          },
          baseContext
        );

        expect(printType(typeAst)).to.equal(expected);
      }
    });
  });

  describe("Known Builtin Types", () => {
    it("should emit Array<T> as native T[] array", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Array",
        typeArguments: [{ kind: "primitiveType", name: "number" }],
      });

      const result = emitModule(module);

      expect(result).to.include("double[]");
      expect(result).not.to.include("List");
    });

    it("should emit Promise<T> as Task<T>", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Promise",
        typeArguments: [{ kind: "primitiveType", name: "string" }],
      });

      const result = emitModule(module);

      expect(result).to.include("global::System.Threading.Tasks.Task<string>");
    });

    it("should emit Error when provided through emitter bindings", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Error",
      });

      const errorBinding: FrontendTypeBinding = {
        name: "Tsonic.JSRuntime.Error",
        alias: "Error",
        kind: "class",
        members: [],
      };

      const result = emitModule(module, {
        clrBindings: new Map([["Error", errorBinding]]),
      });

      expect(result).to.include("global::Tsonic.JSRuntime.Error x");
    });
  });

  describe("Polymorphic This", () => {
    it("emits polymorphic this markers as the declaring type", () => {
      const [typeAst] = emitTypeAst(
        {
          kind: "typeParameterType",
          name: "__tsonic_polymorphic_this",
        },
        {
          ...baseContext,
          declaringTypeName: "Router",
        }
      );

      expect(printType(typeAst)).to.equal("Router");
    });
  });

  describe("Recursive Type Aliases", () => {
    it("emits recursive union aliases without infinite expansion", () => {
      const pathSpecRef: IrType = {
        kind: "referenceType",
        name: "PathSpec",
      };

      const [typeAst] = emitReferenceType(pathSpecRef, {
        ...baseContext,
        localTypes: new Map([
          [
            "PathSpec",
            {
              kind: "typeAlias",
              typeParameters: [],
              type: {
                kind: "unionType",
                types: [
                  { kind: "primitiveType", name: "string" },
                  {
                    kind: "referenceType",
                    name: "RegExp",
                    resolvedClrType: "System.Text.RegularExpressions.Regex",
                  },
                  {
                    kind: "arrayType",
                    elementType: pathSpecRef,
                    origin: "explicit",
                  },
                  { kind: "primitiveType", name: "null" },
                  { kind: "primitiveType", name: "undefined" },
                ],
              },
            },
          ],
        ]),
      });

      const printed = printType(typeAst);
      expect(printed).to.equal(
        "global::Tsonic.Runtime.Union<object?[], string, global::System.Text.RegularExpressions.Regex>?"
      );
    });

    it("emits recursive middleware aliases without stack overflow", () => {
      const middlewareParamRef: IrType = {
        kind: "referenceType",
        name: "MiddlewareParam",
      };

      const [typeAst] = emitReferenceType(middlewareParamRef, {
        ...baseContext,
        localTypes: new Map([
          [
            "MiddlewareParam",
            {
              kind: "typeAlias",
              typeParameters: [],
              type: {
                kind: "unionType",
                types: [
                  {
                    kind: "referenceType",
                    name: "MiddlewareHandler",
                    resolvedClrType: "System.Delegate",
                  },
                  {
                    kind: "arrayType",
                    elementType: middlewareParamRef,
                    origin: "explicit",
                  },
                ],
              },
            },
          ],
        ]),
      });

      const printed = printType(typeAst);
      expect(printed).to.equal(
        "global::Tsonic.Runtime.Union<object?[], global::System.Delegate>"
      );
    });

    it("does not leak recursive alias resolution state into later emissions", () => {
      const middlewareParamRef: IrType = {
        kind: "referenceType",
        name: "MiddlewareParam",
      };
      const middlewareLikeRef: IrType = {
        kind: "referenceType",
        name: "MiddlewareLike",
      };

      const recursiveContext: EmitterContext = {
        ...baseContext,
        localTypes: new Map([
          [
            "MiddlewareParam",
            {
              kind: "typeAlias",
              typeParameters: [],
              type: {
                kind: "unionType",
                types: [
                  {
                    kind: "referenceType",
                    name: "MiddlewareHandler",
                    resolvedClrType: "System.Delegate",
                  },
                  {
                    kind: "arrayType",
                    elementType: middlewareParamRef,
                    origin: "explicit",
                  },
                ],
              },
            },
          ],
          [
            "MiddlewareLike",
            {
              kind: "typeAlias",
              typeParameters: [],
              type: {
                kind: "unionType",
                types: [
                  middlewareParamRef,
                  {
                    kind: "referenceType",
                    name: "Router",
                    resolvedClrType: "Test.Router",
                  },
                  {
                    kind: "arrayType",
                    elementType: middlewareLikeRef,
                    origin: "explicit",
                  },
                ],
              },
            },
          ],
        ]),
      };

      const [firstTypeAst, nextContext] = emitTypeAst(
        middlewareLikeRef,
        recursiveContext
      );
      const [secondTypeAst] = emitTypeAst(middlewareLikeRef, nextContext);

      expect(nextContext.resolvingTypeAliases).to.equal(
        recursiveContext.resolvingTypeAliases
      );
      expect(printType(firstTypeAst)).to.equal(printType(secondTypeAst));
      expect(printType(secondTypeAst)).to.equal(
        "global::Tsonic.Runtime.Union<object?[], global::System.Delegate, global::Test.Router>"
      );
    });

    it("preserves recursive array alias members when emitting outer array containers", () => {
      const middlewareParamRef: IrType = {
        kind: "referenceType",
        name: "MiddlewareParam",
      };
      const middlewareLikeRef: IrType = {
        kind: "referenceType",
        name: "MiddlewareLike",
      };

      const recursiveContext: EmitterContext = {
        ...baseContext,
        localTypes: new Map([
          [
            "MiddlewareParam",
            {
              kind: "typeAlias",
              typeParameters: [],
              type: {
                kind: "unionType",
                types: [
                  {
                    kind: "referenceType",
                    name: "MiddlewareHandler",
                    resolvedClrType: "System.Delegate",
                  },
                  {
                    kind: "arrayType",
                    elementType: middlewareParamRef,
                    origin: "explicit",
                  },
                ],
              },
            },
          ],
          [
            "MiddlewareLike",
            {
              kind: "typeAlias",
              typeParameters: [],
              type: {
                kind: "unionType",
                types: [
                  middlewareParamRef,
                  {
                    kind: "referenceType",
                    name: "Router",
                    resolvedClrType: "Test.Router",
                  },
                  {
                    kind: "arrayType",
                    elementType: middlewareLikeRef,
                    origin: "explicit",
                  },
                ],
              },
            },
          ],
        ]),
      };

      const [typeAst] = emitTypeAst(
        {
          kind: "arrayType",
          elementType: middlewareLikeRef,
          origin: "explicit",
        },
        recursiveContext
      );

      expect(printType(typeAst)).to.equal("object[]");
    });
  });

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
  });

  describe("Bindings Registry Types", () => {
    it("should strip generic arity markers from CLR names", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Dictionary_2",
        typeArguments: [
          { kind: "primitiveType", name: "int" },
          { kind: "primitiveType", name: "string" },
        ],
      });

      const dictionaryBinding: FrontendTypeBinding = {
        name: "System.Collections.Generic.Dictionary`2",
        alias: "Dictionary_2",
        kind: "class",
        members: [],
      };

      const clrBindings = new Map<string, FrontendTypeBinding>([
        ["Dictionary_2", dictionaryBinding],
      ]);

      const result = emitModule(module, { clrBindings });

      expect(result).to.include(
        "global::System.Collections.Generic.Dictionary<int, string>"
      );
      expect(result).to.not.include("Dictionary`2");
    });

    it("should preserve generic arguments for qualified canonical type identities", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "List",
        typeArguments: [{ kind: "primitiveType", name: "int" }],
        typeId: {
          stableId: "System.Private.CoreLib:System.Collections.Generic.List`1",
          clrName: "System.Collections.Generic.List`1",
          assemblyName: "System.Private.CoreLib",
          tsName: "List",
        },
      });

      const result = emitModule(module);

      expect(result).to.include("global::System.Collections.Generic.List<int>");
      expect(result).to.not.include("List`1");
    });

    it("should resolve tsbindgen instance aliases through registry base names", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "MkdirOptions$instance",
      });

      const mkdirOptionsBinding: FrontendTypeBinding = {
        name: "nodejs.MkdirOptions",
        alias: "MkdirOptions",
        kind: "class",
        members: [],
      };

      const clrBindings = new Map<string, FrontendTypeBinding>([
        ["MkdirOptions", mkdirOptionsBinding],
      ]);

      const result = emitModule(module, { clrBindings });

      expect(result).to.include("global::nodejs.MkdirOptions x");
    });

    it("should canonicalize anonymous structural references to a unique binding-backed type", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "__Anon_local",
        structuralMembers: [
          {
            kind: "propertySignature",
            name: "success",
            type: { kind: "literalType", value: true },
            isOptional: false,
            isReadonly: false,
          },
          {
            kind: "propertySignature",
            name: "rendered",
            type: { kind: "primitiveType", name: "string" },
            isOptional: false,
            isReadonly: false,
          },
        ],
      });

      const anonymousBinding: FrontendTypeBinding = {
        name: "Acme.Messages.__Anon_8be6_614f176b",
        alias: "__Anon_8be6_614f176b",
        kind: "class",
        members: [
          {
            kind: "property",
            alias: "success",
            name: "success",
            semanticType: { kind: "literalType", value: true },
            binding: {
              assembly: "Acme.Messages",
              type: "Acme.Messages.__Anon_8be6_614f176b",
              member: "success",
            },
          },
          {
            kind: "property",
            alias: "rendered",
            name: "rendered",
            semanticType: { kind: "primitiveType", name: "string" },
            binding: {
              assembly: "Acme.Messages",
              type: "Acme.Messages.__Anon_8be6_614f176b",
              member: "rendered",
            },
          },
        ],
      };

      const clrBindings = new Map<string, FrontendTypeBinding>([
        [anonymousBinding.alias, anonymousBinding],
      ]);

      const result = emitModule(module, { clrBindings });

      expect(result).to.include("global::Acme.Messages.__Anon_8be6_614f176b x");
      expect(result).to.not.include("__Anon_local x");
    });
  });

  describe("Local Types", () => {
    it("should emit local class types without qualification", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "Test",
        isStaticContainer: true,
        imports: [],
        body: [
          // Define a local class
          {
            kind: "classDeclaration",
            name: "User",
            isExported: true,
            isStruct: false,
            typeParameters: [],
            implements: [],
            members: [],
          },
          // Use the local class as a type
          {
            kind: "variableDeclaration",
            declarationKind: "const",
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "user" },
                type: { kind: "referenceType", name: "User" },
                initializer: { kind: "literal", value: null },
              },
            ],
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      expect(result).to.include("User user");
    });

    it("should emit local interface types without qualification", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "Test",
        isStaticContainer: true,
        imports: [],
        body: [
          // Define a local interface
          {
            kind: "interfaceDeclaration",
            name: "IUser",
            isExported: true,
            isStruct: false,
            typeParameters: [],
            extends: [],
            members: [],
          },
          // Use the local interface as a type
          {
            kind: "variableDeclaration",
            declarationKind: "const",
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "user" },
                type: { kind: "referenceType", name: "IUser" },
                initializer: { kind: "literal", value: null },
              },
            ],
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      expect(result).to.include("IUser user");
    });

    it("should map generic void type arguments to object", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "Test",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "classDeclaration",
            name: "Box",
            isExported: true,
            isStruct: false,
            typeParameters: [{ kind: "typeParameter", name: "T" }],
            implements: [],
            members: [],
          },
          {
            kind: "variableDeclaration",
            declarationKind: "const",
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "box" },
                type: {
                  kind: "referenceType",
                  name: "Box",
                  typeArguments: [{ kind: "voidType" }],
                },
                initializer: { kind: "literal", value: null },
              },
            ],
          },
        ],
        exports: [],
      };

      const result = emitModule(module);
      expect(result).to.include("Box<object> box");
    });

    it("should redirect canonicalized local structural types", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/repo/test.ts",
        namespace: "Repo",
        className: "Test",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "interfaceDeclaration",
            name: "Row",
            isExported: false,
            isStruct: false,
            typeParameters: [],
            extends: [],
            members: [
              {
                kind: "propertySignature",
                name: "id",
                type: { kind: "primitiveType", name: "string" },
                isOptional: false,
                isReadonly: false,
              },
            ],
          },
          {
            kind: "variableDeclaration",
            declarationKind: "const",
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "row" },
                type: { kind: "referenceType", name: "Row" },
                initializer: { kind: "literal", value: null },
              },
            ],
          },
        ],
        exports: [],
      };

      const result = emitModule(module, {
        canonicalLocalTypeTargets: new Map([["Repo::Row", "Domain.Row"]]),
      });

      expect(result).to.include("global::Domain.Row row");
    });
  });

  describe("Array Indexing", () => {
    it("should use native indexer for array indexing", () => {
      // This test creates a module with array index access
      // Should use native indexer, not JSRuntime.Array.get()
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "test",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "functionDeclaration",
            name: "getFirst",
            isExported: true,
            isAsync: false,
            isGenerator: false,
            parameters: [
              {
                kind: "parameter",
                pattern: { kind: "identifierPattern", name: "arr" },
                type: {
                  kind: "arrayType",
                  elementType: { kind: "primitiveType", name: "number" },
                },
                isOptional: false,
                isRest: false,
                passing: "value",
              },
            ],
            returnType: { kind: "primitiveType", name: "number" },
            body: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "returnStatement",
                  expression: {
                    kind: "memberAccess",
                    object: {
                      kind: "identifier",
                      name: "arr",
                      inferredType: {
                        kind: "arrayType",
                        elementType: { kind: "primitiveType", name: "number" },
                      },
                    },
                    property: {
                      kind: "literal",
                      value: 0,
                      // Proof marker: int literal
                      inferredType: {
                        kind: "primitiveType",
                        name: "int",
                      },
                    },
                    isComputed: true,
                    isOptional: false,
                    accessKind: "clrIndexer",
                  },
                },
              ],
            },
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      // Output should NOT contain JSRuntime
      expect(result).to.not.include("Tsonic.JSRuntime");
      // Should use native indexer (no cast needed with proof marker)
      expect(result).to.include("arr[0]");
    });
  });

  describe("Cross-module local type resolution", () => {
    it("should qualify imported interface references from another module", () => {
      const apiModule: IrModule = {
        kind: "module",
        filePath: "/src/model/api.ts",
        namespace: "Test.Model",
        className: "api",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "interfaceDeclaration",
            name: "MetricsRow",
            isExported: true,
            isStruct: false,
            typeParameters: [],
            extends: [],
            members: [
              {
                kind: "propertySignature",
                name: "count",
                type: { kind: "referenceType", name: "int" },
                isOptional: false,
                isReadonly: false,
              },
            ],
          },
        ],
        exports: [],
      };

      const queryModule: IrModule = {
        kind: "module",
        filePath: "/src/db/query.ts",
        namespace: "Test.Db",
        className: "query",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "variableDeclaration",
            declarationKind: "const",
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "rows" },
                type: {
                  kind: "referenceType",
                  name: "global::System.Collections.Generic.List",
                  resolvedClrType: "global::System.Collections.Generic.List",
                  typeArguments: [
                    { kind: "referenceType", name: "MetricsRow" },
                  ],
                },
                initializer: { kind: "literal", value: null },
              },
            ],
          },
        ],
        exports: [],
      };

      const result = emitCSharpFiles([apiModule, queryModule], {
        rootNamespace: "Test",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const queryCode = Array.from(result.files.entries()).find(([filePath]) =>
        filePath.endsWith("query.cs")
      )?.[1];
      expect(queryCode).to.not.equal(undefined);
      expect(queryCode).to.include(
        "global::System.Collections.Generic.List<global::Test.Model.MetricsRow> rows"
      );
    });
  });
});
