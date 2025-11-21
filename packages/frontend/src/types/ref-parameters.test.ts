/**
 * Tests for ref/out parameter handling
 */

import { describe, it } from "mocha";
import { strict as assert } from "assert";
import {
  getParameterModifier,
  requiresTSByRef,
  generateCSharpParameter,
  generateCSharpArgument,
} from "./ref-parameters.js";
import type { ParameterMetadata } from "./metadata.js";

describe("Ref Parameters", () => {
  describe("getParameterModifier", () => {
    it("should return 'out' for out parameter", () => {
      const param: ParameterMetadata = {
        name: "result",
        type: "System.Int32",
        isRef: false,
        isOut: true,
        isParams: false,
      };

      const modifier = getParameterModifier(param);

      assert.equal(modifier, "out");
    });

    it("should return 'ref' for ref parameter", () => {
      const param: ParameterMetadata = {
        name: "value",
        type: "System.Int32",
        isRef: true,
        isOut: false,
        isParams: false,
      };

      const modifier = getParameterModifier(param);

      assert.equal(modifier, "ref");
    });

    it("should return 'in' for in parameter", () => {
      const param: ParameterMetadata = {
        name: "data",
        type: "LargeStruct",
        isRef: false,
        isOut: false,
        isIn: true,
        isParams: false,
      };

      const modifier = getParameterModifier(param);

      assert.equal(modifier, "in");
    });

    it("should return 'none' for regular parameter", () => {
      const param: ParameterMetadata = {
        name: "input",
        type: "System.String",
        isRef: false,
        isOut: false,
        isParams: false,
      };

      const modifier = getParameterModifier(param);

      assert.equal(modifier, "none");
    });

    it("should prioritize 'out' over 'ref'", () => {
      // This should not happen in valid metadata, but test defensive behavior
      const param: ParameterMetadata = {
        name: "weird",
        type: "System.Int32",
        isRef: true,
        isOut: true,
        isParams: false,
      };

      const modifier = getParameterModifier(param);

      assert.equal(modifier, "out");
    });
  });

  describe("requiresTSByRef", () => {
    it("should return true for out parameter", () => {
      const param: ParameterMetadata = {
        name: "result",
        type: "System.Int32",
        isRef: false,
        isOut: true,
        isParams: false,
      };

      assert.ok(requiresTSByRef(param));
    });

    it("should return true for ref parameter", () => {
      const param: ParameterMetadata = {
        name: "value",
        type: "System.Int32",
        isRef: true,
        isOut: false,
        isParams: false,
      };

      assert.ok(requiresTSByRef(param));
    });

    it("should return true for in parameter", () => {
      const param: ParameterMetadata = {
        name: "data",
        type: "LargeStruct",
        isRef: false,
        isOut: false,
        isIn: true,
        isParams: false,
      };

      assert.ok(requiresTSByRef(param));
    });

    it("should return false for regular parameter", () => {
      const param: ParameterMetadata = {
        name: "input",
        type: "System.String",
        isRef: false,
        isOut: false,
        isParams: false,
      };

      assert.ok(!requiresTSByRef(param));
    });
  });

  describe("generateCSharpParameter", () => {
    it("should generate out parameter", () => {
      const param = generateCSharpParameter("out", "int", "result");

      assert.equal(param, "out int result");
    });

    it("should generate ref parameter", () => {
      const param = generateCSharpParameter("ref", "string", "value");

      assert.equal(param, "ref string value");
    });

    it("should generate in parameter", () => {
      const param = generateCSharpParameter("in", "LargeStruct", "data");

      assert.equal(param, "in LargeStruct data");
    });

    it("should generate regular parameter without keyword", () => {
      const param = generateCSharpParameter("none", "string", "input");

      assert.equal(param, "string input");
    });
  });

  describe("generateCSharpArgument", () => {
    it("should generate out argument", () => {
      const arg = generateCSharpArgument("out", "result");

      assert.equal(arg, "out result");
    });

    it("should generate ref argument", () => {
      const arg = generateCSharpArgument("ref", "value");

      assert.equal(arg, "ref value");
    });

    it("should generate in argument", () => {
      const arg = generateCSharpArgument("in", "data");

      assert.equal(arg, "in data");
    });

    it("should generate regular argument without keyword", () => {
      const arg = generateCSharpArgument("none", "input");

      assert.equal(arg, "input");
    });
  });
});
