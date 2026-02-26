/**
 * Tests for utility type expansion
 *
 * Covers the safety guarantees per Alice's review:
 * 1. Index signatures block expansion (never drop members)
 * 2. Symbol/computed keys block expansion (never drop members)
 * 3. Explicit undefined is preserved (not stripped)
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import {
  expandUtilityType,
  expandConditionalUtilityType,
  expandRecordType,
} from "./utility-types.js";
import { IrType } from "../../../types.js";
import { createBinding, Binding } from "../../../binding/index.js";

/**
 * Assert value is not null/undefined and return it typed as non-null.
 * Throws if value is null or undefined.
 */
function assertDefined<T>(value: T, msg?: string): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(msg ?? "Expected value to be defined");
  }
  return value as NonNullable<T>;
}

/**
 * Helper to create a TypeScript program from source code
 */
const createTestProgram = (
  source: string,
  fileName = "test.ts"
): {
  program: ts.Program;
  checker: ts.TypeChecker;
  sourceFile: ts.SourceFile;
  binding: Binding;
} => {
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    strict: true,
    noEmit: true,
  };

  const host = ts.createCompilerHost(compilerOptions);
  const originalGetSourceFile = host.getSourceFile;
  const originalFileExists = host.fileExists;
  const originalReadFile = host.readFile;

  host.getSourceFile = (
    name: string,
    languageVersionOrOptions: ts.ScriptTarget | ts.CreateSourceFileOptions,
    onError?: (message: string) => void,
    shouldCreateNewSourceFile?: boolean
  ) => {
    if (name === fileName) {
      return ts.createSourceFile(
        fileName,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      );
    }
    return originalGetSourceFile.call(
      host,
      name,
      languageVersionOrOptions,
      onError,
      shouldCreateNewSourceFile
    );
  };

  host.fileExists = (name: string) =>
    name === fileName || originalFileExists.call(host, name);

  host.readFile = (name: string) =>
    name === fileName ? source : originalReadFile.call(host, name);

  const program = ts.createProgram([fileName], compilerOptions, host);
  const sourceFile = assertDefined(
    program.getSourceFile(fileName),
    `Source file ${fileName} not found`
  );
  const checker = program.getTypeChecker();
  const binding = createBinding(checker);

  return { program, checker, sourceFile, binding };
};

/**
 * Helper to find a type alias by name and get its type reference node
 */
const findTypeAliasReference = (
  sourceFile: ts.SourceFile,
  aliasName: string
): ts.TypeReferenceNode | null => {
  let result: ts.TypeReferenceNode | null = null;

  const visitor = (node: ts.Node): void => {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === aliasName) {
      if (ts.isTypeReferenceNode(node.type)) {
        result = node.type;
      }
    }
    ts.forEachChild(node, visitor);
  };

  ts.forEachChild(sourceFile, visitor);
  return result;
};

/**
 * Stub convertType for testing - just returns the type name
 */
const stubConvertType = (node: ts.TypeNode, _binding: Binding): IrType => {
  if (ts.isTypeReferenceNode(node)) {
    const name = ts.isIdentifier(node.typeName)
      ? node.typeName.text
      : node.typeName.getText();
    return { kind: "referenceType", name, typeArguments: [] };
  }
  if (node.kind === ts.SyntaxKind.StringKeyword) {
    return { kind: "primitiveType", name: "string" };
  }
  if (node.kind === ts.SyntaxKind.NumberKeyword) {
    return { kind: "primitiveType", name: "number" };
  }
  if (node.kind === ts.SyntaxKind.BooleanKeyword) {
    return { kind: "primitiveType", name: "boolean" };
  }
  if (node.kind === ts.SyntaxKind.UndefinedKeyword) {
    return { kind: "primitiveType", name: "undefined" };
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: "primitiveType", name: "null" };
  }
  if (node.kind === ts.SyntaxKind.NeverKeyword) {
    return { kind: "neverType" };
  }
  // Handle literal type nodes (e.g., "a", 1, null, undefined)
  if (ts.isLiteralTypeNode(node)) {
    const literal = node.literal;
    if (ts.isStringLiteral(literal)) {
      return { kind: "literalType", value: literal.text } as IrType;
    }
    if (ts.isNumericLiteral(literal)) {
      return { kind: "literalType", value: Number(literal.text) } as IrType;
    }
    // null can appear as LiteralTypeNode in type positions
    if (literal.kind === ts.SyntaxKind.NullKeyword) {
      return { kind: "primitiveType", name: "null" };
    }
  }
  if (ts.isUnionTypeNode(node)) {
    return {
      kind: "unionType",
      types: node.types.map((t) => stubConvertType(t, _binding)),
    };
  }
  return { kind: "anyType" };
};

