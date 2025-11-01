/**
 * Tests for Result type
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  ok,
  error,
  map,
  flatMap,
  mapError,
  unwrapOr,
  unwrapOrElse,
  isOk,
  isError,
} from "./result.js";

describe("Result", () => {
  describe("ok and error constructors", () => {
    it("should create ok result", () => {
      const result = ok<number, string>(42);
      expect(result.ok).to.equal(true);
      if (result.ok) {
        expect(result.value).to.equal(42);
      }
    });

    it("should create error result", () => {
      const result = error<number, string>("Something went wrong");
      expect(result.ok).to.equal(false);
      if (!result.ok) {
        expect(result.error).to.equal("Something went wrong");
      }
    });
  });

  describe("map", () => {
    it("should map ok value", () => {
      const result = ok<number, string>(5);
      const mapped = map(result, (x) => x * 2);

      expect(mapped.ok).to.equal(true);
      if (mapped.ok) {
        expect(mapped.value).to.equal(10);
      }
    });

    it("should pass through error", () => {
      const result = error<number, string>("Error");
      const mapped = map(result, (x) => x * 2);

      expect(mapped.ok).to.equal(false);
      if (!mapped.ok) {
        expect(mapped.error).to.equal("Error");
      }
    });
  });

  describe("flatMap", () => {
    it("should flatMap ok value", () => {
      const result = ok<number, string>(5);
      const mapped = flatMap(result, (x) => ok(x.toString()));

      expect(mapped.ok).to.equal(true);
      if (mapped.ok) {
        expect(mapped.value).to.equal("5");
      }
    });

    it("should handle flatMap returning error", () => {
      const result = ok<number, string>(5);
      const mapped = flatMap(result, (x) =>
        x > 10 ? ok(x) : error("Too small")
      );

      expect(mapped.ok).to.equal(false);
      if (!mapped.ok) {
        expect(mapped.error).to.equal("Too small");
      }
    });

    it("should pass through original error", () => {
      const result = error<number, string>("Original error");
      const mapped = flatMap(result, (x) => ok(x * 2));

      expect(mapped.ok).to.equal(false);
      if (!mapped.ok) {
        expect(mapped.error).to.equal("Original error");
      }
    });
  });

  describe("mapError", () => {
    it("should map error value", () => {
      const result = error<number, string>("Error");
      const mapped = mapError(result, (e) => e.toUpperCase());

      expect(mapped.ok).to.equal(false);
      if (!mapped.ok) {
        expect(mapped.error).to.equal("ERROR");
      }
    });

    it("should pass through ok value", () => {
      const result = ok<number, string>(42);
      const mapped = mapError(result, (e) => e.toUpperCase());

      expect(mapped.ok).to.equal(true);
      if (mapped.ok) {
        expect(mapped.value).to.equal(42);
      }
    });
  });

  describe("unwrapOr", () => {
    it("should return value for ok", () => {
      const result = ok<number, string>(42);
      expect(unwrapOr(result, 0)).to.equal(42);
    });

    it("should return default for error", () => {
      const result = error<number, string>("Error");
      expect(unwrapOr(result, 0)).to.equal(0);
    });
  });

  describe("unwrapOrElse", () => {
    it("should return value for ok", () => {
      const result = ok<number, string>(42);
      expect(unwrapOrElse(result, (_e) => 0)).to.equal(42);
    });

    it("should call function for error", () => {
      const result = error<number, string>("Error");
      expect(unwrapOrElse(result, () => 0)).to.equal(0);
    });
  });

  describe("isOk and isError", () => {
    it("should identify ok results", () => {
      const okResult = ok<number, string>(42);
      const errorResult = error<number, string>("Error");

      expect(isOk(okResult)).to.equal(true);
      expect(isOk(errorResult)).to.equal(false);
    });

    it("should identify error results", () => {
      const okResult = ok<number, string>(42);
      const errorResult = error<number, string>("Error");

      expect(isError(okResult)).to.equal(false);
      expect(isError(errorResult)).to.equal(true);
    });
  });
});
