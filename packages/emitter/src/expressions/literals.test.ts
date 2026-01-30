/**
 * Tests for literal emission
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { IrExpression, IrType } from "@tsonic/frontend";
import { emitLiteral } from "./literals.js";
import { EmitterContext, EmitterOptions } from "../types.js";

describe("emitLiteral", () => {
  const defaultOptions: EmitterOptions = {
    rootNamespace: "Test",
    indent: 4,
  };

  const createContext = (
    typeParameters?: ReadonlySet<string>
  ): EmitterContext => ({
    indentLevel: 0,
    options: defaultOptions,
    isStatic: false,
    isAsync: false,
    typeParameters,
    usings: new Set<string>(),
  });

  describe("null literal", () => {
    it("emits 'null' when expectedType is not provided", () => {
      const expr: Extract<IrExpression, { kind: "literal" }> = {
        kind: "literal",
        value: null,
      };
      const context = createContext();

      const [fragment] = emitLiteral(expr, context);

      expect(fragment.text).to.equal("null");
    });

    it("emits 'null' when expectedType is concrete (no type parameters)", () => {
      const expr: Extract<IrExpression, { kind: "literal" }> = {
        kind: "literal",
        value: null,
      };
      const expectedType: IrType = { kind: "primitiveType", name: "string" };
      const context = createContext(new Set(["T"]));

      const [fragment] = emitLiteral(expr, context, expectedType);

      expect(fragment.text).to.equal("null");
    });

    it("emits 'default' when expectedType contains type parameter", () => {
      const expr: Extract<IrExpression, { kind: "literal" }> = {
        kind: "literal",
        value: null,
      };
      const expectedType: IrType = { kind: "typeParameterType", name: "T" };
      const context = createContext(new Set(["T"]));

      const [fragment] = emitLiteral(expr, context, expectedType);

      expect(fragment.text).to.equal("default");
    });

    it("emits 'default' when expectedType is Array<T> with type parameter", () => {
      const expr: Extract<IrExpression, { kind: "literal" }> = {
        kind: "literal",
        value: null,
      };
      const expectedType: IrType = {
        kind: "referenceType",
        name: "Array",
        typeArguments: [{ kind: "typeParameterType", name: "T" }],
      };
      const context = createContext(new Set(["T"]));

      const [fragment] = emitLiteral(expr, context, expectedType);

      expect(fragment.text).to.equal("default");
    });

    it("emits 'null' when expectedType is Array<string> (concrete)", () => {
      const expr: Extract<IrExpression, { kind: "literal" }> = {
        kind: "literal",
        value: null,
      };
      const expectedType: IrType = {
        kind: "referenceType",
        name: "Array",
        typeArguments: [{ kind: "primitiveType", name: "string" }],
      };
      const context = createContext(new Set(["T"]));

      const [fragment] = emitLiteral(expr, context, expectedType);

      expect(fragment.text).to.equal("null");
    });

    it("emits 'default' when expectedType uses legacy referenceType for type param", () => {
      const expr: Extract<IrExpression, { kind: "literal" }> = {
        kind: "literal",
        value: null,
      };
      // Legacy: type parameter represented as referenceType
      const expectedType: IrType = { kind: "referenceType", name: "T" };
      const context = createContext(new Set(["T"]));

      const [fragment] = emitLiteral(expr, context, expectedType);

      expect(fragment.text).to.equal("default");
    });

    // Bug 2 regression: null to value type (CS0037)
    it("emits 'default' when expectedType is number (value type)", () => {
      const expr: Extract<IrExpression, { kind: "literal" }> = {
        kind: "literal",
        value: null,
      };
      // number is a value type (double in C#), null is invalid
      const expectedType: IrType = { kind: "primitiveType", name: "number" };
      const context = createContext();

      const [fragment] = emitLiteral(expr, context, expectedType);

      expect(fragment.text).to.equal("default");
    });

    it("emits 'default' when expectedType is number | null union (value type after stripNullish)", () => {
      const expr: Extract<IrExpression, { kind: "literal" }> = {
        kind: "literal",
        value: null,
      };
      // Result<number, string>.value is substituted to number | null
      // After stripNullish, it's number (a value type)
      const expectedType: IrType = {
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "number" },
          { kind: "primitiveType", name: "null" },
        ],
      };
      const context = createContext();

      const [fragment] = emitLiteral(expr, context, expectedType);

      expect(fragment.text).to.equal("default");
    });

    it("emits 'default' when expectedType is boolean (value type)", () => {
      const expr: Extract<IrExpression, { kind: "literal" }> = {
        kind: "literal",
        value: null,
      };
      // boolean is a value type (bool in C#), null is invalid
      const expectedType: IrType = { kind: "primitiveType", name: "boolean" };
      const context = createContext();

      const [fragment] = emitLiteral(expr, context, expectedType);

      expect(fragment.text).to.equal("default");
    });
  });

  describe("undefined literal", () => {
    it("emits 'default' for undefined", () => {
      const expr: Extract<IrExpression, { kind: "literal" }> = {
        kind: "literal",
        value: undefined,
      };
      const context = createContext();

      const [fragment] = emitLiteral(expr, context);

      expect(fragment.text).to.equal("default");
    });
  });

  describe("number literal", () => {
    it("emits integer literals as-is (lets C# infer type)", () => {
      const expr: Extract<IrExpression, { kind: "literal" }> = {
        kind: "literal",
        value: 42,
      };
      const context = createContext();

      const [fragment] = emitLiteral(expr, context);

      expect(fragment.text).to.equal("42");
    });

    it("emits decimal literals as-is (lets C# infer double)", () => {
      const expr: Extract<IrExpression, { kind: "literal" }> = {
        kind: "literal",
        value: 3.14,
      };
      const context = createContext();

      const [fragment] = emitLiteral(expr, context);

      expect(fragment.text).to.equal("3.14");
    });

    it("emits integer format in array index context", () => {
      const expr: Extract<IrExpression, { kind: "literal" }> = {
        kind: "literal",
        value: 42,
      };
      const context: EmitterContext = {
        ...createContext(),
        isArrayIndex: true,
      };

      const [fragment] = emitLiteral(expr, context);

      expect(fragment.text).to.equal("42");
    });
  });

  describe("string literal", () => {
    it("emits escaped string", () => {
      const expr: Extract<IrExpression, { kind: "literal" }> = {
        kind: "literal",
        value: "hello\nworld",
      };
      const context = createContext();

      const [fragment] = emitLiteral(expr, context);

      expect(fragment.text).to.equal('"hello\\nworld"');
    });
  });

  describe("boolean literal", () => {
    it("emits true", () => {
      const expr: Extract<IrExpression, { kind: "literal" }> = {
        kind: "literal",
        value: true,
      };
      const context = createContext();

      const [fragment] = emitLiteral(expr, context);

      expect(fragment.text).to.equal("true");
    });

    it("emits false", () => {
      const expr: Extract<IrExpression, { kind: "literal" }> = {
        kind: "literal",
        value: false,
      };
      const context = createContext();

      const [fragment] = emitLiteral(expr, context);

      expect(fragment.text).to.equal("false");
    });
  });
});
