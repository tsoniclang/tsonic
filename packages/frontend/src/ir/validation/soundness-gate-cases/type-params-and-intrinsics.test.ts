/**
 * Tests for IR Soundness Gate – Type Parameters, Intrinsics, and Cross-module Resolution
 *
 * Validates that the soundness gate correctly handles:
 * - Type parameters in generic functions
 * - Core intrinsic call rejection (TSN7442) for asinterface, trycast, stackalloc
 * - Lowered nameof and sizeof intrinsics are allowed
 * - Cross-module local reference resolution (same namespace vs different namespace)
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { validateIrSoundness } from "../soundness-gate.js";
import { IrModule } from "../../types.js";
import { createModuleWithType } from "./test-helpers.js";

describe("IR Soundness Gate", () => {
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

    it("should allow lowered nameof and sizeof intrinsics", () => {
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
                name: { kind: "identifierPattern", name: "name" },
                type: { kind: "primitiveType", name: "string" },
                initializer: {
                  kind: "nameof",
                  name: "value",
                  inferredType: { kind: "primitiveType", name: "string" },
                },
              },
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "size" },
                type: { kind: "primitiveType", name: "int" },
                initializer: {
                  kind: "sizeof",
                  targetType: { kind: "primitiveType", name: "int" },
                  inferredType: { kind: "primitiveType", name: "int" },
                },
              },
            ],
          },
        ],
        exports: [],
      };
      const result = validateIrSoundness([module]);
      expect(result.ok).to.be.true;
    });
  });

  describe("Cross-module local reference resolution", () => {
    it("allows sibling local types in the same namespace", () => {
      const appModule: IrModule = {
        kind: "module",
        filePath: "/src/application.ts",
        namespace: "TestApp",
        className: "application",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "classDeclaration",
            name: "Application",
            members: [],
            isExported: true,
            isStruct: false,
            implements: [],
            superClass: undefined,
          },
        ],
        exports: [],
      };

      const anonModule: IrModule = {
        kind: "module",
        filePath: "/src/__tsonic_anonymous_types.g.ts",
        namespace: "TestApp",
        className: "__tsonic_anonymous_types",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "classDeclaration",
            name: "__Anon_1234",
            members: [
              {
                kind: "propertyDeclaration",
                name: "owner",
                type: { kind: "referenceType", name: "Application" },
                initializer: undefined,
                emitAsAutoProperty: true,
                isStatic: false,
                isReadonly: false,
                accessibility: "public",
                isRequired: true,
              },
            ],
            isExported: true,
            isStruct: false,
            implements: [],
            superClass: undefined,
          },
        ],
        exports: [],
      };

      const result = validateIrSoundness([appModule, anonModule]);
      expect(result.ok).to.equal(true);
      expect(result.diagnostics).to.have.length(0);
    });

    it("still rejects sibling local types from a different namespace", () => {
      const appModule: IrModule = {
        kind: "module",
        filePath: "/src/application.ts",
        namespace: "TestApp.Runtime",
        className: "application",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "classDeclaration",
            name: "Application",
            members: [],
            isExported: true,
            isStruct: false,
            implements: [],
            superClass: undefined,
          },
        ],
        exports: [],
      };

      const anonModule = createModuleWithType({
        kind: "referenceType",
        name: "Application",
      });

      const result = validateIrSoundness([appModule, anonModule]);
      expect(result.ok).to.equal(false);
      expect(result.diagnostics.some((d) => d.code === "TSN7414")).to.equal(
        true
      );
    });
  });
});
