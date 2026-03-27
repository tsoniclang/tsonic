import {
  describe,
  it,
  expect,
  normalizeStructuralEmissionType,
  resolveStructuralReferenceType,
  type EmitterContext,
  type EmitterOptions,
  type FrontendTypeBinding,
  type IrType,
  type LocalTypeInfo,
} from "./helpers.js";

describe("type-resolution", () => {
  describe("resolveStructuralReferenceType", () => {
    const makeContext = (
      localTypes?: ReadonlyMap<string, LocalTypeInfo>,
      options?: Partial<EmitterOptions>
    ): EmitterContext => ({
      indentLevel: 0,
      options: {
        rootNamespace: "App",
        indent: 2,
        ...options,
      },
      isStatic: false,
      isAsync: false,
      localTypes,
      usings: new Set<string>(),
    });

    it("rebinds local structural aliases for emitter nominal contexts", () => {
      const localTypes = new Map<string, LocalTypeInfo>([
        [
          "Todo",
          {
            kind: "typeAlias",
            typeParameters: [],
            type: {
              kind: "objectType",
              members: [
                {
                  kind: "propertySignature",
                  name: "id",
                  type: { kind: "primitiveType", name: "number" },
                  isOptional: false,
                  isReadonly: false,
                },
                {
                  kind: "propertySignature",
                  name: "title",
                  type: { kind: "primitiveType", name: "string" },
                  isOptional: false,
                  isReadonly: false,
                },
              ],
            },
          },
        ],
      ]);

      const result = resolveStructuralReferenceType(
        {
          kind: "objectType",
          members: [
            {
              kind: "propertySignature",
              name: "id",
              type: { kind: "primitiveType", name: "number" },
              isOptional: false,
              isReadonly: false,
            },
            {
              kind: "propertySignature",
              name: "title",
              type: { kind: "primitiveType", name: "string" },
              isOptional: false,
              isReadonly: false,
            },
          ],
        },
        makeContext(localTypes)
      );

      expect(result).to.deep.equal({
        kind: "referenceType",
        name: "Todo",
      });
    });

    it("normalizes structural aliases nested inside array emission types", () => {
      const localTypes = new Map<string, LocalTypeInfo>([
        [
          "TopRow",
          {
            kind: "typeAlias",
            typeParameters: [],
            type: {
              kind: "objectType",
              members: [
                {
                  kind: "propertySignature",
                  name: "key",
                  type: { kind: "primitiveType", name: "string" },
                  isOptional: false,
                  isReadonly: false,
                },
                {
                  kind: "propertySignature",
                  name: "pageviews",
                  type: { kind: "primitiveType", name: "number" },
                  isOptional: false,
                  isReadonly: false,
                },
              ],
            },
          },
        ],
      ]);

      const result = normalizeStructuralEmissionType(
        {
          kind: "arrayType",
          elementType: {
            kind: "objectType",
            members: [
              {
                kind: "propertySignature",
                name: "key",
                type: { kind: "primitiveType", name: "string" },
                isOptional: false,
                isReadonly: false,
              },
              {
                kind: "propertySignature",
                name: "pageviews",
                type: { kind: "primitiveType", name: "number" },
                isOptional: false,
                isReadonly: false,
              },
            ],
          },
        },
        makeContext(localTypes)
      );

      expect(result).to.deep.equal({
        kind: "arrayType",
        elementType: {
          kind: "referenceType",
          name: "TopRow",
        },
      });
    });

    it("preserves generic local structural alias identity and type arguments", () => {
      const localTypes = new Map<string, LocalTypeInfo>([
        [
          "Ok",
          {
            kind: "typeAlias",
            typeParameters: ["T"],
            type: {
              kind: "objectType",
              members: [
                {
                  kind: "propertySignature",
                  name: "ok",
                  type: { kind: "literalType", value: true },
                  isOptional: false,
                  isReadonly: false,
                },
                {
                  kind: "propertySignature",
                  name: "value",
                  type: { kind: "typeParameterType", name: "T" },
                  isOptional: false,
                  isReadonly: false,
                },
              ],
            },
          },
        ],
      ]);

      const result = resolveStructuralReferenceType(
        {
          kind: "referenceType",
          name: "Ok",
          typeArguments: [{ kind: "primitiveType", name: "string" }],
        },
        makeContext(localTypes)
      );

      expect(result).to.deep.equal({
        kind: "referenceType",
        name: "Ok",
        typeArguments: [{ kind: "primitiveType", name: "string" }],
      });
    });

    it("preserves generic type arguments when rebinding compiler-generated structural references", () => {
      const localTypes = new Map<string, LocalTypeInfo>([
        [
          "__Anon_wrap",
          {
            kind: "class",
            typeParameters: ["T"],
            members: [
              {
                kind: "propertyDeclaration",
                name: "value",
                type: { kind: "typeParameterType", name: "T" },
                accessibility: "public",
                isStatic: false,
                isReadonly: false,
              },
            ],
            implements: [],
          },
        ],
      ]);

      const result = resolveStructuralReferenceType(
        {
          kind: "referenceType",
          name: "__Anon_wrap",
          typeArguments: [{ kind: "primitiveType", name: "int" }],
        },
        makeContext(localTypes)
      );

      expect(result).to.deep.equal({
        kind: "referenceType",
        name: "__Anon_wrap",
        typeArguments: [{ kind: "primitiveType", name: "int" }],
      });
    });

    it("prefers direct local structural identities over binding-backed name collisions", () => {
      const localTypes = new Map<string, LocalTypeInfo>([
        [
          "Container",
          {
            kind: "interface",
            typeParameters: ["T"],
            members: [
              {
                kind: "propertySignature",
                name: "value",
                type: { kind: "typeParameterType", name: "T" },
                isOptional: false,
                isReadonly: false,
              },
            ],
            extends: [],
          },
        ],
      ]);

      const bindingsRegistry = new Map<string, FrontendTypeBinding>([
        [
          "Container",
          {
            name: "System.ComponentModel.Container",
            alias: "Container",
            kind: "class",
            members: [],
          },
        ],
      ]);

      const result = resolveStructuralReferenceType(
        {
          kind: "referenceType",
          name: "Container",
          typeArguments: [{ kind: "primitiveType", name: "string" }],
        },
        {
          ...makeContext(localTypes),
          bindingsRegistry,
        }
      );

      expect(result).to.deep.equal({
        kind: "referenceType",
        name: "Container",
        typeArguments: [{ kind: "primitiveType", name: "string" }],
      });
    });

    it("rebinds cross-module structural aliases to canonical emitted CLR types", () => {
      const currentModulePath = "/src/app.ts";
      const typeAliasInfo: LocalTypeInfo = {
        kind: "typeAlias",
        typeParameters: [],
        type: {
          kind: "objectType",
          members: [
            {
              kind: "propertySignature",
              name: "path",
              type: { kind: "primitiveType", name: "string" },
              isOptional: false,
              isReadonly: false,
            },
          ],
        },
      };

      const result = resolveStructuralReferenceType(
        {
          kind: "objectType",
          members: [
            {
              kind: "propertySignature",
              name: "path",
              type: { kind: "primitiveType", name: "string" },
              isOptional: false,
              isReadonly: false,
            },
          ],
        },
        makeContext(undefined, {
          moduleMap: new Map([
            [
              currentModulePath,
              {
                namespace: "App",
                className: "App",
                filePath: currentModulePath,
                hasRuntimeContainer: true,
                hasTypeCollision: false,
                localTypes: new Map(),
              },
            ],
            [
              "/src/router.ts",
              {
                namespace: "App.Http",
                className: "Router",
                filePath: "/src/router.ts",
                hasRuntimeContainer: true,
                hasTypeCollision: false,
                localTypes: new Map([["RouteLayer", typeAliasInfo]]),
              },
            ],
          ]),
        })
      );

      expect(result).to.deep.equal({
        kind: "referenceType",
        name: "RouteLayer",
        resolvedClrType: "App.Http.RouteLayer__Alias",
      });
    });

    it("preserves generic imported structural alias identity and type arguments", () => {
      const result = resolveStructuralReferenceType(
        {
          kind: "referenceType",
          name: "Ok",
          typeArguments: [{ kind: "primitiveType", name: "string" }],
          resolvedClrType: "App.Core.Ok__Alias",
        },
        makeContext(undefined, {
          moduleMap: new Map([
            [
              "/src/app.ts",
              {
                namespace: "App",
                className: "App",
                filePath: "/src/app.ts",
                hasRuntimeContainer: true,
                hasTypeCollision: false,
                localTypes: new Map(),
              },
            ],
            [
              "/src/result.ts",
              {
                namespace: "App.Core",
                className: "result",
                filePath: "/src/result.ts",
                hasRuntimeContainer: true,
                hasTypeCollision: false,
                localTypes: new Map([
                  [
                    "Ok",
                    {
                      kind: "typeAlias",
                      typeParameters: ["T"],
                      type: {
                        kind: "objectType",
                        members: [
                          {
                            kind: "propertySignature",
                            name: "ok",
                            type: { kind: "literalType", value: true },
                            isOptional: false,
                            isReadonly: false,
                          },
                          {
                            kind: "propertySignature",
                            name: "value",
                            type: { kind: "typeParameterType", name: "T" },
                            isOptional: false,
                            isReadonly: false,
                          },
                        ],
                      },
                    },
                  ],
                ]),
              },
            ],
          ]),
        })
      );

      expect(result).to.deep.equal({
        kind: "referenceType",
        name: "Ok",
        typeArguments: [{ kind: "primitiveType", name: "string" }],
        resolvedClrType: "App.Core.Ok__Alias",
      });
    });

    it("refuses ambiguous structural matches", () => {
      const sharedShape: Extract<IrType, { kind: "objectType" }> = {
        kind: "objectType",
        members: [
          {
            kind: "propertySignature",
            name: "id",
            type: { kind: "primitiveType", name: "string" },
            isOptional: false,
            isReadonly: false,
          },
        ],
      };

      const localTypes = new Map<string, LocalTypeInfo>([
        [
          "Foo",
          {
            kind: "typeAlias",
            typeParameters: [],
            type: sharedShape,
          },
        ],
        [
          "Bar",
          {
            kind: "typeAlias",
            typeParameters: [],
            type: sharedShape,
          },
        ],
      ]);

      expect(
        resolveStructuralReferenceType(sharedShape, makeContext(localTypes))
      ).to.equal(undefined);
    });
  });
});
