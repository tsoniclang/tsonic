import {
  baseContext,
  createModuleWithType,
  describe,
  emitModule,
  emitReferenceType,
  expect,
  it,
  printType,
} from "./helpers.js";
import type { FrontendTypeBinding } from "./helpers.js";
import type { LocalTypeInfo } from "../../emitter-types/core.js";
describe("Reference Type Emission", () => {
  describe("C# Primitive Types", () => {
    it("should emit every real C# predefined reference keyword without qualification", () => {
      const keywords = [
        "bool",
        "byte",
        "sbyte",
        "short",
        "ushort",
        "int",
        "uint",
        "long",
        "ulong",
        "nint",
        "nuint",
        "char",
        "float",
        "double",
        "decimal",
        "string",
        "object",
      ] as const;

      for (const keyword of keywords) {
        const module = createModuleWithType({
          kind: "referenceType",
          name: keyword,
        });

        const result = emitModule(module);
        expect(result).to.include(`${keyword} x`);
      }
    });

    it("should emit exact BCL numeric aliases as System value types", () => {
      const cases = [
        ["half", "global::System.Half"],
        ["int128", "global::System.Int128"],
        ["uint128", "global::System.UInt128"],
      ] as const;

      for (const [typeName, expected] of cases) {
        const [typeAst] = emitReferenceType(
          {
            kind: "referenceType",
            name: typeName,
          },
          baseContext
        );

        expect(printType(typeAst)).to.equal(expected);
      }
    });
  });

  describe("Known Builtin Types", () => {
    it("should emit Array<T> as native T[] array", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Array",
        typeArguments: [{ kind: "primitiveType", name: "number" }],
      });

      const result = emitModule(module);

      expect(result).to.include("double[]");
      expect(result).not.to.include("List");
    });

    it("should let a concrete local Array<T> class win over builtin array lowering", () => {
      const [typeAst] = emitReferenceType(
        {
          kind: "referenceType",
          name: "Array",
          typeArguments: [{ kind: "primitiveType", name: "number" }],
        },
        {
          ...baseContext,
          localTypes: new Map<string, LocalTypeInfo>([
            [
              "Array",
              {
                kind: "class",
                typeParameters: ["T"],
                members: [],
                implements: [],
              },
            ],
          ]),
        }
      );

      expect(printType(typeAst)).to.equal("Array<double>");
    });

    it("should emit Promise<T> as Task<T>", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Promise",
        typeArguments: [{ kind: "primitiveType", name: "string" }],
      });

      const result = emitModule(module);

      expect(result).to.include("global::System.Threading.Tasks.Task<string>");
    });

    it("should emit PromiseLike<T> as Task<T>", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "PromiseLike",
        typeArguments: [{ kind: "primitiveType", name: "string" }],
      });

      const result = emitModule(module);

      expect(result).to.include("global::System.Threading.Tasks.Task<string>");
    });

    it("should emit Error when provided through emitter bindings", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Error",
      });

      const errorBinding: FrontendTypeBinding = {
        name: "js.Error",
        alias: "Error",
        kind: "class",
        members: [],
      };

      const result = emitModule(module, {
        clrBindings: new Map([["Error", errorBinding]]),
      });

      expect(result).to.include("global::js.Error x");
    });
  });
});
