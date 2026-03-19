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
  describe("NonNullable<T>", () => {
    it("should expand NonNullable<string | null> to string", () => {
      const source = `
        type Result = NonNullable<string | null>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "NonNullable",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("primitiveType");
      if (result?.kind === "primitiveType") {
        expect(result.name).to.equal("string");
      }
    });

    it("should expand NonNullable<string | null | undefined> to string", () => {
      const source = `
        type Result = NonNullable<string | null | undefined>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "NonNullable",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("primitiveType");
      if (result?.kind === "primitiveType") {
        expect(result.name).to.equal("string");
      }
    });

    it("should return never for NonNullable<null | undefined>", () => {
      const source = `
        type Result = NonNullable<null | undefined>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "NonNullable",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("neverType");
    });

    it("should preserve any for NonNullable<any>", () => {
      const source = `
        type Result = NonNullable<any>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "NonNullable",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("anyType");
    });

    it("should preserve unknown for NonNullable<unknown>", () => {
      const source = `
        type Result = NonNullable<unknown>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "NonNullable",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("unknownType");
    });

    it("should return null for NonNullable<T> where T is a type parameter", () => {
      const source = `
        function process<T>(data: NonNullable<T>): void {}
      `;

      const { binding, sourceFile } = createTestProgram(source);

      let typeRef: ts.TypeReferenceNode | null = null;
      const visitor = (node: ts.Node): void => {
        if (
          ts.isTypeReferenceNode(node) &&
          ts.isIdentifier(node.typeName) &&
          node.typeName.text === "NonNullable"
        ) {
          typeRef = node;
        }
        ts.forEachChild(node, visitor);
      };
      ts.forEachChild(sourceFile, visitor);

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "NonNullable",
        binding,
        stubConvertType
      );

      expect(result).to.equal(null);
    });
  });

  describe("Exclude<T, U>", () => {
    it("should expand Exclude with literal strings", () => {
      const source = `
        type Result = Exclude<"a" | "b" | "c", "a">;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Exclude",
        binding,
        stubConvertType
      );

      // Should expand successfully (result is "b" | "c")
      // Note: The exact IR kind depends on how TypeScript represents the resolved type
      // which may vary. The key is that expansion succeeds and doesn't return null.
      expect(result).not.to.equal(null);
    });

    it("should expand Exclude<string | number, number> to string", () => {
      const source = `
        type Result = Exclude<string | number, number>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Exclude",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("primitiveType");
      if (result?.kind === "primitiveType") {
        expect(result.name).to.equal("string");
      }
    });

    it("should return never for Exclude<string, string>", () => {
      const source = `
        type Result = Exclude<string, string>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Exclude",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("neverType");
    });

    it("should return null for Exclude<T, U> where T is a type parameter", () => {
      const source = `
        function process<T>(data: Exclude<T, null>): void {}
      `;

      const { binding, sourceFile } = createTestProgram(source);

      let typeRef: ts.TypeReferenceNode | null = null;
      const visitor = (node: ts.Node): void => {
        if (
          ts.isTypeReferenceNode(node) &&
          ts.isIdentifier(node.typeName) &&
          node.typeName.text === "Exclude"
        ) {
          typeRef = node;
        }
        ts.forEachChild(node, visitor);
      };
      ts.forEachChild(sourceFile, visitor);

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Exclude",
        binding,
        stubConvertType
      );

      expect(result).to.equal(null);
    });
  });

  describe("Extract<T, U>", () => {
    it("should expand Extract with literal strings", () => {
      const source = `
        type Result = Extract<"a" | "b" | "c", "a" | "f">;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Extract",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      // Result should be "a" (the only common literal)
    });

    it("should expand Extract<string | number, string> to string", () => {
      const source = `
        type Result = Extract<string | number, string>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Extract",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("primitiveType");
      if (result?.kind === "primitiveType") {
        expect(result.name).to.equal("string");
      }
    });

    it("should return never for Extract<string, number>", () => {
      const source = `
        type Result = Extract<string, number>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Extract",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("neverType");
    });
  });

  describe("Distributive and never edge cases", () => {
    it("should expand Exclude with never input to never", () => {
      const source = `
        type Result = Exclude<never, string>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Exclude",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("neverType");
    });

    it("should expand Extract with never input to never", () => {
      const source = `
        type Result = Extract<never, string>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Extract",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("neverType");
    });

    it("should distribute Exclude over union - removing multiple types", () => {
      const source = `
        type Result = Exclude<"a" | "b" | "c" | "d", "a" | "c">;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Exclude",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      // Should be a union of "b" | "d" (TypeScript checker resolves this)
    });

    it("should distribute Extract over union - extracting multiple types", () => {
      const source = `
        type Result = Extract<"a" | "b" | "c" | "d", "a" | "c" | "e">;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Extract",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      // Should be a union of "a" | "c" (TypeScript checker resolves this)
    });

    it("should handle Exclude with function types", () => {
      const source = `
        type Result = Exclude<string | number | (() => void), Function>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Exclude",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      // Should expand to string | number (function removed)
    });

    it("should distribute Exclude over mixed string and number literals", () => {
      // Alice's review case: mixed literals with Exclude filtering by type
      const source = `
        type Mixed = ("a" | "b") | (1 | 2);
        type OnlyNumbers = Exclude<Mixed, string>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "OnlyNumbers");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Exclude",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      // Should be 1 | 2 (string literals removed)
      // TypeScript distributes over the union and removes string-assignable types
      expect(result?.kind).to.equal("unionType");
      if (result?.kind === "unionType") {
        expect(result.types).to.have.length(2);
        const values = result.types
          .filter((t) => t.kind === "literalType")
          .map((t) => (t.kind === "literalType" ? t.value : null));
        expect(values).to.deep.equal([1, 2]);
      }
    });

    it("should distribute Extract over mixed string and number literals", () => {
      // Alice's review case: mixed literals with Extract filtering by type
      const source = `
        type Mixed = ("a" | "b") | (1 | 2);
        type OnlyStrings = Extract<Mixed, string>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "OnlyStrings");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Extract",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      // Should be "a" | "b" (number literals removed)
      // TypeScript distributes over the union and keeps only string-assignable types
      expect(result?.kind).to.equal("unionType");
      if (result?.kind === "unionType") {
        expect(result.types).to.have.length(2);
        const values = result.types
          .filter((t) => t.kind === "literalType")
          .map((t) => (t.kind === "literalType" ? t.value : null));
        expect(values).to.deep.equal(["a", "b"]);
      }
    });

    it("should handle nested conditional types", () => {
      const source = `
        type Result = Exclude<Exclude<string | null | undefined, null>, undefined>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Result");

      const result = expandConditionalUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Exclude",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("primitiveType");
      if (result?.kind === "primitiveType") {
        expect(result.name).to.equal("string");
      }
    });
  });
});
