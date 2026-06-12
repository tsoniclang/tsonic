import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as ts from "typescript";
import { createProgram } from "../creation.js";
import { installMinimalCoreGlobalsSurface } from "./test-package-helpers.js";
import { getTstsTypeReferenceName, visitTstsSubtree } from "@tsonic/tsts";
import {
  fieldSemanticsFactKey,
  intrinsicSemanticsFactKey,
  numericPrimitiveFactKey,
  parameterPassingFactKey,
  sourceTypeSemanticsFactKey,
} from "../../source-frontend/source-facts.js";

const createTempProgram = (
  sourceText = [
    'import type { int } from "@tsonic/core/types.js";',
    "export const value: int = 1;",
    "",
  ].join("\n")
): {
  readonly projectRoot: string;
  readonly sourceRoot: string;
  readonly entryPath: string;
  readonly globalsRoot: string;
  readonly cleanup: () => void;
} => {
  const projectRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "tsonic-source-frontend-")
  );
  const sourceRoot = path.join(projectRoot, "src");
  const entryPath = path.join(sourceRoot, "index.ts");
  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.writeFileSync(entryPath, sourceText);
  const globalsRoot = installMinimalCoreGlobalsSurface(projectRoot);
  return {
    projectRoot,
    sourceRoot,
    entryPath,
    globalsRoot,
    cleanup: () => fs.rmSync(projectRoot, { recursive: true, force: true }),
  };
};

describe("Program Creation – source frontend engine", () => {
  it("builds a TSTS source program by default", () => {
    const fixture = createTempProgram();
    try {
      const result = createProgram([fixture.entryPath], {
        projectRoot: fixture.projectRoot,
        sourceRoot: fixture.sourceRoot,
        rootNamespace: "Test",
        surface: "@tsonic/globals",
        typeRoots: [fixture.globalsRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(result.value.sourceProgram.engine).to.equal("tsts");
      expect(result.value.sourceProgram.sourceFiles).to.have.length.greaterThan(
        0
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("attaches Tsonic source facts through the TSTS extension host", () => {
    const fixture = createTempProgram();
    try {
      const result = createProgram([fixture.entryPath], {
        projectRoot: fixture.projectRoot,
        sourceRoot: fixture.sourceRoot,
        rootNamespace: "Test",
        surface: "@tsonic/globals",
        typeRoots: [fixture.globalsRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const facts = result.value.sourceProgram.extensionHost.facts;
      const primitiveKinds: string[] = [];
      for (const sourceFile of result.value.sourceProgram.sourceFiles) {
        visitTstsSubtree(sourceFile, (node) => {
          if (!node || getTstsTypeReferenceName(node) !== "int") return;
          const fact = facts.get(numericPrimitiveFactKey, node);
          if (fact) {
            primitiveKinds.push(fact.kind);
          }
        });
      }

      expect(primitiveKinds).to.deep.equal(["int32"]);
    } finally {
      fixture.cleanup();
    }
  });

  it("projects TSTS source facts onto the frontend source semantic view", () => {
    const fixture = createTempProgram(
      [
        'import type { int, out, struct as valueType } from "@tsonic/core/types.js";',
        'import { defaultof, field } from "@tsonic/core/lang.js";',
        "export interface Point extends valueType {",
        "  x: field<int>;",
        "}",
        "export function reset(value: out<int>): void {",
        "  defaultof<int>();",
        "}",
        "",
      ].join("\n")
    );
    try {
      const result = createProgram([fixture.entryPath], {
        projectRoot: fixture.projectRoot,
        sourceRoot: fixture.sourceRoot,
        rootNamespace: "Test",
        surface: "@tsonic/globals",
        typeRoots: [fixture.globalsRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const sourceFile = result.value.sourceFiles.find(
        (candidate) => candidate.fileName === fixture.entryPath
      );
      expect(sourceFile).to.not.equal(undefined);
      if (!sourceFile) return;

      const projected: string[] = [];
      const visit = (node: ts.Node): void => {
        const primitive = result.value.sourceSemantics.getFact(
          node,
          numericPrimitiveFactKey
        );
        if (primitive) projected.push(`primitive:${primitive.kind}`);

        const typeSemantics = result.value.sourceSemantics.getFact(
          node,
          sourceTypeSemanticsFactKey
        );
        if (typeSemantics) projected.push(`type:${typeSemantics.kind}`);

        const field = result.value.sourceSemantics.getFact(
          node,
          fieldSemanticsFactKey
        );
        if (field) projected.push(`field:${field.storage}`);

        const passing = result.value.sourceSemantics.getFact(
          node,
          parameterPassingFactKey
        );
        if (passing) projected.push(`passing:${passing.mode}`);

        const intrinsic = result.value.sourceSemantics.getFact(
          node,
          intrinsicSemanticsFactKey
        );
        if (intrinsic) projected.push(`intrinsic:${intrinsic.kind}`);

        ts.forEachChild(node, visit);
      };

      visit(sourceFile);

      expect(projected).to.include.members([
        "type:struct",
        "field:field",
        "primitive:int32",
        "passing:byref-writeonly-must-init",
        "intrinsic:defaultof",
      ]);
    } finally {
      fixture.cleanup();
    }
  });
});
