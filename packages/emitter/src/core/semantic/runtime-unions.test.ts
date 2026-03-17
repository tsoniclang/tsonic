import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType, IrInterfaceMember } from "@tsonic/frontend";
import {
  buildRuntimeUnionFrame,
  buildRuntimeUnionLayout,
  findRuntimeUnionMemberIndices,
} from "./runtime-unions.js";
import { emitTypeAst } from "../../types/emitter.js";
import { createContext } from "../../emitter-types/context.js";

const property = (
  name: string,
  type: IrType
): Extract<IrInterfaceMember, { kind: "propertySignature" }> => ({
  kind: "propertySignature",
  name,
  type,
  isOptional: false,
  isReadonly: false,
});

describe("runtime-unions", () => {
  it("orders structural union members by semantic shape instead of carrier name", () => {
    const successMember: IrType = {
      kind: "referenceType",
      name: "__Anon_success",
      resolvedClrType: "Test.__Anon_success",
      structuralMembers: [
        property("success", { kind: "literalType", value: true }),
        property("rendered", { kind: "primitiveType", name: "string" }),
      ],
    };

    const errorMember: IrType = {
      kind: "referenceType",
      name: "RenderResult__0",
      resolvedClrType: "Test.RenderResult__0",
      structuralMembers: [
        property("success", { kind: "literalType", value: false }),
        property("error", { kind: "primitiveType", name: "string" }),
      ],
    };

    const unionType: IrType = {
      kind: "unionType",
      types: [successMember, errorMember],
    };

    const context = createContext({ rootNamespace: "Test" });
    const [layout] = buildRuntimeUnionLayout(unionType, context, emitTypeAst);

    expect(
      layout?.members.map((member) => {
        if (member.kind !== "referenceType") return member.kind;
        return member.name;
      })
    ).to.deep.equal(["RenderResult__0", "__Anon_success"]);
  });

  it("builds runtime union frames without forcing local type emission", () => {
    const unionType: IrType = {
      kind: "unionType",
      types: [
        { kind: "referenceType", name: "MyApp.OkEvents" },
        { kind: "referenceType", name: "MyApp.ErrEvents" },
      ],
    };

    const context = createContext({ rootNamespace: "Test" });
    const frame = buildRuntimeUnionFrame(unionType, context);

    expect(
      frame?.members.map((member) => {
        if (member.kind !== "referenceType") return member.kind;
        return member.name;
      })
    ).to.deep.equal(["MyApp.ErrEvents", "MyApp.OkEvents"]);
    expect(frame?.runtimeUnionArity).to.equal(2);
  });

  it("preserves recursive array members semantically in runtime union frames", () => {
    const handlerType: IrType = {
      kind: "functionType",
      parameters: [
        {
          kind: "parameter",
          pattern: { kind: "identifierPattern", name: "value" },
          type: { kind: "primitiveType", name: "string" },
          initializer: undefined,
          isOptional: false,
          isRest: false,
          passing: "value",
        },
      ],
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

    const context = createContext({ rootNamespace: "Test" });
    const frame = buildRuntimeUnionFrame(middlewareLike, context);

    const recursiveArray = frame?.members.find(
      (member) => member?.kind === "arrayType"
    );
    if (!recursiveArray || recursiveArray.kind !== "arrayType") {
      return;
    }

    expect(recursiveArray.elementType.kind).to.equal("unknownType");
  });

  it("finds all runtime union members that satisfy a recursive alias subset target", () => {
    const pathSpec = {
      kind: "unionType",
      types: [],
    } as unknown as Extract<IrType, { kind: "unionType" }> & {
      types: IrType[];
    };

    pathSpec.types.push(
      { kind: "primitiveType", name: "string" },
      { kind: "referenceType", name: "RegExp", resolvedClrType: "Test.RegExp" },
      {
        kind: "arrayType",
        elementType: pathSpec,
        origin: "explicit",
      }
    );

    const requestHandler: IrType = {
      kind: "functionType",
      parameters: [],
      returnType: { kind: "voidType" },
    };

    const routerType: IrType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "Test.Router",
    };

    const sourceUnion: IrType = {
      kind: "unionType",
      types: [pathSpec, requestHandler, routerType],
    };

    const context = createContext({ rootNamespace: "Test" });
    const frame = buildRuntimeUnionFrame(sourceUnion, context);
    expect(frame).to.not.equal(undefined);
    if (!frame) {
      return;
    }

    const matches = findRuntimeUnionMemberIndices(
      frame.members,
      pathSpec,
      context
    );

    expect(matches).to.have.length(3);
    expect(matches.map((index) => frame.members[index]?.kind)).to.deep.equal([
      "arrayType",
      "primitiveType",
      "referenceType",
    ]);
  });
});
