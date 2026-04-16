import { describe, it } from "mocha";
import { expect } from "chai";
import { normalizedUnionType, type IrType } from "@tsonic/frontend";
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

  it("preserves recursive union array storage with a deterministic re-entry cut", () => {
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
          handlerType,
          routerType,
        ],
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
                  handlerType,
                  routerType,
                ],
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
    ).to.deep.equal(
      normalizedUnionType([
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "null" },
        { kind: "primitiveType", name: "undefined" },
      ])
    );
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

    expect(normalizeRuntimeStorageType(type, genericContext)).to.deep.equal(
      normalizedUnionType([
        {
          kind: "referenceType",
          name: "object",
          resolvedClrType: "System.Object",
        },
        { kind: "primitiveType", name: "null" },
      ])
    );
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

  it("preserves in-scope nullable unconstrained type-parameter storage by default", () => {
    const genericContext: EmitterContext = {
      ...context,
      typeParameters: new Set(["T"]),
      typeParamConstraints: new Map([["T", "unconstrained"]]),
    };
    const type: IrType = {
      kind: "unionType",
      types: [
        { kind: "typeParameterType", name: "T" },
        { kind: "primitiveType", name: "null" },
      ],
    };

    expect(normalizeRuntimeStorageType(type, genericContext)).to.deep.equal(
      normalizedUnionType(type.types)
    );
  });

  it("erases in-scope nullable unconstrained type-parameter storage when requested", () => {
    const genericContext: EmitterContext = {
      ...context,
      typeParameters: new Set(["T"]),
      typeParamConstraints: new Map([["T", "unconstrained"]]),
      eraseNullableUnconstrainedTypeParameterStorage: true,
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

  it("preserves in-scope nullable constrained type-parameter storage even when requested", () => {
    const genericContext: EmitterContext = {
      ...context,
      typeParameters: new Set(["T"]),
      typeParamConstraints: new Map([["T", "class"]]),
      eraseNullableUnconstrainedTypeParameterStorage: true,
    };
    const type: IrType = {
      kind: "unionType",
      types: [
        { kind: "typeParameterType", name: "T" },
        { kind: "primitiveType", name: "null" },
      ],
    };

    expect(normalizeRuntimeStorageType(type, genericContext)).to.deep.equal(
      normalizedUnionType(type.types)
    );
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

  it("preserves structural alias identity in generic storage types", () => {
    const genericContext: EmitterContext = {
      ...context,
      typeParameters: new Set(["K", "V"]),
      localTypes: new Map([
        [
          "MapEntry",
          {
            kind: "typeAlias" as const,
            typeParameters: ["K", "V"],
            type: {
              kind: "objectType",
              members: [
                {
                  kind: "propertySignature",
                  name: "key",
                  type: { kind: "typeParameterType", name: "K" },
                  isOptional: false,
                  isReadonly: true,
                },
                {
                  kind: "propertySignature",
                  name: "value",
                  type: { kind: "typeParameterType", name: "V" },
                  isOptional: false,
                  isReadonly: false,
                },
              ],
            },
          },
        ],
      ]),
    };

    expect(
      normalizeRuntimeStorageType(
        {
          kind: "referenceType",
          name: "List_1",
          resolvedClrType: "System.Collections.Generic.List`1",
          typeArguments: [
            {
              kind: "referenceType",
              name: "MapEntry",
              typeArguments: [
                { kind: "typeParameterType", name: "K" },
                { kind: "typeParameterType", name: "V" },
              ],
            },
          ],
        },
        genericContext
      )
    ).to.deep.equal({
      kind: "referenceType",
      name: "List_1",
      resolvedClrType: "System.Collections.Generic.List`1",
      typeArguments: [
        {
          kind: "referenceType",
          name: "MapEntry",
          typeArguments: [
            { kind: "typeParameterType", name: "K" },
            { kind: "typeParameterType", name: "V" },
          ],
        },
      ],
    });
  });

  it("normalizes out-of-scope type arguments without erasing structural aliases", () => {
    const aliasContext: EmitterContext = {
      ...context,
      localTypes: new Map([
        [
          "MapEntry",
          {
            kind: "typeAlias" as const,
            typeParameters: ["K"],
            type: {
              kind: "objectType",
              members: [
                {
                  kind: "propertySignature",
                  name: "key",
                  type: { kind: "typeParameterType", name: "K" },
                  isOptional: false,
                  isReadonly: true,
                },
              ],
            },
          },
        ],
      ]),
    };

    expect(
      normalizeRuntimeStorageType(
        {
          kind: "referenceType",
          name: "List_1",
          resolvedClrType: "System.Collections.Generic.List`1",
          typeArguments: [
            {
              kind: "referenceType",
              name: "MapEntry",
              typeArguments: [{ kind: "typeParameterType", name: "T" }],
            },
          ],
        },
        aliasContext
      )
    ).to.deep.equal({
      kind: "referenceType",
      name: "List_1",
      resolvedClrType: "System.Collections.Generic.List`1",
      typeArguments: [
        {
          kind: "referenceType",
          name: "MapEntry",
          typeArguments: [
            {
              kind: "referenceType",
              name: "object",
              resolvedClrType: "System.Object",
            },
          ],
        },
      ],
    });
  });

  it("does not erase source class storage when an unrelated cross-module alias shares the same simple name", () => {
    const aliasContext: EmitterContext = {
      ...context,
      options: {
        ...context.options,
        typeAliasIndex: {
          byFqn: new Map([
            [
              "nodejs.child_process.Readable",
              {
                name: "Readable",
                fqn: "nodejs.child_process.Readable",
                type: { kind: "unknownType" },
                typeParameters: [],
              },
            ],
          ]),
        },
      },
    };

    expect(
      normalizeRuntimeStorageType(
        {
          kind: "unionType",
          types: [
            { kind: "primitiveType", name: "undefined" },
            {
              kind: "referenceType",
              name: "Readable",
              resolvedClrType: "nodejs.stream.Readable",
            },
          ],
        },
        aliasContext
      )
    ).to.deep.equal(
      normalizedUnionType([
        {
          kind: "referenceType",
          name: "Readable",
          resolvedClrType: "nodejs.stream.Readable",
        },
        { kind: "primitiveType", name: "undefined" },
      ])
    );
  });
});
