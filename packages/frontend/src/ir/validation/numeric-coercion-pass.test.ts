import { describe, it } from "mocha";
import { expect } from "chai";
import { runNumericCoercionPass } from "./numeric-coercion-pass.js";

describe("numeric-coercion-pass", () => {
  it("validates call arguments inside return statements even when return type is unknown", () => {
    const module = {
      kind: "module",
      filePath: "/test.ts",
      namespace: "Test",
      className: "Test",
      isStaticContainer: false,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "f",
          parameters: [],
          returnType: undefined,
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: {
                  kind: "call",
                  callee: { kind: "identifier", name: "foo" },
                  arguments: [
                    {
                      kind: "literal",
                      value: 1.5,
                      raw: "1.5",
                      numericIntent: "Double",
                    },
                  ],
                  isOptional: false,
                  parameterTypes: [{ kind: "primitiveType", name: "int" }],
                },
              },
            ],
          },
          isAsync: false,
          isGenerator: false,
          isExported: false,
        },
      ],
    } as const;

    const result = runNumericCoercionPass([module]);
    expect(result.ok).to.equal(false);
    expect(result.diagnostics.map((d) => d.code)).to.include("TSN5110");
  });
});
