import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "@tsonic/frontend";
import { createContext } from "../../emitter-types/context.js";
import type { EmitterContext } from "../../emitter-types/core.js";
import { areIrTypesEquivalent } from "./type-equivalence.js";

const context: EmitterContext = createContext({ rootNamespace: "Test" });

describe("type-equivalence", () => {
  it("treats union member order as irrelevant", () => {
    const left: IrType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "number" },
      ],
    };
    const right: IrType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "number" },
        { kind: "primitiveType", name: "string" },
      ],
    };

    expect(areIrTypesEquivalent(left, right, context)).to.equal(true);
  });

  it("compares object property signatures structurally", () => {
    const left: IrType = {
      kind: "objectType",
      members: [
        {
          kind: "propertySignature",
          name: "label",
          type: { kind: "primitiveType", name: "string" },
          isOptional: false,
          isReadonly: false,
        },
      ],
    };
    const right: IrType = {
      kind: "objectType",
      members: [
        {
          kind: "propertySignature",
          name: "label",
          type: { kind: "primitiveType", name: "string" },
          isOptional: false,
          isReadonly: false,
        },
      ],
    };

    expect(areIrTypesEquivalent(left, right, context)).to.equal(true);
  });

  it("uses comparable-type normalization before checking equivalence", () => {
    const aliasContext: EmitterContext = {
      ...createContext({ rootNamespace: "Test" }),
      localTypes: new Map([
        [
          "Alias",
          {
            kind: "typeAlias",
            typeParameters: [],
            type: { kind: "primitiveType", name: "string" },
          },
        ],
      ]),
    };

    const left: IrType = {
      kind: "referenceType",
      name: "out",
      typeArguments: [{ kind: "referenceType", name: "Alias" }],
    };
    const right: IrType = { kind: "primitiveType", name: "string" };

    expect(areIrTypesEquivalent(left, right, aliasContext)).to.equal(true);
  });

  it("canonicalizes CLR generic metadata names against emitted generic names", () => {
    const left: IrType = {
      kind: "referenceType",
      name: "Span",
      targetQualifiedName: "global::System.Span",
      typeArguments: [{ kind: "primitiveType", name: "int" }],
    };
    const right: IrType = {
      kind: "referenceType",
      name: "Span_1",
      targetQualifiedName: "System.Span`1",
      typeId: {
        stableId: "System.Private.CoreLib:System.Span`1",
        targetName: "System.Span`1",
        ownerIdentity: "System.Private.CoreLib",
        sourceName: "Span_1",
      },
      typeArguments: [{ kind: "primitiveType", name: "int" }],
    };

    expect(areIrTypesEquivalent(left, right, context)).to.equal(true);
  });

  it("canonicalizes emitted CLR generic surfaces before comparing identities", () => {
    const left: IrType = {
      kind: "referenceType",
      name: "Dictionary",
      targetQualifiedName:
        "global::System.Collections.Generic.Dictionary<string, int>",
      typeArguments: [
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "int" },
      ],
    };
    const right: IrType = {
      kind: "referenceType",
      name: "Dictionary_2",
      targetQualifiedName: "System.Collections.Generic.Dictionary`2",
      typeArguments: [
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "int" },
      ],
    };

    expect(areIrTypesEquivalent(left, right, context)).to.equal(true);
  });

  it("prefers proven nominal CLR identity over structural comparable shape", () => {
    const messageMember = {
      kind: "propertySignature" as const,
      name: "message",
      type: { kind: "primitiveType" as const, name: "string" as const },
      isOptional: false,
      isReadonly: false,
    };
    const narrowedBranchType: IrType = {
      kind: "referenceType",
      name: "Error",
      targetQualifiedName: "js.Error",
    };
    const sourceBackedBranchType: IrType = {
      kind: "referenceType",
      name: "Error",
      targetQualifiedName: "js.Error",
      structuralMembers: [messageMember],
      typeId: {
        stableId: "@tsonic/js:js.Error",
        targetName: "js.Error",
        ownerIdentity: "@tsonic/js",
        sourceName: "Error",
      },
    };

    expect(
      areIrTypesEquivalent(narrowedBranchType, sourceBackedBranchType, context)
    ).to.equal(true);
  });

  it("does not conflate distinct TypeIds that report the same CLR name", () => {
    const left: IrType = {
      kind: "referenceType",
      name: "Widget",
      typeId: {
        stableId: "package-a:Widget",
        targetName: "Acme.Widget",
        ownerIdentity: "PackageA",
        sourceName: "Widget",
      },
    };
    const right: IrType = {
      kind: "referenceType",
      name: "Widget",
      typeId: {
        stableId: "package-b:Widget",
        targetName: "Acme.Widget",
        ownerIdentity: "PackageB",
        sourceName: "Widget",
      },
    };

    expect(areIrTypesEquivalent(left, right, context)).to.equal(false);
  });

  it("does not compare nominal reference types by unqualified raw names", () => {
    const left: IrType = {
      kind: "referenceType",
      name: "Item",
    };
    const right: IrType = {
      kind: "referenceType",
      name: "Item",
    };

    expect(areIrTypesEquivalent(left, right, context)).to.equal(false);
  });

  it("rejects fully qualified nominal names when no deterministic identity is available", () => {
    const left: IrType = {
      kind: "referenceType",
      name: "Fixture.repo.Item",
    };
    const matching: IrType = {
      kind: "referenceType",
      name: "Fixture.repo.Item",
    };
    const different: IrType = {
      kind: "referenceType",
      name: "Fixture.domain.Item",
    };

    expect(areIrTypesEquivalent(left, matching, context)).to.equal(false);
    expect(areIrTypesEquivalent(left, different, context)).to.equal(false);
  });

  it("compares local nominal references through resolved module-qualified identity", () => {
    const localContext: EmitterContext = {
      ...createContext({ rootNamespace: "Test" }),
      moduleNamespace: "Feature",
      localTypes: new Map([
        [
          "Item",
          {
            kind: "class" as const,
            typeParameters: [],
            members: [],
            superClass: undefined,
            implements: [],
          },
        ],
      ]),
    };
    const left: IrType = {
      kind: "referenceType",
      name: "Item",
    };
    const right: IrType = {
      kind: "referenceType",
      name: "Item",
    };

    expect(areIrTypesEquivalent(left, right, localContext)).to.equal(true);
  });

  it("does not structurally conflate distinct local structural aliases", () => {
    const entryMembers = [
      {
        kind: "propertySignature" as const,
        name: "key",
        type: { kind: "typeParameterType" as const, name: "K" },
        isOptional: false,
        isReadonly: true,
      },
      {
        kind: "propertySignature" as const,
        name: "value",
        type: { kind: "typeParameterType" as const, name: "V" },
        isOptional: false,
        isReadonly: false,
      },
    ];
    const localContext: EmitterContext = {
      ...createContext({ rootNamespace: "Test" }),
      moduleNamespace: "js",
      typeParameters: new Set(["K", "V"]),
      localTypes: new Map([
        [
          "MapEntry",
          {
            kind: "typeAlias" as const,
            typeParameters: ["K", "V"],
            type: { kind: "objectType" as const, members: entryMembers },
          },
        ],
        [
          "WeakMapEntry",
          {
            kind: "typeAlias" as const,
            typeParameters: ["K", "V"],
            type: { kind: "objectType" as const, members: entryMembers },
          },
        ],
      ]),
    };
    const left: IrType = {
      kind: "referenceType",
      name: "MapEntry",
      typeArguments: [
        { kind: "typeParameterType", name: "K" },
        { kind: "typeParameterType", name: "V" },
      ],
    };
    const right: IrType = {
      kind: "referenceType",
      name: "WeakMapEntry",
      typeArguments: [
        { kind: "typeParameterType", name: "K" },
        { kind: "typeParameterType", name: "V" },
      ],
    };

    expect(areIrTypesEquivalent(left, right, localContext)).to.equal(false);
  });

  it("does not structurally conflate TypeId references with matching members", () => {
    const idMember = {
      kind: "propertySignature" as const,
      name: "id",
      type: { kind: "primitiveType" as const, name: "number" as const },
      isOptional: false,
      isReadonly: false,
    };
    const left: IrType = {
      kind: "arrayType",
      elementType: {
        kind: "referenceType",
        name: "Item",
        targetQualifiedName: "Fixture.repo.Item",
        typeId: {
          stableId: "@fixture/channels:Fixture.repo.Item",
          targetName: "Fixture.repo.Item",
          ownerIdentity: "@fixture/channels",
          sourceName: "Item",
        },
        structuralMembers: [idMember],
      },
    };
    const right: IrType = {
      kind: "arrayType",
      elementType: {
        kind: "referenceType",
        name: "Item",
        targetQualifiedName: "Fixture.domain.Item",
        typeId: {
          stableId: "@fixture/channels:Fixture.domain.Item",
          targetName: "Fixture.domain.Item",
          ownerIdentity: "@fixture/channels",
          sourceName: "Item",
        },
        structuralMembers: [idMember],
      },
    };

    expect(areIrTypesEquivalent(left, right, context)).to.equal(false);
  });

  it("does not conflate distinct comparable-type pairs on first comparison", () => {
    const left: IrType = {
      kind: "referenceType",
      name: "Uint8Array",
      targetQualifiedName: "js.Uint8Array",
    };
    const right: IrType = { kind: "primitiveType", name: "string" };

    expect(areIrTypesEquivalent(left, right, context)).to.equal(false);
  });

  it("handles recursive alias families without overflowing", () => {
    const recursiveContext: EmitterContext = {
      ...createContext({ rootNamespace: "Test" }),
      localTypes: new Map([
        [
          "Node",
          {
            kind: "typeAlias",
            typeParameters: [],
            type: {
              kind: "objectType",
              members: [
                {
                  kind: "propertySignature",
                  name: "next",
                  type: {
                    kind: "unionType",
                    types: [
                      { kind: "primitiveType", name: "undefined" },
                      { kind: "referenceType", name: "Node" },
                    ],
                  },
                  isOptional: false,
                  isReadonly: false,
                },
              ],
            },
          },
        ],
      ]),
    };

    const left: IrType = { kind: "referenceType", name: "Node" };
    const right: IrType = {
      kind: "objectType",
      members: [
        {
          kind: "propertySignature",
          name: "next",
          type: {
            kind: "unionType",
            types: [
              { kind: "primitiveType", name: "undefined" },
              { kind: "referenceType", name: "Node" },
            ],
          },
          isOptional: false,
          isReadonly: false,
        },
      ],
    };

    expect(() =>
      areIrTypesEquivalent(left, right, recursiveContext)
    ).to.not.throw();
    expect(areIrTypesEquivalent(left, right, recursiveContext)).to.equal(true);
  });

  it("compares runtime-union alias references against their carrier union by deterministic carrier identity", () => {
    const aliasTarget: IrType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "number" },
      ],
      runtimeUnionLayout: "carrierSlotOrder",
      runtimeCarrierFamilyKey: "Test.Result",
      runtimeCarrierName: "Result",
      runtimeCarrierNamespace: "Test",
      runtimeCarrierTypeParameters: ["T"],
      runtimeCarrierTypeArguments: [{ kind: "primitiveType", name: "boolean" }],
    };
    const aliasContext: EmitterContext = {
      ...createContext({ rootNamespace: "Test" }),
      localTypes: new Map([
        [
          "Result",
          {
            kind: "typeAlias",
            typeParameters: ["T"],
            type: aliasTarget,
          },
        ],
      ]),
    };
    const aliasRef: IrType = {
      kind: "referenceType",
      name: "Result",
      typeArguments: [{ kind: "primitiveType", name: "boolean" }],
    };

    expect(areIrTypesEquivalent(aliasRef, aliasTarget, aliasContext)).to.equal(
      true
    );
  });
});
