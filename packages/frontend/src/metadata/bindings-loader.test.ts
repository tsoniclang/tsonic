/**
 * Tests for bindings JSON loader
 */

import { describe, it } from "mocha";
import { strict as assert } from "assert";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  loadBindingsFile,
  buildBindingsRegistry,
  lookupTypeBinding,
} from "./bindings-loader.js";
import type { BindingsFile } from "../types/bindings.js";

describe("Bindings Loader", () => {
  describe("loadBindingsFile", () => {
    it("should load valid bindings file", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tsonic-test-"));
      const bindingsPath = path.join(tmpDir, "test.bindings.json");

      const bindings: BindingsFile = {
        namespace: "System",
        types: [
          {
            clrName: "System.String",
            tsEmitName: "String",
            assemblyName: "System.Runtime",
            metadataToken: 0x02000001,
            methods: [],
            exposedMethods: [],
          },
        ],
      };

      fs.writeFileSync(bindingsPath, JSON.stringify(bindings, null, 2));

      const result = loadBindingsFile(bindingsPath);

      // Cleanup
      fs.unlinkSync(bindingsPath);
      fs.rmdirSync(tmpDir);

      assert.ok(result.ok);
      if (result.ok) {
        assert.equal(result.value.namespace, "System");
        assert.equal(result.value.types.length, 1);
        assert.equal(result.value.types[0]?.tsEmitName, "String");
      }
    });

    it("should return error for non-existent file", () => {
      const result = loadBindingsFile("/nonexistent/file.bindings.json");

      assert.ok(!result.ok);
      if (!result.ok) {
        assert.equal(result.error[0]?.code, "TSN9101");
      }
    });

    it("should return error for invalid JSON", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tsonic-test-"));
      const bindingsPath = path.join(tmpDir, "invalid.bindings.json");

      fs.writeFileSync(bindingsPath, "{ invalid json }");

      const result = loadBindingsFile(bindingsPath);

      // Cleanup
      fs.unlinkSync(bindingsPath);
      fs.rmdirSync(tmpDir);

      assert.ok(!result.ok);
      if (!result.ok) {
        assert.equal(result.error[0]?.code, "TSN9103");
      }
    });
  });

  describe("buildBindingsRegistry", () => {
    it("should build registry from bindings files", () => {
      const bindings1: BindingsFile = {
        namespace: "System",
        types: [
          {
            clrName: "System.String",
            tsEmitName: "String",
            assemblyName: "System.Runtime",
            metadataToken: 0x02000001,
          },
        ],
      };

      const bindings2: BindingsFile = {
        namespace: "System.Collections",
        types: [
          {
            clrName: "System.Collections.ArrayList",
            tsEmitName: "ArrayList",
            assemblyName: "System.Collections",
            metadataToken: 0x02000002,
          },
        ],
      };

      const registry = buildBindingsRegistry([bindings1, bindings2]);

      assert.equal(registry.size, 2);
      assert.ok(registry.has("System.String"));
      assert.ok(registry.has("System.Collections.ArrayList"));
    });
  });

  describe("lookupTypeBinding", () => {
    it("should find type binding in registry", () => {
      const bindings: BindingsFile = {
        namespace: "System",
        types: [
          {
            clrName: "System.String",
            tsEmitName: "String",
            assemblyName: "System.Runtime",
            metadataToken: 0x02000001,
          },
        ],
      };

      const registry = buildBindingsRegistry([bindings]);
      const binding = lookupTypeBinding(registry, "System.String");

      assert.ok(binding);
      assert.equal(binding?.tsEmitName, "String");
      assert.equal(binding?.metadataToken, 0x02000001);
    });

    it("should return undefined for non-existent type", () => {
      const registry = buildBindingsRegistry([]);
      const binding = lookupTypeBinding(registry, "NonExistent.Type");

      assert.equal(binding, undefined);
    });
  });
});
