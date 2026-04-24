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
      resolvedClrType: "global::System.Span",
      typeArguments: [{ kind: "primitiveType", name: "int" }],
    };
    const right: IrType = {
      kind: "referenceType",
      name: "Span_1",
      resolvedClrType: "System.Span`1",
      typeId: {
        stableId: "System.Private.CoreLib:System.Span`1",
        clrName: "System.Span`1",
        assemblyName: "System.Private.CoreLib",
        tsName: "Span_1",
      },
      typeArguments: [{ kind: "primitiveType", name: "int" }],
    };

    expect(areIrTypesEquivalent(left, right, context)).to.equal(true);
  });

  it("canonicalizes emitted CLR generic surfaces before comparing identities", () => {
    const left: IrType = {
      kind: "referenceType",
      name: "Dictionary",
      resolvedClrType: "global::System.Collections.Generic.Dictionary<string, int>",
      typeArguments: [
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "int" },
      ],
    };
    const right: IrType = {
      kind: "referenceType",
      name: "Dictionary_2",
      resolvedClrType: "System.Collections.Generic.Dictionary`2",
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
      resolvedClrType: "js.Error",
    };
    const sourceBackedBranchType: IrType = {
      kind: "referenceType",
      name: "Error",
      resolvedClrType: "js.Error",
      structuralMembers: [messageMember],
      typeId: {
        stableId: "@tsonic/js:js.Error",
        clrName: "js.Error",
        assemblyName: "@tsonic/js",
        tsName: "Error",
      },
    };

    expect(
      areIrTypesEquivalent(
        narrowedBranchType,
        sourceBackedBranchType,
        context
      )
    ).to.equal(true);
  });

  it("does not conflate distinct TypeIds that report the same CLR name", () => {
    const left: IrType = {
      kind: "referenceType",
      name: "Widget",
      typeId: {
        stableId: "package-a:Widget",
        clrName: "Acme.Widget",
        assemblyName: "PackageA",
        tsName: "Widget",
      },
    };
    const right: IrType = {
      kind: "referenceType",
      name: "Widget",
      typeId: {
        stableId: "package-b:Widget",
        clrName: "Acme.Widget",
        assemblyName: "PackageB",
        tsName: "Widget",
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
        resolvedClrType: "Fixture.repo.Item",
        typeId: {
          stableId: "@fixture/channels:Fixture.repo.Item",
          clrName: "Fixture.repo.Item",
          assemblyName: "@fixture/channels",
          tsName: "Item",
        },
        structuralMembers: [idMember],
      },
    };
    const right: IrType = {
      kind: "arrayType",
      elementType: {
        kind: "referenceType",
        name: "Item",
        resolvedClrType: "Fixture.domain.Item",
        typeId: {
          stableId: "@fixture/channels:Fixture.domain.Item",
          clrName: "Fixture.domain.Item",
          assemblyName: "@fixture/channels",
          tsName: "Item",
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
      resolvedClrType: "js.Uint8Array",
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

    expect(() => areIrTypesEquivalent(left, right, recursiveContext)).to.not.throw();
    expect(areIrTypesEquivalent(left, right, recursiveContext)).to.equal(true);
  });
});
