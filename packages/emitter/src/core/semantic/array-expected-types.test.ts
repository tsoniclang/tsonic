import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "@tsonic/frontend";
import { createContext } from "../../emitter-types/context.js";
import type { EmitterContext } from "../../emitter-types/core.js";
import {
  normalizeRecursiveArrayExpectedType,
  resolveArrayLiteralContextType,
} from "./array-expected-types.js";

describe("array-expected-types", () => {
  const context = createContext({
    rootNamespace: "Test",
    surface: "@tsonic/js",
  });

  it("selects the sole array-like union member for array literal context", () => {
    const expectedType: IrType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "string" },
        {
          kind: "referenceType",
          name: "ReadonlyArray",
          typeArguments: [{ kind: "primitiveType", name: "number" }],
        },
      ],
    };

    expect(resolveArrayLiteralContextType(expectedType, context)).to.deep.equal(
      {
        kind: "referenceType",
        name: "ReadonlyArray",
        typeArguments: [{ kind: "primitiveType", name: "number" }],
      }
    );
  });

  it("erases recursive runtime-union array elements to object arrays", () => {
    const recursiveType: IrType = {
      kind: "referenceType",
      name: "PathSpec",
      resolvedClrType: "Test.PathSpec",
    };
    const contextWithAlias: EmitterContext = {
      ...context,
      localTypes: new Map([
        [
          "PathSpec",
          {
            kind: "typeAlias" as const,
            typeParameters: [],
            type: {
              kind: "unionType" as const,
              types: [
                { kind: "primitiveType", name: "string" },
                { kind: "referenceType", name: "RegExp" },
                {
                  kind: "arrayType",
                  elementType: recursiveType,
                  origin: "explicit" as const,
                },
              ],
            },
          },
        ],
      ]),
    };

    expect(
      normalizeRecursiveArrayExpectedType(
        {
          kind: "referenceType",
          name: "ReadonlyArray",
          typeArguments: [recursiveType],
        },
        contextWithAlias
      )
    ).to.deep.equal({
      kind: "arrayType",
      elementType: {
        kind: "referenceType",
        name: "object",
        resolvedClrType: "System.Object",
      },
      origin: "explicit",
    });
  });
});
