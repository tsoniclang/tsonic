/**
 * Tests for IR Soundness Gate – Reference Type Resolvability
 *
 * Validates that the soundness gate correctly handles reference types:
 * - Types with resolvedClrType are allowed
 * - Known CLR binding types are allowed
 * - tsbindgen instance aliases are allowed when base alias is known
 * - Known builtins (Array, Promise, PromiseLike, ReadonlyArray, ArrayLike, AsyncIterable)
 * - C# primitive types (int, decimal)
 * - Local types (class, interface, type alias, enum)
 * - Imported types (CLR, local, aliased, instance companion)
 * - Unresolved external types are rejected
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { validateIrSoundness } from "../soundness-gate.js";
import { createModuleWithType } from "./test-helpers.js";

describe("IR Soundness Gate", () => {
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

    it("should allow tsbindgen instance aliases when the base alias is known", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "MkdirOptions$instance",
      });

      const result = validateIrSoundness([module], {
        knownReferenceTypes: new Set(["MkdirOptions"]),
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

    it("should allow known builtin PromiseLike", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "PromiseLike",
        typeArguments: [{ kind: "primitiveType", name: "string" }],
      });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
    });

    it("should allow known builtin ReadonlyArray", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "ReadonlyArray",
        typeArguments: [{ kind: "primitiveType", name: "number" }],
      });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
    });

    it("should allow compiler-synthesized ArrayLike", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "ArrayLike",
        typeArguments: [{ kind: "primitiveType", name: "number" }],
      });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
    });

    it("should allow known builtin AsyncIterable", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "AsyncIterable",
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

    it("should allow namespace-qualified local class type in the current namespace", () => {
      const module = createModuleWithType(
        { kind: "referenceType", name: "Test.TypedArrayBase" },
        {
          additionalBody: [
            {
              kind: "classDeclaration",
              name: "TypedArrayBase",
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

    it("should reject namespace-qualified local class type outside the current namespace", () => {
      const module = createModuleWithType(
        { kind: "referenceType", name: "Other.TypedArrayBase" },
        {
          additionalBody: [
            {
              kind: "classDeclaration",
              name: "TypedArrayBase",
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

      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN7414")).to.equal(
        true
      );
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

    it("should allow imported tsbindgen instance companion types", () => {
      const module = createModuleWithType(
        { kind: "referenceType", name: "IncomingMessage$instance" },
        {
          imports: [
            {
              kind: "import",
              source: "node:http",
              specifiers: [
                {
                  kind: "named",
                  name: "IncomingMessage",
                  localName: "IncomingMessage",
                  isType: true,
                },
              ],
              isLocal: false,
              isClr: true,
              resolvedNamespace: "nodejs.Http",
            },
          ],
        }
      );

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
    });

    it("should allow imported aliased types when IR normalizes to the exported name", () => {
      const module = createModuleWithType(
        { kind: "referenceType", name: "Event" },
        {
          imports: [
            {
              kind: "import",
              source: "./entities.ts",
              specifiers: [
                {
                  kind: "named",
                  name: "Event",
                  localName: "EventEntity",
                  isType: true,
                },
              ],
              isLocal: true,
              isClr: false,
              resolvedPath: "/src/entities.ts",
              resolvedNamespace: "Test.entities",
              targetContainerName: "entities",
            },
          ],
        }
      );

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
    });

    it("should allow imported aliased instance companion types when IR normalizes to the exported name", () => {
      const module = createModuleWithType(
        { kind: "referenceType", name: "Event$instance" },
        {
          imports: [
            {
              kind: "import",
              source: "./entities.ts",
              specifiers: [
                {
                  kind: "named",
                  name: "Event",
                  localName: "EventEntity",
                  isType: true,
                },
              ],
              isLocal: true,
              isClr: false,
              resolvedPath: "/src/entities.ts",
              resolvedNamespace: "Test.entities",
              targetContainerName: "entities",
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
});
