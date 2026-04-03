/**
 * Tests for A<T>().add(Attr) pattern and alias imports.
 */

import {
  assertDefined,
  createModule,
  describe,
  expect,
  it,
  makeCall,
  makeIdentifier,
  makeLiteral,
  makeMarkerCall,
  makeMemberAccess,
  makeObject,
  makeObjectProp,
  makeRefType,
  makeTypedIdentifier,
  makeTypeMarkerCallWithTarget,
  makeTypeRootCall,
  makeUnaryTypeof,
  runAttributeCollectionPass,
} from "./helpers.js";
import type { IrClassDeclaration, IrInterfaceDeclaration } from "./helpers.js";

describe("Attribute Collection Pass", () => {
  describe("A<T>().add(Attr) pattern", () => {
    it("should attach attribute to class declaration", () => {
      // IR representation of:
      // class User {}
      // A<User>().add(SerializableAttribute);
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
      ]);

      const result = runAttributeCollectionPass([module]);

      expect(result.ok).to.be.true;
      expect(result.modules).to.have.length(1);

      const processedModule = assertDefined(result.modules[0]);
      // Marker statement should be removed
      expect(processedModule.body).to.have.length(1);

      const classDecl = processedModule.body[0] as IrClassDeclaration;
      expect(classDecl.kind).to.equal("classDeclaration");
      expect(classDecl.attributes).to.have.length(1);
      const attr0 = assertDefined(classDecl.attributes?.[0]);
      expect(attr0.attributeType.kind).to.equal("referenceType");
    });

    it("should attach attribute to interface declaration", () => {
      const module = createModule([
        {
          kind: "interfaceDeclaration",
          name: "IUser",
          typeParameters: [],
          extends: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as unknown as IrInterfaceDeclaration,
        makeMarkerCall(
          "IUser",
          "SerializableAttribute",
          [],
          "System.SerializableAttribute"
        ),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;

      const processedModule = assertDefined(result.modules[0]);
      const ifaceDecl = processedModule.body[0] as IrInterfaceDeclaration;
      expect(ifaceDecl.kind).to.equal("interfaceDeclaration");
      expect(ifaceDecl.attributes).to.have.length(1);
    });

    it("should attach attribute with positional arguments", () => {
      // IR representation of:
      // class User {}
      // A<User>().add(ObsoleteAttribute, "Use NewUser instead");
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
          "ObsoleteAttribute",
          [{ kind: "literal", value: "Use NewUser instead" }],
          "System.ObsoleteAttribute"
        ),
      ]);

      const result = runAttributeCollectionPass([module]);

      expect(result.ok).to.be.true;

      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      expect(classDecl.attributes).to.have.length(1);
      const attr = assertDefined(classDecl.attributes?.[0]);
      expect(attr.positionalArgs).to.have.length(1);
      expect(attr.positionalArgs[0]).to.deep.equal({
        kind: "string",
        value: "Use NewUser instead",
      });
    });

    it("should attach attribute with named arguments", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        {
          kind: "expressionStatement",
          expression: makeCall(
            makeMemberAccess(makeTypeRootCall("User"), "add"),
            [
              makeIdentifier("ObsoleteAttribute", "System.ObsoleteAttribute"),
              makeObject([
                makeObjectProp("IsError", makeLiteral(true)),
                makeObjectProp("DiagnosticId", makeLiteral("TSN0000")),
              ]),
            ]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;

      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      expect(classDecl.attributes).to.have.length(1);
      const attr = assertDefined(classDecl.attributes?.[0]);
      expect(attr.positionalArgs).to.have.length(0);
      expect(attr.namedArgs.get("IsError")).to.deep.equal({
        kind: "boolean",
        value: true,
      });
      expect(attr.namedArgs.get("DiagnosticId")).to.deep.equal({
        kind: "string",
        value: "TSN0000",
      });
    });

    it("should attach attribute with mixed positional and named arguments", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        {
          kind: "expressionStatement",
          expression: makeCall(
            makeMemberAccess(makeTypeRootCall("User"), "add"),
            [
              makeIdentifier("ObsoleteAttribute", "System.ObsoleteAttribute"),
              makeLiteral("Deprecated"),
              makeObject([makeObjectProp("IsError", makeLiteral(true))]),
            ]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;

      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      const attr = assertDefined(classDecl.attributes?.[0]);
      expect(attr.positionalArgs).to.deep.equal([
        { kind: "string", value: "Deprecated" },
      ]);
      expect(attr.namedArgs.get("IsError")).to.deep.equal({
        kind: "boolean",
        value: true,
      });
    });

    it("should attach attribute with typeof argument", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        {
          kind: "expressionStatement",
          expression: makeCall(
            makeMemberAccess(makeTypeRootCall("User"), "add"),
            [
              makeIdentifier(
                "TypeConverterAttribute",
                "System.ComponentModel.TypeConverterAttribute"
              ),
              makeUnaryTypeof(
                makeTypedIdentifier("User", makeRefType("User", "Test.User"))
              ),
            ]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      expect(classDecl.attributes).to.have.length(1);
      const attr = assertDefined(classDecl.attributes?.[0]);
      expect(attr.positionalArgs).to.have.length(1);
      expect(attr.positionalArgs[0]).to.deep.equal({
        kind: "typeof",
        type: {
          kind: "referenceType",
          name: "User",
          resolvedClrType: "Test.User",
        },
      });
    });

    it("should attach attribute with enum argument", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        {
          kind: "expressionStatement",
          expression: makeCall(
            makeMemberAccess(makeTypeRootCall("User"), "add"),
            [
              makeIdentifier("MyAttr", "Test.MyAttr"),
              {
                kind: "memberAccess" as const,
                object: makeTypedIdentifier(
                  "MyEnum",
                  makeRefType("MyEnum", "Test.MyEnum")
                ),
                property: "Value",
                isComputed: false,
                isOptional: false,
              },
            ]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      const attr = assertDefined(classDecl.attributes?.[0]);
      expect(attr.positionalArgs).to.deep.equal([
        {
          kind: "enum",
          type: {
            kind: "referenceType",
            name: "MyEnum",
            resolvedClrType: "Test.MyEnum",
          },
          member: "Value",
        },
      ]);
    });

    it("should use CLR member name for enum arguments when memberBinding is present", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        {
          kind: "expressionStatement",
          expression: makeCall(
            makeMemberAccess(makeTypeRootCall("User"), "add"),
            [
              makeIdentifier("MyAttr", "Test.MyAttr"),
              {
                kind: "memberAccess" as const,
                object: makeTypedIdentifier(
                  "LayoutKind",
                  makeRefType(
                    "LayoutKind",
                    "System.Runtime.InteropServices.LayoutKind"
                  )
                ),
                property: "sequential",
                isComputed: false,
                isOptional: false,
                memberBinding: {
                  kind: "property",
                  assembly: "System.Runtime.InteropServices",
                  type: "System.Runtime.InteropServices.LayoutKind",
                  member: "Sequential",
                },
              },
            ]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      const attr = assertDefined(classDecl.attributes?.[0]);
      expect(attr.positionalArgs).to.deep.equal([
        {
          kind: "enum",
          type: {
            kind: "referenceType",
            name: "LayoutKind",
            resolvedClrType: "System.Runtime.InteropServices.LayoutKind",
          },
          member: "Sequential",
        },
      ]);
    });

    it("should support explicit type attribute target (type)", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeTypeMarkerCallWithTarget(
          "User",
          "SerializableAttribute",
          makeLiteral("type")
        ),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      const attr0 = assertDefined(classDecl.attributes?.[0]);
      expect(attr0.target).to.equal("type");
    });

    it("should reject invalid type attribute targets", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeTypeMarkerCallWithTarget(
          "User",
          "SerializableAttribute",
          makeLiteral("return")
        ),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4005")).to.be.true;
    });
  });

  describe("Alias imports", () => {
    it("should recognize any local name imported from @tsonic/core/lang.js", () => {
      const module = createModule(
        [
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
            "System.SerializableAttribute",
            "Attr"
          ),
        ],
        "Attr"
      );

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      expect(mod.body).to.have.length(1);
      const classDecl = mod.body[0] as IrClassDeclaration;
      expect(classDecl.attributes).to.have.length(1);
    });
  });
});
