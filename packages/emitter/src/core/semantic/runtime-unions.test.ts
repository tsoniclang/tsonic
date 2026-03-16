import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType, IrInterfaceMember } from "@tsonic/frontend";
import {
  buildRuntimeUnionFrame,
  buildRuntimeUnionLayout,
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
});
