import {
  describe,
  it,
  expect,
  stripNullish,
  isDefinitelyValueType,
  type IrType,
} from "./helpers.js";

describe("type-resolution", () => {
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

    it("returns true for exact numeric reference aliases without resolvedClrType", () => {
      for (const name of [
        "byte",
        "sbyte",
        "short",
        "ushort",
        "int",
        "uint",
        "long",
        "ulong",
        "nint",
        "nuint",
        "float",
        "double",
        "decimal",
        "char",
      ] as const) {
        const type: IrType = { kind: "referenceType", name };
        expect(isDefinitelyValueType(type), name).to.be.true;
      }
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