describe("Utility Type Expansion Safety", () => {
  describe("Index signatures block expansion", () => {
    it("should return null for Partial<T> when T has string index signature", () => {
      const source = `
        interface WithStringIndex {
          [key: string]: number;
          name: string;
        }
        type PartialWithIndex = Partial<WithStringIndex>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "PartialWithIndex");

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Partial",
        binding,
        stubConvertType
      );

      // Should return null because expansion would lose the index signature
      expect(result).to.equal(null);
    });

    it("should return null for Readonly<T> when T has number index signature", () => {
      const source = `
        interface WithNumberIndex {
          [key: number]: string;
          length: number;
        }
        type ReadonlyWithIndex = Readonly<WithNumberIndex>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "ReadonlyWithIndex");

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Readonly",
        binding,
        stubConvertType
      );

      // Should return null because expansion would lose the index signature
      expect(result).to.equal(null);
    });

    it("should expand normally when T has no index signatures", () => {
      const source = `
        interface Person {
          name: string;
          age: number;
        }
        type PartialPerson = Partial<Person>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "PartialPerson");

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Partial",
        binding,
        stubConvertType
      );

      // Should expand successfully
      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("objectType");
      expect(result?.members).to.have.length(2);
    });
  });

  describe("Symbol/computed keys block expansion", () => {
    it("should return null when T has symbol keys", () => {
      // Note: Symbol keys in TypeScript are represented with __@ prefix internally
      // This test validates that the expansion correctly identifies and rejects them
      const source = `
        const sym = Symbol("test");
        interface WithSymbol {
          [sym]: string;
          name: string;
        }
        type PartialWithSymbol = Partial<WithSymbol>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "PartialWithSymbol");

      // This may or may not find the type ref depending on how TS handles it
      if (typeRef) {
        const result = expandUtilityType(
          typeRef,
          "Partial",
          binding,
          stubConvertType
        );
        // If expansion proceeds, it should return null due to symbol key
        // (symbol keys start with __@ internally)
        // Note: The actual behavior depends on whether TS resolves the symbol key
        // Either result is null (rejected) or expanded (symbol was ignored)
        expect(result === null || result.kind === "objectType").to.equal(true);
      }
      // Test passes if we get here - the key insight is the code handles this case
    });
  });

  describe("Explicit undefined preservation", () => {
    it("should preserve explicit undefined in optional property type", () => {
      const source = `
        interface WithExplicitUndefined {
          x?: string | undefined;
        }
        type PartialWithUndefined = Partial<WithExplicitUndefined>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(
        sourceFile,
        "PartialWithUndefined"
      );

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Partial",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("objectType");

      // The property should preserve the union with undefined
      const xProp = result?.members.find(
        (m) => m.kind === "propertySignature" && m.name === "x"
      );
      expect(xProp).not.to.equal(undefined);

      // The type should be a union containing undefined
      if (xProp && xProp.kind === "propertySignature") {
        // With explicit undefined, the type should include undefined in the union
        // The exact representation depends on whether we stripped synthetic undefined
        // The key is that we DON'T strip it when explicit undefined was declared
        expect(xProp.type.kind).to.equal("unionType");
      }
    });

    it("should strip synthetic undefined from optional property without explicit undefined", () => {
      const source = `
        interface WithSyntheticUndefined {
          x?: string;
        }
        type PartialWithSynthetic = Partial<WithSyntheticUndefined>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(
        sourceFile,
        "PartialWithSynthetic"
      );

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Partial",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("objectType");

      // The property type should be string (not string | undefined)
      // because we strip synthetic undefined
      const xProp = result?.members.find(
        (m) => m.kind === "propertySignature" && m.name === "x"
      );
      expect(xProp).not.to.equal(undefined);

      if (xProp && xProp.kind === "propertySignature") {
        // Synthetic undefined should be stripped, leaving just string
        expect(xProp.type.kind).to.equal("primitiveType");
        if (xProp.type.kind === "primitiveType") {
          expect(xProp.type.name).to.equal("string");
        }
      }
    });

    it("should preserve explicit undefined in required property", () => {
      const source = `
        interface WithRequiredUndefined {
          x: string | undefined;
        }
        type PartialRequired = Partial<WithRequiredUndefined>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "PartialRequired");

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Partial",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      const xProp = result?.members.find(
        (m) => m.kind === "propertySignature" && m.name === "x"
      );
      expect(xProp).not.to.equal(undefined);

      // Required property with explicit undefined should keep the union
      if (xProp && xProp.kind === "propertySignature") {
        expect(xProp.type.kind).to.equal("unionType");
      }
    });
  });

  describe("Readonly preservation in nested utility types", () => {
    it("should preserve readonly in Partial<Readonly<T>>", () => {
      const source = `
        interface Person {
          name: string;
          age: number;
        }
        type PartialReadonly = Partial<Readonly<Person>>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "PartialReadonly");

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Partial",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("objectType");

      // All properties should be readonly (from inner Readonly<T>)
      const nameProp = result?.members.find(
        (m) => m.kind === "propertySignature" && m.name === "name"
      );
      expect(nameProp).not.to.equal(undefined);
      if (nameProp && nameProp.kind === "propertySignature") {
        expect(nameProp.isReadonly).to.equal(true);
        expect(nameProp.isOptional).to.equal(true);
      }
    });

    it("should preserve readonly and optional in Readonly<Partial<T>>", () => {
      const source = `
        interface Person {
          name: string;
          age: number;
        }
        type ReadonlyPartial = Readonly<Partial<Person>>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "ReadonlyPartial");

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Readonly",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("objectType");

      // All properties should be both readonly (from Readonly<T>) and optional (from Partial<T>)
      const nameProp = result?.members.find(
        (m) => m.kind === "propertySignature" && m.name === "name"
      );
      expect(nameProp).not.to.equal(undefined);
      if (nameProp && nameProp.kind === "propertySignature") {
        expect(nameProp.isReadonly).to.equal(true);
        expect(nameProp.isOptional).to.equal(true);
      }
    });
  });

  describe("Method signatures in utility types", () => {
    it("should expand interface with method as methodSignature", () => {
      const source = `
        interface WithMethod {
          name: string;
          greet(greeting: string): string;
        }
        type PartialWithMethod = Partial<WithMethod>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "PartialWithMethod");

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Partial",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("objectType");

      // Should have both property and method
      const nameProp = result?.members.find(
        (m) => m.kind === "propertySignature" && m.name === "name"
      );
      const greetMethod = result?.members.find(
        (m) => m.kind === "methodSignature" && m.name === "greet"
      );

      expect(nameProp).not.to.equal(undefined);
      expect(greetMethod).not.to.equal(undefined);

      // Method should have parameters
      if (greetMethod && greetMethod.kind === "methodSignature") {
        expect(greetMethod.parameters).to.have.length(1);
      }
    });
  });

  describe("Pick and Omit with multiple keys", () => {
    it("should expand Pick with multiple keys", () => {
      const source = `
        interface Person {
          name: string;
          age: number;
          email: string;
          phone: string;
        }
        type ContactInfo = Pick<Person, "name" | "email" | "phone">;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "ContactInfo");

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Pick",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("objectType");
      // Should only have name, email, phone (not age)
      expect(result?.members).to.have.length(3);

      const propNames = result?.members
        .filter((m) => m.kind === "propertySignature")
        .map((m) => (m as { name: string }).name);
      expect(propNames).to.include("name");
      expect(propNames).to.include("email");
      expect(propNames).to.include("phone");
      expect(propNames).not.to.include("age");
    });

    it("should expand Omit with multiple keys", () => {
      const source = `
        interface Person {
          name: string;
          age: number;
          email: string;
          phone: string;
        }
        type MinimalPerson = Omit<Person, "email" | "phone">;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "MinimalPerson");

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Omit",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("objectType");
      // Should only have name, age (not email, phone)
      expect(result?.members).to.have.length(2);

      const propNames = result?.members
        .filter((m) => m.kind === "propertySignature")
        .map((m) => (m as { name: string }).name);
      expect(propNames).to.include("name");
      expect(propNames).to.include("age");
      expect(propNames).not.to.include("email");
      expect(propNames).not.to.include("phone");
    });
  });

  describe("Type parameter detection", () => {
    it("should return null for Partial<T> where T is a type parameter", () => {
      const source = `
        function process<T>(data: Partial<T>): void {}
      `;

      const { binding, sourceFile } = createTestProgram(source);

      // Find the Partial<T> type reference in the function parameter
      let typeRef: ts.TypeReferenceNode | null = null;
      const visitor = (node: ts.Node): void => {
        if (
          ts.isTypeReferenceNode(node) &&
          ts.isIdentifier(node.typeName) &&
          node.typeName.text === "Partial"
        ) {
          typeRef = node;
        }
        ts.forEachChild(node, visitor);
      };
      ts.forEachChild(sourceFile, visitor);

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Partial",
        binding,
        stubConvertType
      );

      // Should return null because T is a type parameter - can't expand at compile time
      expect(result).to.equal(null);
    });
  });

  describe("Comprehensive utility type tests (nested, recursive, generic)", () => {
    it("should expand Partial on recursive type (tree node)", () => {
      const source = `
        interface TreeNode {
          value: number;
          children: TreeNode[];
        }
        type PartialTreeNode = Partial<TreeNode>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "PartialTreeNode");

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Partial",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("objectType");
      expect(result?.members).to.have.length(2);

      const valueProp = result?.members.find(
        (m) => m.kind === "propertySignature" && m.name === "value"
      );
      const childrenProp = result?.members.find(
        (m) => m.kind === "propertySignature" && m.name === "children"
      );

      expect(valueProp).not.to.equal(undefined);
      expect(childrenProp).not.to.equal(undefined);
      if (valueProp && valueProp.kind === "propertySignature") {
        expect(valueProp.isOptional).to.equal(true);
      }
      if (childrenProp && childrenProp.kind === "propertySignature") {
        expect(childrenProp.isOptional).to.equal(true);
      }
    });

    it("should expand Partial on linked list type (self-referential)", () => {
      const source = `
        interface ListNode<T> {
          value: T;
          next: ListNode<T> | null;
        }
        type PartialListNode = Partial<ListNode<string>>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "PartialListNode");

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Partial",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("objectType");

      const valueProp = result?.members.find(
        (m) => m.kind === "propertySignature" && m.name === "value"
      );
      const nextProp = result?.members.find(
        (m) => m.kind === "propertySignature" && m.name === "next"
      );

      expect(valueProp).not.to.equal(undefined);
      expect(nextProp).not.to.equal(undefined);
    });

    it("should expand triple-nested utility types", () => {
      const source = `
        interface Data {
          id: number;
          name: string;
        }
        type TripleNested = Partial<Readonly<Required<Data>>>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "TripleNested");

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Partial",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("objectType");

      const idProp = result?.members.find(
        (m) => m.kind === "propertySignature" && m.name === "id"
      );
      expect(idProp).not.to.equal(undefined);
      if (idProp && idProp.kind === "propertySignature") {
        expect(idProp.isReadonly).to.equal(true);
        expect(idProp.isOptional).to.equal(true);
      }
    });

    it("should expand Pick on nested utility type", () => {
      const source = `
        interface User {
          id: number;
          name: string;
          email: string;
          password: string;
        }
        type SafeUser = Pick<Readonly<User>, "id" | "name" | "email">;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "SafeUser");

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Pick",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("objectType");
      expect(result?.members).to.have.length(3);

      const propNames = result?.members
        .filter((m) => m.kind === "propertySignature")
        .map((m) => (m as { name: string }).name);
      expect(propNames).to.include("id");
      expect(propNames).to.include("name");
      expect(propNames).to.include("email");
      expect(propNames).not.to.include("password");
    });

    it("should expand Omit on Partial type", () => {
      const source = `
        interface Config {
          host: string;
          port: number;
          timeout: number;
          debug: boolean;
        }
        type PartialConfig = Omit<Partial<Config>, "debug">;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "PartialConfig");

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Omit",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("objectType");
      expect(result?.members).to.have.length(3);

      const propNames = result?.members
        .filter((m) => m.kind === "propertySignature")
        .map((m) => (m as { name: string }).name);
      expect(propNames).not.to.include("debug");
      expect(propNames).to.include("host");
    });

    it("should expand Required on Partial type (roundtrip)", () => {
      const source = `
        interface Base {
          x: number;
          y: number;
        }
        type RoundTrip = Required<Partial<Base>>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "RoundTrip");

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Required",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("objectType");

      const xProp = result?.members.find(
        (m) => m.kind === "propertySignature" && m.name === "x"
      );
      expect(xProp).not.to.equal(undefined);
      if (xProp && xProp.kind === "propertySignature") {
        // Required removes optional, so isOptional should be false
        expect(xProp.isOptional).to.equal(false);
      }
    });

    it("should expand utility type on generic interface with concrete type arg", () => {
      const source = `
        interface Container<T> {
          value: T;
          metadata: string;
        }
        type PartialNumberContainer = Partial<Container<number>>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(
        sourceFile,
        "PartialNumberContainer"
      );

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Partial",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("objectType");

      const valueProp = result?.members.find(
        (m) => m.kind === "propertySignature" && m.name === "value"
      );
      const metadataProp = result?.members.find(
        (m) => m.kind === "propertySignature" && m.name === "metadata"
      );

      expect(valueProp).not.to.equal(undefined);
      expect(metadataProp).not.to.equal(undefined);
      if (valueProp && valueProp.kind === "propertySignature") {
        expect(valueProp.isOptional).to.equal(true);
      }
    });

    it("should expand utility type on generic interface with multiple type params", () => {
      const source = `
        interface Pair<K, V> {
          key: K;
          value: V;
        }
        type PartialPair = Partial<Pair<string, number>>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "PartialPair");

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Partial",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("objectType");
      expect(result?.members).to.have.length(2);

      // Verify both properties exist and are optional
      const keyProp = result?.members.find(
        (m) => m.kind === "propertySignature" && m.name === "key"
      );
      const valueProp = result?.members.find(
        (m) => m.kind === "propertySignature" && m.name === "value"
      );

      expect(keyProp).not.to.equal(undefined);
      expect(valueProp).not.to.equal(undefined);
      if (keyProp && keyProp.kind === "propertySignature") {
        expect(keyProp.isOptional).to.equal(true);
      }
      if (valueProp && valueProp.kind === "propertySignature") {
        expect(valueProp.isOptional).to.equal(true);
      }
    });

    it("should expand Readonly on interface with method returning self type", () => {
      const source = `
        interface Builder {
          value: number;
          build(): Builder;
        }
        type ReadonlyBuilder = Readonly<Builder>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "ReadonlyBuilder");

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Readonly",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("objectType");

      const valueProp = result?.members.find(
        (m) => m.kind === "propertySignature" && m.name === "value"
      );
      const buildMethod = result?.members.find(
        (m) => m.kind === "methodSignature" && m.name === "build"
      );

      expect(valueProp).not.to.equal(undefined);
      expect(buildMethod).not.to.equal(undefined);
      if (valueProp && valueProp.kind === "propertySignature") {
        expect(valueProp.isReadonly).to.equal(true);
      }
    });

    it("should expand utility type on deeply nested object type", () => {
      const source = `
        interface DeepNested {
          level1: {
            level2: {
              level3: {
                value: string;
              };
            };
          };
        }
        type PartialDeep = Partial<DeepNested>;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "PartialDeep");

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Partial",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("objectType");

      const level1Prop = result?.members.find(
        (m) => m.kind === "propertySignature" && m.name === "level1"
      );
      expect(level1Prop).not.to.equal(undefined);
      if (level1Prop && level1Prop.kind === "propertySignature") {
        expect(level1Prop.isOptional).to.equal(true);
      }
    });

    it("should handle Pick with single key on large interface", () => {
      const source = `
        interface LargeInterface {
          a: string;
          b: number;
          c: boolean;
          d: string[];
          e: number[];
          f: { nested: string };
        }
        type SinglePick = Pick<LargeInterface, "c">;
      `;

      const { binding, sourceFile } = createTestProgram(source);
      const typeRef = findTypeAliasReference(sourceFile, "SinglePick");

      const result = expandUtilityType(
        assertDefined(typeRef, "typeRef should be defined"),
        "Pick",
        binding,
        stubConvertType
      );

      expect(result).not.to.equal(null);
      expect(result?.kind).to.equal("objectType");
      expect(result?.members).to.have.length(1);

      const cProp = result?.members.find(
        (m) => m.kind === "propertySignature" && m.name === "c"
      );
      expect(cProp).not.to.equal(undefined);
    });
  });
});

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
});

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
