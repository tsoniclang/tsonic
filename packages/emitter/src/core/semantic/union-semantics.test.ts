import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "@tsonic/frontend";
import { isSemanticUnion, willCarryAsRuntimeUnion } from "./union-semantics.js";
import { createContext } from "../../emitter-types/context.js";

const mkRef = (name: string): IrType => ({
  kind: "referenceType",
  name,
  resolvedClrType: `Test.${name}`,
});

describe("union-semantics", () => {
  describe("isSemanticUnion", () => {
    it("returns true for a 2-member union", () => {
      const type: IrType = {
        kind: "unionType",
        types: [mkRef("A"), mkRef("B")],
      };
      const context = createContext({ rootNamespace: "Test" });
      expect(isSemanticUnion(type, context)).to.be.true;
    });

    it("returns true after stripping nullish", () => {
      const type: IrType = {
        kind: "unionType",
        types: [
          mkRef("A"),
          mkRef("B"),
          { kind: "primitiveType", name: "null" },
        ],
      };
      const context = createContext({ rootNamespace: "Test" });
      expect(isSemanticUnion(type, context)).to.be.true;
    });

    it("returns false for non-union type", () => {
      const type: IrType = { kind: "primitiveType", name: "string" };
      const context = createContext({ rootNamespace: "Test" });
      expect(isSemanticUnion(type, context)).to.be.false;
    });

    it("returns false for single-member-after-nullish-strip", () => {
      const type: IrType = {
        kind: "unionType",
        types: [mkRef("A"), { kind: "primitiveType", name: "undefined" }],
      };
      const context = createContext({ rootNamespace: "Test" });
      expect(isSemanticUnion(type, context)).to.be.false;
    });

    it("returns true for wide union (> 8 members)", () => {
      const type: IrType = {
        kind: "unionType",
        types: Array.from({ length: 9 }, (_, i) => mkRef(`T${i}`)),
      };
      const context = createContext({ rootNamespace: "Test" });
      expect(isSemanticUnion(type, context)).to.be.true;
    });

    it("returns true for nested union with >= 2 top-level non-nullish members", () => {
      const inner: IrType = {
        kind: "unionType",
        types: [mkRef("A"), mkRef("B")],
      };
      const type: IrType = {
        kind: "unionType",
        types: [inner, mkRef("C")],
      };
      const context = createContext({ rootNamespace: "Test" });
      expect(isSemanticUnion(type, context)).to.be.true;
    });
  });

  describe("willCarryAsRuntimeUnion", () => {
    it("returns true for 2-member union", () => {
      const type: IrType = {
        kind: "unionType",
        types: [mkRef("A"), mkRef("B")],
      };
      const context = createContext({ rootNamespace: "Test" });
      expect(willCarryAsRuntimeUnion(type, context)).to.be.true;
    });

    it("returns true for 8-member union", () => {
      const type: IrType = {
        kind: "unionType",
        types: Array.from({ length: 8 }, (_, i) => mkRef(`T${i}`)),
      };
      const context = createContext({ rootNamespace: "Test" });
      expect(willCarryAsRuntimeUnion(type, context)).to.be.true;
    });

    it("returns true for wide unions beyond the old 8-member cap", () => {
      const type: IrType = {
        kind: "unionType",
        types: Array.from({ length: 9 }, (_, i) => mkRef(`T${i}`)),
      };
      const context = createContext({ rootNamespace: "Test" });
      expect(willCarryAsRuntimeUnion(type, context)).to.be.true;
    });

    it("returns false for non-union", () => {
      const type: IrType = { kind: "primitiveType", name: "number" };
      const context = createContext({ rootNamespace: "Test" });
      expect(willCarryAsRuntimeUnion(type, context)).to.be.false;
    });
  });

  describe("semantic vs runtime separation", () => {
    it("wide unions remain both semantic unions and carried runtime unions", () => {
      const type: IrType = {
        kind: "unionType",
        types: Array.from({ length: 9 }, (_, i) => mkRef(`T${i}`)),
      };
      const context = createContext({ rootNamespace: "Test" });
      expect(isSemanticUnion(type, context)).to.be.true;
      expect(willCarryAsRuntimeUnion(type, context)).to.be.true;
    });
  });
});
