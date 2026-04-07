import {
  describe,
  it,
  expect,
  emitModule,
  createJsSurfaceBindingRegistry,
  type IrModule,
} from "./helpers.js";

const jsSurfaceBindingRegistry = createJsSurfaceBindingRegistry();

describe("Expression Emission", () => {
  it("should emit hierarchical member bindings without emitting intermediate objects", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
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
              name: { kind: "identifierPattern", name: "result" },
              initializer: {
                kind: "call",
                callee: {
                  kind: "memberAccess",
                  object: {
                    kind: "memberAccess",
                    object: { kind: "identifier", name: "myLib" },
                    property: "math",
                    isComputed: false,
                    isOptional: false,
                  },
                  property: "add",
                  isComputed: false,
                  isOptional: false,
                  memberBinding: {
                    kind: "method",
                    assembly: "MyLib",
                    type: "MyLib.Math",
                    member: "Add",
                  },
                },
                arguments: [
                  { kind: "literal", value: 1 },
                  { kind: "literal", value: 2 },
                ],
                isOptional: false,
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Should emit global::MyLib.Math.Add directly
    expect(result).to.include("global::MyLib.Math.Add");
    // Should NOT include myLib.math (intermediate objects shouldn't appear)
    expect(result).not.to.include("myLib.math");
    // No using statements
    expect(result).not.to.include("using MyLib");
  });

  it("should handle member access without binding (regular property access)", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "memberAccess",
            object: { kind: "identifier", name: "obj" },
            property: "property",
            isComputed: false,
            isOptional: false,
            // No memberBinding - regular property access
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Should emit regular property access
    expect(result).to.include("obj.property");
  });

  it("should emit member-binding CLR name exactly (no surface rewrite)", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "memberAccess",
            object: {
              kind: "identifier",
              name: "value",
              inferredType: { kind: "primitiveType", name: "string" },
            },
            property: "length",
            isComputed: false,
            isOptional: false,
            memberBinding: {
              kind: "property",
              assembly: "System.Private.CoreLib",
              type: "System.String",
              member: "Length",
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("value.Length");
    expect(result).not.to.include("value.length");
  });

  it("should emit global simple-binding member access as static CLR access", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "memberAccess",
            object: {
              kind: "identifier",
              name: "console",
              inferredType: { kind: "referenceType", name: "Console" },
            },
            property: "log",
            isComputed: false,
            isOptional: false,
            memberBinding: {
              kind: "method",
              assembly: "js",
              type: "js.console",
              member: "log",
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("global::js.console.log");
  });

  it("should normalize nested CLR type names for static member access", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "memberAccess",
            object: {
              kind: "identifier",
              name: "Environment_SpecialFolder",
              inferredType: {
                kind: "referenceType",
                name: "Environment_SpecialFolder",
                resolvedClrType: "System.Environment+SpecialFolder",
              },
              resolvedClrType: "System.Environment+SpecialFolder",
            },
            property: "UserProfile",
            isComputed: false,
            isOptional: false,
            memberBinding: {
              kind: "property",
              assembly: "System.Private.CoreLib",
              type: "System.Environment+SpecialFolder",
              member: "UserProfile",
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include(
      "global::System.Environment.SpecialFolder.UserProfile"
    );
    expect(result).not.to.include("Environment+SpecialFolder");
  });

  it("should keep local member access when identifier case differs from CLR type leaf", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "memberAccess",
            object: {
              kind: "identifier",
              name: "entity",
              inferredType: {
                kind: "referenceType",
                name: "Entity",
                resolvedClrType: "Acme.Core.Entity",
              },
            },
            property: "Maybe",
            isComputed: false,
            isOptional: false,
            memberBinding: {
              kind: "property",
              assembly: "Acme.Core",
              type: "Acme.Core.Entity",
              member: "Maybe",
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("entity.Maybe");
    expect(result).not.to.include("global::Acme.Core.Entity.Maybe");
  });

  it("should emit extension member value access as static invocation", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "memberAccess",
            object: {
              kind: "identifier",
              name: "value",
              inferredType: { kind: "primitiveType", name: "string" },
            },
            property: "length",
            isComputed: false,
            isOptional: false,
            memberBinding: {
              kind: "method",
              assembly: "js",
              type: "js.String",
              member: "length",
              isExtensionMethod: true,
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("global::js.String.length(value)");
    expect(result).not.to.include("value.length");
  });

  it("should emit array wrapper call for non-System.Array member bindings", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "nums",
                inferredType: {
                  kind: "arrayType",
                  elementType: { kind: "primitiveType", name: "int" },
                },
              },
              property: "map",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "method",
                assembly: "js",
                type: "js.Array",
                member: "map",
              },
            },
            arguments: [{ kind: "identifier", name: "project" }],
            isOptional: false,
            inferredType: {
              kind: "arrayType",
              elementType: { kind: "primitiveType", name: "int" },
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module, {
      surface: "@tsonic/js",
      bindingRegistry: jsSurfaceBindingRegistry,
    });
    expect(result).to.include(
      "global::Tsonic.Internal.ArrayInterop.WrapArray(nums).map(project).toArray()"
    );
  });

  it("normalizes JS array wrapper call results back to native arrays for all array-like inferred return types", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "items",
                inferredType: {
                  kind: "arrayType",
                  elementType: { kind: "primitiveType", name: "string" },
                },
              },
              property: "filter",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "method",
                assembly: "js",
                type: "js.Array",
                member: "filter",
              },
            },
            arguments: [{ kind: "identifier", name: "predicate" }],
            isOptional: false,
            inferredType: {
              kind: "referenceType",
              name: "Array",
              typeArguments: [{ kind: "primitiveType", name: "string" }],
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module, {
      surface: "@tsonic/js",
      bindingRegistry: jsSurfaceBindingRegistry,
    });
    expect(result).to.include(
      "global::Tsonic.Internal.ArrayInterop.WrapArray(items).filter(predicate).toArray()"
    );
  });

  it("normalizes JS extension call results back to native arrays when the logical return type is array-like", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "path",
                inferredType: { kind: "primitiveType", name: "string" },
              },
              property: "split",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "method",
                assembly: "js",
                type: "js.String",
                member: "split",
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "receiver",
                },
              },
            },
            arguments: [{ kind: "literal", value: "/" }],
            isOptional: false,
            inferredType: {
              kind: "referenceType",
              name: "ReadonlyArray",
              typeArguments: [{ kind: "primitiveType", name: "string" }],
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include(
      'global::System.Linq.Enumerable.ToArray(global::js.String.split(path, "/"))'
    );
  });
});
