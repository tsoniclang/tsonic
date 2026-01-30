import { describe, it } from "mocha";
import { expect } from "chai";
import { DotnetMetadataRegistry } from "./dotnet-metadata.js";

describe("DotnetMetadataRegistry", () => {
  it("matches CLR overloads by parameter types (not just arity)", () => {
    const registry = new DotnetMetadataRegistry();

    registry.loadBindingsFile("fake", {
      namespace: "Test",
      types: [
        {
          clrName: "Test.Base",
          kind: "Class",
          methods: [
            {
              clrName: "Write",
              parameterCount: 1,
              canonicalSignature: "(System.Char):System.Void",
              isVirtual: true,
              isStatic: false,
              visibility: "Public",
            },
            {
              clrName: "Write",
              parameterCount: 1,
              canonicalSignature: "(System.String):System.Void",
              isVirtual: true,
              isStatic: false,
              visibility: "Public",
            },
          ],
          properties: [],
        },
      ],
    });

    expect(registry.getMethodOverloadCount("Test.Base", "Write", 1)).to.equal(2);

    const charMeta = registry.getMethodMetadata(
      "Test.Base",
      "Write",
      ["System.Char"],
      ""
    );
    expect(charMeta?.virtual).to.equal(true);

    const stringMeta = registry.getMethodMetadata(
      "Test.Base",
      "Write",
      ["System.String"],
      ""
    );
    expect(stringMeta?.virtual).to.equal(true);
  });

  it("includes parameter modifiers in overload matching (ref/out/in)", () => {
    const registry = new DotnetMetadataRegistry();

    registry.loadBindingsFile("fake", {
      namespace: "Test",
      types: [
        {
          clrName: "Test.Base",
          kind: "Class",
          methods: [
            {
              clrName: "TryGet",
              parameterCount: 1,
              canonicalSignature: "(System.Int32&):System.Boolean",
              isVirtual: true,
              isStatic: false,
              visibility: "Public",
              parameterModifiers: [{ index: 0, modifier: "out" }],
            },
            {
              clrName: "TryGet",
              parameterCount: 1,
              canonicalSignature: "(System.Int32&):System.Boolean",
              isVirtual: true,
              isStatic: false,
              visibility: "Public",
              parameterModifiers: [{ index: 0, modifier: "ref" }],
            },
          ],
          properties: [],
        },
      ],
    });

    expect(registry.getMethodOverloadCount("Test.Base", "TryGet", 1)).to.equal(2);

    const outMeta = registry.getMethodMetadata(
      "Test.Base",
      "TryGet",
      ["System.Int32&"],
      "0:out"
    );
    expect(outMeta?.virtual).to.equal(true);

    const refMeta = registry.getMethodMetadata(
      "Test.Base",
      "TryGet",
      ["System.Int32&"],
      "0:ref"
    );
    expect(refMeta?.virtual).to.equal(true);
  });

  it("resolves members through the base type chain (override/shadow detection)", () => {
    const registry = new DotnetMetadataRegistry();

    registry.loadBindingsFile("fake", {
      namespace: "Test",
      types: [
        {
          clrName: "Test.Base",
          kind: "Class",
          methods: [
            {
              clrName: "Dispose",
              parameterCount: 0,
              canonicalSignature: "():System.Void",
              isVirtual: false,
              isStatic: false,
              visibility: "Public",
            },
          ],
          properties: [
            {
              clrName: "Count",
              isStatic: false,
              isVirtual: false,
              visibility: "Public",
            },
          ],
        },
        {
          clrName: "Test.Derived",
          kind: "Class",
          baseType: { clrName: "Test.Base" },
          methods: [],
          properties: [],
        },
      ],
    });

    const disposeMeta = registry.getMethodMetadata("Test.Derived", "Dispose", [], "");
    expect(disposeMeta?.virtual).to.equal(false);

    const countMeta = registry.getPropertyMetadata("Test.Derived", "Count");
    expect(countMeta?.kind).to.equal("property");
  });
});
