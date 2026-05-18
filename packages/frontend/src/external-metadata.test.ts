import { describe, it } from "mocha";
import { expect } from "chai";
import {
  ExternalMetadataRegistry,
  externalSignatureTypeKey,
} from "./external-metadata.js";
import type { IrParameter, IrType } from "./ir/types/index.js";
import { typeSymbolIdFromStableId } from "./symbols/index.js";

describe("ExternalMetadataRegistry", () => {
  const param = (type: IrType, passing: IrParameter["passing"] = "value") =>
    ({
      kind: "parameter",
      pattern: { kind: "identifierPattern", name: "value", type },
      type,
      isOptional: false,
      isRest: false,
      passing,
    }) satisfies IrParameter;

  it("matches external overloads by semantic parameter types (not just arity)", () => {
    const registry = new ExternalMetadataRegistry();
    const charType = { kind: "primitiveType" as const, name: "char" as const };
    const stringType = {
      kind: "primitiveType" as const,
      name: "string" as const,
    };

    registry.loadBindingsFile("fake", {
      namespace: "Test",
      types: [
        {
          targetName: "Test.Base",
          kind: "Class",
          methods: [
            {
              targetName: "Write",
              parameterCount: 1,
              semanticSignature: {
                parameters: [param(charType)],
                returnType: { kind: "voidType" },
              },
              isVirtual: true,
              isStatic: false,
              visibility: "Public",
            },
            {
              targetName: "Write",
              parameterCount: 1,
              semanticSignature: {
                parameters: [param(stringType)],
                returnType: { kind: "voidType" },
              },
              isVirtual: true,
              isStatic: false,
              visibility: "Public",
            },
          ],
          properties: [],
        },
      ],
    });

    expect(registry.getMethodOverloadCount("Test.Base", "Write", 1)).to.equal(
      2
    );

    const charMeta = registry.getMethodMetadata(
      "Test.Base",
      "Write",
      [externalSignatureTypeKey(charType) ?? ""],
      ""
    );
    expect(charMeta?.virtual).to.equal(true);

    const stringMeta = registry.getMethodMetadata(
      "Test.Base",
      "Write",
      [externalSignatureTypeKey(stringType) ?? ""],
      ""
    );
    expect(stringMeta?.virtual).to.equal(true);
  });

  it("includes parameter modifiers in overload matching (ref/out/in)", () => {
    const registry = new ExternalMetadataRegistry();
    const intType = { kind: "primitiveType" as const, name: "int" as const };

    registry.loadBindingsFile("fake", {
      namespace: "Test",
      types: [
        {
          targetName: "Test.Base",
          kind: "Class",
          methods: [
            {
              targetName: "TryGet",
              parameterCount: 1,
              semanticSignature: {
                parameters: [param(intType, "out")],
                returnType: { kind: "primitiveType", name: "boolean" },
              },
              isVirtual: true,
              isStatic: false,
              visibility: "Public",
              parameterModifiers: [{ index: 0, modifier: "out" }],
            },
            {
              targetName: "TryGet",
              parameterCount: 1,
              semanticSignature: {
                parameters: [param(intType, "ref")],
                returnType: { kind: "primitiveType", name: "boolean" },
              },
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

    expect(registry.getMethodOverloadCount("Test.Base", "TryGet", 1)).to.equal(
      2
    );

    const outMeta = registry.getMethodMetadata(
      "Test.Base",
      "TryGet",
      [externalSignatureTypeKey(intType) ?? ""],
      "0:out"
    );
    expect(outMeta?.virtual).to.equal(true);

    const refMeta = registry.getMethodMetadata(
      "Test.Base",
      "TryGet",
      [externalSignatureTypeKey(intType) ?? ""],
      "0:ref"
    );
    expect(refMeta?.virtual).to.equal(true);
  });

  it("resolves members through the base type chain (override/shadow detection)", () => {
    const registry = new ExternalMetadataRegistry();

    registry.loadBindingsFile("fake", {
      namespace: "Test",
      types: [
        {
          targetName: "Test.Base",
          kind: "Class",
          methods: [
            {
              targetName: "Dispose",
              parameterCount: 0,
              semanticSignature: {
                parameters: [],
                returnType: { kind: "voidType" },
              },
              isVirtual: false,
              isStatic: false,
              visibility: "Public",
            },
          ],
          properties: [
            {
              targetName: "Count",
              isStatic: false,
              isVirtual: false,
              visibility: "Public",
            },
          ],
        },
        {
          targetName: "Test.Derived",
          kind: "Class",
          baseType: { targetName: "Test.Base" },
          methods: [],
          properties: [],
        },
      ],
    });

    const disposeMeta = registry.getMethodMetadata(
      "Test.Derived",
      "Dispose",
      [],
      ""
    );
    expect(disposeMeta?.virtual).to.equal(false);

    const countMeta = registry.getPropertyMetadata("Test.Derived", "Count");
    expect(countMeta?.kind).to.equal("property");
  });

  it("matches canonical target signatures against reference types with local ids", () => {
    const registry = new ExternalMetadataRegistry();

    registry.loadBindingsFile("fake", {
      namespace: "Provider",
      types: [
        {
          targetName: "Provider.Base",
          kind: "Class",
          methods: [
            {
              targetName: "Configure",
              parameterCount: 1,
              canonicalSignature: "(Provider.Builder):System.Void",
              isVirtual: true,
              isStatic: false,
              visibility: "ProtectedInternal",
            },
          ],
          properties: [],
        },
      ],
    });

    const builderType: IrType = {
      kind: "referenceType",
      name: "Builder",
      providerQualifiedName: "Provider.Builder",
      typeId: {
        symbolId: typeSymbolIdFromStableId("local-test:builder-symbol"),
        providerName: "Provider.Builder",
        stableId: "local-test:builder-symbol",
        sourceName: "Builder",
        ownerIdentity: "local-test",
      },
    };

    const meta = registry.getMethodMetadata(
      "Provider.Base",
      "Configure",
      [externalSignatureTypeKey(builderType) ?? ""],
      ""
    );

    expect(meta?.virtual).to.equal(true);
    expect(meta?.visibility).to.equal("protected internal");
  });
});
