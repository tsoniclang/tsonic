/**
 * Tests for IR Soundness Gate – Deterministic Inference Diagnostics
 *
 * Validates that the soundness gate correctly emits diagnostics when:
 * - Call return type recovery fails (TSN5201)
 * - Constructor type argument recovery fails (TSN5202)
 * - Root inferred unknown call types still use the targeted TSN5201 diagnostic
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { validateIrSoundness } from "../soundness-gate.js";
import { IrModule } from "../../types.js";

describe("IR Soundness Gate", () => {
  describe("Deterministic inference diagnostics", () => {
    it("emits TSN5201 when call return type recovery fails", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "test",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "expressionStatement",
            expression: {
              kind: "call",
              callee: {
                kind: "identifier",
                name: "foo",
                inferredType: {
                  kind: "functionType",
                  parameters: [],
                  returnType: { kind: "primitiveType", name: "number" },
                },
              },
              arguments: [],
              isOptional: false,
              inferredType: { kind: "unknownType" },
            },
          },
        ],
        exports: [],
      };

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN5201")).to.be.true;
    });

    it("still emits TSN5201 for root unknown inferred call types", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "test",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "expressionStatement",
            expression: {
              kind: "call",
              callee: {
                kind: "memberAccess",
                object: { kind: "identifier", name: "JSON" },
                property: "parse",
                isComputed: false,
                isOptional: false,
              },
              arguments: [
                {
                  kind: "literal",
                  value: "{}",
                  raw: '"{}"',
                  inferredType: { kind: "primitiveType", name: "string" },
                },
              ],
              isOptional: false,
              inferredType: { kind: "unknownType" },
            },
          },
        ],
        exports: [],
      };

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN5201")).to.be.true;
      expect(result.diagnostics.some((d) => d.code === "TSN7414")).to.be.false;
    });

    it("emits TSN5202 when constructor type argument recovery fails", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "test",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "expressionStatement",
            expression: {
              kind: "new",
              callee: {
                kind: "identifier",
                name: "Foo_1",
                inferredType: {
                  kind: "referenceType",
                  name: "Foo_1",
                  providerQualifiedName: "global::Test.Foo_1",
                },
              },
              arguments: [],
              inferredType: { kind: "unknownType" },
            },
          },
        ],
        exports: [],
      };

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN5202")).to.be.true;
    });

    it("reports unrepresentable expression-owned types at the expression source span", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/checker.ts",
        namespace: "Test",
        className: "checker",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "expressionStatement",
            expression: {
              kind: "typeAssertion",
              expression: {
                kind: "literal",
                value: 1,
                raw: "1",
                inferredType: { kind: "primitiveType", name: "number" },
              },
              targetType: { kind: "unknownType" },
              inferredType: { kind: "unknownType" },
              sourceSpan: {
                file: "/src/checker.ts",
                line: 128,
                column: 17,
                length: 24,
              },
            },
          },
        ],
        exports: [],
      };

      const result = validateIrSoundness([module]);
      const diagnostic = result.diagnostics.find(
        (candidate) => candidate.code === "TSN7414"
      );

      expect(result.ok).to.equal(false);
      expect(diagnostic?.location).to.deep.include({
        line: 128,
        column: 17,
      });
    });
  });
});
