/**
 * Tests for Generator Wrapper emission
 *
 * Tests:
 * - extractGeneratorTypeArgs type extraction
 * - needsBidirectionalSupport detection
 * - generateIteratorResultStruct output
 * - generateWrapperClass output
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  extractGeneratorTypeArgs,
  needsBidirectionalSupport,
  generateIteratorResultStruct,
  generateWrapperClass,
} from "./generator-wrapper.js";
import { IrFunctionDeclaration, IrType } from "@tsonic/frontend";
import { createContext } from "./types.js";

/**
 * Helper to create a generator function declaration
 */
const createGeneratorFunc = (
  name: string,
  returnType: IrType,
  options: { isAsync?: boolean } = {}
): IrFunctionDeclaration => ({
  kind: "functionDeclaration",
  name,
  parameters: [],
  returnType,
  body: { kind: "blockStatement", statements: [] },
  isAsync: options.isAsync ?? false,
  isGenerator: true,
  isExported: true,
});

/**
 * Helper to create a Generator<Y, R, N> type
 */
const createGeneratorType = (
  yieldType: IrType,
  returnType: IrType,
  nextType: IrType
): IrType => ({
  kind: "referenceType",
  name: "Generator",
  typeArguments: [yieldType, returnType, nextType],
});

describe("Generator Wrapper", () => {
  describe("extractGeneratorTypeArgs", () => {
    it("should extract yield type from Generator<number, void, undefined>", () => {
      const returnType = createGeneratorType(
        { kind: "primitiveType", name: "number" },
        { kind: "voidType" },
        { kind: "primitiveType", name: "undefined" }
      );
      const context = createContext({ rootNamespace: "Test" });

      const result = extractGeneratorTypeArgs(returnType, context);

      expect(result.yieldType).to.equal("double");
      expect(result.returnType).to.equal("void");
      expect(result.hasNextType).to.be.false;
    });

    it("should extract all types from Generator<string, number, boolean>", () => {
      const returnType = createGeneratorType(
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "number" },
        { kind: "primitiveType", name: "boolean" }
      );
      const context = createContext({ rootNamespace: "Test" });

      const result = extractGeneratorTypeArgs(returnType, context);

      expect(result.yieldType).to.equal("string");
      expect(result.returnType).to.equal("double");
      expect(result.nextType).to.equal("bool");
      expect(result.hasNextType).to.be.true;
    });

    it("should handle Generator with only yield type", () => {
      const returnType: IrType = {
        kind: "referenceType",
        name: "Generator",
        typeArguments: [{ kind: "primitiveType", name: "number" }],
      };
      const context = createContext({ rootNamespace: "Test" });

      const result = extractGeneratorTypeArgs(returnType, context);

      expect(result.yieldType).to.equal("double");
      expect(result.returnType).to.equal("void");
      expect(result.hasNextType).to.be.false;
    });

    it("should handle non-Generator return type", () => {
      const returnType: IrType = { kind: "primitiveType", name: "number" };
      const context = createContext({ rootNamespace: "Test" });

      const result = extractGeneratorTypeArgs(returnType, context);

      expect(result.yieldType).to.equal("object");
      expect(result.returnType).to.equal("void");
      expect(result.hasNextType).to.be.false;
    });

    it("should handle undefined return type", () => {
      const context = createContext({ rootNamespace: "Test" });

      const result = extractGeneratorTypeArgs(undefined, context);

      expect(result.yieldType).to.equal("object");
      expect(result.returnType).to.equal("void");
      expect(result.hasNextType).to.be.false;
    });
  });

  describe("needsBidirectionalSupport", () => {
    it("should return true for Generator<number, void, number>", () => {
      const func = createGeneratorFunc(
        "test",
        createGeneratorType(
          { kind: "primitiveType", name: "number" },
          { kind: "voidType" },
          { kind: "primitiveType", name: "number" }
        )
      );

      expect(needsBidirectionalSupport(func)).to.be.true;
    });

    it("should return false for Generator<number, void, undefined>", () => {
      const func = createGeneratorFunc(
        "test",
        createGeneratorType(
          { kind: "primitiveType", name: "number" },
          { kind: "voidType" },
          { kind: "primitiveType", name: "undefined" }
        )
      );

      expect(needsBidirectionalSupport(func)).to.be.false;
    });

    it("should return false for Generator with only yield type", () => {
      const func = createGeneratorFunc("test", {
        kind: "referenceType",
        name: "Generator",
        typeArguments: [{ kind: "primitiveType", name: "number" }],
      });

      expect(needsBidirectionalSupport(func)).to.be.false;
    });

    it("should return false for non-generator functions", () => {
      const func: IrFunctionDeclaration = {
        kind: "functionDeclaration",
        name: "test",
        parameters: [],
        returnType: { kind: "primitiveType", name: "number" },
        body: { kind: "blockStatement", statements: [] },
        isAsync: false,
        isGenerator: false,
        isExported: true,
      };

      expect(needsBidirectionalSupport(func)).to.be.false;
    });
  });

  describe("generateIteratorResultStruct", () => {
    it("should generate correct struct", () => {
      const context = createContext({ rootNamespace: "Test" });

      const [code] = generateIteratorResultStruct(context);

      expect(code).to.include("public readonly record struct IteratorResult<T>");
      expect(code).to.include("T value");
      expect(code).to.include("bool done");
    });
  });

  describe("generateWrapperClass", () => {
    it("should generate wrapper class for sync generator", () => {
      const func = createGeneratorFunc(
        "counter",
        createGeneratorType(
          { kind: "primitiveType", name: "number" },
          { kind: "voidType" },
          { kind: "primitiveType", name: "number" }
        )
      );
      const context = createContext({ rootNamespace: "Test" });

      const [code] = generateWrapperClass(func, context);

      // Class declaration
      expect(code).to.include("public sealed class counter_Generator");

      // Private fields
      expect(code).to.include("private readonly");
      expect(code).to.include("IEnumerator<counter_exchange>");
      expect(code).to.include("_enumerator");
      expect(code).to.include("counter_exchange _exchange");
      expect(code).to.include("bool _done = false");

      // Constructor
      expect(code).to.include("public counter_Generator(");
      expect(code).to.include("IEnumerable<counter_exchange> enumerable");
      expect(code).to.include("GetEnumerator()");

      // next() method
      expect(code).to.include("public IteratorResult<double> next(");
      expect(code).to.include("double? value = default");
      expect(code).to.include("_exchange.Input = value");
      expect(code).to.include("MoveNext()");
      expect(code).to.include("_exchange.Output");

      // return() method
      expect(code).to.include("public IteratorResult<double> @return(");
      expect(code).to.include("Dispose()");

      // throw() method
      expect(code).to.include("public IteratorResult<double> @throw(object e)");
      expect(code).to.include("System.Exception");
    });

    it("should generate async wrapper class for async generator", () => {
      const func = createGeneratorFunc(
        "asyncCounter",
        {
          kind: "referenceType",
          name: "AsyncGenerator",
          typeArguments: [
            { kind: "primitiveType", name: "number" },
            { kind: "voidType" },
            { kind: "primitiveType", name: "number" },
          ],
        },
        { isAsync: true }
      );
      const context = createContext({ rootNamespace: "Test" });

      const [code] = generateWrapperClass(func, context);

      // Async class
      expect(code).to.include("public sealed class asyncCounter_Generator");

      // Async enumerator
      expect(code).to.include("IAsyncEnumerator<asyncCounter_exchange>");
      expect(code).to.include("IAsyncEnumerable<asyncCounter_exchange>");
      expect(code).to.include("GetAsyncEnumerator()");

      // Async next() method
      expect(code).to.include(
        "public async global::System.Threading.Tasks.Task<IteratorResult<double>> next("
      );
      expect(code).to.include("await _enumerator.MoveNextAsync()");

      // Async return() method
      expect(code).to.include("public async");
      expect(code).to.include("DisposeAsync()");
    });

    it("should use correct type for non-number yield type", () => {
      const func = createGeneratorFunc(
        "stringGen",
        createGeneratorType(
          { kind: "primitiveType", name: "string" },
          { kind: "voidType" },
          { kind: "primitiveType", name: "string" }
        )
      );
      const context = createContext({ rootNamespace: "Test" });

      const [code] = generateWrapperClass(func, context);

      expect(code).to.include("IteratorResult<string>");
      expect(code).to.include("string? value = default");
    });
  });
});
