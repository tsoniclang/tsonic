/**
 * Tests for the local-names semantic/storage type channel plumbing.
 *
 * Verifies that:
 * - registerLocalSymbolTypes populates both channels independently
 * - registerLocalFixedType writes the same value to both channels
 * - withScoped preserves localSemanticTypes across scope boundaries
 * - catch-scope restoration prevents type leakage
 * - semantic channel preserves alias-shaped types while storage normalizes
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import {
  registerLocalSymbolTypes,
  registerLocalFixedType,
  registerLocalSemanticType,
} from "./local-names.js";
import { withScoped } from "../../emitter-types/context.js";
import { resolveEffectiveExpressionType } from "../semantic/narrowed-expression-types.js";

const baseContext: EmitterContext = {
  indentLevel: 0,
  options: { rootNamespace: "Test", indent: 4 },
  isStatic: false,
  isAsync: false,
  usings: new Set<string>(),
};

const stringType: IrType = { kind: "primitiveType", name: "string" };
const numberType: IrType = { kind: "primitiveType", name: "number" };
const unknownType: IrType = { kind: "unknownType" };

const aliasedUnion: IrType = {
  kind: "unionType",
  types: [stringType, numberType],
};

const storageObject: IrType = { kind: "anyType" };

describe("local-names semantic/storage channels", () => {
  describe("registerLocalSymbolTypes", () => {
    it("populates both localSemanticTypes and localValueTypes", () => {
      const ctx = registerLocalSymbolTypes(
        "x",
        aliasedUnion,
        storageObject,
        baseContext
      );
      expect(ctx.localSemanticTypes?.get("x")).to.deep.equal(aliasedUnion);
      expect(ctx.localValueTypes?.get("x")).to.deep.equal(storageObject);
    });

    it("populates only semantic when storage is undefined", () => {
      const ctx = registerLocalSymbolTypes(
        "x",
        aliasedUnion,
        undefined,
        baseContext
      );
      expect(ctx.localSemanticTypes?.get("x")).to.deep.equal(aliasedUnion);
      expect(ctx.localValueTypes?.has("x")).to.not.equal(true);
    });

    it("populates only storage when semantic is undefined", () => {
      const ctx = registerLocalSymbolTypes(
        "x",
        undefined,
        storageObject,
        baseContext
      );
      expect(ctx.localSemanticTypes?.has("x")).to.not.equal(true);
      expect(ctx.localValueTypes?.get("x")).to.deep.equal(storageObject);
    });

    it("returns context unchanged when both are undefined", () => {
      const ctx = registerLocalSymbolTypes(
        "x",
        undefined,
        undefined,
        baseContext
      );
      expect(ctx).to.equal(baseContext);
    });

    it("preserves existing entries when adding new ones", () => {
      const ctx1 = registerLocalSymbolTypes(
        "a",
        stringType,
        numberType,
        baseContext
      );
      const ctx2 = registerLocalSymbolTypes("b", numberType, stringType, ctx1);
      expect(ctx2.localSemanticTypes?.get("a")).to.deep.equal(stringType);
      expect(ctx2.localSemanticTypes?.get("b")).to.deep.equal(numberType);
      expect(ctx2.localValueTypes?.get("a")).to.deep.equal(numberType);
      expect(ctx2.localValueTypes?.get("b")).to.deep.equal(stringType);
    });
  });

  describe("registerLocalFixedType", () => {
    it("writes the same type to both channels", () => {
      const ctx = registerLocalFixedType("k", stringType, baseContext);
      expect(ctx.localSemanticTypes?.get("k")).to.deep.equal(stringType);
      expect(ctx.localValueTypes?.get("k")).to.deep.equal(stringType);
    });
  });

  describe("shadowing clears stale outer channel entries", () => {
    const outerCtx = registerLocalSymbolTypes(
      "x",
      aliasedUnion,
      storageObject,
      baseContext
    );

    it("semantic-only inner binding clears outer storage for same name", () => {
      const innerCtx = registerLocalSymbolTypes(
        "x",
        stringType,
        undefined,
        outerCtx
      );
      expect(innerCtx.localSemanticTypes?.get("x")).to.deep.equal(stringType);
      expect(innerCtx.localValueTypes?.has("x")).to.equal(false);
    });

    it("storage-only inner binding clears outer semantic for same name", () => {
      const innerCtx = registerLocalSymbolTypes(
        "x",
        undefined,
        numberType,
        outerCtx
      );
      expect(innerCtx.localSemanticTypes?.has("x")).to.equal(false);
      expect(innerCtx.localValueTypes?.get("x")).to.deep.equal(numberType);
    });

    it("both-undefined inner binding clears both outer channels for same name", () => {
      const innerCtx = registerLocalSymbolTypes(
        "x",
        undefined,
        undefined,
        outerCtx
      );
      expect(innerCtx.localSemanticTypes?.has("x")).to.equal(false);
      expect(innerCtx.localValueTypes?.has("x")).to.equal(false);
    });

    it("shadowing does not affect other names in the maps", () => {
      const twoNames = registerLocalSymbolTypes(
        "y",
        numberType,
        stringType,
        outerCtx
      );
      const shadowed = registerLocalSymbolTypes(
        "x",
        stringType,
        undefined,
        twoNames
      );
      // x is shadowed
      expect(shadowed.localSemanticTypes?.get("x")).to.deep.equal(stringType);
      expect(shadowed.localValueTypes?.has("x")).to.equal(false);
      // y is untouched
      expect(shadowed.localSemanticTypes?.get("y")).to.deep.equal(numberType);
      expect(shadowed.localValueTypes?.get("y")).to.deep.equal(stringType);
    });
  });

  describe("withScoped preserves localSemanticTypes", () => {
    it("restores outer localSemanticTypes after scoped emission", () => {
      const outerCtx = registerLocalSymbolTypes(
        "outer",
        aliasedUnion,
        storageObject,
        baseContext
      );

      const [, restoredCtx] = withScoped(
        outerCtx,
        {
          localSemanticTypes: new Map(outerCtx.localSemanticTypes ?? []),
          localValueTypes: new Map(outerCtx.localValueTypes ?? []),
        },
        (scopedCtx) => {
          // Simulate inner scope adding a binding
          const innerCtx = registerLocalSymbolTypes(
            "inner",
            stringType,
            numberType,
            scopedCtx
          );
          // Inner scope should see both
          expect(innerCtx.localSemanticTypes?.get("inner")).to.deep.equal(
            stringType
          );
          expect(innerCtx.localSemanticTypes?.get("outer")).to.deep.equal(
            aliasedUnion
          );
          return ["result", innerCtx];
        }
      );

      // After restore: outer binding preserved, inner binding gone
      expect(restoredCtx.localSemanticTypes?.get("outer")).to.deep.equal(
        aliasedUnion
      );
      expect(restoredCtx.localSemanticTypes?.has("inner")).to.equal(false);
      expect(restoredCtx.localValueTypes?.get("outer")).to.deep.equal(
        storageObject
      );
      expect(restoredCtx.localValueTypes?.has("inner")).to.equal(false);
    });

    it("does not leak if-branch bindings to else branch", () => {
      const outerCtx = registerLocalSymbolTypes(
        "x",
        aliasedUnion,
        storageObject,
        baseContext
      );

      // Simulate if-branch scope
      const [, afterIfCtx] = withScoped(
        outerCtx,
        {
          localSemanticTypes: new Map(outerCtx.localSemanticTypes ?? []),
          localValueTypes: new Map(outerCtx.localValueTypes ?? []),
        },
        (scopedCtx) => {
          const branchCtx = registerLocalSymbolTypes(
            "branchOnly",
            stringType,
            stringType,
            scopedCtx
          );
          return ["result", branchCtx];
        }
      );

      // branchOnly must not leak
      expect(afterIfCtx.localSemanticTypes?.has("branchOnly")).to.equal(false);
      expect(afterIfCtx.localValueTypes?.has("branchOnly")).to.equal(false);
    });
  });

  describe("catch-scope non-leakage", () => {
    it("catch variable does not leak past catch block restoration", () => {
      const outerSemantic = new Map<string, IrType>([["x", aliasedUnion]]);
      const outerStorage = new Map<string, IrType>([["x", storageObject]]);

      const outerCtx: EmitterContext = {
        ...baseContext,
        localSemanticTypes: outerSemantic,
        localValueTypes: outerStorage,
      };

      // Simulate catch scope: add catch variable
      const catchCtx = registerLocalSymbolTypes(
        "ex",
        unknownType,
        {
          kind: "referenceType",
          name: "System.Exception",
          resolvedClrType: "global::System.Exception",
        },
        outerCtx
      );

      // Verify catch scope has the binding
      expect(catchCtx.localSemanticTypes?.get("ex")).to.deep.equal(unknownType);
      expect(catchCtx.localValueTypes?.get("ex")?.kind).to.equal(
        "referenceType"
      );

      // Simulate restoration (as exceptions.ts does)
      const restoredCtx: EmitterContext = {
        ...catchCtx,
        localNameMap: outerCtx.localNameMap,
        localSemanticTypes: outerSemantic,
        localValueTypes: outerStorage,
      };

      // catch variable must not leak
      expect(restoredCtx.localSemanticTypes?.has("ex")).to.equal(false);
      expect(restoredCtx.localValueTypes?.has("ex")).to.equal(false);
      // outer binding preserved
      expect(restoredCtx.localSemanticTypes?.get("x")).to.deep.equal(
        aliasedUnion
      );
      expect(restoredCtx.localValueTypes?.get("x")).to.deep.equal(
        storageObject
      );
    });
  });

  describe("semantic vs storage type identity", () => {
    it("semantic preserves alias-shaped union while storage can differ", () => {
      const semanticType: IrType = {
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "number" },
        ],
      };
      const storageType: IrType = { kind: "anyType" };

      const ctx = registerLocalSymbolTypes(
        "val",
        semanticType,
        storageType,
        baseContext
      );

      const semantic = ctx.localSemanticTypes?.get("val");
      const storage = ctx.localValueTypes?.get("val");

      // Semantic preserves the union shape
      expect(semantic?.kind).to.equal("unionType");
      expect(
        (semantic as Extract<IrType, { kind: "unionType" }>).types
      ).to.have.length(2);

      // Storage is the normalized carrier
      expect(storage?.kind).to.equal("anyType");

      // They are not the same object
      expect(semantic).to.not.deep.equal(storage);
    });
  });

  describe("registerLocalSemanticType (Phase 2A centralized helper)", () => {
    it("derives storage from semantic via normalization for primitive types", () => {
      const ctx = registerLocalSemanticType("x", stringType, baseContext);
      expect(ctx.localSemanticTypes?.get("x")).to.deep.equal(stringType);
      // string normalizes to string (identity) for storage
      expect(ctx.localValueTypes?.get("x")).to.deep.equal(stringType);
    });

    it("derives normalized storage for reference types with runtime union members", () => {
      // A union of string | number has a runtime-union carrier as storage
      const unionType: IrType = {
        kind: "unionType",
        types: [stringType, numberType],
      };
      const ctx = registerLocalSemanticType("val", unionType, baseContext);
      // Semantic preserves the union
      expect(ctx.localSemanticTypes?.get("val")?.kind).to.equal("unionType");
      // Storage may differ (depends on normalizeRuntimeStorageType behavior)
      expect(ctx.localValueTypes?.get("val")).to.not.equal(undefined);
    });

    it("handles undefined semantic type by clearing both channels", () => {
      const outerCtx = registerLocalSemanticType("x", stringType, baseContext);
      const clearedCtx = registerLocalSemanticType("x", undefined, outerCtx);
      expect(clearedCtx.localSemanticTypes?.has("x")).to.equal(false);
      expect(clearedCtx.localValueTypes?.has("x")).to.equal(false);
    });

    it("preserves existing bindings for other names", () => {
      const ctx1 = registerLocalSemanticType("a", stringType, baseContext);
      const ctx2 = registerLocalSemanticType("b", numberType, ctx1);
      expect(ctx2.localSemanticTypes?.get("a")).to.deep.equal(stringType);
      expect(ctx2.localSemanticTypes?.get("b")).to.deep.equal(numberType);
    });
  });

  describe("Phase 2B reader migration: resolveEffectiveExpressionType reads localSemanticTypes", () => {
    it("returns semantic type for an identifier registered via localSemanticTypes", () => {
      const semanticUnion: IrType = {
        kind: "unionType",
        types: [stringType, numberType],
      };
      const normalizedStorage: IrType = { kind: "anyType" };

      const ctx: EmitterContext = {
        ...baseContext,
        localSemanticTypes: new Map([["x", semanticUnion]]),
        localValueTypes: new Map([["x", normalizedStorage]]),
      };

      const result = resolveEffectiveExpressionType(
        { kind: "identifier", name: "x", inferredType: undefined },
        ctx
      );

      // Reader should return semantic union, not storage anyType
      expect(result?.kind).to.equal("unionType");
      expect(
        (result as Extract<IrType, { kind: "unionType" }>).types
      ).to.have.length(2);
    });

    it("falls back to inferredType when no localSemanticTypes entry exists", () => {
      const inferredType: IrType = {
        kind: "referenceType",
        name: "Foo",
      };

      const result = resolveEffectiveExpressionType(
        { kind: "identifier", name: "y", inferredType },
        baseContext
      );

      expect(result).to.deep.equal(inferredType);
    });

    it("prefers localSemanticTypes over inferredType for identifiers", () => {
      const semanticType: IrType = {
        kind: "unionType",
        types: [stringType, { kind: "primitiveType", name: "boolean" }],
      };
      const inferredType: IrType = { kind: "anyType" };

      const ctx: EmitterContext = {
        ...baseContext,
        localSemanticTypes: new Map([["z", semanticType]]),
      };

      // Registered semantic type takes precedence over inferredType
      const result = resolveEffectiveExpressionType(
        { kind: "identifier", name: "z", inferredType },
        ctx
      );

      expect(result?.kind).to.equal("unionType");
    });

    it("falls back to inferredType when localSemanticTypes has no entry", () => {
      const inferredType: IrType = { kind: "anyType" };

      const result = resolveEffectiveExpressionType(
        { kind: "identifier", name: "z", inferredType },
        baseContext
      );

      expect(result).to.deep.equal(inferredType);
    });

    it("does not read from localValueTypes for semantic resolution", () => {
      // Only storage is registered, no semantic entry
      const ctx: EmitterContext = {
        ...baseContext,
        localValueTypes: new Map([["w", storageObject]]),
      };

      // No inferredType, no localSemanticTypes entry — should return undefined
      const result = resolveEffectiveExpressionType(
        { kind: "identifier", name: "w" },
        ctx
      );

      expect(result).to.equal(undefined);
    });
  });
});
