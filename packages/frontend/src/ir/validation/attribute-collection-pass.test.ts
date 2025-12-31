/**
 * Tests for attribute collection pass
 */

import { expect } from "chai";
import { runAttributeCollectionPass } from "./attribute-collection-pass.js";
import type {
  IrModule,
  IrClassDeclaration,
  IrFunctionDeclaration,
} from "../types.js";

/**
 * Assert value is not null/undefined and return it typed as non-null.
 */
const assertDefined = <T>(value: T | null | undefined, msg?: string): T => {
  if (value === null || value === undefined) {
    throw new Error(msg ?? "Expected value to be defined");
  }
  return value;
};

describe("Attribute Collection Pass", () => {
  /**
   * Helper to create a minimal IrModule for testing
   */
  const createModule = (body: IrModule["body"]): IrModule => ({
    kind: "module",
    filePath: "test.ts",
    namespace: "Test",
    className: "Test",
    isStaticContainer: false,
    imports: [],
    body,
    exports: [],
  });

  /**
   * Helper to create a minimal identifier IR
   */
  const makeIdentifier = (name: string, resolvedClrType?: string) => ({
    kind: "identifier" as const,
    name,
    resolvedClrType,
  });

  /**
   * Helper to create a minimal member access IR
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const makeMemberAccess = (object: any, property: string) => ({
    kind: "memberAccess" as const,
    object,
    property,
    isComputed: false,
    isOptional: false,
  });

  /**
   * Helper to create a minimal call IR
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const makeCall = (callee: any, args: readonly any[]) => ({
    kind: "call" as const,
    callee,
    arguments: args,
    isOptional: false,
  });

  /**
   * Helper to create a minimal literal IR
   */
  const makeLiteral = (value: string | number | boolean) => ({
    kind: "literal" as const,
    value,
    raw: String(value),
  });

  /**
   * Helper to create an attribute marker call IR for A.on(Target).type.add(Attr, ...args)
   */
  const makeMarkerCall = (
    targetName: string,
    attrName: string,
    args: Array<{ kind: "literal"; value: string | number | boolean }> = [],
    resolvedClrType?: string
  ) => ({
    kind: "expressionStatement" as const,
    expression: makeCall(
      makeMemberAccess(
        makeMemberAccess(
          makeCall(
            makeMemberAccess(makeIdentifier("A"), "on"),
            [makeIdentifier(targetName)]
          ),
          "type"
        ),
        "add"
      ),
      [
        makeIdentifier(attrName, resolvedClrType),
        ...args.map((a) => makeLiteral(a.value)),
      ]
    ),
  });

  describe("A.on(Class).type.add(Attr) pattern", () => {
    it("should attach attribute to class declaration", () => {
      // IR representation of:
      // class User {}
      // A.on(User).type.add(SerializableAttribute);
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

    it("should attach attribute with positional arguments", () => {
      // IR representation of:
      // class User {}
      // A.on(User).type.add(ObsoleteAttribute, "Use NewUser instead");
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeMarkerCall("User", "ObsoleteAttribute", [
          { kind: "literal", value: "Use NewUser instead" },
        ]),
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
  });

  describe("A.on(fn).type.add(Attr) pattern", () => {
    it("should attach attribute to function declaration", () => {
      // IR representation of:
      // function greet() {}
      // A.on(greet).type.add(PureAttribute);
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
        makeMarkerCall("greet", "PureAttribute"),
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

  describe("Error cases", () => {
    it("should emit diagnostic when target not found", () => {
      // IR representation of:
      // A.on(NotExist).type.add(SomeAttribute);
      const module = createModule([
        makeMarkerCall("NotExist", "SomeAttribute"),
      ]);

      const result = runAttributeCollectionPass([module]);

      expect(result.ok).to.be.true; // Diagnostics are warnings, not hard failures
      expect(result.diagnostics).to.have.length(1);
      const diag = assertDefined(result.diagnostics[0]);
      expect(diag.message).to.include("NotExist");
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
      // A.on(User).type.add(SerializableAttribute);
      // A.on(User).type.add(ObsoleteAttribute, "Deprecated");
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeMarkerCall("User", "SerializableAttribute"),
        makeMarkerCall("User", "ObsoleteAttribute", [
          { kind: "literal", value: "Deprecated" },
        ]),
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
