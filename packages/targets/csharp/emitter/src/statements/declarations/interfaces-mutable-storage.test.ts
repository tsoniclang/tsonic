import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrInterfaceDeclaration } from "@tsonic/frontend";
import type { EmitterContext, EmitterOptions } from "../../types.js";
import { emitInterfaceDeclaration } from "./interfaces.js";
import { printTypeDeclaration } from "../../core/format/backend-ast/printer.js";

const defaultOptions: EmitterOptions = {
  rootNamespace: "Test",
  indent: 2,
};

const createContext = (
  patch: Partial<EmitterContext> = {}
): EmitterContext => ({
  indentLevel: 0,
  options: defaultOptions,
  isStatic: false,
  isAsync: false,
  usings: new Set<string>(),
  ...patch,
});

describe("Interface mutable storage emission", () => {
  it("uses a setter for readonly array properties when the slot is mutated", () => {
    const context = createContext({
      declaringTypeName: "ResultBag",
      mutablePropertySlots: new Set(["ResultBag::items"]),
    });
    const stmt: IrInterfaceDeclaration = {
      kind: "interfaceDeclaration",
      name: "ResultBag",
      members: [
        {
          kind: "propertySignature",
          name: "items",
          type: {
            kind: "arrayType",
            elementType: { kind: "primitiveType", name: "string" },
          },
          isOptional: false,
          isReadonly: true,
        },
      ],
      extends: [],
      isExported: true,
      isStruct: false,
    };

    const [decls] = emitInterfaceDeclaration(stmt, context);
    const firstDecl = decls[0];
    expect(firstDecl).to.not.equal(undefined);
    if (!firstDecl) return;
    const code = printTypeDeclaration(firstDecl, "");
    expect(code).to.include("public class ResultBag");
    expect(code).to.include("public required string[] items { get; set; }");
    expect(code).to.not.include("init");
  });

  it("keeps readonly interface members getter-only when no mutable slot is needed", () => {
    const context = createContext({
      declaringTypeName: "ResultBag",
    });
    const stmt: IrInterfaceDeclaration = {
      kind: "interfaceDeclaration",
      name: "ResultBag",
      members: [
        {
          kind: "propertySignature",
          name: "items",
          type: {
            kind: "arrayType",
            elementType: { kind: "primitiveType", name: "string" },
          },
          isOptional: false,
          isReadonly: true,
        },
        {
          kind: "methodSignature",
          name: "count",
          parameters: [],
          returnType: { kind: "primitiveType", name: "int" },
        },
      ],
      extends: [],
      isExported: true,
      isStruct: false,
    };

    const [decls] = emitInterfaceDeclaration(stmt, context);
    const firstDecl = decls[0];
    expect(firstDecl).to.not.equal(undefined);
    if (!firstDecl) return;
    const code = printTypeDeclaration(firstDecl, "");
    expect(code).to.include("public interface ResultBag");
    expect(code).to.include("string[] items { get; }");
    expect(code).to.not.include("set;");
  });
});
