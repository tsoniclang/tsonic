/**
 * IR Builder tests: Module Structure and Export Handling
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import { createTestProgram } from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Module Structure", () => {
    it("should create IR module with correct namespace and class name", () => {
      const source = `
        export function greet(name: string): string {
          return \`Hello \${name}\`;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const module = result.value;
        expect(module.kind).to.equal("module");
        expect(module.namespace).to.equal("TestApp");
        expect(module.className).to.equal("test");
        expect(module.isStaticContainer).to.equal(true);
      }
    });

    it("should detect top-level code", () => {
      const source = `
        console.log("Hello");
        export const x = 42;
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        expect(result.value.isStaticContainer).to.equal(false);
      }
    });

    it("allows static module exports with the same name as the source file", () => {
      const source = `
        export function render(): string {
          return "ok";
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(
        source,
        "/test/render.ts"
      );
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        expect(result.value.className).to.equal("render");
        expect(result.value.isStaticContainer).to.equal(true);
      }
    });
  });

  describe("Export Handling", () => {
    it("should handle named exports", () => {
      const source = `
        const a = 1;
        const b = 2;
        export { a, b as c };
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const exports = result.value.exports;
        expect(exports).to.have.length(2);

        const firstExport = exports[0];
        if (!firstExport) throw new Error("Missing export");
        expect(firstExport.kind).to.equal("named");
        if (firstExport.kind === "named") {
          expect(firstExport.name).to.equal("a");
          expect(firstExport.localName).to.equal("a");
        }

        const second = exports[1];
        if (second && second.kind === "named") {
          expect(second.name).to.equal("c");
          expect(second.localName).to.equal("b");
        }
      }
    });

    it("should handle default export", () => {
      const source = `
        export default function main() {
          console.log("Hello");
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const exports = result.value.exports;
        expect(exports.some((e) => e.kind === "default")).to.equal(true);
      }
    });
  });
});
