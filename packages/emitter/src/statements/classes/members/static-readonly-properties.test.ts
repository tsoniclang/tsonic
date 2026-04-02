/**
 * Tests for static readonly property emission (no `init` on static).
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrClassMember } from "@tsonic/frontend";
import type { EmitterContext, EmitterOptions } from "../../../types.js";
import { emitPropertyMember } from "./properties.js";
import { printMember } from "../../../core/format/backend-ast/printer.js";

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

describe("Static readonly property emission", () => {
  it("does not emit `init` for static readonly auto-properties", () => {
    const context = createContext();
    const member: IrClassMember = {
      kind: "propertyDeclaration",
      name: "Value",
      type: { kind: "primitiveType", name: "int" },
      initializer: {
        kind: "literal",
        value: 0,
        raw: "0",
        numericIntent: "Int32",
      },
      isStatic: true,
      isReadonly: true,
      accessibility: "public",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [ast] = emitPropertyMember(member as any, context);
    const code = printMember(ast, "");
    expect(code).to.include("public static int Value");
    expect(code).to.include("{ get; }");
    expect(code).to.not.include("init");
  });

  it("uses private set for readonly array properties that need mutable storage", () => {
    const context = createContext({
      declaringTypeName: "Holder",
      mutablePropertySlots: new Set(["Holder::Items"]),
    });
    const member: IrClassMember = {
      kind: "propertyDeclaration",
      name: "Items",
      type: {
        kind: "arrayType",
        elementType: { kind: "primitiveType", name: "string" },
      },
      initializer: { kind: "array", elements: [] },
      isStatic: false,
      isReadonly: true,
      accessibility: "public",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [ast] = emitPropertyMember(member as any, context);
    const code = printMember(ast, "");
    expect(code).to.include("public string[] Items");
    expect(code).to.include("{ get; private set; }");
    expect(code).to.not.include("init");
  });

  it("does not emit redundant private set on private readonly array properties", () => {
    const context = createContext({
      declaringTypeName: "Holder",
      mutablePropertySlots: new Set(["Holder::items"]),
    });
    const member: IrClassMember = {
      kind: "propertyDeclaration",
      name: "items",
      type: {
        kind: "arrayType",
        elementType: { kind: "primitiveType", name: "string" },
      },
      initializer: { kind: "array", elements: [] },
      isStatic: false,
      isReadonly: true,
      accessibility: "private",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [ast] = emitPropertyMember(member as any, context);
    const code = printMember(ast, "");
    expect(code).to.include("private string[] items");
    expect(code).to.include("{ get; set; }");
    expect(code).to.not.include("private set");
    expect(code).to.not.include("init");
  });

  it("keeps init-only storage for readonly array properties without mutation", () => {
    const context = createContext({
      declaringTypeName: "Holder",
    });
    const member: IrClassMember = {
      kind: "propertyDeclaration",
      name: "Items",
      type: {
        kind: "arrayType",
        elementType: { kind: "primitiveType", name: "string" },
      },
      initializer: { kind: "array", elements: [] },
      isStatic: false,
      isReadonly: true,
      accessibility: "public",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [ast] = emitPropertyMember(member as any, context);
    const code = printMember(ast, "");
    expect(code).to.include("public string[] Items");
    expect(code).to.include("{ get; init; }");
    expect(code).to.not.include("private set");
  });

});
