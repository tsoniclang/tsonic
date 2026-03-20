import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { normalizeRuntimeStorageType } from "./storage-types.js";

describe("storage-types", () => {
  const context: EmitterContext = {
    indentLevel: 0,
    options: {
      rootNamespace: "Test",
      indent: 4,
    },
    isStatic: false,
    isAsync: false,
    usings: new Set<string>(),
  };

  it("erases recursive union array storage to object[]", () => {
    const handlerType: IrType = {
      kind: "functionType",
      parameters: [],
      returnType: { kind: "voidType" },
    };

    const routerType: IrType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "Test.Router",
    };

    const middlewareLike = {
      kind: "unionType",
      types: [],
    } as unknown as Extract<IrType, { kind: "unionType" }> & {
      types: IrType[];
    };

    middlewareLike.types.push(handlerType, routerType, {
      kind: "arrayType",
      elementType: middlewareLike,
      origin: "explicit",
    });

    expect(
      normalizeRuntimeStorageType(
        {
          kind: "arrayType",
          elementType: middlewareLike,
          origin: "explicit",
        },
        context
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

  it("preserves nullish wrappers while normalizing recursive union array storage", () => {
    const handlerType: IrType = {
      kind: "functionType",
      parameters: [],
      returnType: { kind: "voidType" },
    };

    const routerType: IrType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "Test.Router",
    };

    const middlewareLike = {
      kind: "unionType",
      types: [],
    } as unknown as Extract<IrType, { kind: "unionType" }> & {
      types: IrType[];
    };

    middlewareLike.types.push(handlerType, routerType, {
      kind: "arrayType",
      elementType: middlewareLike,
      origin: "explicit",
    });

    expect(
      normalizeRuntimeStorageType(
        {
          kind: "unionType",
          types: [
            {
              kind: "arrayType",
              elementType: middlewareLike,
              origin: "explicit",
            },
            { kind: "primitiveType", name: "undefined" },
          ],
        },
        context
      )
    ).to.deep.equal({
      kind: "unionType",
      types: [
        {
          kind: "arrayType",
          elementType: {
            kind: "referenceType",
            name: "object",
            resolvedClrType: "System.Object",
          },
          origin: "explicit",
        },
        { kind: "primitiveType", name: "undefined" },
      ],
    });
  });

  it("collapses literal-plus-primitive string unions to string storage", () => {
    expect(
      normalizeRuntimeStorageType(
        {
          kind: "unionType",
          types: [
            { kind: "literalType", value: "route" },
            { kind: "literalType", value: "router" },
            { kind: "primitiveType", name: "string" },
            { kind: "primitiveType", name: "null" },
            { kind: "primitiveType", name: "undefined" },
          ],
        },
        context
      )
    ).to.deep.equal({
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "null" },
        { kind: "primitiveType", name: "undefined" },
      ],
    });
  });

  it("leaves non-union array storage unchanged", () => {
    const type: IrType = {
      kind: "arrayType",
      elementType: { kind: "primitiveType", name: "int" },
      origin: "explicit",
    };

    expect(normalizeRuntimeStorageType(type, context)).to.deep.equal(type);
  });

  for (const [label, type] of [
    ["unknown", { kind: "unknownType" }],
    ["any", { kind: "anyType" }],
    ["object-shape", { kind: "objectType", members: [] }],
    [
      "object-reference",
      {
        kind: "referenceType",
        name: "object",
        resolvedClrType: "System.Object",
      },
    ],
  ] as const satisfies readonly [string, IrType][]) {
    it(`normalizes ${label} storage to object`, () => {
      expect(normalizeRuntimeStorageType(type, context)).to.deep.equal({
        kind: "referenceType",
        name: "object",
        resolvedClrType: "System.Object",
      });
    });
  }

  it("erases nullable unconstrained type-parameter storage to object?", () => {
    const genericContext: EmitterContext = {
      ...context,
      typeParamConstraints: new Map([["T", "unconstrained"]]),
    };
    const type: IrType = {
      kind: "unionType",
      types: [
        { kind: "typeParameterType", name: "T" },
        { kind: "primitiveType", name: "null" },
      ],
    };

    expect(normalizeRuntimeStorageType(type, genericContext)).to.deep.equal({
      kind: "unionType",
      types: [
        {
          kind: "referenceType",
          name: "object",
          resolvedClrType: "System.Object",
        },
        { kind: "primitiveType", name: "null" },
      ],
    });
  });

  it("erases bare out-of-scope type-parameter storage to object", () => {
    expect(
      normalizeRuntimeStorageType(
        { kind: "typeParameterType", name: "T" },
        context
      )
    ).to.deep.equal({
      kind: "referenceType",
      name: "object",
      resolvedClrType: "System.Object",
    });
  });

  it("preserves in-scope bare type-parameter storage", () => {
    const genericContext: EmitterContext = {
      ...context,
      typeParameters: new Set(["T"]),
      typeParamConstraints: new Map([["T", "unconstrained"]]),
    };

    expect(
      normalizeRuntimeStorageType(
        { kind: "typeParameterType", name: "T" },
        genericContext
      )
    ).to.deep.equal({
      kind: "typeParameterType",
      name: "T",
    });
  });

  it("erases out-of-scope type parameters nested in reference types", () => {
    expect(
      normalizeRuntimeStorageType(
        {
          kind: "referenceType",
          name: "List",
          resolvedClrType: "System.Collections.Generic.List",
          typeArguments: [{ kind: "typeParameterType", name: "T" }],
        },
        context
      )
    ).to.deep.equal({
      kind: "referenceType",
      name: "List",
      resolvedClrType: "System.Collections.Generic.List",
      typeArguments: [
        {
          kind: "referenceType",
          name: "object",
          resolvedClrType: "System.Object",
        },
      ],
    });
  });
});
