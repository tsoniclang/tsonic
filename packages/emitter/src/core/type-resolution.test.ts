/**
 * Tests for type resolution helpers
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { IrType, IrInterfaceMember } from "@tsonic/frontend";
import {
  containsTypeParameter,
  substituteTypeArgs,
  getPropertyType,
  stripNullish,
  isDefinitelyValueType,
} from "./type-resolution.js";
import { EmitterContext, LocalTypeInfo, EmitterOptions } from "../types.js";

describe("type-resolution", () => {
  describe("containsTypeParameter", () => {
    it("returns true for typeParameterType IR kind", () => {
      const type: IrType = { kind: "typeParameterType", name: "T" };
      const typeParams = new Set<string>();

      expect(containsTypeParameter(type, typeParams)).to.be.true;
    });

    it("returns true for referenceType matching typeParams set (legacy)", () => {
      const type: IrType = { kind: "referenceType", name: "T" };
      const typeParams = new Set(["T"]);

      expect(containsTypeParameter(type, typeParams)).to.be.true;
    });

    it("returns false for referenceType not in typeParams set", () => {
      const type: IrType = { kind: "referenceType", name: "string" };
      const typeParams = new Set(["T"]);

      expect(containsTypeParameter(type, typeParams)).to.be.false;
    });

    it("returns true for Array<T> containing type parameter", () => {
      const type: IrType = {
        kind: "referenceType",
        name: "Array",
        typeArguments: [{ kind: "typeParameterType", name: "T" }],
      };
      const typeParams = new Set<string>();

      expect(containsTypeParameter(type, typeParams)).to.be.true;
    });

    it("returns false for Array<string> (concrete type)", () => {
      const type: IrType = {
        kind: "referenceType",
        name: "Array",
        typeArguments: [{ kind: "primitiveType", name: "string" }],
      };
      const typeParams = new Set<string>();

      expect(containsTypeParameter(type, typeParams)).to.be.false;
    });

    it("returns true for arrayType with type parameter element", () => {
      const type: IrType = {
        kind: "arrayType",
        elementType: { kind: "typeParameterType", name: "T" },
      };
      const typeParams = new Set<string>();

      expect(containsTypeParameter(type, typeParams)).to.be.true;
    });

    it("returns true for union type containing type parameter", () => {
      const type: IrType = {
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "string" },
          { kind: "typeParameterType", name: "T" },
        ],
      };
      const typeParams = new Set<string>();

      expect(containsTypeParameter(type, typeParams)).to.be.true;
    });

    it("returns false for primitive types", () => {
      const type: IrType = { kind: "primitiveType", name: "number" };
      const typeParams = new Set(["T"]);

      expect(containsTypeParameter(type, typeParams)).to.be.false;
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

    it("substitutes type parameter in referenceType (legacy)", () => {
      const type: IrType = { kind: "referenceType", name: "T" };
      const typeParamNames = ["T"];
      const typeArgs: IrType[] = [{ kind: "primitiveType", name: "number" }];

      const result = substituteTypeArgs(type, typeParamNames, typeArgs);

      expect(result).to.deep.equal({ kind: "primitiveType", name: "number" });
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
});
