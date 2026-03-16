import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { normalizeRuntimeStorageType } from "./storage-types.js";

describe("storage-types", () => {
  const context: EmitterContext = {
    indentLevel: 0,
    options: {
      rootNamespace: "Test",
      indent: 4,
    },
    isStatic: false,
    isAsync: false,
    usings: new Set<string>(),
  };

  it("erases recursive union array storage to object[]", () => {
    const handlerType: IrType = {
      kind: "functionType",
      parameters: [],
      returnType: { kind: "voidType" },
    };

    const routerType: IrType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "Test.Router",
    };

    const middlewareLike = {
      kind: "unionType",
      types: [],
    } as unknown as Extract<IrType, { kind: "unionType" }> & {
      types: IrType[];
    };

    middlewareLike.types.push(handlerType, routerType, {
      kind: "arrayType",
      elementType: middlewareLike,
      origin: "explicit",
    });

    expect(
      normalizeRuntimeStorageType(
        {
          kind: "arrayType",
          elementType: middlewareLike,
          origin: "explicit",
        },
        context
      )
    ).to.deep.equal({
      kind: "arrayType",
      elementType: {
        kind: "referenceType",
        name: "object",
        resolvedClrType: "System.Object",
      },
      origin: "explicit",
    });
  });

  it("preserves nullish wrappers while normalizing recursive union array storage", () => {
    const handlerType: IrType = {
      kind: "functionType",
      parameters: [],
      returnType: { kind: "voidType" },
    };

    const routerType: IrType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "Test.Router",
    };

    const middlewareLike = {
      kind: "unionType",
      types: [],
    } as unknown as Extract<IrType, { kind: "unionType" }> & {
      types: IrType[];
    };

    middlewareLike.types.push(handlerType, routerType, {
      kind: "arrayType",
      elementType: middlewareLike,
      origin: "explicit",
    });

    expect(
      normalizeRuntimeStorageType(
        {
          kind: "unionType",
          types: [
            {
              kind: "arrayType",
              elementType: middlewareLike,
              origin: "explicit",
            },
            { kind: "primitiveType", name: "undefined" },
          ],
        },
        context
      )
    ).to.deep.equal({
      kind: "unionType",
      types: [
        {
          kind: "arrayType",
          elementType: {
            kind: "referenceType",
            name: "object",
            resolvedClrType: "System.Object",
          },
          origin: "explicit",
        },
        { kind: "primitiveType", name: "undefined" },
      ],
    });
  });

  it("leaves non-union array storage unchanged", () => {
    const type: IrType = {
      kind: "arrayType",
      elementType: { kind: "primitiveType", name: "int" },
      origin: "explicit",
    };

    expect(normalizeRuntimeStorageType(type, context)).to.deep.equal(type);
  });
});
