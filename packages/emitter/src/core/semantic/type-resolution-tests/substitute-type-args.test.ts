import {
  describe,
  it,
  expect,
  substituteTypeArgs,
  type IrType,
} from "./helpers.js";

describe("type-resolution", () => {
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

});
