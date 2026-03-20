import {
  describe,
  it,
  expect,
  ts,
  expandConditionalUtilityType,
  assertDefined,
  createTestProgram,
  findTypeAliasReference,
  stubConvertType,
} from "./helpers.js";

describe("Conditional Utility Type Expansion", () => {
  describe("Awaited<T>", () => {
    it("should expand Awaited<Promise<string>> to string", () => {
      const source = `
        type Result = Awaited<Promise<string>>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Awaited",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("primitiveType");
      if (result?.kind === "primitiveType") {
        expect(result.name).to.equal("string");
      }
    });

    it("should expand Awaited<Promise<Promise<number>>> recursively to number", () => {
      const source = `
        type Result = Awaited<Promise<Promise<number>>>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Awaited",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("primitiveType");
      if (result?.kind === "primitiveType") {
        expect(result.name).to.equal("number");
      }
    });

    it("should expand Awaited<string> to string (non-promise passthrough)", () => {
      const source = `
        type Result = Awaited<string>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Awaited",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("primitiveType");
      if (result?.kind === "primitiveType") {
        expect(result.name).to.equal("string");
      }
    });

    it("should expand Awaited with union of promises", () => {
      const source = `
        type Result = Awaited<Promise<string> | Promise<number>>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Awaited",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      // Should be string | number
      expect(result?.kind).to.equal("unionType");
    });

    it("should return null for Awaited<T> where T is a type parameter", () => {
      const source = `
        async function processAsync<T>(promise: Promise<T>): Promise<Awaited<T>> {
          return await promise;
        }
      `;

      const { binding, sourceFile } = createTestProgram(source);

      let typeRef: ts.TypeReferenceNode | null = null;
      const visitor = (node: ts.Node): void => {
        if (
          ts.isTypeReferenceNode(node) &&
          ts.isIdentifier(node.typeName) &&
          node.typeName.text === "Awaited"
        ) {
          typeRef = node;
        }
        ts.forEachChild(node, visitor);
      };
      ts.forEachChild(sourceFile, visitor);

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Awaited",
        binding,
        stubConvertType
      );

      expect(result).to.equal(null);
    });

    it("should expand Awaited<null> to null", () => {
      const source = `
        type Result = Awaited<null>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Awaited",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("primitiveType");
      if (result?.kind === "primitiveType") {
        expect(result.name).to.equal("null");
      }
    });
  });

  describe("ConstructorParameters<T>", () => {
    it("expands constructor type node to tuple", () => {
      const source = `
        type Ctor = new (name: string, age: number) => { name: string };
        type Params = ConstructorParameters<Ctor>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Params");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "ConstructorParameters",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("tupleType");
      if (result?.kind === "tupleType") {
        expect(result.elementTypes).to.deep.equal([
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "number" },
        ]);
      }
    });

    it("expands ConstructorParameters<typeof ClassName>", () => {
      const source = `
        class User {
          constructor(name: string, active: boolean) {}
        }
        type Params = ConstructorParameters<typeof User>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Params");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "ConstructorParameters",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("tupleType");
      if (result?.kind === "tupleType") {
        expect(result.elementTypes).to.deep.equal([
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "boolean" },
        ]);
      }
    });

    it("returns null for ConstructorParameters<T> when T is a type parameter", () => {
      const source = `
        type Wrapper<T extends abstract new (...args: unknown[]) => unknown> =
          ConstructorParameters<T>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Wrapper");
      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "ConstructorParameters",
        binding,
        stubConvertType
      );
      expect(result).to.equal(null);
    });
  });

  describe("InstanceType<T>", () => {
    it("expands constructor type node to instance type", () => {
      const source = `
        interface Item { id: number; }
        type Ctor = new (id: number) => Item;
        type Instance = InstanceType<Ctor>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Instance");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "InstanceType",
        binding,
        stubConvertType
      );

      expect(result).to.deep.equal({
        kind: "referenceType",
        name: "Item",
        typeArguments: [],
      });
    });

    it("expands InstanceType<typeof ClassName> to class reference", () => {
      const source = `
        class Product {
          constructor(public readonly sku: string) {}
        }
        type Instance = InstanceType<typeof Product>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Instance");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "InstanceType",
        binding,
        stubConvertType
      );

      expect(result).to.deep.equal({
        kind: "referenceType",
        name: "Product",
      });
    });

    it("returns null for InstanceType<T> when T is a type parameter", () => {
      const source = `
        type Wrapper<T extends abstract new (...args: unknown[]) => unknown> =
          InstanceType<T>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Wrapper");
      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "InstanceType",
        binding,
        stubConvertType
      );
      expect(result).to.equal(null);
    });
  });
});
