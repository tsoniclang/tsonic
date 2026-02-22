/**
 * Tests for IR Soundness Gate
 *
 * Tests:
 * - anyType detection (TSN7414)
 * - referenceType resolvability validation
 * - Local types allowed
 * - Imported types allowed
 * - Known builtins allowed
 * - Type parameters allowed
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { validateIrSoundness } from "./soundness-gate.js";
import { IrModule, IrType } from "../types.js";

/**
 * Helper to create a minimal module with a variable declaration of a given type
 */
const createModuleWithType = (
  varType: IrType,
  options: {
    imports?: IrModule["imports"];
    additionalBody?: IrModule["body"];
  } = {}
): IrModule => ({
  kind: "module",
  filePath: "/src/test.ts",
  namespace: "Test",
  className: "test",
  isStaticContainer: true,
  imports: options.imports ?? [],
  body: [
    ...(options.additionalBody ?? []),
    {
      kind: "variableDeclaration",
      declarationKind: "const",
      isExported: false,
      declarations: [
        {
          kind: "variableDeclarator",
          name: { kind: "identifierPattern", name: "x" },
          type: varType,
          initializer: {
            kind: "literal",
            value: null,
            raw: "null",
          },
        },
      ],
    },
  ],
  exports: [],
});

describe("IR Soundness Gate", () => {
  describe("Computed Member Access Typing", () => {
    it("allows unknown value type on dictionary element access", () => {
      const dictType: IrType = {
        kind: "dictionaryType",
        keyType: { kind: "primitiveType", name: "string" },
        valueType: { kind: "unknownType" },
      };

      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "test",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "variableDeclaration",
            declarationKind: "const",
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "dict" },
                type: dictType,
                initializer: {
                  kind: "object",
                  properties: [],
                  contextualType: dictType,
                  inferredType: dictType,
                },
              },
            ],
          },
          {
            kind: "expressionStatement",
            expression: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "dict",
                inferredType: dictType,
              },
              property: { kind: "literal", value: "k", raw: '"k"' },
              isComputed: true,
              isOptional: false,
              accessKind: "dictionary",
              inferredType: { kind: "unknownType" },
            },
          },
        ],
        exports: [],
      };

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
    });

    it("still rejects unknown type on non-dictionary computed access", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "test",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "expressionStatement",
            expression: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "obj",
                inferredType: { kind: "referenceType", name: "SomeType" },
              },
              property: { kind: "literal", value: 0, raw: "0" },
              isComputed: true,
              isOptional: false,
              accessKind: "clrIndexer",
              inferredType: { kind: "unknownType" },
            },
          },
        ],
        exports: [],
      };

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN5203")).to.be.true;
    });
  });

  describe("anyType Detection (TSN7414)", () => {
    it("should reject anyType in variable declaration", () => {
      const module = createModuleWithType({ kind: "anyType" });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics).to.have.length(1);
      expect(result.diagnostics[0]?.code).to.equal("TSN7414");
    });

    it("should reject anyType in array element type", () => {
      const module = createModuleWithType({
        kind: "arrayType",
        elementType: { kind: "anyType" },
      });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics[0]?.code).to.equal("TSN7414");
    });

    it("should reject anyType in function parameter", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "test",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "functionDeclaration",
            name: "test",
            parameters: [
              {
                kind: "parameter",
                pattern: { kind: "identifierPattern", name: "x" },
                type: { kind: "anyType" },
                isOptional: false,
                isRest: false,
                passing: "value",
              },
            ],
            returnType: { kind: "voidType" },
            body: { kind: "blockStatement", statements: [] },
            isExported: false,
            isAsync: false,
            isGenerator: false,
          },
        ],
        exports: [],
      };

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics[0]?.code).to.equal("TSN7414");
    });

    it("should allow unknownType (explicit unknown is valid)", () => {
      const module = createModuleWithType({ kind: "unknownType" });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
    });
  });

  describe("Reference Type Resolvability", () => {
    it("should allow referenceType with resolvedClrType", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Action",
        resolvedClrType: "global::System.Action",
      });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
    });

    it("should allow known CLR binding type when provided", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Dictionary_2",
      });

      const result = validateIrSoundness([module], {
        knownReferenceTypes: new Set(["Dictionary_2"]),
      });

      expect(result.ok).to.be.true;
    });

    it("should allow known builtin Array", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Array",
        typeArguments: [{ kind: "primitiveType", name: "number" }],
      });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
    });

    it("should allow known builtin Promise", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Promise",
        typeArguments: [{ kind: "primitiveType", name: "string" }],
      });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
    });

    it("should allow C# primitive int", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "int",
      });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
    });

    it("should allow C# primitive decimal", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "decimal",
      });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
    });

    it("should allow local class type", () => {
      const module = createModuleWithType(
        { kind: "referenceType", name: "User" },
        {
          additionalBody: [
            {
              kind: "classDeclaration",
              name: "User",
              isExported: false,
              isStruct: false,
              typeParameters: [],
              implements: [],
              members: [],
            },
          ],
        }
      );

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
    });

    it("should allow local interface type", () => {
      const module = createModuleWithType(
        { kind: "referenceType", name: "IUser" },
        {
          additionalBody: [
            {
              kind: "interfaceDeclaration",
              name: "IUser",
              isExported: false,
              isStruct: false,
              typeParameters: [],
              extends: [],
              members: [],
            },
          ],
        }
      );

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
    });

    it("should allow local type alias", () => {
      const module = createModuleWithType(
        { kind: "referenceType", name: "UserId" },
        {
          additionalBody: [
            {
              kind: "typeAliasDeclaration",
              name: "UserId",
              isExported: false,
              isStruct: false,
              typeParameters: [],
              type: { kind: "primitiveType", name: "string" },
            },
          ],
        }
      );

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
    });

    it("should allow local enum type", () => {
      const module = createModuleWithType(
        { kind: "referenceType", name: "Status" },
        {
          additionalBody: [
            {
              kind: "enumDeclaration",
              name: "Status",
              isExported: false,
              members: [{ kind: "enumMember", name: "Active" }],
            },
          ],
        }
      );

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
    });

    it("should allow imported type", () => {
      const module = createModuleWithType(
        { kind: "referenceType", name: "Console" },
        {
          imports: [
            {
              kind: "import",
              source: "@tsonic/dotnet/System",
              specifiers: [
                {
                  kind: "named",
                  name: "Console",
                  localName: "Console",
                  isType: true,
                },
              ],
              isLocal: false,
              isClr: true,
              resolvedNamespace: "System",
            },
          ],
        }
      );

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
    });

    it("should reject unresolved external type", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "UnknownExternalType",
      });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics).to.have.length(1);
      expect(result.diagnostics[0]?.code).to.equal("TSN7414");
      expect(result.diagnostics[0]?.message).to.include("UnknownExternalType");
    });
  });

  describe("Type Parameter Handling", () => {
    it("should allow type parameter in generic function", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "test",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "functionDeclaration",
            name: "identity",
            typeParameters: [{ kind: "typeParameter", name: "T" }],
            parameters: [
              {
                kind: "parameter",
                pattern: { kind: "identifierPattern", name: "x" },
                type: { kind: "typeParameterType", name: "T" },
                isOptional: false,
                isRest: false,
                passing: "value",
              },
            ],
            returnType: { kind: "typeParameterType", name: "T" },
            body: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "returnStatement",
                  expression: {
                    kind: "identifier",
                    name: "x",
                  },
                },
              ],
            },
            isExported: false,
            isAsync: false,
            isGenerator: false,
          },
        ],
        exports: [],
      };

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
    });
  });

  describe("Primitive Types", () => {
    it("should allow primitiveType string", () => {
      const module = createModuleWithType({
        kind: "primitiveType",
        name: "string",
      });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
    });

    it("should allow primitiveType number", () => {
      const module = createModuleWithType({
        kind: "primitiveType",
        name: "number",
      });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
    });

    it("should allow voidType", () => {
      const module = createModuleWithType({ kind: "voidType" });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
    });
  });

  describe("Core Intrinsic Calls", () => {
    const createModuleWithCallTo = (name: string): IrModule => ({
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "Test",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "x" },
              type: { kind: "unknownType" },
              initializer: {
                kind: "call",
                callee: { kind: "identifier", name },
                arguments: [
                  {
                    kind: "literal",
                    value: null,
                    raw: "null",
                  },
                ],
                isOptional: false,
              },
            },
          ],
        },
      ],
      exports: [],
    });

    it("should reject asinterface as a normal call (TSN7442)", () => {
      const module = createModuleWithCallTo("asinterface");
      const result = validateIrSoundness([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN7442")).to.be.true;
    });

    it("should reject trycast as a normal call (TSN7442)", () => {
      const module = createModuleWithCallTo("trycast");
      const result = validateIrSoundness([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN7442")).to.be.true;
    });

    it("should reject stackalloc as a normal call (TSN7442)", () => {
      const module = createModuleWithCallTo("stackalloc");
      const result = validateIrSoundness([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN7442")).to.be.true;
    });

    it("should reject reserved intrinsics that are not implemented (TSN7443)", () => {
      const module = createModuleWithCallTo("nameof");
      const result = validateIrSoundness([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN7443")).to.be.true;
    });
  });
});
