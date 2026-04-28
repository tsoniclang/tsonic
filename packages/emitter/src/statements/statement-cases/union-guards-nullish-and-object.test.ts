import { describe, it, expect, emitModule } from "./helpers.js";
import type { IrModule, IrType } from "./helpers.js";
describe("Statement Emission", () => {

  it("casts runtime unions to object for direct nullish comparisons", () => {
    const valueType: IrType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "string" },
        {
          kind: "functionType",
          parameters: [],
          returnType: { kind: "voidType" },
        },
        { kind: "primitiveType", name: "undefined" },
      ],
    };

    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "check",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "value" },
              type: valueType,
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "primitiveType", name: "boolean" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: {
                  kind: "binary",
                  operator: "==",
                  left: {
                    kind: "identifier",
                    name: "value",
                    inferredType: valueType,
                  },
                  right: { kind: "literal", value: undefined },
                  inferredType: { kind: "primitiveType", name: "boolean" },
                },
              },
            ],
          },
          isExported: false,
          isAsync: false,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("((global::System.Object)(value)) == null");
    expect(result).to.not.include("value == null");
  });
});
