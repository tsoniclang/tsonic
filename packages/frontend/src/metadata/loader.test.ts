/**
 * Tests for metadata JSON loader
 */

import { describe, it } from "mocha";
import { strict as assert } from "assert";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { loadMetadataFile, loadMetadataDirectory } from "./loader.js";
import type { MetadataFile } from "../types/metadata.js";

describe("Metadata Loader", () => {
  describe("loadMetadataFile", () => {
    it("should load valid metadata file", () => {
      // Create temporary metadata file
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tsonic-test-"));
      const metadataPath = path.join(tmpDir, "test.metadata.json");

      const metadata: MetadataFile = {
        namespace: "System",
        contributingAssemblies: ["System.Runtime"],
        types: [
          {
            clrName: "System.String",
            tsEmitName: "String",
            kind: "Class",
            accessibility: "Public",
            isAbstract: false,
            isSealed: true,
            isStatic: false,
            arity: 0,
            methods: [],
            properties: [],
            fields: [],
            events: [],
            constructors: [],
          },
        ],
      };

      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      const result = loadMetadataFile(metadataPath);

      // Cleanup
      fs.unlinkSync(metadataPath);
      fs.rmdirSync(tmpDir);

      assert.ok(result.ok);
      if (result.ok) {
        assert.equal(result.value.namespace, "System");
        assert.equal(result.value.types.length, 1);
        assert.equal(result.value.types[0]?.tsEmitName, "String");
      }
    });

    it("should return error for non-existent file", () => {
      const result = loadMetadataFile("/nonexistent/file.metadata.json");

      assert.ok(!result.ok);
      if (!result.ok) {
        assert.equal(result.error[0]?.code, "TSN9001");
      }
    });

    it("should return error for invalid JSON", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tsonic-test-"));
      const metadataPath = path.join(tmpDir, "invalid.metadata.json");

      fs.writeFileSync(metadataPath, "{ invalid json }");

      const result = loadMetadataFile(metadataPath);

      // Cleanup
      fs.unlinkSync(metadataPath);
      fs.rmdirSync(tmpDir);

      assert.ok(!result.ok);
      if (!result.ok) {
        assert.equal(result.error[0]?.code, "TSN9003");
      }
    });

    it("should return error for missing required fields", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tsonic-test-"));
      const metadataPath = path.join(tmpDir, "incomplete.metadata.json");

      // Missing namespace field
      fs.writeFileSync(
        metadataPath,
        JSON.stringify({ contributingAssemblies: [], types: [] })
      );

      const result = loadMetadataFile(metadataPath);

      // Cleanup
      fs.unlinkSync(metadataPath);
      fs.rmdirSync(tmpDir);

      assert.ok(!result.ok);
      if (!result.ok) {
        assert.equal(result.error[0]?.code, "TSN9005");
      }
    });
  });

  describe("loadMetadataDirectory", () => {
    it("should load all metadata files from directory", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tsonic-test-"));

      // Create two metadata files
      const metadata1: MetadataFile = {
        namespace: "System",
        contributingAssemblies: ["System.Runtime"],
        types: [],
      };

      const metadata2: MetadataFile = {
        namespace: "System.Collections",
        contributingAssemblies: ["System.Collections"],
        types: [],
      };

      fs.writeFileSync(
        path.join(tmpDir, "System.metadata.json"),
        JSON.stringify(metadata1)
      );
      fs.writeFileSync(
        path.join(tmpDir, "System.Collections.metadata.json"),
        JSON.stringify(metadata2)
      );

      const result = loadMetadataDirectory(tmpDir);

      // Cleanup
      fs.unlinkSync(path.join(tmpDir, "System.metadata.json"));
      fs.unlinkSync(path.join(tmpDir, "System.Collections.metadata.json"));
      fs.rmdirSync(tmpDir);

      assert.ok(result.ok);
      if (result.ok) {
        assert.equal(result.value.length, 2);
      }
    });

    it("should return error for non-existent directory", () => {
      const result = loadMetadataDirectory("/nonexistent/directory");

      assert.ok(!result.ok);
      if (!result.ok) {
        assert.equal(result.error[0]?.code, "TSN9016");
      }
    });
  });
});
