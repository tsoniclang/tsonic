import {
  describe,
  it,
  expect,
  containsTypeParameter,
  type IrType,
} from "./helpers.js";

describe("type-resolution", () => {
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

});
