/**
 * IR Builder tests: Struct Detection and Implements Clause basics
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import { createTestProgram } from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Struct Detection", () => {
    it("should detect struct marker in interface", () => {
      const source = `
        interface struct {
          readonly __brand: "struct";
        }

        export interface Point extends struct {
          x: number;
          y: number;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const body = result.value.body;
        const pointInterface = body.find(
          (stmt) =>
            stmt.kind === "interfaceDeclaration" && stmt.name === "Point"
        );
        expect(pointInterface).not.to.equal(undefined);
        if (pointInterface && pointInterface.kind === "interfaceDeclaration") {
          expect(pointInterface.isStruct).to.equal(true);
          // Verify __brand property is filtered out
          expect(
            pointInterface.members.some(
              (m) => m.kind === "propertySignature" && m.name === "__brand"
            )
          ).to.equal(false);
        }
      }
    });

    it("should detect struct marker in class", () => {
      const source = `
        interface struct {
          readonly __brand: "struct";
        }

        export class Vector3D implements struct {
          x: number;
          y: number;
          z: number;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const body = result.value.body;
        const vectorClass = body.find(
          (stmt) => stmt.kind === "classDeclaration" && stmt.name === "Vector3D"
        );
        expect(vectorClass).not.to.equal(undefined);
        if (vectorClass && vectorClass.kind === "classDeclaration") {
          expect(vectorClass.isStruct).to.equal(true);
          // Verify __brand property is filtered out
          expect(
            vectorClass.members.some(
              (m) => m.kind === "propertyDeclaration" && m.name === "__brand"
            )
          ).to.equal(false);
        }
      }
    });

    it("should not mark regular class as struct", () => {
      const source = `
        export class RegularClass {
          value: number;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const body = result.value.body;
        const regularClass = body[0];
        expect(regularClass).not.to.equal(undefined);
        if (regularClass && regularClass.kind === "classDeclaration") {
          expect(regularClass.isStruct).to.equal(false);
        }
      }
    });
  });

  describe("Implements Clause Handling", () => {
    it("should allow class implements interface (emitter decides CLR shape)", () => {
      const source = `
        interface Printable {
          print(): void;
        }

        export class Document implements Printable {
          print(): void {}
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
    });

    it("should allow struct marker in implements clause", () => {
      const source = `
        interface struct {
          readonly __brand: "struct";
        }

        export class Point implements struct {
          x: number;
          y: number;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
    });

    it("should allow class implements type alias (emitter decides CLR shape)", () => {
      const source = `
        type Serializable = {
          serialize(): string;
        };

        export class Config implements Serializable {
          serialize(): string { return "{}"; }
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
    });
  });
});
