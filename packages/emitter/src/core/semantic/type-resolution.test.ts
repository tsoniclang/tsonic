/**
 * Tests for type resolution helpers
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  IrType,
  IrInterfaceMember,
  type TypeBinding as FrontendTypeBinding,
} from "@tsonic/frontend";
import {
  containsTypeParameter,
  substituteTypeArgs,
  getPropertyType,
  getArrayLikeElementType,
  selectUnionMemberForObjectLiteral,
  normalizeStructuralEmissionType,
  resolveStructuralReferenceType,
  stripNullish,
  isDefinitelyValueType,
  isTypeOnlyStructuralTarget,
  narrowTypeByTypeofTag,
} from "./type-resolution.js";
import { EmitterContext, LocalTypeInfo, EmitterOptions } from "../../types.js";

describe("type-resolution", () => {
  describe("narrowTypeByTypeofTag", () => {
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

    it("falls back to primitive string for unknown-like values", () => {
      expect(
        narrowTypeByTypeofTag(
          { kind: "referenceType", name: "unknown" },
          "string",
          context
        )
      ).to.deep.equal({ kind: "primitiveType", name: "string" });
    });

    it("falls back to primitive number when union members do not encode the typeof target", () => {
      expect(
        narrowTypeByTypeofTag(
          {
            kind: "unionType",
            types: [{ kind: "referenceType", name: "unknown" }],
          },
          "number",
          context
        )
      ).to.deep.equal({ kind: "primitiveType", name: "number" });
    });
  });

  describe("containsTypeParameter", () => {
    it("returns true for typeParameterType IR kind", () => {
      const type: IrType = { kind: "typeParameterType", name: "T" };

      expect(containsTypeParameter(type)).to.be.true;
    });

    it("returns false for referenceType named like type parameter", () => {
      const type: IrType = { kind: "referenceType", name: "T" };

      expect(containsTypeParameter(type)).to.be.false;
    });

    it("returns false for referenceType not in typeParams set", () => {
      const type: IrType = { kind: "referenceType", name: "string" };

      expect(containsTypeParameter(type)).to.be.false;
    });

    it("returns true for Array<T> containing type parameter", () => {
      const type: IrType = {
        kind: "referenceType",
        name: "Array",
        typeArguments: [{ kind: "typeParameterType", name: "T" }],
      };
      expect(containsTypeParameter(type)).to.be.true;
    });

    it("returns false for Array<string> (concrete type)", () => {
      const type: IrType = {
        kind: "referenceType",
        name: "Array",
        typeArguments: [{ kind: "primitiveType", name: "string" }],
      };
      expect(containsTypeParameter(type)).to.be.false;
    });

    it("returns true for arrayType with type parameter element", () => {
      const type: IrType = {
        kind: "arrayType",
        elementType: { kind: "typeParameterType", name: "T" },
      };
      expect(containsTypeParameter(type)).to.be.true;
    });

    it("returns true for union type containing type parameter", () => {
      const type: IrType = {
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "string" },
          { kind: "typeParameterType", name: "T" },
        ],
      };
      expect(containsTypeParameter(type)).to.be.true;
    });

    it("returns false for primitive types", () => {
      const type: IrType = { kind: "primitiveType", name: "number" };
      expect(containsTypeParameter(type)).to.be.false;
    });

    it("does not recurse infinitely through recursive structural unions", () => {
      const routerType = {
        kind: "referenceType",
        name: "Router",
        resolvedClrType: "global::System.Object",
        structuralMembers: [],
      } as unknown as Extract<IrType, { kind: "referenceType" }> & {
        structuralMembers: unknown[];
      };

      const middlewareLike = {
        kind: "unionType",
        types: [],
      } as unknown as Extract<IrType, { kind: "unionType" }> & {
        types: IrType[];
      };

      middlewareLike.types.push(routerType, {
        kind: "arrayType",
        elementType: middlewareLike,
      });

      routerType.structuralMembers = [
        {
          kind: "methodSignature",
          name: "use",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "handlers" },
              type: middlewareLike,
              initializer: undefined,
              isOptional: false,
              isRest: true,
              passing: "value",
            },
          ],
          returnType: routerType,
        },
      ];

      expect(containsTypeParameter(middlewareLike)).to.equal(false);
    });

    it("finds type parameters through recursive structural unions", () => {
      const recursive = {
        kind: "unionType",
        types: [],
      } as unknown as Extract<IrType, { kind: "unionType" }> & {
        types: IrType[];
      };

      recursive.types.push(
        { kind: "typeParameterType", name: "T" },
        {
          kind: "arrayType",
          elementType: recursive,
        }
      );

      expect(containsTypeParameter(recursive)).to.equal(true);
    });
  });

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

  describe("substituteTypeArgs", () => {
    it("substitutes simple type parameter", () => {
      const type: IrType = { kind: "typeParameterType", name: "T" };
      const typeParamNames = ["T"];
      const typeArgs: IrType[] = [{ kind: "primitiveType", name: "string" }];

      const result = substituteTypeArgs(type, typeParamNames, typeArgs);

      expect(result).to.deep.equal({ kind: "primitiveType", name: "string" });
    });

    it("does not substitute plain referenceType names", () => {
      const type: IrType = { kind: "referenceType", name: "T" };
      const typeParamNames = ["T"];
      const typeArgs: IrType[] = [{ kind: "primitiveType", name: "number" }];

      const result = substituteTypeArgs(type, typeParamNames, typeArgs);

      expect(result).to.deep.equal({ kind: "referenceType", name: "T" });
    });

    it("substitutes type argument in generic reference", () => {
      const type: IrType = {
        kind: "referenceType",
        name: "Array",
        typeArguments: [{ kind: "typeParameterType", name: "T" }],
      };
      const typeParamNames = ["T"];
      const typeArgs: IrType[] = [{ kind: "primitiveType", name: "string" }];

      const result = substituteTypeArgs(type, typeParamNames, typeArgs);

      expect(result).to.deep.equal({
        kind: "referenceType",
        name: "Array",
        typeArguments: [{ kind: "primitiveType", name: "string" }],
      });
    });

    it("substitutes in array element type", () => {
      const type: IrType = {
        kind: "arrayType",
        elementType: { kind: "typeParameterType", name: "T" },
      };
      const typeParamNames = ["T"];
      const typeArgs: IrType[] = [{ kind: "primitiveType", name: "boolean" }];

      const result = substituteTypeArgs(type, typeParamNames, typeArgs);

      expect(result).to.deep.equal({
        kind: "arrayType",
        elementType: { kind: "primitiveType", name: "boolean" },
      });
    });

    it("returns unchanged type when no matching type param", () => {
      const type: IrType = { kind: "referenceType", name: "SomeType" };
      const typeParamNames = ["T"];
      const typeArgs: IrType[] = [{ kind: "primitiveType", name: "string" }];

      const result = substituteTypeArgs(type, typeParamNames, typeArgs);

      expect(result).to.deep.equal({ kind: "referenceType", name: "SomeType" });
    });

    it("preserves recursive structural graphs while substituting nested type parameters", () => {
      const recursive = {
        kind: "unionType",
        types: [],
      } as unknown as Extract<IrType, { kind: "unionType" }> & {
        types: IrType[];
      };

      recursive.types.push(
        { kind: "typeParameterType", name: "T" },
        {
          kind: "arrayType",
          elementType: recursive,
        }
      );

      const substituted = substituteTypeArgs(
        recursive,
        ["T"],
        [{ kind: "primitiveType", name: "string" }]
      );

      expect(substituted.kind).to.equal("unionType");
      if (substituted.kind !== "unionType") {
        return;
      }
      expect(substituted.types[0]).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });
      const recursiveArray = substituted.types[1];
      expect(recursiveArray?.kind).to.equal("arrayType");
      if (!recursiveArray || recursiveArray.kind !== "arrayType") {
        return;
      }
      expect(recursiveArray.elementType).to.equal(substituted);
    });
  });

  describe("getPropertyType", () => {
    const defaultOptions: EmitterOptions = {
      rootNamespace: "Test",
      indent: 4,
    };

    const createContext = (
      localTypes: ReadonlyMap<string, LocalTypeInfo>
    ): EmitterContext => ({
      indentLevel: 0,
      options: defaultOptions,
      isStatic: false,
      isAsync: false,
      localTypes,
      usings: new Set<string>(),
    });

    it("returns property type from interface", () => {
      const members: IrInterfaceMember[] = [
        {
          kind: "propertySignature",
          name: "value",
          type: { kind: "typeParameterType", name: "T" },
          isOptional: false,
          isReadonly: false,
        },
      ];

      const localTypes = new Map<string, LocalTypeInfo>([
        [
          "Result",
          {
            kind: "interface",
            typeParameters: ["T"],
            members,
            extends: [],
          },
        ],
      ]);

      const contextualType: IrType = {
        kind: "referenceType",
        name: "Result",
        typeArguments: [{ kind: "primitiveType", name: "string" }],
      };

      const context = createContext(localTypes);
      const result = getPropertyType(contextualType, "value", context);

      // After substitution, T becomes string
      expect(result).to.deep.equal({ kind: "primitiveType", name: "string" });
    });

    it("preserves undefined for optional interface properties", () => {
      const members: IrInterfaceMember[] = [
        {
          kind: "propertySignature",
          name: "limit",
          type: { kind: "primitiveType", name: "int" },
          isOptional: true,
          isReadonly: false,
        },
      ];

      const localTypes = new Map<string, LocalTypeInfo>([
        [
          "Options",
          {
            kind: "interface",
            typeParameters: [],
            members,
            extends: [],
          },
        ],
      ]);

      const contextualType: IrType = {
        kind: "referenceType",
        name: "Options",
      };

      const context = createContext(localTypes);
      const result = getPropertyType(contextualType, "limit", context);

      expect(result).to.deep.equal({
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "int" },
          { kind: "primitiveType", name: "undefined" },
        ],
      });
    });

    it("returns undefined for unknown property", () => {
      const members: IrInterfaceMember[] = [
        {
          kind: "propertySignature",
          name: "value",
          type: { kind: "typeParameterType", name: "T" },
          isOptional: false,
          isReadonly: false,
        },
      ];

      const localTypes = new Map<string, LocalTypeInfo>([
        [
          "Result",
          {
            kind: "interface",
            typeParameters: ["T"],
            members,
            extends: [],
          },
        ],
      ]);

      const contextualType: IrType = {
        kind: "referenceType",
        name: "Result",
        typeArguments: [{ kind: "primitiveType", name: "string" }],
      };

      const context = createContext(localTypes);
      const result = getPropertyType(contextualType, "unknown", context);

      expect(result).to.be.undefined;
    });

    it("returns undefined for unknown type", () => {
      const localTypes = new Map<string, LocalTypeInfo>();

      const contextualType: IrType = {
        kind: "referenceType",
        name: "ExternalType",
      };

      const context = createContext(localTypes);
      const result = getPropertyType(contextualType, "value", context);

      expect(result).to.be.undefined;
    });

    it("returns unsubstituted type when no type arguments", () => {
      const members: IrInterfaceMember[] = [
        {
          kind: "propertySignature",
          name: "value",
          type: { kind: "typeParameterType", name: "T" },
          isOptional: false,
          isReadonly: false,
        },
      ];

      const localTypes = new Map<string, LocalTypeInfo>([
        [
          "Result",
          {
            kind: "interface",
            typeParameters: ["T"],
            members,
            extends: [],
          },
        ],
      ]);

      const contextualType: IrType = {
        kind: "referenceType",
        name: "Result",
        // No typeArguments - using raw generic type
      };

      const context = createContext(localTypes);
      const result = getPropertyType(contextualType, "value", context);

      // Returns unsubstituted T
      expect(result).to.deep.equal({ kind: "typeParameterType", name: "T" });
    });

    it("chases type alias", () => {
      const members: IrInterfaceMember[] = [
        {
          kind: "propertySignature",
          name: "data",
          type: { kind: "primitiveType", name: "string" },
          isOptional: false,
          isReadonly: false,
        },
      ];

      const localTypes = new Map<string, LocalTypeInfo>([
        [
          "MyAlias",
          {
            kind: "typeAlias",
            typeParameters: [],
            type: { kind: "referenceType", name: "Target" },
          },
        ],
        [
          "Target",
          {
            kind: "interface",
            typeParameters: [],
            members,
            extends: [],
          },
        ],
      ]);

      const contextualType: IrType = {
        kind: "referenceType",
        name: "MyAlias",
      };

      const context = createContext(localTypes);
      const result = getPropertyType(contextualType, "data", context);

      expect(result).to.deep.equal({ kind: "primitiveType", name: "string" });
    });

    it("resolves property type from moduleMap local type tables", () => {
      const syntheticMembers: IrInterfaceMember[] = [
        {
          kind: "propertySignature",
          name: "events",
          type: {
            kind: "arrayType",
            elementType: { kind: "primitiveType", name: "string" },
          },
          isOptional: false,
          isReadonly: false,
        },
      ];

      const syntheticLocalTypes = new Map<string, LocalTypeInfo>([
        [
          "__Anon_events",
          {
            kind: "interface",
            typeParameters: [],
            members: syntheticMembers,
            extends: [],
          },
        ],
      ]);

      const context: EmitterContext = {
        indentLevel: 0,
        options: {
          ...defaultOptions,
          moduleMap: new Map([
            [
              "__tsonic/__tsonic_anonymous_types.g.ts",
              {
                namespace: "Test",
                className: "__tsonic_anonymous_types",
                filePath: "__tsonic/__tsonic_anonymous_types.g.ts",
                hasRuntimeContainer: false,
                hasTypeCollision: false,
                localTypes: syntheticLocalTypes,
              },
            ],
          ]),
        },
        isStatic: false,
        isAsync: false,
        localTypes: new Map<string, LocalTypeInfo>(),
        usings: new Set<string>(),
      };

      const contextualType: IrType = {
        kind: "referenceType",
        name: "__Anon_events",
        resolvedClrType: "Test.__Anon_events",
      };

      const result = getPropertyType(contextualType, "events", context);
      expect(result).to.deep.equal({
        kind: "arrayType",
        elementType: { kind: "primitiveType", name: "string" },
      });
    });
  });

  describe("getArrayLikeElementType", () => {
    const defaultOptions: EmitterOptions = {
      rootNamespace: "Test",
      indent: 4,
    };

    const createContext = (
      localTypes: ReadonlyMap<string, LocalTypeInfo>
    ): EmitterContext => ({
      indentLevel: 0,
      options: defaultOptions,
      isStatic: false,
      isAsync: false,
      localTypes,
      usings: new Set<string>(),
    });

    it("resolves array element types through local aliases", () => {
      const context = createContext(
        new Map([
          [
            "MiddlewareArgs",
            {
              kind: "typeAlias",
              typeParameters: [],
              type: {
                kind: "arrayType",
                elementType: { kind: "referenceType", name: "MiddlewareLike" },
              },
            },
          ],
        ])
      );

      const result = getArrayLikeElementType(
        { kind: "referenceType", name: "MiddlewareArgs" },
        context
      );

      expect(result).to.deep.equal({
        kind: "referenceType",
        name: "MiddlewareLike",
      });
    });

    it("resolves ReadonlyArray element types through generic references", () => {
      const context = createContext(new Map());

      const result = getArrayLikeElementType(
        {
          kind: "referenceType",
          name: "ReadonlyArray",
          typeArguments: [{ kind: "primitiveType", name: "string" }],
        },
        context
      );

      expect(result).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });
    });
  });

  describe("selectUnionMemberForObjectLiteral", () => {
    it("selects synthetic union members from moduleMap", () => {
      const eventsMembers: IrInterfaceMember[] = [
        {
          kind: "propertySignature",
          name: "events",
          type: {
            kind: "arrayType",
            elementType: { kind: "primitiveType", name: "string" },
          },
          isOptional: false,
          isReadonly: false,
        },
      ];

      const errorMembers: IrInterfaceMember[] = [
        {
          kind: "propertySignature",
          name: "error",
          type: { kind: "primitiveType", name: "string" },
          isOptional: false,
          isReadonly: false,
        },
      ];

      const syntheticLocalTypes = new Map<string, LocalTypeInfo>([
        [
          "__Anon_events",
          {
            kind: "interface",
            typeParameters: [],
            members: eventsMembers,
            extends: [],
          },
        ],
        [
          "__Anon_error",
          {
            kind: "interface",
            typeParameters: [],
            members: errorMembers,
            extends: [],
          },
        ],
      ]);

      const context: EmitterContext = {
        indentLevel: 0,
        options: {
          rootNamespace: "Test",
          indent: 4,
          moduleMap: new Map([
            [
              "__tsonic/__tsonic_anonymous_types.g.ts",
              {
                namespace: "Test",
                className: "__tsonic_anonymous_types",
                filePath: "__tsonic/__tsonic_anonymous_types.g.ts",
                hasRuntimeContainer: false,
                hasTypeCollision: false,
                localTypes: syntheticLocalTypes,
              },
            ],
          ]),
        },
        isStatic: false,
        isAsync: false,
        localTypes: new Map<string, LocalTypeInfo>(),
        usings: new Set<string>(),
      };

      const unionType: Extract<IrType, { kind: "unionType" }> = {
        kind: "unionType",
        types: [
          {
            kind: "referenceType",
            name: "__Anon_events",
            resolvedClrType: "Test.__Anon_events",
          },
          {
            kind: "referenceType",
            name: "__Anon_error",
            resolvedClrType: "Test.__Anon_error",
          },
        ],
      };

      const selected = selectUnionMemberForObjectLiteral(
        unionType,
        ["events"],
        context
      );

      expect(selected?.kind).to.equal("referenceType");
      expect(selected?.name).to.equal("__Anon_events");
    });
  });

  describe("stripNullish", () => {
    it("returns non-union types unchanged", () => {
      const type: IrType = { kind: "primitiveType", name: "string" };
      expect(stripNullish(type)).to.deep.equal(type);
    });

    it("strips null from T | null union", () => {
      const type: IrType = {
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "number" },
          { kind: "primitiveType", name: "null" },
        ],
      };
      const result = stripNullish(type);
      expect(result).to.deep.equal({ kind: "primitiveType", name: "number" });
    });

    it("strips undefined from T | undefined union", () => {
      const type: IrType = {
        kind: "unionType",
        types: [
          { kind: "referenceType", name: "MyType" },
          { kind: "primitiveType", name: "undefined" },
        ],
      };
      const result = stripNullish(type);
      expect(result).to.deep.equal({ kind: "referenceType", name: "MyType" });
    });

    it("strips both null and undefined from T | null | undefined", () => {
      const type: IrType = {
        kind: "unionType",
        types: [
          {
            kind: "referenceType",
            name: "Option",
            typeArguments: [{ kind: "typeParameterType", name: "T" }],
          },
          { kind: "primitiveType", name: "null" },
          { kind: "primitiveType", name: "undefined" },
        ],
      };
      const result = stripNullish(type);
      expect(result).to.deep.equal({
        kind: "referenceType",
        name: "Option",
        typeArguments: [{ kind: "typeParameterType", name: "T" }],
      });
    });

    it("returns original union when multiple non-nullish types", () => {
      const type: IrType = {
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "number" },
          { kind: "primitiveType", name: "null" },
        ],
      };
      // string | number | null -> still has two non-nullish types
      const result = stripNullish(type);
      expect(result).to.deep.equal(type);
    });
  });

  describe("isDefinitelyValueType", () => {
    it("returns true for number primitive", () => {
      const type: IrType = { kind: "primitiveType", name: "number" };
      expect(isDefinitelyValueType(type)).to.be.true;
    });

    it("returns true for boolean primitive", () => {
      const type: IrType = { kind: "primitiveType", name: "boolean" };
      expect(isDefinitelyValueType(type)).to.be.true;
    });

    it("returns false for string primitive", () => {
      const type: IrType = { kind: "primitiveType", name: "string" };
      expect(isDefinitelyValueType(type)).to.be.false;
    });

    it("returns true for number | null (strips nullish first)", () => {
      const type: IrType = {
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "number" },
          { kind: "primitiveType", name: "null" },
        ],
      };
      expect(isDefinitelyValueType(type)).to.be.true;
    });

    it("returns false for type parameters", () => {
      const type: IrType = { kind: "typeParameterType", name: "T" };
      expect(isDefinitelyValueType(type)).to.be.false;
    });

    it("returns false for reference types without resolvedClrType", () => {
      const type: IrType = { kind: "referenceType", name: "MyClass" };
      expect(isDefinitelyValueType(type)).to.be.false;
    });

    it("returns true for known CLR value type (System.DateTime)", () => {
      const type: IrType = {
        kind: "referenceType",
        name: "DateTime",
        resolvedClrType: "global::System.DateTime",
      };
      expect(isDefinitelyValueType(type)).to.be.true;
    });

    it("returns true for known CLR value type (System.Guid)", () => {
      const type: IrType = {
        kind: "referenceType",
        name: "Guid",
        resolvedClrType: "System.Guid",
      };
      expect(isDefinitelyValueType(type)).to.be.true;
    });
  });

  describe("isTypeOnlyStructuralTarget", () => {
    const defaultOptions: EmitterOptions = {
      rootNamespace: "Test",
      indent: 4,
    };

    const createContext = (
      localTypes: ReadonlyMap<string, LocalTypeInfo>
    ): EmitterContext => ({
      indentLevel: 0,
      options: defaultOptions,
      isStatic: false,
      isAsync: false,
      localTypes,
      usings: new Set<string>(),
    });

    it("treats compiler-generated anonymous carrier classes as structural", () => {
      const context = createContext(
        new Map([
          [
            "__Anon_handler",
            {
              kind: "class",
              typeParameters: [],
              members: [],
              implements: [],
            },
          ],
        ])
      );

      expect(
        isTypeOnlyStructuralTarget(
          {
            kind: "referenceType",
            name: "__Anon_handler",
            resolvedClrType: "Test.__Anon_handler",
          },
          context
        )
      ).to.equal(true);
    });

    it("treats compiler-generated rest carrier classes as structural", () => {
      const context = createContext(
        new Map([
          [
            "__Rest_handler",
            {
              kind: "class",
              typeParameters: [],
              members: [],
              implements: [],
            },
          ],
        ])
      );

      expect(
        isTypeOnlyStructuralTarget(
          {
            kind: "referenceType",
            name: "__Rest_handler",
            resolvedClrType: "Test.__Rest_handler",
          },
          context
        )
      ).to.equal(true);
    });

    it("preserves user-authored nominal classes as runtime cast targets", () => {
      const context = createContext(
        new Map([
          [
            "Animal",
            {
              kind: "class",
              typeParameters: [],
              members: [],
              implements: [],
            },
          ],
        ])
      );

      expect(
        isTypeOnlyStructuralTarget(
          {
            kind: "referenceType",
            name: "Animal",
            resolvedClrType: "Test.Animal",
          },
          context
        )
      ).to.equal(false);
    });

    it("treats dictionary targets as structural runtime-erased assertion targets", () => {
      const context = createContext(new Map());

      expect(
        isTypeOnlyStructuralTarget(
          {
            kind: "dictionaryType",
            keyType: { kind: "primitiveType", name: "string" },
            valueType: { kind: "unknownType" },
          },
          context
        )
      ).to.equal(true);
    });
  });
});
