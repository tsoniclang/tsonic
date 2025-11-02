/**
 * Tests for array emission
 * Verifies Tsonic.Runtime.Array<T> usage and JavaScript semantics
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

    // Should use Tsonic.Runtime.Array
    expect(code).to.include("new Tsonic.Runtime.Array<double>(1.0, 2.0, 3.0)");
    expect(code).to.include("using Tsonic.Runtime");
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

    // Should handle sparse array with default
    expect(code).to.include(
      "new Tsonic.Runtime.Array<double>(1.0, default, 3.0)"
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
    expect(code).to.include("new Tsonic.Runtime.Array<string>");
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
    expect(code).to.include("new Tsonic.Runtime.Array<double>()");
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

    // Should call push method on array instance
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
                object: { kind: "identifier", name: "arr" },
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

    // Should use indexer syntax (integer literals without .0)
    expect(code).to.include("arr[0]");
  });
});
