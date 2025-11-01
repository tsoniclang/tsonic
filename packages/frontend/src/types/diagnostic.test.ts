/**
 * Tests for diagnostic types
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  createDiagnostic,
  formatDiagnostic,
  createDiagnosticsCollector,
  addDiagnostic,
  mergeDiagnostics,
  isError,
} from "./diagnostic.js";

describe("Diagnostics", () => {
  describe("createDiagnostic", () => {
    it("should create a diagnostic with all fields", () => {
      const diagnostic = createDiagnostic(
        "TSN1001",
        "error",
        "Test error",
        {
          file: "test.ts",
          line: 10,
          column: 5,
          length: 10,
        },
        "Try this instead",
        []
      );

      expect(diagnostic.code).to.equal("TSN1001");
      expect(diagnostic.severity).to.equal("error");
      expect(diagnostic.message).to.equal("Test error");
      expect(diagnostic.location?.file).to.equal("test.ts");
      expect(diagnostic.hint).to.equal("Try this instead");
    });

    it("should create a diagnostic without optional fields", () => {
      const diagnostic = createDiagnostic("TSN1002", "warning", "Test warning");

      expect(diagnostic.code).to.equal("TSN1002");
      expect(diagnostic.severity).to.equal("warning");
      expect(diagnostic.location).to.be.undefined;
      expect(diagnostic.hint).to.be.undefined;
    });
  });

  describe("formatDiagnostic", () => {
    it("should format diagnostic with location", () => {
      const diagnostic = createDiagnostic(
        "TSN1001",
        "error",
        "Missing .ts extension",
        {
          file: "/src/index.ts",
          line: 5,
          column: 10,
          length: 15,
        }
      );

      const formatted = formatDiagnostic(diagnostic);
      expect(formatted).to.equal(
        "/src/index.ts:5:10 error TSN1001: Missing .ts extension"
      );
    });

    it("should format diagnostic without location", () => {
      const diagnostic = createDiagnostic(
        "TSN2001",
        "warning",
        "Generic warning"
      );

      const formatted = formatDiagnostic(diagnostic);
      expect(formatted).to.equal("warning TSN2001: Generic warning");
    });

    it("should include hint if present", () => {
      const diagnostic = createDiagnostic(
        "TSN1001",
        "error",
        "Missing extension",
        undefined,
        "Add .ts extension"
      );

      const formatted = formatDiagnostic(diagnostic);
      expect(formatted).to.include("Hint: Add .ts extension");
    });
  });

  describe("DiagnosticsCollector", () => {
    it("should start with empty diagnostics", () => {
      const collector = createDiagnosticsCollector();
      expect(collector.diagnostics).to.have.length(0);
      expect(collector.hasErrors).to.be.false;
    });

    it("should add diagnostics immutably", () => {
      const collector1 = createDiagnosticsCollector();
      const diagnostic = createDiagnostic("TSN1001", "error", "Test");

      const collector2 = addDiagnostic(collector1, diagnostic);

      expect(collector1.diagnostics).to.have.length(0);
      expect(collector2.diagnostics).to.have.length(1);
      expect(collector2.hasErrors).to.be.true;
    });

    it("should track hasErrors correctly", () => {
      let collector = createDiagnosticsCollector();

      collector = addDiagnostic(
        collector,
        createDiagnostic("TSN1001", "warning", "Warning")
      );
      expect(collector.hasErrors).to.be.false;

      collector = addDiagnostic(
        collector,
        createDiagnostic("TSN1002", "error", "Error")
      );
      expect(collector.hasErrors).to.be.true;

      collector = addDiagnostic(
        collector,
        createDiagnostic("TSN1003", "info", "Info")
      );
      expect(collector.hasErrors).to.be.true; // Still has errors
    });

    it("should merge collectors", () => {
      const collector1 = addDiagnostic(
        createDiagnosticsCollector(),
        createDiagnostic("TSN1001", "error", "Error 1")
      );

      const collector2 = addDiagnostic(
        createDiagnosticsCollector(),
        createDiagnostic("TSN1002", "warning", "Warning 1")
      );

      const merged = mergeDiagnostics(collector1, collector2);

      expect(merged.diagnostics).to.have.length(2);
      expect(merged.hasErrors).to.be.true;
    });
  });

  describe("isError", () => {
    it("should identify error diagnostics", () => {
      const error = createDiagnostic("TSN1001", "error", "Test");
      const warning = createDiagnostic("TSN1002", "warning", "Test");
      const info = createDiagnostic("TSN1003", "info", "Test");

      expect(isError(error)).to.be.true;
      expect(isError(warning)).to.be.false;
      expect(isError(info)).to.be.false;
    });
  });
});
