import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "@tsonic/frontend";
import { createContext } from "../../emitter-types/context.js";
import type { EmitterContext } from "../../emitter-types/core.js";
import {
  resolveComparableType,
  unwrapComparableType,
} from "./comparable-types.js";
import { areIrTypesEquivalent } from "./type-equivalence.js";

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

  it("normalizes named structural union aliases to the same shape as anonymous union views", () => {
    const context: EmitterContext = {
      ...createContext({ rootNamespace: "Test" }),
      localTypes: new Map([
        [
          "Ok",
          {
            kind: "typeAlias" as const,
            typeParameters: ["T"],
            type: {
              kind: "objectType",
              members: [
                {
                  kind: "propertySignature",
                  name: "success",
                  type: { kind: "literalType", value: true },
                  isOptional: false,
                  isReadonly: false,
                },
                {
                  kind: "propertySignature",
                  name: "payload",
                  type: { kind: "typeParameterType", name: "T" },
                  isOptional: false,
                  isReadonly: false,
                },
              ],
            },
          },
        ],
        [
          "Err",
          {
            kind: "typeAlias" as const,
            typeParameters: ["E"],
            type: {
              kind: "objectType",
              members: [
                {
                  kind: "propertySignature",
                  name: "success",
                  type: { kind: "literalType", value: false },
                  isOptional: false,
                  isReadonly: false,
                },
                {
                  kind: "propertySignature",
                  name: "error",
                  type: { kind: "typeParameterType", name: "E" },
                  isOptional: false,
                  isReadonly: false,
                },
              ],
            },
          },
        ],
        [
          "Result",
          {
            kind: "typeAlias" as const,
            typeParameters: ["T", "E"],
            type: {
              kind: "unionType",
              types: [
                {
                  kind: "referenceType",
                  name: "Err",
                  typeArguments: [{ kind: "typeParameterType", name: "E" }],
                },
                {
                  kind: "referenceType",
                  name: "Ok",
                  typeArguments: [{ kind: "typeParameterType", name: "T" }],
                },
              ],
            },
          },
        ],
      ]),
    };

    const namedResult: IrType = {
      kind: "referenceType",
      name: "Result",
      typeArguments: [
        { kind: "primitiveType", name: "boolean" },
        { kind: "primitiveType", name: "string" },
      ],
    };
    const anonymousView: IrType = {
      kind: "unionType",
      types: [
        {
          kind: "referenceType",
          name: "__Anon_Ok",
          structuralMembers: [
            {
              kind: "propertySignature",
              name: "success",
              type: { kind: "literalType", value: true },
              isOptional: false,
              isReadonly: false,
            },
            {
              kind: "propertySignature",
              name: "payload",
              type: { kind: "primitiveType", name: "boolean" },
              isOptional: false,
              isReadonly: false,
            },
          ],
        },
        {
          kind: "referenceType",
          name: "__Anon_Err",
          structuralMembers: [
            {
              kind: "propertySignature",
              name: "success",
              type: { kind: "literalType", value: false },
              isOptional: false,
              isReadonly: false,
            },
            {
              kind: "propertySignature",
              name: "error",
              type: { kind: "primitiveType", name: "string" },
              isOptional: false,
              isReadonly: false,
            },
          ],
        },
      ],
    };

    expect(
      areIrTypesEquivalent(
        resolveComparableType(namedResult, context),
        resolveComparableType(anonymousView, context),
        context
      )
    ).to.equal(true);
  });

});
