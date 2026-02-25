/**
 * Tests for emitting `new` on shadowing members.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrClassMember } from "@tsonic/frontend";
import type { EmitterContext, EmitterOptions } from "../../../types.js";
import { emitMethodMember } from "./methods.js";
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
  usings: new Set<string>(),
});

describe("Shadowing member emission", () => {
  it("emits `new` for shadowing methods", () => {
    const context = createContext();
    const member: Extract<IrClassMember, { kind: "methodDeclaration" }> = {
      kind: "methodDeclaration",
      name: "Foo",
      parameters: [],
      isStatic: false,
      isAsync: false,
      isGenerator: false,
      accessibility: "public",
      isShadow: true,
      body: { kind: "blockStatement", statements: [] },
    };

    const [code] = emitMethodMember(member, context);
    expect(code).to.include("public new void Foo()");
  });

  it("emits `new` for shadowing properties", () => {
    const context = createContext();
    const member: Extract<IrClassMember, { kind: "propertyDeclaration" }> = {
      kind: "propertyDeclaration",
      name: "Value",
      type: { kind: "primitiveType", name: "string" },
      initializer: undefined,
      isStatic: false,
      isReadonly: false,
      accessibility: "public",
      isShadow: true,
    };

    const [code] = emitPropertyMember(member, context);
    expect(code).to.include("public new string Value");
  });
});
