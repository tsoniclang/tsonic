import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  getTstsIdentifierText,
  getTstsTypeReferenceName,
  visitTstsSubtree,
} from "@tsonic/tsts";
import type { GoPtr, TstsNode } from "@tsonic/tsts";
import { numericPrimitiveFactKey } from "./source-facts.js";
import { createTstsSemanticView } from "./tsts-semantic-view.js";
import { createTstsSourceFrontend } from "./tsts-source-frontend.js";

const repoRoot = path.resolve(import.meta.dirname, "../../../..");

describe("TSTS semantic view", () => {
  const withTempSource = (
    sourceText: string,
    run: (filePath: string) => void
  ): void => {
    const tempRoot = path.join(process.cwd(), ".temp", "tsts-semantic-view");
    fs.mkdirSync(tempRoot, { recursive: true });
    const sourceRoot = fs.mkdtempSync(path.join(tempRoot, "case-"));
    const filePath = path.join(sourceRoot, "index.ts");
    fs.writeFileSync(filePath, sourceText);
    try {
      run(filePath);
    } finally {
      fs.rmSync(sourceRoot, { recursive: true, force: true });
    }
  };

  const must = <T>(value: GoPtr<T>, message: string): T => {
    if (value === undefined) {
      throw new Error(message);
    }
    return value;
  };

  it("reads TSTS extension facts and flow-sensitive types directly", () => {
    const sourceText = [
      'import type { int } from "@tsonic/core/types.js";',
      "export function read(count: int, value: string | number) {",
      '  if (typeof value === "string") {',
      "    return value;",
      "  }",
      "  return count;",
      "}",
      "",
    ].join("\n");

    withTempSource(sourceText, (filePath) => {
      const frontend = createTstsSourceFrontend();
      const program = frontend.createProgram([filePath], {
        projectRoot: repoRoot,
        runSemanticChecks: true,
      });
      const sourceFile = must(program.sourceFiles[0], "source file missing");
      const valueUseTypes: string[] = [];
      let intReference: GoPtr<TstsNode>;

      program.withSourceSemantics(sourceFile, (checker) => {
        const view = createTstsSemanticView(
          checker,
          program.extensionHost.facts
        );

        visitTstsSubtree(sourceFile, (node) => {
          if (!node) return;
          if (
            intReference === undefined &&
            getTstsTypeReferenceName(node) === "int"
          ) {
            intReference = node;
          }

          if (getTstsIdentifierText(node) !== "value") {
            return;
          }
          const type = view.getExpressionType(node);
          if (type !== undefined) {
            valueUseTypes.push(view.typeToString(type));
          }
        });

        expect(view.engine).to.equal("tsts");
        expect(
          view.getFact(
            must(intReference, "int reference missing"),
            numericPrimitiveFactKey
          )
        ).to.deep.equal({
          sourceName: "int",
          kind: "int32",
          runtimeBase: "number",
          signed: true,
          width: 32,
        });
      });

      expect(program.diagnostics).to.deep.equal([]);
      expect(valueUseTypes).to.include("string | number");
      expect(valueUseTypes).to.include("string");
    });
  });
});
