import { describe, it, expect, emitModule, type IrModule } from "./helpers.js";

describe("Expression Emission", () => {
  it("should emit fluent LINQ extension method calls (required for EF query precompilation)", () => {
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
                name: "q",
                inferredType: {
                  kind: "referenceType",
                  name: "QueryableRoot",
                  resolvedClrType: "global::MyApp.QueryableRoot",
                },
              },
              property: "Count",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "method",
                assembly: "System.Linq",
                type: "System.Linq.Queryable",
                member: "Count",
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "receiver",
                },
              },
            },
            arguments: [],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Fluent invocation + namespace using.
    expect(result).to.include("using System.Linq;");
    expect(result).to.include("q.Count()");

    // Must not emit nested/static Queryable.* calls (EF query precompiler flags them as "dynamic").
    expect(result).not.to.include("System.Linq.Queryable.Count");
  });

  it("should emit fluent Queryable extension methods broadly (Where/Select/FirstOrDefault/etc.)", () => {
    const methods: ReadonlyArray<{
      readonly member: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      readonly args: any[];
    }> = [
      { member: "Where", args: [{ kind: "identifier", name: "pred" }] },
      { member: "Select", args: [{ kind: "identifier", name: "sel" }] },
      { member: "FirstOrDefault", args: [] },
      { member: "Count", args: [] },
    ];

    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: methods.map((m) => ({
        kind: "expressionStatement",
        expression: {
          kind: "call",
          callee: {
            kind: "memberAccess",
            object: {
              kind: "identifier",
              name: "q",
              inferredType: {
                kind: "referenceType",
                name: "QueryableRoot",
                resolvedClrType: "global::MyApp.QueryableRoot",
              },
            },
            property: m.member,
            isComputed: false,
            isOptional: false,
            memberBinding: {
              kind: "method",
              assembly: "System.Linq",
              type: "System.Linq.Queryable",
              member: m.member,
              isExtensionMethod: true,
              emitSemantics: {
                callStyle: "receiver",
              },
            },
          },
          arguments: m.args,
          isOptional: false,
        },
      })),
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("using System.Linq;");
    for (const m of methods) {
      expect(result).to.include(`q.${m.member}(`);
      expect(result).not.to.include(`System.Linq.Queryable.${m.member}`);
    }
  });

  it("should emit fluent Enumerable terminal ops (ToList/ToArray) but keep other Enumerable methods static by default", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        // Enumerable terminal ops should be fluent + require using System.Linq;
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "xs",
                inferredType: {
                  kind: "referenceType",
                  name: "EnumerableRoot",
                  resolvedClrType: "global::MyApp.EnumerableRoot",
                },
              },
              property: "ToArray",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "method",
                assembly: "System.Linq",
                type: "System.Linq.Enumerable",
                member: "ToArray",
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "receiver",
                },
              },
            },
            arguments: [],
            isOptional: false,
          },
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "xs",
                inferredType: {
                  kind: "referenceType",
                  name: "EnumerableRoot",
                  resolvedClrType: "global::MyApp.EnumerableRoot",
                },
              },
              property: "ToList",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "method",
                assembly: "System.Linq",
                type: "System.Linq.Enumerable",
                member: "ToList",
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "receiver",
                },
              },
            },
            arguments: [],
            isOptional: false,
          },
        },
        // Enumerable query operators remain static invocation by default.
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "xs",
                inferredType: {
                  kind: "referenceType",
                  name: "EnumerableRoot",
                  resolvedClrType: "global::MyApp.EnumerableRoot",
                },
              },
              property: "Where",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "method",
                assembly: "System.Linq",
                type: "System.Linq.Enumerable",
                member: "Where",
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "static",
                },
              },
            },
            arguments: [{ kind: "identifier", name: "pred" }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("using System.Linq;");
    expect(result).to.include("xs.ToArray()");
    expect(result).to.include("xs.ToList()");
    expect(result).not.to.include("System.Linq.Enumerable.ToArray");
    expect(result).not.to.include("System.Linq.Enumerable.ToList");

    expect(result).to.include("global::System.Linq.Enumerable.Where(xs, pred)");
    expect(result).not.to.include("xs.Where");
  });

  it("should emit fluent EF Core query operators (e.g. AsNoTracking) with a namespace using", () => {
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
                name: "q",
                inferredType: {
                  kind: "referenceType",
                  name: "QueryableRoot",
                  resolvedClrType: "global::MyApp.QueryableRoot",
                },
              },
              property: "AsNoTracking",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "method",
                assembly: "Microsoft.EntityFrameworkCore",
                type: "Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions",
                member: "AsNoTracking",
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "receiver",
                },
              },
            },
            arguments: [],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("using Microsoft.EntityFrameworkCore;");
    expect(result).to.include("q.AsNoTracking()");
    expect(result).not.to.include(
      "EntityFrameworkQueryableExtensions.AsNoTracking"
    );
  });

  it("should canonicalize Enumerable.ToList().ToArray() to Enumerable.ToArray() for EF query precompilation", () => {
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
                kind: "call",
                callee: {
                  kind: "memberAccess",
                  object: {
                    kind: "identifier",
                    name: "xs",
                    inferredType: { kind: "primitiveType", name: "boolean" }, // doesn't matter; instance-style is enough
                  },
                  property: "ToList",
                  isComputed: false,
                  isOptional: false,
                  memberBinding: {
                    kind: "method",
                    assembly: "System.Linq",
                    type: "System.Linq.Enumerable",
                    member: "ToList",
                    isExtensionMethod: true,
                    emitSemantics: {
                      callStyle: "receiver",
                    },
                  },
                },
                arguments: [],
                isOptional: false,
              },
              property: "ToArray",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "method",
                assembly: "System.Linq",
                type: "System.Linq.Enumerable",
                member: "ToArray",
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "receiver",
                },
              },
            },
            arguments: [],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // The canonical form must be `xs.ToArray()` (not `xs.ToList().ToArray()`).
    expect(result).to.include("using System.Linq;");
    expect(result).to.include("xs.ToArray()");
    expect(result).not.to.include(".ToList().ToArray()");
  });
});
