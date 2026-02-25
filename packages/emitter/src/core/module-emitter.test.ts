/**
 * Tests for Module Generation
 * Tests emission of static containers and regular classes
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitCSharpFiles, emitModule } from "../emitter.js";
import { IrModule } from "@tsonic/frontend";

describe("Module Generation", () => {
  it("should emit a static container class", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/math.ts",
      namespace: "MyApp",
      className: "Math",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "PI" },
              initializer: { kind: "literal", value: 3.14159 },
            },
          ],
          isExported: true,
        },
        {
          kind: "functionDeclaration",
          name: "add",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "a" },
              type: { kind: "primitiveType", name: "number" },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "b" },
              type: { kind: "primitiveType", name: "number" },
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
                  kind: "binary",
                  operator: "+",
                  left: { kind: "identifier", name: "a" },
                  right: { kind: "identifier", name: "b" },
                },
              },
            ],
          },
          isExported: true,
          isAsync: false,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include(
      "[global::Tsonic.Internal.ModuleContainerAttribute]"
    );
    expect(result).to.include("public static class Math");
    expect(result).to.include("public static readonly double PI;");
    expect(result).to.include("static Math()");
    expect(result).to.include("PI = 3.14159;");
    expect(result).to.include("public static double add(double a, double b)");
    expect(result).to.include("return a + b");
    expect(result).to.include("namespace MyApp");
  });

  it("should emit the module container marker attribute file when needed", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/math.ts",
      namespace: "MyApp",
      className: "Math",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "add",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "a" },
              type: { kind: "primitiveType", name: "number" },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "b" },
              type: { kind: "primitiveType", name: "number" },
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
                  kind: "binary",
                  operator: "+",
                  left: { kind: "identifier", name: "a" },
                  right: { kind: "identifier", name: "b" },
                },
              },
            ],
          },
          isExported: true,
          isAsync: false,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitCSharpFiles([module], { rootNamespace: "MyApp" });
    expect(result.ok).to.equal(true);
    if (!result.ok) return;

    const marker = result.files.get("__tsonic_module_containers.g.cs");
    expect(marker).to.not.equal(undefined);
    expect(marker).to.include("namespace Tsonic.Internal");
    expect(marker).to.include("ModuleContainerAttribute");
  });

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
});
