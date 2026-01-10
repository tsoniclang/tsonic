/**
 * Tests for extension method emission
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "./emitter.js";
import { IrModule } from "@tsonic/frontend";

describe("Extension Method Emission", () => {
  it("should emit `this` on receiver parameters", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/extensions.ts",
      namespace: "Test",
      className: "extensions",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "addOne",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "x" },
              type: { kind: "primitiveType", name: "int" },
              isOptional: false,
              isRest: false,
              passing: "value",
              isExtensionReceiver: true,
            },
          ],
          returnType: { kind: "primitiveType", name: "int" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: {
                  kind: "binary",
                  operator: "+",
                  left: { kind: "identifier", name: "x" },
                  right: { kind: "literal", value: 1 },
                },
              },
            ],
          },
          isExported: true,
          isAsync: false,
          isGenerator: false,
        },
      ],
    };

    const result = emitModule(module);
    expect(result).to.include("AddOne(this int x)");
  });

  it("should emit `this ref` for ref receivers", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/extensions.ts",
      namespace: "Test",
      className: "extensions",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "inc",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "x" },
              type: { kind: "primitiveType", name: "int" },
              isOptional: false,
              isRest: false,
              passing: "ref",
              isExtensionReceiver: true,
            },
          ],
          returnType: { kind: "voidType" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: {
                  kind: "assignment",
                  operator: "=",
                  left: { kind: "identifier", name: "x" },
                  right: {
                    kind: "binary",
                    operator: "+",
                    left: { kind: "identifier", name: "x" },
                    right: { kind: "literal", value: 1 },
                  },
                },
              },
            ],
          },
          isExported: true,
          isAsync: false,
          isGenerator: false,
        },
      ],
    };

    const result = emitModule(module);
    expect(result).to.include("Inc(this ref int x)");
  });
});
