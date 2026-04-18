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
});
