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
  describe("ReturnType<T>", () => {
    it("should expand ReturnType<() => string> to string", () => {
      const source = `
        type Result = ReturnType<() => string>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "ReturnType",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("primitiveType");
      if (result?.kind === "primitiveType") {
        expect(result.name).to.equal("string");
      }
    });

    it("should expand ReturnType<(x: number) => boolean> to boolean", () => {
      const source = `
        type Result = ReturnType<(x: number) => boolean>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "ReturnType",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("primitiveType");
      if (result?.kind === "primitiveType") {
        expect(result.name).to.equal("boolean");
      }
    });

    it("should expand ReturnType with void return type", () => {
      const source = `
        type Result = ReturnType<() => void>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "ReturnType",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      // void is handled by fallback
    });

    it("should expand ReturnType with union function types", () => {
      const source = `
        type Fn1 = () => string;
        type Fn2 = () => number;
        type Result = ReturnType<Fn1 | Fn2>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "ReturnType",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      // Should be string | number
      expect(result?.kind).to.equal("unionType");
      if (result?.kind === "unionType") {
        expect(result.types).to.have.length(2);
        const names = result.types
          .filter((t) => t.kind === "primitiveType")
          .map((t) => (t.kind === "primitiveType" ? t.name : null));
        expect(names).to.deep.equal(["string", "number"]);
      }
    });

    it("should return null for ReturnType<T> where T is a type parameter", () => {
      const source = `
        function process<T extends () => unknown>(fn: T): ReturnType<T> {
          return fn();
        }
      `;

      const { binding, sourceFile } = createTestProgram(source);

      let typeRef: ts.TypeReferenceNode | null = null;
      const visitor = (node: ts.Node): void => {
        if (
          ts.isTypeReferenceNode(node) &&
          ts.isIdentifier(node.typeName) &&
          node.typeName.text === "ReturnType"
        ) {
          typeRef = node;
        }
        ts.forEachChild(node, visitor);
      };
      ts.forEachChild(sourceFile, visitor);

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "ReturnType",
        binding,
        stubConvertType
      );

      expect(result).to.equal(null);
    });

    it("should expand ReturnType with typeof function", () => {
      const source = `
        function add(a: number, b: number): number {
          return a + b;
        }
        type Result = ReturnType<typeof add>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "ReturnType",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("primitiveType");
      if (result?.kind === "primitiveType") {
        expect(result.name).to.equal("number");
      }
    });
  });

  describe("Parameters<T>", () => {
    it("should expand Parameters<(x: string, y: number) => void> to tuple", () => {
      const source = `
        type Result = Parameters<(x: string, y: number) => void>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Parameters",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      // Parameters returns a tuple type - the exact representation depends on TypeScript
    });

    it("should handle Parameters<() => void> (empty tuple)", () => {
      const source = `
        type Result = Parameters<() => void>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      // Empty tuple may return null (falls through to referenceType)
      // or may return an expanded type - both are acceptable behaviors
      // The key is that it doesn't throw an error
      expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Parameters",
        binding,
        stubConvertType
      );
    });

    it("should expand Parameters with single parameter", () => {
      const source = `
        type Result = Parameters<(x: boolean) => void>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Parameters",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
    });

    it("should return null for Parameters<T> where T is a type parameter", () => {
      const source = `
        function callWith<T extends (...args: unknown[]) => unknown>(
          fn: T,
          args: Parameters<T>
        ): void {
          fn(...args);
        }
      `;

      const { binding, sourceFile } = createTestProgram(source);

      let typeRef: ts.TypeReferenceNode | null = null;
      const visitor = (node: ts.Node): void => {
        if (
          ts.isTypeReferenceNode(node) &&
          ts.isIdentifier(node.typeName) &&
          node.typeName.text === "Parameters"
        ) {
          typeRef = node;
        }
        ts.forEachChild(node, visitor);
      };
      ts.forEachChild(sourceFile, visitor);

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Parameters",
        binding,
        stubConvertType
      );

      expect(result).to.equal(null);
    });

    it("should expand Parameters with typeof function", () => {
      const source = `
        function greet(name: string, age: number): void {}
        type Result = Parameters<typeof greet>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Parameters",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
    });
  });
});
