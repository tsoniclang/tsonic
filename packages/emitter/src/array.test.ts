/**
 * Tests for array emission
 * Verifies Tsonic.JSRuntime extension methods usage and JavaScript semantics
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

    // TypeScript number type maps to C# double
    // Uses global:: FQN for unambiguous resolution
    expect(code).to.include(
      "new global::System.Collections.Generic.List<double> { 1.0, 2.0, 3.0 }"
    );
    // No using statements - all types use global:: FQN
    expect(code).not.to.include("using System.Collections.Generic");
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

    // Should handle sparse array with default - TypeScript number maps to double
    expect(code).to.include(
      "new global::System.Collections.Generic.List<double> { 1.0, default, 3.0 }"
    );
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

    // Should use string type parameter
    expect(code).to.include(
      "new global::System.Collections.Generic.List<string>"
    );
    expect(code).to.include('"hello", "world"');
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

    // Should create empty array
    expect(code).to.include(
      "new global::System.Collections.Generic.List<double>()"
    );
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
              object: { kind: "identifier", name: "arr" },
              property: "push",
              isComputed: false,
              isOptional: false,
            },
            arguments: [{ kind: "literal", value: 3 }],
            isOptional: false,
          },
        },
      ],
    };

    const code = emitModule(module);

    // Should call push method on array instance - TypeScript number emits as double
    expect(code).to.include("arr.push(3.0)");
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
                property: { kind: "literal", value: 0 },
                isComputed: true,
                isOptional: false,
              },
            },
          ],
        },
      ],
    };

    const code = emitModule(module);

    // Should use static helper for array access with global:: prefix
    expect(code).to.include("global::Tsonic.JSRuntime.Array.get(arr, 0)");
  });
});
