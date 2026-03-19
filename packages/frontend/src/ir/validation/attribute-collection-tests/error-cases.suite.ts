/**
 * Tests for error cases in the attribute collection pass.
 */

import {
  assertDefined,
  createModule,
  describe,
  expect,
  it,
  makeCall,
  makeCtorMarkerCall,
  makeIdentifier,
  makeLiteral,
  makeMarkerCall,
  makeMemberAccess,
  makeObject,
  makeObjectProp,
  makeObjectSpread,
  runAttributeCollectionPass,
} from "./helpers.js";
import type { IrClassDeclaration, IrFunctionDeclaration } from "./helpers.js";

describe("Attribute Collection Pass", () => {
  describe("Error cases", () => {
    it("should error when attribute constructor has no CLR binding and is not a local class", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeMarkerCall("User", "MissingAttribute"),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4004")).to.be.true;
    });

    it("should allow locally declared attribute types (no CLR binding)", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "MyAttr",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeMarkerCall("User", "MyAttr"),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body.find(
        (s) => s.kind === "classDeclaration" && s.name === "User"
      ) as IrClassDeclaration;
      expect(classDecl.attributes).to.have.length(1);
      const attr = assertDefined(classDecl.attributes?.[0]);
      expect(attr.attributeType).to.deep.equal({
        kind: "referenceType",
        name: "MyAttr",
      });
    });

    it("should emit diagnostic when target not found", () => {
      // IR representation of:
      // A.on(NotExist).type.add(SomeAttribute);
      const module = createModule([
        makeMarkerCall("NotExist", "SomeAttribute", [], "Test.SomeAttribute"),
      ]);

      const result = runAttributeCollectionPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics).to.have.length(1);
      const diag = assertDefined(result.diagnostics[0]);
      expect(diag.message).to.include("NotExist");
      expect(diag.code).to.equal("TSN4007");
    });

    it("should emit diagnostic when attribute args are not constants", () => {
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
            makeMemberAccess(
              makeMemberAccess(
                makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
                  makeIdentifier("User"),
                ]),
                "type"
              ),
              "add"
            ),
            [
              makeIdentifier("ObsoleteAttribute", "System.ObsoleteAttribute"),
              makeIdentifier("notConst"),
            ]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4006")).to.be.true;
    });

    it("should error when positional args appear after named args", () => {
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
            makeMemberAccess(
              makeMemberAccess(
                makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
                  makeIdentifier("User"),
                ]),
                "type"
              ),
              "add"
            ),
            [
              makeIdentifier("ObsoleteAttribute", "System.ObsoleteAttribute"),
              makeObject([makeObjectProp("IsError", makeLiteral(true))]),
              makeLiteral("too late"),
            ]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4006")).to.be.true;
    });

    it("should error on spreads in named arguments object", () => {
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
            makeMemberAccess(
              makeMemberAccess(
                makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
                  makeIdentifier("User"),
                ]),
                "type"
              ),
              "add"
            ),
            [
              makeIdentifier("ObsoleteAttribute", "System.ObsoleteAttribute"),
              makeObject([makeObjectSpread(makeIdentifier("x"))]),
            ]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4006")).to.be.true;
    });

    it("should error when a named argument value is not a constant", () => {
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
            makeMemberAccess(
              makeMemberAccess(
                makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
                  makeIdentifier("User"),
                ]),
                "type"
              ),
              "add"
            ),
            [
              makeIdentifier("ObsoleteAttribute", "System.ObsoleteAttribute"),
              makeObject([
                makeObjectProp("IsError", makeIdentifier("notConst")),
              ]),
            ]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4006")).to.be.true;
    });

    it("should error when a named argument key is not a string", () => {
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
            makeMemberAccess(
              makeMemberAccess(
                makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
                  makeIdentifier("User"),
                ]),
                "type"
              ),
              "add"
            ),
            [
              makeIdentifier("ObsoleteAttribute", "System.ObsoleteAttribute"),
              makeObject([
                makeObjectProp(makeIdentifier("IsError"), makeLiteral(true)),
              ]),
            ]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4006")).to.be.true;
    });

    it("should error on unsupported marker call shapes using the attributes API", () => {
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
            makeMemberAccess(
              makeMemberAccess(
                makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
                  makeIdentifier("User"),
                ]),
                "type"
              ),
              "nope"
            ),
            [
              makeIdentifier(
                "SerializableAttribute",
                "System.SerializableAttribute"
              ),
            ]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4005")).to.be.true;
    });

    it("should error when type target is ambiguous (class and function share name)", () => {
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
          kind: "functionDeclaration",
          name: "User",
          parameters: [],
          body: { kind: "blockStatement", statements: [] },
          isAsync: false,
          isGenerator: false,
          isExported: true,
        } as IrFunctionDeclaration,
        makeMarkerCall(
          "User",
          "SerializableAttribute",
          [],
          "System.SerializableAttribute"
        ),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4005")).to.be.true;
    });

    it("should error when applying ctor attributes to a struct without an explicit ctor", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "S",
          implements: [],
          members: [],
          isExported: true,
          isStruct: true,
        } as IrClassDeclaration,
        makeCtorMarkerCall("S", "ObsoleteAttribute"),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4005")).to.be.true;
    });
  });
});
