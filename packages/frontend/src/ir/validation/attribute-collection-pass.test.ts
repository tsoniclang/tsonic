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
   * Helper to create an attribute marker call IR for A.on(Target).type.add(Attr, ...args)
   */
  const makeMarkerCall = (
    targetName: string,
    attrName: string,
    args: Array<{ kind: "literal"; value: string | number | boolean }> = [],
    resolvedClrType?: string
  ) => ({
    kind: "expressionStatement" as const,
    expression: {
      kind: "call" as const,
      callee: {
        kind: "memberAccess" as const,
        object: {
          kind: "memberAccess" as const,
          object: {
            kind: "call" as const,
            callee: {
              kind: "memberAccess" as const,
              object: { kind: "identifier" as const, name: "A" },
              property: "on",
              isComputed: false,
              isOptional: false,
            },
            arguments: [{ kind: "identifier" as const, name: targetName }],
            isOptional: false,
          },
          property: "type",
          isComputed: false,
          isOptional: false,
        },
        property: "add",
        isComputed: false,
        isOptional: false,
      },
      arguments: [
        {
          kind: "identifier" as const,
          name: attrName,
          ...(resolvedClrType ? { resolvedClrType } : {}),
        },
        ...args,
      ],
      isOptional: false,
    },
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

      const processedModule = result.modules[0]!;
      // Marker statement should be removed
      expect(processedModule.body).to.have.length(1);

      const classDecl = processedModule.body[0] as IrClassDeclaration;
      expect(classDecl.kind).to.equal("classDeclaration");
      expect(classDecl.attributes).to.have.length(1);
      expect(classDecl.attributes![0]!.attributeType.kind).to.equal(
        "referenceType"
      );
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

      const classDecl = result.modules[0]!.body[0] as IrClassDeclaration;
      expect(classDecl.attributes).to.have.length(1);
      expect(classDecl.attributes![0]!.positionalArgs).to.have.length(1);
      expect(classDecl.attributes![0]!.positionalArgs[0]).to.deep.equal({
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
      expect(result.modules[0]!.body).to.have.length(1);

      const funcDecl = result.modules[0]!.body[0] as IrFunctionDeclaration;
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
      expect(result.diagnostics[0]!.message).to.include("NotExist");
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
      expect(result.modules[0]!.body).to.have.length(1);

      const classDecl = result.modules[0]!.body[0] as IrClassDeclaration;
      expect(classDecl.attributes).to.have.length(2);
    });
  });
});
