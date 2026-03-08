/**
 * Tests for array emission
 * Verifies native CLR array emission
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "./emitter.js";
import { IrModule } from "@tsonic/frontend";

describe("Array Emission", () => {
  it("should emit basic array literal with correct type", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/arrays.ts",
      namespace: "Test",
      className: "arrays",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "numbers" },
              type: {
                kind: "referenceType",
                name: "Array",
                typeArguments: [{ kind: "primitiveType", name: "number" }],
              },
              initializer: {
                kind: "array",
                elements: [
                  { kind: "literal", value: 1 },
                  { kind: "literal", value: 2 },
                  { kind: "literal", value: 3 },
                ],
              },
            },
          ],
        },
      ],
    };

    const code = emitModule(module);

    // Native array syntax with explicit type - number maps to double
    expect(code).to.include("new double[] { 1, 2, 3 }");
  });

  it("should emit sparse array with holes", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/sparse.ts",
      namespace: "Test",
      className: "sparse",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "sparse" },
              type: {
                kind: "referenceType",
                name: "Array",
                typeArguments: [{ kind: "primitiveType", name: "number" }],
              },
              initializer: {
                kind: "array",
                elements: [
                  { kind: "literal", value: 1 },
                  undefined, // hole
                  { kind: "literal", value: 3 },
                ],
              },
            },
          ],
        },
      ],
    };

    const code = emitModule(module);

    // Native array syntax with explicit type and default for holes
    expect(code).to.include("new double[] { 1, default, 3 }");
  });

  it("should emit array with string elements", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/strings.ts",
      namespace: "Test",
      className: "strings",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "words" },
              type: {
                kind: "referenceType",
                name: "Array",
                typeArguments: [{ kind: "primitiveType", name: "string" }],
              },
              initializer: {
                kind: "array",
                elements: [
                  { kind: "literal", value: "hello" },
                  { kind: "literal", value: "world" },
                ],
              },
            },
          ],
        },
      ],
    };

    const code = emitModule(module);

    // Native array with explicit string type
    expect(code).to.include('new string[] { "hello", "world" }');
  });

  it("should emit empty array", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/empty.ts",
      namespace: "Test",
      className: "empty",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "empty" },
              type: {
                kind: "referenceType",
                name: "Array",
                typeArguments: [{ kind: "primitiveType", name: "number" }],
              },
              initializer: {
                kind: "array",
                elements: [],
              },
            },
          ],
        },
      ],
    };

    const code = emitModule(module);

    // Empty array uses Array.Empty<T>()
    expect(code).to.include("global::System.Array.Empty<double>()");
  });

  it("should emit array method calls correctly", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/methods.ts",
      namespace: "Test",
      className: "methods",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "arr" },
              initializer: {
                kind: "array",
                elements: [
                  { kind: "literal", value: 1 },
                  { kind: "literal", value: 2 },
                ],
              },
            },
          ],
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "arr",
                inferredType: {
                  kind: "arrayType",
                  elementType: { kind: "primitiveType", name: "int" },
                },
              },
              property: "push",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "method",
                assembly: "Tsonic.JSRuntime",
                type: "Tsonic.JSRuntime.JSArray`1",
                member: "push",
                isExtensionMethod: false,
              },
            },
            arguments: [{ kind: "literal", value: 3 }],
            isOptional: false,
            inferredType: { kind: "primitiveType", name: "int" },
          },
        },
      ],
    };

    const code = emitModule(module);

    expect(code).to.include("arr = __tsonic_arrayWrapper.toArray()");
    expect(code).not.to.include("arr.push(3)");
  });

  it("should capture member-access array receivers before mutating them", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/member-mutation.ts",
      namespace: "Test",
      className: "memberMutation",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: {
                kind: "memberAccess",
                object: { kind: "identifier", name: "box" },
                property: "items",
                isComputed: false,
                isOptional: false,
                inferredType: {
                  kind: "arrayType",
                  elementType: { kind: "primitiveType", name: "string" },
                },
              },
              property: "push",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "method",
                assembly: "Tsonic.JSRuntime",
                type: "Tsonic.JSRuntime.JSArray`1",
                member: "push",
                isExtensionMethod: false,
              },
            },
            arguments: [{ kind: "literal", value: "value" }],
            isOptional: false,
            inferredType: { kind: "primitiveType", name: "int" },
          },
        },
      ],
    };

    const code = emitModule(module);

    expect(code).to.include("var __tsonic_arrayTarget = box;");
    expect(code).to.include(
      "__tsonic_arrayTarget.items = __tsonic_arrayWrapper.toArray()"
    );
  });

  it("should handle array element access", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/access.ts",
      namespace: "Test",
      className: "access",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "arr" },
              initializer: {
                kind: "array",
                elements: [{ kind: "literal", value: 10 }],
              },
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
              name: { kind: "identifierPattern", name: "first" },
              initializer: {
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
                  // Int32 proof marker (set by numeric proof pass)
                  inferredType: { kind: "primitiveType", name: "int" },
                },
                isComputed: true,
                isOptional: false,
                accessKind: "clrIndexer",
              },
            },
          ],
        },
      ],
    };

    const code = emitModule(module);

    // Should use native indexer for array access
    expect(code).to.include("arr[0]");
  });
});
