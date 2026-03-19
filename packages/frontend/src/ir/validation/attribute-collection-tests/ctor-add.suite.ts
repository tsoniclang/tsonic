/**
 * Tests for A.on(Class).ctor.add(Attr) pattern.
 */

import {
  assertDefined,
  createModule,
  describe,
  expect,
  it,
  makeCtorMarkerCall,
  makeCtorMarkerCallWithTarget,
  makeLiteral,
  runAttributeCollectionPass,
} from "./helpers.js";
import type { IrClassDeclaration } from "./helpers.js";

describe("Attribute Collection Pass", () => {
  describe("A.on(Class).ctor.add(Attr) pattern", () => {
    it("should attach attribute to class ctorAttributes", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeCtorMarkerCall("User", "ObsoleteAttribute"),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      expect(classDecl.ctorAttributes).to.have.length(1);
    });

    it("should support explicit constructor attribute target (method)", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeCtorMarkerCallWithTarget(
          "User",
          "ObsoleteAttribute",
          makeLiteral("method")
        ),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      const attr0 = assertDefined(classDecl.ctorAttributes?.[0]);
      expect(attr0.target).to.equal("method");
    });

    it("should reject invalid constructor attribute targets", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeCtorMarkerCallWithTarget(
          "User",
          "ObsoleteAttribute",
          makeLiteral("return")
        ),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4005")).to.be.true;
    });
  });
});
