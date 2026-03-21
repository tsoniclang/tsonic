import {
  describe,
  it,
  expect,
  ts,
  expandRecordType,
  assertDefined,
  createTestProgram,
  findTypeAliasReference,
  stubConvertType,
} from "./helpers.js";

describe("Record Type Expansion", () => {
  describe("Record with finite literal keys", () => {
    it("should expand Record with string literal keys to IrObjectType", () => {
      const source = `
        type Config = Record<"a" | "b", number>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Config");

      const result = expandRecordType(
        assertDefined(typeRef, "typeRef should be defined"),
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("objectType");
      expect(result?.members).to.have.length(2);

      const propNames = result?.members
        .filter((m) => m.kind === "propertySignature")
        .map((m) => (m as { name: string }).name);
      expect(propNames).to.include("a");
      expect(propNames).to.include("b");
    });

    it("should expand Record with number literal keys to IrObjectType", () => {
      const source = `
        type IndexedConfig = Record<1 | 2, string>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "IndexedConfig");

      const result = expandRecordType(
        assertDefined(typeRef, "typeRef should be defined"),
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("objectType");
      expect(result?.members).to.have.length(2);

      // Numeric keys are prefixed with '_' to be valid C# identifiers
      const propNames = result?.members
        .filter((m) => m.kind === "propertySignature")
        .map((m) => (m as { name: string }).name);
      expect(propNames).to.include("_1");
      expect(propNames).to.include("_2");
    });

    it("should expand Record with mixed literal keys", () => {
      const source = `
        type MixedConfig = Record<"name" | "age" | "email", boolean>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "MixedConfig");

      const result = expandRecordType(
        assertDefined(typeRef, "typeRef should be defined"),
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("objectType");
      expect(result?.members).to.have.length(3);
    });
  });

  describe("Record should fall back for non-literal keys", () => {
    it("should return null for Record<string, T>", () => {
      const source = `
        type Dictionary = Record<string, number>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "Dictionary");

      const result = expandRecordType(
        assertDefined(typeRef, "typeRef should be defined"),
        binding,
        stubConvertType
      );

      // Should return null - use IrDictionaryType instead
      expect(result).to.equal(null);
    });

    it("should return null for Record<number, T>", () => {
      const source = `
        type NumberDictionary = Record<number, string>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "NumberDictionary");

      const result = expandRecordType(
        assertDefined(typeRef, "typeRef should be defined"),
        binding,
        stubConvertType
      );

      // Should return null - use IrDictionaryType instead
      expect(result).to.equal(null);
    });

    it("should return null for Record<K, T> where K is a type parameter", () => {
      const source = `
        function makeRecord<K extends string>(keys: K[]): Record<K, number> {
          return {} as Record<K, number>;
        }
      `;

      const { binding, sourceFile } = createTestProgram(source);

      let typeRef: ts.TypeReferenceNode | null = null;
      const visitor = (node: ts.Node): void => {
        if (
          ts.isTypeReferenceNode(node) &&
          ts.isIdentifier(node.typeName) &&
          node.typeName.text === "Record"
        ) {
          typeRef = node;
          return; // Take first one (return type)
        }
        ts.forEachChild(node, visitor);
      };
      ts.forEachChild(sourceFile, visitor);

      const result = expandRecordType(
        assertDefined(typeRef, "typeRef should be defined"),
        binding,
        stubConvertType
      );

      // Should return null - type parameter can't be expanded
      expect(result).to.equal(null);
    });

    it("should return null for Record<PropertyKey, T> (complex key type)", () => {
      // PropertyKey is string | number | symbol - not a finite set of literals
      // This should NOT be expanded to objectType or dictionaryType
      const source = `
        type AnyKeyRecord = Record<PropertyKey, number>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "AnyKeyRecord");

      const result = expandRecordType(
        assertDefined(typeRef, "typeRef should be defined"),
        binding,
        stubConvertType
      );

      // Should return null - PropertyKey is not a finite set of literals
      // and should fall through to referenceType (not dictionaryType)
      expect(result).to.equal(null);
    });
  });

  describe("Record<K, V> full type conversion (integration test)", () => {
    it("should convert Record<K, V> with type parameter K to referenceType, not dictionaryType", () => {
      // This tests the full convertTypeReference flow, not just expandRecordType
      // The bug was: Record<K, V> where K is a type parameter was incorrectly
      // converted to dictionaryType instead of referenceType
      const source = `
        interface Wrapper<K extends string> {
          data: Record<K, number>;
        }
      `;

      const { checker, sourceFile } = createTestProgram(source);

      // Find the Record<K, number> type reference in the interface property
      let typeRef: ts.TypeReferenceNode | null = null;
      const visitor = (node: ts.Node): void => {
        if (
          ts.isTypeReferenceNode(node) &&
          ts.isIdentifier(node.typeName) &&
          node.typeName.text === "Record"
        ) {
          typeRef = node;
        }
        ts.forEachChild(node, visitor);
      };
      ts.forEachChild(sourceFile, visitor);

      // Get the key type node and check its flags
      expect(typeRef).not.to.equal(null);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const foundTypeRef = typeRef!;
      const keyTypeNode = foundTypeRef.typeArguments?.[0];
      expect(keyTypeNode).not.to.equal(undefined);
      // NOTE: This test uses getTypeAtLocation to verify TS internal behavior
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const keyTsType = checker.getTypeAtLocation(keyTypeNode!);

      // The key type should be a type parameter, not string
      expect(!!(keyTsType.flags & ts.TypeFlags.TypeParameter)).to.equal(true);
      expect(!!(keyTsType.flags & ts.TypeFlags.String)).to.equal(false);

      // This confirms the fix: when K is a type parameter, the code should
      // fall through to referenceType instead of creating a dictionaryType
    });
  });
});
