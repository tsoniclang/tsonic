import {
  describe,
  it,
  expect,
  getPropertyType,
  type EmitterContext,
  type EmitterOptions,
  type IrInterfaceMember,
  type IrType,
  type LocalTypeInfo,
} from "./helpers.js";

describe("type-resolution", () => {
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

    it("prefers registry-substituted type over structural members", () => {
      // A reference type may carry both registry info (with type-arg substitution)
      // and structuralMembers (without substitution). The registry path must win
      // so that generic substitution is applied correctly.
      //
      // interface Box<T> { value: T }
      // Box<string> with structuralMembers: [{ value: number }]
      // → getPropertyType should return string (from registry), not number (from structural)
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
          "Box",
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
        name: "Box",
        typeArguments: [{ kind: "primitiveType", name: "string" }],
        structuralMembers: [
          {
            kind: "propertySignature" as const,
            name: "value",
            type: { kind: "primitiveType", name: "number" } as IrType,
            isOptional: false,
            isReadonly: false,
          },
        ],
      };

      const context = createContext(localTypes);
      const result = getPropertyType(contextualType, "value", context);

      // Registry path substitutes T → string; structural members say number.
      // Registry must win.
      expect(result).to.deep.equal({ kind: "primitiveType", name: "string" });
    });
  });

});
