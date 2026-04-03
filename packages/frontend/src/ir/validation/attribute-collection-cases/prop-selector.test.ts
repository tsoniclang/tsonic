/**
 * Tests for A<T>().prop(selector).add(Attr) pattern and AttributeDescriptor forms.
 */

import {
  assertDefined,
  createModule,
  describe,
  expect,
  it,
  makeAddDescriptorMarkerCall,
  makeAttrDescriptorDecl,
  makeInlineDescriptorMarkerCall,
  makeLiteral,
  makePropMarkerCall,
  makePropMarkerCallWithTarget,
  makeWrappedSelector,
  runAttributeCollectionPass,
} from "./helpers.js";
import type { IrClassDeclaration, IrInterfaceDeclaration } from "./helpers.js";

describe("Attribute Collection Pass", () => {
  describe("A<T>().prop(selector).add(Attr) pattern", () => {
    it("should attach attribute to the selected property", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [
            {
              kind: "propertyDeclaration",
              name: "name",
              isStatic: false,
              isReadonly: false,
              accessibility: "public",
            },
          ],
          isExported: true,
          isStruct: false,
        } as unknown as IrClassDeclaration,
        makePropMarkerCall("User", "name", "DataMemberAttribute"),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      const prop = classDecl.members.find(
        (m) => m.kind === "propertyDeclaration"
      );
      expect(
        prop && "attributes" in prop ? prop.attributes : undefined
      ).to.have.length(1);
    });

    it("should attach attribute to the selected interface property", () => {
      const module = createModule([
        {
          kind: "interfaceDeclaration",
          name: "IUser",
          extends: [],
          typeParameters: [],
          members: [
            {
              kind: "propertySignature",
              name: "name",
            },
          ],
          isExported: true,
          isStruct: false,
        } as unknown as IrInterfaceDeclaration,
        makePropMarkerCall("IUser", "name", "DataMemberAttribute"),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const ifaceDecl = mod.body[0] as IrInterfaceDeclaration;
      const prop = ifaceDecl.members.find((m) => m.kind === "propertySignature");
      expect(
        prop && "attributes" in prop ? prop.attributes : undefined
      ).to.have.length(1);
    });

    it("should support property attribute targets (e.g., field on auto-property)", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [
            {
              kind: "propertyDeclaration",
              name: "name",
              isStatic: false,
              isReadonly: false,
              accessibility: "public",
            },
          ],
          isExported: true,
          isStruct: false,
        } as unknown as IrClassDeclaration,
        makePropMarkerCallWithTarget(
          "User",
          "name",
          "DataMemberAttribute",
          makeLiteral("field")
        ),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      const prop = classDecl.members.find(
        (m) => m.kind === "propertyDeclaration"
      );
      const attr0 = assertDefined(
        prop && "attributes" in prop ? prop.attributes?.[0] : undefined
      );
      expect(attr0.target).to.equal("field");
    });

    it("should accept property selectors whose parameter identifier is wrapped in transparent assertions", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [
            {
              kind: "propertyDeclaration",
              name: "name",
              isStatic: false,
              isReadonly: false,
              accessibility: "public",
            },
          ],
          isExported: true,
          isStruct: false,
        } as unknown as IrClassDeclaration,
        makePropMarkerCall(
          "User",
          "name",
          "DataMemberAttribute",
          makeWrappedSelector("name")
        ),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      const prop = classDecl.members.find(
        (m) => m.kind === "propertyDeclaration"
      );
      expect(
        prop && "attributes" in prop ? prop.attributes : undefined
      ).to.have.length(1);
    });

    it("should reject [field: ...] on accessor properties", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [
            {
              kind: "propertyDeclaration",
              name: "name",
              getterBody: { kind: "blockStatement", statements: [] },
              isStatic: false,
              isReadonly: false,
              accessibility: "public",
            },
          ],
          isExported: true,
          isStruct: false,
        } as unknown as IrClassDeclaration,
        makePropMarkerCallWithTarget(
          "User",
          "name",
          "DataMemberAttribute",
          makeLiteral("field")
        ),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4005")).to.be.true;
    });

    it("should error when the selected property does not exist", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [
            {
              kind: "propertyDeclaration",
              name: "name",
              isStatic: false,
              isReadonly: false,
              accessibility: "public",
            },
          ],
          isExported: true,
          isStruct: false,
        } as unknown as IrClassDeclaration,
        makePropMarkerCall("User", "missing", "DataMemberAttribute"),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4007")).to.be.true;
    });
  });

  describe("AttributeDescriptor forms", () => {
    it("should support inline A.attr(...) passed to add()", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeInlineDescriptorMarkerCall("User", "ObsoleteAttribute"),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      expect(classDecl.attributes).to.have.length(1);
      const attr = assertDefined(classDecl.attributes?.[0]);
      expect(attr.positionalArgs).to.have.length(1);
    });

    it("should support descriptor variables (const d = A.attr(...); add(d))", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        makeAttrDescriptorDecl("d", "ObsoleteAttribute") as any,
        makeAddDescriptorMarkerCall("User", "d"),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      // Removes both the descriptor declaration and the marker call
      expect(mod.body).to.have.length(1);
      const classDecl = mod.body[0] as IrClassDeclaration;
      expect(classDecl.attributes).to.have.length(1);
    });
  });
});
