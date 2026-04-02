/**
 * Tests for A(fn).add(Attr) pattern, modules without attributes,
 * and multiple attributes on the same declaration.
 */

import {
  assertDefined,
  createModule,
  describe,
  expect,
  it,
  makeFunctionMarkerCall,
  makeMarkerCall,
  runAttributeCollectionPass,
} from "./helpers.js";
import type { IrClassDeclaration, IrFunctionDeclaration } from "./helpers.js";

describe("Attribute Collection Pass", () => {
  describe("A(fn).add(Attr) pattern", () => {
    it("should attach attribute to function declaration", () => {
      // IR representation of:
      // function greet() {}
      // A(greet).add(PureAttribute);
      const module = createModule([
        {
          kind: "functionDeclaration",
          name: "greet",
          parameters: [],
          body: { kind: "blockStatement", statements: [] },
          isAsync: false,
          isGenerator: false,
          isExported: true,
        } as IrFunctionDeclaration,
        makeFunctionMarkerCall(
          "greet",
          "PureAttribute",
          [],
          "System.Diagnostics.Contracts.PureAttribute"
        ),
      ]);

      const result = runAttributeCollectionPass([module]);

      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      expect(mod.body).to.have.length(1);

      const funcDecl = mod.body[0] as IrFunctionDeclaration;
      expect(funcDecl.kind).to.equal("functionDeclaration");
      expect(funcDecl.attributes).to.have.length(1);
    });
  });

  describe("Modules without attributes", () => {
    it("should pass through modules unchanged when no marker calls", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
      ]);

      const result = runAttributeCollectionPass([module]);

      expect(result.ok).to.be.true;
      expect(result.modules[0]).to.equal(module); // Same reference
    });
  });

  describe("Multiple attributes", () => {
    it("should attach multiple attributes to same declaration", () => {
      // IR representation of:
      // class User {}
      // A<User>().add(SerializableAttribute);
      // A<User>().add(ObsoleteAttribute, "Deprecated");
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeMarkerCall(
          "User",
          "SerializableAttribute",
          [],
          "System.SerializableAttribute"
        ),
        makeMarkerCall(
          "User",
          "ObsoleteAttribute",
          [{ kind: "literal", value: "Deprecated" }],
          "System.ObsoleteAttribute"
        ),
      ]);

      const result = runAttributeCollectionPass([module]);

      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      expect(mod.body).to.have.length(1);

      const classDecl = mod.body[0] as IrClassDeclaration;
      expect(classDecl.attributes).to.have.length(2);
    });
  });
});
