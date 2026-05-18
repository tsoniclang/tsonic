/**
 * Tests for IR Soundness Gate – anyType Detection and Primitive Types
 *
 * Validates that the soundness gate correctly:
 * - Rejects anyType in variable declarations (TSN7414)
 * - Rejects anyType in nested positions (array element type)
 * - Rejects anyType in function parameters
 * - Rejects unknownType in successful IR
 * - Allows primitive types (string, number, void)
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import type {
  BackendCapability,
  BackendCapabilityManifest,
  FeatureKey,
} from "../../../capabilities/backend-capabilities.js";
import {
  validateCapabilityAcceptability,
  validateIrSoundness,
  validateUniversalHygiene,
} from "../soundness-gate.js";
import { IrModule } from "../../types.js";
import { createModuleWithType } from "./test-helpers.js";

const capabilityEntry = (
  name: FeatureKey,
  status: BackendCapability["status"]
): BackendCapability => ({
  name,
  status,
  diagnosticCode: "TSN5001",
  diagnosticMessage: `Backend does not support ${name}.`,
  remediation: `Enable ${name} or rewrite the source feature.`,
});

const manifestWith = (
  name: FeatureKey,
  status: BackendCapability["status"]
): BackendCapabilityManifest => new Map([[name, capabilityEntry(name, status)]]);

describe("IR Soundness Gate", () => {
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

      const result = validateIrSoundness([module], {
        knownReferenceTypes: new Set(["Foo", "Bar"]),
      });

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

    it("should reject unknownType in successful IR", () => {
      const module = createModuleWithType({ kind: "unknownType" });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics[0]?.code).to.equal("TSN7414");
    });

    it("should reject intersectionType as runtime storage", () => {
      const module = createModuleWithType({
        kind: "intersectionType",
        types: [
          { kind: "referenceType", name: "Foo" },
          { kind: "referenceType", name: "Bar" },
        ],
      });

      const result = validateIrSoundness([module], {
        knownReferenceTypes: new Set(["Foo", "Bar"]),
      });

      expect(result.ok).to.be.false;
      expect(result.diagnostics[0]?.code).to.equal("TSN7414");
      expect(result.diagnostics[0]?.message).to.include(
        "cannot be emitted as a runtime storage type"
      );
    });

    it("should keep universal hygiene separate from capability acceptability", () => {
      const module = createModuleWithType({
        kind: "intersectionType",
        types: [
          { kind: "referenceType", name: "Foo" },
          { kind: "referenceType", name: "Bar" },
        ],
      });

      const options = {
        knownReferenceTypes: new Set(["Foo", "Bar"]),
      };
      const universal = validateUniversalHygiene([module], options);
      const capability = validateCapabilityAcceptability([module], options);

      expect(universal.ok).to.equal(true);
      expect(
        universal.diagnostics.some((diagnostic) =>
          diagnostic.message.includes("runtime storage type")
        )
      ).to.equal(false);
      expect(capability.ok).to.equal(false);
      expect(capability.diagnostics[0]?.message).to.include(
        "runtime storage type"
      );
    });

    it("should make intersection runtime storage controlled by the capability manifest", () => {
      const module = createModuleWithType({
        kind: "intersectionType",
        types: [
          { kind: "referenceType", name: "Foo" },
          { kind: "referenceType", name: "Bar" },
        ],
      });

      const result = validateCapabilityAcceptability([module], {
        knownReferenceTypes: new Set(["Foo", "Bar"]),
        backendCapabilities: manifestWith("intersection-value-storage", "supported"),
      });

      expect(result.ok).to.equal(true);
    });

    it("should reject unsupported parameter passing modes during capability validation", () => {
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
            name: "read",
            parameters: [
              {
                kind: "parameter",
                pattern: { kind: "identifierPattern", name: "value" },
                type: { kind: "primitiveType", name: "int" },
                isOptional: false,
                isRest: false,
                passing: "out",
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

      const blocked = validateCapabilityAcceptability([module], {
        backendCapabilities: manifestWith("out-parameters", "unsupported"),
      });
      const supported = validateCapabilityAcceptability([module], {
        backendCapabilities: manifestWith("out-parameters", "supported"),
      });

      expect(blocked.ok).to.equal(false);
      expect(blocked.diagnostics[0]?.message).to.include("out-parameters");
      expect(supported.ok).to.equal(true);
    });

    it("should reject unsupported generators during capability validation", () => {
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
            name: "values",
            parameters: [],
            returnType: { kind: "voidType" },
            body: { kind: "blockStatement", statements: [] },
            isExported: false,
            isAsync: false,
            isGenerator: true,
          },
        ],
        exports: [],
      };

      const blocked = validateCapabilityAcceptability([module], {
        backendCapabilities: manifestWith("generators", "unsupported"),
      });
      const supported = validateCapabilityAcceptability([module], {
        backendCapabilities: manifestWith("generators", "supported"),
      });

      expect(blocked.ok).to.equal(false);
      expect(blocked.diagnostics[0]?.message).to.include("generators");
      expect(supported.ok).to.equal(true);
    });

    it("should reject unsupported bigint during capability validation", () => {
      const module = createModuleWithType({
        kind: "primitiveType",
        name: "bigint",
      });

      const blocked = validateCapabilityAcceptability([module], {
        backendCapabilities: manifestWith("bigint", "unsupported"),
      });
      const supported = validateCapabilityAcceptability([module], {
        backendCapabilities: manifestWith("bigint", "supported"),
      });

      expect(blocked.ok).to.equal(false);
      expect(blocked.diagnostics[0]?.message).to.include("bigint");
      expect(supported.ok).to.equal(true);
    });

    it("should allow expression-only intersection metadata for overload sets", () => {
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
              kind: "identifier",
              name: "overloaded",
              inferredType: {
                kind: "intersectionType",
                types: [
                  {
                    kind: "functionType",
                    parameters: [
                      {
                        kind: "parameter",
                        pattern: { kind: "identifierPattern", name: "value" },
                        type: { kind: "primitiveType", name: "string" },
                        isOptional: false,
                        isRest: false,
                        passing: "value",
                      },
                    ],
                    returnType: { kind: "primitiveType", name: "string" },
                  },
                  {
                    kind: "functionType",
                    parameters: [
                      {
                        kind: "parameter",
                        pattern: { kind: "identifierPattern", name: "value" },
                        type: { kind: "primitiveType", name: "int" },
                        isOptional: false,
                        isRest: false,
                        passing: "value",
                      },
                    ],
                    returnType: { kind: "primitiveType", name: "int" },
                  },
                ],
              },
            },
          },
        ],
        exports: [],
      };

      const result = validateIrSoundness([module]);

      expect(result.ok).to.equal(true);
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
});
