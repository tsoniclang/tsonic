/**
 * Tests for Generator Wrapper emission
 *
 * Tests:
 * - extractGeneratorTypeArgs type extraction
 * - needsBidirectionalSupport detection
 * - generateWrapperClass output
 *
 * Note: IteratorResult<T> is now in Tsonic.Runtime, not emitted per-module
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  extractGeneratorTypeArgs,
  needsBidirectionalSupport,
  generateWrapperClass,
} from "./generator-wrapper.js";
import { IrFunctionDeclaration, IrType } from "@tsonic/frontend";
import { createContext } from "./types.js";
import {
  printType,
  printTypeDeclaration,
} from "./core/format/backend-ast/printer.js";

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

      expect(printType(result.yieldType)).to.equal("double");
      expect(result.returnType).to.equal(undefined);
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

      expect(printType(result.yieldType)).to.equal("string");
      expect(result.returnType).to.not.equal(undefined);
      if (!result.returnType) {
        throw new Error("Expected returnType for Generator<TYield, TReturn, TNext>");
      }
      expect(printType(result.returnType)).to.equal("double");
      expect(printType(result.nextType)).to.equal("bool");
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

      expect(printType(result.yieldType)).to.equal("double");
      expect(result.returnType).to.equal(undefined);
      expect(result.hasNextType).to.be.false;
    });

    it("should handle non-Generator return type", () => {
      const returnType: IrType = { kind: "primitiveType", name: "number" };
      const context = createContext({ rootNamespace: "Test" });

      const result = extractGeneratorTypeArgs(returnType, context);

      expect(printType(result.yieldType)).to.equal("object");
      expect(result.returnType).to.equal(undefined);
      expect(result.hasNextType).to.be.false;
    });

    it("should handle undefined return type", () => {
      const context = createContext({ rootNamespace: "Test" });

      const result = extractGeneratorTypeArgs(undefined, context);

      expect(printType(result.yieldType)).to.equal("object");
      expect(result.returnType).to.equal(undefined);
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

  // Note: generateIteratorResultStruct tests removed - IteratorResult<T> is now in Tsonic.Runtime

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

      const [wrapperAst] = generateWrapperClass(func, context);
      const code = printTypeDeclaration(wrapperAst, "");

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
      expect(code).to.include(
        "public global::Tsonic.Runtime.IteratorResult<double> next("
      );
      expect(code).to.include("double? value = default");
      expect(code).to.include("_exchange.Input = value");
      expect(code).to.include("MoveNext()");
      expect(code).to.include("_exchange.Output");

      // return() method - takes object when TReturn is void
      expect(code).to.include(
        "public global::Tsonic.Runtime.IteratorResult<double> @return("
      );
      expect(code).to.include("Dispose()");

      // throw() method
      expect(code).to.include(
        "public global::Tsonic.Runtime.IteratorResult<double> @throw(object e)"
      );
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

      const [wrapperAst] = generateWrapperClass(func, context);
      const code = printTypeDeclaration(wrapperAst, "");

      // Async class
      expect(code).to.include("public sealed class asyncCounter_Generator");

      // Async enumerator
      expect(code).to.include("IAsyncEnumerator<asyncCounter_exchange>");
      expect(code).to.include("IAsyncEnumerable<asyncCounter_exchange>");
      expect(code).to.include("GetAsyncEnumerator()");

      // Async next() method
      expect(code).to.include(
        "public async global::System.Threading.Tasks.Task<global::Tsonic.Runtime.IteratorResult<double>> next("
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

      const [wrapperAst] = generateWrapperClass(func, context);
      const code = printTypeDeclaration(wrapperAst, "");

      expect(code).to.include("global::Tsonic.Runtime.IteratorResult<string>");
      expect(code).to.include("string? value = default");
    });
  });
});
