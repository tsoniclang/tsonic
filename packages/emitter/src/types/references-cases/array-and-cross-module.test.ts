import {
  describe,
  emitCSharpFiles,
  emitModule,
  expect,
  it,
} from "./helpers.js";
import type { IrModule } from "./helpers.js";
describe("Reference Type Emission", () => {
  describe("Array Indexing", () => {
    it("should use native indexer for array indexing", () => {
      // This test creates a module with array index access
      // Should use native indexer, not js.Array.get()
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

      // Output should NOT contain js
      expect(result).to.not.include("js");
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
