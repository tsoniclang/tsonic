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
});
