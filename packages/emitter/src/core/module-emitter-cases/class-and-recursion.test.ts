/**
 * Tests for Module Generation
 * Tests emission of static containers and regular classes
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitCSharpFiles, emitModule } from "../../emitter.js";
import { assumeEmittableIrModule, IrModule, IrType } from "@tsonic/frontend";

describe("Module Generation", () => {
  it("should emit a regular class", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/User.ts",
      namespace: "MyApp",
      className: "User",
      isStaticContainer: false,
      imports: [],
      body: [
        {
          kind: "classDeclaration",
          name: "User",
          members: [
            {
              kind: "propertyDeclaration",
              name: "name",
              type: { kind: "primitiveType", name: "string" },
              accessibility: "public",
              isStatic: false,
              isReadonly: false,
            },
            {
              kind: "methodDeclaration",
              name: "greet",
              parameters: [],
              returnType: { kind: "primitiveType", name: "string" },
              body: {
                kind: "blockStatement",
                statements: [
                  {
                    kind: "returnStatement",
                    expression: {
                      kind: "templateLiteral",
                      quasis: ["Hello, I'm ", ""],
                      expressions: [
                        {
                          kind: "memberAccess",
                          object: { kind: "this" },
                          property: "name",
                          isComputed: false,
                          isOptional: false,
                        },
                      ],
                    },
                  },
                ],
              },
              accessibility: "public",
              isStatic: false,
              isAsync: false,
              isGenerator: false,
            },
          ],
          isStruct: false,
          isExported: true,
          implements: [],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("public class User");
    expect(result).to.include("public string name { get; set; }");
    expect(result).to.include("public string greet()");
    expect(result).to.include('$"Hello, I\'m {this.name}"');
  });

  it("hoists instance-bound property initializers into constructors", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/Application.ts",
      namespace: "MyApp",
      className: "Application",
      isStaticContainer: false,
      imports: [],
      body: [
        {
          kind: "classDeclaration",
          name: "Application",
          members: [
            {
              kind: "propertyDeclaration",
              name: "router",
              type: {
                kind: "referenceType",
                name: "Application",
              },
              initializer: { kind: "this" },
              accessibility: "public",
              isStatic: false,
              isReadonly: true,
            },
          ],
          isStruct: false,
          isExported: true,
          implements: [],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("public Application router { get; init; }");
    expect(result).to.include("public Application()");
    expect(result).to.include("this.router = this;");
    expect(result).to.not.include("router { get; init; } = this;");
  });

  it("should bind CLR flattened value imports to declaring type members", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/index.ts",
      namespace: "MyApp",
      className: "index",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "@fixture/lib/Lib.js",
          isLocal: false,
          isClr: true,
          resolvedNamespace: "Lib",
          specifiers: [
            {
              kind: "named",
              name: "buildSite",
              localName: "buildSite",
              isType: false,
              resolvedClrValue: {
                declaringClrType: "Lib.BuildSite",
                declaringAssemblyName: "Lib",
                memberName: "buildSite",
              },
            },
          ],
        },
      ],
      body: [
        {
          kind: "functionDeclaration",
          name: "main",
          parameters: [],
          returnType: { kind: "primitiveType", name: "number" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: {
                  kind: "call",
                  callee: { kind: "identifier", name: "buildSite" },
                  arguments: [{ kind: "literal", value: 1 }],
                  isOptional: false,
                  typeArguments: [],
                  inferredType: { kind: "primitiveType", name: "number" },
                },
              },
            ],
          },
          isExported: true,
          isAsync: false,
          isGenerator: false,
        },
      ],
      exports: [
        {
          kind: "named",
          name: "main",
          localName: "main",
        },
      ],
    };

    const result = emitModule(module);
    expect(result).to.include("global::Lib.BuildSite.buildSite(1)");
    expect(result).to.not.include("global::Lib.buildSite");
  });

  it("emits recursive structural declaration graphs without circular signature crashes", () => {
    const routerType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "global::System.Object",
      structuralMembers: [],
    } as unknown as Extract<IrType, { kind: "referenceType" }> & {
      structuralMembers: unknown[];
    };

    const middlewareLike = {
      kind: "unionType",
      types: [],
    } as unknown as Extract<IrType, { kind: "unionType" }> & {
      types: IrType[];
    };

    middlewareLike.types.push(routerType, {
      kind: "arrayType",
      elementType: middlewareLike,
    });

    routerType.structuralMembers = [
      {
        kind: "methodSignature",
        name: "use",
        parameters: [
          {
            kind: "parameter",
            pattern: { kind: "identifierPattern", name: "handlers" },
            type: middlewareLike,
            initializer: undefined,
            isOptional: false,
            isRest: true,
            passing: "value",
          },
        ],
        returnType: routerType,
      },
    ];

    const module: IrModule = {
      kind: "module",
      filePath: "/src/router.ts",
      namespace: "MyApp",
      className: "RouterModule",
      isStaticContainer: false,
      imports: [],
      body: [
        {
          kind: "classDeclaration",
          name: "RouterState",
          typeParameters: undefined,
          superClass: undefined,
          implements: [],
          members: [
            {
              kind: "propertyDeclaration",
              name: "owner",
              type: routerType as never,
              initializer: undefined,
              emitAsAutoProperty: true,
              isStatic: false,
              isReadonly: false,
              accessibility: "public",
              isRequired: true,
            },
            {
              kind: "propertyDeclaration",
              name: "handlers",
              type: middlewareLike as never,
              initializer: undefined,
              emitAsAutoProperty: true,
              isStatic: false,
              isReadonly: false,
              accessibility: "public",
              isRequired: true,
            },
          ],
          isExported: true,
          isStruct: false,
        },
      ],
      exports: [],
    };

    const result = emitCSharpFiles([assumeEmittableIrModule(module)], {
      rootNamespace: "MyApp",
    });
    expect(result.ok).to.equal(true);
  });
});
