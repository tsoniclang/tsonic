import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../emitter.js";
import { IrModule, type IrType } from "@tsonic/frontend";
import { arrayType, createModule, numberType, stringType } from "./helpers.js";

describe("Destructuring Pattern Lowering", () => {
  describe("For-of Loop Destructuring", () => {
    it("should lower array destructuring in for-of loop", () => {
      const module = createModule([
        {
          kind: "forOfStatement",
          variable: {
            kind: "arrayPattern",
            elements: [
              {
                pattern: { kind: "identifierPattern", name: "key" },
                isRest: false,
              },
              {
                pattern: { kind: "identifierPattern", name: "value" },
                isRest: false,
              },
            ],
          },
          expression: {
            kind: "identifier",
            name: "entries",
            inferredType: arrayType(arrayType(stringType)),
          },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: {
                  kind: "call",
                  callee: {
                    kind: "memberAccess",
                    object: { kind: "identifier", name: "console" },
                    property: "log",
                    isComputed: false,
                    isOptional: false,
                  },
                  arguments: [
                    { kind: "identifier", name: "key" },
                    { kind: "identifier", name: "value" },
                  ],
                  isOptional: false,
                },
              },
            ],
          },
          isAwait: false,
        },
      ]);

      const result = emitModule(module);

      const loopTempMatch = result.match(
        /foreach \(var (__item(?:__\d+)?) in entries\)/
      );
      expect(loopTempMatch?.[1]).to.not.equal(undefined);
      const loopTemp = loopTempMatch?.[1] ?? "__item";

      // Should destructure inside the loop (with types from element type)
      expect(result).to.include(`var __arr0 = ${loopTemp};`);
      expect(result).to.include("string key = __arr0[0];");
      expect(result).to.include("string value = __arr0[1];");
    });

    it("should use simple variable for identifier pattern", () => {
      const module = createModule([
        {
          kind: "forOfStatement",
          variable: { kind: "identifierPattern", name: "item" },
          expression: { kind: "identifier", name: "items" },
          body: {
            kind: "blockStatement",
            statements: [],
          },
          isAwait: false,
        },
      ]);

      const result = emitModule(module);

      // Should use simple foreach without lowering
      expect(result).to.include("foreach (var item in items)");
      // Should NOT create temp variable
      expect(result).to.not.include("__item");
    });

    it("should use tuple element typing when destructuring Map iteration", () => {
      const module = createModule([
        {
          kind: "forOfStatement",
          variable: {
            kind: "arrayPattern",
            elements: [
              {
                pattern: { kind: "identifierPattern", name: "key" },
                isRest: false,
              },
              {
                pattern: { kind: "identifierPattern", name: "value" },
                isRest: false,
              },
            ],
          },
          expression: {
            kind: "identifier",
            name: "entries",
            inferredType: {
              kind: "referenceType",
              name: "Map",
              typeArguments: [stringType, numberType],
            },
          },
          body: {
            kind: "blockStatement",
            statements: [],
          },
          isAwait: false,
        },
      ]);

      const result = emitModule(module);

      expect(result).to.match(/foreach \(var __item(?:__\d+)? in entries\)/);
      expect(result).to.include("Item1");
      expect(result).to.include("Item2");
      expect(result).to.not.include("[0]");
      expect(result).to.not.include("[1]");
    });
  });

  describe("Parameter Destructuring", () => {
    it("should lower array destructuring in function parameters", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "TestApp",
        className: "test",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "functionDeclaration",
            name: "swap",
            parameters: [
              {
                kind: "parameter",
                pattern: {
                  kind: "arrayPattern",
                  elements: [
                    {
                      pattern: { kind: "identifierPattern", name: "a" },
                      isRest: false,
                    },
                    {
                      pattern: { kind: "identifierPattern", name: "b" },
                      isRest: false,
                    },
                  ],
                },
                type: arrayType(numberType),
                isOptional: false,
                isRest: false,
                passing: "value",
              },
            ],
            returnType: arrayType(numberType),
            body: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "returnStatement",
                  expression: {
                    kind: "array",
                    elements: [
                      { kind: "identifier", name: "b" },
                      { kind: "identifier", name: "a" },
                    ],
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

      // Should use synthetic parameter name
      expect(result).to.include("__param0");
      // Should destructure at start of body (with element type)
      expect(result).to.include("double a = __arr0[0];");
      expect(result).to.include("double b = __arr0[1];");
    });

    it("should handle object destructuring in function parameters", () => {
      const personType: IrType = {
        kind: "referenceType",
        name: "Person",
      };

      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "TestApp",
        className: "test",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "classDeclaration",
            name: "Person",
            members: [
              {
                kind: "propertyDeclaration",
                name: "name",
                type: stringType,
                accessibility: "public",
                isStatic: false,
                isReadonly: false,
              },
              {
                kind: "propertyDeclaration",
                name: "age",
                type: numberType,
                accessibility: "public",
                isStatic: false,
                isReadonly: false,
              },
            ],
            isStruct: false,
            isExported: false,
            implements: [],
          },
          {
            kind: "functionDeclaration",
            name: "greet",
            parameters: [
              {
                kind: "parameter",
                pattern: {
                  kind: "objectPattern",
                  properties: [
                    {
                      kind: "property",
                      key: "name",
                      value: { kind: "identifierPattern", name: "name" },
                      shorthand: true,
                    },
                  ],
                },
                type: personType,
                isOptional: false,
                isRest: false,
                passing: "value",
              },
            ],
            returnType: stringType,
            body: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "returnStatement",
                  expression: { kind: "identifier", name: "name" },
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

      // Should use synthetic parameter name
      expect(result).to.include("__param0");
      // Should destructure with type
      expect(result).to.include("string name = __obj0.name;");
    });
  });
});
