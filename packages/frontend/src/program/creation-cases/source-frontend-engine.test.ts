import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createProgram } from "../creation.js";
import { installMinimalCoreGlobalsSurface } from "./test-package-helpers.js";
import {
  getTstsTypeReferenceName,
  visitTstsSubtree,
} from "@tsonic/tsts";
import { tsonicNumericPrimitiveFactKey } from "../../tsonic-extension/index.js";

const createTempProgram = (): {
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
  fs.writeFileSync(
    entryPath,
    [
      'import type { int } from "@tsonic/core/types.js";',
      "export const value: int = 1;",
      "",
    ].join("\n")
  );
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
          const fact = facts.get(tsonicNumericPrimitiveFactKey, node);
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
});
