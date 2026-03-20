import {
  describe,
  it,
  expect,
  expandUtilityType,
  assertDefined,
  createTestProgram,
  findTypeAliasReference,
  stubConvertType,
} from "./helpers.js";

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
