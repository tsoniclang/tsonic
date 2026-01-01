/**
 * Assembly Catalog Tests
 *
 * Tests for loading CLR metadata from bindings.json/metadata.json files.
 */

import { expect } from "chai";
import * as path from "path";
import {
  loadSinglePackageMetadata,
  getTypeByStableId,
  getTypeByTsName,
  getMemberByTsName,
} from "./assembly-catalog.js";

describe("AssemblyTypeCatalog", () => {
  // Path to System metadata - this is where System.String lives
  const systemMetadataPath = path.resolve(
    process.cwd(),
    "../..",
    "node_modules/@tsonic/dotnet/System/internal/metadata.json"
  );

  describe("loadSinglePackageMetadata", () => {
    it("should load System.String from metadata.json", () => {
      const catalog = loadSinglePackageMetadata(systemMetadataPath);

      const stringEntry = getTypeByStableId(
        catalog,
        "System.Private.CoreLib:System.String"
      );

      expect(stringEntry).to.not.be.undefined;
      expect(stringEntry?.typeId.stableId).to.equal(
        "System.Private.CoreLib:System.String"
      );
      expect(stringEntry?.typeId.clrName).to.equal("System.String");
      expect(stringEntry?.typeId.tsName).to.equal("String");
      expect(stringEntry?.kind).to.equal("class");
    });

    it("should load System.String by TS name lookup", () => {
      const catalog = loadSinglePackageMetadata(systemMetadataPath);

      const stringEntry = getTypeByTsName(catalog, "String");

      expect(stringEntry).to.not.be.undefined;
      expect(stringEntry?.typeId.clrName).to.equal("System.String");
    });

    it("should have length property on System.String", () => {
      const catalog = loadSinglePackageMetadata(systemMetadataPath);

      const lengthMember = getMemberByTsName(
        catalog,
        "System.Private.CoreLib:System.String",
        "length"
      );

      expect(lengthMember).to.not.be.undefined;
      expect(lengthMember?.tsName).to.equal("length");
      expect(lengthMember?.clrName).to.equal("Length");
      expect(lengthMember?.memberKind).to.equal("property");
      expect(lengthMember?.type).to.deep.equal({
        kind: "primitiveType",
        name: "int",
      });
    });

    it("should have chars indexer property on System.String", () => {
      const catalog = loadSinglePackageMetadata(systemMetadataPath);

      const charsMember = getMemberByTsName(
        catalog,
        "System.Private.CoreLib:System.String",
        "chars"
      );

      expect(charsMember).to.not.be.undefined;
      expect(charsMember?.isIndexer).to.be.true;
      expect(charsMember?.type).to.deep.equal({
        kind: "primitiveType",
        name: "char",
      });
    });

    it("should have substring method on System.String", () => {
      const catalog = loadSinglePackageMetadata(systemMetadataPath);

      const substringMember = getMemberByTsName(
        catalog,
        "System.Private.CoreLib:System.String",
        "substring"
      );

      expect(substringMember).to.not.be.undefined;
      expect(substringMember?.memberKind).to.equal("method");
      expect(substringMember?.signatures).to.not.be.undefined;
      expect(substringMember?.signatures?.length).to.be.greaterThan(0);

      // Check return type of substring is string
      const firstSig = substringMember?.signatures?.[0];
      expect(firstSig?.returnType).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });
    });

    it("should have compare static method on System.String", () => {
      const catalog = loadSinglePackageMetadata(systemMetadataPath);

      const compareMember = getMemberByTsName(
        catalog,
        "System.Private.CoreLib:System.String",
        "compare"
      );

      expect(compareMember).to.not.be.undefined;
      expect(compareMember?.memberKind).to.equal("method");
      expect(compareMember?.isStatic).to.be.true;
      // Multiple overloads
      expect(compareMember?.signatures?.length).to.be.greaterThan(1);
    });

    it("should have empty static field on System.String", () => {
      const catalog = loadSinglePackageMetadata(systemMetadataPath);

      const emptyMember = getMemberByTsName(
        catalog,
        "System.Private.CoreLib:System.String",
        "empty"
      );

      expect(emptyMember).to.not.be.undefined;
      expect(emptyMember?.memberKind).to.equal("field");
      expect(emptyMember?.isStatic).to.be.true;
      expect(emptyMember?.type).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });
    });
  });

  describe("Type parsing", () => {
    it("should parse System.Int32 enum correctly", () => {
      const catalog = loadSinglePackageMetadata(systemMetadataPath);

      const enumEntry = getTypeByStableId(
        catalog,
        "System.Private.CoreLib:System.AttributeTargets"
      );

      expect(enumEntry).to.not.be.undefined;
      expect(enumEntry?.kind).to.equal("enum");
    });

    it("should have correct accessibility for public types", () => {
      const catalog = loadSinglePackageMetadata(systemMetadataPath);

      const stringEntry = getTypeByStableId(
        catalog,
        "System.Private.CoreLib:System.String"
      );

      expect(stringEntry?.accessibility).to.equal("public");
    });

    it("should recognize sealed classes", () => {
      const catalog = loadSinglePackageMetadata(systemMetadataPath);

      const stringEntry = getTypeByStableId(
        catalog,
        "System.Private.CoreLib:System.String"
      );

      // System.String is sealed
      expect(stringEntry?.isSealed).to.be.true;
    });
  });
});
