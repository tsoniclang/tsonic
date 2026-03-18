import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "@tsonic/frontend";
import { createContext } from "../../emitter-types/context.js";
import type { EmitterContext } from "../../emitter-types/core.js";
import {
  resolveComparableType,
  unwrapComparableType,
} from "./comparable-types.js";

describe("comparable-types", () => {
  it("unwraps parameter modifier wrappers and strips nullish", () => {
    const wrapped: IrType = {
      kind: "referenceType",
      name: "ref",
      typeArguments: [
        {
          kind: "unionType",
          types: [
            { kind: "primitiveType", name: "undefined" },
            {
              kind: "referenceType",
              name: "In",
              typeArguments: [{ kind: "primitiveType", name: "string" }],
            },
          ],
        },
      ],
    };

    expect(unwrapComparableType(wrapped)).to.deep.equal({
      kind: "referenceType",
      name: "In",
      typeArguments: [{ kind: "primitiveType", name: "string" }],
    });
  });

  it("resolves aliases after comparable unwrapping", () => {
    const context: EmitterContext = {
      ...createContext({ rootNamespace: "Test" }),
      localTypes: new Map([
        [
          "Alias",
          {
            kind: "typeAlias" as const,
            typeParameters: [],
            type: { kind: "primitiveType", name: "string" },
          },
        ],
      ]),
    };

    const wrappedAlias: IrType = {
      kind: "referenceType",
      name: "out",
      typeArguments: [
        {
          kind: "unionType",
          types: [
            { kind: "primitiveType", name: "null" },
            { kind: "referenceType", name: "Alias" },
          ],
        },
      ],
    };

    expect(resolveComparableType(wrappedAlias, context)).to.deep.equal({
      kind: "primitiveType",
      name: "string",
    });
  });
});
