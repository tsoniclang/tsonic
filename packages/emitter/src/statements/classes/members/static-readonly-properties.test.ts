/**
 * Tests for static readonly property emission (no `init` on static).
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrClassMember } from "@tsonic/frontend";
import type { EmitterContext, EmitterOptions } from "../../../types.js";
import { emitPropertyMember } from "./properties.js";

const defaultOptions: EmitterOptions = {
  rootNamespace: "Test",
  indent: 2,
};

const createContext = (): EmitterContext => ({
  indentLevel: 0,
  options: defaultOptions,
  isStatic: false,
  isAsync: false,
});

describe("Static readonly property emission", () => {
  it("does not emit `init` for static readonly auto-properties", () => {
    const context = createContext();
    const member: IrClassMember = {
      kind: "propertyDeclaration",
      name: "Value",
      type: { kind: "primitiveType", name: "int" },
      initializer: { kind: "literal", value: 0, raw: "0", numericIntent: "Int32" },
      isStatic: true,
      isReadonly: true,
      accessibility: "public",
    };

    const [code] = emitPropertyMember(member as any, context);
    expect(code).to.include("public static int Value");
    expect(code).to.include("{ get; }");
    expect(code).to.not.include("init");
  });
});

