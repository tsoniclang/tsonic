/**
 * Unified Type Catalog Tests
 *
 * Tests for the unified type catalog that merges source and assembly types.
 */

import { expect } from "chai";
import * as path from "path";
import { loadSinglePackageMetadata } from "./assembly-catalog.js";
import {
  buildUnifiedTypeCatalog,
  normalizePrimitiveToTypeId,
  getTypeId,
  getMemberDeclaredType,
} from "./unified-catalog.js";
import { PRIMITIVE_TO_STABLE_ID } from "./types.js";
import type { IrType } from "../types/index.js";

describe("UnifiedTypeCatalog", () => {
  // Path to System metadata
  const systemMetadataPath = path.resolve(
    process.cwd(),
    "../..",
    "node_modules/@tsonic/dotnet/System/internal/metadata.json"
  );

  describe("buildUnifiedTypeCatalog", () => {
    it("should build catalog from assembly metadata", () => {
      const assemblyCatalog = loadSinglePackageMetadata(systemMetadataPath);
      const catalog = buildUnifiedTypeCatalog(
        undefined,
        assemblyCatalog,
        "test"
      );

      // Check that we can look up System.String
      const stringTypeId = catalog.resolveTsName("String");
      expect(stringTypeId).to.not.be.undefined;
      expect(stringTypeId?.clrName).to.equal("System.String");
    });

    it("should provide member lookup for assembly types", () => {
      const assemblyCatalog = loadSinglePackageMetadata(systemMetadataPath);
      const catalog = buildUnifiedTypeCatalog(
        undefined,
        assemblyCatalog,
        "test"
      );

      const stringTypeId = catalog.resolveTsName("String");
      expect(stringTypeId).to.not.be.undefined;

      if (stringTypeId) {
        const lengthMember = catalog.getMember(stringTypeId, "length");
        expect(lengthMember).to.not.be.undefined;
        expect(lengthMember?.tsName).to.equal("length");
        expect(lengthMember?.type).to.deep.equal({
          kind: "primitiveType",
          name: "int",
        });
      }
    });
  });

  describe("normalizePrimitiveToTypeId", () => {
    it("should normalize string primitive to System.String TypeId", () => {
      const assemblyCatalog = loadSinglePackageMetadata(systemMetadataPath);
      const catalog = buildUnifiedTypeCatalog(
        undefined,
        assemblyCatalog,
        "test"
      );

      const stringType: IrType = { kind: "primitiveType", name: "string" };
      const typeId = normalizePrimitiveToTypeId(stringType, catalog);

      expect(typeId).to.not.be.undefined;
      expect(typeId?.stableId).to.equal("System.Private.CoreLib:System.String");
      expect(typeId?.clrName).to.equal("System.String");
    });

    it("should normalize int primitive to System.Int32 TypeId", () => {
      const assemblyCatalog = loadSinglePackageMetadata(systemMetadataPath);
      const catalog = buildUnifiedTypeCatalog(
        undefined,
        assemblyCatalog,
        "test"
      );

      const intType: IrType = { kind: "primitiveType", name: "int" };
      const typeId = normalizePrimitiveToTypeId(intType, catalog);

      expect(typeId).to.not.be.undefined;
      expect(typeId?.stableId).to.equal("System.Private.CoreLib:System.Int32");
    });

    it("should return undefined for non-primitive types", () => {
      const assemblyCatalog = loadSinglePackageMetadata(systemMetadataPath);
      const catalog = buildUnifiedTypeCatalog(
        undefined,
        assemblyCatalog,
        "test"
      );

      const refType: IrType = { kind: "referenceType", name: "SomeClass" };
      const typeId = normalizePrimitiveToTypeId(refType, catalog);

      expect(typeId).to.be.undefined;
    });
  });

  describe("getTypeId", () => {
    it("should get TypeId for primitive types via normalization", () => {
      const assemblyCatalog = loadSinglePackageMetadata(systemMetadataPath);
      const catalog = buildUnifiedTypeCatalog(
        undefined,
        assemblyCatalog,
        "test"
      );

      const stringType: IrType = { kind: "primitiveType", name: "string" };
      const typeId = getTypeId(stringType, catalog);

      expect(typeId).to.not.be.undefined;
      expect(typeId?.clrName).to.equal("System.String");
    });

    it("should get TypeId for reference types by name", () => {
      const assemblyCatalog = loadSinglePackageMetadata(systemMetadataPath);
      const catalog = buildUnifiedTypeCatalog(
        undefined,
        assemblyCatalog,
        "test"
      );

      // Console is a type in System namespace
      const consoleType: IrType = { kind: "referenceType", name: "Console" };
      const typeId = getTypeId(consoleType, catalog);

      expect(typeId).to.not.be.undefined;
      expect(typeId?.clrName).to.equal("System.Console");
    });
  });

  describe("getMemberDeclaredType", () => {
    it("should get member type for string.length", () => {
      const assemblyCatalog = loadSinglePackageMetadata(systemMetadataPath);
      const catalog = buildUnifiedTypeCatalog(
        undefined,
        assemblyCatalog,
        "test"
      );

      const stringType: IrType = { kind: "primitiveType", name: "string" };
      const memberType = getMemberDeclaredType(stringType, "length", catalog);

      expect(memberType).to.not.be.undefined;
      expect(memberType).to.deep.equal({
        kind: "primitiveType",
        name: "int",
      });
    });

    it("should get member type for string.chars (indexer)", () => {
      const assemblyCatalog = loadSinglePackageMetadata(systemMetadataPath);
      const catalog = buildUnifiedTypeCatalog(
        undefined,
        assemblyCatalog,
        "test"
      );

      const stringType: IrType = { kind: "primitiveType", name: "string" };
      const memberType = getMemberDeclaredType(stringType, "chars", catalog);

      expect(memberType).to.not.be.undefined;
      expect(memberType).to.deep.equal({
        kind: "primitiveType",
        name: "char",
      });
    });

    it("should return undefined for non-existent members", () => {
      const assemblyCatalog = loadSinglePackageMetadata(systemMetadataPath);
      const catalog = buildUnifiedTypeCatalog(
        undefined,
        assemblyCatalog,
        "test"
      );

      const stringType: IrType = { kind: "primitiveType", name: "string" };
      const memberType = getMemberDeclaredType(
        stringType,
        "nonExistentMember",
        catalog
      );

      expect(memberType).to.be.undefined;
    });

    it("should return undefined for types not in catalog", () => {
      const assemblyCatalog = loadSinglePackageMetadata(systemMetadataPath);
      const catalog = buildUnifiedTypeCatalog(
        undefined,
        assemblyCatalog,
        "test"
      );

      const unknownType: IrType = { kind: "referenceType", name: "UnknownType" };
      const memberType = getMemberDeclaredType(unknownType, "foo", catalog);

      expect(memberType).to.be.undefined;
    });
  });

  describe("PRIMITIVE_TO_STABLE_ID mapping", () => {
    it("should have correct mappings for all primitives", () => {
      expect(PRIMITIVE_TO_STABLE_ID.get("string")).to.equal(
        "System.Private.CoreLib:System.String"
      );
      expect(PRIMITIVE_TO_STABLE_ID.get("number")).to.equal(
        "System.Private.CoreLib:System.Double"
      );
      expect(PRIMITIVE_TO_STABLE_ID.get("int")).to.equal(
        "System.Private.CoreLib:System.Int32"
      );
      expect(PRIMITIVE_TO_STABLE_ID.get("boolean")).to.equal(
        "System.Private.CoreLib:System.Boolean"
      );
      expect(PRIMITIVE_TO_STABLE_ID.get("char")).to.equal(
        "System.Private.CoreLib:System.Char"
      );
    });
  });
});
