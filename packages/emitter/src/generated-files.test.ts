import { describe, it } from "mocha";
import { expect } from "chai";
import { generateRuntimeUnionFile } from "./generated-files.js";
import { createRuntimeUnionRegistry } from "./core/semantic/runtime-union-registry.js";
import { getOrRegisterRuntimeUnionCarrier } from "./core/semantic/runtime-union-registry.js";
import {
  identifierType,
  nullableType,
} from "./core/format/backend-ast/builders.js";

describe("generated-files", () => {
  it("keeps runtime union TryAs signatures on the exact slot type", () => {
    const registry = createRuntimeUnionRegistry();
    getOrRegisterRuntimeUnionCarrier(
      [nullableType(identifierType("object")), identifierType("string")],
      registry,
      {
        familyKey: "runtime-union:alias:Test.NullableCarrier",
        name: "NullableCarrier",
        namespaceName: "Test",
        typeParameters: [],
        definitionMemberTypeAsts: [
          nullableType(identifierType("object")),
          identifierType("string"),
        ],
        accessModifier: "public",
      }
    );

    const code = generateRuntimeUnionFile(registry);

    expect(code).to.include("public bool TryAs1(out object? value)");
    expect(code).to.not.include("object??");
  });

  it("strips top-level nullable suffixes from runtime union typeof diagnostics", () => {
    const registry = createRuntimeUnionRegistry();
    getOrRegisterRuntimeUnionCarrier(
      [nullableType(identifierType("object")), identifierType("string")],
      registry,
      {
        familyKey: "runtime-union:alias:Test.NullableCarrier",
        name: "NullableCarrier",
        namespaceName: "Test",
        typeParameters: [],
        definitionMemberTypeAsts: [
          nullableType(identifierType("object")),
          identifierType("string"),
        ],
        accessModifier: "public",
      }
    );

    const code = generateRuntimeUnionFile(registry);

    expect(code).to.include("typeof(object).Name");
    expect(code).to.not.include("typeof(object?).Name");
  });

  it("treats carrier-local qualified and unqualified definition members as the same source-owned carrier", () => {
    const registry = createRuntimeUnionRegistry();
    const metadata = {
      familyKey: "runtime-union:alias:Test.MiddlewareLike",
      name: "MiddlewareLike",
      namespaceName: "Test",
      typeParameters: [],
    };

    getOrRegisterRuntimeUnionCarrier(
      [identifierType("global::Test.Router"), identifierType("string")],
      registry,
      {
        ...metadata,
        definitionMemberTypeAsts: [identifierType("Router"), identifierType("string")],
        accessModifier: "internal",
      }
    );

    getOrRegisterRuntimeUnionCarrier(
      [identifierType("global::Test.Router"), identifierType("string")],
      registry,
      {
        ...metadata,
        definitionMemberTypeAsts: [
          identifierType("global::Test.Router"),
          identifierType("string"),
        ],
        accessModifier: "public",
      }
    );

    const definition = registry.definitionsByName.get("Test.MiddlewareLike");
    expect(definition?.accessModifier).to.equal("public");

    const code = generateRuntimeUnionFile(registry);
    expect(code).to.include("public static MiddlewareLike From1(Router value)");
  });

  it("upgrades recursive source-owned array members from storage-erased object arrays", () => {
    const registry = createRuntimeUnionRegistry();
    const metadata = {
      familyKey: "runtime-union:alias:Test.PathSpec",
      name: "PathSpec",
      namespaceName: "Test",
      typeParameters: [],
      accessModifier: "public" as const,
    };
    const erasedArrayMember = {
      kind: "arrayType" as const,
      rank: 1,
      elementType: identifierType("object"),
    };
    const recursiveArrayMember = {
      kind: "arrayType" as const,
      rank: 1,
      elementType: identifierType("global::Test.PathSpec"),
    };

    getOrRegisterRuntimeUnionCarrier(
      [erasedArrayMember, identifierType("string")],
      registry,
      {
        ...metadata,
        definitionMemberTypeAsts: [erasedArrayMember, identifierType("string")],
      }
    );
    getOrRegisterRuntimeUnionCarrier(
      [recursiveArrayMember, identifierType("string")],
      registry,
      {
        ...metadata,
        definitionMemberTypeAsts: [
          recursiveArrayMember,
          identifierType("string"),
        ],
      }
    );

    const code = generateRuntimeUnionFile(registry);
    expect(code).to.include(
      "public static PathSpec From1(global::Test.PathSpec[] value)"
    );
    expect(code).to.not.include("public static PathSpec From1(object[] value)");
  });
});
